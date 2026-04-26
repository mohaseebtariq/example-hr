# ExampleHR Time-Off — Technical Requirements Document

**Stack**: Next.js 16 (App Router) · React 19 · TanStack Query v5 · Zustand · MSW · Vitest · Storybook

---

## 1. The Problem

ExampleHR is a UI layer over an external HCM system (Workday/SAP analogue). The HCM owns all employment data. ExampleHR cannot push to it atomically, cannot subscribe to its mutations, and **cannot fully trust its success responses**.

This creates three concrete tensions:

| Tension | Why it is hard |
|---------|---------------|
| Instant feedback vs honest state | Optimistic UI requires assuming the write succeeded — but HCM silently fails ~20% of the time |
| Accurate balance vs fast balance | Per-cell reads are authoritative but expensive; batch reads are cheap but stale |
| Manager approval correctness | The balance shown to a manager may have changed since the page loaded |

The frontend has to resolve all three without confusing the user or the manager.

---

## 2. Requirements

### Functional

| ID | Requirement |
|----|------------|
| F-01 | Employee sees per-location balances |
| F-02 | Employee submits a time-off request and gets immediate visual feedback |
| F-03 | Employee is never shown "Approved" and then later "Denied" without a clear recovery UI |
| F-04 | Manager sees all pending requests with the live balance at decision time |
| F-05 | Manager can approve or deny; the balance shown is fresh, not cached |
| F-06 | When a balance changes out-of-band (anniversary, year-start), the UI reconciles without surprising the user |
| F-07 | HCM slow responses, timeouts, and conflict errors all degrade gracefully |

### Non-functional

| ID | Requirement |
|----|------------|
| N-01 | Subsequent balance reads served from cache in < 100ms |
| N-02 | Every meaningful UI state has a Storybook story |
| N-03 | Test suite covers optimistic mutation, rollback, silent success, race condition, and conflict paths |
| N-04 | Mock HCM runnable with a single command; Storybook can exercise the same endpoints |

---

## 3. Technology Decisions

### ADR-001 — TanStack Query for server state

**Decision**: TanStack Query v5

**Problem**: The data layer needs caching, background refetch, staleness tracking, optimistic mutations with rollback, and deduplication of concurrent requests. These are all hard to build correctly from scratch.

**Alternatives considered**:

| Option | Reason rejected |
|--------|----------------|
| SWR | Simpler API but weaker mutation model — no first-class `onMutate`/rollback pattern. Rollback requires manual context threading. |
| Redux RTK Query | Excellent for normalized entity caches but adds significant boilerplate. The entity model here is simple (balance per cell, requests per employee/manager) — normalization adds complexity without benefit. |
| Custom fetch + React Context | Full control but rebuilds everything TanStack Query already provides. High risk of subtle cache bugs (stale closures, race conditions on concurrent fetches). The canonical re-read and optimistic lifecycle would each require bespoke solutions. |

**Why TanStack Query wins here**: `useMutation` with `onMutate`/`onSuccess`/`onError`/`onSettled` gives the four-phase lifecycle the design requires out of the box. `staleTime`, `refetchInterval`, and `refetchOnWindowFocus` give the precise reconciliation knobs the manager view needs.

**Trade-off accepted**: Adds a dependency and requires cache key discipline (mitigated by centralised key factory in `src/lib/query-keys.ts`).

---

### ADR-002 — Zustand for UI-only state

**Decision**: Zustand

**Problem**: TanStack Query handles server state. There is still lightweight client state needed for: which request form is open, in-flight mutation tracking (to gate background refreshes), and the notification toast queue.

**Alternatives considered**:

