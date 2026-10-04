# Konzept: Persönliche Kontaktverwaltung in LifeQuest

Stand: 4. Oktober 2026. Ursprüngliches Konzept; die erste Version ist in [Contacts](../features/contacts.md) dokumentiert. Die nachfolgenden Abschnitte beschreiben die Entwurfsentscheidungen.

## 1. Ziel und Grundentscheidung

Ein eigener Admin-Reiter **Kontakte** verbindet ein persönliches Adressbuch mit Beziehungskontext, wichtigen Tagen und Wiedervorlagen. Er hilft, Menschen und gemeinsame Geschichte im Blick zu behalten und rechtzeitig aktiv zu werden. Private und berufliche Kontakte werden gemeinsam verwaltet; Aufgaben und ausführliche Notizen nutzen die bestehenden LifeQuest-Funktionen.

Ein Kontakt beschreibt eine Person aus deinem Umfeld. Er ist kein LifeQuest-Nutzerkonto und löst weder Einladung noch Kontaktaufnahme aus. Es gibt keine automatische Bewertung von Freundschaften und keine XP für Kontaktpflege.

## 2. Vorhandene Grundlage

| Vorhanden | Verwendung im Vorschlag |
| --- | --- |
| `src/components/admin/AdminShell.tsx` | Neuer Navigationseintrag Kontakte |
| `src/components/ui/` | Bestehende Dialoge, Eingaben, Buttons und Menüs |
| `src/components/tasks/TaskEditorDialog.tsx`, bestehende `tasks` | Wiedervorlagen und konkrete nächste Schritte |
| Bestehende Tasks und Daily Planner | Dieselbe Aufgabe planen und erledigen, ohne Kopie |
| `src/components/admin/AdminNotesHub.tsx`, `knowledge_notes` | Ausführliche Kontakt- und Gesprächsnotizen |
| `src/components/calendar/CalendarOverview.tsx` | Gemeinsame Monats-/Wochenansicht |
| `src/lib/calendar/calendar-data.ts`, `calendar-window.ts` | Vorhandene Kalenderabfragen und Datumsnavigation erweitern |
| `src/lib/work/context.ts`, bestehende Admin-Guards | Eigentümer, Admin-Zugriff und Profilzeitzone |

Der Kalender liest aktuell Tagespläne und Task-Fälligkeiten. Kontaktanlässe benötigen eine zusätzliche Datenquelle. Sie sind ganztägige Ereignisse; sie werden nicht als künstliche Tasks oder Tagesplanblöcke gespeichert. Projektspezifische Bereichstabellen werden nicht zweckentfremdet; Kontakte brauchen mehrere Gruppenzuordnungen.

## 3. Übersicht und Navigation

Vorgeschlagene Routen:

- `/admin/contacts`: Übersicht mit Suche, Filtern und Listen-/Kartenansicht.
- `/admin/contacts/[contactId]`: direkt verlinkbares Kontaktprofil.
- `/admin/contacts?view=upcoming`: wichtige Tage und Wiedervorlagen.
- `/admin/contacts?view=archive`: archivierte Kontakte mit Wiederherstellung.
- `/admin/work/calendar`: bestehender Kalender, ergänzt um Kontaktanlässe.

Die Übersicht startet mit einer kompakten Leiste: **Anstehende Tage**, **Fällige Wiedervorlagen**, **Favoriten**. Darunter steht die Kontaktliste. Sortierung nach Name, letztem Kontakt oder nächstem Anlass; Suche nach Name, Organisation und Tags; Filter nach Gruppe und aktiv/archiviert. Suchzustand und Ansicht bleiben in der URL.

Eine Karte zeigt Name, Organisation/Rolle, Gruppen, letzten Kontakt und nächsten Anlass. Telefon, E-Mail und große Freitextnotizen bleiben im Profil. Kontakte werden in einem Dialog erstellt und bearbeitet. Für die erste Speicherung reicht der Anzeigename; optionale Angaben lassen sich später ergänzen. Gleichnamige Personen sind erlaubt. Hinweise auf gleiche Namen/E-Mails sind Hinweise, keine automatische Zusammenführung.

