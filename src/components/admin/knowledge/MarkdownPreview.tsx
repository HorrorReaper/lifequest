'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { KnowledgeNoteRow } from '@/lib/supabase/database.types'
import { renderWikiLinks } from '@/lib/knowledge/wiki-links'
import { cn } from '@/lib/utils'

export function MarkdownPreview({
  content,
  notes,
  onOpenNote,
  className,
}: {
  content: string
  notes: KnowledgeNoteRow[]
  onOpenNote: (reference: string, heading?: string) => void
  className?: string
}) {
  const rendered = renderWikiLinks(content, notes)

  return (
    <div className={cn('min-h-80 text-[15px] leading-7 text-foreground', className)}>
      {content.trim() ? (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => <h1 className="mb-5 mt-2 text-3xl font-semibold tracking-tight">{children}</h1>,
            h2: ({ children }) => <h2 className="mb-3 mt-8 text-2xl font-semibold tracking-tight">{children}</h2>,
            h3: ({ children }) => <h3 className="mb-2 mt-6 text-xl font-semibold">{children}</h3>,
            p: ({ children }) => <p className="my-3">{children}</p>,
            ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-6">{children}</ul>,
            ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-6">{children}</ol>,
            li: ({ children }) => <li className="pl-1">{children}</li>,
            blockquote: ({ children }) => <blockquote className="my-4 border-l-4 border-primary/40 bg-muted/40 px-4 py-2 text-muted-foreground">{children}</blockquote>,
            code: ({ className: codeClassName, children }) =>
              codeClassName ? (
                <code className={cn('block overflow-x-auto rounded-xl bg-muted p-4 font-mono text-sm', codeClassName)}>{children}</code>
              ) : (
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]">{children}</code>
              ),
            a: ({ href = '', children }) => {
              if (href.startsWith('#knowledge-note=')) {
                const params = new URLSearchParams(href.slice(1))
                const reference = decodeURIComponent(params.get('knowledge-note') ?? '')
                const heading = params.get('heading') ?? undefined
                return (
                  <button
                    type="button"
                    className="font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary"
                    onClick={() => onOpenNote(reference, heading)}
                  >
                    {children}
                  </button>
                )
              }
              return <a className="font-medium text-primary underline underline-offset-4" href={href} target="_blank" rel="noreferrer">{children}</a>
            },
            hr: () => <hr className="my-8 border-border" />,
            table: ({ children }) => <div className="my-5 overflow-x-auto"><table className="w-full border-collapse text-sm">{children}</table></div>,
            th: ({ children }) => <th className="border bg-muted/50 px-3 py-2 text-left font-semibold">{children}</th>,
            td: ({ children }) => <td className="border px-3 py-2 align-top">{children}</td>,
          }}
        >
          {rendered}
        </ReactMarkdown>
      ) : (
        <div className="grid min-h-80 place-items-center rounded-2xl border border-dashed text-sm text-muted-foreground">
          Nothing to preview yet.
        </div>
      )}
    </div>
  )
}
