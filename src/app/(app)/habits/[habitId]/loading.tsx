export default function HabitAnalyticsLoading() {
  return (
    <main className="min-h-svh bg-background px-4 pb-24 pt-4 sm:px-8 sm:pt-8">
      <div className="mx-auto max-w-3xl animate-pulse space-y-5">
        <div className="h-10 w-24 rounded-xl bg-muted" />
        <div className="flex items-center gap-3">
          <div className="size-14 rounded-2xl bg-muted" />
          <div className="space-y-2">
            <div className="h-7 w-44 rounded-lg bg-muted" />
            <div className="h-4 w-32 rounded bg-muted" />
          </div>
        </div>
        <div className="h-14 rounded-2xl bg-muted" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-28 rounded-xl bg-muted" />
          ))}
        </div>
        <div className="h-72 rounded-xl bg-muted" />
      </div>
    </main>
  )
}
