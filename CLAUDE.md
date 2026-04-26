# ExampleHR Time-Off — CLAUDE.md

> **Role**: This file is the authoritative engineering contract for this project.
> Read it fully before writing any code. Every rule here1 exists to prevent a
> specific class of bug or architectural drift.

---

## 1. Project Identity

| Field | Value |
|-------|-------|
| **What it is** | Frontend UI layer over an HCM system (Workday/SAP analogue) |
| **Domain** | Time-off request lifecycle: submit → pending → approved/denied |
| **Key constraint** | ExampleHR cannot trust HCM. A 200 response may be a lie. |
| **Mandated stack** | Next.js 14+ App Router · TanStack Query v5 · Zustand · Storybook · Vitest |
| **Source of truth** | `TRD.md` — authoritative document for scope, goals, and edge cases |
| **Reference doc** | `IMPLEMENTATION_PLAN.md` — implementation mapping (must not contradict `TRD.md`) |

### Scope enforcement (non-negotiable)

- **Do not** add product features, UI affordances, or workflows not specified by `TRD.md`.
- When in doubt, prefer **tests + stories** to prove correctness over adding “debug/QA UI” that isn’t in scope.

### Mandatory goals & edge cases (must be covered)

- **Employee view**: show per-location balances and submit time-off requests.
- **Manager view**: review pending requests and approve/deny with **fresh** balance context at decision time.
- **Out-of-band balance changes**: balances can change while the app is open; UI must reconcile without surprising the user.
- **Canonical per-cell reads**: authoritative reads are per-cell; batch is for hydration/reconciliation.
- **Silent success**: HCM may return HTTP 200 for a write that did not commit — must detect via canonical re-read and rollback.
- **Slow / timeout / conflict responses**: must degrade gracefully and remain honest.
- **Storybook coverage**: every meaningful UI state must have stories (loading, empty, stale, optimistic pending, rollback, rejected, silently-wrong, refreshed mid-session, conflicts).

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser                                                        │
│                                                                 │
│  ┌──────────────────┐    ┌──────────────────────────────────┐   │
│  │  React Component │    │  TanStack Query (Server Cache)   │   │
│  │  Tree            │◀──▶│  - balances, requests            │   │
│  │                  │    │  - staleTime, refetchInterval    │   │
│  │  (read-only      │    │  - optimistic setQueryData       │   │
│  │   from TQ cache  │    └──────────────┬───────────────────┘   │
│  │   + Zustand UI   │                   │ fetch / mutate         │
│  │   state only)    │    ┌──────────────▼───────────────────┐   │
│  │                  │◀──▶│  Zustand Store (UI-only state)   │   │
│  └──────────────────┘    │  - inFlightMutations Set         │   │
│                          │  - notification toast queue      │   │
│                          │  - open modal / form flags       │   │
│                          └──────────────────────────────────┘   │
└────────────────────────────────┬────────────────────────────────┘
                                 │ HTTP (all via hcm-client.ts)
