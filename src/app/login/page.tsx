import { AuthScene } from '@/components/auth/auth-scene'
import { LoginForm } from '@/components/auth/login-form'

interface LoginPageProps {
  searchParams: Promise<{ account?: string; mode?: string; error?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { account, mode, error } = await searchParams

  return (
    <AuthScene heading="Build your life like a city.">
      <LoginForm
        accountDeleted={account === 'deleted'}
        defaultSignUp={mode === 'signup'}
        errorCode={error ?? null}
      />
    </AuthScene>
  )
}
