import { describe, expect, it } from 'vitest'
import {
  applyMarkdownAction,
  firstMarkdownImage,
  isSafeImageUrl,
  isSafeLinkUrl,
  markdownExcerpt,
} from '@/lib/markdown-text'

describe('safe urls', () => {
  it('shows images only from https', () => {
    expect(isSafeImageUrl('https://example.com/a.jpg')).toBe(true)
    expect(isSafeImageUrl('http://example.com/a.jpg')).toBe(false)
    expect(isSafeImageUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeImageUrl('data:image/png;base64,xx')).toBe(false)
    expect(isSafeImageUrl('not a url')).toBe(false)
    expect(isSafeImageUrl(undefined)).toBe(false)
  })

  it('links to http, https and mailto only', () => {
    expect(isSafeLinkUrl('https://example.com')).toBe(true)
    expect(isSafeLinkUrl('http://example.com')).toBe(true)
    expect(isSafeLinkUrl('mailto:a@b.c')).toBe(true)
    expect(isSafeLinkUrl('javascript:alert(1)')).toBe(false)
  })
})

describe('firstMarkdownImage', () => {
  it('finds the first image that would be shown', () => {
    expect(
      firstMarkdownImage('Text ![old](http://insecure/x.jpg) more ![lake](https://img.example/lake.jpg "Lake")')
    ).toBe('https://img.example/lake.jpg')
    expect(firstMarkdownImage('No images here.')).toBeNull()
    expect(firstMarkdownImage(null)).toBeNull()
  })
})

describe('markdownExcerpt', () => {
  it('turns Markdown into one plain line', () => {
    expect(
      markdownExcerpt('## Morning\nWoke up **early** and read [a book](https://x.y).\n\n![pic](https://p.q/r.jpg)\n- tea\n> calm')
    ).toBe('Morning Woke up early and read a book. tea calm')
  })

  it('cuts long text at a word', () => {
    const text = 'word '.repeat(60)
    const excerpt = markdownExcerpt(text, 40)
    expect(excerpt.length).toBeLessThanOrEqual(41)
    expect(excerpt.endsWith('…')).toBe(true)
    expect(excerpt).not.toMatch(/wor…$/)
  })
})

describe('applyMarkdownAction', () => {
  it('wraps the selection in bold and keeps it selected', () => {
    const result = applyMarkdownAction('a quiet day', 2, 7, 'bold')
    expect(result.text).toBe('a **quiet** day')
    expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe('quiet')
  })

  it('inserts a placeholder when nothing is selected', () => {
    const result = applyMarkdownAction('', 0, 0, 'italic')
    expect(result.text).toBe('_italic text_')
  })

  it('prefixes the current lines for headings and lists', () => {
    expect(applyMarkdownAction('one\ntwo', 4, 7, 'heading').text).toBe('one\n## two')
    expect(applyMarkdownAction('tea\ncake', 0, 8, 'list').text).toBe('- tea\n- cake')
  })

  it('selects the https part of a new link or image to type over', () => {
    const link = applyMarkdownAction('see here', 4, 8, 'link')
    expect(link.text).toBe('see [here](https://)')
    expect(link.text.slice(link.selectionStart, link.selectionEnd)).toBe('https://')
    const image = applyMarkdownAction('', 0, 0, 'image')
    expect(image.text).toBe('![Describe the image](https://)')
    expect(image.text.slice(image.selectionStart, image.selectionEnd)).toBe('https://')
  })
})
