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
npm run dev       # http://localhost:3000 (or 3001 if port is taken)
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

For production set it to the deployed backend base URL (e.g. `https://api.yourapp.com`).

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
├── graphql/                    # apolloClient, queries, mutations
├── pages/                      # Page-level components (LoginPage, DashboardPage, AdminPage)
├── services/                   # requestsService, authService (wrap Apollo calls)
├── types/                      # Shared TypeScript interfaces and enums
└── utils/                      # errorMessages, date helpers
```

---

## Architectural Decisions & Tradeoffs

### 1. All data fetching is client-side (Apollo Client only)
Apollo Client v3 does not support React Server Components. All GraphQL calls happen in Client Components after hydration. This means **no server-side data fetching** — initial page loads render skeletons, then fetch data in the browser.

**Tradeoff:** Simpler architecture and full reuse of existing Apollo logic. The cost is a slower perceived load compared to RSC streaming. Acceptable for an internal tool.

### 2. Authentication is localStorage-based, not cookie-based
The JWT is stored in `localStorage` and attached to requests via Apollo's `authLink`. This means Next.js middleware cannot read the token, so **route protection is done client-side** inside `(protected)/layout.tsx` using `useAuth()`.

**Tradeoff:** Simpler to implement and works identically to the original React app. The downside is a brief flash of the loading spinner on protected routes before the auth state hydrates. Cookie-based auth would allow true server-side redirects but would require backend changes.

### 3. `'use client'` boundary is broad
All interactive components (context, hooks, forms, tables, modals) are Client Components. Only pure presentational leaves (`StatusBadge`, `Spinner`, `Skeleton`, `EmptyState`) are Server Components by default.

**Tradeoff:** Safe and predictable. A narrower boundary (e.g. wrapping only individual interactive islands) would allow more RSC rendering but would require significant restructuring of how context is consumed.

### 4. Route groups for auth without a URL segment
The `(protected)` route group applies a shared auth-guard layout to `/dashboard` and `/admin` without adding `"protected"` to the URL. Role-checking (employee → redirect) is done inside `admin/page.tsx`, not in the shared layout, so the layout stays generic.

### 5. GraphQL proxy via Next.js rewrites (no CORS config needed)
`next.config.mjs` rewrites `/graphql` to the backend. The browser always talks to the same origin, so no CORS headers are needed on the backend in development.

---

## Assumptions

- The backend GraphQL API is available at `http://localhost:3000/graphql` in development.
- The backend handles all authorization. The client enforces role-based UI visibility (showing/hiding buttons and routes) but treats these as UX conveniences, not security boundaries.
- `PARTIALLY_APPROVED` is a valid `RequestStatus` from the backend. The client renders it as an indigo "Partially Approved" badge with per-role approval progress indicators.
- All six demo users (alice, bob, carol, dave, eve, frank) are seeded in the backend with password `Password123!`.
