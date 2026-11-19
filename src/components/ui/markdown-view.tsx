'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { isSafeImageUrl, isSafeLinkUrl } from '@/lib/markdown-text'
import { cn } from '@/lib/utils'

interface MarkdownViewProps {
  content: string
  className?: string
}

/**
 * Renders Markdown a user wrote (journal `markdown` fields, the diary).
 *
 * Safe by construction: raw HTML in the text is dropped (`skipHtml`), images
 * show only from https links and links only to http, https and mailto, so
 * nothing in an entry can run code or load from an insecure page. Images
 * load lazily and without a referrer; the image host still sees the
 * reader's address when it is shown.
 */
export function MarkdownView({ content, className }: MarkdownViewProps) {
  return (
    <div className={cn('text-base leading-7 text-foreground [overflow-wrap:anywhere]', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          h1: ({ children }) => <h2 className="mb-3 mt-6 text-2xl font-semibold tracking-tight">{children}</h2>,
          h2: ({ children }) => <h3 className="mb-2 mt-6 text-xl font-semibold">{children}</h3>,
          h3: ({ children }) => <h4 className="mb-2 mt-5 text-lg font-semibold">{children}</h4>,
          h4: ({ children }) => <h5 className="mb-2 mt-4 font-semibold">{children}</h5>,
          p: ({ children }) => <p className="my-3">{children}</p>,
          ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-6">{children}</ul>,
          ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-6">{children}</ol>,
          li: ({ children }) => <li className="pl-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-4 rounded-r-xl border-l-4 border-primary/40 bg-muted/50 px-4 py-2 text-muted-foreground">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-6 border-border" />,
          code: ({ className: codeClassName, children }) =>
            codeClassName ? (
              <code className={cn('block overflow-x-auto rounded-xl bg-muted p-4 font-mono text-sm', codeClassName)}>
                {children}
              </code>
            ) : (
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]">{children}</code>
            ),
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border-b bg-muted/50 px-3 py-2 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border-b px-3 py-2 align-top">{children}</td>,
          a: ({ href, children }) =>
            isSafeLinkUrl(href) ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="font-medium text-primary underline underline-offset-4"
              >
                {children}
              </a>
            ) : (
              <span>{children}</span>
            ),
          img: ({ src, alt }) =>
            typeof src === 'string' && isSafeImageUrl(src) ? (
              // A plain img: the images come from anywhere the user links to,
              // which next/image would need listed in advance.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={alt ?? ''}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                className="my-4 block max-h-[28rem] w-full rounded-2xl bg-muted object-cover"
              />
            ) : (
              <span className="my-2 inline-block rounded-lg bg-muted px-2 py-1 text-sm text-muted-foreground">
                {alt ? `Image not shown: ${alt}` : 'Image not shown'} (only https links)
              </span>
            ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
