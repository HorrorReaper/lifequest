import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { KnowledgeNoteRow } from '@/lib/supabase/database.types'
import { MarkdownPreview } from './MarkdownPreview'

const target = {
  id: 'note-1',
  user_id: 'user-1',
  folder_id: null,
  title: 'North Star',
  slug: 'north-star-note-1',
  content: '',
  note_type: 'note',
  properties: {},
  tags: [],
  aliases: ['Strategy'],
  is_pinned: false,
  is_archived: false,
  version: 1,
  created_at: '2026-07-20T00:00:00.000Z',
  updated_at: '2026-07-20T00:00:00.000Z',
} satisfies KnowledgeNoteRow

describe('MarkdownPreview', () => {
  it('renders Markdown and opens resolved wikilinks', async () => {
    const onOpenNote = vi.fn()
    render(
      <MarkdownPreview
        content={'## Direction\n\nRead [[Strategy|our north star]].'}
        notes={[target]}
        onOpenNote={onOpenNote}
      />
    )

    expect(screen.getByRole('heading', { name: 'Direction' })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'our north star' }))
    expect(onOpenNote).toHaveBeenCalledWith('note-1', undefined)
  })

  it('offers unresolved wikilinks as note creation references', async () => {
    const onOpenNote = vi.fn()
    render(<MarkdownPreview content="[[New idea]]" notes={[]} onOpenNote={onOpenNote} />)

    await userEvent.click(screen.getByRole('button', { name: 'New idea' }))
    expect(onOpenNote).toHaveBeenCalledWith('new:New idea', undefined)
  })
})
