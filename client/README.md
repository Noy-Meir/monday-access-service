# Access Manager — Client

React frontend for the Access Manager service, built with **Next.js 14 App Router**, **Apollo Client**, and **Tailwind CSS**.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Data fetching | Apollo Client v3 (GraphQL) |
| Styling | Tailwind CSS v3 |
| Language | TypeScript (strict) |

---

## How to Run

### Prerequisites
- Node.js 18+
- Backend running on `http://localhost:3000`

### Development
```bash
npm install
npm run dev       # http://localhost:3001 (or next available port)
```

### Production
```bash
npm run build
npm start
```

### Environment
Copy `.env.local.example` to `.env.local`. In development the value can stay empty — Next.js rewrites `/graphql` to `http://localhost:3000/graphql` automatically via `next.config.mjs`.

```bash
# .env.local
NEXT_PUBLIC_API_URL=        # empty = use local backend
```

For production, set to the deployed backend base URL (e.g. `https://api.yourapp.com`).

---

## Project Structure

```
src/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Root layout — loads fonts, mounts Providers
│   ├── page.tsx                # / → redirect to /dashboard
│   ├── providers.tsx           # Client provider tree (Apollo + Auth + Toast)
│   ├── login/page.tsx          # Public route
│   └── (protected)/            # Route group — auth-guarded
│       ├── layout.tsx          # Redirects unauthenticated users to /login
│       ├── dashboard/page.tsx
│       └── admin/page.tsx      # Extra role guard: employees → /dashboard
│
├── components/
│   ├── AuthLogoutListener.tsx  # Listens for auth:logout → router.replace('/login')
│   ├── layout/                 # Navbar, AppLayout
│   ├── requests/               # RequestCard, RequestForm, RequestList, StatusBadge
│   ├── admin/                  # RequestsTable, DecisionModal, RiskBadge
│   └── ui/                     # Button, Input, Modal, Toast, Spinner, Skeleton
│
├── context/                    # AuthContext, ToastContext
├── hooks/                      # useAuth, useToast
├── graphql/
│   ├── apolloClient.ts
│   ├── queries.ts              # myRequests, allRequests, requestsByStatus
│   └── mutations.ts            # login, createRequest, decideRequest, assessRequestRisk
├── services/
│   ├── requests.service.ts     # Wraps Apollo calls; getRiskAssessment → mutation
│   └── auth.service.ts
├── types/                      # Shared TypeScript interfaces and enums
└── utils/                      # errorMessages, date helpers
```

---

## Key Types

```typescript
interface AccessRequest {
  id: string;
  applicationName: string;
  justification: string;
  status: RequestStatus;           // PENDING | PARTIALLY_APPROVED | APPROVED | DENIED
  requiredApprovals: Role[];
  approvals: Approval[];
  createdBy: string;
  createdByEmail: string;
  createdAt: string;               // ISO string
  decisionBy?: string;
  decisionByEmail?: string;
  decisionAt?: string;
  decisionNote?: string;
  aiAssessment?: RiskAssessmentResult;  // populated after assessRequestRisk mutation
}
```

---

## Architectural Decisions & Tradeoffs

### 1. All data fetching is client-side (Apollo Client only)
Apollo Client v3 does not support React Server Components. All GraphQL calls happen in Client Components after hydration — initial page loads render skeletons, then fetch in the browser.

**Tradeoff:** Simpler architecture with full reuse of existing Apollo logic. The cost is a slower perceived load vs. RSC streaming. Acceptable for an internal tool.

### 2. Authentication is localStorage-based, not cookie-based
The JWT is stored in `localStorage` and attached via Apollo's `authLink`. Next.js middleware cannot read it, so route protection is done client-side inside `(protected)/layout.tsx` using `useAuth()`.

**Tradeoff:** Works identically to a plain React app. A brief loading spinner appears on protected routes while auth state hydrates. Cookie-based auth would allow true server-side redirects but requires backend changes.

### 3. `'use client'` boundary is broad
All interactive components (context, hooks, forms, tables, modals) are Client Components. Only pure presentational leaves (`StatusBadge`, `Spinner`, `Skeleton`) are Server Components by default.

**Tradeoff:** Safe and predictable. Narrowing the boundary would allow more RSC rendering but requires significant restructuring of how context is consumed.

### 4. Route groups for auth without a URL segment
The `(protected)` route group applies a shared auth-guard layout to `/dashboard` and `/admin` without adding `"protected"` to the URL. Role-checking (employee → redirect) is done inside `admin/page.tsx`.

### 5. GraphQL proxy via Next.js rewrites (no CORS config needed)
`next.config.mjs` rewrites `/graphql` to the backend. The browser always talks to the same origin — no CORS headers needed in development.

### 6. Risk assessment is a Mutation, not a Query
`getRiskAssessment(id)` in `requests.service.ts` calls `assessRequestRisk` as a **GraphQL Mutation** because the operation persists the AI result on the request (side effect). The `RequestsTable` component calls the same `requestsService.getRiskAssessment(id)` method — the mutation detail is encapsulated in the service layer.

---

## Assumptions

- The backend GraphQL API is available at `http://localhost:3000/graphql` in development.
- The backend handles all authorization. The client enforces role-based UI visibility (showing/hiding buttons and routes) as UX convenience only — not a security boundary.
- `PARTIALLY_APPROVED` is a valid `RequestStatus`. The client renders it as an indigo "Partially Approved" badge with per-role approval progress indicators.
- All six demo users (alice, bob, carol, dave, eve, frank) are seeded in the backend with password `Password123!`.
