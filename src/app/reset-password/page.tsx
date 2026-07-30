import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AuthScene } from '@/components/auth/auth-scene'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'

// Reached through the recovery email: /auth/callback exchanges the code for a
// session and forwards here. Deliberately outside the (app) route group so the
// app shell and bottom navigation stay off an auth screen.
export default async function ResetPasswordPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // No session means the link was never valid, was already used, or expired.
  if (!user) redirect('/login?error=reset_link_invalid')

  return (
    <AuthScene heading="Set a new password.">
      <ResetPasswordForm email={user.email ?? ''} />
    </AuthScene>
  )
}
