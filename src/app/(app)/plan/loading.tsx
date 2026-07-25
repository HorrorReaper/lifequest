export default function TodayPlanLoading() {
  return (
    <main className="min-h-svh bg-background">
      <header className="border-b px-4 py-4 sm:px-8">
        <div className="mx-auto h-10 max-w-5xl animate-pulse rounded-xl bg-muted" />
      </header>
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-8 sm:px-8">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-10 w-72 max-w-full animate-pulse rounded-xl bg-muted" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded bg-muted" />
        <div className="grid gap-4 pt-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="h-72 animate-pulse rounded-3xl border bg-muted/45" />
          <div className="h-72 animate-pulse rounded-3xl border bg-muted/45" />
        </div>
      </div>
    </main>
  );
}
