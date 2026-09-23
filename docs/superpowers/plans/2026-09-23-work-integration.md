# LifeQuest Work – Umsetzungsplan

Stand: 23.09.2026 · Status: Erster Integrationsabschnitt implementiert; weitere Phasen offen

### Implementierter erster Abschnitt

- Work-Einstieg unter `/admin/work` mit bestehender Tagesplanübersicht und bestehenden Tasks.
- Gemeinsamer Daily Planner unter `/plan` und `/admin/work/plan`, mit identischen Daten, Entwürfen und Speicherfunktionen.
- Bestehende Projekte unter `/admin/work/projects`; Projektfilter und projektbezogene Neuanlage über den vorhandenen Task-Manager.
- Verlinkung auf bestehende Fokus- und Knowledge-Bereiche; bisherige Routen bleiben erhalten.
- Keine Datenbankmigration und kein separater Aufgaben-/Planungsbestand. Bestehende Tasks behalten ihre bisherige Sichtbarkeit beim jeweiligen Nutzer.

Dies ist der erste Durchstich aus den Phasen 1–4, keine vollständige Abnahme dieser Phasen. Workspaces, zusätzliche private Datenscopes, Inbox, Whiteboards, Karten, Kalenderintegrationen, Import und Extension-Synchronisierung bleiben offen. Die angemeldete Oberfläche muss zusätzlich mit einem Admin-Konto visuell geprüft werden.

## 1. Ziel und Umfang

Focus Desk wird als zusammenhängendes Arbeitssystem im privaten LifeQuest-Adminbereich abgebildet. Der neue Hauptreiter **Work** verbindet Erfassen, Projekte, Aufgaben, Tagesplanung, konzentriertes Arbeiten und Tagesabschluss.

LifeQuest wird die zentrale Oberfläche und nach der Migration die maßgebliche Datenquelle. Die Chrome-Extension bleibt für Browserfunktionen wie Website-Sperren, Tabgruppen, Sidepanel und Seitenerfassung bestehen und wird schrittweise angebunden.

Der vollständige Umfang umfasst auch Notizen, Whiteboards, Lernkarten, Workspaces, Erinnerungen, Wiederholungen, Suche, Integrationen, Import/Export und personalisierbare Ansichten. Ein nutzbarer erster Release ist ein Zwischenziel, keine Reduzierung dieses Umfangs.

Grundlage ist die Quellcodeanalyse beider Repositories. Laufende Oberflächen, reale Bestandsdaten und externe Verbindungen wurden noch nicht geprüft. Aussagen über vorhandene Funktionen beziehen sich auf den untersuchten Code; vorgeschlagene Tabellen und Routen sind Zielentwürfe.

## 2. Produktentscheidungen

1. **Eigener Reiter Work:** Der Umfang rechtfertigt einen eigenen Arbeitsbereich unter `/admin/work`.
2. **Bestehende Funktionen weiterverwenden:** Bestehende Tasks und der bestehende Daily Planner sind verbindlich die Grundlage für Work – einschließlich ihrer Komponenten, Fachlogik und Datenhaltung. Work integriert diese Funktionen und ergänzt nur tatsächlich fehlende Fähigkeiten. Es entstehen weder ein neuer Task-Manager noch ein zweiter Daily Planner oder separate Work-Block-Datenbestände. Auch Projekte, Knowledge und Fokus-Sessions werden weiterverwendet.
3. **Schrittweise Ablösung:** Productivity und Projects bleiben während der Entwicklung erreichbar. Ihre arbeitsbezogenen Funktionen ziehen erst nach erfolgreicher Abnahme um.
4. **LifeQuest-Gestaltung:** Arbeitsabläufe und Funktionsumfang stammen aus Focus Desk; Komponenten, Typografie, Farben und mobile Bedienung folgen LifeQuest.
5. **Private Arbeitsdaten:** Neue Work-Daten bleiben admin-exklusiv und nutzergebunden. Die bestehenden öffentlichen LifeQuest-Funktionen bleiben funktionsfähig.
6. **XP-Regel beibehalten:** Nur abgeschlossene Fokus-Sessions vergeben gemäß bestehender Logik XP. Import, Synchronisierung, Projektfortschritt und Aufgabenimport lösen keine Belohnungen aus.

## 3. Zielstruktur der Oberfläche