┌────────────────────────────────▼────────────────────────────────┐
│  Next.js Server (same process)                                  │
│                                                                 │
│  /app/api/mock/hcm/...        ←  Route handlers                 │
│         ↕                                                       │
│  lib/mock-hcm/logic.ts        ←  Pure business logic (no Next)  │
│  lib/mock-hcm/store.ts        ←  In-memory state               │
└─────────────────────────────────────────────────────────────────┘
```

### Architectural Pattern

This is a **CQRS-inspired frontend** with a clear read/write boundary:

- **Reads** — always served from TanStack Query's cache (fast, with staleness
  tracking). Components never fetch directly.
- **Writes** — always through `useMutation` hooks with a three-phase lifecycle:
  optimistic snapshot → HCM write → mandatory canonical re-read.
- **UI ephemeral state** — exclusively in Zustand. Nothing that lives in Zustand
  is authoritative about data; it is all transient presentation state.

---

## 3. The One Invariant That Must Never Break

> **ExampleHR never tells a user their request is "Approved" unless a canonical
> re-read from HCM has confirmed the balance was actually deducted.**

This is not a nice-to-have. It is the core design contract.

- A 200 from HCM on a POST means "HCM acknowledged the write." It does **not**
  mean the write committed. Treat it as a provisional optimistic confirmation only.
- After every successful POST, immediately re-fetch the per-cell balance for
  `(employeeId, locationId)`. Compare against the expected post-deduction value.
- If the balance did not move: trigger rollback, not "pending."
- The UI label for the intermediate state is **"Pending confirmation"** — never
  "Approved" until step 2 (canonical re-read) passes.

---

## 4. State Management Boundary — Hard Rules

| State Type | Owner | Rule |
|-----------|-------|------|
| Server data (balances, requests) | TanStack Query | Never replicate in Zustand |
| Optimistic mutations | TanStack Query `setQueryData` | Always snapshot before mutating |
| In-flight mutation tracking | Zustand `inFlightMutations` Set | Register on `onMutate`, remove on settle |
| Toast notifications | Zustand notification queue | Dequeue on dismiss; deduplicate by key |
| Modal / form open state | Zustand | Boolean flags only — no data *(exception below)* |
| Derived display values | Computed inline in component | No derived state in either store |

**Exception (narrow, explicit)**: The `RequestModal` open-state may carry *only* the minimal
context needed to render the form, e.g. `locationId: string | null`. This does not make Zustand a
server-data store; it is UI routing context for a modal that can be opened from multiple places.

**The boundary violation to avoid**: Copying server state into Zustand to "share
it" between components. Use `useQueryClient().getQueryData()` or
`useQuery()` with `select` to access cached server data from any component.

---

## 5. Query Key Discipline

All query keys are defined in `lib/query-keys.ts`. This is not optional.

**Never** hardcode a string array as a query key inline. Always use the factory:

```typescript
// CORRECT
import { queryKeys } from '@/lib/query-keys';
useQuery({ queryKey: queryKeys.balance(employeeId, locationId) });

// WRONG — do not do this
useQuery({ queryKey: ['balance', employeeId, locationId] });
```

**Why this matters**: A key typo creates a phantom second cache entry. The
component shows stale data while the correct key is being updated. Unit tests
for `lib/query-keys.ts` guard this.

### Stale Time Reference

| Key | Stale Time | Refetch Interval | Rationale |
|-----|-----------|-----------------|-----------|
| `balance(eId, lId)` | 10s | on-demand | Per-cell: high precision needed for decisions |
| `balances(eId)` | 30s | 30s | Batch: slightly looser; used for display not gating |
| `requests.employee(eId)` | 60s | on-focus | Low mutation rate |
| `requests.manager(mId)` | 15s | 15s | Manager view needs near-live data |
| `request(id)` | 30s | on-focus | Detail read |

---

## 6. Optimistic Update Lifecycle

Every mutation hook **must** implement all four phases. Skipping any phase
creates the bugs the design was built to prevent.

```
Phase 1 — SNAPSHOT + OPTIMISTIC APPLY
  onMutate():
    → snapshot = queryClient.getQueryData(queryKeys.balance(eId, lId))
    → queryClient.cancelQueries(queryKeys.balance(eId, lId))   // prevent race
    → queryClient.setQueryData(...)  // apply optimistic value
    → zustand.inFlightMutations.add(`${eId}:${lId}`)
    → return { snapshot }

Phase 2 — WRITE
  mutationFn(): POST /api/mock/hcm/requests

Phase 3a — SUCCESS PATH (HCM returned 200)
  onSuccess():
    → immediately refetch queryKeys.balance(eId, lId)   // canonical re-read
    → compare canonical balance with expected post-deduction value
    → if match: status = 'pending-manager', clear optimistic badge
    → if no match: trigger rollback (same as error path)

Phase 3b — ERROR / ROLLBACK PATH
  onError(_, __, context):
    → queryClient.setQueryData(queryKeys.balance(eId, lId), context.snapshot)
    → zustand.notifications.push({ type: 'rollback', reason: parseReason(error) })

Phase 4 — SETTLE (always runs)
  onSettled():
    → zustand.inFlightMutations.delete(`${eId}:${lId}`)
    → queryClient.invalidateQueries(queryKeys.balance(eId, lId))
    → queryClient.invalidateQueries(queryKeys.balances(eId))
    → queryClient.invalidateQueries(queryKeys.requests())
