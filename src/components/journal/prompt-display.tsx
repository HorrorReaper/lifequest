'use client'

import { usePrompt } from './usePrompt'

interface PromptDisplayProps {
  category?: string
}

export function PromptDisplay({ category }: PromptDisplayProps) {
  const prompt = usePrompt(category)

  if (!prompt) return null

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
      <p className="text-sm italic text-muted-foreground">💡 Prompt</p>
      <p className="mt-1 text-sm font-medium">{prompt}</p>
    </div>
  )
}