## 4. Kontaktprofil

Vier Tabs: **Überblick**, **Beziehungen**, **Verlauf & Notes**, **Termine & Aufgaben**. Der Überblick ist der Einstieg. Tab und Rückweg bleiben beim Öffnen einer Note erhalten.

| Bereich | Angaben |
| --- | --- |
| Identität | Anzeigename, optional Vor-/Nachname, Spitzname; zunächst Initialen als Avatar |
| Erreichbarkeit | Mehrere E-Mails, Telefonnummern und HTTP-/HTTPS-Links mit Bezeichnung; bevorzugter Kontaktkanal |
| Kontext | Organisation, Rolle, Ort, Kennenlernumstände, Interessen, kurze Merkhilfe |
| Einordnung | Frei benennbare Gruppen/Tags, Favorit, aktiv oder archiviert |
| Beziehungspflege | Letzter Kontakt, gewünschter Kontaktabstand optional, nächste konkrete Wiedervorlage |

Gruppen beginnen mit Privat und Beruflich; weitere Beispiele sind Familie, Freunde und Netzwerk. Ein Kontakt darf mehreren Gruppen angehören. Die Gruppierung beschreibt deinen Bezug zur Person; sie ersetzt nicht deren Beziehungen zu anderen Kontakten.

Schnellaktionen: **Kontakt bearbeiten**, **Kontakt festhalten**, **Wiedervorlage erstellen**, **Besonderen Tag hinzufügen**, **Note verknüpfen**. Erstellung und Bearbeitung öffnen jeweils einen eigenen Dialog. Lange Notizen öffnen den vorhandenen Knowledge-Editor.

## 5. Beziehungen zwischen Personen

Beziehungen sind Verknüpfungen zwischen zwei bestehenden Kontakten. Beispielsweise:

- Anna ↔ Ben: Partner / Partnerin.
- Anna → Mia: Mutter von; auf Mias Profil erscheint Anna als Mutter.
- Ben ↔ Tom: Kollegen.
- Tom → Anna: durch Anna kennengelernt.

Vorgeschlagene Voreinstellungen: Familie, Partnerschaft, Freundschaft, Kollegen, Vorgesetzter/Mitarbeiter, Kunde/Ansprechpartner und Kennengelernt durch. Frei benennbare Beziehungstypen erhalten entweder dieselbe Bezeichnung in beide Richtungen oder zwei passende Bezeichnungen. Die Eingabe zeigt einen lesbaren Satz, damit die Richtung verständlich ist.

Eine symmetrische Beziehung wird einmal gespeichert und auf beiden Profilen dargestellt. Gerichtete Beziehungen zeigen dort jeweils die richtige Perspektive. Selbstbeziehungen und versehentliche identische Doppelverknüpfungen werden verhindert. Verschiedene Beziehungen zwischen denselben Personen bleiben möglich. Beziehungen können eine kurze Notiz und optional Beginn/Ende erhalten; beendete Beziehungen bleiben als Historie sichtbar.

Die erste Version verwendet eine klare Personenliste mit Rolle und Profil-Link. Eine grafische Netzwerkansicht folgt erst später als zusätzliche Ansicht; auch dort werden nur ausdrücklich eingetragene Beziehungen angezeigt, keine vermuteten Familien- oder Bekanntschaftsverhältnisse.

## 6. Besondere Tage und gemeinsamer Kalender

Ein Anlass besitzt Titel, Typ, zugeordnete Personen, Datum, Wiederholung, optionale Notiz, Erinnerungsregel und Kalender-Sichtbarkeit. Typen: Geburtstag, Hochzeitstag/Jubiläum, Gedenktag und eigener Anlass. Ein Anlass darf mehrere Personen betreffen: Ein Hochzeitstag von Anna und Ben erscheint auf beiden Profilen, aber einmal im Kalender.

