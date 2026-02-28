export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center" role="status" aria-label="Loading">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-pink" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
