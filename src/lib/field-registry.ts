import { FieldType } from '@/lib/types'

export interface FieldTypeDefinition {
  type: FieldType
  label: string
  icon: string
  description: string
  hasConfig: boolean
  defaultConfig: Record<string, unknown>
  isDisplayOnly: boolean
} // Add new field types here to make them available in the app

export const FIELD_REGISTRY: FieldTypeDefinition[] = [ //welche verschiedenen Arten von Feldern es gibt, wird hier festgelegt.
  {
    type: 'heading',
    label: 'Heading',
    icon: '📌',
    description: 'Section header',
    hasConfig: true,
    defaultConfig: { level: 2 },
    isDisplayOnly: true,
  },
  {
    type: 'divider',
    label: 'Divider',
    icon: '➖',
    description: 'Visual separator',
    hasConfig: false,
    defaultConfig: {},
    isDisplayOnly: true,
  },
  {
    type: 'text',
    label: 'Short Text',
    icon: '✏️',
    description: 'Single-line text input',
    hasConfig: false,
    defaultConfig: {},
    isDisplayOnly: false,
  },
  {
    type: 'textarea',
    label: 'Long Text',
    icon: '📝',
    description: 'Multi-line writing area',
    hasConfig: true,
    defaultConfig: { maxLength: 2000 },
    isDisplayOnly: false,
  },
  {
    type: 'number',
    label: 'Number',
    icon: '🔢',
    description: 'Numeric input',
    hasConfig: true,
    defaultConfig: { min: 1, max: 100, step: 1 },
    isDisplayOnly: false,
  },
  {
    type: 'slider',
    label: 'Slider',
    icon: '🎚️',
    description: 'Visual slider with range',
    hasConfig: true,
    defaultConfig: { min: 1, max: 10, labels: ['Low', 'High'] },
    isDisplayOnly: false,
  },
  {
    type: 'select',
    label: 'Single Choice',
    icon: '🔘',
    description: 'Pick one option from a list',
    hasConfig: true,
    defaultConfig: { options: ['Option 1', 'Option 2', 'Option 3'] },
    isDisplayOnly: false,
  },
  {
    type: 'mood',
    label: 'Mood Picker',
    icon: '😊',
    description: 'Emoji-based mood selector',
    hasConfig: true,
    defaultConfig: {
      options: [
        { value: 'great', emoji: '😊' },
        { value: 'good', emoji: '🙂' },
        { value: 'okay', emoji: '😐' },
        { value: 'low', emoji: '😔' },
        { value: 'struggling', emoji: '😢' },
      ],
    },
    isDisplayOnly: false,
  },
  {
    type: 'rating',
    label: 'Star Rating',
    icon: '⭐',
    description: 'Tap-to-rate stars',
    hasConfig: true,
    defaultConfig: { max: 5 },
    isDisplayOnly: false,
  },
  {
    type: 'checkbox',
    label: 'Yes / No',
    icon: '☑️',
    description: 'Toggle switch',
    hasConfig: false,
    defaultConfig: {},
    isDisplayOnly: false,
  },
  {
    type: 'checklist',
    label: 'Checklist',
    icon: '✅',
    description: 'Multiple checkboxes',
    hasConfig: true,
    defaultConfig: { items: ['Item 1', 'Item 2', 'Item 3'] },
    isDisplayOnly: false,
  },
  {
    type: 'prompt',
    label: 'Random Prompt',
    icon: '💡',
    description: 'Shows a random journaling prompt',
    hasConfig: true,
    defaultConfig: { category: 'self_discovery' },
    isDisplayOnly: true,
  },
  {
  type: 'tasks',
  label: 'Task List',
  icon: '✅',
  description: 'Create tasks shown on the dashboard',
  hasConfig: true,
  defaultConfig: {
    defaultPriority: 'medium',
    maxTasks: 10,
  },
  isDisplayOnly: false,
},
{
  type: 'day_planner',
  label: 'Day Planner',
  icon: '📅',
  description: 'Plan your next day in time blocks',
  hasConfig: true,
  defaultConfig: {
    defaultDate: 'tomorrow',
    startHour: 9,
  },
  isDisplayOnly: false,
},
{
  type: 'habit_tracker',
  label: 'Habit Tracker',
  icon: '🎯',
  description: 'Check off habits from your settings',
  hasConfig: true,
  defaultConfig: {
    selectedHabitIds: [],
    showAll: false,
  },
  isDisplayOnly: false,
},
{
  type: 'learning',
  label: 'Learning',
  icon: '🧠',
  description: 'Save a durable lesson into your Learning Library',
  hasConfig: true,
  defaultConfig: {
    defaultTags: [],
    showAction: true,
  },
  isDisplayOnly: false,
},


]

export function getFieldDefinition(type: FieldType): FieldTypeDefinition {
  return FIELD_REGISTRY.find((f) => f.type === type) ?? FIELD_REGISTRY[0]
}