```

---

## 7. Background Refresh Race Condition Guard

When a background poll result arrives while `inFlightMutations` contains
`${employeeId}:${locationId}`, **do not apply the background data** to that cell.

Implementation location: the `onSuccess` callback of `useBalances` and
`useBalance` hooks — not in TanStack Query config.

```typescript
// In useBalance.ts onSuccess
onSuccess(newData) {
  const key = `${newData.employeeId}:${newData.locationId}`;
  if (useInFlightStore.getState().mutations.has(key)) {
    // Hold: mutation in progress. Schedule a re-read after settle.
    return;
  }
  // Otherwise: detect out-of-band changes and notify
  const prev = queryClient.getQueryData(queryKeys.balance(...));
  if (prev && prev.available !== newData.available) {
    const delta = newData.available - prev.available;
    useNotificationsStore.getState().push(
      delta > 0 ? { type: 'balance-refreshed-up', ... }
                : { type: 'balance-refreshed-down', ... }
    );
  }
}
```

---

## 8. Mock HCM Architecture Rules

`lib/mock-hcm/logic.ts` must have **zero imports from Next.js**. It is a pure
module of functions that operate on plain JavaScript objects.

**Why**: Integration tests import `logic.ts` directly (not via network). If
Next.js internals leak in, tests break in non-Next environments.

The route handlers in `/app/api/mock/hcm/` are thin wrappers:

```typescript
// app/api/mock/hcm/requests/route.ts
import { submitRequest } from '@/lib/mock-hcm/logic';
import { hcmStore } from '@/lib/mock-hcm/store';

