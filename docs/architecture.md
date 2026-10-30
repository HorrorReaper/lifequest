# Architecture

## Technology stack

| Layer | Technology |
| --- | --- |
| Web framework | Next.js 16.2 App Router |
| UI runtime | React 19.2 |
| Language | TypeScript with strict mode |
| Styling | Tailwind CSS 4 and CSS variables |
| UI components | Local shadcn-style primitives, Base UI, Radix Slot |
| Authentication/database | Supabase Auth, Postgres, RLS, RPCs |
| Browser Supabase integration | `@supabase/ssr` |
| Local app state | React state and Zustand |
| Charts | Recharts |
| Drag and drop | dnd-kit |
| Animation | Framer Motion |
| Markdown | React Markdown, remark-gfm |
| Barcode scanning | lazy-loaded ZXing browser package |
| Testing | Vitest, jsdom, React Testing Library |
| Hosting | Vercel connected to GitHub `master` |

## Application layers

```text
Browser
├── Public pages and authentication UI
├── Authenticated client components
│   ├── React local state
│   ├── sessionStorage/localStorage drafts
│   ├── Zustand XP/coins/streak presentation state
│   └── Publishable Supabase browser client
└── Next.js route requests

Next.js server
├── Server Components fetch initial authenticated data
├── proxy.ts refreshes Supabase sessions and enforces onboarding
├── Route handlers validate auth, admin status, consent, and inputs
└── Server-only external provider calls

Supabase
├── Auth and JWT app metadata
├── Postgres tables
├── Row Level Security policies
├── Atomic Security Invoker RPCs
└── Auth Admin API for account deletion
```

## Rendering model

- Route pages under `src/app/(app)` are mostly Server Components. They validate the session, fetch initial data, and pass serializable props into client components.
- Interactive managers such as `TaskManager`, `HabitManager`, `TodayPlanner`, `WorkoutHub`, and `NutritionHub` are Client Components.
- Public marketing pages render without the authenticated app shell.
- The app shell adds a sticky top bar (level, XP, coins, streak), the bottom navigation and, for admins, the chatbot. It suppresses both on immersive routes such as `/plan`, journal entry screens, routine runners, and all admin pages.
- The admin layout uses a separate responsive shell with desktop sidebar and mobile horizontal navigation.

## Authentication lifecycle

1. Email/password, Google OAuth, or a password-reset recovery link begins in the browser.
2. `/auth/callback` exchanges the Supabase code for a cookie-backed session.
3. A profile is created (inserted) if one does not exist.
4. Incomplete profiles are sent to `/onboarding`; a recovery session is sent to `/reset-password`.
5. Onboarding completion upserts the profile rather than updating it, so a session that reached `/onboarding` without going through step 3 (for example sign-up with email confirmation disabled) still gets a row instead of silently affecting zero rows and looping back to onboarding forever.
6. `src/proxy.ts` runs `updateSession` for every authenticated route group and API routes — see [Authentication and security](./backend/auth-security.md) for the current list.
7. Server pages independently call `supabase.auth.getUser()` before loading data.

## Supabase clients

- `src/lib/supabase/server.ts` creates a typed cookie-aware server client.
- `src/lib/supabase/client.ts` creates a typed browser client using only publishable values.
- `src/lib/supabase/middleware.ts` refreshes tokens and writes updated cookies.
- Server-only service credentials are used only by `/api/account`.

## State and synchronization

### Authoritative state

Supabase is authoritative for user data. Most managers load their own data and write through the publishable client subject to RLS.

### Presentation state

`src/lib/stores/user-store.ts` holds current XP, coins, streak, equipped avatar items, and level-up presentation state. The `(app)` layout loads the first four from Supabase on every request (`fetchShellStats` in `src/lib/shell-stats.ts`) and `AppShell` copies them into the store after mount (`useShellStats`); until then it renders the server props directly, because the store is a module singleton that is shared between requests on the server. The top bar and the bottom navigation's avatar icon read from it. The bottom navigation still refreshes authoritative XP and coins after mount.

### Cross-component refresh

Mutating components dispatch a browser event named `lifequest-data-updated`. Dashboard/task/habit consumers listen for it or call `router.refresh()` so server-rendered data catches up.

### Draft state

| Workflow | Storage | Scope |
| --- | --- | --- |
| Mobile journal | `sessionStorage` | user + template or entry |
| Today planner | `sessionStorage` | user + date |
| Knowledge notes | `localStorage` | note ID or new note |
| Active workout set edits | React state until blur, set completion, or workout finish |

Journal and Today Plan drafts are tab-session-local by design and do not sync across devices.

## Transaction boundaries

Atomic Postgres functions are used where multi-table integrity is particularly important:

- Workout start and finish.
- Workout template save and clone.
- Saved meal and recipe logging.
- Knowledge note save with links/version checks.
- Project creation with its home note.
- Quest reward claims and challenge progress.

