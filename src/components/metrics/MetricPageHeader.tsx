'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Settings } from 'lucide-react'
import { formatMetricValue, type Metric } from '@/lib/metrics'
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
  /** The page was opened right after creating the metric (`?created=1`). */
  created?: boolean
}

function targetText(metric: Metric) {
  if (metric.targetValue === null || metric.targetDirection === null) return 'No target'
  const direction = metric.targetDirection === 'at_least' ? 'at least' : 'at most'
  return `${direction} ${formatMetricValue(metric.targetValue, metric.unit)}`
}

/**
 * The back link, name and target, with the gear that opens the settings. It
 * owns the settings dialog, so the first-run hint can open it on the section
 * it asks about.
 */
export function MetricPageHeader({
  metric,
  backHref,
  templates,
  created = false,
}: MetricPageHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [focus, setFocus] = useState<'target' | 'journal' | undefined>(undefined)
  const [hintDismissed, setHintDismissed] = useState(false)

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
