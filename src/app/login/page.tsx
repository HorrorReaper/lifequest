import { LoginForm } from '@/components/auth/login-form'

export default function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo / Branding */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">
            🏰 LifeQuest
          </h1>
          <p className="text-muted-foreground text-sm">
            Journal daily. Earn XP. Build your city.
          </p>
        </div>

        <LoginForm />

        <p className="text-center text-xs text-muted-foreground">
          By signing in you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  )
}
