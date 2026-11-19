/**
 * Small helpers for Markdown written in journal fields (the `markdown` field
 * type, used by the diary). Rendering is `MarkdownView`; these work on the
 * raw text, for previews in lists.
 */

/** Only images and links on https (links also http and mailto) are shown. */
export function isSafeImageUrl(url: string | null | undefined): url is string {
  if (!url) return false
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

export function isSafeLinkUrl(url: string | null | undefined): url is string {
  if (!url) return false
  try {
    return ['https:', 'http:', 'mailto:'].includes(new URL(url).protocol)
  } catch {
    return false
  }
}

const IMAGE_PATTERN = /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g

/** The first image in the text that would be shown, for a list thumbnail. */
export function firstMarkdownImage(text: string | null | undefined): string | null {
  if (!text) return null
  for (const match of text.matchAll(IMAGE_PATTERN)) {
    if (isSafeImageUrl(match[1])) return match[1]
  }
  return null
}

/**
 * The text as one plain line: images dropped, links reduced to their words,
 * Markdown marks removed, whitespace collapsed, cut at `max` characters.
 */
export function markdownExcerpt(text: string | null | undefined, max = 160): string {
  if (!text) return ''
  const plain = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(IMAGE_PATTERN, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/(\*\*|__|\*|_|~~|`)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (plain.length <= max) return plain
  const cut = plain.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

export type MarkdownAction = 'bold' | 'italic' | 'heading' | 'list' | 'link' | 'image'

/**
 * Applies a toolbar action to a selection of `text`. Returns the new text and
 * the selection to set afterwards: the wrapped words, or the placeholder to
 * type over.
 */
export function applyMarkdownAction(
  text: string,
  start: number,
  end: number,
  action: MarkdownAction
): { text: string; selectionStart: number; selectionEnd: number } {
  const selected = text.slice(start, end)
  const before = text.slice(0, start)
  const after = text.slice(end)

  function wrap(open: string, close: string, fallback: string) {
    const inner = selected || fallback
    return {
      text: `${before}${open}${inner}${close}${after}`,
      selectionStart: start + open.length,
      selectionEnd: start + open.length + inner.length,
    }
  }

  function prefixLines(prefix: string) {
    const lineStart = before.lastIndexOf('\n') + 1
    const head = text.slice(0, lineStart)
    const body = text.slice(lineStart, end) || ''
    const prefixed = body
      .split('\n')
      .map((line) => (line.startsWith(prefix) ? line : `${prefix}${line}`))
      .join('\n')
    const nextText = `${head}${prefixed}${after}`
    const caret = head.length + prefixed.length
    return { text: nextText, selectionStart: caret, selectionEnd: caret }
  }

  switch (action) {
    case 'bold':
      return wrap('**', '**', 'bold text')
    case 'italic':
      return wrap('_', '_', 'italic text')
    case 'heading':
      return prefixLines('## ')
    case 'list':
      return prefixLines('- ')
    case 'link': {
      const label = selected || 'link text'
      const inserted = `[${label}](https://)`
      const urlStart = start + label.length + 3
      return {
        text: `${before}${inserted}${after}`,
        selectionStart: urlStart,
        selectionEnd: urlStart + 'https://'.length,
      }
    }
    case 'image': {
      const alt = selected || 'Describe the image'
      const inserted = `![${alt}](https://)`
      const urlStart = start + alt.length + 4
      return {
        text: `${before}${inserted}${after}`,
        selectionStart: urlStart,
        selectionEnd: urlStart + 'https://'.length,
      }
    }
  }
}
