import type { SupabaseClient } from '@supabase/supabase-js'

export interface LessonStep {
  title: string
  content: string
}

export interface QuizQuestion {
  question: string
  options: string[]
  correctIndex: number
}

export interface SuggestedHabit {
  name: string
  emoji?: string
  color?: string
}

export interface SuggestedTask {
  title: string
  description?: string
  priority?: 'low' | 'medium' | 'high'
}

export interface Lesson {
  id: string
  title: string
  description: string
  icon: string
  image: string
  topics: string[]
  xp_reward: number
  coin_reward: number
  difficulty: 'easy' | 'medium' | 'hard'
  estimatedMinutes: number
  suggestedHabits: SuggestedHabit[]
  suggestedTasks: SuggestedTask[]
  steps: LessonStep[]
  quiz: QuizQuestion[]
}

// Serializable — no steps/quiz, safe to pass Server → Client Component
export interface LessonWithStatus {
  id: string
  title: string
  description: string
  icon: string
  image: string
  topics: string[]
  xp_reward: number
  coin_reward: number
  difficulty: 'easy' | 'medium' | 'hard'
  estimatedMinutes: number
  suggestedHabits: SuggestedHabit[]
  suggestedTasks: SuggestedTask[]
  status: 'not-started' | 'completed'
  completedAt?: string
}

interface LessonRewardState {
  total_xp: number
  coins: number
}

interface LessonRewardResult {
  data: LessonRewardState[] | LessonRewardState | null
  error: unknown
}

interface LessonRewardClient {
  rpc(
    fn: 'complete_lesson_reward',
    args: { p_lesson_id: string }
  ): PromiseLike<LessonRewardResult>
}

function lessonRewardClient(supabase: SupabaseClient): LessonRewardClient {
  return supabase as unknown as LessonRewardClient
}

function getLessonRewardErrorMessage(error: unknown): string {
  if (!error) return 'Could not complete this lesson.'
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return 'Could not complete this lesson.'
}