Some older browser workflows still perform sequential multi-table writes, notably journal submission, routine item replacement, city building placement, and parts of saved meal/recipe creation. See [Known constraints](./reference/known-limitations.md).

## Date and timezone strategy

`src/lib/dates.ts` is the single source for every date key in the application. Nothing else may define one.

It separates two concepts that the codebase previously mixed:

- A **date key** is a `YYYY-MM-DD` string naming a calendar day, with no time or zone attached. Arithmetic on it goes through day numbers (`addDays`, `daysBetween`), so a daylight-saving transition cannot produce a 23- or 25-hour day.
- An **instant** is a `Date`. Converting one to a date key always requires naming a zone, which is why `dateInTimezone(date, timezone)` and `hourInTimezone(date, timezone)` take the timezone as a required argument — no caller can silently fall back to the server's zone.

Rules:

- Profiles store an IANA timezone, and it is the answer to "what day is it for this user". Dashboard, Today Plan, habits, the journal landing page, and journal entry submission all derive their date keys from it.
- `localDateKey` reads the calendar fields off a `Date` and is only for a `Date` whose fields the user chose directly, such as a date picker's selection. Never use `toISOString()` for this: local midnight in any zone ahead of UTC serializes to the previous day.
- `parseLocalDate` and `formatDateOnly` handle a date key at noon so that no zone offset can move it into an adjacent day.
- A page that needs "today" resolves it on the server with `dateInTimezone(new Date(), profileTimezone)` and passes the date key to its client components as a prop. Client components must not compute it themselves: it avoids a hydration mismatch at the midnight boundary, and it keeps the UI in step with the RPCs that enforce the same day server-side.

## Design system

The global design system is implemented through:

- `src/app/globals.css` for theme variables, animation, safe areas, and global styles. The White and Trail themes soften vivid gradients by overriding `--tw-gradient-from` / `--tw-gradient-to` on `[class*="from-primary"]`, `[class*="to-purple"]` and similar. Those overrides must be a plain colour: Tailwind 4 registers both properties as `<color>` (`@property`), so a v3-style value such as `hsl(…) var(--tw-gradient-from-position)` is invalid, falls back to transparent, and makes every matching gradient disappear (this hid the icon tile in the dashboard's ritual prompts).
- `src/components/ui/` for reusable controls.
- `ThemeProvider` for `white`, `system`, and `dark` appearance modes.
- `AppShell`, `BottomNav`, and `AdminShell` for navigation structure.
- `AdminPageHeader` and feature-level cards/sheets/dialogs for the admin workspace.

The app uses `min-h-svh`/`min-h-dvh`, sticky actions, touch-sized controls, and responsive dialogs. Desktop and mobile often share business logic but use different density and navigation patterns.

### Core page rules

Applied to the core user pages (dashboard, tasks, habits, plan, onboarding, profile, library) for the first beta. New core UI follows them:

- **Spacing** in steps of 4, 8, 12, 16, 24 and 32 px. Page gutters are 16 px on phones and 32 px from `sm` (`p-4 sm:p-8`); forms and long text stay within about 640–720 px.
- **Type.** Body text and inputs 16 px (`text-base`), supporting text 14 px (`text-sm`; no 10–12 px text for anything that explains an action), section titles 18–20 px, page titles 28 px / 32 px from `sm` (`PageHeader`).
- **Targets.** Primary buttons 48 px high (`h-12`); every essential control at least 44 × 44 px. Card radius 16 px (`rounded-2xl`), inputs and buttons 10–12 px.
- **Page header.** `src/components/ui/page-header.tsx`: title, optional eyebrow and one-line description, and the page's main action. A create action belongs there, never at the bottom of a list where the fixed navigation covers it.
- **Create/edit** opens in a dialog that asks for the one required field first and folds the rest under "Details (optional)".
- **States.** Selected options use `aria-pressed` with the primary border, a 10 % primary fill and a ring. Saving disables the submit button, shows "Saving…" and is guarded by a ref so a second tap sends nothing. Errors are one message next to the field concerned (`aria-invalid` + `aria-describedby`), the input is kept, and the button offers a retry. Done states pair colour with a tick or a word ("Done", "Open", "In today's plan").
- **Completion** is one control per item: `CompletionToggle` (`role="checkbox"`, named "Complete …"/"Reopen …").
- **Layers.** Dialogs sit at `z-50`; popovers, selects, menus and tooltips put `z-[90]` on their positioner, so they open above a dialog.
- **Contrast.** Measured against the theme tokens in `globals.css` for all four modes (light, dark, white, trail): body text, muted text on background, card and muted surfaces, primary, and the destructive colour on background and on its 10 % tint all reach at least 4.5:1. Dark mode's destructive colour was 2.0:1 and light mode's 3.8:1 before this rule.
