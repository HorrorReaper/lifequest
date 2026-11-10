'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  validateLearningBlocks,
  type ConceptExercise,
  type LearningContentBlock,
  type LearningPerspective,
} from '@/lib/learning-paths'

function BlockEditor({
  blocks,
  onChange,
}: {
  blocks: LearningContentBlock[]
  onChange: (blocks: LearningContentBlock[]) => void
}) {
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => (
        <div key={i} className="space-y-3 rounded-xl border p-3">
          <Label>
            Block type
            <select
              className="mt-1 h-11 w-full rounded-lg border bg-background px-3"
              value={block.type}
              onChange={(e) =>
                onChange(
                  blocks.map((b, index) =>
                    index === i
                      ? {
                          ...b,
                          type: e.target.value as LearningContentBlock['type'],
                        }
                      : b,
                  ),
                )
              }
            >
              <option value="sequence">Sequence</option>
              <option value="comparison">Comparison</option>
              <option value="callout">Callout</option>
            </select>
          </Label>
          {block.items.map((item, j) => (
            <div key={j} className="space-y-2">
              <Label>
                Item {j + 1} title
                <Input
                  value={item.title}
                  onChange={(e) =>
                    onChange(
                      blocks.map((b, index) =>
                        index === i
                          ? {
                              ...b,
                              items: b.items.map((entry, k) =>
                                k === j
                                  ? { ...entry, title: e.target.value }
                                  : entry,
                              ),
                            }
                          : b,
                      ),
                    )
                  }
                />
              </Label>
              <Label>
                Explanation
                <Textarea
                  value={item.body}
                  onChange={(e) =>
                    onChange(
                      blocks.map((b, index) =>
                        index === i
                          ? {
                              ...b,
                              items: b.items.map((entry, k) =>
                                k === j
                                  ? { ...entry, body: e.target.value }
                                  : entry,
                              ),
                            }
                          : b,
                      ),
                    )
                  }
                />
              </Label>
              {block.items.length > 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    onChange(
                      blocks.map((b, index) =>
                        index === i
                          ? { ...b, items: b.items.filter((_, k) => k !== j) }
                          : b,
                      ),
                    )
                  }
                >
                  Remove item
                </Button>
              )}
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={block.items.length >= 6}
              onClick={() =>
                onChange(
                  blocks.map((b, index) =>
                    index === i
                      ? {
                          ...b,
                          items: [
                            ...b.items,
                            { title: 'New step', body: 'Explain this step.' },
                          ],
                        }
                      : b,
                  ),
                )
              }
            >
              Add item
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange(blocks.filter((_, index) => index !== i))}
            >
              Remove block
            </Button>
          </div>
        </div>
      ))}
      <Button
        size="sm"
        variant="outline"
        disabled={blocks.length >= 8}
        onClick={() =>
          onChange([
            ...blocks,
            {
              type: 'sequence',
              items: [{ title: 'First step', body: 'Explain the step.' }],
            },
          ])
        }
      >
        Add visual block
      </Button>
    </div>
  )
}

export function LearningConceptDialog({
  exercise,
  onChange,
}: {
  exercise: ConceptExercise
  onChange: (exercise: ConceptExercise) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(exercise)
  const [error, setError] = useState<string | null>(null)
  function updatePerspective(
    key: LearningPerspective,
    value: { body: string; blocks?: LearningContentBlock[] },
  ) {
    setDraft((current) => ({
      ...current,
      perspectives: {
        product: current.perspectives?.product ?? {
          body: 'Describe the product case.',
        },
        company: current.perspectives?.company ?? {
          body: 'Describe the company case.',
        },
        [key]: value,
      },
    }))
  }
  function apply() {
    if (
      (draft.blocks && !validateLearningBlocks(draft.blocks)) ||
      (draft.perspectives &&
        Object.values(draft.perspectives).some(
          (p) =>
            !p.body.trim() || (p.blocks && !validateLearningBlocks(p.blocks)),
        ))
    ) {
      setError(
        'Add a title and explanation to every item and text to both perspectives.',
      )
      return
    }
    onChange(draft)
    setOpen(false)
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (value) {
          setDraft(structuredClone(exercise))
          setError(null)
        }
        setOpen(value)
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Visuals & perspectives
      </DialogTrigger>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Visual explanations & practice cases</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <BlockEditor
            blocks={draft.blocks ?? []}
            onChange={(blocks) =>
              setDraft((current) => ({ ...current, blocks }))
            }
          />
          {(['product', 'company'] as const).map((key) => (
            <section key={key} className="space-y-3 border-t pt-4">
              <h3 className="font-medium">
                {key === 'product' ? 'Own product' : 'Improve a company'}
              </h3>
              <Label>
                Case explanation
                <Textarea
                  value={draft.perspectives?.[key].body ?? ''}
                  onChange={(e) =>
                    updatePerspective(key, {
                      ...draft.perspectives?.[key],
                      body: e.target.value,
                    })
                  }
                />
              </Label>
              <BlockEditor
                blocks={draft.perspectives?.[key].blocks ?? []}
                onChange={(blocks) =>
                  updatePerspective(key, {
                    body: draft.perspectives?.[key].body ?? '',
                    blocks,
                  })
                }
              />
            </section>
          ))}
          {draft.perspectives && (
            <Button
              variant="ghost"
              onClick={() =>
                setDraft((current) => ({ ...current, perspectives: undefined }))
              }
            >
              Remove perspectives
            </Button>
          )}
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={apply}>Apply</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