export async function POST(req: Request) {
  const body = await req.json();
  const result = submitRequest(hcmStore, body);  // all logic here
  return Response.json(result.body, { status: result.status });
}
```

### Silent Success Simulation

The mock has a 20% probability of returning 200 without committing the write
(`simulate=silent-success`). This is **the primary regression target** for the
canonical re-read logic. Do not remove or disable this behavior in the mock.

---

## 9. Component Rules

### Layer Responsibilities

| Layer | May Do | Must Not Do |
|-------|--------|-------------|
| Page (`app/.../page.tsx`) | Compose shells, pass route params | Direct data fetching, business logic |
| Shell (`*Shell.tsx`) | Compose feature sections, layout | Own query/mutation state |
| Feature component | Own a single `useQuery`/`useMutation` | Talk to HCM directly, own UI ephemeral state |
| Shared component | Receive props, render, fire callbacks | Import hooks that call the network |
| Hook (`hooks/*.ts`) | Query/mutate, transform data, orchestrate lifecycle | Render JSX, import Zustand directly except in mutation lifecycle |

### Shared Components are Dumb by Design

Every component in `components/shared/` must be fully renderable from Storybook
with static props — no network calls, no store reads. They receive data and
callbacks. The hook layer does all the work.

### The Manager's `LiveBalancePanel` Is Special

The `LiveBalancePanel` component inside `ApprovalCard` must **always** fetch
fresh data on mount. It must not use `initialData` or a stale cache entry.

```typescript
// CORRECT — forces a fresh read every time the approval card renders
const { data, isLoading } = useBalance(employeeId, locationId, {
  staleTime: 0,
  refetchOnMount: 'always',
});
```

This prevents the approval-on-stale-balance bug (Risk table, Row 3).

---

## 10. Staleness Indicator Logic

The `StalenessIndicator` component is driven by `fetchedAt` (a `number`
timestamp stored on the `Balance` type), **not** by TanStack Query's internal
`isStale` flag.

```typescript
const STALE_THRESHOLD_MS = 60_000; // 60 seconds

const isVisiblyStale = Date.now() - balance.fetchedAt > STALE_THRESHOLD_MS;
```

This is intentionally separate from TQ's staleness concept. TQ may consider
data "stale" after 10s and refetch silently — the user does not see this. The
`StalenessIndicator` only appears when data is visually old enough that a user
should be notified.

---

## 11. HCM Client Rules

All HCM calls go through `lib/hcm-client.ts`. Never use `fetch` directly in
a hook or component to reach HCM endpoints.

The client enforces:
- **8-second timeout** — throws `HCMTimeoutError` after 8s (no hanging requests)
- **Typed response shapes** — every endpoint has a typed request/response
- **`fetchedAt` stamping** — every successful response is tagged with `Date.now()`

```typescript
// CORRECT
import { hcmClient } from '@/lib/hcm-client';
const balance = await hcmClient.getBalance(employeeId, locationId);

// WRONG — bypasses timeout, type safety, and fetchedAt stamping
const res = await fetch(`/api/mock/hcm/balance?employeeId=${employeeId}...`);
```

---

## 12. Storybook Rules

- Every UI state listed in `IMPLEMENTATION_PLAN.md § 11` (UI State Inventory)
  must have a corresponding story **before** the component is considered done.
- Stories use **MSW via `msw-storybook-addon`** for network simulation — not
  mocked functions.
- Each story that involves user interaction must have a `play()` function.
- The `QueryClient` is reset between stories via a decorator in `.storybook/preview.ts`.
  Never share query cache between stories.
- Stories import from `components/shared/` only. They do not import pages or shells.

---

## 13. Test Rules

### What Each Layer Tests

| Layer | File pattern | Tests |
|-------|-------------|-------|
| Unit | `tests/unit/**` | Pure logic: query keys, rollback detection, staleness math, notification dedup |
| Hook | `hooks/*.test.ts` | Mutation lifecycle phases, race condition guard, silent-success detection |
| Integration | `tests/integration/**` | Full data layer: TQ + hcm-client + mock logic (no network — import logic directly) |
| Storybook | `stories/**/*.stories.tsx` `play()` | UI state rendering, user interaction flows |
| E2E (optional) | `tests/e2e/**` | Full user flows via Playwright |

### Integration Test Setup

Integration tests import `lib/mock-hcm/logic.ts` and `lib/mock-hcm/store.ts`
directly — they do not spin up Next.js. This is why `logic.ts` must have no
Next.js imports (Rule §8).

### Mandatory Test Coverage

These specific scenarios are non-negotiable in the test suite:

1. Submit request → HCM 200 → canonical re-read balance unchanged → rollback triggered
2. Submit request → HCM timeout → rollback triggered after 8s
3. Background poll fires during in-flight mutation → balance not overwritten
4. Background poll returns higher balance (no in-flight) → toast dispatched
5. Manager approve → 409 BALANCE_CHANGED → conflict modal triggered
6. Manager approve → fresh balance < request.days → approval blocked in UI

---

## 14. Architectural Trade-offs & Known Risks

### Accepted Trade-offs

| Trade-off | What We Gain | What We Give Up |
|-----------|-------------|-----------------|
| Two state libraries (TQ + Zustand) | Clean server/UI boundary | Cognitive overhead; must enforce boundary discipline |
| Polling instead of WebSockets | Zero infrastructure, works with any HCM | Up to 30s lag for out-of-band balance changes |
| Optimistic updates with re-read | Instant UX; honest about HCM lies | Extra network round-trip per mutation; rollback UI must be polished |
| Mock HCM as Next.js route handlers | Single command to run everything | Mock behavior is tied to Next.js runtime (mitigated by framework-agnostic logic module) |
| MSW for Storybook, direct import for integration tests | Stories independent of server | Two mock surfaces — must stay in sync via shared `logic.ts` |

### Active Risk Register

| Risk | Likelihood | Impact | Guard |
|------|-----------|--------|-------|
| Silent success (HCM 200 but no balance deduction) | High (20% simulated) | High | Mandatory canonical re-read §6 Phase 3a |
| Background refetch overwrites optimistic state | Medium | Medium | `inFlightMutations` gate §7 |
| Manager approves on stale balance | Medium | High | `staleTime: 0` on `LiveBalancePanel` §9 |
| HCM timeout hangs submission UI | Medium | Medium | 8s timeout in `hcm-client.ts` §11 |
| Query key collision (wrong employee's data shown) | Low | Critical | Centralized key factory + unit tests §5 |
| Storybook MSW handlers diverge from real mock logic | Medium | Medium | Both use `lib/mock-hcm/logic.ts` §8 |
| Anniversary bonus notification during in-flight mutation | Low | Low | Hold notification until mutation settles §7 |

### Architectural Decisions Not Yet Made

These questions should be answered before implementation begins on the relevant module:

1. **Error boundary placement** — Should `BalanceSummaryGrid` or `EmployeeShell` own the error boundary? Placing it too high means a single balance read failure blurs the whole page. Placing it too low means N error UIs for N failed rows.

2. **Notification deduplication key** — What is the unique key for a toast? Options: `(type, employeeId, locationId)` or `(type, requestId)`. The choice affects whether two simultaneous rollbacks for different locations produce one or two toasts.

3. **`ApprovalConflictModal` behavior** — When the manager sees a 409 BALANCE_CHANGED, does the modal offer "Approve anyway" or only "Deny"? The implementation plan shows "approve anyway?" — confirm this is the desired UX before building the modal.

4. **`RequestModal` controlled vs. uncontrolled** — Is the modal's `open` state owned by `Zustand` (allowing it to be opened from anywhere, e.g., a notification CTA) or by local state in `EmployeeShell`? The implementation plan uses Zustand — but this means the Zustand slice must carry the `locationId` context for the form.

---

## 15. File & Folder Structure

All application code lives under `src/`. The folder tree below is canonical — do not create files outside it without a documented reason.

```
examplehr-timeoff/
│
├── src/
│   ├── app/                                  # Next.js App Router — routing only
│   │   ├── layout.tsx                        # Server Component; imports <Providers>
│   │   ├── page.tsx                          # Root redirect
│   │   ├── employee/
│   │   │   └── [employeeId]/
│   │   │       ├── page.tsx                  # Renders <EmployeeShell> and nothing else
│   │   │       ├── loading.tsx
│   │   │       └── error.tsx
│   │   ├── manager/
│   │   │   └── [managerId]/
│   │   │       ├── page.tsx
│   │   │       ├── loading.tsx
│   │   │       └── error.tsx
│   │   └── api/
│   │       └── mock/
│   │           └── hcm/                      # Thin wrappers — no logic here
│   │               ├── balance/route.ts
│   │               ├── balances/route.ts
│   │               ├── requests/
│   │               │   ├── route.ts
│   │               │   └── [id]/
│   │               │       ├── approve/route.ts
│   │               │       └── deny/route.ts
│   │               └── trigger-anniversary/route.ts
│   │
│   ├── features/                             # Scalability axis — one folder per domain
│   │   └── time-off/                         # Future: payroll/, leave-calendar/
│   │       ├── employee/
│   │       │   ├── components/
│   │       │   │   ├── EmployeeShell/
│   │       │   │   │   ├── EmployeeShell.tsx
│   │       │   │   │   └── index.ts
│   │       │   │   ├── BalanceSummaryGrid/
│   │       │   │   │   ├── BalanceSummaryGrid.tsx
│   │       │   │   │   ├── BalanceSummaryGrid.test.tsx
│   │       │   │   │   ├── BalanceSummaryGrid.stories.tsx
│   │       │   │   │   └── index.ts
│   │       │   │   ├── BalanceRow/
│   │       │   │   │   ├── BalanceRow.tsx
│   │       │   │   │   ├── BalanceRow.test.tsx
│   │       │   │   │   ├── BalanceRow.stories.tsx
│   │       │   │   │   └── index.ts
│   │       │   │   ├── RequestModal/
│   │       │   │   │   ├── RequestModal.tsx
│   │       │   │   │   ├── RequestModal.test.tsx
│   │       │   │   │   ├── RequestModal.stories.tsx
│   │       │   │   │   ├── DateRangePicker.tsx
│   │       │   │   │   ├── DayCountDisplay.tsx
│   │       │   │   │   └── index.ts
│   │       │   │   └── ActiveRequestsList/
│   │       │   │       ├── ActiveRequestsList.tsx
│   │       │   │       ├── ActiveRequestsList.stories.tsx
│   │       │   │       └── index.ts
│   │       │   └── hooks/
│   │       │       ├── useBalance.ts
│   │       │       ├── useBalance.test.ts
│   │       │       ├── useBalances.ts
│   │       │       ├── useBalances.test.ts
│   │       │       ├── useSubmitRequest.ts
│   │       │       └── useSubmitRequest.test.ts
│   │       ├── manager/
│   │       │   ├── components/
│   │       │   │   ├── ManagerShell/
│   │       │   │   │   ├── ManagerShell.tsx
│   │       │   │   │   └── index.ts
│   │       │   │   ├── PendingApprovalsList/
│   │       │   │   │   ├── PendingApprovalsList.tsx
│   │       │   │   │   ├── PendingApprovalsList.stories.tsx
│   │       │   │   │   └── index.ts
│   │       │   │   ├── ApprovalCard/
│   │       │   │   │   ├── ApprovalCard.tsx
│   │       │   │   │   ├── ApprovalCard.test.tsx
│   │       │   │   │   ├── ApprovalCard.stories.tsx
│   │       │   │   │   └── index.ts
│   │       │   │   ├── LiveBalancePanel/
│   │       │   │   │   ├── LiveBalancePanel.tsx
│   │       │   │   │   ├── LiveBalancePanel.stories.tsx
│   │       │   │   │   └── index.ts
│   │       │   │   └── ApprovalConflictModal/
│   │       │   │       ├── ApprovalConflictModal.tsx
│   │       │   │       ├── ApprovalConflictModal.stories.tsx
│   │       │   │       └── index.ts
│   │       │   └── hooks/
│   │       │       ├── useApproveRequest.ts
│   │       │       ├── useApproveRequest.test.ts
│   │       │       ├── useDenyRequest.ts
│   │       │       └── useDenyRequest.test.ts
│   │       └── shared/
│   │           ├── components/
│   │           │   ├── BalanceDisplay/
│   │           │   │   ├── BalanceDisplay.tsx
│   │           │   │   ├── BalanceDisplay.test.tsx
│   │           │   │   ├── BalanceDisplay.stories.tsx
│   │           │   │   └── index.ts
│   │           │   ├── StalenessIndicator/
│   │           │   │   ├── StalenessIndicator.tsx
│   │           │   │   ├── StalenessIndicator.test.tsx
│   │           │   │   ├── StalenessIndicator.stories.tsx
│   │           │   │   └── index.ts
│   │           │   ├── StatusBadge/
│   │           │   ├── RollbackBanner/
│   │           │   ├── ConflictBanner/
│   │           │   ├── BalanceRefreshedToast/
│   │           │   └── LoadingSkeleton/
│   │           └── types/
│   │               ├── balance.ts
│   │               ├── request.ts
│   │               └── index.ts
│   │
│   ├── lib/                                  # Framework-agnostic — no Next.js imports
│   │   ├── hcm-client.ts
│   │   ├── query-keys.ts
│   │   └── mock-hcm/
│   │       ├── store.ts
│   │       ├── fixtures.ts
│   │       └── logic.ts
│   │
│   ├── store/                                # Zustand slices — UI state only
│   │   ├── index.ts
│   │   ├── notifications.ts
│   │   └── in-flight-mutations.ts
│   │
│   └── providers/                            # Keeps layout.tsx a Server Component
│       ├── QueryProvider.tsx
│       ├── ToastProvider.tsx
│       └── index.tsx
│
├── tests/
│   └── integration/                          # Cross-module only; unit tests co-locate
│       ├── optimistic-update.test.ts
│       ├── race-condition.test.ts
│       ├── silent-success.test.ts
│       └── manager-approval.test.ts
│
├── .storybook/
│   ├── main.ts                               # stories: ['../src/**/*.stories.*']
│   ├── preview.tsx
│   └── msw-handlers/
│       ├── balance.ts
│       ├── requests.ts
│       └── index.ts
│
├── public/
├── .env.local.example
├── next.config.ts
├── tsconfig.json                             # paths: { "@/*": ["./src/*"] }
├── vitest.config.ts
├── vitest.workspace.ts                       # unit (jsdom) + integration (node) workspaces
├── package.json
├── CLAUDE.md
└── IMPLEMENTATION_PLAN.md
```

### Placement Rules

- **`app/`** — routing and page files only. No business logic, no direct data fetching.
- **`features/time-off/`** — every component, hook, and type owned by the time-off domain.
- **`features/time-off/shared/`** — used by both employee and manager slices. Not a global component library; these components are time-off–specific.
- **`lib/`** — framework-agnostic utilities only. Zero Next.js imports. Imported by both route handlers and integration tests.
- **`store/`** — Zustand slices only. Each slice in its own file. No server data ever stored here.
- **`providers/`** — React context wrappers. Exists solely to keep `app/layout.tsx` a Server Component.
- **`tests/integration/`** — cross-module tests only. Unit and hook tests co-locate with their source file.

### Component Folder Convention

Every component gets its own folder. Sub-components used only within a parent live inside that parent's folder and are not exported from its `index.ts`.

```
RequestModal/
├── RequestModal.tsx          # exported
├── RequestModal.test.tsx
├── RequestModal.stories.tsx
├── DateRangePicker.tsx       # not exported — internal to RequestModal
├── DayCountDisplay.tsx       # not exported — internal to RequestModal
└── index.ts                  # export { RequestModal } only
```

### Barrel File Policy

Barrel files (`index.ts`) exist at the **component folder** level only — one per component. Do not create a barrel at `features/time-off/shared/components/index.ts` that re-exports everything. That breaks tree-shaking and creates circular dependency risk.

```typescript
// Correct
import { BalanceDisplay } from '@/features/time-off/shared/components/BalanceDisplay';

