import { TodayPlanScreen } from '@/components/planning/TodayPlanScreen'
import { getWorkContext } from '@/lib/work/context'

export default async function WorkPlanPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  await getWorkContext()
  const { step } = await searchParams
  return <TodayPlanScreen requestedStep={step} embedded returnHref="/admin/work" />
}
