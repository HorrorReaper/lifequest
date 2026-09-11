import { dayNumber } from '@/lib/dates'

export interface ReflectionPrompt {
  id: string
  /** A one-word label, shown as a chip so the day's question has a shape. */
  theme: string
  text: string
}

/**
 * The system journal template a reflection is written into.
 *
 * A fixed id rather than a name lookup: the Evening Review prompt matches its
 * template by name and silently disappears if anyone renames it, and a
 * template seeded by this app's own migration has no reason to be that
 * fragile. Seeded in
 * `supabase/migrations/20260911120000_create_daily_reflection_template.sql`.
 */
export const DAILY_REFLECTION_TEMPLATE_ID = 'f3ff8330-725f-43ef-b076-7fe79ba96cb3'

/**
 * The daily reflection prompts, in rotation order.
 *
 * A list walked one prompt per calendar day rather than a random draw: the
 * length is the cycle, so nobody meets the same question twice inside it, and
 * the day's prompt is the same on every device and after every reload.
 *
 * Append only. Which prompt a past reflection was written against is derived
 * from its entry date rather than stored with it, so inserting into the
 * middle of this list or reordering it rewrites what older entries appear to
 * have asked. Adding to the end only shifts the rotation from that day on.
 */
export const REFLECTION_PROMPTS: ReflectionPrompt[] = [
  {
    id: 'energy-giver',
    theme: 'Energy',
    text: 'What gave you energy today, and what quietly drained it?',
  },
  {
    id: 'proud-small',
    theme: 'Wins',
    text: 'What did you do today that you would not have managed a year ago?',
  },
  {
    id: 'avoiding',
    theme: 'Honesty',
    text: 'What are you avoiding right now, and what is the first two-minute step into it?',
  },
  {
    id: 'kind-to-you',
    theme: 'People',
    text: 'Who made your day easier today? Did they hear it from you?',
  },
  {
    id: 'time-went',
    theme: 'Focus',
    text: 'Where did your time actually go today, and where did you think it went?',
  },
  {
    id: 'changed-mind',
    theme: 'Growth',
    text: 'What is something you used to be certain about and have since changed your mind on?',
  },
  {
    id: 'good-enough',
    theme: 'Standards',
    text: 'What are you holding to a standard that is higher than it needs to be?',
  },
  {
    id: 'body-signal',
    theme: 'Body',
    text: 'What has your body been telling you this week that you have been talking over?',
  },
  {
    id: 'one-thing',
    theme: 'Priorities',
    text: 'If tomorrow allowed only one thing to go well, which would you choose?',
  },
  {
    id: 'hard-conversation',
    theme: 'Courage',
    text: 'Which conversation would change the most if you finally had it?',
  },
  {
    id: 'enough-today',
    theme: 'Gratitude',
    text: 'What was already enough today, before you added anything to it?',
  },
  {
    id: 'learned-recently',
    theme: 'Learning',
    text: 'What did you learn this week that you want to still be using in a year?',
  },
  {
    id: 'reacted-strongly',
    theme: 'Patterns',
    text: 'What did you react strongly to recently? What was underneath the reaction?',
  },
  {
    id: 'future-thanks',
    theme: 'Future',
    text: 'What could you do today that the version of you in six months would thank you for?',
  },
  {
    id: 'avoid-comparison',
    theme: 'Identity',
    text: 'Whose life have you been measuring yours against, and is that measure even yours?',
  },
  {
    id: 'work-worth',
    theme: 'Work',
    text: 'Which part of your work felt worth doing today, regardless of the outcome?',
  },
  {
    id: 'rest-looks-like',
    theme: 'Rest',
    text: 'What does real rest look like for you, and when did you last let yourself have it?',
  },
  {
    id: 'say-no',
    theme: 'Boundaries',
    text: 'What did you say yes to this week that you wish you had declined?',
  },
  {
    id: 'help-asked',
    theme: 'Support',
    text: 'What are you carrying alone that someone would gladly help you with?',
  },
  {
    id: 'made-you-laugh',
    theme: 'Joy',
    text: 'What made you laugh recently? What does that say about what you need more of?',
  },
  {
    id: 'harsh-inner',
    theme: 'Self-talk',
    text: 'What did you say to yourself today that you would never say to a friend?',
  },
  {
    id: 'worth-quitting',
    theme: 'Letting go',
    text: 'What are you continuing only because you have already put time into it?',
  },
  {
    id: 'noticed-detail',
    theme: 'Attention',
    text: 'What did you notice today that you would normally walk straight past?',
  },
  {
    id: 'fear-shape',
    theme: 'Fear',
    text: 'What are you afraid of right now, and what would it look like if it happened?',
  },
  {
    id: 'progress-invisible',
    theme: 'Progress',
    text: 'Where are you making progress that is too slow to see day to day?',
  },
  {
    id: 'money-story',
    theme: 'Choices',
    text: 'What did you spend money, time, or attention on today, and was it a real choice?',
  },
  {
    id: 'past-self',
    theme: 'Perspective',
    text: 'What would you tell yourself from five years ago about where you are now?',
  },
  {
    id: 'repeat-day',
    theme: 'Values',
    text: 'If every day were a copy of today, what kind of life would that build?',
  },
  {
    id: 'unfinished',
    theme: 'Clarity',
    text: 'What unfinished thing is taking up the most room in your head?',
  },
  {
    id: 'good-enough-day',
    theme: 'Closing',
    text: 'What would have to be true for today to count as a good day?',
  },
]

const PROMPTS_BY_ID = new Map(REFLECTION_PROMPTS.map((prompt) => [prompt.id, prompt]))

/**
 * The prompt for one calendar day.
 *
 * Keyed by the day number so the same date always yields the same prompt —
 * on the dashboard, in the entry form it opens, and when the entry is read
 * back months later.
 */
export function reflectionPromptForDate(dateKey: string): ReflectionPrompt {
  const total = REFLECTION_PROMPTS.length
  // Day numbers before 1970 are negative, and JS keeps the sign through %.
  const index = ((dayNumber(dateKey) % total) + total) % total
  return REFLECTION_PROMPTS[index]
}

/** The prompt with this id, or null once a prompt is renamed or removed. */
export function findReflectionPrompt(id: string | null | undefined): ReflectionPrompt | null {
  if (!id) return null
  return PROMPTS_BY_ID.get(id) ?? null
}
