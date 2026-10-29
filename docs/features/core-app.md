# Core application and dashboard

## Purpose

The authenticated application is the daily entry point into LifeQuest. It combines the user's plan, tasks, habits, journal prompts, quests, learning progress, streak, XP, coins, and city progression without requiring the user to visit every feature separately.

The primary implementation is in:

- `src/app/(app)/dashboard/page.tsx`
- `src/components/dashboard/`
- `src/components/layout/app-shell.tsx`
- `src/components/layout/app-top-bar.tsx`
- `src/components/layout/bottom-nav.tsx`
- `src/components/layout/quick-action-button.tsx`

## Onboarding

`/onboarding` (`src/components/onboarding/onboarding-flow.tsx`, helpers in `src/lib/onboarding.ts`) takes a new account to its first planned task in three steps:

1. **Focus.** What the app is for, the name carried over from sign-up (with "Change name"; asked for only when none is known), and a choice of where the user wants more clarity (work or study, health, home and life admin, learning, a personal project). The focus only steers the suggestions on the next step and is not stored. The detected timezone is shown as one line, "Times use Europe/Berlin", with "Change timezone" revealing the picker.
2. **First task.** One small, concrete thing to finish today, typed or picked from suggestions for the focus. "Save task" creates a real task (due today in the chosen timezone, priority high) that is editable on `/tasks` like any other.
3. **Plan it for today.** A start time (the next quarter hour at least five minutes ahead, at most 23:30) and a length (15, 25, 45 or 60 minutes). "Plan it and finish" writes today's `day_plans` row, then the profile.

The plan block is linked to the task (`source_type: "task"`, `source_id`), is the day's main priority, and has the id `onboarding-<taskId>` (`buildOnboardingPlan`). It is merged into an existing plan for the day rather than replacing it, the day window widens to include it, and `ritual_completed_at` is set so the morning planning prompt does not ask again that day.

Duplicates are prevented three ways. The created task's id is kept in component state and in `sessionStorage` (`lifequest:onboarding:<userId>`), so going back and changing the title updates the same task, and a reload picks it up again; if that task was deleted meanwhile (`PGRST116` on update) a new one is created. Each save is guarded by a ref that is set before the first `await`, so a double tap sends one request. The plan block's fixed id makes a repeated finish replace its own block.

The previous mandatory age question and the journal template choice are no longer part of this flow; `profiles.birth_year` stays in the schema but onboarding no longer writes it. Failures keep the input on screen with one message next to the field concerned. If the plan cannot be saved, the profile is not marked complete, so the flow can be retried. On success the flow opens `/dashboard?welcome=1`, where `FirstRunWelcome` confirms the planned task and offers a daily habit and an optional reflection (dismissal in `localStorage`). The card latches `show` on mount: it removes `?welcome=1` from the address, and reading the prop afterwards made it vanish about a second after it appeared.
 Existing accounts (`onboarding_complete`) are redirected away from `/onboarding` and never see the flow.

The timezone picker (shared with Settings via `src/lib/timezones.ts`) is generated from `Intl.supportedValuesOf('timeZone')` at render time and grouped by IANA region, rather than a curated list. The active value is always guaranteed a matching option, so the control cannot display a zone different from what is actually stored.

Completing the final step upserts the profile instead of updating it, since a session that reaches onboarding without an existing profile row (for example sign-up with email confirmation disabled) would otherwise update zero rows without erroring and loop back to onboarding indefinitely.

The authenticated layout and Supabase session middleware redirect incomplete profiles to onboarding. Pages should not independently invent a second onboarding state.

## Dashboard composition

The dashboard server page loads the initial authenticated snapshot. Client widgets then support focused mutations and refresh the server snapshot when needed.

### Greeting and progression

The dashboard is ordered by the day's work (`src/app/(app)/dashboard/page.tsx`): greeting and date, Next up, Today's Plan, Habits, Tasks, and only then the journal nudge, challenge cards, goals, scorecard, reflection and quests. Challenge cards used to sit above the plan and push the first work action off a phone screen.

