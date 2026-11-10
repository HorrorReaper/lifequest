export type ConversationNudgeKind = "starter" | "deep";

const starters = [
  "Was hat dir heute schon ein Lächeln geschenkt?",
  "Worauf freust du dich in den nächsten Tagen?",
  "Was war deine beste kleine Entdeckung in letzter Zeit?",
  "Womit verbringst du gerade am liebsten deine freie Zeit?",
  "Welcher Ort hier in der Gegend gefällt dir besonders gut?",
  "Was hast du zuletzt zum ersten Mal ausprobiert?",
  "Welches Buch, welche Serie oder welcher Podcast hat dich zuletzt begeistert?",
  "Wenn du morgen einen ganz freien Tag hättest: Wie würdest du ihn verbringen?",
  "Gibt es ein kleines Projekt, an dem du gerade Spaß hast?",
  "Was war ein schöner Moment in deiner Woche?",
  "Welches Essen könntest du immer wieder genießen?",
  "Welche Fähigkeit würdest du gern einfach mal ausprobieren?",
  "Welche Musik passt gerade zu deiner Stimmung?",
  "Was hilft dir, nach einem vollen Tag abzuschalten?",
  "Wohin würdest du gern einmal einen spontanen Ausflug machen?",
  "Welche Empfehlung hast du zuletzt bekommen, die wirklich gut war?",
  "Was interessiert dich gerade mehr, als du erwartet hättest?",
  "Gibt es eine kleine Gewohnheit, die deinen Alltag schöner macht?",
  "Was war das Lustigste, das dir in letzter Zeit passiert ist?",
  "Über welches Thema könntest du spontan lange erzählen?",
] as const;

const deepQuestions = [
  "Wann fühlst du dich am meisten wie du selbst?",
  "Was bedeutet ein gutes Leben für dich ganz persönlich?",
  "Welche Erfahrung hat deine Sicht auf die Welt verändert?",
  "Wofür möchtest du dir in deinem Leben mehr Zeit nehmen?",
  "Welche Eigenschaft schätzt du an anderen Menschen besonders?",
  "Was möchtest du unbedingt bewahren, auch wenn sich vieles verändert?",
  "Welche Überzeugung hast du in den letzten Jahren neu überdacht?",
  "Woran merkst du, dass du jemandem vertrauen kannst?",
  "Was gibt dir das Gefühl, am richtigen Ort zu sein?",
  "Welcher Rat hat dich nachhaltig begleitet?",
  "Was bedeutet Erfolg für dich heute – und war das früher anders?",
  "Was möchtest du noch lernen, das sich nicht in einem Lebenslauf zeigen muss?",
  "Bei welchen Menschen fühlst du dich wirklich verstanden – und warum?",
  "Welche Entscheidung hat dich deinem eigenen Weg nähergebracht?",
  "Was würdest du deinem jüngeren Ich gern mitgeben?",
  "Welche Art von Mut bewunderst du besonders?",
  "Was hilft dir dabei, deine Prioritäten klarer zu sehen?",
  "Wofür bist du dankbar, das du früher für selbstverständlich gehalten hast?",
  "Was möchtest du in deinen Beziehungen häufiger ausdrücken?",
  "Welche Frage würdest du dir selbst gern öfter stellen?",
] as const;

export const CONVERSATION_NUDGES = {
  starter: starters.map((question, index) => ({
    id: `starter-${index + 1}`,
    question,
  })),
  deep: deepQuestions.map((question, index) => ({
    id: `deep-${index + 1}`,
    question,
  })),
} as const;

/** Draws without replacement; a new round never repeats the last shown question. */
export function nextConversationNudge(
  kind: ConversationNudgeKind,
  seen: readonly string[],
) {
  const pool = CONVERSATION_NUDGES[kind];
  const remaining = pool.filter((item) => !seen.includes(item.id));
  const lastId = seen.at(-1);
  const choices = remaining.length
    ? remaining
    : pool.filter((item) => item.id !== lastId);
  const selected = choices[Math.floor(Math.random() * choices.length)];
  return {
    question: selected.question,
    seen: remaining.length
      ? [...seen, selected.id]
      : [...(lastId ? [lastId] : []), selected.id],
  };
}
