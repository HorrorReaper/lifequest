import { Timer } from 'lucide-react'
import { TOOL_REGISTRY, type ToolManifest } from './registry'

export type ToolboxItem = Pick<
  ToolManifest,
  'id' | 'title' | 'description' | 'icon'
>

// Standalone workflows can appear in the toolbox without pretending to save
// tool_entries, which lessons and challenges require for completion.
export const TOOLBOX_ITEMS: ToolboxItem[] = [
  {
    id: 'focus-timer',
    title: 'Focus Timer',
    description:
      'Protect a little time for what matters. Start a calm, distraction-free focus session.',
    icon: Timer,
  },
  ...TOOL_REGISTRY,
]
