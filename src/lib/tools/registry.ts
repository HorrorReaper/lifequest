import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Compass, Unlock } from 'lucide-react'
import type { ToolEntry } from '@/lib/tools/storage'
import { VisionTool } from '@/components/tools/vision/VisionTool'
import { LimitingBeliefsTool } from '@/components/tools/limiting-beliefs/LimitingBeliefsTool'

// The extension point for self-improvement tools (vision, cookie jar, wheel
// of life, time audit, ...).
//
// A tool is a React component plus an entry in TOOL_REGISTRY below. Adding
// one costs those two things and nothing else: no migration, no SQL, no
// changes to the learning-path catalog.
//
// This is deliberately NOT modelled as new learning-path exercise types.
// Adding an exercise type there means touching eight places, three of them
// in SQL (the exercise_type CHECK constraint, the catalog validation
// function, and the submission scoring). Tools are also far more varied in
// shape than quiz exercises — a weekly 15-minute grid, a curated list and a
// radar chart have almost nothing in common — so a single declarative
// renderer would have to grow into a small programming language to cover
// them.

export interface ToolProps {
  userId: string
  /**
   * This tool's existing entries, newest first, fetched server-side by the
   * tool route. Passing them in keeps tools free of an on-mount fetch effect
   * and avoids a loading flash; the storage layer is generic, so the route
   * can do this without knowing anything about a specific tool.
   */
  initialEntries: ToolEntry[]
  /**
   * Called after the tool saves something. A lesson uses this to unlock the
   * Continue button; on the standalone tool page it is simply absent.
   */
  onUsed?: () => void
}

export interface ToolManifest {
  /** Stable identifier; also the tool_id written to tool_entries. Never rename. */
  id: string
  title: string
  /** One line, shown on the library card. */
  description: string
  icon: LucideIcon
  /**
   * Optional lesson that introduces this tool. Tools without one are usable
   * immediately — a tool should not become unreachable because its lesson
   * has not been written yet.
   */
  introducedBy?: string
  Component: ComponentType<ToolProps>
}

export const TOOL_REGISTRY: ToolManifest[] = [
  {
    id: 'vision',
    title: 'Vision',
    description: 'Write down where you are headed, and revisit how it has changed.',
    icon: Compass,
    Component: VisionTool,
  },
  {
    id: 'limiting-beliefs',
    title: 'Limiting Beliefs',
    description: "Name a belief that's holding you back, challenge it, and write a better one.",
    icon: Unlock,
    Component: LimitingBeliefsTool,
  },
]

export function getToolManifest(toolId: string): ToolManifest | null {
  return TOOL_REGISTRY.find((tool) => tool.id === toolId) ?? null
}
