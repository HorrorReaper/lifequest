// Numbers typed by people: "72,5" and "72.5" mean the same thing.
//
// Inputs that take a decimal use a text field with the decimal keyboard
// rather than type="number": some mobile browsers drop a comma typed into a
// number field, and a number field's step/min/max validation blocks a form
// silently when the field is on a wizard step that is not shown.

const DRAFT = /^-?\d*(?:[.,]\d*)?$/

/** Whether `text` can still become a number while being typed ("", "-", "72,"). */
export function isDecimalDraft(text: string): boolean {
  return DRAFT.test(text)
}

/** The number in `text`, accepting a comma or a point; null when there is none yet. */
export function parseDecimal(text: string): number | null {
  const trimmed = text.trim()
  if (!DRAFT.test(trimmed) || !/\d/.test(trimmed)) return null
  const parsed = Number(trimmed.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}
