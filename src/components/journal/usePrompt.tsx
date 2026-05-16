'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function usePrompt(category?: string) {
  const [prompt, setPrompt] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function fetchPrompt() {
      const supabase = createClient()

      let query = supabase
        .from('journal_prompts')
        .select('prompt_text')
        .eq('is_active', true)

      if (category) {
        query = query.eq('category', category)
      }

      const { data, error } = await query
      const prompts = data as { prompt_text: string }[] | null

      if (error) {
        console.error('Failed to fetch prompts', error)
        return
      }

      if (mounted && prompts && prompts.length > 0) {
        const random = prompts[Math.floor(Math.random() * prompts.length)]
        setPrompt(random.prompt_text)
      }
    }

    fetchPrompt()

    return () => {
      mounted = false
    }
  }, [category])

  return prompt
}