| Bereich | Zielroute | Inhalt |
| --- | --- | --- |
| Heute | `/admin/work` | Tagesfokus, drei Prioritäten, Zeitachse, Aufgabenbank, Fokussteuerung, Tagesabschluss |
| Inbox | `/admin/work/inbox` | Ideen, Links, Aufgaben und Notizen erfassen, bearbeiten, zuordnen und verarbeiten |
| Projekte | `/admin/work/projects` | Projektübersicht, Filter, Suche, Archiv |
| Projektdetail | `/admin/work/projects/[id]` | Übersicht, Board, gruppierte Liste, Notizen, Ressourcen, Whiteboard, Meilensteine |
| Aufgaben | `/admin/work/tasks` | Eingebundene bestehende Tasks; Projekt-/Workspace-Filter auf demselben Bestand |
| Kalender | `/admin/work/calendar` | Ansicht des bestehenden Daily Planners; bei Bedarf erweitert um Woche, Erinnerungen und externe Termine |
| Workspaces | `/admin/work/workspaces` | Arbeitskontexte, Projekte, Linkfavoriten, gespeicherte Tabs und erlaubte Domains |
| Karten | `/admin/work/cards` | Eigene Lernkarten, fällige Wiederholungen und Lernsitzungen |
| Einstellungen | `/admin/work/settings` | Fokus, Arbeitszeiten, Darstellung, Verbindungen und Datenverwaltung |
| Fokusansicht | `/admin/work/focus` | Reduzierte Vollbildansicht mit Aufgabe, Timer und Sessionsteuerung |

Globale Suche und Schnellerfassung sind von jeder Work-Seite erreichbar. Einstellungen und Karten können als sekundäre Navigation erscheinen, damit die Hauptnavigation übersichtlich bleibt. Die Zielrouten bezeichnen Einstiegspunkte bzw. Ansichten; sie sind kein Auftrag, vorhandene Funktionen neu zu bauen. Tasks und Daily Planner werden über gemeinsam genutzte Komponenten eingebunden oder zunächst direkt verlinkt.

**Knowledge** bleibt der zentrale Notizbestand. Work zeigt kontextbezogene Ansichten derselben Notizen. **Rituals**, Gewohnheiten, Ziele und **Learning** behalten ihre eigenständige Bedeutung. Wiederkehrende Arbeitsblöcke werden von Ritualen unterschieden; persönliche Lernkarten werden nicht ungeprüft mit vorhandenen Lerninhalten zusammengelegt.

Die bisherige Productivity-Seite dient während des Übergangs als Einstieg. Nach Funktionsparität werden verbleibende persönliche Übersichten sinnvoll verlinkt und alte Projekt-/Fokus-URLs auf entsprechende Ziele weitergeleitet. Bestehende Notiz-Deep-Links bleiben gültig.

## 4. Architektur und Datenmodell

### 4.1 Verantwortlichkeiten

- **LifeQuest:** Oberfläche, dauerhafte Datenhaltung, Projekt- und Aufgabenlogik, Planung, Suche und Integrationsstatus.
- **Chrome-Extension:** Browserrechte, lokale Durchsetzung von Sperren, Tabaktionen, New-Tab-Ersatz, Popup, Kontextmenü und Sidepanel.
- **Gemeinsame Fachlogik:** Statusübergänge, Wiederholungen, Planung, Kartenintervalle und Importvalidierung werden als testbare Module mit klaren Verträgen aufgebaut. Eine gemeinsame Bibliothek zwischen Repositories ist optional; ein versioniertes Austauschformat ist verpflichtend.
- **Synchronisierung:** Änderungen werden über authentifizierte, versionierte Schnittstellen übertragen. Browseraktionen sind explizite Befehle mit Ausführungsbestätigung; ein Datensatz allein darf nicht unkontrolliert Tabs öffnen oder Fokus starten.

Das große `newtab.js` und der Extension-Service-Worker werden nicht als monolithische Komponenten übertragen. Die Umsetzung erfolgt entlang der Fachbereiche.

### 4.2 Bestehende Daten erweitern