**Datumsregeln:**

- Geburtstage/Jubiläen können jährlich wiederkehren; andere Anlässe wahlweise einmalig oder jährlich.
- Unbekannte Geburtsjahre sind zulässig: Tag und Monat reichen. Alter und Jubiläumszahl erscheinen nur bei bekanntem Ursprungsjahr.
- Einmalige Termine brauchen ein vollständiges Datum. Ein jährlicher Anlass mit bekanntem Ursprungsjahr erscheint nicht davor.
- Datum und Jahr werden nicht über UTC-Mitternacht umgerechnet. Die Profilzeitzone bestimmt, was heute und fällig ist.
- Für den 29. Februar ist die Regel sichtbar einstellbar: 28. Februar, 1. März oder nur Schaltjahre. Vorschlag als sichtbarer Standard: 1. März.
- Ein Ereignis wird nur einmal gespeichert. Seine Vorkommen entstehen für das angezeigte Kalenderfenster, einschließlich sichtbarer Randtage; keine jährlich kopierten Datenbankzeilen.

Im Kalender ergänzen Filter **Tagespläne**, **Aufgaben** und **Kontakte** die vorhandene Monats-/Wochenansicht. Geburtstage und andere Kontaktanlässe erhalten unterscheidbare Symbole und eine eigene Liste in den Tagesdetails. Anklicken öffnet den Anlass und die zugeordneten Profile. Auf kleinen Displays zeigt die Tageszelle Anzahl/Symbol; die vollständige Liste steht in den Tagesdetails.

Datumsänderungen gelten sofort für die nächsten Anzeigen und Erinnerungen. Das Entfernen eines Anlasses hinterlässt keine kopierten Kalendereinträge. Beim Archivieren eines Kontakts verschwinden dessen ausschließlich ihm zugeordnete Anlässe aus der aktiven Vorschau; ein gemeinsamer Anlass bleibt für aktive zugeordnete Kontakte sichtbar. Die Historie bleibt erhalten.

## 7. Erinnerungen, Verlauf und bestehende Aufgaben

**Erinnerungen:** Zunächst innerhalb von LifeQuest: Heute, nächste 7/30 Tage und überfällige Wiedervorlagen. Pro Anlass sind z. B. Erinnerungen 7 Tage vorher und am Tag selbst wählbar. Diese Hinweise werden beim Öffnen berechnet; die erste Version verspricht keine Push-Nachricht bei geschlossener App. E-Mail/Push und Google-/Outlook-Synchronisierung wären separate Erweiterungen.

Erinnerungszustand und Ereignis sind getrennt: „Erledigt“ oder „Später erinnern“ gilt für das konkrete Vorkommen, nicht für alle zukünftigen Geburtstage. Das Ereignis bleibt im Kalender. Ein optionaler Kontaktabstand liefert einen Vorschlag „Wieder melden“; er erzeugt keine endlose Serie von Tasks.

**Wiedervorlagen:** „Ben wegen Angebot anrufen“ öffnet den bestehenden Task-Editor mit Termin. Neue oder bestehende Aufgaben lassen sich mit einem oder mehreren Kontakten verknüpfen und optional weiterhin einem Projekt zuordnen. Task-ID, Erledigungszustand und Planner-Verknüpfungen bleiben erhalten. Die Erledigung allein verändert das Datum des letzten tatsächlichen Kontakts nicht.

Für „Geschenk besorgen“ aus einer Anlass-Erinnerung wird eine vorhandene Verknüpfung zur gleichen Anlass-Instanz erkannt, statt bei Doppelklicks weitere Aufgaben anzulegen. Ohne ausdrückliche Aktion werden keine Aufgaben erzeugt.

