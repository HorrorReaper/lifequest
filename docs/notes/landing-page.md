Thema: [[LifeQuest]]
Stand: 2026-09-20 · `src/app/page.tsx` + `src/components/marketing/` · Branch `staging`
Siehe auch: [[App & Codebase Overview]] · [[Competitive Landscape & USP]] · [[Lead Magnet – Unfuck Your Life Challenge]]

# Landing Page

Die aktuelle Seite ist der **dritte** Anlauf: erst die dunkle „Nightfall City“-Version (Aug.), dann am 2026-09-04 „rebuild the landing page plain and light“ (`d2e4e54`), seitdem ~20 kleine Commits (echte Screenshots, Templates zitieren statt beschreiben, Zahlen zahlen aus, was die App zahlt, getippte Headline). `/landing2` existiert noch als Experiment daneben.

## Stil

- **Hell und ruhig:** Hintergrund `#fdfcf9`, Text `#1b1a17`, Muted `#6f6b63`, Akzent Amber `#d1870b` / `#9a6200`, Rahmen `#eae5da`. Kein Dark-Theme auf der Landing.
- **Fonts** über `src/lib/marketing-fonts.ts`: `--font-nightfall-display` (Headlines, extrabold) + `--font-nightfall-body`. Die „Nightfall“-Namen sind vom Vorgänger geblieben.
- Sektionen erscheinen per `Reveal` (fade/translate beim Scrollen); Zahlen zählen per `useCountUp` hoch.
- Copy-Regel, die sich durch die Commit-History zieht: **die Seite darf nichts versprechen, was die App nicht tut** — Templates werden wörtlich zitiert (Test pinnt die Felder), XP-Werte entsprechen den echten, „streak freezes“ wurden gestrichen, weil es sie nicht gibt.

## Aufbau (von oben nach unten)

| # | Sektion | Komponente | Inhalt |
|---|---|---|---|
| 0 | Navbar | `layout/Navbar` | Logo „Life**Quest**“, Anker How it works / Features / Roadmap / Pricing; bei `IS_MVP` „Log in“ + „Get started“ (→ `/login`), sonst Waitlist-Button |
| 1 | **Hero** | `TypedHeading` + `ProductPanels.DashboardPanel` | Headline „Your life is a game. Time to start playing!“ tippt sich Zeichen für Zeichen; Sub: „Your journal, habits, daily plan and tasks all in one place. Get rewarded for showing up …“; CTA + „See how it works“; rechts (ab `lg`) ein nachgebautes Dashboard-Panel mit Tasks/Habits |
| 2 | **How it works** (`#how`) | `HowItWorks` + `StepArt` | Drei Schritte mit echten Screenshots (`/public/images/how-*.png`) und einer gezeichneten „Trail“-Linie: **Write** (Template wählen; die Copy sagt hier „14 different fields“, die Features-Sektion „sixteen field types“ — der Code hat 16) → **Finish** (Einträge/Tasks/Habits erledigen, XP) → **Level up** (Charakter, Skills, Coins für Customizing) |
| 3 | **Features** (`#features`) | `Features` + die Panels aus `ProductPanels` | Sechs Blöcke, je Headline mit Amber-Keyword + Panel: JOURNAL adjusted to you (`TemplatesPanel`, Tabs mit den geseedeten Templates) · HABITS that pay more the longer it runs (`StreakPanel`) · REFLECT DAILY (`ReflectionPanel`, Besucher kann die Tagesfrage selbst beantworten) · TOOLS & RESOURCES (`ToolsPanel`) · METRICS & LEARNINGS (`MetricsPanel`) · TASKS & DAY PLANNER (`PlannerPanel`) |
| 4 | **My Mission** | `Mission` | Persönlicher Absatz: „the best tool for self-improvement … your personal Operating System for your life“ |
| 5 | **Roadmap** (`#roadmap`) | `Roadmap` | Shipped: The daily loop · Insights and metrics — In progress: Depth over breadth + Challenges — Planned: The city returns · Mobile apps · The social layer |
| 6 | **Pricing** (`#pricing`) | `Pricing` | „Completely for free. No trial, no card, no tiered features.“ — bewusst **kein** Pro-Tier |
| 7 | Closing | — | auskommentiert („Two minutes tonight …“) |
| 8 | Footer | — | © 2026, Privacy / Terms / Contact |
| ∞ | Sticky CTA | `StickyCta` | erscheint nach 1,4 Viewport-Höhen Scroll, verschwindet kurz vor dem Seitenende |