| Bestand in LifeQuest | Geplante Ergänzung bzw. Wiederverwendung |
| --- | --- |
| `projects` | Workspace-Zuordnung; vorhandene Outcomes, Status, Health, Meilensteine und Hauptnotiz erhalten |
| `tasks` | Bestehende Daten, Mutationen und Aufgabenkomponenten nutzen; Workspace, Gruppen oder Labels nur bei nachgewiesener Lücke ergänzen. Planung mit dem bestehenden Daily Planner verknüpfen |
| Knowledge-Tabellen | Projekt-/Aufgabenverknüpfungen weiterverwenden; Workspace-Kontext ergänzen |
| `focus_sessions` | Workspace-/Arbeitsblockbezug und eindeutige Herkunft; bestehende XP-Idempotenz erhalten |
| `day_plans` | Bestehende Datenquelle samt `blocks` und Planner-Logik direkt verwenden; notwendige Metadaten kompatibel ergänzen |
| Tagesprioritäten | In Heute übernehmen und mit demselben Aufgabenbestand verbinden |

### 4.3 Neue fachliche Entitäten

Vorläufig vorgesehen sind Workspaces, Projekt-Aufgabengruppen, Inbox-Einträge, Projektressourcen, Wiederholungsserien mit Ausnahmen, Erinnerungen, Whiteboards, persönliche Lernkarten mit Wiederholungsverlauf und Work-Einstellungen. Neue Entitäten werden nur eingeführt, wenn vorhandene Modelle die jeweilige Funktion nicht bereits abdecken. Aufgaben und Planungsblöcke zählen ausdrücklich nicht zu neuen Entitäten.

Zusätzlich werden externe Kalenderverknüpfungen, Synchronisierungsstände, Importzuordnungen und bei Bedarf Änderungsprotokolle benötigt. Zugangsdaten gehören in einen getrennten geschützten Bereich und nicht in allgemeine Einstellungen oder Exportdateien.

**Arbeitsblöcke:** Der Begriff bezeichnet die bestehenden Blöcke des Daily Planners in `day_plans.blocks`. Es wird keine separate Work-Block-Tabelle und keine Synchronisierung zwischen zwei Planern eingeführt. Aufgabenbezüge und vorhandene Quellverknüpfungen werden weiterverwendet; fehlende Angaben für Status, Serien, Erinnerungen oder externe Kalender werden nur bei Bedarf kompatibel ergänzt. Änderungen aus Work und aus dem bisherigen Daily Planner bearbeiten denselben Tagesplan über dieselbe Fachlogik. Bestehende persönliche Blöcke bleiben erhalten.

**Privatsphäre bei gemeinsam genutzten Tabellen:** Bereits vorhandene persönliche Aufgaben dürfen weiterhin in der öffentlichen Benutzeroberfläche erscheinen. Neue private Work-Aufgaben brauchen eine explizite Sichtbarkeitsregel, etwa einen Scope mit sicherem Standardwert. Alle betroffenen Abfragen, KI-Kontexte, Suchpfade und Datenbankregeln müssen diese Unterscheidung berücksichtigen. Ein Admin-Routenpräfix allein genügt nicht.

### 4.4 Import- und Statuszuordnung

| Focus Desk | LifeQuest-Ziel |
| --- | --- |
| Aufgabenstatus `backlog` | `backlog` |
| `planned` | `todo` plus separater Planungstag/Arbeitsblock |
| `in-progress` | `in_progress` |
| `waiting` | Vorläufig `blocked`; Wartegrund und ursprüngliche Bedeutung erhalten |
| `done` | `done` plus konsistenter Abschlusszustand |
| Projekt `archived` als separates Flag | Archivzustand mit erhaltenem vorherigem Status für Wiederherstellung |
| Eingebettete Unteraufgaben | Unteraufgaben mit `parent_task_id` |
| Lokale Zeichenketten-IDs | Ziel-IDs mit dauerhafter Zuordnung zu Quelle und Importbestand |
| Millisekunden-Zeitstempel | Eindeutig konvertierte Zeitstempel; reine Datumswerte bleiben Datumswerte |

Die Zuordnung wird vor dem produktiven Import anhand echter anonymisierter Beispieldaten geprüft. Unterschiedliche Statusbedeutungen dürfen nicht stillschweigend verloren gehen.

## 5. Entwicklungsphasen

### Phase 0 – Bestand prüfen und Verträge festlegen

**Arbeitspakete**