| Option | Reason rejected |
|--------|----------------|
| `useState` / `useReducer` lifted to Context | Works for single-component state but creates prop-drilling or context hell for deeply nested triggers (e.g. a notification dispatched from inside a mutation hook reaching a toast rendered in the root layout). |
| Redux | Overkill for this scope. Adds boilerplate and a second mental model alongside TanStack Query. |
| Jotai atoms | Fine, but Zustand's slice pattern integrates more cleanly with mutation lifecycle hooks where you need to call `store.getState()` imperatively (outside React's render cycle). |

**Why Zustand wins here**: `store.getState()` is callable synchronously in a `useMutation` callback without a React hook. This is essential for the `inFlightMutations` gate, which must be checked inside `useBalance`'s `queryFn` — a non-React context.

**The boundary rule**: TanStack Query = server truth. Zustand = transient UI state. Anything that belongs to the server (balances, request status) must never be copied into Zustand. The boundary is enforced in `CLAUDE.md §4` and tested implicitly by every integration test.

---

### ADR-003 — Optimistic updates (not pessimistic)

**Decision**: Optimistic updates with mandatory post-write canonical re-read.

**The case for pessimistic**: Wait for HCM to confirm before updating the UI. Simpler to reason about — no rollback needed.

**Why it is rejected**: The requirements call for "instant feedback." A pessimistic flow blocks the UI for the full round-trip (potentially 4s+ if HCM is slow). For a time-off request that employees submit regularly, the interaction must feel responsive.

**Why naive optimism is also rejected**: HCM silently fails 20% of the time. A naive optimistic update that trusts the 200 response would permanently show wrong balances. The user would think their request was filed when it was not.

**The resolution — optimistic with mandatory canonical re-read**:

```
Employee submits →
  [optimistic] balance decrements instantly in UI
  [write] POST /api/mock/hcm/requests
  [verify] immediately re-fetch per-cell balance from HCM
  [decision]
    balance moved → request confirmed, status: "pending-manager"
    balance unchanged → rollback UI to snapshot, toast "HCM did not record the deduction"
```

The label **"Pending confirmation"** (not "Approved") is used until the canonical re-read passes. This is the design contract that prevents the "approved → actually denied" problem stated in the requirements.

**Trade-off accepted**: An extra network round-trip per mutation. Rollback UI must be polished because it is a primary (not edge) path given the 20% silent-success rate.

---

### ADR-004 — Polling for reconciliation (not WebSockets)

**Decision**: TanStack Query `refetchInterval` + `refetchOnWindowFocus`.

**Problem**: HCM can change balances out-of-band (anniversary bonuses, year-start resets). The UI needs to detect this without requiring a page refresh.

**Alternatives considered**:

| Option | Reason rejected |
|--------|----------------|
| WebSocket push from HCM | HCM is an external system we do not control. In a real integration, HCM rarely exposes WebSocket APIs. Polling is the realistic pattern for this class of integration. |
| Server-Sent Events via an ExampleHR backend | Correct long-term architecture. Requires infrastructure (persistent connections, fan-out logic) that is out of scope for a frontend-only implementation. |
| Manual refresh only | Puts burden on the user. A manager could approve a request based on a balance that changed 3 minutes ago. |

**Why polling is the right call here**: It requires zero infrastructure, works with any HTTP-based HCM, and the downside (up to 30s lag) is acceptable and disclosed to the user via the staleness indicator.

**Interval design** — the intervals are not arbitrary:

| Query | Interval | Rationale |
|-------|----------|-----------|
| `balances(employeeId)` | 30s | Background reconciliation without excessive churn. Out-of-band changes (anniversary, year-start) are infrequent. |
| `requests.manager(managerId)` | 15s | The manager's approval queue is operational. A request submitted 20s ago should appear without the manager refreshing. |
| `balance(employeeId, locationId)` | `staleTime: 0`, `refetchOnMount: 'always'` on `ApprovalCard` | A manager must never approve on a cached balance. Every render forces a fresh read. |

**The out-of-band notification**: When a background poll returns a different balance for a cell with no in-flight mutation, the delta is classified and surfaced — balance increased (anniversary toast), balance decreased (conflict banner). This means the user is never silently shown wrong data.

