import Link from 'next/link'
import { Wrench } from 'lucide-react'
import { TOOLBOX_ITEMS, type ToolboxItem } from '@/lib/tools/navigation'
import { CardRail } from './CardRail'

interface ToolGridProps {
  /** 'grid' fills the Toolbox page; 'rail' is the row on the Academy hub. */
  variant?: 'grid' | 'rail'
}

/**
 * Shared navigation for the Toolbox page and the Library rail.
 */
export function ToolGrid({ variant = 'grid' }: ToolGridProps) {
  if (variant === 'rail' && TOOLBOX_ITEMS.length > 0) {
    return (
      <CardRail
        title="Tools"
        count={TOOLBOX_ITEMS.length}
        description="Come back to these whenever you need them."
        itemClassName="w-[17rem] shrink-0 snap-start"
      >
        {TOOLBOX_ITEMS.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </CardRail>
    )
  }

  if (TOOLBOX_ITEMS.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed px-5 py-9 text-center">
        <Wrench className="mx-auto size-8 text-muted-foreground/60" />
        <p className="mt-3 text-sm font-medium">No tools yet</p>
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {TOOLBOX_ITEMS.map((tool) => (
        <ToolCard key={tool.id} tool={tool} />
      ))}
    </div>
  )
}

function ToolCard({ tool }: { tool: ToolboxItem }) {
  const Icon = tool.icon

  return (
    <Link
      href={`/learn/tools/${tool.id}`}
      className="flex h-full items-start gap-3 rounded-2xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{tool.title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
          {tool.description}
        </span>
      </span>
    </Link>
  )
}