The top is `DashboardGreeting` (`src/components/dashboard/DashboardGreeting.tsx`): a hero 160px tall (176px from `sm`) with a small landscape (`DashboardHeroScene`), the full avatar (`AvatarFigure`, gear included) standing on its path, and over the sky a greeting for the time of day and today's date, both in the profile timezone. `greetingFor` picks "Good morning" from 05:00, "Good afternoon" from 12:00 and "Good evening" from 18:00 and through the night, from the minutes the dashboard reads on the server (`currentMinutesInTimezone`); without them it says "Welcome back". The greeting deliberately carries no status chips: the day's state is the next-up card's job.

The landscape grows with the day in three stages (`dayProgress` in `src/lib/day-progress.ts`). It counts every step the day was given -- each of today's habits, each linked task planned into a block, each reflection chosen in the planner, and the evening review when it is switched on and has a template -- and how many are done. Stage 0 (under a third done, or nothing on the day) is a quiet beige morning with a bare tree; stage 1 (from a third) adds the sun, green grass, a tree in leaf and a few flowers; stage 2 (from two thirds) a larger sun, birds, a full tree in blossom and more flowers. The scene only ever gains things, so a slow day reads as an early morning, never a wilting one. On load the avatar walks in from the left onto its place on the path in 1.6 s (`WALK_SECONDS`), bobbing and leaning slightly with four strides and ending upright, and the scene grows one stage every 600 ms (`STAGE_STEP_MS`) up to today's while it walks, never past it; new elements fade in over 700 ms. After that the avatar keeps walking slowly on the spot (`.hero-stride`, a 1.4 s bob-and-lean loop) while the landscape drifts past for as long as the page is open: the far hills in 90 s per tile (`.hero-scroll-far`), the near ground, path, trees and flowers in 45 s (`.hero-scroll-near`), both CSS keyframes in `src/app/globals.css`. Each scrolling layer draws its 480-unit tile twice and moves by exactly one tile, and the tile's edges meet at the same height and slope, so the loop has no seam; the sky, sun and birds stay put. A veil of sky over the top-left of the scene, fading out to the right and down, lets a tree drifting under the greeting soften instead of crossing the words. The movement pauses while the hero is out of view (`IntersectionObserver`), and a 44px button in the hero's top-right corner, "Pause the scene" / "Play the scene" (`aria-pressed`), stops it for good; the choice is remembered per browser in `localStorage` (`lifequest:hero-scene-paused`) and read through `useSyncExternalStore`, so the server render and the remembered choice never disagree. With reduced motion (`useReducedMotion` and a `prefers-reduced-motion` rule) the avatar stands in place, nothing scrolls, the finished stage shows at once and the button is hidden. The walk-in plays on every load of the dashboard. Dark mode has its own night colours. The scene is `aria-hidden`; screen readers get "Your day so far: N of M steps done." instead, left out on a day with nothing on it. The SVG is cropped to fit (`xMidYMax slice`): a phone shows only about x 85-395 of its 480 units, so the sun, tree and birds stay inside that range. The stage is decided when the page loads. Under the Trail theme the heading uses the scoped Fraunces font and ends in a full stop; the other themes keep the wave emoji. There is no hero card any more.

`NextUpCard` (`src/components/dashboard/NextUpCard.tsx`) follows with one concrete next step, chosen by `nextUpFor` in `src/lib/dashboard-plan.ts`. It has two layouts:

