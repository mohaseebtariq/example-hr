'use client';

import { BalanceSummaryGrid } from '../BalanceSummaryGrid';
import { RequestModal } from '../RequestModal/RequestModal';
import { ActiveRequestsList } from '../ActiveRequestsList';

type EmployeeShellProps = {
  employeeId: string;
};

export function EmployeeShell({ employeeId }: EmployeeShellProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-1">
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: 'var(--ink-1)', letterSpacing: '-0.02em' }}>
          Time off
        </h1>
        <p style={{ fontSize: 13, color: 'var(--ink-2)' }}>Employee {employeeId}</p>
      </header>

      <section aria-label="Leave balances" className="flex flex-col gap-3">
        <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>
          Balances
        </h2>
        <BalanceSummaryGrid employeeId={employeeId} />
      </section>

      <section aria-label="My requests" className="flex flex-col gap-3">
        <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>
          My requests
        </h2>
        <ActiveRequestsList employeeId={employeeId} />
      </section>

      <RequestModal employeeId={employeeId} />
    </div>
  );
}

