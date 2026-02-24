# monday-access-service

A production-grade REST API for managing internal application access requests.
Employees submit requests; approvers approve or deny them. An AI agent performs automated risk assessment on each request. All activity is captured with a full audit trail.

---

## Architecture
```text
                                  ┌────────────────────────┐
                                  │      HTTP CLIENT       │
                                  └───────────┬────────────┘
                                              │ HTTPS JSON
    ┌─────────────────────────────────────────▼────────────────────────────────────────┐
    │                            ENTRY POINT & SECURITY                                │
    │  ┌────────────────┐      ┌────────────────────┐      ┌────────────────────────┐  │
    │  │  Rate Limiter  │─────▶│  Security Headers  │─────▶│    Express Router      │  │
    │  └────────────────┘      └────────────────────┘      └──────────┬─────────────┘  │
    └─────────────────────────────────────────────────────────────────│────────────────┘
                                                                      │
                ┌──────────────────────────────┬──────────────────────┴─────────────┐
                ▼                              ▼                                    ▼
    ┌───────────────────────┐      ┌───────────────────────┐            ┌───────────────────────┐
    │     HEALTH CHECK      │      │     AUTH MODULE       │            │ ACCESS REQUEST MODULE │
    │     (GET /health)     │      │ (POST /api/auth/login)│            │  (/api/access-requests)│
    └───────────────────────┘      └───────────┬───────────┘            └───────────┬───────────┘
                                               │                                    │
                                   ┌───────────▼───────────┐            ┌───────────▼───────────┐
                                   │     AuthService       │            │ AccessRequestService  │
                                   │ (JWT / User Map)      │◀──────────▶│ (Business Logic)      │
                                   └───────────┬───────────┘            └───────────┬───────────┘
                                               │                                    │
                                     ┌─────────▼────────┐               ┌───────────▼───────────┐
                                     │    Seed Data     │               │ Risk Assessment Agent │
                                     └──────────────────┘               │ (Claude / Mock LLM)   │
                                                                        └───────────┬───────────┘
                                                                                    │
                                                                        ┌───────────▼───────────┐
                                                                        │  In-Memory Repository │
                                                                        │  (State Persistence)  │
                                                                        └───────────────────────┘
    ┌──────────────────────────────────────────────────────────────────────────────────────────┐
    │                            GLOBAL ERROR HANDLING MIDDLEWARE                              │
    └──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
src/
├── config/                        # Typed env config with fail-fast validation
├── middleware/                    # authenticate, authorize, validate, rateLimiter, requestLogger, error
├── models/                        # Shared domain models, enums, interfaces
│   ├── AccessRequest.ts           # AccessRequest, User, Role, TokenPayload
│   └── Permission.ts              # Permission enum + ROLE_PERMISSIONS matrix
├── modules/
│   ├── access-requests/           # Access request feature module
│   │   ├── controllers/           # HTTP layer: parse → service → respond
│   │   ├── repositories/          # IAccessRequestRepository + InMemoryAccessRequestRepository
│   │   ├── routes/                # Express router factory
│   │   ├── services/              # AccessRequestService (all business logic)
│   │   └── validators/            # Zod schemas for create and decide endpoints
│   ├── ai-agent/                  # AI risk assessment module (isolated from business logic)
│   │   ├── agent/                 # IRiskAssessmentAgent interface + RiskAssessmentAgent
│   │   ├── controllers/           # RiskAssessmentController
│   │   ├── providers/             # IAiProvider, MockAiProvider, ClaudeAiProvider
│   │   ├── routes/                # Risk assessment router factory
│   │   ├── types.ts               # DTOs: RiskAssessmentInput, ProviderResult, RiskAssessmentResult
│   │   └── index.ts               # Public barrel — only export surface for the module
│   └── auth/                      # Authentication & authorization module
│       ├── controllers/           # AuthController
│       ├── routes/                # Auth router factory
│       ├── services/              # AuthService (JWT) + AuthorizationService (RBAC)
│       └── validators/            # login.schema
├── seed/                          # Mock users and requests — populates store at startup
├── types/                         # Express module augmentation (req.user: TokenPayload)
├── utils/                         # AppError, Winston logger
├── container.ts                   # DI wiring — the only place `new` is called on services
├── app.ts                         # Express app factory (helmet, rate limiters, routes, error handler)
└── index.ts                       # Bootstrap: seed → listen → graceful shutdown handlers
```

---

## Design Principles