export const LESSONS: Lesson[] = [
  {
    id: 'daily-journaling',
    title: 'The Power of Daily Journaling',
    description: 'Discover why a few minutes of writing each day can transform your mental clarity and well-being.',
    icon: '📓',
    image: 'https://images.unsplash.com/photo-1506784365847-bbad939e9335?w=800&h=400&q=80&auto=format&fit=crop',
    topics: ['Journaling', 'Mental Clarity', 'Consistency'],
    xp_reward: 75,
    coin_reward: 30,
    difficulty: 'easy',
    estimatedMinutes: 5,
    suggestedHabits: [
      { name: 'Write one journal sentence', emoji: '📓', color: 'blue' },
      { name: 'Evening reflection', emoji: '🌙', color: 'purple' },
    ],
    suggestedTasks: [
      {
        title: 'Choose a daily journaling time',
        description: 'Pick the anchor moment when journaling will happen each day.',
        priority: 'medium',
      },
      {
        title: 'Create your first one-sentence entry',
        description: 'Start tiny so the habit is easy to repeat tomorrow.',
        priority: 'low',
      },
    ],
    steps: [
      {
        title: 'Why Journaling Works',
        content: `Journaling is one of the most researched self-improvement habits in psychology. When you write down your thoughts, you activate the **prefrontal cortex** — the part of your brain responsible for reasoning and problem-solving — which helps you process emotions more clearly.

Unlike talking to someone, writing forces you to slow down and organize your thoughts. You become both the storyteller and the audience, giving you a unique perspective on your own life.

**The evidence is clear.** Studies show that people who journal regularly report:

- Lower levels of anxiety and stress
- Better sleep quality
- A stronger immune system
- Greater emotional self-awareness

> It's not magic — it's the act of translating chaotic mental noise into structured language that creates these benefits.

You don't need to be a good writer. You don't even need to write in complete sentences. **All that matters is showing up with honesty.**`,
      },
      {
        title: 'The Science Behind It',
        content: `![A person writing in a journal at a quiet desk](https://images.unsplash.com/photo-1517842645767-c639042777db?w=800&h=360&q=80&auto=format&fit=crop)

Dr. James Pennebaker at the University of Texas pioneered research on expressive writing in the 1980s. He found that people who wrote about difficult experiences for just **15 minutes, four days in a row**, had measurably improved health outcomes months later.

### How it works: Emotional Labeling

When you name your emotions in writing, two things happen in your brain:

1. The **amygdala** (your brain's alarm center) becomes less active
2. Calmer, more rational brain regions take over

This is why journaling can make overwhelming feelings feel more manageable — you're literally changing your brain's response to stress.

More recently, researchers found that journaling can also improve **working memory** — the mental workspace you use to reason and make decisions — because it offloads worries from your mind onto the page, freeing up cognitive resources for other tasks.`,
      },
      {
        title: 'What to Write About',
        content: `The most common reason people abandon journaling is **not knowing what to write**. Here are three starting points that work for almost everyone:

### 1. Gratitude
Write 2–3 *specific* things you're grateful for. Not "my family" — but *"the way my partner made me coffee without being asked."* Specificity triggers genuine positive emotion.

### 2. Reflection
- What went well today?
- What didn't?
- What would you do differently?

This turns ordinary days into learning experiences.

### 3. Intention
What do you want tomorrow to look like? Writing your intentions the night before primes your subconscious to work toward them while you sleep.

> **Key insight:** You don't need to use all three every day. Even one sentence on one of these topics is a complete entry. Consistency beats depth every time.`,
      },
      {
        title: 'Building the Daily Habit',
        content: `Habits are formed through repetition attached to an existing routine — psychologists call this **"habit stacking."** The most effective approach is to anchor your journaling to something you already do every day.

### Example habit stacks

| Existing habit | Journaling anchor |
|---|---|
| Morning coffee | Write while the cup is still hot |
| Brushing teeth | Journal immediately after |
| Sitting at your desk | Open LifeQuest before email |

### Start impossibly small

Commit to writing **one sentence** per day for the first week. That's it. One sentence.

It sounds trivial, but your only goal in week one is to *not break the chain*. Once the habit is established, the depth will naturally follow.

> In LifeQuest, every journal entry earns you XP and builds your streak. The streak multiplier means the longer you stay consistent, the more you earn — a direct reward for the habit you're building.`,
      },
    ],
    quiz: [
      {
        question: 'What does "emotional labeling" in journaling do to your brain?',
        options: [
          'It increases amygdala activity, making you more alert',
          'It reduces amygdala activity and activates calmer brain regions',
          'It has no measurable effect on brain function',
          'It primarily improves long-term memory storage',
        ],
        correctIndex: 1,
      },
      {
        question: 'What is "habit stacking"?',
        options: [
          'Writing multiple journal entries in one sitting',
          'Combining several habits into one long routine',
          'Anchoring a new habit to an existing daily routine',
          'Tracking how many habits you complete per day',
        ],
        correctIndex: 2,
      },
      {
        question: 'What is the recommended approach for starting a journaling habit?',
        options: [
          'Write at least one full page per day from the start',
          'Write only when you feel something significant happened',
          'Start with one sentence per day to establish consistency first',
          'Journal three times a week to avoid burnout',
        ],
        correctIndex: 2,
      },
    ],
  },

  {
    id: 'building-streaks',
    title: 'Building Unbreakable Habits',
    description: 'Learn the psychology behind streaks and how to make consistency your superpower.',
    icon: '🔥',
    image: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800&h=400&q=80&auto=format&fit=crop',
    topics: ['Habits', 'Consistency', 'Motivation'],
    xp_reward: 75,
    coin_reward: 30,
    difficulty: 'easy',
    estimatedMinutes: 5,
    suggestedHabits: [
      { name: 'Protect my streak', emoji: '🔥', color: 'orange' },
      { name: 'Never miss twice check-in', emoji: '🛡️', color: 'green' },
    ],
    suggestedTasks: [
      {
        title: 'Pick one habit anchor',
        description: 'Write down the existing routine that will trigger your new habit.',
        priority: 'medium',
      },
      {
        title: 'Define your streak safety plan',
        description: 'Decide what your minimum action is on low-energy days.',
        priority: 'medium',
      },
    ],
    steps: [
      {
        title: 'The Habit Loop',
        content: `Every habit — good or bad — follows the same three-part loop: **Cue → Routine → Reward**. Understanding this loop is the first step to deliberately building habits rather than accidentally forming them.

### The three parts

**🔔 Cue**
A trigger that tells your brain to initiate the behavior. It can be a time of day, a location, an emotion, or an action that precedes the habit (like putting on gym clothes).

**⚙️ Routine**
The behavior itself — the actual habit you want to form. This is the part most people focus on, but it's actually the least important piece.

**🎁 Reward**
What your brain gets from completing the routine. The reward is what makes your brain *"remember"* the habit and want to repeat it.

> In LifeQuest, your journal entry is the **routine**. Your streak counter and XP are the **reward**. The cue is yours to design — pick a consistent time and anchor point.`,
      },
      {
        title: 'Why Streaks Matter',
        content: `![A calendar with daily habit checkmarks marked off](https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=800&h=360&q=80&auto=format&fit=crop)

Streaks work because they leverage **loss aversion** — one of the most powerful forces in human psychology.

Once you have a three-day streak, the thought of losing it creates a mild discomfort that motivates you to keep going. *That discomfort is your ally.*

### The identity shift

Researcher B.J. Fogg at Stanford has shown that motivation is **not** the primary driver of habit formation — **identity** is.

When you journal every day, a shift happens:

- ❌ *"I am trying to journal"*
- ✅ *"I am a person who journals"*

That identity shift is more durable than any motivational spike.

Streaks create momentum. The decision of whether to journal today stops being a daily negotiation and becomes automatic. The habit becomes part of **who you are** rather than something you do.`,
      },
      {
        title: 'The "Never Miss Twice" Rule',
        content: `Missing a day doesn't ruin a habit — **missing two days in a row does.**

Research by Phillippa Lally at University College London found that missing a single day had *no meaningful impact* on long-term habit formation. It's the recovery that matters.

### Your safety net

The moment you miss a day, your only goal becomes:

> **Do not miss tomorrow.**

- One missed day = an anomaly
- Two missed days = the start of a new (bad) habit

### Streak freezes in LifeQuest

Streak freezes exist for exactly this reason — they give you **one grace day** without breaking your streak, so a difficult day doesn't undo weeks of work.

Use them sparingly, as *protection*, not as a workaround.`,
      },
      {
        title: 'Habit Stacking for Consistency',
        content: `The most reliable way to guarantee you never miss a day is to make journaling **unavoidable** by linking it to something you already do without thinking.

### The formula

> *"After I **[existing habit]**, I will **[new habit]**."*

### Example stacks

- *"After I pour my morning coffee, I write in my journal for 5 minutes."*
- *"After I brush my teeth at night, I write three things I'm grateful for."*
- *"When I sit down at my desk, I open LifeQuest before I open email."*

### How to pick your anchor

1. Choose something that happens **every single day** without fail
2. Don't stack onto irregular behaviors
3. The more automatic the anchor, the more automatic your journaling becomes

Within 30 days, you won't need the anchor anymore — the journaling itself will feel incomplete without it.`,
      },
    ],
    quiz: [
      {
        question: 'What are the three parts of a habit loop?',
        options: [
          'Goal → Action → Result',
          'Cue → Routine → Reward',
          'Trigger → Behavior → Outcome',
          'Motivation → Habit → Identity',
        ],
        correctIndex: 1,
      },
      {
        question: 'What does research say about missing one day of a habit?',
        options: [
          'It significantly damages long-term habit formation',
          'It has no meaningful impact — recovery is what matters',
          'It resets the habit loop completely',
          'It only matters if it happens in the first week',
        ],
        correctIndex: 1,
      },
      {
        question: 'What is habit stacking?',
        options: [
          'Doing multiple habits back to back in a single session',
          'Tracking several habits on a single checklist',
          'Attaching a new habit to an existing automatic behavior',
          'Gradually increasing the difficulty of a habit over time',
        ],
        correctIndex: 2,
      },
    ],
  },

  {
    id: 'morning-vs-evening',
    title: 'Morning vs. Evening Journaling',
    description: 'Find out which journaling time fits your goals — and how to get the most from each.',
    icon: '🌅',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=400&q=80&auto=format&fit=crop',
    topics: ['Journaling', 'Routines', 'Productivity'],
    xp_reward: 100,
    coin_reward: 40,
    difficulty: 'easy',
    estimatedMinutes: 6,
    suggestedHabits: [
      { name: 'Morning intention', emoji: '🌅', color: 'yellow' },
      { name: 'Evening closure', emoji: '🌙', color: 'purple' },
    ],
    suggestedTasks: [
      {
        title: 'Test morning journaling for one week',
        description: 'Notice whether it improves clarity, planning, or creative energy.',
        priority: 'low',
      },
      {
        title: 'Test evening journaling for one week',
        description: 'Notice whether it improves reflection, gratitude, or sleep.',
        priority: 'low',
      },
    ],
    steps: [
      {
        title: 'The Case for Morning Journaling',
        content: `Morning journaling — often called **"morning pages"** after Julia Cameron's book *The Artist's Way* — involves writing immediately after waking, before the demands of the day take over your mental bandwidth.

### Why mornings are powerful

Your mind is at its **least cluttered** first thing in the morning. You haven't yet been flooded with emails, news, or other people's priorities.

Writing in this state helps you:

- Identify what truly matters to you that day
- Set clear intentions before distractions arrive
- Process any residual anxiety from yesterday

> Morning journaling is particularly powerful for **creativity and planning**. Many writers, artists, and CEOs swear by it as a way to access ideas that get crowded out later in the day.

Even **5 minutes** of free-writing can unlock creative thinking that follows you throughout the day.`,
      },
      {
        title: 'The Case for Evening Journaling',
        content: `![A warm evening desk lamp lighting a notebook](https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&h=360&q=80&auto=format&fit=crop)

Evening journaling is a different tool entirely. Rather than setting an intention, you're **closing a loop** — reviewing what happened, what you felt, and what you learned from the day that just passed.

### The science of emotional closure

Psychological research shows that mentally *completing* the events of a day — giving them meaning and a narrative arc — **significantly improves sleep quality**.

When your brain feels like the day is "finished," it transitions to rest mode more easily instead of replaying unresolved events.

### Evening journaling is ideal for:

- 🪞 **Reflection** — What went well? What didn't?
- 🙏 **Gratitude** — What are you genuinely thankful for today?
- 💬 **Emotional processing** — What are you still carrying from today?

Questions like *"What was the best moment of today?"* are best answered when you have a full day to reflect on.`,
      },
      {
        title: 'What Research Says',
        content: `Studies comparing morning and evening journaling tend to show **complementary** rather than competing benefits.

### Key findings

**🌙 Evening planning improves sleep**
A 2019 study in the *Journal of Experimental Psychology* found that writing a to-do list for the next day reduced the time it took to fall asleep by an average of **nine minutes**. Offloading plans onto paper quiets the planning mind.

**☀️ Gratitude journaling boosts life satisfaction**
Research by Sonja Lyubomirsky at UC Riverside found that gratitude-focused journaling showed lasting increases in life satisfaction when practiced consistently for just **two weeks**.

### The bottom line

> The benefits come from the act of writing itself, not from the time of day. Both windows are powerful. **The best time is the one you'll actually do consistently.**`,
      },
      {
        title: 'How to Choose (and Combine)',
        content: `The honest answer: try both for a week each and notice how you feel. But if you need a starting rule:

### Which time is right for you?

| If you tend to… | Choose… |
|---|---|
| Feel anxious or scattered during the day | **Morning** — enter the day grounded |
| Replay events or feel regret at night | **Evening** — find closure before sleep |
| Want maximum benefit | **Both** — keep it short |

### The 10-minute combination

Many people find the **asymmetric approach** most powerful:

- **Morning:** 5 minutes of intentions or free-writing
- **Evening:** 5 minutes of gratitude and reflection

You start the day with *purpose* and end it with *peace*.

> In LifeQuest, you can use **different templates** for morning and evening to keep each session focused and quick.`,
      },
    ],
    quiz: [
      {
        question: 'What is morning journaling most effective for?',
        options: [
          'Processing emotions from the previous day',
          'Improving sleep quality by closing mental loops',
          'Clarity, creativity, and setting daily intentions',
          'Reviewing long-term goals and progress',
        ],
        correctIndex: 2,
      },
      {
        question: 'What did a 2019 Journal of Experimental Psychology study find about writing a to-do list at night?',
        options: [
          'It increased productivity the next morning by 30%',
          'It reduced the time to fall asleep by an average of nine minutes',
          'It had no effect on sleep quality',
          'It was most effective when done digitally rather than by hand',
        ],
        correctIndex: 1,
      },
      {
        question: 'According to the research covered, when is the best time to journal?',
        options: [
          'Always in the morning, before other cognitive tasks',
          'Always in the evening, to reflect on the full day',
          'At the same time every day, regardless of whether it is morning or evening',
          'The best time is the one you will actually do consistently',
        ],
        correctIndex: 3,
      },
    ],
  },

  {
    id: 'mindful-goal-setting',
    title: 'Mindful Goal Setting',
    description: 'Most goals fail within weeks. Learn a values-based approach that creates lasting change.',
    icon: '🎯',
    image: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&h=400&q=80&auto=format&fit=crop',
    topics: ['Goals', 'Productivity', 'Mindset'],
    xp_reward: 100,
    coin_reward: 40,
    difficulty: 'medium',
    estimatedMinutes: 7,
    suggestedHabits: [
      { name: 'Weekly goal review', emoji: '🎯', color: 'green' },
      { name: 'One next step check-in', emoji: '✅', color: 'blue' },
    ],
    suggestedTasks: [
      {
        title: 'Write one values-based goal',
        description: 'Define the goal, the value behind it, the system, and the likely obstacle.',
        priority: 'high',
      },
      {
        title: 'Schedule a 10-minute weekly review',
        description: 'Pick a recurring time to review progress, obstacles, and next actions.',
        priority: 'medium',
      },
    ],
    steps: [
      {
        title: 'Why Most Goals Fail',
        content: `Research from the University of Scranton found that only **8% of people** successfully achieve their New Year's resolutions. By the second week of February, **80% have already given up**.

### The two root causes

**1. Goals disconnected from values**
The goal was set based on what someone *thought they should want* rather than what genuinely matters to them. A goal disconnected from your values feels like obligation, not direction.

**2. Outcome goals instead of system goals**

| ❌ Outcome goal | ✅ System goal |
|---|---|
| "Lose 20 pounds" | "Exercise three times a week" |
| "Write a book" | "Write 500 words every morning" |
| "Be less stressed" | "Meditate for 10 minutes daily" |

Outcome goals depend on external conditions you can't fully control. System goals — the *behaviors* that lead to the outcome — are entirely within your control every day.

> **Mindful goal setting** is the practice of choosing goals with intention, aligning them with your deeper values, and designing the systems that make progress inevitable.`,
      },
      {
        title: 'The SMART Framework',
        content: `SMART goals address the vagueness problem. A goal is SMART when it is:

| Letter | Meaning | Example |
|---|---|---|
| **S** | Specific | "Walk 20 min daily" not "get healthier" |
| **M** | Measurable | You can objectively track progress |
| **A** | Achievable | Challenging but realistic |
| **R** | Relevant | Connected to something you care about |
| **T** | Time-bound | Has a deadline that creates urgency |

### The limitation of SMART

SMART focuses on the *what* without addressing the *why*.

Two people can have **identical SMART goals** and wildly different outcomes, because one of them actually cares about the goal and one is just following a template.

> Use SMART as a **formatting tool**, but pair it with values-based thinking for it to truly work.`,
      },
      {
        title: 'Values-Based Goals',
        content: `![A person reflecting outdoors with a notebook, thinking about their values](https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&h=360&q=80&auto=format&fit=crop)

Before writing a goal, ask yourself:

> *"What **value** does this goal express?"*

Values are the deep principles that make your life meaningful — things like creativity, connection, health, freedom, growth, or service.

### Why it matters

The same goal feels completely different depending on whether it's connected to a core value:

- "Build a morning exercise habit" feels like a **chore** to someone who doesn't value physical health
- The same goal feels **energizing** to someone who sees their body as the foundation of everything else

### Finding your values

Write down **5 things you most regret *not* doing** when you look back at a given year. The pattern in those regrets reveals your values more reliably than any quiz.

Then filter every new goal through one question:

> *"Does this express something I genuinely care about, or something I think I **should** care about?"*`,
      },
      {
        title: 'The Weekly Review Habit',
        content: `Goals die not because people stop wanting them, but because they **stop reviewing them**. *Out of sight, out of mind* is a law of human attention.

### The 10-minute weekly review

Once a week, ask these three questions:

1. **What progress did I make this week?** *(Be specific — not "worked on it" but "completed X")*
2. **What got in the way?** *(Honestly, not defensively)*
3. **What is one thing I'll do differently next week?** *(One concrete action)*

### Why it works

The review does two things:

- Keeps your goals **visible and active** in your mind
- Treats setbacks as **data** rather than failures

Every week that doesn't go perfectly is a research experiment in what doesn't work — which is equally valuable to knowing what does.

> In LifeQuest, your journal templates are the perfect vehicle for a weekly review.`,
      },
      {
        title: 'Writing Your First Mindful Goal',
        content: `Use this template in your next journal entry to write a goal that will actually stick:

---

**The goal:** *[One specific, measurable goal with a timeline]*

**The value it expresses:** *[Which core value does this serve?]*

**Why now:** *[Why is this important to you at this stage of your life?]*

**The system:** *[What daily or weekly behavior will move you toward this goal?]*

**The obstacle:** *[What is the most likely thing that will get in the way?]*

**The plan:** *[Specifically, what will you do when that obstacle appears?]*

---

### Why the last two items matter most

This "obstacle + plan" structure is based on research by Gabriele Oettingen called **"mental contrasting."**

People who anticipate obstacles and plan for them in advance are *dramatically* more likely to persist through difficulty than those who only visualize success.`,
      },
    ],
    quiz: [
      {
        question: 'What does SMART stand for?',
        options: [
          'Strategic, Measurable, Actionable, Realistic, Timely',
          'Specific, Measurable, Achievable, Relevant, Time-bound',
          'Simple, Motivated, Attainable, Reviewed, Tracked',
          'Specific, Meaningful, Actionable, Rewarded, Tracked',
        ],
        correctIndex: 1,
      },
      {
        question: 'What is the most common reason goals fail according to this lesson?',
        options: [
          'Goals are too ambitious and unrealistic',
          'People lack the discipline to follow through',
          'Goals are disconnected from the person\'s genuine values',
          'Goals are not written down clearly enough',
        ],
        correctIndex: 2,
      },
      {
        question: 'What is "mental contrasting" as described in this lesson?',
        options: [
          'Visualizing only positive outcomes to build motivation',
          'Comparing your current self to your ideal future self',
          'Anticipating obstacles in advance and planning how to handle them',
          'Contrasting your goals with other people\'s goals for perspective',
        ],
        correctIndex: 2,
      },
      {
        question: 'According to the weekly review practice, what should you do when a week doesn\'t go as planned?',
        options: [
          'Extend the deadline for your goal',
          'Lower your expectations for future weeks',
          'Treat it as a failure and restart with a new goal',
          'Treat it as data — research on what doesn\'t work',
        ],
        correctIndex: 3,
      },
    ],
  },

  {
    id: 'writers-block',
    title: 'Overcoming Writer\'s Block',
    description: 'Never stare at a blank page again. Practical techniques to start writing when you feel stuck.',
    icon: '✍️',
    image: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&h=400&q=80&auto=format&fit=crop',
    topics: ['Journaling', 'Creativity', 'Mindset'],
    xp_reward: 125,
    coin_reward: 50,
    difficulty: 'medium',
    estimatedMinutes: 6,
    suggestedHabits: [
      { name: 'Minimum viable entry', emoji: '✍️', color: 'blue' },
      { name: 'Five-minute freewrite', emoji: '📝', color: 'purple' },
    ],
    suggestedTasks: [
      {
        title: 'Save three fallback prompts',
        description: 'Choose prompts you can use whenever the blank page feels heavy.',
        priority: 'medium',
      },
      {
        title: 'Write one imperfect entry',
        description: 'Practice writing without editing, polishing, or judging the result.',
        priority: 'low',
      },
    ],
    steps: [
      {
        title: 'What Actually Causes Writer\'s Block',
        content: `Journaling writer's block is almost never about having nothing to say. You have thoughts, feelings, and experiences constantly — more than you could ever write down.

### The three real causes

**Perfectionism**
The belief that what you write has to be *good*, insightful, or interesting. Your journal is not a performance. Nobody will read it. It doesn't need to be good.

**Overwhelm**
Too much has happened, and you don't know where to start. The solution is to pick **one thing** — just one — not summarize everything.

**Emotional avoidance**
Sometimes there's something you don't want to look at. Paradoxically, that's usually the thing most worth writing about. The resistance itself is information.

| Block type | What it needs |
|---|---|
| Perfectionism | Permission to be imperfect |
| Overwhelm | A smaller scope |
| Avoidance | Courage — start with *"I don't feel like writing because…"* |

> Identifying which type of block you have **changes how you overcome it**.`,
      },
      {
        title: 'The Minimum Viable Entry',
        content: `The **minimum viable entry (MVE)** is the smallest possible journal entry that still counts.

When you're blocked, the goal is not to write well. The goal is simply **not to break the chain**.

### What an MVE might look like

- One sentence about how you feel right now
- A list of five things you noticed today
- Three words that describe your mood
- The answer to *"What am I avoiding right now?"*

### Why it works

Once you've written your MVE, you've already won. You kept the habit.

But here's what usually happens: writing even one sentence **breaks the resistance**, and more words follow naturally.

> The blank page is the enemy, not writing itself. The moment you put one word on the page, you've defeated the hardest part.

Give yourself explicit permission to write your MVE on the hard days, with no guilt about it being short.`,
      },
      {
        title: 'Prompts That Unlock Your Mind',
        content: `![An open notebook with a pen ready to write](https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&h=360&q=80&auto=format&fit=crop)

When you don't know what to write, a well-designed prompt removes the decision entirely.

### Five prompts that consistently work

**"Right now I feel…"**
Describe your physical and emotional state in detail. Naming the feeling specifically — not just *"stressed"* but *"a tightness in my chest when I think about tomorrow"* — is itself therapeutic.

**"The thing taking up the most mental space today is…"**
Whatever your mind keeps returning to deserves to be on the page.

**"Something I'm proud of recently…"**
Easy to answer, always leaves you feeling better than when you started.

**"A conversation I've been replaying…"**
Writing out a difficult conversation often gives you clarity about what you actually want to say or resolve.

**"If I weren't afraid, I would…"**
One of the most revealing prompts for identifying where you're holding yourself back.`,
      },
      {
        title: 'Making Peace with Imperfection',
        content: `Anne Lamott, in her book *Bird by Bird*, introduced the concept of the **"shitty first draft"** — the idea that all good writing begins as bad writing, and that's not a problem to fix but a process to embrace.

### Your journal is different

Your journal has no second draft. Whatever you write is the final version.

This means the shitty first draft *IS* the draft, and that's the entire point. The moment you accept that your entries are allowed to be messy, contradictory, and poorly written, the blank page **loses most of its power over you**.

### The freewriting technique

> Set a timer for **5 minutes** and write without stopping. Don't re-read, don't edit, don't cross anything out. Your only rule is that the cursor keeps moving.

This technique, developed by Peter Elbow, bypasses the inner critic entirely by making **speed** the priority instead of quality.

After five minutes, stop. You've written your entry.`,
      },
    ],
    quiz: [
      {
        question: 'According to this lesson, what almost always causes journaling writer\'s block?',
        options: [
          'Having too few experiences worth writing about',
          'Perfectionism, overwhelm, or emotional avoidance',
          'Choosing the wrong journaling template',
          'Writing at the wrong time of day',
        ],
        correctIndex: 1,
      },
      {
        question: 'What is a "Minimum Viable Entry"?',
        options: [
          'A journal entry of at least 200 words',
          'An entry that covers at least three topics',
          'The smallest possible entry that still keeps the habit alive',
          'An entry completed in under five minutes',
        ],
        correctIndex: 2,
      },
      {
        question: 'What is the core rule of the freewriting technique?',
        options: [
          'Write only positive thoughts to maintain a good mindset',
          'Keep the pen or cursor moving without stopping to edit',
          'Write in complete sentences and full paragraphs',
          'Re-read what you wrote after each paragraph',
        ],
        correctIndex: 1,
      },
    ],
  },
]

