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

      if (error) {
        console.error('Failed to fetch prompts', error)
        return
      }

      if (mounted && data && data.length > 0) {
        const random = data[Math.floor(Math.random() * data.length)]
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
