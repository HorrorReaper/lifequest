'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Settings } from 'lucide-react'
import {
  formatMetricDay,
  formatMetricValue,
  metTarget,
  type LatestValue,
  type Metric,
} from '@/lib/metrics'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MetricCreatedHint } from '@/components/metrics/MetricCreatedHint'
import {
  MetricSettingsDialog,
  type MetricTemplateOption,
} from '@/components/metrics/MetricSettingsDialog'

interface MetricPageHeaderProps {
  metric: Metric
  backHref: '/dashboard' | '/journal/metrics'
  /** The templates the settings offer for the journal link. */
  templates: MetricTemplateOption[]
  /** The newest value overall, which may be older than the page's history window. */
  latest: LatestValue | null
  /** The page was opened right after creating the metric (`?created=1`). */
  created?: boolean
}

function targetText(metric: Metric) {
  if (metric.targetValue === null || metric.targetDirection === null) return 'No target'
  const direction = metric.targetDirection === 'at_least' ? 'at least' : 'at most'
  return `${direction} ${formatMetricValue(metric.targetValue, metric.unit)}`
}

/**
 * The back link, name and target, the latest value with its day and whether
 * it meets the target, and the archived-template hint, with the gear that opens the settings. It
 * owns the settings dialog, so the first-run hint can open it on the section
 * it asks about.
 */
export function MetricPageHeader({
  metric,
  backHref,
  templates,
  latest,
  created = false,
}: MetricPageHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [focus, setFocus] = useState<'target' | 'journal' | undefined>(undefined)
  const [hintDismissed, setHintDismissed] = useState(false)
  const judged =
    latest && metric.targetValue !== null && metric.targetDirection !== null
      ? metTarget(latest.value, metric.targetValue, metric.targetDirection)
      : null

  function openSettings(section?: 'target' | 'journal') {
    setFocus(section)
    setSettingsOpen(true)
  }

  // Drops `created` from the URL so a reload does not show the hint again;
  // `from=home` is kept, since the back link depends on it.
  function dismissHint() {
    setHintDismissed(true)
    router.replace(backHref === '/dashboard' ? `${pathname}?from=home` : pathname)
  }

  return (
    <header className="space-y-4">
      <div>
        <Link
          href={backHref}
          className="mb-4 inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {backHref === '/dashboard' ? '‹ Home' : '‹ Metrics'}
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{metric.name}</h1>
            <p className="text-sm text-muted-foreground">{targetText(metric)}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Metric settings"
            onClick={() => openSettings()}
          >
            <Settings className="size-5" />
          </Button>
        </div>
      </div>

      {latest ? (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-4xl font-semibold tabular-nums">
            {formatMetricValue(latest.value, metric.unit)}
          </p>
          <p className="text-sm text-muted-foreground">{formatMetricDay(latest.date)}</p>
          {judged !== null && (
            <Badge variant={judged ? 'default' : 'secondary'}>
              {judged ? 'On target' : 'Off target'}
            </Badge>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No value yet</p>
      )}

      {metric.templateArchived && (
        <div className="flex items-center justify-between gap-3 text-sm">
          <p className="text-muted-foreground">Asked in {metric.templateName} (archived)</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => openSettings('journal')}>
            Change template
          </Button>
        </div>
      )}

      {created && !hintDismissed && (
        <MetricCreatedHint
          onSetTarget={() => openSettings('target')}
          onAskInJournal={() => openSettings('journal')}
          onDismiss={dismissHint}
        />
      )}

      <MetricSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        metric={metric}
        templates={templates}
        focus={focus}
      />
    </header>
  )
}
