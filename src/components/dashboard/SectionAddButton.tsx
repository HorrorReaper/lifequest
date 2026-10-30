import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

type SectionAddButtonProps = {
  /** Read by screen readers and shown as the tooltip, e.g. "Add habit". */
  label: string
} & ({ onClick: () => void; href?: never } | { href: string; onClick?: never })

const CLASS_NAME = 'size-8 shrink-0 rounded-full bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary'

/**
 * The one way to add something from a dashboard section: a small round "+"
 * at the right of the section's header. It opens the section's create dialog
 * (`onClick`) or, where creating happens on a page of its own, goes there
 * (`href`). Being a button or link, a click on it never also opens the
 * section's page (see ClickableSection).
 */
export function SectionAddButton({ label, onClick, href }: SectionAddButtonProps) {
  if (href !== undefined) {
    return (
      <Button asChild variant="ghost" size="icon-sm" className={CLASS_NAME}>
        <Link href={href} aria-label={label} title={label}>
          <Plus className="size-4" />
        </Link>
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={CLASS_NAME}
    >
      <Plus className="size-4" />
    </Button>
  )
}
