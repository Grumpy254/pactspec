'use client';

export default function AgentDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="text-center py-20">
      <h2 className="text-xl font-semibold text-red-400 mb-2">Something went wrong</h2>
      <p className="text-gray-500 text-sm mb-4">{error.message || 'An unexpected error occurred'}</p>
      <button
        onClick={reset}
        className="text-sm text-indigo-400 underline hover:text-indigo-300"
      >
        Try again
      </button>
    </div>
  );
}