- Beide Oberflächen im laufenden Zustand prüfen, zentrale Nutzerabläufe aufnehmen und eine vollständige Funktionsliste anlegen. Bestehende Task- und Daily-Planner-Komponenten, Mutationen und Fähigkeiten zuerst erfassen; jedes Arbeitspaket als Wiederverwendung oder konkrete fehlende Ergänzung kennzeichnen.
- Beispielexport der Extension einschließlich Whiteboards und optionaler Bilder untersuchen; keine Tokens oder aktiven Sessions übernehmen.
- Bestehende Tabellen, Berechtigungen, Aufgabenstatus-Trigger und Tagesplan-Verknüpfungen prüfen.
- Datenverantwortung, Work-Sichtbarkeit, Statuszuordnung, Serienmodell und Extension-Vertrag festhalten.
- Für jede Funktion Zielbereich, Plattform, Entwicklungsphase und Abnahmekriterium definieren.

**Abnahme:** Jede Extension-Funktion ist einem Umsetzungspaket zugeordnet; offene Entscheidungen zu privaten Aufgaben und Tagesplänen sind vor Schemaänderungen geklärt.

### Phase 1 – Work-Grundgerüst und sichere Datenbasis

**Arbeitspakete**

- Work-Navigation und responsive Bereichsstruktur erstellen; neue Oberfläche zunächst über Feature-Schalter bereitstellen.
- Kleine Fachmodule und Komponenten unter `src/lib/work` und `src/components/admin/work` aufbauen.
- Workspace-Basis und erforderliche Erweiterungen bestehender Modelle mit Migrationen, Zugriffsregeln und Typen ergänzen.
- Bestehende Daten mit verträglichen Standardwerten erhalten; Lade-, Leer-, Fehler- und Berechtigungszustände definieren.
- Bestehende Mutationslogik für Tasks und Daily Planner gemeinsam nutzen; nötigenfalls aus ihren bisherigen Seiten extrahieren, ohne das Verhalten neu zu implementieren. Dasselbe gilt für Projektmutationen.

**Abnahme:** Berechtigte Admins können Work öffnen; normale Nutzer erhalten weder über die Oberfläche noch direkte Datenzugriffe private Work-Daten. Bestehende Aufgaben, Projekte und Notizen funktionieren unverändert.

### Phase 2 – Projektmanagement und Aufgaben

**Arbeitspakete**

- Bestehenden ProjectsHub fachlich übernehmen und um Workspace-Wechsel, Projektdetails und Archiv/Wiederherstellung erweitern.
- Übersicht, Kanban mit Verschieben und gruppierte Listenansicht umsetzen.
- Bestehende Task-Ansichten und Aufgabendetails einbinden; Markdown, Labels, Schätzung, Fälligkeit, Planungsbezug, Unteraufgaben und Status nur dort ergänzen, wo die Bestandsaufnahme eine Lücke zur Extension zeigt.
- Projektlinks und Ressourcen sowie bestehende Meilensteine, Health und Notizverknüpfungen integrieren.
- Aufgaben projektübergreifend suchen und filtern; bestehende Knowledge-Notizen im Projektkontext öffnen.

**Abnahme:** Ein Projekt lässt sich von Anlage über Planung und Bearbeitung bis Abschluss/Archiv bedienen. Verschieben, Erledigen und Wiederherstellen zeigen überall denselben Zustand.

### Phase 3 – Inbox, Erfassen und Suche

**Arbeitspakete**

- Ideen, Aufgaben, Links und Notizen schnell erfassen und später bearbeiten.
- In Projektaufgaben, Knowledge-Notizen oder Ressourcen umwandeln; Quelle, URL und Verarbeitungshistorie behalten.
- Wiederherstellung verarbeiteter Einträge mit klarer Regel für bereits erzeugte Zielobjekte anbieten.
- Bereichsübergreifende Suche mit typisierten Ergebnissen und Deep-Links aufbauen; neue Entitäten später ergänzen.

**Abnahme:** Mehrfachklicks oder Wiederholungen erzeugen keine unbeabsichtigten Duplikate. Suchtreffer führen zum richtigen Objekt und respektieren Sichtbarkeit und Archivzustand.

### Phase 4 – Bestehenden Daily Planner und Fokus in Work integrieren

**Arbeitspakete**

