Thema: [[LifeQuest]]
Stand: 2026-09-20 · Branch `staging`
Siehe auch: [[App & Codebase Overview]] · [[Lead Magnet – Unfuck Your Life Challenge]]

# Rituale & Prompts

Die vier „automatischen“ Rituale sind Dialoge, die sich auf `/dashboard` selbst öffnen und irgendwohin führen. Seit dem 19.09. sind sie **admin-konfigurierbar** (`/admin/rituals`), davor war alles hart codiert.

## Die vier Rituale

| Ritual | Komponente | Standardfenster | Führt zu | „Erledigt“ heißt |
|---|---|---|---|---|
| Daily Plan („Morning Briefing“) | `DailyPlanPrompt` | täglich ab 00:00 | `/plan` → `TodayPlanner` (6-Schritte-Wizard: Mood → Intention → Top Three → Anchors → Timeline → Commit) | `day_plans.notes` enthält `ritual_completed_at` |
| Evening Review („Daily Review“) | `EveningReviewPrompt` | täglich ab 20:00 | `/journal/new/<template>` | fertiger Journal-Eintrag mit dem Ziel-Template **heute** |
| Weekly Review | `WeeklyReviewPrompt` | Sonntag ab 18:00 | `/journal/new/<template>` | fertiger Eintrag mit dem Ziel-Template in **dieser Woche** (Mo–So) |
| Weekly Plan | `WeeklyPlanPrompt` | Montag ab 00:00 | `/journal/new/<template>` | wie Weekly Review |

Alle vier liegen in `src/components/dashboard/`, verdrahtet in `src/app/(app)/dashboard/page.tsx` (Server Component, berechnet Fenster, Erledigt-Status und Copy).

## Mechanik

- **Fenster:** eine Regel für alle vier — `isRitualWindow(setting, today, nowMinutes)` = `enabled && (weekday === null || weekdayOf(today) === weekday) && nowMinutes >= fromMinutes`. Wochentag Mo = 0 … So = 6 (`weekdayOf()` in `src/lib/dates.ts`, **nie** `Date.getDay()`). Zeiten sind Minuten nach Mitternacht in der **Profil-Zeitzone**.
- **„Not now“** wird in localStorage gemerkt: `lifequest-ritual-<ritual>-dismissed-<period>`; `period` = Datum bei den Tages-Ritualen, **Montag der Woche** bei den Wochen-Ritualen. Der Key läuft mit der nächsten Periode von selbst ab.
- **Vorrang-Regel („hold-back“):** Weekly Review hält das Evening Review zurück, Weekly Plan den Daily Plan — solange das Wochen-Fenster offen ist, kein Wochen-Eintrag existiert und ein Ziel-Template gesetzt ist. Erst nach „Not now“ oder Erledigen kommt der Tages-Prompt. Sonst würden am Sonntagabend zwei Dialoge übereinander liegen.
- **Kein Ziel-Template** (`template_id = null`, z. B. Template gelöscht) → Prompt bleibt unsichtbar statt auf 404 zu führen.
- Gemeinsamer Hook `usePromptDismissal(key)` / `usePromptHeldBack(key)` in `prompt-dismissal.ts`; hydration-sicher (Server rendert „dismissed“, damit nichts vor der Hydration aufblitzt).
- **Preview-Modus:** jedes Prompt hat optional `onPreviewClose` — dann öffnet es sich unabhängig von allem, schreibt keinen Dismissal-Key und der CTA navigiert nicht. Wird vom Test-Button im Admin-Hub genutzt.

## Datenbank: `ritual_settings`

Migration `20260919120000_create_ritual_settings.sql`. Eine Zeile pro Ritual:

```
ritual (PK: daily_plan | evening_review | weekly_review | weekly_plan)
enabled, weekday (0–6 | null), from_minutes (0–1439)
template_id → journal_templates (on delete set null)
title, description, cta_label   -- {name} wird zum Usernamen, Fallback „Adventurer“
updated_at, updated_by
```

- RLS: lesen alle Eingeloggten, **update nur JWT `app_metadata.role = 'admin'`**, kein Insert/Delete (die 4 Zeilen sind das ganze Set).
- Seed = exakt das vorherige Verhalten (`on conflict do nothing`). Evening-Review-Template wird beim Seed **per Namen** gesucht (`is_system and name = 'Evening Review' and is_active`), weil es von Hand angelegt wurde; die Weekly-Templates haben feste IDs.
- Code-Defaults in `src/lib/rituals.ts` (`DEFAULT_RITUAL_SETTINGS`) — das Dashboard funktioniert auch ohne Seed. `normalizeRitualSettings(rows)` fällt **pro Feld** auf Defaults zurück und wirft nie.

