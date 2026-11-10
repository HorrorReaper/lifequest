'use client'

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AdminRangeNav } from '@/components/admin/AdminRangeNav'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  LANDING_DIMENSIONS,
  formatRate,
  landingFunnel,
  rate,
  sumLandingDays,
  type LandingBreakdown,
  type LandingDay,
  type LandingDimension,
} from '@/lib/landing-analytics'
import type { SignupRange } from '@/lib/signup-analytics'

interface LandingTrafficProps {
  range: SignupRange
  /** One point per day of the range, zero-filled (buildLandingSeries). */
  daily: LandingDay[]
  breakdown: LandingBreakdown
  /** Why there are no numbers to show, or null when there are. */
  unavailable: 'untrusted' | 'error' | null
}

/**
 * Slots 1 and 2 of the dataviz reference palette, the same pair (and dark
 * steps) the signup chart above uses. Numbers are always in text beside the
 * marks, so no reading depends on telling the two colours apart.
 */
const SERIES = [
  { key: 'visitors', label: 'Visitors', color: 'var(--series-visitors)' },
  { key: 'pageviews', label: 'Page views', color: 'var(--series-pageviews)' },
] as const

const DIMENSION_LABELS: Record<LandingDimension, string> = {
  referrer: 'Referrers',
  utm_source: 'UTM sources',
  utm_campaign: 'Campaigns',
  device: 'Devices',
  cta: 'CTAs',
}

function formatDay(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function Stat({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div role="group" aria-label={label} className="rounded-xl bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">{value}</p>
      {note && <p className="text-xs text-muted-foreground tabular-nums">{note}</p>}
    </div>
  )
}

/** A labelled horizontal bar: label and numbers in text, the bar for scale. */
function BarRow({ label, share, value }: { label: string; share: number | null; value: string }) {
  return (
    <li className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate" title={label}>
          {label}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div
          className="h-2 rounded-full"
          style={{ width: `${Math.round((share ?? 0) * 100)}%`, background: 'var(--series-visitors)' }}
        />
      </div>
    </li>
  )
}

export function LandingTraffic({ range, daily, breakdown, unavailable }: LandingTrafficProps) {
  const totals = sumLandingDays(daily)
  const funnel = landingFunnel(totals)
  const chartData = daily.map((day) => ({ ...day, dayLabel: formatDay(day.date) }))
  const empty = totals.pageviews === 0 && totals.ctaClicks === 0 && totals.signups === 0

  return (
    <Card className="[--series-pageviews:#eb6834] [--series-visitors:#2a78d6] dark:[--series-pageviews:#d95926] dark:[--series-visitors:#3987e5]">
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">Landing page traffic</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Anonymous visits to the landing page and how many go on to the waitlist (UTC days).
          </p>
        </div>
        <AdminRangeNav range={range} label="Landing traffic range" />
      </CardHeader>

      <CardContent className="space-y-6">
        {unavailable === 'untrusted' ? (
          <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
            Traffic numbers need <code>app_metadata.role = admin</code> on your Supabase account, like
            the signup numbers.
          </p>
        ) : unavailable === 'error' ? (
          <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
            Could not load traffic numbers. If this is a new environment, apply{' '}
            <code>supabase/migrations/20261110120000_landing_page_traffic.sql</code> in the Supabase SQL
            editor.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Visitors" value={totals.visitors} note="unique per day" />
              <Stat label="Page views" value={totals.pageviews} />
              <Stat
                label="CTA clicks"
                value={totals.ctaClicks}
                note={`${formatRate(rate(totals.ctaVisitors, totals.visitors))} of visitors`}
              />
              <Stat
                label="Waitlist signups"
                value={totals.signups}
                note={`${formatRate(rate(totals.signups, totals.visitors))} of visitors`}
              />
            </div>

            {empty ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No landing page visits in this range yet.</p>
            ) : (
              <>
                <div>
                  <div className="mb-2 flex gap-4 text-xs text-muted-foreground">
                    {SERIES.map((series) => (
                      <span key={series.key} className="flex items-center gap-2">
                        <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ background: series.color }} />
                        {series.label}
                      </span>
                    ))}
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="opacity-30" />
                      <XAxis dataKey="dayLabel" tick={{ fontSize: 12 }} interval="preserveStartEnd" minTickGap={24} />
                      <YAxis tick={{ fontSize: 12 }} width={36} allowDecimals={false} />
                      <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ''} />
                      {SERIES.map((series) => (
                        <Line
                          key={series.key}
                          type="monotone"
                          dataKey={series.key}
                          name={series.label}
                          stroke={series.color}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 5 }}
                          isAnimationActive={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <section aria-labelledby="landing-funnel-title" className="space-y-3">
                    <h3 id="landing-funnel-title" className="text-sm font-medium">
                      Visit → waitlist
                    </h3>
                    <ol className="space-y-3 text-sm">
                      {funnel.map((step) => (
                        <BarRow
                          key={step.key}
                          label={step.label}
                          share={step.ofVisitors}
                          value={`${step.value} · ${formatRate(step.ofVisitors)}`}
                        />
                      ))}
                    </ol>
                    <p className="text-xs text-muted-foreground">
                      Counted per day: someone who visits on Monday and signs up on Tuesday is a visitor on
                      both days.
                    </p>
                  </section>

                  <section aria-label="Traffic breakdown" className="min-w-0 space-y-3">
                    <Tabs defaultValue="referrer">
                      <TabsList className="w-full overflow-x-auto">
                        {LANDING_DIMENSIONS.map((dimension) => (
                          <TabsTrigger key={dimension} value={dimension} className="text-xs">
                            {DIMENSION_LABELS[dimension]}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                      {LANDING_DIMENSIONS.map((dimension) => (
                        <TabsContent key={dimension} value={dimension} className="pt-3">
                          {breakdown[dimension].length === 0 ? (
                            <p className="py-6 text-center text-sm text-muted-foreground">Nothing in this range.</p>
                          ) : (
                            <ul className="space-y-3 text-sm">
                              {breakdown[dimension].map((row) => (
                                <BarRow
                                  key={row.label}
                                  label={row.label}
                                  share={row.share}
                                  value={
                                    dimension === 'cta'
                                      ? `${row.events} clicks · ${row.visitors} visitors`
                                      : `${row.visitors} visitors · ${formatRate(row.share)}`
                                  }
                                />
                              ))}
                            </ul>
                          )}
                        </TabsContent>
                      ))}
                    </Tabs>
                  </section>
                </div>
              </>
            )}

            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Show as table</summary>
              <div className="mt-3 max-h-72 overflow-auto rounded-xl ring-1 ring-border">
                <table className="w-full text-left tabular-nums">
                  <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">Day (UTC)</th>
                      <th scope="col" className="px-3 py-2 font-medium">Visitors</th>
                      <th scope="col" className="px-3 py-2 font-medium">Page views</th>
                      <th scope="col" className="px-3 py-2 font-medium">CTA clicks</th>
                      <th scope="col" className="px-3 py-2 font-medium">Signups</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daily.map((day) => (
                      <tr key={day.date} className="border-t border-border">
                        <td className="px-3 py-1.5">{day.date}</td>
                        <td className="px-3 py-1.5">{day.visitors}</td>
                        <td className="px-3 py-1.5">{day.pageviews}</td>
                        <td className="px-3 py-1.5">{day.ctaClicks}</td>
                        <td className="px-3 py-1.5">{day.signups}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </CardContent>
    </Card>
  )
}
