export interface DashboardSectionDef {
  id: string
  label: string
  description: string
  adminOnly?: boolean
}

/**
 * The dashboard sections a user may turn off, and the only place that list
 * lives.
 *
 * The database stores a map keyed by these ids and never learns the list
 * itself, so adding a section is a line here rather than a migration.
 * Excluded on purpose: the hero, and the prompts that already show and hide
 * themselves by time of day or first visit -- a permanent switch on
 * something that hides itself invites turning off a prompt and then
 * forgetting it exists.
 */
export const DASHBOARD_SECTIONS: DashboardSectionDef[] = [
  {
    id: 'today_plan',
    label: "Today's Plan",
    description: 'The shape of your day, block by block.',
  },
  {
    id: 'habits',
    label: 'Habits',
    description: "Today's habits, checkable without leaving the page.",
  },
  {
    id: 'tasks',
    label: 'Tasks',
    description: 'What is due today, and what is already overdue.',
  },
  {
    id: 'metric',
    label: 'Metric',
    description: 'A chart of the metric you are tracking.',
  },
  {
    id: 'quests',
    label: 'Quests',
    description: 'Quests ready to claim, and the ones still running.',
  },
  {
    id: 'routines',
    label: 'Routines',
    description: 'Guided chains of habits.',
    adminOnly: true,
  },
]

/** Which sections a user turned off. Absent means on. */
export type DashboardSectionVisibility = Record<string, boolean>

const SECTION_IDS = DASHBOARD_SECTIONS.map((section) => section.id)

/**
 * Reads the stored map, keeping only what this build can act on.
 *
 * An id from a section that no longer exists is dropped rather than carried
 * around, and anything that is not a map at all is treated as "nothing has
 * been turned off" -- which is also what a fresh account has.
 */
export function normalizeDashboardSections(
  value: unknown
): DashboardSectionVisibility {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {}
  }

  const stored = value as Record<string, unknown>
  const visibility: DashboardSectionVisibility = {}
  for (const id of SECTION_IDS) {
    if (typeof stored[id] === 'boolean') visibility[id] = stored[id]
  }
  return visibility
}

/**
 * Whether a section should render.
 *
 * Absent means visible, deliberately: a section added after someone last
 * saved their settings must appear for them, not go missing.
 */
export function isSectionVisible(
  prefs: DashboardSectionVisibility,
  id: string
): boolean {
  return prefs[id] !== false
}

/** The sections this user could see at all, admin-only ones included or not. */
export function sectionsFor({
  isAdmin,
}: {
  isAdmin: boolean
}): DashboardSectionDef[] {
  return DASHBOARD_SECTIONS.filter((section) => !section.adminOnly || isAdmin)
}

/**
 * How many sections this user is actually left with.
 *
 * Counts only what they could see anyway, so an admin-only section left on
 * cannot keep a non-admin above zero and swallow the notice that everything
 * is hidden.
 */
export function visibleSectionCount(
  prefs: DashboardSectionVisibility,
  options: { isAdmin: boolean }
): number {
  return sectionsFor(options).filter((section) =>
    isSectionVisible(prefs, section.id)
  ).length
}
