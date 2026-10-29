import type {
  LearningCatalog,
  LearningContentBlock,
  LearningPath,
  PathLesson,
} from './learning-paths'

export const PERSONAL_PATH_ID = 'entrepreneurial-information-systems' as const

interface LessonSpec {
  slug: string
  title: string
  body: string
  rule: string
  question: string
  options: [string, string, string]
  correct: number
  explanation: string
  product: string
  company: string
}

// Authored content is also the explicitly labelled admin preview before publication.
// Published catalogs retain their server-selected (possibly enrollment-pinned) version.
const units: {
  slug: string
  title: string
  description: string
  practice: string
  lessons: LessonSpec[]
}[] = [
  {
    slug: 'opportunities',
    title: 'Probleme & Chancen',
    description: 'Das Richtige bauen, bevor du richtig baust.',
    practice:
      'Formuliere für beide Praxisfälle je eine Problemhypothese. Wähle einen Hauptfall. Bereite drei offene Interviewfragen vor und notiere, welche Beobachtung deine Annahme widerlegen würde.',
    lessons: [
      {
        slug: 'problem',
        title: 'Welches Problem lohnt sich wirklich?',
        body: 'Bevor du etwas baust oder automatisierst: Finde heraus, für wen das heutige Vorgehen schwierig ist – und warum. Eine Problemhypothese beschreibt eine Person, eine Situation und eine beobachtbare Schwierigkeit. Sie lässt noch offen, welche Technologie helfen könnte.',
        rule: 'Erst das Problem verstehen, dann eine Lösung auswählen.',
        question:
          'Welche Aussage beschreibt ein Problem, ohne schon eine Technologie vorzugeben?',
        options: [
          'Wir brauchen einen AI-Assistenten für jede Anfrage.',
          'Unser Team sucht bei wiederkehrenden Anfragen immer wieder dieselben Informationen.',
          'Wir bauen eine zentrale Plattform mit einem Chatbot.',
        ],
        correct: 1,
        explanation:
          'Die wiederholte Suche lässt sich beobachten und messen. Ob eine Wissensablage, ein anderer Prozess oder ein Chatbot hilft, bleibt offen.',
        product:
          'Eine LifeQuest-Nutzerin öffnet ihre Aufgabenliste und schließt sie wieder: Sie kann keine klare erste Aufgabe auswählen. Prüfe, wann das passiert und was sie stattdessen tut.',
        company:
          'Ein Service-Team durchsucht bei ähnlichen Anfragen mehrere Dokumente. Beobachte zunächst drei typische Fälle und die einzelnen Suchschritte.',
      },
      {
        slug: 'observe',
        title: 'Beobachten statt vermuten',
        body: 'Fragen nach dem letzten konkreten Erlebnis liefern mehr verwertbare Hinweise als Zustimmung zu einer Idee. Lass dir den heutigen Ablauf zeigen. Trenne das beobachtete Verhalten von deiner Interpretation. Auch ein freundliches „würde ich nutzen“ ist noch kein tatsächliches Nutzungsverhalten.',
        rule: 'Frage nach vergangenen Handlungen und heutigen Alternativen.',
        question:
          'Welche Frage liefert den besten Ausgangspunkt für ein Problem-Interview?',
        options: [
          'Würdest du meinen AI-Assistenten nutzen?',
          'Findest du meine Idee gut?',
          'Zeig mir, wie du die letzte Anfrage bearbeitet hast.',
        ],
        correct: 2,
        explanation:
          'Ein konkreter vergangener Fall macht Arbeitsschritte, Alternativen und Schwierigkeiten sichtbar, ohne die gewünschte Lösung vorzugeben.',
        product:
          'Bitte jemanden, den letzten schwierigen Tagesstart zu beschreiben. Notiere zuerst Verhalten und wörtliche Aussagen; deine Schlussfolgerungen kommen danach.',
        company:
          'Lass eine Mitarbeiterin eine kürzlich bearbeitete Anfrage anhand von Beispieldaten nachzeichnen. Wo wurde gesucht, nachgefragt oder Arbeit wiederholt?',
      },
      {
        slug: 'value',
        title: 'Nutzen und Zahlungsbereitschaft',
        body: 'Ein häufiges Ärgernis ist nicht automatisch ein kaufrelevantes Problem. Untersuche Konsequenz, Häufigkeit, bisherige Ausgaben und Zuständigkeit. Im Unternehmen können Nutzer, Entscheider und Budgetverantwortliche verschiedene Personen sein. Eine überprüfte Zahlung oder verbindliche Pilotzusage ist ein stärkeres Signal als ein unverbindliches Kompliment.',
        rule: 'Unterscheide Nutzer, Entscheider und die Person, die zahlt.',
        question:
          'Was ist das stärkste der folgenden Signale für wirtschaftliches Interesse?',
        options: [
          'Eine konkrete Zusage zu einem bezahlten Pilotprojekt.',
          'Viele Likes für die Idee.',
          'Ein Bekannter findet das Design schön.',
        ],
        correct: 0,
        explanation:
          'Eine konkrete Zahlungszusage bindet Ressourcen. Sie beweist noch keinen großen Markt, ist aber belastbarer als unverbindliche Aufmerksamkeit.',
        product:
          'Welche Alternative nutzt deine Zielgruppe heute, und welche Zeit oder welches Geld investiert sie dafür? Plane einen kleinen Test des Angebots.',
        company:
          'Wer leidet unter den Suchzeiten, wer kann den Prozess ändern und wer würde eine Lösung bezahlen? Prüfe, ob das dieselbe Person ist.',
      },
      {
        slug: 'hypothesis',
        title: 'Die kleinste überprüfbare Annahme',
        body: 'Ein Experiment beginnt mit einer Annahme, einem beobachtbaren Ergebnis und einer vorab festgelegten Entscheidung. Teste zuerst die Unsicherheit, an der dein Vorhaben scheitern könnte. Ein manueller Service oder eine einfache Skizze kann dafür reichen; eine vollständige App ist häufig noch nicht nötig.',
        rule: 'Lege vor dem Test fest, welches Ergebnis deine nächste Entscheidung verändert.',
        question: 'Was macht einen frühen Test besonders nützlich?',
        options: [
          'Er enthält möglichst viele Funktionen.',
          'Er prüft eine riskante Annahme mit einem klaren Entscheidungskriterium.',
          'Er vermeidet jedes negative Feedback.',
        ],
        correct: 1,
        explanation:
          'Ein eng begrenzter Test soll Unsicherheit verringern. Funktionsumfang und positives Feedback sind ohne Entscheidungskriterium wenig aussagekräftig.',
        product:
          'Biete einer kleinen Gruppe manuell eine erste Tagespriorität an. Was müsste passieren, damit du die Idee weiterverfolgst?',
        company:
          'Teste mit synthetischen Anfragen, ob eine strukturierte Wissensliste Suchschritte reduziert, bevor du eine AI-Integration planst.',
      },
    ],
  },
  {
    slug: 'economics',
    title: 'Wirtschaftlich denken',
    description: 'Nutzen, Kosten und tragfähige Geschäftsmodelle.',
    practice:
      'Erstelle eine einfache Produktkalkulation und einen Business-Case für den Prozess. Trenne einmalige und laufende Kosten, benenne Annahmen und rechne ein pessimistisches Szenario durch.',
    lessons: [
      {
        slug: 'business-model',
        title: 'Wie entsteht Wert?',
        body: 'Ein Geschäftsmodell verbindet Zielgruppe, Nutzenversprechen, Leistungserstellung und Einnahmen. Die technische Funktion erklärt noch nicht, warum jemand wechseln sollte. Prüfe auch Vertrieb, Support und die Ressourcen, die du für eine verlässliche Leistung benötigst.',
        rule: 'Beschreibe den Nutzen als verändertes Ergebnis für eine konkrete Zielgruppe.',
        question: 'Welche Beschreibung erklärt den Kundennutzen am klarsten?',
        options: [
          'Wir verwenden ein großes Sprachmodell.',
          'Unsere App hat sieben Integrationen.',
          'Service-Teams finden freigegebene Antworten schneller und können sie prüfen.',
        ],
        correct: 2,
        explanation:
          'Das Ergebnis macht den Wert nachvollziehbar. Modell und Integrationen können Mittel dazu sein, erklären den Nutzen allein aber nicht.',
        product:
          'Formuliere Zielgruppe, Problem, Nutzenversprechen und eine plausible Einnahmequelle für deine Produktidee.',
        company:
          'Beschreibe, welcher Teil der Wertschöpfung durch den verbesserten Prozess unterstützt wird und wer davon profitiert.',
      },
      {
        slug: 'cash',
        title: 'Umsatz ist nicht Gewinn',
        body: 'Umsatz beschreibt Erlöse; Gewinn berücksichtigt dazugehörige Aufwendungen. Liquidität betrifft die verfügbaren Zahlungsmittel. Ein Unternehmen kann Gewinne ausweisen und trotzdem Zahlungsschwierigkeiten haben, etwa wenn Kunden spät zahlen und Kosten früher fällig werden.',
        rule: 'Betrachte Ergebnis und Zahlungszeitpunkt getrennt.',
        question:
          'Warum kann ein profitables Unternehmen in einen Liquiditätsengpass geraten?',
        options: [
          'Kundenzahlungen treffen später ein als fällige Ausgaben.',
          'Gewinn und Kontostand sind immer identisch.',
          'Umsatz enthält grundsätzlich keine Kosten.',
        ],
        correct: 0,
        explanation:
          'Ertrag und Zahlung können zu verschiedenen Zeitpunkten anfallen. Für den Betrieb ist deshalb auch der Zahlungsfluss entscheidend.',
        product:
          'Skizziere, wann Hosting, API-Nutzung und Support bezahlt werden und wann Kundenzahlungen eintreffen.',
        company:
          'Trenne im Business-Case buchhalterische Einsparung, tatsächlich frei werdende Kapazität und vermiedene Zahlungen.',
      },
      {
        slug: 'margin',
        title: 'Deckungsbeitrag und Break-even',
        body: 'Der Stückdeckungsbeitrag ist Preis minus variable Kosten je Einheit. Er trägt zur Deckung der Fixkosten bei. Bei konstanten Preisen und Kosten ergibt sich die vereinfachte Break-even-Menge aus Fixkosten geteilt durch einen positiven Stückdeckungsbeitrag. Kapazitätsgrenzen und wechselnde Nutzung können diese Annahmen verändern.',
        rule: 'AI-Kosten gehören in die Rechnung, wenn sie mit der Nutzung steigen.',
        question:
          'Ein Angebot kostet 20 € pro Monat und verursacht 5 € variable Kosten. Wie hoch ist der Deckungsbeitrag je Abo?',
        options: ['25 €', '15 €', '5 €'],
        correct: 1,
        explanation:
          '20 € Erlös minus 5 € variable Kosten ergibt 15 € vor Abzug der Fixkosten. Steuern und weitere Aufwendungen sind hier vereinfacht ausgeklammert.',
        product:
          'Rechne ein Beispiel-Abo mit niedriger und hoher AI-Nutzung. Welches Nutzungsmuster gefährdet die Marge?',
        company:
          'Welche Kosten entstehen pro bearbeitetem Fall und welche fallen unabhängig von der Fallzahl an?',
      },
      {
        slug: 'business-case',
        title: 'Lohnt sich die Automatisierung?',
        body: 'Eine Investitionsentscheidung berücksichtigt Einführung, Integration, Betrieb, Qualitätskontrolle und mögliche Fehlerkosten. Eingesparte Minuten sind zunächst freie Kapazität, nicht automatisch eine Zahlungseinsparung. Stelle Nutzen und Kosten über denselben Zeitraum gegenüber und zeige, welche Annahmen das Ergebnis am stärksten beeinflussen.',
        rule: 'Bewerte den gesamten Ablauf und rechne mit Bandbreiten.',
        question:
          'Was fehlt in einer Rechnung, die nur API-Kosten und eingesparte Minuten vergleicht?',
        options: [
          'Die Farbe des Chatfensters.',
          'Die Anzahl der Präsentationsfolien.',
          'Integration, Kontrolle, Betrieb und der tatsächlich nutzbare Zeitgewinn.',
        ],
        correct: 2,
        explanation:
          'Der Gesamtaufwand entscheidet über den wirtschaftlichen Nutzen. Eine reine Modellkostenrechnung lässt wesentliche Kosten und Einschränkungen weg.',
        product:
          'Vergleiche einen einfachen regelbasierten Ansatz mit AI anhand von Nutzen, Betrieb und variablen Kosten.',
        company:
          'Rechne konservativ, wie viel der frei werdenden Kapazität wirklich genutzt werden kann. Ergänze Einführungs- und Prüfaufwand.',
      },
    ],
  },
  {
    slug: 'systems',
    title: 'Prozesse & Systeme',
    description: 'Von der Reibung zur klaren Anforderung.',
    practice:
      'Zeichne einen Ist- und Soll-Ablauf mit Verantwortlichkeiten und Ausnahmefall. Formuliere drei prüfbare Akzeptanzkriterien und begründe eine Build-/Buy-/Integrationsentscheidung.',
    lessons: [
      {
        slug: 'process',
        title: 'Den Ist-Prozess verstehen',
        body: 'Ein Prozessmodell zeigt Auslöser, Tätigkeiten, Entscheidungen und Ergebnis. Zuständigkeiten machen Übergaben sichtbar. Beginne mit einem konkreten Fall statt mit jeder denkbaren Ausnahme. In BPMN kennzeichnet ein exklusives Gateway alternative Pfade; es bedeutet nicht, dass alle Pfade gleichzeitig ausgeführt werden.',
        rule: 'Modelliere zuerst den tatsächlichen Ablauf, einschließlich Rückfragen und Wartezeiten.',
        question: 'Was sollte eine erste Prozessskizze vor allem abbilden?',
        options: [
          'Den tatsächlichen Ablauf mit Übergaben und Entscheidungen.',
          'Nur den idealen Ablauf ohne Ausnahmen.',
          'Eine Liste aller eingesetzten Programmiersprachen.',
        ],
        correct: 0,
        explanation:
          'Erst ein nachvollziehbarer Ist-Zustand zeigt, an welcher Stelle eine Änderung helfen könnte.',
        product:
          'Zeichne den Weg vom Öffnen der Aufgabenliste bis zum Beginn der ersten Aufgabe.',
        company:
          'Zeichne den Weg vom Eingang einer Anfrage bis zur freigegebenen Antwort. Markiere Übergaben und Suchschritte.',
      },
      {
        slug: 'target-process',
        title: 'Den Soll-Prozess entwerfen',
        body: 'Ein Soll-Prozess beschreibt eine überprüfbare Verbesserung des Ablaufs. Entferne unnötige Arbeit, bevor du sie automatisierst. Lege fest, wer Ausnahmen bearbeitet, welche Entscheidungen Menschen treffen und wie der Prozess bei einem Ausfall weiterläuft.',
        rule: 'Ein besserer Prozess braucht auch einen Weg für Ausnahmen.',
        question:
          'Was gehört zu einem belastbaren automatisierten Soll-Prozess?',
        options: [
          'Die Annahme, dass alle Eingaben korrekt sind.',
          'Ein definierter Ausnahme- und Rückfallweg.',
          'Möglichst viele autonome Entscheidungen.',
        ],
        correct: 1,
        explanation:
          'Fehler und Sonderfälle müssen einer Zuständigkeit und einem bearbeitbaren Ablauf zugeordnet sein.',
        product:
          'Wie kann eine Person eine unpassende Prioritätsempfehlung korrigieren und ohne Empfehlung weiterarbeiten?',
        company:
          'Wer prüft unklare Antworten und wie wird eine Anfrage bei einem Systemausfall bearbeitet?',
      },
      {
        slug: 'requirements',
        title: 'Anforderungen greifbar machen',
        body: 'Eine Anforderung beschreibt benötigtes Verhalten oder eine Qualitätsgrenze. Akzeptanzkriterien machen sie prüfbar: unter welcher Ausgangslage, bei welcher Handlung, mit welchem Ergebnis. „Schnell“ oder „intuitiv“ allein reichen nicht. Auch Zugriffsrechte, Barrierefreiheit und Fehlerverhalten gehören dazu.',
        rule: 'Formuliere Kriterien so, dass eine andere Person sie überprüfen kann.',
        question: 'Welches Akzeptanzkriterium ist am besten prüfbar?',
        options: [
          'Die Suche soll modern wirken.',
          'Die AI soll intelligent sein.',
          'Bei fehlender Berechtigung werden weder Antwort noch Dokumentinhalt angezeigt.',
        ],
        correct: 2,
        explanation:
          'Das Kriterium beschreibt eine konkrete Bedingung und ein beobachtbares Verhalten.',
        product:
          'Schreibe drei Kriterien für die Auswahl einer Tagespriorität, darunter einen Fehlerfall.',
        company:
          'Beschreibe, wann eine vorgeschlagene Antwort eine Quelle enthalten muss und wann der Fall an einen Menschen geht.',
      },
      {
        slug: 'build-buy',
        title: 'Build, Buy oder integrieren?',
        body: 'Eine Eigenentwicklung bietet Kontrolle, verlangt aber Wartung und Betriebsverantwortung. Ein gekauftes Produkt spart Entwicklung, kann dafür Anpassungsgrenzen oder laufende Abhängigkeiten schaffen. Eine Integration verbindet bestehende Systeme. Vergleiche Nutzen, Gesamtkosten, Datenzugriff, Wechselaufwand und die strategische Bedeutung der Fähigkeit.',
        rule: 'Wähle die Lösung mit dem passenden Verhältnis aus Nutzen, Aufwand und Kontrolle.',
        question: 'Wann ist Eigenentwicklung besonders plausibel?',
        options: [
          'Wenn eine wichtige differenzierende Fähigkeit anders nicht sinnvoll abgedeckt wird und Betrieb möglich ist.',
          'Immer, wenn selbst programmieren Spaß macht.',
          'Wenn keinerlei Wartungsressourcen vorhanden sind.',
        ],
        correct: 0,
        explanation:
          'Strategischer Nutzen muss gegen Entwicklungs- und Betriebskosten abgewogen werden. Die technische Vorliebe allein ist kein Business-Case.',
        product:
          'Welche Fähigkeit macht deine Produktidee besonders und welche Standardfunktion kannst du übernehmen?',
        company:
          'Vergleiche eine Prozessänderung, ein vorhandenes Tool und eine eigene Integration anhand derselben Kriterien.',
      },
    ],
  },
  {
    slug: 'data',
    title: 'Daten & Entscheidungen',
    description: 'Mit Daten bessere Fragen beantworten.',
    practice:
      'Entwirf zwei bis drei verbundene Tabellen mit synthetischen Daten. Formuliere drei SQL-Abfragen, darunter eine Aggregation. Erkläre, was eine Kennzahl aussagt und welche Unsicherheit sie offenlässt.',
    lessons: [
      {
        slug: 'model',
        title: 'Das richtige Datenmodell',
        body: 'Entitäten beschreiben Dinge wie Nutzer, Aufgaben oder Anfragen. Primärschlüssel identifizieren Datensätze; Fremdschlüssel stellen Beziehungen her. Constraints sichern Regeln wie Eindeutigkeit und gültige Referenzen. Ein fachlich sauberes Modell verringert widersprüchliche Duplikate und erleichtert spätere Auswertungen.',
        rule: 'Modelliere Beziehungen und Regeln, bevor du wahllos Felder ergänzt.',
        question:
          'Wie verknüpfst du viele Aufgaben mit ihrem jeweiligen Eigentümer?',
        options: [
          'Durch einen Benutzernamen im Freitext.',
          'Durch eine Benutzer-ID als Fremdschlüssel in jeder Aufgabe.',
          'Durch die Farbe der Aufgabenkarte.',
        ],
        correct: 1,
        explanation:
          'Ein Fremdschlüssel stellt eine definierte Beziehung zum identifizierten Benutzer her. Zugriffsrechte müssen zusätzlich durchgesetzt werden.',
        product:
          'Skizziere Nutzer, Aufgaben und Prioritätsentscheidungen samt Beziehungen.',
        company:
          'Skizziere Anfragen, freigegebene Wissensartikel und Bearbeitungsschritte. Welche Daten brauchst du wirklich?',
      },
      {
        slug: 'sql',
        title: 'Antworten finden mit SQL',
        body: 'SELECT wählt Spalten, WHERE filtert Zeilen und GROUP BY fasst Gruppen für Aggregationen zusammen. Ein JOIN verknüpft Datensätze über eine Bedingung. Prüfe bei jeder Verbindung die Kardinalität: Eine Eins-zu-viele-Verbindung kann Zeilen vervielfachen und Summen unbeabsichtigt vergrößern.',
        rule: 'Prüfe zuerst, welche eine Zeile deines Ergebnisses darstellen soll.',
        question: 'Warum kann eine Umsatzsumme nach einem JOIN zu hoch sein?',
        options: [
          'Weil eine Ausgangszeile mit mehreren passenden Zeilen verknüpft wurde.',
          'Weil SELECT grundsätzlich alle Zahlen verdoppelt.',
          'Weil SQL keine Summen bilden kann.',
        ],
        correct: 0,
        explanation:
          'Ein JOIN kann die Zeilenzahl erhöhen. Aggregationen müssen auf der beabsichtigten fachlichen Ebene erfolgen.',
        product:
          'Formuliere auf Beispieldaten eine Abfrage für abgeschlossene Aufgaben pro Tag.',
        company:
          'Ermittle auf synthetischen Daten die Anzahl von Anfragen pro Kategorie und prüfe das Ergebnis an einzelnen Fällen.',
      },
      {
        slug: 'metrics',
        title: 'Kennzahlen mit Aussagekraft',
        body: 'Eine Kennzahl braucht Definition, Zeitraum, Bezugsgruppe und Einheit. Mittelwerte können Ausreißer und Verteilungen verdecken; der Median beschreibt den mittleren Rang. Aktivität ist nicht automatisch Nutzen: Viele AI-Anfragen können erfolgreiche Nutzung oder wiederholte Fehlversuche bedeuten.',
        rule: 'Verbinde jede Kennzahl mit einer Entscheidung und einer Qualitätsprüfung.',
        question:
          'Welche Kennzahl passt am besten zum Ziel einer schnelleren, verlässlichen Bearbeitung?',
        options: [
          'Nur die Anzahl generierter Antworten.',
          'Nur die Anzahl registrierter Konten.',
          'Bearbeitungszeit zusammen mit einer definierten Qualitätsquote.',
        ],
        correct: 2,
        explanation:
          'Zeitgewinn ohne Qualität kann den Prozess verschlechtern. Beide Größen sind für das Ziel relevant.',
        product:
          'Welche beobachtbare Handlung zeigt, dass die Prioritätshilfe den Tagesstart erleichtert?',
        company:
          'Definiere Bearbeitungszeit und Fehlerquote so, dass zwei Personen dieselben Fälle gleich messen würden.',
      },
      {
        slug: 'experiments',
        title: 'Experimente und Unsicherheit',
        body: 'Ein Unterschied zwischen zwei Gruppen kann viele Ursachen haben. Zufällige Zuteilung hilft, Störfaktoren zu verteilen; eine ausreichend große und passende Stichprobe bleibt wichtig. Kleine Stichproben liefern unsichere Schätzungen. Lege Zielgröße und Auswertung vorab fest und verwechsel Korrelation nicht mit einem belegten Ursache-Wirkungs-Zusammenhang.',
        rule: 'Eine Zahl ist ein Hinweis mit Voraussetzungen, kein automatischer Beweis.',
        question:
          'Was lässt sich aus einer kleinen freiwilligen Testgruppe am ehesten ableiten?',
        options: [
          'Die sichere Wirkung für alle zukünftigen Kunden.',
          'Erste Hinweise, die mit ihren Auswahlgrenzen eingeordnet werden müssen.',
          'Eine kausale Wirkung ohne Vergleich.',
        ],
        correct: 1,
        explanation:
          'Freiwillige Teilnahme und kleine Fallzahlen begrenzen die Übertragbarkeit. Die Beobachtung kann trotzdem wertvolle Lernfragen liefern.',
        product:
          'Welche andere Erklärung könnte einen besseren Tagesstart während deines Tests erklären?',
        company:
          'Wie könntest du unterschiedliche Schwierigkeitsgrade der Anfragen bei einem Prozessvergleich berücksichtigen?',
      },
    ],
  },
  {
    slug: 'software',
    title: 'Software bauen',
    description: 'Ideen in funktionierende Systeme übersetzen.',
    practice:
      'Baue einen isolierten kleinen Prototyp auf synthetischen Daten. Verarbeite eine Eingabe, rufe eine kontrollierte API auf und behandle einen Fehlerfall. Zeige Versionsgeschichte und mindestens einen aussagekräftigen Verhaltenstest. Plane mehrere Arbeitssitzungen ein.',
    lessons: [
      {
        slug: 'logic',
        title: 'Logik und Datenstrukturen',
        body: 'Programme transformieren Eingaben anhand nachvollziehbarer Regeln in Ausgaben. Listen ordnen mehrere Werte, Schlüssel-Wert-Strukturen erlauben benannte Zuordnungen. Funktionen bündeln ein begrenztes Verhalten. Prüfe Annahmen über Datentypen, fehlende Werte und leere Eingaben, bevor du den Normalfall weiterverarbeitest.',
        rule: 'Mache Ein- und Ausgabe einer Funktion konkret und prüfbar.',
        question: 'Welche Funktion lässt sich am klarsten isoliert prüfen?',
        options: [
          'Eine, die eine Aufgabenliste erhält und nach dokumentierten Regeln eine Priorität zurückgibt.',
          'Eine, die unsichtbar beliebige globale Daten verändert.',
          'Eine, deren Eingabeformat unbekannt ist.',
        ],
        correct: 0,
        explanation:
          'Explizite Eingaben und ein definiertes Ergebnis erleichtern Verständnis, Wiederverwendung und Tests.',
        product:
          'Beschreibe oder programmiere eine reine Funktion zur Prioritätsauswahl. Was passiert bei einer leeren Liste?',
        company:
          'Schreibe eine einfache Regel, die eine Beispieldaten-Anfrage einer Kategorie zuordnet. Definiere einen unbekannten Fall.',
      },
      {
        slug: 'api',
        title: 'Frontend, Backend und APIs',
        body: 'Das Frontend unterstützt die Interaktion; das Backend verarbeitet vertrauenswürdige Geschäftsregeln und Datenzugriffe. Eine API legt den Austausch fest. Eingaben aus Browsern und fremden Diensten müssen validiert werden. Gehe bei Netzwerkaufrufen auch von Fehlern, Verzögerung und unerwarteten Antwortformaten aus.',
        rule: 'Eine Schnittstelle braucht neben dem Erfolgsfall einen Fehlervertrag.',
        question:
          'Wo sollte ein geheimer API-Schlüssel für einen Serverdienst liegen?',
        options: [
          'Im öffentlich ausgelieferten Browser-Code.',
          'In einem Screenshot der Anwendung.',
          'In einer serverseitigen Konfiguration, die nicht an den Browser ausgeliefert wird.',
        ],
        correct: 2,
        explanation:
          'Öffentlicher Client-Code kann eingesehen werden. Ein geheim zu haltender Schlüssel muss auf einer kontrollierten Serverseite bleiben.',
        product:
          'Zeichne den Weg von einer Eingabe über deine API bis zur Speicherung und zurück.',
        company:
          'Welche Eingaben und Ausgaben braucht die Integration zwischen Anfrageverwaltung und Wissenssuche?',
      },
      {
        slug: 'access',
        title: 'Berechtigungen und Fehlerfälle',
        body: 'Authentifizierung klärt, wer eine Person ist. Autorisierung entscheidet, welche Handlung sie an welchen Daten ausführen darf. Ein versteckter Knopf ersetzt keine serverseitige Prüfung. Validiere Eingaben, beschränke Zugriffe auf das Erforderliche und gib verständliche Fehler zurück, ohne fremde Daten offenzulegen.',
        rule: 'Prüfe Berechtigung bei jedem geschützten Datenzugriff.',
        question: 'Was verhindert den Zugriff auf fremde Datensätze?',
        options: [
          'Ein deaktivierter Button allein.',
          'Eine serverseitige Eigentums- oder Rollenprüfung am Datenzugriff.',
          'Ein schwer zu erratender Seitenname allein.',
        ],
        correct: 1,
        explanation:
          'Client-Bedienelemente können umgangen werden. Die Entscheidung muss an der tatsächlichen Zugriffsgrenze durchgesetzt werden.',
        product:
          'Kann ein Nutzer durch Ändern einer ID auf fremde Aufgaben zugreifen? Entwirf einen Test dagegen.',
        company:
          'Welche Wissensquellen darf eine Person lesen und wie bleibt diese Grenze bei einer AI-Suche erhalten?',
      },
      {
        slug: 'shipping',
        title: 'Testen und bereitstellen',
        body: 'Versionsverwaltung macht Änderungen nachvollziehbar. Tests prüfen wichtige Verhaltenszusagen und Fehlerfälle; ein erfolgreicher Build allein bestätigt keine fachliche Richtigkeit. Eine Bereitstellung braucht passende Konfiguration, beobachtbare Fehler und einen Rückweg. Halte Testdaten von echten Nutzerdaten getrennt.',
        rule: 'Prüfe Verhalten und plane, wie du einen Fehler nach dem Start erkennst.',
        question:
          'Welcher Test ist für eine Prioritätshilfe besonders aussagekräftig?',
        options: [
          'Ein Test einer fachlichen Auswahlregel und ihres leeren Eingabefalls.',
          'Nur ein Vergleich mit derselben intern kopierten Berechnung.',
          'Nur die Prüfung, ob ein Dateiname existiert.',
        ],
        correct: 0,
        explanation:
          'Ein Test sollte ein relevantes Verhalten unabhängig von seiner konkreten Implementierung überprüfen.',
        product:
          'Versioniere deinen Prototyp und demonstriere einen reproduzierbaren Erfolg sowie einen behandelten Fehler.',
        company:
          'Beschreibe, wie ein Pilot begrenzt, beobachtet und bei Problemen zum bisherigen Ablauf zurückgeführt wird.',
      },
    ],
  },
  {
    slug: 'ai-foundations',
    title: 'AI verstehen',
    description: 'Möglichkeiten erkennen und Grenzen prüfen.',
    practice:
      'Vergleiche eine einfache Lösung ohne AI mit einem kleinen AI-Ansatz. Erstelle ein Testset aus typischen, unklaren und ungültigen Fällen. Definiere Qualität und begründe, wann das System keine Antwort geben sollte.',
    lessons: [
      {
        slug: 'fit',
        title: 'Regeln, ML oder generative AI?',
        body: 'Feste, gut beschreibbare Regeln können oft direkt programmiert werden. Klassisches maschinelles Lernen lernt Muster aus Beispielen, etwa zur Klassifikation. Generative Modelle erzeugen neue Ausgaben wie Text. Entscheidend sind Aufgabe, Daten, Fehlertoleranz und Kosten; mehr Modellkomplexität ist nicht automatisch hilfreicher.',
        rule: 'Vergleiche AI mit der einfachsten brauchbaren Alternative.',
        question:
          'Wie setzt du eine feste, rechtlich vorgegebene Altersgrenze am zuverlässigsten um?',
        options: [
          'Durch eine frei formulierte LLM-Antwort.',
          'Durch eine Bildgenerierung.',
          'Durch eine explizite validierte Regel.',
        ],
        correct: 2,
        explanation:
          'Eine klar vorgegebene Grenze benötigt kein generatives Modell. Eine feste Regel ist überprüfbar und deterministisch.',
        product:
          'Welche Teile deiner Prioritätsauswahl sind klare Regeln und wo könnte eine Interpretation von Text nötig sein?',
        company:
          'Trenne feste Weiterleitungsregeln von variablen sprachlichen Anfragen, bevor du ein Modell auswählst.',
      },
      {
        slug: 'generalization',
        title: 'Training und Generalisierung',
        body: 'Training passt Modellparameter an Beispieldaten an; Inferenz wendet das Modell auf Eingaben an. Ein Modell kann Trainingsbeispiele zu stark anpassen und bei neuen Fällen schlechter abschneiden. Halte Auswertungsdaten von Trainings- und Entwicklungsentscheidungen getrennt und achte auf versehentlich verratene Zielinformationen.',
        rule: 'Beurteile ein Modell an passenden, bisher nicht zum Optimieren verwendeten Fällen.',
        question: 'Warum genügt eine sehr gute Trainingsgenauigkeit nicht?',
        options: [
          'Sie beweist die Leistung auf jedem zukünftigen Fall.',
          'Das Modell kann Beispiele auswendig anpassen, ohne ausreichend zu generalisieren.',
          'Modelle können keine neuen Eingaben erhalten.',
        ],
        correct: 1,
        explanation:
          'Leistung auf Trainingsdaten und Leistung auf neuen Daten sind unterschiedliche Größen. Überanpassung kann diese Lücke vergrößern.',
        product:
          'Welche neuen Aufgabenarten könnte deine Empfehlung schlechter behandeln als deine Entwicklungsbeispiele?',
        company:
          'Enthält dein Testset Informationen, die bei einer echten neuen Anfrage noch gar nicht verfügbar wären?',
      },
      {
        slug: 'llm',
        title: 'LLMs und strukturierte Ausgaben',
        body: 'Sprachmodelle verarbeiten Text in Tokens und erzeugen Ausgaben anhand gelernter Muster und des verfügbaren Kontexts. Flüssige Sprache ist kein Beleg für faktische Richtigkeit. Strukturierte Ausgaben erleichtern die Verarbeitung, müssen aber weiterhin fachlich und gegen das erwartete Schema validiert werden.',
        rule: 'Eine syntaktisch gültige Ausgabe kann fachlich trotzdem falsch sein.',
        question: 'Was beweist eine gültige JSON-Antwort eines Sprachmodells?',
        options: [
          'Dass ihr Inhalt faktisch richtig ist.',
          'Dass jede enthaltene Empfehlung sicher ist.',
          'Nur, dass die syntaktischen beziehungsweise geprüften Strukturvorgaben erfüllt sind.',
        ],
        correct: 2,
        explanation:
          'Format und Wahrheit sind getrennte Eigenschaften. Werte, Berechtigungen und fachliche Schlussfolgerungen benötigen zusätzliche Prüfung.',
        product:
          'Definiere die Ausgabe einer Empfehlung als Aufgabe-ID und Begründung. Prüfe, ob die ID wirklich zur Eingabeliste gehört.',
        company:
          'Definiere Kategorie, Antwortentwurf und Quellenreferenzen als strukturierte Ausgabe und validiere die Referenzen.',
      },
      {
        slug: 'evaluation',
        title: 'Qualität messbar machen',
        body: 'Ein Testset soll relevante Eingaben und bekannte Fehlerfälle enthalten. Bewerte Ausgaben anhand vorab definierter Kriterien. Bei Klassifikationen beantworten Precision und Recall verschiedene Fragen: Wie viele positive Vorhersagen stimmen, und wie viele tatsächlich positive Fälle wurden erkannt? Welche Fehler schwerer wiegen, hängt vom Einsatz ab.',
        rule: 'Definiere Fehlerkosten und Qualitätskriterien vor dem Vergleich von Modellen.',
        question:
          'Was ist bei einer Klassifikation mit sehr seltenen positiven Fällen problematisch?',
        options: [
          'Eine hohe Gesamtgenauigkeit kann ein System verdecken, das alle positiven Fälle verpasst.',
          'Recall und Precision sind immer identisch.',
          'Einzelne Fehler müssen nicht betrachtet werden.',
        ],
        correct: 0,
        explanation:
          'Eine triviale Mehrheitsvorhersage kann hohe Accuracy erzielen. Die für die Aufgabe relevanten Fehler brauchen gesonderte Metriken.',
        product:
          'Welche Empfehlung wäre unbrauchbar, obwohl sie sprachlich überzeugend klingt? Ergänze passende Testfälle.',
        company:
          'Unterscheide sachlich falsche Antworten, fehlende Quellen und zu Unrecht abgelehnte Anfragen in deinem Testset.',
      },
    ],
  },
  {
    slug: 'ai-building',
    title: 'AI praktisch einsetzen',
    description: 'Verlässliche Werkzeuge statt bloßer Demos.',
    practice:
      'Baue einen eng begrenzten AI-Prototyp auf synthetischen Daten. Zeige Testfälle, eine Berechtigungsgrenze, einen Fallback und dokumentierte Kostenannahmen. Plane mehrere Sitzungen ein; ein überzeugender Einzelfall ersetzt keine Evaluation.',
    lessons: [
      {
        slug: 'prompts',
        title: 'Prompts als Spezifikation',
        body: 'Ein brauchbarer Prompt beschreibt Aufgabe, Eingaben, Grenzen und gewünschtes Ausgabeformat. Beispiele können Mehrdeutigkeit reduzieren. Änderungen sollten an denselben Testfällen geprüft werden. Vom Nutzer gelieferter Inhalt und gefundene Dokumente sind Daten; darin enthaltene Anweisungen dürfen keine zusätzlichen Rechte verleihen.',
        rule: 'Teste einen Prompt wie eine veränderliche Komponente mit einem festen Aufgabenvertrag.',
        question: 'Was verbessert einen Prompt auf nachvollziehbare Weise?',
        options: [
          'Mehrere beeindruckende Rollenbezeichnungen ohne Aufgabe.',
          'Explizite Eingaben, Qualitätskriterien und ein Vergleich auf demselben Testset.',
          'Das ungeprüfte Befolgen jeder Anweisung im gefundenen Dokument.',
        ],
        correct: 1,
        explanation:
          'Ein definierter Aufgabenvertrag und reproduzierbare Beispiele erlauben einen echten Vergleich und zeigen Regressionen.',
        product:
          'Schreibe eine Spezifikation für einen kleinen Vorschlag zur Tagespriorität und nenne ausdrücklich verbotene Seiteneffekte.',
        company:
          'Gib einem Antwortentwurf vor, nur freigegebene Informationen zu verwenden und Unsicherheit kenntlich zu machen.',
      },
      {
        slug: 'rag',
        title: 'Wissen erschließen mit RAG',
        body: 'Retrieval-Augmented Generation sucht zunächst passende Inhalte und stellt sie dem Modell als Kontext bereit. Embeddings repräsentieren Inhalte als Vektoren für Ähnlichkeitssuche; Ähnlichkeit garantiert keine richtige oder berechtigte Quelle. Prüfe Zugriff, Aktualität, Treffergenauigkeit und ob die Antwort tatsächlich durch die Quellen gestützt wird.',
        rule: 'Gute Antworten benötigen passende, zulässige Quellen und überprüfbare Belege.',
        question:
          'Was muss vor der Nutzung eines Suchtreffers als Modellkontext gelten?',
        options: [
          'Die aktuelle Person darf den Inhalt lesen.',
          'Das Dokument hat irgendeinen ähnlichen Begriff.',
          'Der Treffer stammt aus einem beliebigen fremden Konto.',
        ],
        correct: 0,
        explanation:
          'Die Suche und die Weitergabe an das Modell müssen dieselben Zugriffsgrenzen respektieren wie die ursprünglichen Daten.',
        product:
          'Welche persönlichen Informationen wären für deine Funktion nötig? Beginne mit einem minimalen synthetischen Kontext.',
        company:
          'Vergleiche Suchtreffer aus einer freigegebenen Beispielsammlung und prüfe, ob ein Antwortentwurf jede zentrale Aussage belegen kann.',
      },
      {
        slug: 'workflows',
        title: 'Workflows und Tool-Aufrufe',
        body: 'Ein Workflow legt Schritte und Übergaben explizit fest. Ein Modell kann Vorschläge für Tool-Aufrufe erzeugen; die Ausführung muss Parameter, Berechtigungen und erlaubte Aktionen prüfen. Begrenze Schleifen und Ressourcen. Bei folgenreichen Aktionen gehören Freigaben und nachvollziehbare Protokolle in den Ablauf.',
        rule: 'Ein Modellvorschlag ist noch keine autorisierte Handlung.',
        question:
          'Wie behandelst du einen vom Modell vorgeschlagenen Tool-Aufruf?',
        options: [
          'Du führst beliebige Argumente direkt aus.',
          'Du gibst dem Modell vorsorglich alle Rechte.',
          'Du validierst Argumente, prüfst Rechte und beschränkst die erlaubte Aktion.',
        ],
        correct: 2,
        explanation:
          'Die kontrollierende Anwendung setzt die Handlungsgrenze durch; das Modell darf sie nicht selbst erweitern.',
        product:
          'Eine vorgeschlagene Priorität darf nicht stillschweigend Aufgaben löschen oder Termine verschieben. Zeichne die Freigabegrenze.',
        company:
          'Trenne einen Antwortentwurf vom Versand an Kunden. Plane eine menschliche Prüfung und ein Abbruchkriterium.',
      },
      {
        slug: 'cost-control',
        title: 'Kosten und Kontrolle',
        body: 'Kosten hängen unter anderem von Aufrufzahl, Eingabe- und Ausgabeumfang sowie weiteren Diensten ab. Hinzu kommen Latenz, Fehlversuche und Kontrollaufwand. Setze Zeitlimits, Nutzungsgrenzen und einen klaren Fallback. Wiederholte Aufrufe dürfen keine doppelten externen Aktionen verursachen.',
        rule: 'Begrenze Budget, Laufzeit und Seiteneffekte unabhängig vom Modell.',
        question:
          'Was schützt einen AI-Workflow vor unbegrenztem Ressourcenverbrauch?',
        options: [
          'Nur ein freundlich formulierter Prompt.',
          'Technische Limits für Aufrufe, Laufzeit und Budget mit einem Abbruchpfad.',
          'Eine unbegrenzt wiederholte Anfrage bei jedem Fehler.',
        ],
        correct: 1,
        explanation:
          'Grenzen müssen durch die Anwendung durchgesetzt werden. Ein Prompt allein ist keine verlässliche Ressourcenbegrenzung.',
        product:
          'Rechne die Kosten pro sinnvoller Empfehlung mit Annahmen und lege ein tägliches Nutzungslimit fest.',
        company:
          'Skizziere den Ablauf, wenn ein Dienst langsam ist, ausfällt oder eine unbrauchbare Antwort liefert.',
      },
    ],
  },
  {
    slug: 'growth',
    title: 'Einführen & wachsen',
    description: 'Aus einer Lösung echte Wirkung machen.',
    practice:
      'Demonstriere deinen Hauptfall. Zeige Problem, Prozess- und Systemskizze, einen funktionierenden Teil und die Evaluation. Leite eine Produktentscheidung und eine Einführungsempfehlung ab; benenne Grenzen und das nächste Experiment.',
    lessons: [
      {
        slug: 'positioning',
        title: 'Positionieren und verkaufen',
        body: 'Positionierung beschreibt, für wen deine Lösung gegenüber welchen Alternativen relevant ist. Ein konkretes Nutzenversprechen ist leichter zu prüfen als ein allgemeines AI-Versprechen. Preis und Vertriebskanal müssen zu Zielgruppe, Kaufprozess und Leistungskosten passen. Ein früher Verkauf ist auch ein Test deiner Annahmen.',
        rule: 'Zeige einen relevanten Unterschied aus Sicht einer konkreten Zielgruppe.',
        question: 'Welcher Einstieg vermittelt eine klarere Positionierung?',
        options: [
          'Für kleine Service-Teams, die freigegebene Antworten heute in vielen Dokumenten suchen.',
          'AI für alle und alles.',
          'Die innovativste Plattform weltweit.',
        ],
        correct: 0,
        explanation:
          'Zielgruppe und Situation machen nachvollziehbar, wann ein Gespräch über Nutzen und Alternativen sinnvoll ist.',
        product:
          'Schreibe einen Ein-Satz-Pitch mit Zielgruppe, Problem und Ergebnis. Welcher Kanal erreicht diese Menschen?',
        company:
          'Wie erklärst du der Budgetverantwortlichen den messbaren Nutzen und die verbleibenden Grenzen?',
      },
      {
        slug: 'adoption',
        title: 'Veränderung im Team begleiten',
        body: 'Eine technische Einführung verändert Aufgaben, Zuständigkeiten und Routinen. Binde betroffene Menschen früh ein, kläre Schulung und Unterstützung und beginne mit einem begrenzten Pilot. Nutzung hängt auch davon ab, ob die neue Arbeit in bestehende Abläufe passt und ob Rückmeldungen zu Verbesserungen führen.',
        rule: 'Plane den Übergang für Menschen ebenso konkret wie die technische Integration.',
        question: 'Was verbessert die Chance auf eine brauchbare Einführung?',
        options: [
          'Alle bisherigen Abläufe sofort abschalten.',
          'Nur das Management informieren.',
          'Mit betroffenen Mitarbeitenden einen begrenzten Pilot und einen Rückmeldeweg gestalten.',
        ],
        correct: 2,
        explanation:
          'Ein Pilot erlaubt, tatsächliche Nutzung, Qualität und Arbeitsbelastung zu beobachten, bevor der Umfang wächst.',
        product:
          'Plane die ersten drei Nutzertests und einen einfachen Weg, Schwierigkeiten zu melden.',
        company:
          'Wer wird geschult, wer unterstützt bei Fehlern und wie wird entschieden, ob der Pilot ausgeweitet wird?',
      },
      {
        slug: 'outcomes',
        title: 'Erfolg und Nutzung messen',
        body: 'Ein Produkt kann oft geöffnet werden, ohne nützlich zu sein. Verbinde Nutzung mit einem fachlichen Ergebnis und beobachte mögliche Nebenwirkungen. Vergleiche sinnvolle Zeiträume und Gruppen; veränderte Fallmischungen können Zahlen verschieben. Sammle nur die Daten, die für die Entscheidung erforderlich sind.',
        rule: 'Miss den gewünschten Nutzen und die Kosten seiner Erreichung.',
        question:
          'Welche Beobachtung ist am aussagekräftigsten für einen erfolgreichen Prozesspilot?',
        options: [
          'Eine große Zahl generierter Texte allein.',
          'Kürzere Bearbeitung bei vereinbarter Qualität und vertretbarem Kontrollaufwand.',
          'Die Zahl der verwendeten Modelle.',
        ],
        correct: 1,
        explanation:
          'Die Kombination stellt den Prozessnutzen den relevanten Qualitäts- und Aufwandsgrenzen gegenüber.',
        product:
          'Definiere ein Nutzensignal und eine Gegenkennzahl, die eine Verschlechterung sichtbar machen würde.',
        company:
          'Vergleiche Bearbeitungszeit, Qualität und Prüfaufwand mit dem Ausgangszustand. Welche Unsicherheit bleibt?',
      },
      {
        slug: 'operate',
        title: 'Betreiben und weiterentwickeln',
        body: 'Nach dem Start ändern sich Daten, Anforderungen und externe Dienste. Betrieb braucht Zuständigkeit, Fehlersignale und wiederholbare Tests. Priorisiere die nächste Änderung anhand der größten verbleibenden Unsicherheit. Manchmal ist Verkleinern oder Verwerfen die bessere Entscheidung als zusätzliche Funktionen.',
        rule: 'Leite die nächste Investition aus Beobachtungen und überprüften Annahmen ab.',
        question:
          'Was ist nach einem schwachen Pilot das sinnvollste Vorgehen?',
        options: [
          'Unabhängig vom Ergebnis mehr Funktionen bauen.',
          'Die Messwerte ausblenden.',
          'Ursachen prüfen, Annahmen aktualisieren und über Ändern, Fortführen oder Verwerfen entscheiden.',
        ],
        correct: 2,
        explanation:
          'Ein Pilot liefert Entscheidungsgrundlagen. Die Reaktion sollte an den Befunden ausgerichtet sein und nicht am bereits investierten Aufwand.',
        product:
          'Fasse deine Produktentscheidung auf einer Seite zusammen: Befund, Grenzen und nächster Test.',
        company:
          'Formuliere eine Einführungsempfehlung mit Verantwortlichkeit, Rückfallweg und Kriterien für den weiteren Betrieb.',
      },
    ],
  },
]