---

### ADR-005 — Next.js route handlers for mock HCM

**Decision**: Mock HCM as Next.js App Router route handlers under `/app/api/mock/hcm/`.

**Alternatives considered**:

| Option | Reason rejected |
|--------|----------------|
| MSW only | Works in Storybook (browser) but not in integration tests (Node). Would require two separate mock surfaces. |
| A separate Express/Fastify process | Two processes to start. More brittle local setup. The spec expects a single command to run the app. |
| Hardcoded module mocks in tests | Cannot be shared with Storybook. Stories and tests would diverge, defeating the purpose of a shared test harness. |

**Why route handlers win**: They run in the same process as the app (`pnpm dev`). Storybook uses MSW to intercept the same URLs — and both MSW and the route handlers delegate to the same pure module (`src/lib/mock-hcm/logic.ts`). Integration tests import `logic.ts` directly (no network). One surface of truth for mock behaviour.

**The key constraint**: `src/lib/mock-hcm/logic.ts` has zero Next.js imports. This is enforced by convention and verified by the fact that integration tests import it in a Node (non-Next) environment. If a Next.js import crept in, the integration tests would break at import time.

---

## 4. The One Invariant

> **ExampleHR never tells a user their request is "Approved" unless a canonical re-read from HCM has confirmed the balance actually moved.**

This single rule drives most of the design complexity. It means:

- A 200 from HCM on a POST is treated as "acknowledged", not "committed."
- The intermediate label is **"Pending confirmation"** until the re-read passes.
- If the re-read shows the balance did not move, the UI rolls back with a reason. No silent corruption.

---

## 5. How the component tree maps to data concerns

The spec asks explicitly how the component tree maps to the data layer. Here is the mapping:

```
app/layout.tsx                     ← Server Component; no data
  └── <Providers>                  ← QueryClient + ToastProvider (client boundary)
        └── app/employee/[id]/page.tsx   ← Server Component; passes route param only
              └── <EmployeeShell>  ← layout only, no queries
                    ├── <BalanceSummaryGrid>   ← owns useBalances (batch hydration)
                    │     └── <BalanceRow> × N ← receives balance prop; fires openModal
                    │           └── <BalanceDisplay>   ← pure display
                    │                 └── <StalenessIndicator>  ← driven by fetchedAt
                    ├── <RequestModal>         ← controlled by Zustand modal slice
                    │     └── <RequestForm>   ← owns useSubmitRequest mutation
                    │           └── useBalance (staleTime:0) ← fresh balance for form validation
                    └── <ActiveRequestsList>   ← owns useEmployeeRequests query
                          └── <RequestStatusCard> × N  ← pure display + RollbackBanner
```

```
app/manager/[id]/page.tsx          ← Server Component
  └── <ManagerShell>               ← layout only
        └── <PendingApprovalsList> ← owns useManagerRequests (polled 15s)
              └── <ApprovalCard> × N  ← owns useApproveRequest + useDenyRequest mutations
                    └── <LiveBalancePanel>   ← driven by useBalance(staleTime:0, refetchOnMount:'always')
```

**Design rules enforced by this tree**:

1. Pages are Server Components that pass one prop (the route param). Zero queries at this level.
2. Shells are layout-only. They do not own queries.
3. Each feature component owns **at most one** `useQuery`. A second query is a signal to extract a child component.
4. Shared components (`BalanceDisplay`, `StatusBadge`, `StalenessIndicator`, etc.) receive props and fire callbacks. They have no hooks, no network calls, and no store reads — this is what makes them fully testable in Storybook with static props.
5. `LiveBalancePanel` breaks the "receive props" rule slightly: it is a dedicated component precisely because the manager's balance must be fetched fresh on every `ApprovalCard` render. The forced-fresh read is the guard against the approval-on-stale-balance bug.

---

## 6. Cache invalidation strategy

