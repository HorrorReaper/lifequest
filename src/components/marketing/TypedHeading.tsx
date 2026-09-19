// The headline, typed out a character at a time — the effect the first
// landing page had, rebuilt without the two things that one got wrong.
//
// It is pure CSS. Every character ships in the markup and is only *hidden*
// until its turn, staggered by animation-delay, so:
//
//   - the heading is complete in the very first painted frame, whole for a
//     crawler and whole with JavaScript broken. The original started from an
//     empty <h1> and filled it from state, which meant an empty headline in
//     the server-rendered HTML.
//   - nothing moves. `visibility: hidden` keeps a character's space, so the
//     heading occupies its final box from the start. The original grew line
//     by line and shoved the subhead, the buttons and the panel down the page
//     as it went.
//   - prefers-reduced-motion is honoured in globals.css, by showing
//     everything at once.
//
// No hooks, so this stays a Server Component and ships no JavaScript at all.

/** Roughly the original's 35ms a character. */
const CHARACTER_MS = 35;

/** A beat after each sentence, standing in for the original's line-by-line run. */
const SENTENCE_MS = 260;

export function TypedHeading({
  text,
  className = "",
}: {
  text: string
  className?: string
}) {
  let elapsed = 0;

  return (
    // The characters are split across elements, which some screen readers
    // announce one at a time; the label keeps the heading a single string.
    <h1 className={`lq-typed ${className}`} aria-label={text}>
      {[...text].map((character, position) => {
        const delay = elapsed;
        elapsed += CHARACTER_MS + (character === "." ? SENTENCE_MS : 0);

        // Spaces have no glyph to reveal, and leaving them as plain text keeps
        // the line-break opportunities exactly where they would be anyway.
        if (character === " ") return " ";

        return (
          <span key={position} style={{ animationDelay: `${delay}ms` }}>
            {character}
          </span>
        );
      })}
    </h1>
  );
}