> [!warning] RLS-Falle, gelernt
> Ein `UPDATE`, das die `USING`-Policy herausfiltert, liefert **204 ohne Error** (0 Zeilen). Ohne `.select()` sieht das wie Erfolg aus. Deshalb `supabaseUpdateWhereReturning` in `helpers.ts` — 0 zurückgegebene Zeilen = „not allowed“.

## Weekly-Templates (System-Journal-Templates)

Migration `20260918120000_create_weekly_ritual_templates.sql`, `entry_type: 'weekly'`, je 50 XP, `sort_order` 101/102 (hinter Daily Reflection, damit die 6-Slot-Journal-Nudge nicht verdrängt wird).

- **Weekly Review** 📝 `5c1c3f0e-9a4b-4d7e-8f21-7b3e2a6d9c01` — Best moment · Biggest struggle · Do differently next week · Overall rating (⭐ 1–5) · Free reflection
- **Weekly Plan** 🗓️ `a7d4e2b1-3c6f-4e8a-9b05-2f1d8c7e6a02` — Theme of the week (Pflicht) · Outcome 1 must win (Pflicht) · Outcome 2 · Outcome 3 · What I will protect · Known obstacles

„Next week's theme“ ist bewusst vom Review in den Plan gewandert (Landing-Page-Copy entsprechend angepasst, Test pinnt die Felder).

## Admin-Hub `/admin/rituals`

`src/components/admin/RitualsHub.tsx`, Nav-Eintrag „Rituals“ (BellRing) hinter Productivity. Vier Karten, je: Switch An/Aus · Wochentag-Select (nur weekly) · `<input type="time">` · Template-Select (nur journal-backed, mit „— none —“ + Warnung) · Titel/Beschreibung/CTA mit Live-Vorschau des Titels („Alex“) · **Test**-Button (öffnet den echten Prompt mit dem *ungespeicherten* Entwurf) · Save (nur wenn dirty).

- Allowlist-Admins (`ADMIN_EMAILS`, kein JWT-Role) sehen alles **read-only** mit Hinweis; Test geht trotzdem.
- Änderungen gelten **für alle User** beim nächsten Dashboard-Load (kein Cache).
- Die Statistikzeilen in der Vorschau sind Platzhalter (2/3 habits, 4 tasks …).

## Journal-Wizard: eine Frage pro Schritt, überall

Seit 20.09.: `EntryForm` zeigt in **jeder Breite** einen Schritt (vorher nur < 768px, am Desktop lange Seite). Desktop-Karte mit „Step 2 of 5“ + Segmentleiste (`JournalStepProgress`), Fuß „Cancel | Back | Next/Save Reflection“. Pflichtfeld-Prüfung beim Weiterblättern, Sprung zum ersten unvollständigen Schritt beim Speichern. Gilt für alle Journal-Templates.
Dateien umbenannt: `mobile-journal-*` → `journal-wizard.tsx`, `journal-navigation.tsx`, `journal-discard-dialog.tsx`.

## Prompts testen (Checkliste)

1. `select ritual, enabled, weekday, from_minutes, template_id from ritual_settings;` — `evening_review.template_id` darf nicht null sein.
2. Test-Button im Hub: Text prüfen, „Not now“ darf nichts merken, CTA darf nicht navigieren.
3. Echter Prompt: Fenster im Hub auf heute/jetzt stellen, `/dashboard` neu laden. Vorrang-Regel beachten (Weekly vor Daily).
4. Kommt nichts: (a) schon erledigt? (b) weggeklickt → Konsole: `Object.keys(localStorage).filter(k => k.startsWith('lifequest-ritual-')).forEach(k => localStorage.removeItem(k))` (c) Profil-Zeitzone.
5. **Danach zurückstellen** — die Werte sind global.

## Offen / Backlog

- **Spec 2:** User-Overrides für Zeiten (`profiles.ritual_overrides jsonb`, Merge in TS, Abschnitt in `/settings`).
- **Spec 3:** Trusted Admins editieren `is_system`-Templates im Builder in place (heute nur Kopie); braucht RLS + Schutz für Felder mit bestehenden Einträgen.
- Im Hub: deaktiviertes Template driftet im Select; Karte synct nach Fremd-Änderung nicht; leerer `.in()`-Roundtrip wenn beide Weekly-Templates null.
- Wochen-Scoping: legt ein Admin das Weekly Plan auf Sonntag, zählt „erledigt“ gegen die *endende* Woche.
- `TaskEditorDialog.test.tsx > … date-only due date` war einmal flaky in der vollen Suite (isoliert grün).

## Specs & Pläne im Repo

- `docs/superpowers/specs/2026-09-19-ritual-settings-admin-design.md` (Status: implemented)
- `docs/superpowers/plans/2026-09-19-ritual-settings-admin.md` (7 Tasks, subagent-driven umgesetzt)
