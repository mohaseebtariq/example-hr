'use client';

type LoadingSkeletonProps = {
  rows?: number;
};

export function LoadingSkeleton({ rows = 3 }: LoadingSkeletonProps) {
  return (
    <div role="status" aria-label="Loading" className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="animate-pulse flex items-center justify-between gap-4 rounded-lg bg-gray-50 p-4"
        >
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 rounded bg-gray-200" />
            <div className="h-8 w-1/4 rounded bg-gray-200" />
          </div>
          <div className="h-9 w-24 rounded bg-gray-200" />
        </div>
      ))}
      <span className="sr-only">Loading balances…</span>
    </div>
  );
}
