# monday-access-service — Backend

A production-grade **GraphQL API** for managing internal application access requests with a multi-step approval workflow and AI-powered risk assessment.

Employees submit requests; role-based approvers act on them through a configurable multi-step flow. An AI agent assesses each request's risk level and persists the result on the request. All activity is captured in a full audit trail.

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────────────┐
│                  HTTP CLIENT  (Next.js / curl / .http)               │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │  POST /graphql  (Bearer JWT)
┌──────────────────────────────────▼──────────────────────────────────┐
│            Express  —  Helmet · Rate Limiters · Request Logger       │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
┌──────────────────────────────────▼──────────────────────────────────┐
│                          Apollo Server                               │
│     GraphQL schema (typeDefs.ts) + resolver pipeline                 │
│     requireActor → requirePermission → withValidation → resolver     │
└──────────┬───────────────────────────────────────┬──────────────────┘
           │                                       │
    ┌──────▼──────────────┐          ┌─────────────▼──────────────────┐
    │     AuthService     │          │      AccessRequestService       │
    │  JWT sign/verify    │          │  create · decide · getAll …     │
    │  AuthorizationService│         │  getAiRiskAssessment ──────────►│
    │  (permission RBAC)  │          └──────────────┬─────────────────┘
    └─────────────────────┘                         │
                                    ┌───────────────┴─────────────────┐
                                    │  IAccessRequestRepository        │
                                    │  InMemoryAccessRequestRepository │
                                    └─────────────────────────────────┘
                                    ┌─────────────────────────────────┐
                                    │  IRiskAssessmentAgent            │
                                    │   └── RiskAssessmentAgent        │
                                    │        └── IAiProvider           │
                                    │             ├── MockAiProvider   │
                                    │             └── ClaudeAiProvider │
                                    └─────────────────────────────────┘
```

---

## Project Structure

```
src/
├── config/                    # Typed env config (JWT, port, AI provider)
│   └── applications.ts        # Per-app required-approval routing
├── graphql/
│   ├── typeDefs.ts            # Schema — types, queries, mutations
│   ├── resolvers.ts           # Auth guards, validation, service calls
│   └── context.ts             # GraphQLContext interface
├── models/
│   ├── AccessRequest.ts       # AccessRequest, Role, RequestStatus, TokenPayload
│   └── Permission.ts          # Permission enum + ROLE_PERMISSIONS matrix
├── modules/
│   └── ai-agent/              # Fully isolated AI module
│       ├── agent/             # IRiskAssessmentAgent + RiskAssessmentAgent
│       ├── providers/         # IAiProvider, MockAiProvider, ClaudeAiProvider
│       ├── types.ts           # RiskAssessmentResult, RiskLevel, metrics DTOs
│       └── index.ts           # Public barrel
├── repositories/
│   ├── IAccessRequestRepository.ts
│   └── InMemoryAccessRequestRepository.ts
├── services/
│   ├── AccessRequestService.ts   # All business logic + AI integration
│   ├── AuthService.ts
│   └── AuthorizationService.ts
├── middleware/                # rateLimiter, requestLogger, error
├── validators/                # Zod schemas (create, decide, login)
├── seed/                      # Seed data loaded at startup
├── utils/                     # AppError, Winston logger
├── container.ts               # DI wiring — the only place `new` is called
├── app.ts                     # Express app factory
└── index.ts                   # Bootstrap: seed → Apollo → listen → shutdown
```

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
# Required:
#   JWT_SECRET=<strong-random-string>
# Optional AI config (default: mock provider):
#   AI_PROVIDER=claude              # or 'mock' (default)
#   ANTHROPIC_API_KEY=sk-ant-...   # required only if AI_PROVIDER=claude
#   ANTHROPIC_MODEL=claude-haiku-4-5-20251001

# 3. Start dev server (hot reload via tsx)
npm run dev
# → GraphQL endpoint: http://localhost:3000/graphql
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
npm test               # all unit tests (8 suites)
npm run test:coverage  # with coverage report
```

---

## GraphQL API

All operations are sent as `POST /graphql` with `Content-Type: application/json` and — for protected operations — `Authorization: Bearer <token>`.

---

## Auth & Permission Model

JWT-based authentication. Tokens carry `sub`, `email`, `name`, and `role`.

