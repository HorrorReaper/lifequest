import { AdminTestingTools } from '@/components/dev/AdminTestingTools'

export default function AdminToolsPage() {
  return <div className="mx-auto max-w-5xl space-y-6"><header><p className="text-sm font-medium text-muted-foreground">QA and diagnostics</p><h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Testing tools</h1><p className="mt-2 max-w-2xl text-muted-foreground">Exercise client state, animations, and important MVP routes without touching production data.</p></header><AdminTestingTools /></div>
}
