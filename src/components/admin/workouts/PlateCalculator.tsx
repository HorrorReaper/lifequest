'use client'

import { useMemo, useState } from 'react'
import { Calculator, Minus, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { calculatePlateBreakdown } from './workout-utils'

const plates = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5]

export function PlateCalculator({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [target, setTarget] = useState(100)
  const [bar, setBar] = useState(20)
  const result = useMemo(() => calculatePlateBreakdown(target, bar, plates), [bar, target])
  if (!open) return null

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="plate-calculator-title">
    <section className="max-h-[90dvh] w-full overflow-y-auto rounded-t-[2rem] bg-card p-5 shadow-2xl sm:max-w-lg sm:rounded-[2rem] sm:p-7">
      <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><Calculator /></span><div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">Metric loading</p><h2 id="plate-calculator-title" className="font-semibold">Barbell plate calculator</h2></div><Button size="icon" variant="ghost" onClick={onClose} aria-label="Close plate calculator"><X /></Button></div>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <label><span className="mb-1 block text-xs text-muted-foreground">Target weight</span><div className="flex items-center"><Input className="rounded-r-none font-mono" type="number" min={0} step={0.5} value={target} onChange={(event) => setTarget(Math.max(0, Number(event.target.value)))} /><span className="grid h-10 place-items-center rounded-r-md border border-l-0 bg-muted px-3 text-xs">kg</span></div></label>
        <label><span className="mb-1 block text-xs text-muted-foreground">Bar weight</span><div className="flex items-center"><Input className="rounded-r-none font-mono" type="number" min={0} step={0.5} value={bar} onChange={(event) => setBar(Math.max(0, Number(event.target.value)))} /><span className="grid h-10 place-items-center rounded-r-md border border-l-0 bg-muted px-3 text-xs">kg</span></div></label>
      </div>
      <div className="mt-4 flex gap-2 overflow-x-auto">
        <Button size="sm" variant="outline" onClick={() => setTarget((value) => Math.max(0, value - 2.5))}><Minus /> 2.5</Button>
        {[60, 80, 100, 120, 140].map((weight) => <Button key={weight} size="sm" variant={target === weight ? 'default' : 'outline'} onClick={() => setTarget(weight)}>{weight} kg</Button>)}
        <Button size="sm" variant="outline" onClick={() => setTarget((value) => value + 2.5)}><Plus /> 2.5</Button>
      </div>
      <div className="mt-6 rounded-2xl bg-muted/50 p-5">
        <p className="text-center text-xs text-muted-foreground">Load on each side</p>
        {result.platesPerSide.length ? <div className="mt-4 flex flex-wrap justify-center gap-2">{result.platesPerSide.map(({ weightKg, count }) => <span key={weightKg} className="grid min-h-16 min-w-16 place-items-center rounded-full border-4 border-primary/70 bg-card px-2 text-center font-mono text-sm font-semibold">{count > 1 ? `${count}×` : ''}{weightKg}</span>)}</div> : <p className="mt-4 text-center text-sm text-muted-foreground">Bar only</p>}
        <p className="mt-5 text-center font-mono text-2xl font-semibold">{result.loadableKg.toFixed(1)} kg</p>
        {result.remainderKg > 0.01 && <p className="mt-1 text-center text-xs text-amber-600">Closest load with these plates · {result.remainderKg.toFixed(2)} kg under target</p>}
      </div>
    </section>
  </div>
}
