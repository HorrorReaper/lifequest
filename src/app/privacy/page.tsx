import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-24 max-w-4xl">
      <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>

      <p className="text-sm text-muted-foreground mb-6">Last updated: May 11, 2026</p>

      <section className="text-sm text-muted-foreground mb-6">
        <p>
          LifeQuest (“we”, “us”, or “our”) respects your privacy. This Privacy Policy explains what information
          we collect, how we use it, and the choices you have regarding your information. This is a general overview
          and not legal advice — replace or review with your legal counsel before publishing.
        </p>
      </section>

      <section className="text-sm text-muted-foreground mb-6">
        <h2 className="font-semibold mb-2">1. Information We Collect</h2>
        <ul className="list-disc pl-5">
          <li>Account data (name, email) when you sign up.</li>
          <li>Journal and in-app content you create (entries, tasks, habits).</li>
          <li>Usage data (features used, timestamps) for analytics and product improvements.</li>
          <li>Device and technical data (IP, browser, OS) for security and diagnostics.</li>
        </ul>
      </section>

      <section className="text-sm text-muted-foreground mb-6">
        <h2 className="font-semibold mb-2">2. How We Use Information</h2>
        <p>We use collected data to:</p>
        <ul className="list-disc pl-5">
          <li>Provide and operate the Service.</li>
          <li>Improve and personalize features.</li>
          <li>Analyze usage to detect and prevent abuse.</li>
          <li>Communicate updates, marketing (with opt-out), and support.</li>
        </ul>
      </section>

      <section className="text-sm text-muted-foreground mb-6">
        <h2 className="font-semibold mb-2">3. Sharing & Disclosure</h2>
        <p>
          We do not sell personal data. We may share information with service providers who perform services on our behalf
          (hosting, analytics, email delivery). We may disclose information to comply with the law or to protect rights.
        </p>
      </section>

      <section className="text-sm text-muted-foreground mb-6">
        <h2 className="font-semibold mb-2">4. Your Choices</h2>
        <ul className="list-disc pl-5">
          <li>Access, edit, or delete account data from your account settings.</li>
          <li>Opt out of marketing emails via the unsubscribe link.</li>
          <li>Control cookies and tracking via your browser settings.</li>
        </ul>
      </section>

      <section className="text-sm text-muted-foreground mb-6">
        <h2 className="font-semibold mb-2">5. Data Security & Retention</h2>
        <p>
          We use industry-standard measures to protect data. We retain information as long as needed to provide the
          Service or as required by law.
        </p>
      </section>

      <section className="text-sm text-muted-foreground">
        <h2 className="font-semibold mb-2">6. Contact</h2>
        <p>
          For questions about this policy or requests regarding your data, contact us at <a href="mailto:privacy@lifequest.app" className="text-primary hover:underline">privacy@lifequest.app</a>.
        </p>
      </section>

      <div className="mt-8">
        <Link href="/" className="text-primary hover:underline">Back to home</Link>
      </div>
    </div>
  );
}