- Heute aus dem bestehenden Daily Planner, vorhandenen Tasks, Tagesprioritäten und Fokus-Komponenten zusammensetzen.
- Vorhandenes Erstellen, Bearbeiten, Verschieben und Verknüpfen von Planungsblöcken übernehmen; Projekt-/Workspace-Kontext nur bei Bedarf ergänzen.
- Kalenderansichten auf denselben Daily-Planner-Daten aufbauen; Wochenansicht, Überlappungen, Ganztagsbereich oder Jetzt-Markierung nur ergänzen, soweit noch nicht vorhanden.
- Vorhandene Planungslogik nutzen. Fehlende automatische Planung anhand Arbeitszeit, Priorität, Aufwand und belegter Zeiten als Erweiterung des bestehenden Planners umsetzen, mit Vorschau vor Übernahme.
- Bestehenden Fokus-Timer und Auswertungen integrieren; Session und Arbeitsblock fachlich getrennt halten.
- Tagesabschluss mit erledigten/offenen Blöcken, Vergleich zum Vortag und Übertrag auf morgen anbieten.

**Abnahme:** Der Ablauf bestehende Task → Block im bestehenden Daily Planner → Fokus → Tagesabschluss funktioniert durchgehend. Änderungen sind sowohl in Work als auch den bisherigen Task-/Planner-Ansichten sichtbar, ohne Datenkopie oder Abgleich zwischen zwei Systemen. Neuladen oder mehrere offene Tabs starten keine doppelten Sessions und vergeben keine doppelten XP. Eine zweite Planung erzeugt keine Doppelbelegung derselben Aufgabe ohne bewusste Entscheidung.

**Meilenstein A:** Work ist für den täglichen Projekt- und Planungsbetrieb nutzbar. Import wird erst nach Phase 7 freigegeben.

### Phase 5 – Wiederholungen, Erinnerungen und Hintergrundverhalten

**Arbeitspakete**

- Tägliche, werktägliche, wöchentliche und monatliche Serien einschließlich Intervallen und Ausnahmen ergänzen.
- Einzelvorkommen und ganze Serien unterscheiden; Pausieren, Fortsetzen, Überspringen und Beenden anbieten.
- Eigenständige Erinnerungen mit Erledigungszustand implementieren.
- Erinnerungszustellung und zeitgesteuerte Aktionen zwischen Web-Backend und Extension aufteilen; kein Verlass auf einen laufenden Seitentimer.
- Automatischen Fokusstart, optionale Workspace-Öffnung, Nachholen verpasster Starts und Abschlussbenachrichtigungen koordinieren.

**Abnahme:** Serien werden idempotent materialisiert, erledigte Vergangenheit bleibt erhalten. Sommerzeit, Monatsenden, offline verbrachte Zeit und mehrere Geräte sind geprüft. Pro Ereignis wird eine Benachrichtigung bzw. Browseraktion nachvollziehbar ausgelöst.

### Phase 6 – Whiteboards, Karten und persönliche Ansichten

**Arbeitspakete**

- Projektwhiteboard mit Zeichnen, Formen, Text, Auswahl/Verschieben, Löschen, Zoom, Pan, Undo und Vollbild portieren.
- Versioniertes Whiteboard-Format, Autosave, begrenzte Schreibfrequenz und Konfliktbehandlung bei mehreren Tabs einführen.
- Persönliche Lernkarten mit SM-2-Wiederholungen, fälligen Karten und Lernmodus integrieren.
- Anpassbares Dashboard mit sichtbaren/verschiebbaren Widgets sowie Hintergrund- und Transparenzeinstellungen ergänzen.
- Moment-Ansicht mit Uhr, Begrüßung, Tagesfokus, Zitaten und persönlicher Bildbibliothek anbieten.

**Abnahme:** Whiteboards bleiben nach Neuladen und Import vollständig bearbeitbar; Kartenintervalle sind reproduzierbar. Einstellungen speichern zuverlässig und die Ansichten bleiben mobil lesbar.

### Phase 7 – Datenübernahme und Backup

**Arbeitspakete**

