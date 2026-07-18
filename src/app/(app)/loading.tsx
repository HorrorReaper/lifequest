export default function AppLoading() {
  return (
    <div className="min-h-svh bg-background px-4 py-6 sm:px-8 sm:py-10" aria-busy="true" aria-label="Loading page">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="h-8 w-44 animate-pulse rounded-lg bg-muted" />
        <div className="h-32 animate-pulse rounded-2xl bg-muted/80" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-28 animate-pulse rounded-2xl bg-muted/65" />
          <div className="h-28 animate-pulse rounded-2xl bg-muted/65" />
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-muted/50" />
        <span className="sr-only">Loading LifeQuest</span>
      </div>
    </div>
  )
}