| Principle | How it's applied |
|-----------|-----------------|
| **Single Responsibility** | Controllers handle HTTP only. Services own business logic. Repositories own data access. AI agent owns LLM interaction. |
| **Open/Closed** | `IAccessRequestRepository` and `IAiProvider` interfaces — swap implementations without touching consumer code. |
| **Dependency Inversion** | Services depend on interfaces, never concrete classes. |
| **Dependency Injection** | All dependencies injected via constructors, wired once in `container.ts`. |
| **Module Isolation** | Each `modules/` subdirectory is a self-contained vertical slice. Cross-module imports go through declared interfaces only. |
| **Repository Pattern** | Decouples storage from domain logic. |
| **Provider Pattern** | `IAiProvider` decouples the agent from any specific LLM. Swap `mock` ↔ `claude` with one environment variable. |
| **Permission-Based RBAC** | `ROLE_PERMISSIONS` matrix is the single source of truth. Routes and services reference `Permission` values — never role names. |

---

## Architectural Decisions

### ADR-1 — Persistence: In-Memory Store + Repository Pattern

**Decision:** Use an in-memory `Map<string, AccessRequest>` for storage.

**Rationale:**
This is an MVP/assignment context where standing up a database would add infrastructure complexity without adding value to the design review. The deliberate trade-off is acceptable here because the **Repository Pattern** ensures this decision is fully contained.

**How it stays production-ready:**
`AccessRequestService` depends on `IAccessRequestRepository` — an interface with six methods (`save`, `findById`, `findByUserId`, `findByStatus`, `findAll`, `update`). The in-memory implementation is one concrete class that satisfies this contract. Replacing it with a PostgreSQL or MongoDB implementation requires:
1. Creating a new class that implements `IAccessRequestRepository`.
2. Changing one line in `container.ts`.

Zero changes to service, controller, or route code.

**Known limitations of this choice:**
- Data is lost on process restart.
- Not safe for multi-instance deployments (each instance has its own Map).
- No transaction support.

---

### ADR-2 — Error Handling: Global Error Middleware

**Decision:** Route all errors through a single `errorMiddleware` registered as the last Express handler.

**Rationale:**
Without centralised error handling, every route and service method is responsible for formatting its own error response. This creates two problems: (1) inconsistent API contracts that confuse API consumers, and (2) accidental leakage of stack traces and internal details to the client.

**How it works:**
- Every controller method wraps its logic in `try/catch` and calls `next(err)`.
- `errorMiddleware` classifies errors into two buckets:
  - **Operational errors** (`AppError.isOperational === true`): known, expected failures (validation, 404, 403, 409). Logged at `warn` level. The human-readable `message` is safe to return to the client.
  - **Programmer errors** (everything else): unexpected failures. Logged at `error` level with full stack trace. The client receives only `"Internal server error"` — no internals are exposed.
- All clients receive the same envelope: `{ "error": { "message": "...", "details": [...] } }`.

---

### ADR-3 — AI Agent: Provider Pattern + Module Isolation

**Decision:** Implement the AI agent as a fully isolated module (`modules/ai-agent/`) behind an `IAiProvider` interface, with `mock` and `claude` implementations selectable at runtime.

**Rationale:**
Business logic must not depend on which LLM is used. The risk assessment flow — input mapping, timing, logging, result normalization — is the same regardless of provider. Separating this into `RiskAssessmentAgent` (orchestration) and `IAiProvider` (LLM call) means:
- Tests run fully offline using `MockAiProvider` without any API credentials.
- Switching to a different LLM (GPT-4, Gemini) requires only a new `IAiProvider` implementation, with no changes to the agent, controller, or service.
- The Claude API key is never a build-time dependency — the provider is resolved at startup from `AI_PROVIDER` and `ANTHROPIC_API_KEY` env vars.

**Evaluation signal:**
`RiskAssessmentAgent` produces a structured result on every call:
- `score` — integer 0–100 (0 = no risk, 100 = maximum risk)
- `riskLevel` — enum: `LOW | MEDIUM | HIGH | CRITICAL`
- `reasoning` — human-readable explanation
- `metrics.executionTimeMs` — latency of the LLM call
- `metrics.tokensUsed` — token consumption (Claude only)

The agent logs `info` for LOW/MEDIUM results and `warn` for HIGH/CRITICAL, enabling alert rules without custom log parsing. `MockAiProvider` uses a rule-based keyword + justification-length matrix to produce deterministic scores — making it both testable and a useful demonstration of the scoring semantics.

---

### ADR-4 — Non-Functional Strengths