- JSON-Import mit Schema-/Versionsprüfung, Vorschau, Anzahl je Objekttyp und Konfliktbericht entwickeln.
- Zunächst sicheren Import in einen getrennten Importkontext anbieten, bestehende LifeQuest-Daten nicht ersetzen.
- Projekte, Aufgaben, Unteraufgaben, Gruppen, Notizen, Links, Inbox, Pläne, Serien, Erinnerungen, Karten, Whiteboards und Einstellungen übernehmen.
- Herkunfts-IDs und Importläufe speichern; Wiederholung eines Imports darf keine Duplikate erzeugen.
- Optional Bilder separat übernehmen; laufende Sessions, temporäre Freigaben und Zugangsdaten ausschließen.
- Export mit dokumentiertem Format und geprüfter Wiederherstellung ergänzen; abgebrochene Imports fortsetzen oder gezielt zurücknehmen können.

**Abnahme:** Anzahl, Beziehungen und repräsentative Inhalte stimmen mit der Quelle überein. Wiederholter Import bleibt stabil. Rollback eines Importlaufs entfernt keine bereits bestehenden oder zwischenzeitlich unabhängig bearbeiteten Daten.

### Phase 8 – Google Calendar, Obsidian und Notion

**Arbeitspakete**

- Google Calendar für die Webanwendung anbinden; der OAuth-Platzhalter der Extension ist keine nutzbare Produktionskonfiguration.
- Kalenderwahl, Leseansicht und Zwei-Wege-Synchronisierung verknüpfter Arbeitsblöcke mit Konflikt-/Fehlerzuständen umsetzen.
- Zuständigkeit für externe Synchronisierung pro Verbindung eindeutig vergeben, damit Web und Extension nicht doppelt schreiben.
- Obsidian-Recall, Projekt-/Tagesexport und Rückimport bearbeiteter Notizen samt Konfliktschutz erhalten. Lokaler Vault-Zugriff bleibt an ein autorisiertes Gerät gebunden.
- Notion zunächst entsprechend der Extension als einseitigen Spiegel umsetzen; Projekte, Aufgaben und die tatsächlich unterstützten Inhalte aus Phase 0 berücksichtigen.
- Verbindungsstatus, letzte erfolgreiche Synchronisierung, Wiederholungsversuche und Trennen einer Verbindung sichtbar machen.

**Abnahme:** Externe Änderungen, Löschungen, abgelaufene Berechtigungen und Wiederholungen werden nachvollziehbar verarbeitet. Ein nicht lesbarer Kalender blockiert nicht alle anderen. Unabhängig bearbeitete Obsidian-Dateien werden nicht still überschrieben.

### Phase 9 – Extension als Browser-Anbindung

**Arbeitspakete**

- Extension sicher mit dem LifeQuest-Konto verbinden und Workspace-/Projektkontext synchronisieren.
- Popup, Kontextmenü, Tastenkürzel und Sidepanel für Erfassen, Projektzuordnung und Fokussteuerung anbinden.
- Gespeicherte Tabs, Tabgruppen und Favoriten aus Work steuern und Ergebnisse zurückmelden.
- Website-Allowlist, harte Sperre, Mathematik-, Karten-, Absichts- und Aufgaben-Freischaltung sowie temporäre Freigaben erhalten.
- New-Tab-Verhalten für Dashboard/Moment integrieren; Offline-Cache und Änderungswarteschlange vorsehen.
- Wiederholte Nachrichten deduplizieren, Änderungen versionieren und Löschungen synchronisieren. Konflikte sichtbar machen, statt sie pauschal nach letzter Schreibzeit zu überschreiben.
- Datenübernahme als kontrollierten Wechsel durchführen: Ausgangsexport, geprüfter Import, kurzer Schreibstopp bzw. abschließender Delta-Abgleich, danach synchronisierter Betrieb.

**Abnahme:** Website-Sperren und Timer funktionieren auch bei geschlossener LifeQuest-Seite. Offline erfasste Einträge werden nach Verbindung einmalig übernommen. Gleichzeitige Änderungen und wiederholte Befehle erzeugen keine doppelten Aktionen. Abmeldung beendet die Kontosynchronisierung zuverlässig.

### Phase 10 – Konsolidierung und Freigabe

**Arbeitspakete**

- Funktionsliste aus Phase 0 vollständig gegen Web und Extension abnehmen.
- Alte Productivity-/Projects-Einstiege auf die neuen Bereiche umstellen; doppelte Implementierungen nach Übergangsfrist entfernen.
- Dokumentation, Datenmodell, Betrieb, Backup und Wiederanlauf aktualisieren.
- Desktop, schmale Bildschirme, Tastaturbedienung, Kontraste und größere Datenbestände prüfen.
- Stufenweise aktivieren; Datenmigrationen zunächst additiv halten. Bei Rückschaltung keine neuen Daten löschen oder parallele unsynchronisierte Schreibstellen öffnen.