// Wrong — mega-barrel
import { BalanceDisplay, StatusBadge } from '@/features/time-off/shared/components';
```

### Test Co-location Rule

| Test type | Lives next to source? | Why |
|-----------|----------------------|-----|
| Unit / component / hook | Yes | Proximity — deleted component takes its test with it |
| Integration | No — `tests/integration/` | Spans multiple modules; has no single owner |
| Storybook stories | Yes | Same reasoning as unit tests |

---

## 16. Code Style Rules

### Naming over comments

Do not add comments to explain what code does. Name things so no comment is needed.

```typescript
// Wrong — comment restates the code
const t = Date.now() - b.fetchedAt; // time since last fetch in ms
const stale = t > 60000;            // true if older than 60 seconds

// Correct — names carry the meaning
const msSinceLastFetch = Date.now() - balance.fetchedAt;
const isVisiblyStale = msSinceLastFetch > VISIBLE_STALENESS_THRESHOLD_MS;
```

The only comment worth writing is one that explains **why** a non-obvious constraint exists — not what the code does. One line maximum.

```typescript
// staleTime: 0 — manager must never approve on a cached balance
const { data } = useBalance(employeeId, locationId, { staleTime: 0 });
```

Everything else: no comment. Name the function, variable, or constant to be self-describing.

### Naming conventions

| Thing | Convention | Example |
|-------|-----------|---------|
| Boolean variables | `is` / `has` / `can` prefix | `isVisiblyStale`, `hasInFlightMutation`, `canApprove` |
| Event handlers | `handle` prefix | `handleSubmit`, `handleApproveClick` |
| Query hooks | `use` + noun | `useBalance`, `useApproveRequest` |
| Async functions | verb that names the action | `fetchBalance`, `submitTimeOffRequest` |
| Constants | `SCREAMING_SNAKE_CASE` | `VISIBLE_STALENESS_THRESHOLD_MS`, `HCM_REQUEST_TIMEOUT_MS` |
| Type aliases | `PascalCase` noun | `Balance`, `TimeOffRequest`, `RequestStatus` |
| Zustand slice files | kebab-case noun | `in-flight-mutations.ts`, `notifications.ts` |

### What NOT to Do

These are anti-patterns specific to this codebase. Each one would introduce a
class of bug the architecture was designed to prevent.

| Anti-pattern | Why it breaks here |
|-------------|-------------------|
| Trust HCM 200 responses without canonical re-read | Silent success (20%) would corrupt balance display permanently |
| Show "Approved" label before canonical re-read completes | Creates false confidence; the core design contract violation |
| Call `fetch` to HCM endpoints directly in a component | Bypasses timeout, type safety, and `fetchedAt` stamping |
| Store balance or request data in Zustand | Creates a second source of truth; TQ invalidation won't clear it |
| Hardcode query key strings inline | Leads to phantom cache entries; wrong data shown to wrong user |
| Apply background refetch data when mutation is in-flight | Optimistic balance "jumps" back to pre-mutation value mid-flow |
| Skip the `onMutate` snapshot in a mutation hook | Rollback cannot restore previous value; user is left with corrupted state |
| Add Next.js imports to `lib/mock-hcm/logic.ts` | Integration tests will break; mock becomes untestable outside Next |
| Reuse the `QueryClient` between Storybook stories | Stale cache from one story bleeds into another; stories lie |
| Write a component with >1 `useQuery` call | Extract the second query into a child component or a composed hook |
| Add line-by-line comments explaining what the code does | Names should carry that meaning; comments that restate code rot when code changes |

---

## 17. Glossary

| Term | Definition |
|------|-----------|
| **Canonical re-read** | A fresh per-cell `GET` from HCM after a write, used to verify the write actually committed |
| **Silent success** | HCM returns HTTP 200 on a POST but the balance was not actually deducted |
| **Optimistic state** | The temporary UI state applied immediately on mutation, before HCM confirms |
| **In-flight mutation** | A mutation that has been applied optimistically but has not yet settled (success or error) |
| **Staleness indicator** | A UX signal shown when `Date.now() - fetchedAt > 60s` — distinct from TQ's internal staleness |
| **Rollback** | Restoring the cached value to the pre-mutation snapshot after a failure or silent success |
| **Reconciliation** | The process of comparing the current cache value to a fresh HCM read and resolving discrepancies |
| **HCM** | Human Capital Management system (Workday/SAP analogue) — the external source of truth for balances |
| **`(eId, lId)` key** | The composite key `(employeeId, locationId)` — the smallest unit of addressable balance data |
