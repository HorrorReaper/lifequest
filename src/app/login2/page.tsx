import { LoginFormAlt } from "@/components/auth/login-form-alt"

function Skyline() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 overflow-hidden">
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950 to-slate-900" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-center gap-1 opacity-90">
        {[
          'h-20 w-10',
          'h-32 w-14',
          'h-24 w-12',
          'h-40 w-16',
          'h-28 w-10',
          'h-48 w-20',
          'h-36 w-14',
          'h-24 w-12',
          'h-44 w-16',
          'h-[7.5rem] w-10',
          'h-52 w-20',
          'h-36 w-14',
        ].map((shape, index) => (
          <div
            key={index}
            className={`${shape} rounded-t-sm bg-slate-950/95 shadow-2xl`}
          >
            <div className="grid grid-cols-2 gap-1 p-2 opacity-60">
              {Array.from({ length: 8 }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1 rounded-full ${
                    (i + index) % 3 === 0 ? 'bg-amber-300/70' : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background via-background/80 to-transparent" />
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="relative min-h-svh overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_18%,rgba(251,191,36,0.36),transparent_30%),linear-gradient(180deg,#23375f_0%,#5c5877_36%,#d28b5d_60%,#111827_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_20%,rgba(255,255,255,0.36),transparent_7%),radial-gradient(circle_at_78%_18%,rgba(255,255,255,0.12),transparent_9%)]" />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-950/35 to-slate-950/80" />
      <Skyline />

      <div className="relative z-10 flex min-h-svh w-full items-center justify-center px-6 py-10">
        <section className="flex w-full max-w-sm flex-col gap-6">
          <div className="space-y-2 text-center">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-amber-200/90">
              LifeQuest
            </p>
            <h1 className="text-3xl font-black leading-tight">Build your life like a city.</h1>
          </div>
          <LoginFormAlt />
        </section>
      </div>
    </div>
  )
}