function sequence(items: [string, string][]): LearningContentBlock[] {
  return [
    {
      type: 'sequence',
      items: items.map(([title, body]) => ({ title, body })),
    },
  ]
}

function makeLesson(
  spec: LessonSpec,
  unit: (typeof units)[number],
  index: number,
): PathLesson {
  const id = `wis-${unit.slug}-${spec.slug}`
  const first = unit.slug === 'opportunities' && index === 0
  return {
    id,
    title: spec.title,
    description: spec.rule,
    icon: '↗',
    difficulty: 'foundation',
    estimatedMinutes: 4,
    masteryPoints: 100,
    exercises: [
      {
        id: `${id}-understand`,
        type: 'concept',
        title: first ? 'Die beste Idee beginnt mit Reibung.' : spec.title,
        body: spec.body,
        takeaway: spec.rule,
        ...(first
          ? {
              perspectives: {
                product: {
                  body: spec.product,
                  blocks: sequence([
                    ['Für wen?', 'Menschen mit langen Aufgabenlisten'],
                    ['Welche Reibung?', 'Eine erste Aufgabe auswählen'],
                    ['Welche Folge?', 'Aufschieben statt anfangen'],
                  ]),
                },
                company: {
                  body: spec.company,
                  blocks: sequence([
                    ['Für wen?', 'Das Service-Team'],
                    ['Welche Reibung?', 'Informationen zusammensuchen'],
                    ['Welche Folge?', 'Längere Antwortzeiten'],
                  ]),
                },
              },
            }
          : {}),
      },
      {
        id: `${id}-check`,
        type: 'choice',
        prompt: spec.question,
        options: spec.options,
        correctIndex: spec.correct,
        explanation: spec.explanation,
      },
      {
        id: `${id}-apply`,
        type: 'concept',
        title: first
          ? 'Mach das Problem überprüfbar.'
          : 'Übertrage die Idee auf deinen Fall.',
        body: first
          ? 'Nenne eine Person, eine Situation und eine beobachtbare Schwierigkeit. Deine Formulierung ist zunächst eine Annahme; prüfe sie durch Beobachtung oder ein Gespräch.'
          : 'Nutze die folgende Frage, um die Erklärung mit deinem eigenen Vorhaben zu verbinden. Notiere auch, welche Informationen dir noch fehlen.',
        takeaway: spec.rule,
        perspectives: {
          product: { body: spec.product },
          company: { body: spec.company },
        },
      },
      {
        id: `${id}-reflect`,
        type: 'reflection',
        prompt:
          index === 3
            ? unit.practice
            : first
              ? 'Welche Reibung willst du verstehen – und wie prüfst du deine Annahme?'
              : `Was bedeutet „${spec.title}“ für deinen Praxisfall? Nenne eine Entscheidung und den nächsten Prüfschritt.`,
        placeholder: first
          ? 'Für [Person] ist [Situation] schwierig, weil …\nAls Nächstes prüfe ich das durch …'
          : 'Meine Entscheidung oder Annahme …\nSo überprüfe ich sie …',
        ...(index === 3
          ? {
              practiceMinutes:
                unit.slug === 'software' || unit.slug === 'ai-building'
                  ? 120
                  : 45,
            }
          : {}),
      },
    ],
  }
}

export const PERSONAL_LEARNING_PATH: LearningPath = {
  id: PERSONAL_PATH_ID,
  title: 'Unternehmerische Wirtschaftsinformatik',
  shortTitle: 'Business, Tech & AI',
  description:
    'Baue digitale Produkte. Verbessere Unternehmen. Verbinde Business, Software und AI mit echter Anwendung.',
  outcome:
    'Produkte bauen, Unternehmen verbessern – mit Software, Daten und AI.',
  icon: '↗',
  accent: 'emerald',
  units: units.map((unit) => ({
    id: `wis-${unit.slug}`,
    title: unit.title,
    description: unit.description,
    lessons: unit.lessons.map((spec, index) => makeLesson(spec, unit, index)),
  })),
}

/** Adds the authored preview without replacing a published or pinned personal course. */
export function withPersonalLearningPath(
  catalog: LearningCatalog,
): LearningCatalog {
  if (catalog.paths.some((path) => path.id === PERSONAL_PATH_ID)) return catalog
  return {
    ...catalog,
    paths: [...catalog.paths, structuredClone(PERSONAL_LEARNING_PATH)],
  }
}
