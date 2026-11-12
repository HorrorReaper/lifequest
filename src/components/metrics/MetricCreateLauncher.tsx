'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { MetricCreateDialog } from '@/components/metrics/MetricCreateDialog'
import { MetricEmptyState } from '@/components/metrics/MetricEmptyState'

interface MetricCreateLauncherProps {
  userId: string
  /** Opens the create dialog on mount; set by `/journal/metrics?new=1` (the + menu). */
  initiallyOpen: boolean
  /** `button` is the "+ New" in the page header, `empty` the first-run placeholder. */
  variant: 'button' | 'empty'
}

/** Drops `?new=1` once the dialog closes, so a reload does not reopen it. */
function clearNewParam() {
  const url = new URL(window.location.href)
  if (!url.searchParams.has('new')) return
  url.searchParams.delete('new')
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
}

/** The ways into `MetricCreateDialog` from the metrics list page. */
export function MetricCreateLauncher({ userId, initiallyOpen, variant }: MetricCreateLauncherProps) {
  const [open, setOpen] = useState(initiallyOpen)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) clearNewParam()
  }

  return (
    <>
      {variant === 'empty' ? (
        <MetricEmptyState onCreate={() => setOpen(true)} />
      ) : (
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          + New
        </Button>
      )}
      <MetricCreateDialog open={open} onOpenChange={handleOpenChange} userId={userId} />
    </>
  )
}
