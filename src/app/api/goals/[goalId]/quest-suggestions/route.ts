import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Goal } from '@/lib/types'
import { isAdminUser } from '@/lib/admin'

interface QuestSuggestion {
  title: string
  description: string
  xp_reward: number
  coin_reward: number
}

interface ExistingQuestRow {
  title: string
  description: string | null
  is_completed: boolean
}

interface OpenRouterResponseBody {
  choices?: {
    message?: {
      content?: string
    }
  }[]
}

const questSuggestionSchema = {
  type: 'object',
  properties: {
    quests: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'A short, motivating quest title under 60 characters.',
          },
          description: {
            type: 'string',
            description: 'A concrete completion condition the user can verify.',
          },
          xp_reward: {
            type: 'integer',
            description: 'XP reward between 25 and 100.',
          },
          coin_reward: {
            type: 'integer',
            description: 'Coin reward between 10 and 50.',
          },
        },
        required: ['title', 'description', 'xp_reward', 'coin_reward'],
        additionalProperties: false,
      },
    },
  },
  required: ['quests'],
  additionalProperties: false,
}

function normalizeSuggestion(suggestion: QuestSuggestion): QuestSuggestion {
  return {
    title: suggestion.title.trim().slice(0, 80),
    description: suggestion.description.trim().slice(0, 240),
    xp_reward: Math.min(Math.max(Math.round(suggestion.xp_reward), 25), 100),
    coin_reward: Math.min(Math.max(Math.round(suggestion.coin_reward), 10), 50),
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ goalId: string }> }
) {
  const { goalId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OpenRouter is not configured yet. Add OPENROUTER_API_KEY to enable AI quest generation.' },
      { status: 503 }
    )
  }

  const { data: goalData, error: goalError } = await supabase
    .from('goals')
    .select('*')
    .eq('id', goalId)
    .eq('user_id', user.id)
    .single()

  if (goalError || !goalData) {
    return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
  }

  const goal = goalData as Goal

  const { data: existingQuestsData } = await supabase
    .from('quests')
    .select('title, description, is_completed')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(12)

  const existingQuestsRows = (existingQuestsData ?? []) as ExistingQuestRow[]
  const existingQuests = existingQuestsRows.map((quest) => ({
    title: quest.title,
    description: quest.description,
    is_completed: quest.is_completed,
  }))

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-OpenRouter-Title': 'LifeQuest',
    }

    const siteUrl = process.env.OPENROUTER_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL
    if (siteUrl) headers['HTTP-Referer'] = siteUrl

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You create motivational but concrete quests for LifeQuest, a gamified journaling and personal growth app. Keep suggestions practical, measurable, and achievable within 1-7 days. Do not provide medical, therapeutic, legal, or financial advice.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              task:
                'Generate exactly 3 custom quests that help the user make progress toward this goal. Avoid duplicating existing quests. Each quest must have a clear completion condition.',
              goal: {
                title: goal.title,
                why: goal.why,
                category: goal.category,
                target_date: goal.target_date,
              },
              existing_quests: existingQuests,
              reward_rules: {
                easy: { xp_reward: '25-40', coin_reward: '10-20' },
                medium: { xp_reward: '45-70', coin_reward: '20-35' },
                hard: { xp_reward: '75-100', coin_reward: '35-50' },
              },
            }),
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'goal_quest_suggestions',
            strict: true,
            schema: questSuggestionSchema,
          },
        },
      }),
    })

    if (!response.ok) {
      const message = await response.text()
      console.error('OpenRouter quest generation failed:', message)
      return NextResponse.json(
        { error: 'Could not generate quests right now.' },
        { status: 502 }
      )
    }

    const data = (await response.json()) as OpenRouterResponseBody
    const text = data.choices?.[0]?.message?.content ?? ''
    if (!text) throw new Error('OpenRouter returned an empty response.')

    const parsed = JSON.parse(text) as { quests: QuestSuggestion[] }
    const quests = parsed.quests.slice(0, 3).map(normalizeSuggestion)

    return NextResponse.json({ quests })
  } catch (error) {
    console.error('Quest suggestion error:', error)
    return NextResponse.json(
      { error: 'Could not generate quests right now.' },
      { status: 500 }
    )
  }
}
