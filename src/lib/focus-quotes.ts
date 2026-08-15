const FOCUS_QUOTES = [
  'Small steps, repeated daily, become momentum.',
  'You do not need to feel ready to begin.',
  'Discipline is choosing what you want most over what you want now.',
  'One focused hour beats a distracted day.',
  'Progress hides inside the parts that feel boring.',
  'The work in front of you is enough for today.',
  'Clarity comes from doing, not from thinking harder.',
  'Show up. The rest follows.',
  'Effort compounds quietly, then all at once.',
  'Finish what you started before you start what is next.',
]

export function pickFocusQuote() {
  return FOCUS_QUOTES[Math.floor(Math.random() * FOCUS_QUOTES.length)]
}