#### Input Validation with Zod
Every request body is parsed and validated by a Zod schema before it reaches the controller. The `createValidateMiddleware` factory replaces `req.body` with the typed, coerced output on success. On failure it produces structured field-level errors rather than generic 400 messages. Zod's TypeScript inference means the validator and the type are always in sync.

#### Security Headers with Helmet
`helmet()` is the first middleware in `app.ts`. It sets ~15 HTTP response headers including `X-Frame-Options`, `X-Content-Type-Options`, `Content-Security-Policy`, and `Strict-Transport-Security`. Applied globally so every response — including error responses and 404s — carries the full security header set.

#### Rate Limiting
Three-tier rate limiting via `express-rate-limit`:

| Limiter | Limit | Target |
|---------|-------|--------|
| `generalRateLimiter` | 200 req / 15 min | All routes |
| `authRateLimiter` | 10 req / 15 min | `POST /api/auth/login` |
| `createRequestRateLimiter` | 30 req / 15 min | `POST /api/access-requests` |

The auth limiter directly defends against credential-stuffing and password-spray attacks.

#### Structured Logging
Winston is configured with environment-aware formats:
- **Development:** human-readable, colorized, with stack traces inline.
- **Production:** newline-delimited JSON with a `service` field stamped on every entry. Suitable for direct ingestion into CloudWatch Logs, Datadog, ELK, or any structured log aggregator.

Request logs carry `method`, `path`, `statusCode`, `durationMs`, and `userId`. Log level tracks severity: `error` for 5xx, `warn` for 4xx, `info` for normal flow — enabling dashboard alerting without custom parsing rules.

---

## Data Model

```
AccessRequest {
  id                string    UUID v4
  applicationName   string    Target application
  justification     string    Business justification (10–1000 chars)
  status            enum      PENDING | APPROVED | DENIED

  // Audit trail
  createdBy         string    Requester user ID
  createdByEmail    string    Requester email (denormalized for display)
  createdAt         Date

  decisionBy?       string    Approver user ID
  decisionByEmail?  string
  decisionAt?       Date
  decisionNote?     string    Optional comment from approver
}
```

---

## Auth & Permission Model

JWT-based authentication. On login a signed token is returned containing `sub` (user ID), `email`, `name`, and `role`.
All `/api/access-requests` endpoints require `Authorization: Bearer <token>`.

Authorization uses **permission-based RBAC**. Routes and services reference granular `Permission` values — never role names directly. The mapping lives in one place (`src/models/Permission.ts`), so adding a new role is a single-file change.

| Permission | EMPLOYEE | APPROVER |
|---|:---:|:---:|
| `access_request:create` | ✓ | ✓ |
| `access_request:view:own` | ✓ | ✓ |
| `access_request:view:all` | | ✓ |
| `access_request:view:by_status` | | ✓ |
| `access_request:decide` | | ✓ |

---

## Mock Users (Seed Data)

All users share the password: **`Password123!`**

| Name           | Email               | Role     |
|----------------|---------------------|----------|
| Alice Employee | alice@company.com   | EMPLOYEE |
| Bob Employee   | bob@company.com     | EMPLOYEE |
| Carol Approver | carol@company.com   | APPROVER |
| Dave Approver  | dave@company.com    | APPROVER |

Three seeded requests are pre-loaded at startup (one PENDING, one APPROVED, one DENIED).

---

## Getting Started

### Prerequisites
- Node.js 20+, npm 10+

### Local Development

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Required: JWT_SECRET — set to a strong random string
# Optional AI config (defaults to mock provider):
#   AI_PROVIDER=claude          # or 'mock' (default)
#   ANTHROPIC_API_KEY=sk-...    # required if AI_PROVIDER=claude
#   ANTHROPIC_MODEL=claude-haiku-4-5-20251001

# 3. Start dev server (hot reload via tsx)
npm run dev
# → http://localhost:3000
```

### Production Build

```bash
npm run build
npm start
```

### Docker

```bash
# Build and run with docker-compose
docker-compose up --build

# Or manually
docker build -t monday-access-service .
docker run -p 3000:3000 \
  -e JWT_SECRET=your-secret \
  -e AI_PROVIDER=mock \
  monday-access-service
