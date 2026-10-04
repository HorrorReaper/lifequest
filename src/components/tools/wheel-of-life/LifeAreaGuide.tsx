import { ChevronDown } from 'lucide-react'
import type { LifeAreaInfo } from './wheel-of-life'

/**
 * What a life area covers, questions to rate it honestly, and what the scale
 * means for it. Collapsed by default so the five areas stay scannable; open
 * it when unsure which number fits.
 */
export function LifeAreaGuide({ area }: { area: LifeAreaInfo }) {
  return (
    <details className="group rounded-xl bg-muted/40 text-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
        What counts as {area.label.toLowerCase()}?
        <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="space-y-3 px-3 pb-3">
        <p className="leading-relaxed">{area.description}</p>
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Ask yourself</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 leading-relaxed">
            {area.questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </div>
        <dl className="grid gap-1.5 text-xs leading-relaxed">
          {(
            [
              ['1–3', area.anchors.low],
              ['4–7', area.anchors.mid],
              ['8–10', area.anchors.high],
            ] as const
          ).map(([range, text]) => (
            <div key={range} className="grid grid-cols-[3rem_1fr] gap-2">
              <dt className="font-semibold tabular-nums">{range}</dt>
              <dd className="text-muted-foreground">{text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
  )
}
