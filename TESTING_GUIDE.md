# ExampleHR Time-Off — UI Testing Guide (Scenario Simulation)

This guide is **for manual testing via the UI**, with supporting “trigger” endpoints only where the UI itself cannot deterministically force a scenario.

## Prerequisites

- Start the app:

```bash
pnpm dev
```

- Default pages:
  - Employee: `http://localhost:3000/employee/e-100`
  - Manager: `http://localhost:3000/manager/m-100`

## Notes about how scenarios are simulated in this repo

- **Silent success** (HCM returns 200 but does not commit) is simulated in mock HCM logic:
  - Randomly at **20%** of request submissions, or deterministically via request body `simulate: "silent-success"`.
  - Source: `src/lib/mock-hcm/logic.ts` (`SILENT_SUCCESS_PROBABILITY = 0.2`).
- **Anniversary / out-of-band balance changes** are simulated by:
  - `POST /api/mock/hcm/trigger-anniversary` with `{ employeeId, locationId, bonusDays }`.
  - Source: `src/app/api/mock/hcm/trigger-anniversary/route.ts`.
- **Developer-only scenario tools** (disabled by default) can be enabled via:
  - `.env.local`: `ENABLE_DEV_SCENARIOS=1`
  - This exposes `POST /api/mock/hcm/adjust-balance` for deterministic conflict simulation.
- The UI’s “background refresh” for balances comes from polling:
  - `useBalances(employeeId)` polls every **30s** (`refetchInterval: 30_000`).
  - Source: `src/features/time-off/employee/hooks/useBalances.ts`.
- The **race-condition guard** (background refresh must not overwrite optimistic state) is implemented in:
  - `useBalance()` queryFn: if `${employeeId}:${locationId}` is in-flight, return cached value.
  - Source: `src/features/time-off/employee/hooks/useBalance.ts`.

---

## Real-world policy notes — overlapping requests (reference)

These came up during testing and are worth documenting because the “right” behavior depends on HR policy and system design.

### Edge case A — duplicate/overlapping request for the same leave type

- **Example**: two Sick Leave requests that overlap the same day/range.
- **Typical real-world behavior**: **blocked**. Most HR systems prevent overlapping time off entries in the same leave category because it double-books the employee and can cause incorrect deductions/payroll outcomes.
- **What this repo does**: **blocked** (returns `409 OVERLAPPING_REQUEST`) for overlaps within the same `(employeeId, locationId)` and non-denied requests.
- **Why**: avoids duplicate “pending” requests for the same period and prevents confusing balances / manager queue spam.

### Edge case B — same date across different leave types (Sick + Personal)

- **Example**: Sick Leave and Personal Leave both requested for `2026-04-28`.
- **Typical real-world behavior** (varies by company):
  - **Option 1 (strict)**: **blocked** — an employee can’t take two types of leave on the same day (unless partial-day is modeled explicitly).
  - **Option 2 (allowed with constraints)**: allowed only if the system supports **partial-day** allocations or “time segments”; otherwise it’s ambiguous.
  - **Option 3 (allowed)**: allowed, but payroll/benefits rules decide which category is primary (less common).
- **What this repo does**: **blocked** (returns `409 OVERLAPPING_REQUEST`) across leave types for the same employee. This is an intentional real-world hardening exception documented in `SCOPE_EXCEPTIONS.mdx`.
- **Why it matters**: many HCMs enforce “no double-booking” at the day level unless partial-day is modeled explicitly.

---

## Scenario 0 — Overlapping requests blocked (scope exceptions)

This repo intentionally blocks two overlap scenarios even though they are not explicitly required by `TRD.md`.
See `SCOPE_EXCEPTIONS.mdx` for the justification and scope guardrails.

### Scenario 0A — Duplicate/overlapping request within the same leave type

**Goal**: submitting Sick Leave twice for the same day/range is rejected with `OVERLAPPING_REQUEST`.

1. Open employee page: `http://localhost:3000/employee/e-100`
2. Submit a **Sick Leave** request for `2026-04-28 → 2026-04-28` (1 day).
3. Submit another **Sick Leave** request that overlaps that date (same day is enough).

**Expected**:
- Submission fails with a rollback notification.
- Message indicates an overlap (already have time off in this period).
- No duplicate request is created for the overlapping submission.

### Scenario 0B — Overlapping requests across different leave types (Sick + Personal/Casual)

**Goal**: submitting two different leave types on the same date is rejected with `OVERLAPPING_REQUEST`.

1. Open employee page: `http://localhost:3000/employee/e-100`
2. Submit a **Sick Leave** request for `2026-04-28 → 2026-04-28` (1 day).
3. Submit a **Personal Leave** request for `2026-04-28 → 2026-04-28` (1 day).

**Expected**:
- The second submission fails with a rollback notification.
- No second request is created for that same date.

---

## Scenario 1 — Submit request → HCM 200 → canonical re-read unchanged → rollback triggered (silent success)

**Goal**: verify that a “successful” submission still rolls back if the **canonical per-cell re-read** shows the balance didn’t actually move.

### UI steps

1. Open employee page: `http://localhost:3000/employee/e-100`
2. Pick any balance row (any location) and click **Request time off**.
3. In the modal:
   - Select a date range that requests **1 day** (or any small number within available).
   - Click **Submit request**.