**Verlauf:** „Kontakt festhalten“ erfasst Datum, Kanal, beteiligte Personen und eine kurze Zusammenfassung. Die neueste nicht zukünftige Interaktion bestimmt den letzten Kontakt; Löschen oder Korrigieren berechnet ihn neu. Ein Gespräch kann mehreren Kontakten zugeordnet werden und bleibt eine einzige Interaktion. Ausführliche Details stehen in optional verknüpften Knowledge-Notes. Eine Note darf mehreren Kontakten und weiterhin Projekten zugeordnet sein. Entfernen einer Kontaktverknüpfung löscht weder Note noch Aufgabe.

Kontaktinformationen werden nicht automatisch in Task-Beschreibungen kopiert: Tasks und ihre bewusst gewählten Titel können auch in deinen normalen Tasks-/Planner-Ansichten erscheinen. Kontaktprofile und Kontaktverknüpfungen bleiben zunächst im Admin-Bereich.

## 8. Vorgeschlagenes Datenmodell

**Additive Supabase-Migrationen erforderlich; dieses Konzept führt keine Migration aus.** Namen sind Vorschläge für die Umsetzung, keine vorhandenen Tabellen.

| Neue Entität | Verantwortung |
| --- | --- |
| `contacts` | Eigentümer, Identität, Kontext, Favorit, Archivstatus, Kontaktpräferenzen |
| `contact_channels` | E-Mails, Telefon und Links mit Label und Reihenfolge |
| `contact_groups`, `contact_group_members` | Frei benennbare Gruppen und Mehrfachzuordnung |
| `contact_relationship_types`, `contact_relationships` | Beziehungstyp, Richtung, zwei Kontakte, Zeitraum und Merkhilfe |
| `contact_events`, `contact_event_members` | Einmalige/jährliche Anlässe, Datumsbestandteile, Erinnerungseinstellungen und Beteiligte |
| `contact_event_occurrence_states` | Bestätigung/Aufschub eines bestimmten Vorkommens; optional zugehörige Task-ID |
| `contact_interactions`, `contact_interaction_members` | Kontaktverlauf mit mehreren Beteiligten |
| `knowledge_note_contacts` | Verknüpfung bestehender Notes mit Kontakten |
| `task_contacts` | Verknüpfung bestehender Tasks mit Kontakten |

Kontaktanlässe werden als zusätzliche Quelle in einen gemeinsamen Kalender-Lesestand übersetzt. Vorkommensschlüssel bestehen aus Ereignis-ID und konkretem Datum; Titel und Kontaktname sind keine Identifikatoren. Wiederholungsberechnung und Reminder-Berechnung verwenden dieselbe Datumslogik. Notizbearbeitung und Task-Erledigung bleiben in ihren bestehenden Funktionen.

## 9. Datenintegrität und Zugriff

- Jede neue Entität und Verknüpfung gehört einem Eigentümer. Datenbankregeln verhindern Kontakte, Notes und Tasks fremder Eigentümer in denselben Beziehungen.
- Admin-Routen und Datenbankzugriff werden getrennt geschützt. Zum Start gilt Eigentümer plus vertrauenswürdige Admin-Rolle; die bestehende Route-Allowlist allein eröffnet keinen Datenzugriff.
- Kontakte bleiben von registrierten LifeQuest-Nutzern und Admin-Nutzerstatistiken getrennt. Andere Admins sehen nicht automatisch deine Kontaktverwaltung.
- Persönliche Kontaktinformationen werden nicht automatisch dem vorhandenen KI-Chat-Kontext oder öffentlichen Ansichten hinzugefügt.
- Archivieren/Wiederherstellen ist die normale Aufräumaktion. Dauerhaftes Löschen braucht eine Bestätigung und eine Vorschau der Auswirkungen. Notes und Tasks bleiben erhalten; nur die Verknüpfungen werden entfernt. Gemeinsame Anlässe/Interaktionen bleiben bei übrigen Beteiligten erhalten.
- Mehrteilige Schreibvorgänge erfolgen atomar. Versions-/Zeitstempelprüfungen verhindern stille Überschreibungen in zwei geöffneten Profilen. Fehler erhalten Dialogeingaben und bieten einen erneuten Versuch.
- Übersicht und Suchdialoge werden paginiert; Gesamtzahlen und nächste Termine berücksichtigen den vollständigen Datenbestand. Kalender lädt nur Vorkommen für sein sichtbares Fenster. Fehler werden nicht als leere Kontaktliste oder leerer Kalender ausgegeben.

