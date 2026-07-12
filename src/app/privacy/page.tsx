import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy | LifeQuest',
  description: 'How LifeQuest collects, uses, and protects personal data.',
}

const sectionClass = 'space-y-3 border-t border-border/60 pt-6'
const listClass = 'list-disc space-y-2 pl-5 text-sm leading-7 text-muted-foreground'

export default function PrivacyPage() {
  return (
    <main className="min-h-svh bg-background px-4 py-12 sm:px-6 sm:py-20">
      <article className="mx-auto max-w-3xl">
        <header className="max-w-2xl space-y-4 pb-10">
          <Link href="/" className="text-sm font-medium text-primary hover:underline">
            LifeQuest
          </Link>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: July 11, 2026</p>
          <p className="text-base leading-7 text-muted-foreground">
            This policy explains what LifeQuest processes when you use the application, why it is needed, and which choices you have. LifeQuest is operated by Patrick Eger in Germany.
          </p>
        </header>

        <div className="space-y-8">
          <section className={sectionClass}>
            <h2 className="text-xl font-semibold">1. Data we process</h2>
            <ul className={listClass}>
              <li>Account information such as your email address, display name, avatar, timezone, and authentication identifiers.</li>
              <li>Content you choose to create, including journal responses, learnings, tasks, habits, routines, goals, plans, quests, and city progress.</li>
              <li>Technical and security information generated while operating the service, such as timestamps, browser details, IP address, and error or request logs maintained by our infrastructure providers.</li>
              <li>AI assistant messages and contextual app content only when you explicitly enable the contextual AI assistant.</li>
            </ul>
          </section>

          <section className={sectionClass}>
            <h2 className="text-xl font-semibold">2. Why we process it</h2>
            <ul className={listClass}>
              <li>To create and secure your account and provide the LifeQuest features you request.</li>
              <li>To save, synchronize, and display your personal progress across sessions.</li>
              <li>To prevent abuse, diagnose failures, and maintain the reliability of the service.</li>
              <li>To provide contextual AI assistance when you have given consent.</li>
              <li>To meet legal obligations and respond to valid legal requests.</li>
            </ul>
            <p className="text-sm leading-7 text-muted-foreground">
              Depending on the processing activity, the legal basis is performance of the service agreement, our legitimate interest in operating a secure service, compliance with legal obligations, or your consent for optional AI context processing.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className="text-xl font-semibold">3. Service providers</h2>
            <p className="text-sm leading-7 text-muted-foreground">
              We use service providers to operate LifeQuest. They process data only for the services they provide and under their own contractual and privacy obligations.
            </p>
            <ul className={listClass}>
              <li><a href="https://supabase.com/privacy" target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">Supabase</a> provides authentication and database infrastructure.</li>
              <li><a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">Vercel</a> provides application hosting and delivery infrastructure.</li>
              <li>Google processes authentication information when you choose Google sign-in.</li>
              <li><a href="https://openrouter.ai/privacy" target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">OpenRouter</a> routes optional AI assistant requests to the configured model provider.</li>
            </ul>
            <p className="text-sm leading-7 text-muted-foreground">
              Some providers may process data outside the European Economic Area. Where required, transfers rely on the safeguards offered by the relevant provider and applicable data-protection law.
            </p>
          </section>

          <section id="ai-assistant" className={`${sectionClass} scroll-mt-8`}>
            <h2 className="text-xl font-semibold">4. Contextual AI assistant</h2>
            <div className="rounded-2xl border bg-muted/25 p-5">
              <p className="text-sm font-semibold">Off by default</p>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                LifeQuest does not send your app context to an AI provider until you explicitly enable the assistant. When enabled, each request may include your conversation, up to 15 recent tasks, up to 15 active habits, and up to 10 completed journal entries from the previous 30 days, including selected response content.
              </p>
            </div>
            <p className="text-sm leading-7 text-muted-foreground">
              This context is sent to OpenRouter and the model provider selected by LifeQuest so they can generate a response. Their handling and retention of request data are governed by their applicable terms and privacy settings. Avoid entering information you do not want processed by an AI provider.
            </p>
            <p className="text-sm leading-7 text-muted-foreground">
              You can withdraw consent at any time under <strong className="font-semibold text-foreground">Settings → AI &amp; privacy</strong>. Disabling the assistant immediately blocks future contextual AI requests. Withdrawal does not affect processing that occurred before consent was withdrawn.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className="text-xl font-semibold">5. Storage and retention</h2>
            <p className="text-sm leading-7 text-muted-foreground">
              We retain account content while your account is active so LifeQuest can provide the service. You can permanently delete your account and associated LifeQuest data from the Settings danger zone, or contact us for help. Limited information may remain temporarily in backups, security logs, or where retention is required by law. Third-party providers may apply their own documented retention periods to operational and AI request data.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className="text-xl font-semibold">6. Your rights</h2>
            <p className="text-sm leading-7 text-muted-foreground">
              Subject to applicable law, you may request access, correction, deletion, restriction, or portability of your personal data; object to certain processing; and withdraw consent. You may also lodge a complaint with your local data-protection authority.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className="text-xl font-semibold">7. Cookies and local storage</h2>
            <p className="text-sm leading-7 text-muted-foreground">
              LifeQuest uses authentication cookies required to keep you signed in and local storage to remember device-level preferences such as appearance. We do not currently use advertising cookies.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className="text-xl font-semibold">8. Security and age</h2>
            <p className="text-sm leading-7 text-muted-foreground">
              We use technical and organizational safeguards intended to protect your information, but no online service can guarantee absolute security. LifeQuest is not intended for children under 16.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className="text-xl font-semibold">9. Contact and changes</h2>
            <p className="text-sm leading-7 text-muted-foreground">
              For privacy requests, account deletion, or questions, contact <a href="mailto:privacy@lifequest.app" className="text-primary underline underline-offset-4">privacy@lifequest.app</a>. We will update the date above when this policy materially changes and provide additional notice when required.
            </p>
          </section>
        </div>

        <footer className="mt-12 flex flex-wrap gap-4 border-t pt-6 text-sm">
          <Link href="/" className="font-medium text-primary hover:underline">Back to home</Link>
          <Link href="/terms" className="text-muted-foreground hover:text-foreground">Terms of Service</Link>
        </footer>
      </article>
    </main>
  )
}
