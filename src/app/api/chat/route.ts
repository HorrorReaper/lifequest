import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type ChatRole = 'user' | 'assistant'

interface ChatMessage {
  role: ChatRole
  content: string
}

interface ChatRequestBody {
  messages?: unknown
}

interface OpenRouterResponseBody {
  choices?: {
    message?: {
      content?: string
    }
  }[]
}

function isChatRole(value: unknown): value is ChatRole {
  return value === 'user' || value === 'assistant'
}

function normalizeMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return []

  return value
    .filter((message): message is { role: ChatRole; content: string } => {
      if (!message || typeof message !== 'object') return false
      const candidate = message as { role?: unknown; content?: unknown }
      return isChatRole(candidate.role) && typeof candidate.content === 'string'
    })
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 1200),
    }))
    .filter((message) => message.content.length > 0)
    .slice(-10)
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI chat is not configured yet. Add OPENROUTER_API_KEY to enable it.' },
      { status: 503 }
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as ChatRequestBody
  const messages = normalizeMessages(body.messages)
  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')

  if (!lastUserMessage) {
    return NextResponse.json({ error: 'Send a message first.' }, { status: 400 })
  }

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
              'You are the LifeQuest assistant inside a gamified journaling and personal growth app. Help users with journaling, habits, tasks, goals, quests, lessons, and daily planning. Be concise, practical, warm, and action-oriented. Do not give medical, legal, financial, or crisis advice; encourage professional support for high-stakes issues.',
          },
          ...messages,
        ],
        temperature: 0.6,
        max_tokens: 420,
      }),
    })

    if (!response.ok) {
      const message = await response.text()
      console.error('OpenRouter chat failed:', message)
      return NextResponse.json(
        { error: 'The assistant is unavailable right now.' },
        { status: 502 }
      )
    }

    const data = (await response.json()) as OpenRouterResponseBody
    const reply = data.choices?.[0]?.message?.content?.trim()

    if (!reply) {
      return NextResponse.json(
        { error: 'The assistant returned an empty response.' },
        { status: 502 }
      )
    }

    return NextResponse.json({ reply })
  } catch (error) {
    console.error('Chat route error:', error)
    return NextResponse.json(
      { error: 'The assistant is unavailable right now.' },
      { status: 500 }
    )
  }
}
