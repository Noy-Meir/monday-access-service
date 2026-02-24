# Monday Access Service — GraphQL API Reference

**Version:** 1.0
**Base URL:** `http://localhost:3000`
**GraphQL Endpoint:** `POST /graphql`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Transport & Headers](#2-transport--headers)
3. [Authentication](#3-authentication)
4. [Rate Limits](#4-rate-limits)
5. [Operations](#5-operations)
   - [Mutation: login](#mutation-login)
   - [Mutation: createRequest](#mutation-createrequest)
   - [Mutation: decideRequest](#mutation-deciderequest)
   - [Query: myRequests](#query-myrequests)
   - [Query: allRequests](#query-allrequests)
   - [Query: requestsByStatus](#query-requestsbystatus)
   - [Query: riskAssessment](#query-riskassessment)
6. [Type Reference](#6-type-reference)

---

## 1. Overview

The Monday Access Service is an internal access-request management system. Employees submit requests for access to company applications; designated approvers (IT, HR, Manager, or Admin) review and approve or deny them. Sensitive applications require sign-off from multiple roles before a request is fully approved.

All API communication is done over a **single GraphQL endpoint**.

---

## 2. Transport & Headers

All requests are `POST` to `/graphql` with a JSON body.

| Header | Required | Value |
|---|---|---|
| `Content-Type` | Always | `application/json` |
| `Authorization` | On protected operations | `Bearer <jwt>` |

**Request body shape:**

```json
{
  "query": "<GraphQL document>",
  "variables": { "<key>": "<value>" }
}
```

**Example using curl:**

```bash
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your_jwt>" \
  -d '{"query":"{ allRequests { id applicationName status } }"}'
```

> **Note:** GraphQL always returns HTTP `200` unless the server itself crashes. Business errors (unauthenticated, forbidden, not found, etc.) are returned inside the `errors` array of the response body, not as HTTP 4xx codes.

---

## 3. Authentication

### Obtaining a Token

Call the `login` mutation with valid credentials. The response contains a signed JWT.

```json
{
  "query": "mutation Login($email: String!, $password: String!) { login(email: $email, password: $password) { token user { id email name role } } }",
  "variables": { "email": "alice@company.com", "password": "Password123!" }
}
```

### Using the Token

Pass the token in the `Authorization` header on every subsequent request:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Lifetime

Tokens expire after **8 hours**. After expiry, re-authenticate with `login`.

### Token Payload

The JWT encodes the following claims. You do not need to decode this yourself — it is documented for reference:

| Claim | Type | Description |
|---|---|---|
| `sub` | `string` | User ID |
| `email` | `string` | User email address |
| `name` | `string` | Display name |
| `role` | `Role` | One of `EMPLOYEE`, `MANAGER`, `IT`, `HR`, `ADMIN` |
| `iat` | `number` | Issued-at timestamp (Unix) |
| `exp` | `number` | Expiry timestamp (Unix) |

---

## 4. Rate Limits

Rate limits apply per IP address. Exceeding a limit returns a `TOO_MANY_REQUESTS` error.

| Scope | Applies To | Limit | Window |
|---|---|---|---|
| Global | All requests to `/graphql` | 200 requests | 15 minutes |
| `login` mutation | Auth attempts per IP | 5 requests | 5 minutes |
| `createRequest` mutation | Submission rate per IP | 10 requests | 5 minutes |

## 5. Operations

---

### Mutation: `login`

Authenticates a user and returns a signed JWT along with the user's profile.

**Authorization:** Public — no token required.

**Rate limit:** 5 attempts per IP per 5 minutes.

#### Arguments

| Argument | Type | Required | Validation |
|---|---|---|---|
| `email` | `String` | Yes | Must be a valid email address |
| `password` | `String` | Yes | Must be non-empty |

#### GraphQL Document

```graphql
mutation Login($email: String!, $password: String!) {
  login(email: $email, password: $password) {
    token
    user {
      id
      email
      name
      role
    }
  }
}
```

#### Example Request

```json
{
  "query": "mutation Login($email: String!, $password: String!) { login(email: $email, password: $password) { token user { id email name role } } }",
  "variables": {
    "email": "carol@company.com",
    "password": "Password123!"
  }
}
```

#### Example Response

```json
{
  "data": {
    "login": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWNhcm9sLTAwMyIsImVtYWlsIjoiY2Fyb2xAY29tcGFueS5jb20iLCJuYW1lIjoiQ2Fyb2wgSVQiLCJyb2xlIjoiSVQiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MTcwMDAyODgwMH0.SIGNATURE",
      "user": {
        "id": "user-carol-003",
        "email": "carol@company.com",
        "name": "Carol IT",
        "role": "IT"
      }
    }
  }
}
```


###  Mutation: `createRequest`

Submits a new access request on behalf of the authenticated user. The system automatically determines `requiredApprovals` based on the application name.

**Authorization:** Any authenticated user (all roles).

**Rate limit:** 10 requests per IP per 5 minutes.

#### Arguments

| Argument | Type | Required | Validation |
|---|---|---|---|
| `applicationName` | `String` | Yes | 2–100 characters, leading/trailing whitespace is stripped |
| `justification` | `String` | Yes | 10–1000 characters, leading/trailing whitespace is stripped |

#### GraphQL Document

```graphql
mutation CreateRequest($applicationName: String!, $justification: String!) {
  createRequest(applicationName: $applicationName, justification: $justification) {
    id
    applicationName
    justification
    status
    requiredApprovals
    approvals {
      role
      approvedBy
      approvedByEmail
      approvedAt
    }
    createdBy
    createdByEmail
    createdAt
  }
}
```

#### Example Request

```json
{
  "query": "mutation CreateRequest($applicationName: String!, $justification: String!) { createRequest(applicationName: $applicationName, justification: $justification) { id applicationName justification status requiredApprovals approvals { role approvedBy approvedByEmail approvedAt } createdBy createdByEmail createdAt } }",
  "variables": {
    "applicationName": "GitHub",
    "justification": "Need access to manage code repositories for the Q3 development sprint."
  }
}
```

#### Example Response

```json
{
  "data": {
    "createRequest": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "applicationName": "GitHub",
      "justification": "Need access to manage code repositories for the Q3 development sprint.",
      "status": "PENDING",
      "requiredApprovals": ["IT"],
      "approvals": [],
      "createdBy": "user-alice-001",
      "createdByEmail": "alice@company.com",
      "createdAt": "2024-07-15T09:30:00.000Z"
    }
  }
}
```

### Mutation: `decideRequest`

Approves or denies an access request. The actor's role must appear in the request's `requiredApprovals`, or the actor must be `ADMIN`.

**Authorization:** `MANAGER`, `IT`, `HR`, `ADMIN` only.

#### Arguments

| Argument | Type | Required | Validation |
|---|---|---|---|
| `id` | `ID` | Yes | Must be a valid request ID |
| `decision` | `RequestStatus` | Yes | Must be `APPROVED` or `DENIED` (not `PENDING` or `PARTIALLY_APPROVED`) |
| `decisionNote` | `String` | No | Maximum 500 characters, leading/trailing whitespace is stripped |

#### GraphQL Document

```graphql
mutation DecideRequest($id: ID!, $decision: RequestStatus!, $decisionNote: String) {
  decideRequest(id: $id, decision: $decision, decisionNote: $decisionNote) {
    id
    status
    requiredApprovals
    approvals {
      role
      approvedBy
      approvedByEmail
      approvedAt
    }
    decisionBy
    decisionByEmail
    decisionAt
    decisionNote
  }
}
```

#### Example Request — Single-approval (IT approves GitHub)

```json
{
  "query": "mutation DecideRequest($id: ID!, $decision: RequestStatus!, $decisionNote: String) { decideRequest(id: $id, decision: $decision, decisionNote: $decisionNote) { id status requiredApprovals approvals { role approvedBy approvedByEmail approvedAt } decisionBy decisionByEmail decisionAt decisionNote } }",
  "variables": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "decision": "APPROVED",
    "decisionNote": "Access confirmed. Please review repository permissions after onboarding."
  }
}
```

#### Example Response — Request fully approved

```json
{
  "data": {
    "decideRequest": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "status": "APPROVED",
      "requiredApprovals": ["IT"],
      "approvals": [
        {
          "role": "IT",
          "approvedBy": "user-carol-003",
          "approvedByEmail": "carol@company.com",
          "approvedAt": "2024-07-15T11:00:00.000Z"
        }
      ],
      "decisionBy": "user-carol-003",
      "decisionByEmail": "carol@company.com",
      "decisionAt": "2024-07-15T11:00:00.000Z",
      "decisionNote": "Access confirmed. Please review repository permissions after onboarding."
    }
  }
}
```

#### Example Response — First approval on a multi-approval request (PARTIALLY_APPROVED)

When `requiredApprovals` is `["MANAGER", "IT"]` and the Manager approves first:

```json
{
  "data": {
    "decideRequest": {
      "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "status": "PARTIALLY_APPROVED",
      "requiredApprovals": ["MANAGER", "IT"],
      "approvals": [
        {
          "role": "MANAGER",
          "approvedBy": "user-eve-005",
          "approvedByEmail": "eve@company.com",
          "approvedAt": "2024-07-15T10:15:00.000Z"
        }
      ],
      "decisionBy": null,
      "decisionByEmail": null,
      "decisionAt": null,
      "decisionNote": null
    }
  }
}
```
---

### Query: `myRequests`

Returns all access requests submitted by a given user. Employees may only query their own user ID. Approver roles (`MANAGER`, `IT`, `HR`, `ADMIN`) may query any user.

**Authorization:** Any authenticated user.

#### Arguments

| Argument | Type | Required | Description |
|---|---|---|---|
| `userId` | `ID` | Yes | The ID of the user whose requests to retrieve |

#### GraphQL Document

```graphql
query MyRequests($userId: ID!) {
  myRequests(userId: $userId) {
    id
    applicationName
    justification
    status
    requiredApprovals
    approvals {
      role
      approvedBy
      approvedByEmail
      approvedAt
    }
    createdBy
    createdByEmail
    createdAt
    decisionBy
    decisionByEmail
    decisionAt
    decisionNote
  }
}
```

#### Example Request

```json
{
  "query": "query MyRequests($userId: ID!) { myRequests(userId: $userId) { id applicationName justification status requiredApprovals approvals { role approvedBy approvedByEmail approvedAt } createdAt } }",
  "variables": {
    "userId": "user-alice-001"
  }
}
```

#### Example Response

```json
{
  "data": {
    "myRequests": [
      {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "applicationName": "GitHub",
        "justification": "Need access to manage code repositories for the Q3 development sprint.",
        "status": "PENDING",
        "requiredApprovals": ["IT"],
        "approvals": [],
        "createdAt": "2024-07-12T09:30:00.000Z"
      },
      {
        "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        "applicationName": "Database Access",
        "justification": "Need read-only access to investigate a customer-reported data discrepancy.",
        "status": "PARTIALLY_APPROVED",
        "requiredApprovals": ["MANAGER", "IT"],
        "approvals": [
          {
            "role": "MANAGER",
            "approvedBy": "user-eve-005",
            "approvedByEmail": "eve@company.com",
            "approvedAt": "2024-07-14T10:00:00.000Z"
          }
        ],
        "createdAt": "2024-07-11T08:00:00.000Z"
      }
    ]
  }
}
```
---

### Query: `allRequests`

Returns every access request in the system, across all users and statuses.

**Authorization:** `MANAGER`, `IT`, `HR`, `ADMIN` only.

#### Arguments

None.

#### GraphQL Document

```graphql
query AllRequests {
  allRequests {
    id
    applicationName
    justification
    status
    requiredApprovals
    approvals {
      role
      approvedBy
      approvedByEmail
      approvedAt
    }
    createdBy
    createdByEmail
    createdAt
    decisionBy
    decisionByEmail
    decisionAt
    decisionNote
  }
}
```

#### Example Request

```json
{
  "query": "query AllRequests { allRequests { id applicationName status requiredApprovals approvals { role approvedByEmail approvedAt } createdByEmail createdAt } }"
}
```

#### Example Response

```json
{
  "data": {
    "allRequests": [
      {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "applicationName": "GitHub",
        "status": "PENDING",
        "requiredApprovals": ["IT"],
        "approvals": [],
        "createdByEmail": "alice@company.com",
        "createdAt": "2024-07-12T09:30:00.000Z"
      },
      {
        "id": "c3d4e5f6-a7b8-9012-cdef-012345678902",
        "applicationName": "AWS Console",
        "status": "APPROVED",
        "requiredApprovals": ["IT"],
        "approvals": [
          {
            "role": "IT",
            "approvedByEmail": "carol@company.com",
            "approvedAt": "2024-07-10T14:00:00.000Z"
          }
        ],
        "createdByEmail": "bob@company.com",
        "createdAt": "2024-07-08T08:00:00.000Z"
      }
    ]
  }
}
```
---

### Query: `requestsByStatus`

Returns all requests matching a given status. Useful for building approval queues.

**Authorization:** `MANAGER`, `IT`, `HR`, `ADMIN` only.

#### Arguments

| Argument | Type | Required | Description |
|---|---|---|---|
| `status` | `RequestStatus` | Yes | One of `PENDING`, `PARTIALLY_APPROVED`, `APPROVED`, `DENIED` |

#### GraphQL Document

```graphql
query RequestsByStatus($status: RequestStatus!) {
  requestsByStatus(status: $status) {
    id
    applicationName
    justification
    status
    requiredApprovals
    approvals {
      role
      approvedBy
      approvedByEmail
      approvedAt
    }
    createdBy
    createdByEmail
    createdAt
    decisionBy
    decisionByEmail
    decisionAt
    decisionNote
  }
}
```

#### Example Request — Fetch the approval queue

```json
{
  "query": "query RequestsByStatus($status: RequestStatus!) { requestsByStatus(status: $status) { id applicationName justification status requiredApprovals approvals { role approvedByEmail approvedAt } createdByEmail createdAt } }",
  "variables": {
    "status": "PENDING"
  }
}
```

#### Example Response

```json
{
  "data": {
    "requestsByStatus": [
      {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "applicationName": "GitHub",
        "justification": "Need access to manage code repositories for the Q3 development sprint.",
        "status": "PENDING",
        "requiredApprovals": ["IT"],
        "approvals": [],
        "createdByEmail": "alice@company.com",
        "createdAt": "2024-07-12T09:30:00.000Z"
      }
    ]
  }
}
```
---

### Query: `riskAssessment`

Runs an AI risk assessment on a specific access request and returns a score, risk level, and reasoning. Employees may only assess their own requests. Approver roles may assess any request.

**Authorization:** Any authenticated user (own requests) or approver roles (any request).

#### Arguments

| Argument | Type | Required | Description |
|---|---|---|---|
| `requestId` | `ID` | Yes | The ID of the access request to assess |

#### GraphQL Document

```graphql
query RiskAssessment($requestId: ID!) {
  riskAssessment(requestId: $requestId) {
    requestId
    score
    riskLevel
    reasoning
    assessedAt
    metrics {
      executionTimeMs
      provider
      tokensUsed
      modelId
    }
  }
}
```

#### Example Request

```json
{
  "query": "query RiskAssessment($requestId: ID!) { riskAssessment(requestId: $requestId) { requestId score riskLevel reasoning assessedAt metrics { executionTimeMs provider tokensUsed modelId } } }",
  "variables": {
    "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
}
```

#### Example Response

```json
{
  "data": {
    "riskAssessment": {
      "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "score": 18,
      "riskLevel": "LOW",
      "reasoning": "Standard tech application with adequate justification provided. Routine IT approval sufficient.",
      "assessedAt": "2024-07-15T11:05:00.000Z",
      "metrics": {
        "executionTimeMs": 340,
        "provider": "claude",
        "tokensUsed": 187,
        "modelId": "claude-haiku-4-5-20251001"
      }
    }
  }
}
```
---

## 6. Type Reference

### `User`

| Field | Type | Nullable | Description |
|---|---|---|---|
| `id` | `ID` | No | Unique user identifier |
| `email` | `String` | No | Email address |
| `name` | `String` | No | Display name |
| `role` | `Role` | No | Permission role |

---

### `AuthPayload`

Returned by the `login` mutation.

| Field | Type | Nullable | Description |
|---|---|---|---|
| `token` | `String` | No | Signed JWT, valid for 8 hours |
| `user` | `User` | No | The authenticated user's profile |

---

### `AccessRequest`

| Field | Type | Nullable | Description |
|---|---|---|---|
| `id` | `ID` | No | Unique request identifier (UUID) |
| `applicationName` | `String` | No | Name of the application being requested |
| `justification` | `String` | No | Business justification provided by the requester |
| `status` | `RequestStatus` | No | Current lifecycle status |
| `requiredApprovals` | `[Role!]!` | No | Roles that must approve before the request is fully approved |
| `approvals` | `[Approval!]!` | No | List of approvals already recorded (empty until someone approves) |
| `createdBy` | `String` | No | User ID of the submitter |
| `createdByEmail` | `String` | No | Email address of the submitter |
| `createdAt` | `String` | No | ISO 8601 timestamp |
| `decisionBy` | `String` | **Yes** | User ID of the final decision-maker; `null` until terminal state |
| `decisionByEmail` | `String` | **Yes** | Email of the final decision-maker; `null` until terminal state |
| `decisionAt` | `String` | **Yes** | ISO 8601 timestamp of the final decision; `null` until terminal state |
| `decisionNote` | `String` | **Yes** | Optional note left by the final decision-maker |

---

### `Approval`

One entry per role that has approved a request. Only present in `approvals[]` once the approval is recorded.

| Field | Type | Nullable | Description |
|---|---|---|---|
| `role` | `Role` | No | The role that approved |
| `approvedBy` | `String` | No | User ID of the approver |
| `approvedByEmail` | `String` | No | Email of the approver |
| `approvedAt` | `String` | No | ISO 8601 timestamp of that approval |

---

### `RiskAssessmentResult`

| Field | Type | Nullable | Description |
|---|---|---|---|
| `requestId` | `ID` | No | ID of the assessed request |
| `score` | `Int` | No | Risk score, 0–100 |
| `riskLevel` | `RiskLevel` | No | Categorical risk level |
| `reasoning` | `String` | No | Human-readable explanation from the AI |
| `assessedAt` | `String` | No | ISO 8601 timestamp of the assessment |
| `metrics` | `RiskAssessmentMetrics` | No | Execution metadata |

---

### `RiskAssessmentMetrics`

| Field | Type | Nullable | Description |
|---|---|---|---|
| `executionTimeMs` | `Int` | No | Wall-clock time of the AI call in milliseconds |
| `provider` | `String` | No | AI backend used (`"claude"` or `"mock"`) |
| `tokensUsed` | `Int` | **Yes** | Total tokens consumed (input + output); `null` when using mock provider |
| `modelId` | `String` | **Yes** | Exact model identifier used; `null` when using mock provider |

---