export function annotateLessons(
  completedIds: string[],
  completionTimes: Record<string, string>
): LessonWithStatus[] {
  return LESSONS.map((lesson) => ({
    id: lesson.id,
    title: lesson.title,
    description: lesson.description,
    icon: lesson.icon,
    image: lesson.image,
    topics: lesson.topics,
    xp_reward: lesson.xp_reward,
    coin_reward: lesson.coin_reward,
    difficulty: lesson.difficulty,
    estimatedMinutes: lesson.estimatedMinutes,
    suggestedHabits: lesson.suggestedHabits,
    suggestedTasks: lesson.suggestedTasks,
    status: completedIds.includes(lesson.id) ? 'completed' : 'not-started',
    completedAt: completionTimes[lesson.id],
  }))
}

export async function completeLessonQuiz(
  supabase: SupabaseClient,
  lesson: Pick<Lesson, 'id' | 'title' | 'xp_reward' | 'coin_reward'>,
  callbacks: { addXp: (x: number, previousTotalXp?: number) => void; setCoins: (c: number) => void }
) {
  const { data, error } = await lessonRewardClient(supabase)
    .rpc('complete_lesson_reward', { p_lesson_id: lesson.id })

  if (error) throw new Error(getLessonRewardErrorMessage(error))

  const rewardState = Array.isArray(data) ? data[0] : data
  if (!rewardState) throw new Error('Lesson reward was not returned.')

  callbacks.addXp(lesson.xp_reward, rewardState.total_xp - lesson.xp_reward)
  callbacks.setCoins(rewardState.coins)
}
