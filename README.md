# ExampleHR — Time-Off Module

A frontend UI layer over a mock HCM system (Workday/SAP analogue) that manages the full time-off request lifecycle: **submit → pending → approved/denied**.

**Stack**: Next.js 16 (App Router) · React 19 · TanStack Query v5 · Zustand · MSW · Storybook · Vitest · TypeScript

---

## Overview

| | |
|---|---|
| **Employee view** | Browse per-location balances, submit time-off requests with optimistic updates, see live confirmation or rollback |
| **Manager view** | Review pending requests with a fresh live-fetched balance at decision time, approve or deny with conflict detection |
| **Core contract** | The UI never shows "Approved" until a canonical re-read from HCM has confirmed the balance was actually deducted — a 200 response alone is not enough |
| **Key challenge** | HCM silently fails 20% of writes (returns 200 without committing). The app detects this via a mandatory canonical re-read and rolls back the optimistic state |

For the full architectural rationale, ADR-style tool choices, and edge case coverage see **[TRD.md](./TRD.md)**.

---

## Live demos

| | URL |
|---|---|
| **App** | https://example-hr.vercel.app/ |
| **Storybook** | https://example-hr-storybook.vercel.app/ |

---

## Quick start

```bash
pnpm install
pnpm dev
```

| View | URL |
|------|-----|
| Employee | http://localhost:3000/employee/e-100 |
| Manager | http://localhost:3000/manager/m-100 |

The root (`/`) redirects to the employee view automatically. No environment variables are required — the mock HCM runs as Next.js route handlers in the same process.

```bash
# Optional: copy to enable dev scenario tools
cp .env.local.example .env.local
```

---

## Storybook

```bash
pnpm storybook
```

Opens at **http://localhost:6006**. Every meaningful UI state has a story with a `play()` interaction test:

- Loading skeleton, empty state, error state
- Optimistic-pending (request submitted, awaiting confirmation)
- Rollback (silent HCM success detected — balance unchanged after 200)
- HCM rejected (insufficient balance, 422)
- Balance refreshed mid-session (out-of-band anniversary bonus)
- Manager approval conflict (409 BALANCE_CHANGED)
- Stale balance indicator (data older than 60s)

---

## Tests

```bash
# Unit + integration tests (fast, no browser)
pnpm test

# Full suite including Storybook interaction tests (requires Playwright)
npx playwright install   # first time only
npx vitest run
```

| Suite | File pattern | What it guards |
|-------|-------------|----------------|
| Unit / hook | `src/**/*.test.ts` | Query key discipline, mutation lifecycle phases, rollback detection, staleness math, notification dedup |
| Integration | `tests/integration/**` | Full data-layer scenarios: silent success → rollback, timeout → rollback, race condition guard, out-of-band toast, manager approval conflict |
| Storybook | `play()` functions in `*.stories.tsx` | UI state rendering and user interaction flows |

---

## Project structure

```
src/
├── app/                        # Next.js App Router — routing only, no business logic
│   ├── employee/[employeeId]/  # Employee pages
│   ├── manager/[managerId]/    # Manager pages
│   └── api/mock/hcm/           # Thin route handler wrappers over lib/mock-hcm/logic.ts
│
├── features/time-off/
│   ├── employee/               # Employee-facing components and hooks
│   ├── manager/                # Manager-facing components and hooks
│   └── shared/                 # Shared types and components (BalanceDisplay, StatusBadge, etc.)
│
├── lib/
│   ├── hcm-client.ts           # All HCM calls — enforces 8s timeout and fetchedAt stamping
│   ├── query-keys.ts           # Centralized query key factory (no inline strings anywhere)
│   └── mock-hcm/
│       ├── logic.ts            # Pure HCM business logic — zero Next.js imports
│       └── store.ts            # In-memory HCM state
│
├── store/                      # Zustand slices — UI state only (never server data)
│   ├── notifications.ts        # Toast queue
│   └── in-flight-mutations.ts  # Tracks active mutations to gate background refreshes
│
└── providers/                  # React context wrappers (keeps layout.tsx a Server Component)

tests/integration/              # Cross-module tests (import logic.ts directly, no network)
.storybook/msw-handlers/        # MSW handlers for Storybook (backed by same logic.ts)
```

---

## Architecture in brief

All HCM reads are served from TanStack Query's cache — components never fetch directly. All writes go through `useMutation` hooks with a strict four-phase lifecycle: **snapshot → optimistic apply → HCM write → mandatory canonical re-read**. If the re-read shows the balance did not move, the optimistic state is rolled back.

UI-only state (toast queue, in-flight mutation tracking, modal flags) lives exclusively in Zustand. The boundary is enforced by rule: server data never enters Zustand, UI state never enters TanStack Query.

The mock HCM runs as Next.js route handlers backed by a pure `lib/mock-hcm/logic.ts` module. The same module is imported directly by integration tests — there is no divergence between what the app exercises and what the tests exercise.

See [TRD.md](./TRD.md) for the full design document including:
- Five architectural decision records (TanStack Query, Zustand, optimistic updates, polling vs WebSockets, mock HCM placement)
- Cache invalidation strategy and stale time rationale
- Background refresh race condition guard design
- Risk register and mitigations

---

## Simulating interesting scenarios

| Scenario | How |
|----------|-----|
| Silent success (HCM returns 200 but doesn't commit) | Submit any request — 20% chance automatically, or add `"simulate": "silent-success"` to the request body |
| Anniversary bonus (out-of-band balance increase) | `POST /api/mock/hcm/trigger-anniversary` with `{ "employeeId": "e-100", "locationId": "loc-annual", "bonusDays": 5 }` |
| Approval conflict (balance changed between submit and approve) | Submit a request as e-100, then trigger a balance reduction via trigger-anniversary, then approve as manager |
| HCM timeout | `GET /api/mock/hcm/balance?employeeId=e-100&locationId=loc-annual&simulate=timeout` |

See [TESTING_GUIDE.md](./TESTING_GUIDE.md) for the full step-by-step manual testing guide.
