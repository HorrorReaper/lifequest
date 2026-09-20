Thema: [[LifeQuest]]
Stand: 2026-09-20 · Status: **Brainstorm, nichts gebaut**
Siehe auch: [[Audit + Ideas]] (dort eigener Zweifel: „free Version fungiert ja schon als Lead-Magnet“) · [[Rituale & Prompts]] · [[Competitive Landscape & USP]]

# „Unfuck Your Life“ — 14-Tage-Challenge als Lead Magnet

## Getroffene Entscheidungen

| Frage | Entscheidung |
|---|---|
| Primäres Ziel | **App-Registrierungen**, nicht E-Mail-Liste. Der Einstieg *ist* der LifeQuest-Account. |
| Was ist ein Challenge-Tag | **Echte Aktion in der App**, automatisch erkannt („Tag 2: Lege deine ersten 3 Habits an“, „Tag 4: erstes Evening Review“, „Tag 7: Weekly Review“). Die Challenge ist ein geführter Einstieg in die Features. |
| Registrierung beim Launch | **Offen.** CTA führt direkt ins Signup (`?challenge=unfuck-your-life`). Voraussetzung: `NEXT_PUBLIC_IS_MVP=true` (= App live, CTAs gehen auf `/login`) — oder der Challenge-Pfad ignoriert das Flag. |
| Ansatz | **A** (unten), noch nicht final abgenickt — der nächste Schritt war der Inhaltsvorschlag für die 14 Tage. |

## Was das Repo schon hat (und wiederverwendet wird)

- **Challenge-Programme komplett vorhanden:** `challenge_templates` (Titel, Dauer, `schedule_mode` sequential/strict, XP/Coins, `is_published`), `challenge_days` (Tag 1–n: Titel, Anleitung ≤ 2000 Zeichen, Reflexionsfrage), `challenge_enrollments` (ein aktives pro User+Template), `challenge_day_progress` (ein Tag pro Kalendertag, Notiz). Admin-Editor `/admin/challenges`, User-Seite `/quests` mit `ChallengeProgramCard` (Start / Tag abhaken mit Notiz). **Nur manuelles Abhaken**, keine Bedingungen. Nur für `authenticated` lesbar.
- **Quest-System = Vorbild für Auto-Erkennung:** `DEFAULT_QUESTS` in `src/lib/quests.ts` sind codedefiniert, jede hat `getProgress(stats)` auf einem kleinen `QuestStats`-Snapshot (`totalEntries, bestStreak, totalBuildings, level`); „claimable“ wenn `progress >= target`; Belohnung per idempotenter RPC `claim_system_quest_reward`.
- **Waitlist-Funnel:** `/api/waitlist` (Honeypot, Rate-Limit pro IP, Service-Role-Key) → `waitlist_signups (email, name, source, interested_pro, early_access, newsletter)` + Bestätigungsmail über **Resend** (REST, kein SDK). ⚠️ Der Overview-Note von August („persistiert nicht“) ist überholt.
- **Landing Page** `src/app/page.tsx` mit MVP-Schalter, Waitlist-Modal, Pricing; Templates-Panel zitiert die geseedeten Journal-Templates (Test pinnt die Felder).
- **Nicht vorhanden:** Scheduler für zeitversetzte Mails (kein Cron), öffentliche Ansicht von Challenge-Inhalten.

## Die drei Ansätze

**A — Codedefinierter „guided path“ auf dem bestehenden Challenge-System (Empfehlung)**
Die 14 Tage im Code (`src/lib/challenges/unfuck-your-life.ts`): je `title, instructions, actionHref, target, getProgress(snapshot)`. Ein `ChallengeSnapshot` (Habits angelegt, Check-ins seit Start, Journal-Einträge je Template seit Start, committete Tagespläne, Tasks angelegt/erledigt, Streak, Weekly Review …) einmal pro Dashboard-Load. Enrollment + Fortschritt in den **vorhandenen** Tabellen gegen eine geseedete `challenge_templates`-Zeile + 14 `challenge_days` (damit `/quests`, Belohnungs-RPCs, Admin-Editor weiterlaufen; Titel/Anleitung nach dem Seed im Editor änderbar, Regeln bleiben Code).
➕ kein Regel-Interpreter, typsicher, reine Funktionen testbar, wenig Infrastruktur. ➖ neue Regeltypen = Deploy.

**B — Datendefinierte Regeln** (`completion_rule jsonb` an `challenge_days`) + Interpreter + Regel-Picker im Editor. Für künftige Auto-Challenges ohne Deploy. ~3× Aufwand von A; YAGNI für einen Lead Magnet, später aus A extrahierbar.

**C — Reiner E-Mail-Kurs** (Resend + Cron). Passt nicht zum Ziel; verworfen. Tägliche Erinnerungsmails = Phase 2.

## Der Funnel (A und B gleich)

1. **Öffentliche Seite** `/challenge/unfuck-your-life` — eigene Copy, 14-Tage-Überblick, CTA. Eigene URL für Ads/Social.
2. **Signup-Deep-Link** `?challenge=unfuck-your-life` → Cookie (`lifequest-challenge-intent`) → nach Onboarding schreibt der Server das Enrollment (Start = heute) → Dashboard.
3. **Dashboard-Karte** „Tag 3 von 14: …“ mit Deep-Link-Button und Status — neue Sektion `challenge` im Sektionen-Register (`src/lib/dashboard-sections.ts`), nur mit aktivem Enrollment.
4. **Auto-Abschluss** beim Dashboard-Load: Regeln gegen Snapshot, neu erfüllte Tage serverseitig idempotent eintragen, Belohnung über bestehende RPC (`complete_challenge_program_day`).
5. **Verpasster Tag** wartet einfach (sequential). Keine Strafe — Produktlinie „nichts Punitives, nichts Soziales, solange keine User-Basis“.
6. **Phase 2:** tägliche Mail über Resend + Vercel Cron.

## Nächste Schritte

- [ ] Ansatz A bestätigen
- [ ] Vorschlag für die 14 Tage (welche App-Aktion an welchem Tag; Dramaturgie „aufräumen → Rhythmus“) — bestimmt, welche Snapshot-Zahlen nötig sind
- [ ] Sektions-Design → Spec unter `docs/superpowers/specs/` → Plan → Umsetzung
- [ ] Offen: Name „Unfuck Your Life“ auf der Landing/in Ads vs. In-App-Bezeichnung; Was gibt es am Ende (XP/Coins reichen? Abschluss-Screen?)