## 10. Umsetzung in drei Schritten

| Schritt | Ergebnis |
| --- | --- |
| 1. Kontakte und Beziehungen | Navigation, Übersicht/Suche/Filter, Gruppen, Profil, Kanäle, Beziehungen, Archiv, Eigentümerregeln |
| 2. Anlässe und Kalender | Besondere Tage mit mehreren Personen, jährliche Wiederholung, Kalenderquelle/Filter und Hinweise innerhalb der App |
| 3. Alltag und Verknüpfungen | Kontaktverlauf, Knowledge-Notes mit Rückweg, vorhandene Tasks/Wiedervorlagen, Kontaktabstand und Zustände je Anlass-Vorkommen |

Diese drei Schritte bilden die erste vollständige Version. Netzwerkgraph, Avatar-Uploads, Import/Export, automatische Dubletten-Zusammenführung, zeitgenaue Kontakttermine und externe Kalender-/Nachrichtenintegrationen folgen bei Bedarf danach. Der bestehende Tagesplan bildet weiterhin zeitgenaue Planung ab.

## 11. Beispiel und Abnahme

Du legst Anna an, ergänzt ihre Telefonnummer, Interessen und Geburtstag ohne Jahr. Ben wird als Partner verknüpft. Beide erhalten denselben Hochzeitstag. Im Kalender stehen Annas Geburtstag und ein gemeinsamer Hochzeitstag. Eine Woche vorher erscheint der Hinweis; „Geschenk besorgen“ legt eine Aufgabe im bestehenden Tasksystem an, die du im Daily Planner einplanst. Nach dem Treffen hältst du eine kurze Interaktion fest und verknüpfst eine Gesprächsnotiz. Alle Daten sind anschließend aus beiden Kontaktprofilen erreichbar.

Die Abnahme prüft insbesondere:

- Speichern, Neuladen, Suchzustand, Archivierung/Wiederherstellung und fehlgeschlagene Änderungen ohne Draft-Verlust.
- Gerichtete und symmetrische Beziehungen aus beiden Perspektiven; gleiche Namen, mehrere Beziehungen und fremde IDs.
- Wiederkehrende Tage über Jahreswechsel, unbekannte Jahre, 29. Februar, Profilzeitzonen und gemeinsame Anlässe ohne Kalender-Duplikate.
- Erledigen/Aufschieben eines Reminder-Vorkommens ohne Veränderung des nächsten Jahres; Doppelklicks erzeugen keine zweite Anlass-Aufgabe.
- Bestehende Tasks und Notes zuordnen/entfernen; Planner, Projektzuordnung und andere Verknüpfungen bleiben erhalten.
- Kontaktkorrekturen, Löschung, Archiv und Änderungen an gemeinsam verwendeten Anlässen.
- Mehrere offene Tabs, große Datenbestände, vollständige Zahlen und Desktop/Tablet/Mobilgerät mit Tastaturbedienung.
- Eigentümer- und Admin-Grenzen über Datenbanktests sowie keine Kontaktinformationen im KI-Kontext oder öffentlichen Kontaktabfragen.

Vor einer Umsetzung werden die vorgeschlagenen Datenänderungen lokal geprüft. Eine Anwendung auf die gemeinsame Staging-/Production-Datenbank gehört zu einem gesondert freigegebenen Implementierungsschritt.