### Stale times

| Key | Stale time | Refetch interval | Rationale |
|-----|-----------|-----------------|-----------|
| `balance(eId, lId)` | 10s | on-demand | Per-cell: authoritative read, used for mutation verification |
| `balances(eId)` | 30s | 30s | Batch: hydration + background reconciliation |
| `requests.employee(eId)` | 60s | on-focus | Low mutation rate; employee re-checks on return to tab |
| `requests.manager(mId)` | 15s | 15s | Near-live; new requests must surface quickly |

### Invalidation on writes

After every write, the following are invalidated immediately rather than waiting for the next poll:

```typescript
// After submit request
queryClient.invalidateQueries({ queryKey: queryKeys.balance(employeeId, locationId) });
queryClient.invalidateQueries({ queryKey: queryKeys.balances(employeeId) });
queryClient.invalidateQueries({ queryKey: queryKeys.requests.employee(employeeId) });

// After approve or deny
queryClient.invalidateQueries({ queryKey: queryKeys.requests.manager(managerId) });
queryClient.invalidateQueries({ queryKey: queryKeys.balance(employeeId, locationId) });
queryClient.invalidateQueries({ queryKey: queryKeys.balances(employeeId) });
queryClient.invalidateQueries({ queryKey: queryKeys.requests.employee(employeeId) });
```

Both the per-cell and batch keys are invalidated after every balance-affecting write. This is necessary because `BalanceSummaryGrid` displays from the batch key — invalidating only the per-cell key would leave the grid stale until the next 30s poll.

### Staleness indicator

The `StalenessIndicator` component is driven by `balance.fetchedAt` — a timestamp stamped by `hcm-client.ts` on every successful response — **not** by TanStack Query's internal `isStale` flag.

This is intentional. TanStack Query may consider data "stale" after 10s and silently refetch. The staleness indicator only appears when data is old enough (60s) that a human should be notified. The two concepts are separate: one drives refetch scheduling, the other drives UX transparency.

---

## 7. Background refresh reconciliation

### The race condition

When the employee submits a request, the cache is updated optimistically (balance decremented). If a background poll fires before the mutation settles, it would fetch from HCM — which may not have committed the write yet — and overwrite the optimistic state. The user would see the balance "jump back" to the pre-submission value mid-flow.

### The guard

Every in-flight mutation registers its `(employeeId, locationId)` key in `useInFlightMutationsStore` (Zustand). The `queryFn` of `useBalance` checks this set before calling HCM:

```typescript
queryFn: async () => {
  if (useInFlightMutationsStore.getState().has(`${employeeId}:${locationId}`)) {
    return queryClient.getQueryData(queryKeys.balance(employeeId, locationId));
  }
  return hcmClient.getBalance(employeeId, locationId);
}
```

When a mutation is in-flight, the background poll returns the current cached value instead of going to HCM. After the mutation settles (onSettled), the key is removed and a fresh per-cell fetch is triggered to get the true canonical value.

**Why Zustand for this, not TanStack Query config?**  
TanStack Query has no built-in "skip this fetch if a related mutation is pending" option at the granularity of a specific cache key. The `enabled` option disables a query entirely, but here we need the query to still work for other cells — just not for the cell that is in-flight. Zustand's synchronous `getState()` inside the `queryFn` is the cleanest solution.

---

## 8. Mock HCM simulation matrix

All mock logic lives in `src/lib/mock-hcm/logic.ts` — a pure module with zero Next.js imports. It is shared by route handlers (used in the running app), MSW handlers (used in Storybook), and imported directly in integration tests (no network required).

