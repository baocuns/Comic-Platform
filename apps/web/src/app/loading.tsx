export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 space-y-6">
      <div className="h-64 animate-pulse rounded-3xl bg-[var(--bg-subtle)]" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-[var(--bg-subtle)]" />
        ))}
      </div>
    </div>
  );
}
