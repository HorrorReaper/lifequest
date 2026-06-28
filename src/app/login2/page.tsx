import { LoginFormAlt } from "@/components/auth/login-form-alt"


export default function LoginPage() {
  return (
    <div
      className="relative flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10"
      style={{
        backgroundImage: "url('/images/login-bg.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* subtle overlay for contrast */}
      <div className="absolute inset-0 bg-black/20 pointer-events-none" />

      <div className="relative flex w-full max-w-sm flex-col gap-6">
        <LoginFormAlt />
      </div>
    </div>
  )
}
