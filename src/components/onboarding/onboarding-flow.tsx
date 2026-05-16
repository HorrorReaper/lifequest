// src/components/onboarding/onboarding-flow.tsx

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { supabaseUpdateWhere } from '@/lib/supabase/helpers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

interface Template {
  id: string
  name: string
  description: string | null
  icon: string
  entry_type: string
  xp_reward: number
}

interface OnboardingFlowProps {
  userId: string
  currentName: string
  templates: Template[]
}

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
  'Pacific/Auckland',
  'UTC',
]

export function OnboardingFlow({
  userId,
  currentName,
  templates,
}: OnboardingFlowProps) {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState(0)
  const [name, setName] = useState(currentName)
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  )
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const steps = [
    // Step 0: Welcome
    <motion.div
      key="welcome"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 text-center"
    >
      <div className="text-6xl">🏰</div>
      <h1 className="text-3xl font-bold">Welcome to LifeQuest</h1>
      <p className="text-muted-foreground max-w-md mx-auto">
        You&apos;re about to start a journaling journey. Write daily, earn XP,
        maintain streaks, and watch your virtual city grow from a campfire to a
        capital.
      </p>
      <Button size="lg" onClick={() => setStep(1)}>
        Let&apos;s Begin →
      </Button>
    </motion.div>,

    // Step 1: Name & Timezone
    <motion.div
      key="profile"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 w-full max-w-sm"
    >
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">About You</h2>
        <p className="text-muted-foreground text-sm">
          What should we call you?
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Your Name</Label>
          <Input
            id="name"
            placeholder="Alex"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="timezone">Timezone</Label>
          <select
            id="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setStep(0)}>
          ←
        </Button>
        <Button className="flex-1" onClick={() => setStep(2)} disabled={!name.trim()}>
          Continue →
        </Button>
      </div>
    </motion.div>,

    // Step 2: Pick First Template
    <motion.div
      key="template"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 w-full max-w-md"
    >
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Pick Your First Journal</h2>
        <p className="text-muted-foreground text-sm">
          You can always change this later or create your own.
        </p>
      </div>

      <div className="grid gap-3">
        {templates.map((template) => (
          <Card
            key={template.id}
            className={`cursor-pointer transition-all hover:border-primary/50 ${
              selectedTemplate === template.id
                ? 'border-primary ring-2 ring-primary/20'
                : 'border-border/50'
            }`}
            onClick={() => setSelectedTemplate(template.id)}
          >
            <CardContent className="flex items-center gap-4 p-4">
              <span className="text-3xl">{template.icon}</span>
              <div className="flex-1">
                <h3 className="font-semibold">{template.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {template.description}
                </p>
              </div>
              <span className="text-xs font-medium text-primary">
                +{template.xp_reward} XP
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setStep(1)}>
          ←
        </Button>
        <Button
          className="flex-1"
          onClick={handleComplete}
          disabled={!selectedTemplate || loading}
        >
          {loading ? 'Setting up...' : 'Start My Journey 🚀'}
        </Button>
      </div>
    </motion.div>,
  ]

  async function handleComplete() {
    if (!selectedTemplate) return
    setLoading(true)

    const { error } = await supabaseUpdateWhere(supabase, 'profiles', {
      username: name.trim(),
      timezone,
      onboarding_complete: true,
      updated_at: new Date().toISOString(),
    }, 'id', userId)

    if (error) {
      console.error('Onboarding error:', error)
      setLoading(false)
      return
    }

    // Navigate to first journal entry
    router.push(`/journal/new/${selectedTemplate}`)
  }

  return (
    <div className="flex flex-col items-center">
      {/* Progress dots */}
      <div className="flex gap-2 mb-8">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-2 w-2 rounded-full transition-colors ${
              i <= step ? 'bg-primary' : 'bg-muted'
            }`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">{steps[step]}</AnimatePresence>
    </div>
  )
}
