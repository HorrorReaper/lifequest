'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Coins, Plus, Sparkles, Trophy, ScrollText, CheckCircle, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import {
  claimSystemQuest,
  completeCustomQuest,
  createCustomQuest,
  type DefaultQuestWithStatus,
  type CustomQuest,
} from '@/lib/quests'
import { useUserStore } from '@/lib/stores/user-store'
import { SystemQuestCard, CustomQuestCard } from '@/components/quests/QuestCard'

type Tab = 'achievements' | 'my-quests' | 'completed'

interface QuestCompletionReward {
  title: string
  xp: number
  coins: number
}

interface QuestDeleteQuery {
  eq(column: string, value: string): PromiseLike<{ error: unknown }>
}

interface QuestDeleteBuilder {
  delete(): QuestDeleteQuery
}

interface QuestDeleteClient {
  from(table: 'quests'): QuestDeleteBuilder
}

interface QuestPageClientProps {
  userId: string
  defaultQuests: DefaultQuestWithStatus[]
  initialCustomQuests: CustomQuest[]
}

function questDeleteClient(supabase: ReturnType<typeof createClient>): QuestDeleteClient {
  return supabase as unknown as QuestDeleteClient
}

function getDeleteErrorMessage(error: unknown): string {
  if (!error) return 'Could not delete this quest.'
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return 'Could not delete this quest.'
}

