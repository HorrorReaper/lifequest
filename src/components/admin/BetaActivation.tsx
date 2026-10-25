import { activationRate, type ActivationStep } from '@/lib/activation'

interface FeedbackRow {
  id: string
  category: string
  message: string
  page_path: string | null
  created_at: string
}

interface BetaActivationProps {
  /** First day of the cohort, `YYYY-MM-DD` (UTC). */
  since: string
  steps: ActivationStep[] | null
  feedback: FeedbackRow[] | null
  /** Why the numbers are missing, when they are. */
  unavailable: 'untrusted' | 'error' | null
}

/**
 * The first cohort at a glance: how far new accounts got, and what they
 * wrote in "Send feedback". Counts and the feedback text only -- no names,
 * no task titles, no journal text.
 */
export function BetaActivation({ since, steps, feedback, unavailable }: BetaActivationProps) {
  const signedUp = steps?.[0]?.count ?? 0

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5" aria-labelledby="beta-activation">
      <div>
        <h2 id="beta-activation" className="text-lg font-semibold">
          Beta activation
        </h2>
        <p className="text-sm text-muted-foreground">Accounts created since {since}.</p>
      </div>

      {unavailable ? (
        <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
          {unavailable === 'untrusted'
            ? 'Only an admin with the JWT admin role can read these numbers.'
            : 'Not available yet. Apply migration 20261025120000_beta_feedback_and_activation.sql, then reload.'}
        </p>
      ) : (
        <>
          <ol className="space-y-2">
            {(steps ?? []).map((step) => (
              <li key={step.key} className="grid grid-cols-[1fr_auto] items-center gap-3">
                <div>
                  <p className="text-sm font-medium">{step.label}</p>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${activationRate(step, signedUp)}%` }}
                    />
                  </div>
                </div>
                <p className="text-sm tabular-nums">
                  {step.count}{' '}
                  <span className="text-muted-foreground">({activationRate(step, signedUp)}%)</span>
                </p>
              </li>
            ))}
          </ol>

          <div>
            <h3 className="text-base font-semibold">Latest feedback</h3>
            {!feedback || feedback.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">No feedback yet.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {feedback.map((item) => (
                  <li key={item.id} className="rounded-xl border p-3">
                    <p className="text-sm text-muted-foreground">
                      {item.category} · {item.page_path ?? 'unknown page'} ·{' '}
                      {new Date(item.created_at).toLocaleString('en-US', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-base">{item.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  )
}
