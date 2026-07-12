import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service | LifeQuest',
  description: 'Terms governing use of the LifeQuest application.',
}

const sectionClass = 'space-y-3 border-t border-border/60 pt-6'

export default function TermsPage() {
  return (
    <main className="min-h-svh bg-background px-4 py-12 sm:px-6 sm:py-20">
      <article className="mx-auto max-w-3xl">
        <header className="max-w-2xl space-y-4 pb-10">
          <Link href="/" className="text-sm font-medium text-primary hover:underline">
            LifeQuest
          </Link>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Terms of Service</h1>
          <p className="text-sm text-muted-foreground">Effective date: July 11, 2026</p>
          <p className="text-base leading-7 text-muted-foreground">
            These terms govern your use of LifeQuest, a personal development and journaling application operated by Patrick Eger in Germany. By creating an account or using the service, you agree to these terms.
          </p>
        </header>

        <div className="space-y-8">
          <section className={sectionClass}>
            <h2 className="text-xl font-semibold">1. Your account</h2>
            <p className="text-sm leading-7 text-muted-foreground">
              You must provide accurate account information, keep your credentials secure, and notify us if you believe your account has been compromised. You are responsible for activity performed through your account. LifeQuest is not intended for children under 16.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className="text-xl font-semibold">2. Your content</h2>
            <p className="text-sm leading-7 text-muted-foreground">
              You retain ownership of journal entries, tasks, habits, templates, and other content you create. You grant LifeQuest the limited rights needed to host, process, synchronize, back up, and display that content solely to operate and improve the service you request.
            </p>
            <p className="text-sm leading-7 text-muted-foreground">
              You are responsible for your content and must not upload material that is unlawful, infringes another person&apos;s rights, or introduces malicious code.
            </p>
          </section>

          <section id="ai" className={`${sectionClass} scroll-mt-8`}>
            <h2 className="text-xl font-semibold">3. AI assistant</h2>
            <p className="text-sm leading-7 text-muted-foreground">
              The contextual AI assistant is optional and disabled by default. If you enable it, LifeQuest may send your message and relevant app context to OpenRouter and a configured model provider as described in the <Link href="/privacy#ai-assistant" className="text-primary underline underline-offset-4">Privacy Policy</Link>.
            </p>
            <p className="text-sm leading-7 text-muted-foreground">
              AI responses can be incomplete, inaccurate, or unsuitable for your circumstances. They are not medical, legal, financial, mental-health, or other professional advice. Review AI-generated suggestions before relying on them or allowing them to affect your plans and records.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className="text-xl font-semibold">4. Acceptable use</h2>
            <p className="text-sm leading-7 text-muted-foreground">
              You must not attempt unauthorized access, interfere with service operation, probe security controls, automate abusive traffic, impersonate another person, use the service for unlawful activity, or misuse AI features to generate harmful or illegal material.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className="text-xl font-semibold">5. Availability and changes</h2>
            <p className="text-sm leading-7 text-muted-foreground">
              LifeQuest is an evolving service. Features may change, be interrupted, or be removed. We aim to preserve user content and communicate material changes, but we do not promise uninterrupted or error-free availability.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className="text-xl font-semibold">6. Suspension and termination</h2>
            <p className="text-sm leading-7 text-muted-foreground">
              You may stop using the service and request account deletion at any time. We may restrict or terminate access when reasonably necessary to address misuse, security risk, legal obligations, or a material breach of these terms. Where appropriate, we will provide notice and an opportunity to resolve the issue.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className="text-xl font-semibold">7. Disclaimers and liability</h2>
            <p className="text-sm leading-7 text-muted-foreground">
              LifeQuest supports reflection and organization but does not guarantee personal, health, financial, or business outcomes. To the extent permitted by law, the service is provided as available and without warranties beyond those that cannot legally be excluded.
            </p>
            <p className="text-sm leading-7 text-muted-foreground">
              Nothing in these terms limits liability that cannot be limited under applicable law, including mandatory consumer protections. Otherwise, liability is limited to foreseeable loss caused by a breach of our legal obligations.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className="text-xl font-semibold">8. Governing law</h2>
            <p className="text-sm leading-7 text-muted-foreground">
              German law applies, without removing mandatory protections available to consumers in their country of residence. Any mandatory statutory venue rules remain unaffected.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className="text-xl font-semibold">9. Contact and updates</h2>
            <p className="text-sm leading-7 text-muted-foreground">
              Contact <a href="mailto:legal@lifequest.app" className="text-primary underline underline-offset-4">legal@lifequest.app</a> with questions. We may update these terms as the product or legal requirements change. Material changes will receive reasonable notice where required.
            </p>
          </section>
        </div>

        <footer className="mt-12 flex flex-wrap gap-4 border-t pt-6 text-sm">
          <Link href="/" className="font-medium text-primary hover:underline">Back to home</Link>
          <Link href="/privacy" className="text-muted-foreground hover:text-foreground">Privacy Policy</Link>
        </footer>
      </article>
    </main>
  )
}
