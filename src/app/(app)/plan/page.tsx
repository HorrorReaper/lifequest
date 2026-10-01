import { TodayPlanScreen } from '@/components/planning/TodayPlanScreen'

export default async function TodayPlanPage({ searchParams }: {
  searchParams?: Promise<{ step?: string }>
}) {
  const requestedStep = searchParams ? (await searchParams).step : undefined
  return <TodayPlanScreen requestedStep={requestedStep} />
}
