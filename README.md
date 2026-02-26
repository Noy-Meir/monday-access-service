# Access Manager

An internal application access request system with multi-step approval workflow and AI-powered risk assessment.

**Backend:** Node.js + Express + Apollo Server (GraphQL) · TypeScript
**Frontend:** Next.js 14 App Router + Apollo Client + Tailwind CSS

---

## How it Works

1. **Employees** submit access requests for internal tools (e.g. GitHub, Salesforce, Database Access).
2. **Approvers** review and approve or deny. Requests with multiple required approvers go through a multi-step flow before reaching `APPROVED`.
3. **AI risk assessment** can be triggered on any request - the agent scores it 0–100, classifies the risk level, and persists the result on the request.

---

## Quick Start

### Prerequisites
- Node.js 20+ / npm 10+
- Two terminals (backend + client run separately)

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env        # set JWT_SECRET to any strong string
npm run dev                 # http://localhost:3000/graphql
```

By default the AI provider runs in **mock mode** — no API key needed. To use the real Claude AI:
```bash
AI_PROVIDER=claude ANTHROPIC_API_KEY=sk-ant-... npm run dev
```

### 2. Client

```bash
cd client
npm install
npm run dev                 # http://localhost:3001
```

Open `http://localhost:3001` and log in with any seeded user (password: `Password123!`):

### Docker (backend only)

```bash
cd backend
docker-compose up --build
```

---

## Architecture Overview

```text
 ┌──────────────────────────────────────────────────────┐
 │              Next.js Client (port 3001)               │
 │   Dashboard (employee) · Admin table (approver)       │
 │   Apollo Client → POST /graphql (via Next.js rewrite) │
 └─────────────────────────┬────────────────────────────┘
                           │ HTTP + Bearer JWT
 ┌─────────────────────────▼────────────────────────────┐
 │         Express + Apollo Server (port 3000)           │
 │  Helmet · Rate Limiters · Request Logger              │
 │  ┌─────────────────────────────────────────────────┐  │
 │  │  Resolver Layer  (auth guards + RBAC + Zod)     │  │
 │  └──────────────────────┬──────────────────────────┘  │
 │                         │                             │
 │        ┌────────────────┴──────────────────┐          │
 │        │        AccessRequestService        │          │
 │        │  create · decide · getAll          │          │
 │        │  getAiRiskAssessment ─────────────►│          │
 │        └───────────────┬───────────────────┘          │
 │                        │                              │
 │        ┌───────────────┴──────────────────┐           │
 │        │  IAccessRequestRepository         │           │
 │        │  (In-Memory · swap → Postgres)    │           │
 │        └──────────────────────────────────┘           │
 │                                                       │
 │        ┌──────────────────────────────────┐           │
 │        │  RiskAssessmentAgent              │           │
 │        │   MockAiProvider  (default)       │           │
 │        │   ClaudeAiProvider (opt-in)       │           │
 │        └──────────────────────────────────┘           │
 └──────────────────────────────────────────────────────┘
```

---

## Detailed Documentation

- [Backend README](./backend/README.md) — Architecture diagram, ADRs, GraphQL API reference, deployment guide
- [Client README](./client/README.md) — Project structure, architectural tradeoffs, environment config
