'use client';

import { PendingApprovalsList } from '../PendingApprovalsList';

type ManagerShellProps = {
  managerId: string;
};

export function ManagerShell({ managerId }: ManagerShellProps) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-1">
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: 'var(--ink-1)', letterSpacing: '-0.02em' }}>
          Approvals
        </h1>
        <p style={{ fontSize: 13, color: 'var(--ink-2)' }}>Manager {managerId}</p>
      </header>

      <section aria-label="Pending approvals" className="flex flex-col gap-3">
        <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>
          Pending requests
        </h2>
        <PendingApprovalsList managerId={managerId} />
      </section>
    </div>
  );
}

