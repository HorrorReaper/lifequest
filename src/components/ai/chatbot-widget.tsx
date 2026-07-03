'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BotMessageSquare, Loader2, MessageCircle, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ChatRole = 'user' | 'assistant'

interface ChatMessage {
  id: string
  role: ChatRole
  content: string
}

interface ChatResponse {
  reply?: string
  error?: string
}

const INITIAL_MESSAGE: ChatMessage = {
  id: 'assistant-welcome',
  role: 'assistant',
  content: 'Hey, I am your LifeQuest assistant. Ask me for help with habits, tasks, goals, quests, lessons, or today\'s plan.',
}

function createMessage(role: ChatRole, content: string): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    content,
  }
}

export function ChatbotWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, open, loading])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    const userMessage = createMessage('user', text)
    const nextMessages = [...messages, userMessage]

    setMessages(nextMessages)
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      })

      const data = (await response.json()) as ChatResponse

      if (!response.ok || !data.reply) {
        throw new Error(data.error ?? 'The assistant could not reply right now.')
      }

      setMessages((prev) => [...prev, createMessage('assistant', data.reply as string)])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The assistant could not reply right now.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-20 right-4 z-[70] sm:bottom-6">
      <AnimatePresence>
        {open && (
          <motion.div
            key="chatbot-panel"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            className="mb-3 flex h-[min(540px,calc(100svh-8rem))] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl"
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <BotMessageSquare className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">LifeQuest Assistant</p>
                  <p className="text-[11px] text-muted-foreground">Quick guidance for your next move</p>
                </div>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Close chat">
                <X className="size-4" />
              </Button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex',
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    )}
                  >
                    {message.content}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    Thinking
                  </div>
                </div>
              )}

              {error && (
                <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              )}

              <div ref={scrollRef} />
            </div>

            <form onSubmit={handleSubmit} className="border-t p-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      event.currentTarget.form?.requestSubmit()
                    }
                  }}
                  rows={1}
                  maxLength={600}
                  placeholder="Ask for a plan, habit idea, or next step..."
                  className="max-h-24 min-h-9 flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
                <Button type="submit" size="icon-lg" disabled={!input.trim() || loading} aria-label="Send message">
                  {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        size="icon-lg"
        className="size-12 rounded-full shadow-xl"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Close assistant' : 'Open assistant'}
      >
        {open ? <X className="size-5" /> : <MessageCircle className="size-5" />}
      </Button>
    </div>
  )
}
