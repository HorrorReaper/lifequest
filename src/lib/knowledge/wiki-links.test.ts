import { describe, expect, it } from 'vitest'
import {
  createNoteSlug,
  extractWikiLinks,
  normalizeKnowledgeTag,
  renderWikiLinks,
  wikiLinksForSave,
} from './wiki-links'

describe('knowledge wiki links', () => {
  it('extracts note, heading, and display text', () => {
    expect(extractWikiLinks('Read [[Strategy#Risks|the risks]] and [[Inbox]].')).toEqual([
      {
        raw: '[[Strategy#Risks|the risks]]',
        targetTitle: 'Strategy',
        targetHeading: 'Risks',
        displayText: 'the risks',
      },
      {
        raw: '[[Inbox]]',
        targetTitle: 'Inbox',
        targetHeading: null,
        displayText: null,
      },
    ])
  })

  it('ignores links inside inline and fenced code', () => {
    const markdown = '`[[inline]]`\n```\n[[fenced]]\n```\n[[real]]'
    expect(extractWikiLinks(markdown).map((link) => link.targetTitle)).toEqual(['real'])
  })

  it('deduplicates save payloads by destination and heading', () => {
    expect(wikiLinksForSave('[[Roadmap]] [[roadmap|plan]] [[Roadmap#Later]]')).toHaveLength(2)
  })

  it('renders resolved and unresolved links as safe local anchors', () => {
    const rendered = renderWikiLinks('[[North Star]] and [[Unknown|new idea]]', [
      { id: 'note-1', title: 'North Star' },
    ])

    expect(rendered).toContain('[North Star](#knowledge-note=note-1)')
    expect(rendered).toContain('[new idea](#knowledge-note=new%3AUnknown)')
  })

  it('normalizes tags and portable slugs', () => {
    expect(normalizeKnowledgeTag(' #Product Ideas! ')).toBe('product-ideas')
    expect(createNoteSlug('Über uns', '12345678-abcd')).toBe('uber-uns-12345678')
  })
})
