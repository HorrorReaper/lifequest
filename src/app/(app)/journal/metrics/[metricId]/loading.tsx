export default function MetricLoading() {
  return (
    <main className="min-h-svh bg-background p-4 pb-24 sm:p-8" aria-busy="true">
      <div className="mx-auto max-w-3xl animate-pulse space-y-6">
        <div className="h-10 w-24 rounded-xl bg-muted" />
        <div className="space-y-2">
          <div className="h-8 w-40 rounded-lg bg-muted" />
          <div className="h-4 w-28 rounded bg-muted" />
        </div>
        <div className="h-44 rounded-xl bg-muted" />
        <div className="h-72 rounded-xl bg-muted" />
        <div className="h-56 rounded-xl bg-muted" />
        <span className="sr-only">Loading metric</span>
      </div>
    </main>
  )
}