4. Observe immediate optimistic behavior (submission/pending confirmation).
5. If this submission is a “silent success”:
   - You should see a **rollback** notification/banner indicating HCM did not record the deduction.
   - The balance should return to the pre-submit value (no permanent deduction).

### How to force it (recommended, deterministic)

This scenario is deterministic in automated tests via `simulate: "silent-success"` in the submit payload.
If you need to force it manually, the easiest way is:

- Repeat steps 1–3 a few times (silent success happens ~20% of the time).

---

## Scenario 2 — Submit request → HCM timeout → rollback triggered after ~8 seconds

**Goal**: verify the 8s timeout behavior and rollback UX.

### UI steps (manual)

This repo’s mock HCM timeout is triggered by request-body simulate flags (not exposed as a UI toggle).
To simulate via UI, use one of these approaches:

- **Approach A (recommended)**: run `pnpm test:unit` and watch `useSubmitRequest` timeout test coverage (deterministic).
- **Approach B (manual via DevTools)**: submit a request normally and throttle/blackhole `/api/mock/hcm/requests` in browser DevTools (Network tab → block request URL) for > 8s, then observe rollback.

### Expected result

- After ~8 seconds, the submission is treated as failed.
- The optimistic balance is rolled back to the snapshot.
- A rollback notification appears (timeout wording).

---

## Scenario 3 — Background poll fires during in-flight mutation → balance not overwritten

**Goal**: while a submit mutation is in-flight, background refresh must not overwrite the optimistic cache value.

### UI steps

1. Open employee page: `http://localhost:3000/employee/e-100`
2. Click **Request time off** for any balance row.
3. Submit a request for a few days so the optimistic change is obvious.
4. While the request is in-flight (status shows “Submitting…” / pending confirmation), wait for a background refresh to occur.
   - `useBalances()` polls every **30 seconds**.
5. Observe:
   - The balance **does not jump back** to the pre-submit value while the mutation is in-flight.

### Expected result

- The optimistic numbers remain stable until the mutation settles.
- Only after settle/invalidation does the UI reconcile.

---

## Scenario 4 — Background poll returns higher balance (no in-flight) → toast dispatched

**Goal**: simulate an out-of-band balance increase (anniversary bonus) and confirm the “balance refreshed up” toast.

### UI steps

1. Open employee page: `http://localhost:3000/employee/e-100`
2. Note a specific location row’s current available days.
3. Trigger an anniversary bonus (out-of-band update) in another tab using the endpoint below.
4. Return to the employee page and wait for:
   - Either the next background refresh, or manually refresh the relevant cell via the UI’s refresh affordance (if present).

### Trigger (out-of-band bonus)

Send:

- `POST http://localhost:3000/api/mock/hcm/trigger-anniversary`
- JSON body:

```json
{ "employeeId": "e-100", "locationId": "<the-locationId-from-the-row>", "bonusDays": 2 }
```

### Expected result

- The balance increases.
- A toast/notification is shown indicating the balance was updated upward.

---

## Scenario 5 — Manager approve → 409 BALANCE_CHANGED → conflict modal triggered

**Goal**: manager attempts approval, but HCM reports the balance is no longer sufficient/valid; UI must surface a conflict.

### UI steps

1. Create a pending request:
   - Employee: `http://localhost:3000/employee/e-100`
   - Submit a request that results in a manager-pending item.
2. Open manager approvals: `http://localhost:3000/manager/m-100`
3. Open the pending request and click **Approve**.

### How to force a BALANCE_CHANGED conflict

In this mock HCM, `BALANCE_CHANGED` happens if the manager approves but the reserved days for the request are missing.

**Deterministic (developer-only)**:

1. Set `.env.local`: `ENABLE_DEV_SCENARIOS=1`
2. Restart `pnpm dev`
3. Submit an annual request (creates pending-manager + reserves days in `pending`)
4. In DevTools Console, drop the pending reservation:

```js
await fetch('/api/mock/hcm/adjust-balance', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    employeeId: 'e-100',
    locationId: 'loc-annual',
    pendingDelta: -999
  })
})
```

5. In manager view, click **Approve** → conflict modal should open.

### Expected result

- HCM responds with `409` and error `BALANCE_CHANGED`.
- The manager UI shows a conflict experience (modal/banner) rather than silently failing.

---

## Scenario 6 — Manager approve → fresh balance < request.days → approval blocked in UI

**Goal**: manager should be blocked from approving if the live balance panel shows insufficient days.

### UI steps

1. Ensure there is a pending request that requests more days than currently available.
   - If the employee UI blocks submitting (insufficient balance), create the mismatch by changing the balance after the request is pending:
     - Submit a valid pending request first.
     - Then consume/reduce the same balance using additional requests so that the remaining balance becomes insufficient.
2. Open manager approvals: `http://localhost:3000/manager/m-100`
3. Open the request.

### Expected result

- The UI indicates insufficiency and the **Approve** action is disabled/blocked.

---

## Automated test status

To confirm everything is passing:

```bash
pnpm test
```

Expected output includes:
- `Test Files  27 passed`
- `Tests  137 passed`