- **Time first** (a block running now or coming up): the eyebrow ("Now · until 11:00", "Next at 20:30"), the time as a large figure ("45 min left", "40 min to go", split by `durationFigure`), a small ring of how much of a running block has passed or an icon for one that is ahead, the block's title, a line with its priority ("Main focus", "Second task", "Recharge"), the linked task's due date, "Reflection" or "Habit", and its times, then one action that spans the card on a phone. A block that is ahead offers its action as an outline button.
- **Ring first** (anything counted, or no plan): a ring with "done/total" (`src/components/ui/progress-ring.tsx`), or an icon, beside the eyebrow and title, chips under it, then the actions. The count is also given as text for screen readers.

Reflections use blue (eyebrow, ring, icon and filled button) so they are not mistaken for a task; everything else uses the theme's primary colour. Due-date and overdue chips are amber.

| State | Layout | Shows | Action |
| --- | --- | --- | --- |
| Evening review due, no block running or ahead (with or without a plan) | Ring first, blue, moon icon | "No more time blocks today" (without a plan: "This evening"), "Complete your evening review", "Look back on today before you close it.", chips "N planned tasks open" and "N habits still open" | "Start evening review" (`/journal/new/<evening review template>`) |
| No plan, no open tasks | Ring first, plus icon | "Add your first task" | "Add task" (`/tasks?new=1`) |
| No plan, tasks due today or overdue | Ring first, list icon | "Next up · nothing planned yet", "N tasks due today", chips "N overdue" and the first due task | "Plan my day" (`/plan`) |
| No plan, nothing due | Ring first, calendar icon | "Plan your day" | "Plan my day" |
| A block is running | Time first | minutes left | an open linked task: "Mark task done"; a reflection: "Write now" (`/journal/new/<template>`); a habit: "Check in" (`#habits`); each with "Edit plan" beside it. Any other block: "Edit plan" |
| A block is ahead | Time first, outline action | minutes to go | an open linked task: "Mark task done"; a reflection: "Start early"; with "Edit plan". Otherwise "Edit plan" |
| Every block is over, a linked task still open | Ring first: planned tasks done/total | "Planned today, still open", that task, its due date, "+N more open" | "Mark task done", "Replan" |
| Every block is over, habits open | Ring first: habits done/total | "No more time blocks today", "N habits still open", the first two open habits, "+N more" | "Check in" (`#habits`) |
| Habits done, a reflection chosen for today is unwritten | Ring first, blue: reflections written/chosen | "Reflection still open", its title, "+N more to write" | "Write now" (`/journal/new/<template>`) |
| Every chosen reflection is written | Ring first, check icon | "Journal done for today", "Your reflection is written" or "N of N reflections written" | "Open journal" (`/journal`, outline) |
| Every block is over, nothing open | Ring first, check icon | "Your planned blocks are behind you" | "Edit plan" |

The evening review row comes first: once its window is open (`isRitualWindow` for `evening_review` in `src/lib/rituals.ts`), it has a template and no complete entry for it exists today, it is the next step as soon as no block is running or still to come, ahead of an open planned task, open habits and reflections, which it lists instead of leading with them. A block still running or ahead in the evening keeps its own card until it is over. Once the review is written, the order below it applies again. The state is decided when the page loads; a window that opens while the dashboard stays open shows after a reload.

The dashboard page feeds the card: each block's kind (`source`), the reflection template it was reserved for, the linked task's due date and the priority name (`PRIORITY_LABELS` in `src/lib/today-plan.ts`); today's habits with their done state; the reflections chosen for today in the planner (journal anchors in the plan metadata, flexible or with a block) with whether today has a completed entry for each template; and the number of open tasks due by today and overdue, counted with their own queries because the dashboard's task list stops at 16.

Clock time and completion are separate: a block whose time has passed is never called done. "Mark task done" uses `completeTaskWithReward` (`src/lib/tasks.ts`), the same XP path as the task list.

The dashboard has no journal suggestion of its own. The "Next best move" row (`JournalNudge`) that sat below Tasks and linked to the first journal template not yet written today was removed as no longer needed, together with the `journal_templates` query that only fed it. Journaling starts from the Journal tab in the nav, and the evening review prompt still offers its template.

