import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-24 max-w-4xl">
      <h1 className="text-3xl font-bold mb-4">Terms of Service</h1>

      <p className="text-sm text-muted-foreground mb-6">Effective date: May 11, 2026</p>

      <section className="text-sm text-muted-foreground mb-6">
        <p>
          These Terms of Service ("Terms") govern your use of LifeQuest. By accessing or using the Service, you agree
          to be bound by these Terms. If you do not agree, do not use the Service.
        </p>
      </section>

      <section className="text-sm text-muted-foreground mb-6">
        <h2 className="font-semibold mb-2">1. Using the Service</h2>
        <p>
          You may use the Service only for lawful purposes and in accordance with these Terms. You are responsible for
          maintaining the confidentiality of your account credentials.
        </p>
      </section>

      <section className="text-sm text-muted-foreground mb-6">
        <h2 className="font-semibold mb-2">2. User Content</h2>
        <p>
          You retain ownership of content you create (journal entries, tasks, templates). By submitting content, you
          grant LifeQuest a non-exclusive license to store, display, and operate the Service. Do not upload content that
          infringes others' rights or violates laws.
        </p>
      </section>

      <section className="text-sm text-muted-foreground mb-6">
        <h2 className="font-semibold mb-2">3. Prohibited Conduct</h2>
        <p>
          You must not: attempt unauthorized access, interfere with the Service, upload malicious content, or abuse
          other users. We may suspend or terminate accounts for violations.
        </p>
      </section>

      <section className="text-sm text-muted-foreground mb-6">
        <h2 className="font-semibold mb-2">4. Termination</h2>
        <p>
          We may suspend or terminate access at any time for violation of these Terms or for operational reasons.
        </p>
      </section>

      <section className="text-sm text-muted-foreground mb-6">
        <h2 className="font-semibold mb-2">5. Disclaimers</h2>
        <p>
          The Service is provided "as is" and "as available." To the fullest extent permitted by law, we disclaim
          warranties of merchantability, fitness for a particular purpose, and non-infringement.
        </p>
      </section>

      <section className="text-sm text-muted-foreground mb-6">
        <h2 className="font-semibold mb-2">6. Limitation of Liability</h2>
        <p>
          We are not liable for indirect, incidental, special, consequential, or punitive damages arising from your use
          of the Service. Our aggregate liability is limited to the amounts you paid, if any, in the prior 12 months.
        </p>
      </section>

      <section className="text-sm text-muted-foreground mb-6">
        <h2 className="font-semibold mb-2">7. Changes</h2>
        <p>
          We may modify these Terms; material changes will be communicated. Continued use after changes constitutes
          acceptance of the updated Terms.
        </p>
      </section>

      <section className="text-sm text-muted-foreground">
        <h2 className="font-semibold mb-2">8. Contact</h2>
        <p>
          For questions about these Terms, contact <a href="mailto:legal@lifequest.app" className="text-primary hover:underline">legal@lifequest.app</a>.
        </p>
      </section>

      <div className="mt-8">
        <Link href="/" className="text-primary hover:underline">Back to home</Link>
      </div>
    </div>
  );
}