```

### Tests

```bash
npm test               # run all unit tests (153 tests, 10 suites)
npm run test:coverage  # with coverage report
```

---

## API Overview

### Health
- `GET /health`

### Auth
- `POST /api/auth/login`

### Access Requests
- `POST   /api/access-requests`
- `PATCH  /api/access-requests/:id/decision`
- `GET    /api/access-requests`
- `GET    /api/access-requests/status/:status`
- `GET    /api/access-requests/user/:userId`

## Error Response Format

All errors follow a consistent envelope so clients have one code path for error handling:

```json
{
  "error": {
    "message": "Human-readable description",
    "details": [{ "field": "justification", "message": "Must be at least 10 characters" }]
  }
}
```

| Status | Meaning |
|--------|---------|
| 400 | Validation error (invalid body or path params) |
| 401 | Missing, malformed, or expired JWT |
| 403 | Insufficient permission for the action |
| 404 | Resource not found |
| 409 | State conflict (e.g. deciding on a non-PENDING request) |
| 429 | Rate limit exceeded |
| 500 | Internal server error (details never exposed to client) |
| 502 | AI provider returned unparseable response |
| 503 | AI provider unavailable |

---

## Deploying to AWS

The service ships as a multi-stage Docker image and is designed to run on **AWS ECS Fargate** (serverless containers — no EC2 fleet to manage). The `Dockerfile` produces a minimal Alpine-based production image running as a non-root user.

### Recommended Stack

| Component | AWS Service |
|-----------|-------------|
| Container image | Amazon ECR |
| Container runtime | ECS Fargate |
| Load balancer | Application Load Balancer (ALB) |
| Secrets | AWS Secrets Manager |
| Logs | CloudWatch Logs |
| Health check | ALB → `GET /health` |

### Step-by-step Deployment

```bash
# 1. Authenticate Docker to ECR
aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin \
    <account-id>.dkr.ecr.us-east-1.amazonaws.com

# 2. Build and push the image
docker build -t monday-access-service .
docker tag monday-access-service:latest \
  <account-id>.dkr.ecr.us-east-1.amazonaws.com/monday-access-service:latest
docker push \
  <account-id>.dkr.ecr.us-east-1.amazonaws.com/monday-access-service:latest

# 3. Create an ECS Fargate service via AWS Console or CDK/Terraform
#    Task definition environment variables:
#      NODE_ENV           = production
#      PORT               = 3000
#      JWT_SECRET         → reference from Secrets Manager
#      AI_PROVIDER        = claude (or mock)
#      ANTHROPIC_API_KEY  → reference from Secrets Manager (if AI_PROVIDER=claude)
```

### Secrets Management

Sensitive values (`JWT_SECRET`, `ANTHROPIC_API_KEY`) should be stored in **AWS Secrets Manager** and injected at container startup via ECS task definition `secrets` references — never baked into the image or passed as plain-text environment variables.

---

## Monitoring & Observability

### Logs
- Structured, newline-delimited JSON via Winston.
- Each log includes: `level`, `message`, `service`, `requestId`, `userId`, `method`, `path`, `statusCode`, `durationMs`, `riskLevel`, `score`, `provider`, `executionTimeMs`.
- Can be forwarded to CloudWatch, Datadog, or similar systems.

### Key Metrics
- HTTP 5xx error rate – alert if >1% over 5 min
- p99 request latency – alert if >2 s
- AI provider errors (502/503) – alert on any occurrence
- AI HIGH/CRITICAL assessments – investigate spikes
- AI execution time (p99) – alert if >5 s

### Tracing
- Optional end-to-end tracing with AWS X-Ray or OpenTelemetry.
- Trace ID propagated from `authenticate` middleware through service and AI agent calls.

### Health Check
- `GET /health` returns `{ "status": "ok", "timestamp": "..." }`.
- Can be used for load balancer, Kubernetes, or uptime monitoring.
---

## Key Assumptions

1. **In-memory storage** — Data does not persist across restarts. The `IAccessRequestRepository` interface makes a database swap a contained, one-file change (see ADR-1).
2. **Mock users** — Users are seeded from `src/seed/index.ts`. In production this would be replaced by an identity provider (SSO/LDAP/OAuth2).
3. **Single instance** — No distributed state. A multi-instance deployment would need a shared store (Redis, PostgreSQL) and a distributed rate-limit backend.
4. **Stateless JWT** — Tokens are not revocable before expiry. A production system would use short-lived access tokens with refresh tokens, or a token denylist in Redis.
5. **Rate-limit store** — `express-rate-limit` defaults to an in-process `MemoryStore`. In a multi-instance deployment this must be replaced with a Redis store (`rate-limit-redis`) so limits are enforced cluster-wide.
6. **AI provider fallback** — If `AI_PROVIDER=claude` but `ANTHROPIC_API_KEY` is not set, the service logs a warning and falls back to `MockAiProvider` automatically. It will not fail to start.
