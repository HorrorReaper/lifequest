import { WorkNavigation } from '@/components/admin/work/WorkNavigation'

export default function WorkLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-[92rem] space-y-6"><WorkNavigation />{children}</div>
}
