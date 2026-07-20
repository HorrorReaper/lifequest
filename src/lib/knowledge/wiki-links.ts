export type WikiLink = {
  raw: string
  targetTitle: string
  targetHeading: string | null
  displayText: string | null
}

type NoteReference = {
  id: string
  title: string
  aliases?: string[]
}

const wikiLinkPattern = /\[\[([^\]\n]+)\]\]/g

function mapOutsideCode(
  markdown: string,
  transform: (segment: string) => string
) {
  const fencedParts = markdown.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/g)

  return fencedParts
    .map((part, index) => {
      if (index % 2 === 1) return part
      const inlineParts = part.split(/(`+[^`\n]*`+)/g)
      return inlineParts
        .map((inlinePart, inlineIndex) =>
          inlineIndex % 2 === 1 ? inlinePart : transform(inlinePart)
        )
        .join('')
    })
    .join('')
}

function parseTarget(value: string): Omit<WikiLink, 'raw'> | null {
  const [destination = '', displayText] = value.split('|', 2)
  const [targetTitle = '', targetHeading] = destination.split('#', 2)
  const title = targetTitle.trim()
  if (!title) return null

  return {
    targetTitle: title,
    targetHeading: targetHeading?.trim() || null,
    displayText: displayText?.trim() || null,
  }
}

export function extractWikiLinks(markdown: string): WikiLink[] {
  const links: WikiLink[] = []

  mapOutsideCode(markdown, (segment) => {
    for (const match of segment.matchAll(wikiLinkPattern)) {
      const parsed = parseTarget(match[1])
      if (parsed) links.push({ raw: match[0], ...parsed })
    }
    return segment
  })

  return links
}

export function wikiLinksForSave(markdown: string) {
  const unique = new Map<string, Omit<WikiLink, 'raw'>>()

  for (const { targetTitle, targetHeading, displayText } of extractWikiLinks(markdown)) {
    const key = `${targetTitle.toLocaleLowerCase()}#${targetHeading?.toLocaleLowerCase() ?? ''}`
    if (!unique.has(key)) unique.set(key, { targetTitle, targetHeading, displayText })
  }

  return Array.from(unique.values()).map((link) => ({
    target_title: link.targetTitle,
    target_heading: link.targetHeading,
    display_text: link.displayText,
  }))
}

export function renderWikiLinks(
  markdown: string,
  notes: NoteReference[]
) {
  const noteByName = new Map<string, NoteReference>()
  for (const note of notes) {
    noteByName.set(note.title.toLocaleLowerCase(), note)
    for (const alias of note.aliases ?? []) {
      if (!noteByName.has(alias.toLocaleLowerCase())) {
        noteByName.set(alias.toLocaleLowerCase(), note)
      }
    }
  }

  return mapOutsideCode(markdown, (segment) =>
    segment.replace(wikiLinkPattern, (raw, value: string) => {
      const parsed = parseTarget(value)
      if (!parsed) return raw
      const note = noteByName.get(parsed.targetTitle.toLocaleLowerCase())
      const label = (parsed.displayText || parsed.targetTitle)
        .replaceAll('[', '\\[')
        .replaceAll(']', '\\]')
      const destination = note?.id ?? `new:${parsed.targetTitle}`
      const heading = parsed.targetHeading
        ? `&heading=${encodeURIComponent(parsed.targetHeading)}`
        : ''
      return `[${label}](#knowledge-note=${encodeURIComponent(destination)}${heading})`
    })
  )
}

export function normalizeKnowledgeTag(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/^#+/, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9äöüß_-]/g, '')
}

export function createNoteSlug(title: string, suffix: string) {
  const base = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 180)

  return `${base || 'note'}-${suffix.slice(0, 8)}`
}