| Scenario | How it is triggered | Frontend response |
|----------|-------------------|-------------------|
| Normal submit | Default | Balance decrements, request created |
| **Silent success** | Random 20%, or `{ simulate: "silent-success" }` in request body | Canonical re-read detects balance unchanged → rollback |
| Insufficient balance | `balance.available < days` | 409 `INSUFFICIENT_BALANCE` → inline form error, no optimistic state applied |
| Invalid dimension | Unknown `locationId` | 400 `INVALID_DIMENSION` → form error |
| Timeout | `?simulate=timeout` on balance endpoint | `HCMTimeoutError` after 8s → rollback + toast |
| Slow response | `?simulate=slow` on balance endpoint | Loading state persists 4s, no freeze |
| **Anniversary bonus** | `POST /api/mock/hcm/trigger-anniversary` | Background poll detects balance increase → "balance updated" toast |
| **Approval conflict** | Balance reduced between submit and approve | `approveRequest` returns 409 `BALANCE_CHANGED` → conflict modal |

---

## 9. Test strategy

The tests are arranged in layers so a contributor cannot silently break any of the four critical paths:

| Layer | File pattern | What breaks if it fails | What it does NOT test |
|-------|-------------|------------------------|----------------------|
| Unit / hook | `src/**/*.test.ts(x)` | Pure logic, mutation lifecycle phases, query key discipline, staleness computation, rollback detection, notification dedup | UI rendering, network integration |
| Integration | `tests/integration/**` | Data-layer wiring: TQ + hcm-client + mock logic (no network) — silent success detection, race condition guard, manager conflict, timeout rollback | UI rendering, visual states |
| Storybook interaction | `play()` in `*.stories.tsx` | UI state rendering, disabled states, modal open/close, toast content | Business logic |

### Mandatory scenarios covered

| # | Scenario | Test file |
|---|---------|-----------|
| 1 | Submit → HCM 200 → canonical re-read balance unchanged → rollback | `tests/integration/silent-success.test.ts` |
| 2 | Submit → HCM timeout → rollback after 8s | `tests/integration/timeout-rollback.test.ts` |
| 3 | Background poll fires during in-flight mutation → balance not overwritten | `tests/integration/race-condition.test.ts` |
| 4 | Background poll returns higher balance (anniversary, no in-flight) → toast dispatched | `tests/integration/out-of-band-toast.test.ts` |
| 5 | Manager approve → 409 BALANCE_CHANGED → conflict modal | `tests/integration/manager-approval-conflict.test.ts` |
| 6 | Manager approve → live balance < request.days → approve button disabled | `tests/integration/manager-balance-insufficient.test.ts` |

---

## 10. Risks and mitigations

| Risk | Likelihood | Impact | Guard |
|------|-----------|--------|-------|
| Silent success goes undetected | High (20% simulated) | High — user thinks request was filed | Mandatory canonical re-read; integration test scenario 1 |
| Background refetch overwrites optimistic state | Medium | Medium — balance "jumps" | `inFlightMutations` gate; integration test scenario 3 |
| Manager approves on stale balance | Medium | High — approval on insufficient funds | `staleTime: 0` + `refetchOnMount: 'always'`; integration test scenario 6 |
| HCM timeout hangs UI | Medium | Medium — user unsure if request filed | 8s client-side timeout → `HCMTimeoutError`; integration test scenario 2 |
| Out-of-band balance change shown without notification | Low | Medium — silent stale data | Out-of-band detection in `useBalance` `useEffect`; integration test scenario 4 |
| Query key collision (wrong employee's data) | Low | Critical — shows wrong balance | Centralised key factory + unit tests in `src/lib/query-keys.test.ts` |
| Storybook MSW diverges from real mock logic | Medium | Medium — stories lie | Both share `src/lib/mock-hcm/logic.ts`; same functions exercised in integration tests |

---

## 11. How to run

```bash
pnpm install

# App (employee: /employee/e-100 · manager: /manager/m-100)
pnpm dev

# Storybook (all UI states, interaction tests)
pnpm storybook

# Unit + integration tests
pnpm test

# Full suite including Storybook interaction tests
npx playwright install   # first time only
npx vitest run
```