**Meilenstein B:** Der vollständige Focus-Desk-Arbeitsablauf ist in LifeQuest und der angebundenen Extension verfügbar; verbleibende Plattformgrenzen sind sichtbar dokumentiert.

## 6. Abhängigkeiten und empfohlene Reihenfolge

Die Umsetzung startet mit **0 → 1 → 2 → 3 → 4**. Damit entsteht früh ein zusammenhängender Arbeitsablauf.

Danach folgen **5 → 6 → 7** für vollständige lokale Funktionalität und Datenübernahme. Integrationen und Extension-Anbindung folgen in **8 → 9**, die Freigabe in **10**. Die Schnittstellen für die Extension werden bereits in Phase 0 festgelegt; Offline- und Konfliktanforderungen beeinflussen das Datenmodell ab Phase 1.

Jede Phase wird in kleine, unabhängig prüfbare Änderungen aufgeteilt: Datenvertrag/Migration, Fachlogik, Oberfläche und gezielte Verifikation. Eine Zeitschätzung erfolgt erst nach Phase 0 anhand realer Bestandsdaten und des gewünschten visuellen Umfangs.

## 7. Qualitäts- und Freigabekriterien

- **Fachlogik:** Statusübergänge, Planung, Wiederholungen, Datums-/Zeitzonenverhalten, Kartenintervalle und Importzuordnung gezielt testen.
- **Datenzugriff:** Admin, normaler Nutzer und zweiter Nutzer werden getrennt geprüft; private Work-Inhalte dürfen nicht über gemeinsame Tabellen oder KI-Kontexte herausfallen.
- **Integration:** Schreibfehler, Wiederholungen, Verbindungsabbrüche und konkurrierende Änderungen prüfen.
- **End-to-End:** Capture → Projektaufgabe → Zeitblock → Fokus → Abschluss; zusätzlich Import → erneut importieren → prüfen sowie offline erfassen → synchronisieren.
- **Regression:** Öffentliche Aufgaben, Tagesplan, Knowledge, Rituals und bestehende Fokus-XP bleiben korrekt.
- **Oberfläche:** Reale Browserprüfung für Desktop und Mobil einschließlich Leerzuständen, Fehlern und langem Inhalt.
- **Entwicklung:** Vor Codeänderungen die passenden lokalen Next.js-Anleitungen lesen; vor Supabase-Implementierung aktuelle API-/Migrationsvorgaben prüfen. Relevante Tests, Lint und Build vor Freigabe ausführen.

## 8. Konkreter erster Umsetzungsschritt

Phase 0 abschließen und anschließend einen schmalen ersten Durchstich liefern: **Work öffnen → vorhandenes Projekt öffnen → bestehende Aufgabe bearbeiten → im bestehenden Daily Planner einplanen → dieselbe Aufgabe und denselben Plan in den bisherigen Ansichten sehen.**

Damit werden Navigation, Datenwiederverwendung und Privatsphäre früh geprüft, bevor Kalender, externe Integrationen und Browsersteuerung zusätzliche Komplexität einführen.

## 9. Quellcode-Anker für die Umsetzung

- LifeQuest: `src/components/admin/AdminShell.tsx`, `ProductivityHub.tsx`, `ProjectsHub.tsx`, `AdminNotesHub.tsx`, `FullscreenFocusTimer.tsx`.
- Routen und Zugang: `src/app/(app)/admin/layout.tsx`, `src/lib/admin.ts`.
- Modelle: `src/lib/types.ts`, `src/lib/supabase/database.types.ts`, bestehende Projekt-/Knowledge- und Fokus-Migrationen.
- Fokus: `src/lib/focus-session.ts` und zugehörige Tests.
- Extension: `manifest.json`, `background.js`, `newtab.js`, zugehöriges HTML/CSS, `popup.js`, `sidepanel.js`, `blocked.js` sowie `tests/`.
- Hintergrund: `docs/features/admin-workspace.md`, `docs/features/knowledge-projects.md`.
