import { AuthScene } from '@/components/auth/auth-scene'
import { LoginForm } from '@/components/auth/login-form'

interface LoginPageProps {
  searchParams: Promise<{ account?: string; mode?: string; error?: string; challenge?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { account, mode, error, challenge } = await searchParams

  return (
    // Arriving from a challenge landing page: the join route has already
    // remembered the challenge, so this only has to say what happens next.
    <AuthScene heading={challenge ? 'Your challenge starts right after sign-up.' : 'Build your life like a city.'}>
      <LoginForm
        accountDeleted={account === 'deleted'}
        defaultSignUp={mode === 'signup'}
        errorCode={error ?? null}
      />
    </AuthScene>
  )
}
