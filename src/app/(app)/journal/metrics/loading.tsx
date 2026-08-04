export default function JournalMetricsLoading() {
  return (
    <main className="min-h-svh bg-background p-4 pb-24 sm:p-8" aria-busy="true">
      <div className="mx-auto max-w-3xl animate-pulse space-y-6">
        <div className="h-10 w-24 rounded-xl bg-muted" />
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-2xl bg-muted" />
          <div className="space-y-2">
            <div className="h-7 w-32 rounded-lg bg-muted" />
            <div className="h-4 w-56 rounded bg-muted" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-64 rounded-xl bg-muted" />
          ))}
        </div>
        <span className="sr-only">Loading metrics</span>
      </div>
    </main>
  )
}