export function QuestPageClient({ userId, defaultQuests, initialCustomQuests }: QuestPageClientProps) {
  const supabase = createClient()
  const addXp = useUserStore((s) => s.addXp)
  const setCoins = useUserStore((s) => s.setCoins)

  const [tab, setTab] = useState<Tab>('achievements')
  const [systemQuests, setSystemQuests] = useState<DefaultQuestWithStatus[]>(defaultQuests)
  const [customQuests, setCustomQuests] = useState<CustomQuest[]>(initialCustomQuests)
  const [showForm, setShowForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formXp, setFormXp] = useState(50)
  const [formCoins, setFormCoins] = useState(20)
  const [creating, setCreating] = useState(false)
  const [completionReward, setCompletionReward] = useState<QuestCompletionReward | null>(null)

  const claimable = systemQuests.filter((q) => q.status === 'claimable')
  const locked = systemQuests.filter((q) => q.status === 'locked')
  const claimedSystem = systemQuests.filter((q) => q.status === 'claimed')
  const activeCustom = customQuests.filter((q) => !q.is_completed)
  const completedCustom = customQuests.filter((q) => q.is_completed)

  async function handleClaimSystem(quest: DefaultQuestWithStatus) {
    await claimSystemQuest(supabase, quest, {
      setCoins,
      addXp,
    })
    const completedAt = new Date().toISOString()
    setSystemQuests((prev) =>
      prev.map((q) =>
        q.key === quest.key
          ? { ...q, status: 'claimed', completedAt }
          : q
      )
    )
    setCompletionReward({
      title: quest.title,
      xp: quest.xp,
      coins: quest.coins,
    })
  }

  async function handleCompleteCustom(quest: CustomQuest) {
    await completeCustomQuest(supabase, quest, { setCoins, addXp })
    const completedAt = new Date().toISOString()
    setCustomQuests((prev) =>
      prev.map((q) =>
        q.id === quest.id
          ? { ...q, is_completed: true, completed_at: completedAt }
          : q
      )
    )
    setCompletionReward({
      title: quest.title,
      xp: quest.xp_reward,
      coins: quest.coin_reward,
    })
  }

  async function handleDeleteCustom(id: string) {
    const { error } = await questDeleteClient(supabase).from('quests').delete().eq('id', id)
    if (error) throw new Error(getDeleteErrorMessage(error))
    setCustomQuests((prev) => prev.filter((q) => q.id !== id))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!formTitle.trim()) return
    setCreating(true)
    try {
      const newQuest = await createCustomQuest(supabase, userId, {
        title: formTitle.trim(),
        description: formDesc.trim() || '',
        xp_reward: formXp,
        coin_reward: formCoins,
      })
      setCustomQuests((prev) => [newQuest, ...prev])
      setFormTitle('')
      setFormDesc('')
      setFormXp(50)
      setFormCoins(20)
      setShowForm(false)
    } finally {
      setCreating(false)
    }
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'achievements', label: 'Achievements', icon: <Trophy className="size-4" />, count: claimable.length || undefined },
    { id: 'my-quests', label: 'My Quests', icon: <ScrollText className="size-4" />, count: activeCustom.length || undefined },
    { id: 'completed', label: 'Completed', icon: <CheckCircle className="size-4" />, count: (claimedSystem.length + completedCustom.length) || undefined },
  ]

  return (
    <div className="space-y-5">
      <QuestCompletionAnimation
        reward={completionReward}
        onClose={() => setCompletionReward(null)}
        onViewCompleted={() => {
          setCompletionReward(null)
          setTab('completed')
        }}
      />

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-muted p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
              tab === t.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
            {t.count != null && (
              <span className="inline-flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Achievements tab */}
      {tab === 'achievements' && (
        <div className="space-y-5">
          {claimable.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Ready to Claim
              </p>
              <div className="space-y-2">
                {claimable.map((q) => (
                  <SystemQuestCard key={q.key} quest={q} onClaim={handleClaimSystem} />
                ))}
              </div>
            </div>
          )}

          {locked.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                In Progress
              </p>
              <div className="space-y-2">
                {locked.map((q) => (
                  <SystemQuestCard key={q.key} quest={q} onClaim={handleClaimSystem} />
                ))}
              </div>
            </div>
          )}

          {claimable.length === 0 && locked.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              All achievements claimed! Keep journaling to unlock more.
            </p>
          )}
        </div>
      )}

      {/* My Quests tab */}
      {tab === 'my-quests' && (
        <div className="space-y-4">
          {!showForm ? (
            <Button variant="outline" className="w-full" onClick={() => setShowForm(true)}>
              <Plus className="size-4 mr-2" />
              Create Quest
            </Button>
          ) : (
            <form onSubmit={handleCreate} className="rounded-xl border p-4 space-y-3">
              <p className="text-sm font-semibold">New Quest</p>
              <div className="space-y-1.5">
                <Label htmlFor="q-title">Title</Label>
                <Input
                  id="q-title"
                  placeholder="e.g. Read 10 books this year"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="q-desc">Description (optional)</Label>
                <Input
                  id="q-desc"
                  placeholder="What does completing this mean?"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="q-xp">XP Reward</Label>
                  <Input
                    id="q-xp"
                    type="number"
                    min={1}
                    max={9999}
                    value={formXp}
                    onChange={(e) => setFormXp(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="q-coins">Coin Reward</Label>
                  <Input
                    id="q-coins"
                    type="number"
                    min={0}
                    max={9999}
                    value={formCoins}
                    onChange={(e) => setFormCoins(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" disabled={creating || !formTitle.trim()} className="flex-1">
                  {creating ? 'Creating…' : 'Create Quest'}
                </Button>
              </div>
            </form>
          )}

          {activeCustom.length === 0 && !showForm && (
            <p className="text-center text-sm text-muted-foreground py-8">
              No active quests. Create one to get started!
            </p>
          )}

          <div className="space-y-2">
            {activeCustom.map((q) => (
              <CustomQuestCard
                key={q.id}
                quest={q}
                onComplete={handleCompleteCustom}
                onDelete={handleDeleteCustom}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed tab */}
      {tab === 'completed' && (
        <div className="space-y-5">
          {claimedSystem.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Achievements
              </p>
              <div className="space-y-2">
                {claimedSystem.map((q) => (
                  <SystemQuestCard key={q.key} quest={q} onClaim={handleClaimSystem} />
                ))}
              </div>
            </div>
          )}

          {completedCustom.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                My Quests
              </p>
              <div className="space-y-2">
                {completedCustom.map((q) => (
                  <CustomQuestCard
                    key={q.id}
                    quest={q}
                    onComplete={handleCompleteCustom}
                    onDelete={handleDeleteCustom}
                  />
                ))}
              </div>
            </div>
          )}

          {claimedSystem.length === 0 && completedCustom.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              No completed quests yet. Start journaling and building your city!
            </p>
          )}
        </div>
      )}
    </div>
  )
}

interface QuestCompletionAnimationProps {
  reward: QuestCompletionReward | null
  onClose: () => void
  onViewCompleted: () => void
}

function QuestCompletionAnimation({
  reward,
  onClose,
  onViewCompleted,
}: QuestCompletionAnimationProps) {
  return (
    <AnimatePresence>
      {reward && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-background/70 px-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <RewardParticles />

          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            className="relative w-full max-w-sm rounded-2xl border border-primary/20 bg-card px-6 py-8 text-center shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.08 }}
              className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary"
            >
              <Trophy className="size-8" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className="mt-5 space-y-2"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Quest Complete
              </p>
              <h2 className="text-2xl font-bold tracking-tight">{reward.title}</h2>
              <p className="text-sm text-muted-foreground">
                Your progress has been rewarded.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-6 grid grid-cols-2 gap-3"
            >
              <div className="rounded-xl bg-blue-500/10 px-4 py-3 text-blue-600 dark:text-blue-400">
                <div className="flex items-center justify-center gap-1 text-xs font-medium">
                  <Zap className="size-3.5" />
                  XP
                </div>
                <p className="mt-1 text-xl font-black tabular-nums">+{reward.xp}</p>
              </div>
              <div className="rounded-xl bg-yellow-500/10 px-4 py-3 text-yellow-600 dark:text-yellow-400">
                <div className="flex items-center justify-center gap-1 text-xs font-medium">
                  <Coins className="size-3.5" />
                  Coins
                </div>
                <p className="mt-1 text-xl font-black tabular-nums">+{reward.coins}</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.42 }}
              className="mt-6 flex gap-2"
            >
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Continue
              </Button>
              <Button className="flex-1" onClick={onViewCompleted}>
                View Completed
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function RewardParticles() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
      {Array.from({ length: 14 }).map((_, index) => {
        const angle = (index / 14) * Math.PI * 2
        const distance = 118 + (index % 4) * 18
        const x = Math.cos(angle) * distance
        const y = Math.sin(angle) * distance

        return (
          <motion.div
            key={index}
            className="absolute flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary"
            initial={{ opacity: 0, scale: 0.4, x: 0, y: 0 }}
            animate={{ opacity: [0, 1, 0], scale: [0.4, 1, 0.7], x, y }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: 0.08 + index * 0.025 }}
          >
            <Sparkles className="size-3.5" />
          </motion.div>
        )
      })}
    </div>
  )
}