## Der MVP-Schalter

`NEXT_PUBLIC_IS_MVP === "true"` bedeutet **„die App ist live“**:

| | `IS_MVP=true` | `IS_MVP=false` |
|---|---|---|
| Primary CTA (`PrimaryCta`) | „Get started — it's free“ → `/login` | „Join the waitlist“ → `WaitlistModal` |
| Sticky CTA | dito | dito |
| Pricing-Button | dito | dito |

> [!note] Ich hatte das im Ritual-Brainstorm einmal falsch herum beschrieben — `true` öffnet das Signup, `false` sammelt die Waitlist.

## Waitlist-Funnel

`WaitlistModal` (`source="hero"`) → `POST /api/waitlist`:
- Honeypot-Feld, Adress-Check, Rate-Limit **pro IP im Speicher der Serverless-Instanz** (5 pro 10 min — hält Loops auf, nicht Angreifer; die echten Guards sind der Unique-Index auf `email` und RLS)
- schreibt mit `SUPABASE_SERVICE_ROLE_KEY` (Fallback: Publishable Key) in `waitlist_signups (email, name, source, interested_pro, early_access, newsletter)`
- Bestätigungsmail „You're on the LifeQuest waitlist“ über **Resend REST** (`RESEND_API_KEY`), bewusst ohne SDK
- `docs/routes.md` behauptet noch „currently logs it server-side“ — veraltet.

## Tests

`src/app/page.test.tsx` (Hero-Copy, CTA je nach MVP-Flag, Counter), `ProductPanels.test.tsx` (zitierte Template-Felder je Tab, Panel-Höhe), `NightfallHero.test.tsx` (Altlast), `TypedHeading.test.tsx`. Wer die Hero-Zeile ändert, muss den Test mitziehen — genau das ist am 19.09. einmal passiert (`ddb7a47` ohne Test → rot auf `staging`, `e562ed6` hat es behoben).

## Technische Notizen

- `page.tsx` ist eine Client Component (`useState` fürs Waitlist-Modal); `TypedHeading` dagegen bewusst **reines CSS ohne Hooks** — die Headline steht vollständig im Server-HTML (SEO, kein Layout-Shift, `prefers-reduced-motion` in `globals.css`).
- `HowItWorks` misst die Trail-Linie über die `offsetParent`-Kette statt `offsetTop`, weil `Reveal` Transforms setzt — Kommentar im Code erklärt das.
- Bilder liegen unter `public/images/` (`how-write.png`, `how-earn.png`, `how-levelup.png`; `Step1–3.png` sind ältere Varianten, `login-bg.*` gehört zum Login).

## Offene Punkte / Ideen

- `/landing2` und `NightfallHero` sind Altlasten — aufräumen, wenn die neue Seite steht.
- „Contact“ im Footer verlinkt auf `/contact`, das es als Route nicht gibt (nur `/privacy`, `/terms`).
- Roadmap sagt „Challenges in progress“ → passt zur Lead-Magnet-Idee ([[Lead Magnet – Unfuck Your Life Challenge]]); eine eigene Challenge-Seite unter `/challenge/<slug>` wäre die erste zweite öffentliche Seite.
- Deine Audit-Notiz (Adventure-Redesign, Color Palette) betrifft die **App**, nicht die Landing — die Landing ist inzwischen hell/amber und davon unabhängig.