Permission-based RBAC: resolvers reference granular `Permission` values — never role names directly. The mapping lives in `src/models/Permission.ts`.

---


## Design Principles

| Principle | How it's applied |
|-----------|-----------------|
| **Single Responsibility** | Resolvers: auth + routing only. Services: business logic. Repositories: data access. AI module: LLM interaction. |
| **Dependency Inversion** | Services depend on interfaces (`IAccessRequestRepository`, `IRiskAssessmentAgent`), never concrete classes. |
| **Dependency Injection** | All dependencies injected via constructors, wired once in `container.ts`. |
| **Repository Pattern** | Decouples storage from business logic. Swap to PostgreSQL by implementing `IAccessRequestRepository` + one line in `container.ts`. |
| **Provider Pattern** | `IAiProvider` decouples the agent from any specific LLM. Switch `mock` ↔ `claude` with one env var at runtime. |

---
## Architectural Decisions

### ADR-1: Persistence & Repository Pattern
* **Decision:** In-memory storage using the **Repository Pattern**.
* **Rationale:** Minimizes infrastructure overhead for the MVP while ensuring the system is database-agnostic. Switching to PostgreSQL/MongoDB requires only a new repository implementation with zero changes to business logic.

### ADR-2: Centralized Error Mapping
* **Decision:** Domain errors (`AppError`) are translated to `GraphQLError` at the resolver boundary.
* **Benefit:** Decouples internal logic from the transport layer (GraphQL). Apollo's `formatError` is configured to mask stack traces in production for security.

### ADR-3: Advisory AI Integration
* **Decision:** AI risk assessment is a **Service-layer Mutation**.
* **Rationale:** By moving AI logic from the Resolver to the Service, results are persisted to the repository, ensuring an audit trail.
* **Guardrail:** The AI output is **purely advisory**; it provides decision support (score/reasoning) but never modifies the request status automatically.

### ADR-4: Production Readiness (Non-Functional)
* **Validation:** Declarative input validation using **Zod** schemas.
* **Security:** Multi-tier rate limiting and **Helmet.js** security headers integrated by default.
* **Observability:** Structured JSON logging (Winston) optimized for cloud providers like CloudWatch/Datadog.

---

## CI/CD & Quality Control

### GitHub Actions Workflow
The project includes a pre-merge CI pipeline that:
1.  Installs dependencies in a clean environment.
2.  Runs the full unit test suite.
    **Note:** The repository is configured to block merges if the workflow fails, ensuring that the `main` branch remains stable and bug-free.

---

##  Key Assumptions
1.  **Statelessness:** Data resides in memory; a database swap is a single-class change.
2.  **Identity:** Users are seeded locally; production would integrate with an OIDC/SAML provider.
3.  **Scalability:** Designed for single-instance deployment. Multi-instance would require a distributed cache (Redis) for rate limiting.
4.  **AI Fallback:** If the AI provider is unavailable or misconfigured, the system gracefully falls back to a Mock provider to ensure service continuity.
---

## Deployment Strategy (AWS)

To transition this system from a local development PoC to a production-grade infrastructure, the following deployment strategy is proposed. This plan focuses on **automation, security, and scalability**.

---

###  1. Containerization (Docker)
The backend service is containerized using a **multi-stage Docker build**:
* **Consistency:** Ensures the Node.js environment and dependencies are identical across development and production.
* **Optimization:** Uses a lightweight `node:18-alpine` base image to reduce the attack surface and speed up deployment.

### 2. CI/CD Pipeline (GitHub Actions)
A fully automated pipeline is triggered on every push to the `main` branch:
* **Validation:** Runs `npm test` and linting. If tests fail, the build is aborted.
* **Artifact Storage:** Builds and pushes the Docker image to **Amazon Elastic Container Registry (ECR)**.
* **Automated Deployment:** Signals **AWS App Runner** to perform a zero-downtime rolling update.

### 3. Persistence Layer (Amazon RDS)
In production, the `InMemoryAccessRequestRepository` is swapped for a managed **Amazon RDS (PostgreSQL)** instance.

### 4. Security & Configuration Management
* **Secret Management:** Sensitive credentials (like `ANTHROPIC_API_KEY`) are retrieved at runtime from **AWS Secrets Manager**.
* **Networking:** The backend is hosted behind an **Application Load Balancer (ALB)** to handle SSL termination and enforce strict **CORS policies**.
