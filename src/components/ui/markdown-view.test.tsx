import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MarkdownView } from '@/components/ui/markdown-view'
import { MarkdownField } from '@/components/journal/markdown-field'

afterEach(cleanup)

describe('MarkdownView', () => {
  it('renders Markdown with lists, headings and safe links', () => {
    const { container } = render(
      <MarkdownView content={'## Three things\n- **tea**\n- [walk](https://maps.example)\n\n[bad](javascript:alert(1))'} />
    )
    expect(screen.getByText('Three things').tagName).toBe('H3')
    expect(screen.getByText('tea').tagName).toBe('STRONG')
    const link = screen.getByRole('link', { name: 'walk' })
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
    expect(screen.queryByRole('link', { name: 'bad' })).toBeNull()
    expect(container.textContent).toContain('bad')
  })

  it('shows images from https links only, without a referrer', () => {
    render(<MarkdownView content={'![lake](https://img.example/lake.jpg)\n\n![old](http://img.example/old.jpg)'} />)
    const image = screen.getByRole('img', { name: 'lake' })
    expect(image.getAttribute('referrerpolicy')).toBe('no-referrer')
    expect(image.getAttribute('loading')).toBe('lazy')
    expect(screen.queryByRole('img', { name: 'old' })).toBeNull()
    expect(screen.getByText(/Image not shown: old/)).toBeTruthy()
  })

  it('never renders raw HTML', () => {
    const { container } = render(<MarkdownView content={'Hi <script>alert(1)</script><img src=x onerror="alert(1)">'} />)
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
  })
})

describe('MarkdownField', () => {
  it('formats the selection and previews the result', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 0
    })
    const onChange = vi.fn()
    const { rerender } = render(<MarkdownField value="a quiet day" onChange={onChange} />)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    textarea.setSelectionRange(2, 7)
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }))
    expect(onChange).toHaveBeenCalledWith('a **quiet** day')

    rerender(<MarkdownField value="a **quiet** day" onChange={onChange} />)
    fireEvent.click(screen.getByRole('tab', { name: 'preview' }))
    expect(screen.getByText('quiet').tagName).toBe('STRONG')
    expect(screen.getByRole('button', { name: 'Bold' }).hasAttribute('disabled')).toBe(true)
    vi.unstubAllGlobals()
  })
})
