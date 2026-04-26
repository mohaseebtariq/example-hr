'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p className="font-semibold">Employee view crashed.</p>
        <p className="mt-1 text-red-700">{error.message}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-3 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