At the bottom, "Something unclear or not working? Send feedback" opens `FeedbackDialog`; see [Feedback](#feedback).

Level, XP progress, coins and streak are in the top bar that every page with the standard shell shows, so they are not repeated on the dashboard (`/profile` keeps its own `DashboardHero` card).

#### Top bar

`src/components/layout/app-top-bar.tsx` is one row: `Lv N`, a thin XP progress bar with "XP / next level threshold", coins, and the current streak (best streak stays on `/profile`). It is sticky at the top of `AppShell` and hidden on the same immersive routes as the bottom navigation. A brand-new account's raw progress is below zero (level 1 starts above 0 XP), so the bar clamps it to 0 to 100.

Earning XP or coins anywhere in the app shows in the bar: a small "+N XP" / "+N" rises from the value and fades in about a second, and the number gives a short springy pulse. `useGains` (`src/components/layout/use-gains.ts`) collects only increases after the bar first rendered, so loading a page or the shell's first sync with the server animates nothing, and a decrease (an unticked habit) shows no "-N". Gains that land in the same render are shown as one; under reduced motion nothing animates and the number simply updates.

While an admin previews as a user, the bar sticks directly beneath `PreviewAsUserBanner` instead of behind it: the layout sets `--preview-banner-height` (`src/components/layout/preview-banner-height.ts`) and the banner has a fixed height to match. Keep the two in step.

#### Where the numbers come from

`src/app/(app)/layout.tsx` calls `fetchShellStats` (`src/lib/shell-stats.ts`) on every request: `total_xp` and `current_streak` from `profiles`, `coins` from `city_states`, and the equipped avatar items via `fetchAvatarState`. A part that fails falls back to its default so chrome can never take a page down. `AppShell` hands the result to `useShellStats` (`src/components/layout/use-shell-stats.ts`), which renders the server values first, then copies them into the Zustand user store and reads from it. Anything that already calls `addXp`, `setCoins`, `updateStreak` or `setEquippedItems` therefore moves the bar and the nav's avatar immediately, and a `router.refresh()` re-syncs the store with fresh server values.

XP and coins are persisted in Supabase. The Zustand user store exists for responsive presentation and level-up feedback; it is not the durable source of truth.

### Sections open their page

The sections with a page of their own have no "Manage …" / "Open …" / "All …" link any more. Clicking anywhere on the section opens the page instead (`ClickableSection` in `src/components/dashboard/ClickableSection.tsx`), and its heading is that link for the keyboard and screen readers (`SectionHeadingLink`, with a small chevron):

| Section | Opens |
| --- | --- |
| Today's Plan | `/plan` (or the Work planner when embedded there) |
| Habits | `/habits` |
| Tasks | `/tasks` |
| Scorecard, metric chart | `/journal/metrics` |
| Quests | `/quests` |

Adding happens from a small round "+" at the right of the section's header (`SectionAddButton` in `src/components/dashboard/SectionAddButton.tsx`), the same in every section: Habits and Tasks open their create dialog, Today's Plan goes straight to the plan editor (`/plan?step=timeline`; `/plan` itself opens the editor too once a plan exists), and Goals opens `GoalEditorDialog` (title, why, category, target date), which replaced the form that used to unfold inside the section. `?goal=new` (`GOAL_FORM_HREF`) opens that dialog directly. While a section is empty the "+" is hidden: its own empty-state button ("Add habit", "Add task", "Plan my day", "Add Goal") is the one way in. The footers that held "Add …" buttons, and the Tasks "N open" count, are gone.

A click on one of the section's own controls does not navigate: check-offs, the "+" buttons, "Show more", claim buttons, any link, and anything inside a dialog the section opened (React bubbles portal events through the component tree, so the section checks the click landed in its own DOM). `data-section-ignore` opts any other element out. Ctrl/Cmd-click opens the page in a new tab, and selecting text does not navigate. Goals, Daily Reflection and Routines have no page to open and are unchanged.

### Section headers with a figure

Habits and Tasks lead with their number (`SectionStatHeader` in `src/components/dashboard/SectionStatHeader.tsx`): the section's icon and title shrink to a small label, which is still the `SectionHeadingLink`, and below it the day's figure is the largest thing in the header, with its unit in smaller muted type. The "+" sits on the right, level with the number. While a section is empty it shows the label only, with no number and no "+".

- **Habits** reads "3 of 11 today", with one continuous orange bar under the header filling as habits are checked. It replaced the row of one dot per habit, which grew wider than the card as habits were added.
- **Tasks** reads "N due today", counting only tasks due today itself. Overdue tasks show as a red "N overdue" chip under the header. When nothing is due and the section falls back to undated tasks, the number is 0 and a "N without a date" chip says what is listed instead.

The other dashboard sections keep the older header: an icon in a round chip, the title, and a small count on the right.

### Ritual prompts

`DailyPlanPrompt`, `EveningReviewPrompt`, `WeeklyPlanPrompt` and `WeeklyReviewPrompt` (`src/components/dashboard/`) open as dialogs over the dashboard in their windows (configured at `/admin/rituals`). The daily plan (morning briefing) has a start time but no end, so it ends where the evening review's window begins (`isDailyPlanWindow` in `src/lib/rituals.ts`): a visit after that start, whether the first of the day or with the plan left open since the morning, gets only the evening review. With the evening review switched off, the briefing stays on offer all day. They are static: an icon tile, the title and description, "Not now" and the call to action. The looping icon bob and the text fade-in they used to have were removed because the motion distracted inside a dialog.

### Habits

`HabitsSection` (`src/components/dashboard/HabitsSection.tsx`) lists today's habits, each checkable in place with the same XP and coin rewards as `/habits`. Habits still open come first and done ones after (`openHabitsFirst` in `src/lib/dashboard-habits.ts`); within each group the order is the user's own from `/habits`. The order follows the optimistic check-in state, so a habit slides below the open ones on the tap itself (a framer-motion layout animation, skipped when the system asks for reduced motion) and back up when unticked. The five-row preview therefore always starts with what is left to do.

### Daily briefing

`DailyBriefingWidget` brings together:

- Today's habits and completion state.
- Relevant tasks.
- Journal templates and today's journal entries.
- Today's committed plan.
- Contextual quick actions.

The widget is shared dashboard wiring. When changing tasks, habits, planning, or journal data contracts, verify this component as an integration point.

### Today Plan summary

`TodayPlanSection` (`src/components/dashboard/TodayPlanSection.tsx`) lists today's blocks around the one running now. Its header counts "N blocks left"; once every block is over it says "No blocks left", or "N open" when linked tasks of past blocks are still open, and the body says "No more time blocks today" plus the open count. It never says "all done": past blocks are dimmed but only struck through, with "Done", when their linked task is completed, and a past block with an open task shows "Open". The linked tasks' completion is read on the dashboard server page (`plannedTaskIds` in `src/lib/day-plans.ts`, then one `tasks` query). "Edit plan" opens the plan editor. The complete editing ritual lives at `/plan?step=ritual`; see [Planning, tasks, habits, and routines](./planning-tasks-habits.md).

`TasksSection` marks a task that has a block in today's plan with "In plan", next to its due date ("Due Oct 30", "Overdue"). Its check-off is one `role="checkbox"` control named "Complete <title>".

### Daily Reflection

One question a day, and one step from reading it to answering it.

The prompts are authored in `src/lib/daily-reflection.ts` and walked one per calendar day, so the list's length is the rotation and the same date always yields the same question — on the dashboard, in the entry form it opens, and when the entry is read back later. That derivation is why the list is append-only: reordering it rewrites what older reflections appear to have asked.

The answer is written through the normal journal entry form against the `Daily Reflection` system template, seeded by `supabase/migrations/20260911120000_create_daily_reflection_template.sql` and referenced by a fixed id rather than by name. Reflections therefore earn XP, count towards the streak, and can be marked as insights like every other entry. Once today's reflection exists the section links to it instead of starting a second one.

The section is in the visibility registry as `reflection`, so it can be turned off in settings like the others.

### Admin-only dashboard additions

Trusted or route-allowlisted admins may also see:

- Active goals.
- Habit routines.
- Learning/knowledge summaries.
- Admin-specific quick actions.

These additions must not make admin data queryable by normal users.

## Quick actions

The center navigation action opens shortcuts to common creation flows. The dashboard also recognizes query-string shortcuts:

```text
/dashboard?quick=task
/dashboard?quick=habit
/dashboard?quick=plan
/dashboard?quick=goal
/dashboard?quick=routine
```

`plan` redirects to the immersive planner. `task` and `habit` redirect to `/tasks?new=1` and `/habits?new=1`, which open the create form straight away, as the sheet's "Task" and "Habit" entries do. The form's `?new=1` is removed from the address once it closes (`history.replaceState`), so a reload does not reopen it. Goal and routine actions are admin-only in the current product.

Trusted/route-allowlisted admins additionally see a "LifeQuest Labs" entry at the top of the quick action sheet linking to `/admin`. The standard bottom navigation has no persistent admin entry point, so this is currently the only in-app way to reach the admin workspace on mobile without typing the URL.

## Feedback

`FeedbackDialog` (`src/components/feedback/FeedbackDialog.tsx`) is reachable from the dashboard footer and the `/profile` header. It asks for a kind ("Something is not working", "An idea", "Something else") and a message of up to 2000 characters, and inserts one row into `beta_feedback` with the page path it was sent from (no query string; `src/lib/feedback.ts`). The send button is locked while sending, the text stays in the form when sending fails, and the error is shown under the field. Admins read the latest entries on `/admin/tools`. The table comes from `supabase/migrations/20261025120000_beta_feedback_and_activation.sql`; until that migration is applied, sending shows the failure message.

## Navigation


The standard mobile navigation contains:

1. Home.
2. Journal.
3. Quick action.
4. Library (`/learn`). The tab, the quick action sheet entry and the page title all say "Library" (they used to say Library, Learn and "Lifequest Academy"). It stays highlighted on the pages below it, such as `/learn/tools`.
5. Profile (`/profile`), drawn as the player's own head with the equipped hat (`AvatarHead`) rather than a generic icon; a ring around the head marks the active tab. It was labelled "Avatar" while the page said "Profile"; both say Profile now, and the page description names the avatar, progress and account. Settings has no tab of its own: it opens from the Settings button on `/profile`, and the Profile tab stays highlighted on `/settings`.

The top bar (level, XP, coins, streak) sits above the page on the same routes. The standard shell is hidden on immersive workflows, including Today Plan, journal entry forms, routine execution, and admin pages. This prevents competing navigation while the user is completing a focused flow.

## Settings

`/settings` supports:

- Profile name.
- Profile timezone (same grouped, runtime-derived picker as onboarding).
- White, system, or dark appearance.
- AI assistant consent.
- Routine management where authorized.
- Sign-out.
- Permanent account deletion.

Account deletion requires the user to enter the authenticated email and is completed by a server-only endpoint. See [Authentication, authorization, and privacy](../backend/auth-security.md).

## Refresh contract

Client mutations use one or both of:

- `router.refresh()` to re-run Server Components.
- The `lifequest-data-updated` browser event to notify listening widgets.

New dashboard-connected mutations should follow this contract. Do not rely only on changing the Zustand store, because a refresh or new session must reconstruct the same state from Supabase.

## Experimental routes

`/dashboard2` is an alternate dashboard retained for product exploration. It is not the canonical dashboard and may diverge from `/dashboard`.

