import { LoginForm } from '@/components/auth/login-form'

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
            className={`${shape} login-building relative rounded-t-sm bg-slate-950/95 shadow-2xl`}
          >
            <div className="login-window-grid grid grid-cols-2 gap-1 p-2 opacity-60">
              {Array.from({ length: 8 }).map((_, i) => (
                <span
                  key={i}
                  className={`login-window h-1 rounded-full ${
                    (i + index) % 3 === 0 ? 'bg-amber-300/70' : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="login-park absolute inset-x-0 bottom-5 z-10 h-20">
        {[
          'left-[3%] h-14 w-10',
          'left-[13%] h-10 w-8',
          'right-[14%] h-12 w-9',
          'right-[3%] h-16 w-11',
        ].map((position, index) => (
          <span key={position} className={`login-tree absolute bottom-0 ${position}`}>
            <span className="login-tree-trunk absolute bottom-0 left-1/2 h-8 w-1.5 -translate-x-1/2 rounded-full bg-[#263f30]" />
            <span className={`login-tree-canopy absolute left-1/2 top-0 size-full -translate-x-1/2 rounded-[52%_48%_46%_54%] ${index % 2 === 0 ? 'bg-[#315b43]' : 'bg-[#3d6a4a]'}`} />
          </span>
        ))}
        {[
          'left-[1%] h-5 w-16 bg-[#294a38]',
          'left-[9%] h-3 w-12 bg-[#355943]',
          'left-[20%] h-4 w-14 bg-[#2f513d]',
          'right-[21%] h-3 w-12 bg-[#355943]',
          'right-[10%] h-4 w-16 bg-[#294a38]',
          'right-[1%] h-3 w-11 bg-[#355943]',
        ].map((position) => (
          <span key={position} className={`login-shrub absolute bottom-0 rounded-[70%_70%_20%_20%] ${position}`} />
        ))}
        {[
          'left-[5%] top-5',
          'left-[12%] top-9',
          'right-[13%] top-4',
          'right-[6%] top-10',
        ].map((position) => (
          <span key={position} className={`login-wind-leaf absolute h-1.5 w-2.5 rounded-[100%_0_100%_0] bg-[#638466] ${position}`} />
        ))}
      </div>
      <div className="login-city-ground absolute inset-x-0 bottom-0 z-20 h-12 bg-[linear-gradient(180deg,transparent_0%,rgba(7,15,27,0.88)_48%,#070f1b_100%)]" />
    </div>
  )
}

interface LoginPageProps {
  searchParams: Promise<{ account?: string; mode?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { account, mode } = await searchParams

  return (
    <div className="relative min-h-svh overflow-hidden bg-slate-950 text-white">
      <div className="login-sky-day absolute inset-0 bg-[linear-gradient(180deg,#6fa7cb_0%,#a8cad4_40%,#edc18e_68%,#253341_100%)]" />
      <div className="login-sky-sunset absolute inset-0 bg-[radial-gradient(circle_at_34%_22%,rgba(255,210,117,0.5),transparent_28%),linear-gradient(180deg,#384d78_0%,#7a607a_38%,#d88f62_66%,#171f2e_100%)]" />
      <div className="login-sky-night absolute inset-0 bg-[radial-gradient(circle_at_72%_15%,rgba(158,185,224,0.16),transparent_23%),linear-gradient(180deg,#071226_0%,#16294a_46%,#303856_68%,#080e1b_100%)]" />
      <div aria-hidden="true" className="login-stars absolute inset-0">
        {[
          'left-[8%] top-[12%]', 'left-[18%] top-[29%]', 'left-[31%] top-[9%]',
          'left-[44%] top-[21%]', 'left-[58%] top-[11%]', 'left-[69%] top-[31%]',
          'left-[79%] top-[8%]', 'left-[91%] top-[24%]', 'left-[52%] top-[36%]',
        ].map((position, index) => (
          <span key={position} className={`absolute ${position} rounded-full bg-white ${index % 3 === 0 ? 'size-1' : 'size-0.5'}`} />
        ))}
      </div>
      <div aria-hidden="true" className="login-sun absolute left-0 top-[18%] size-16 rounded-full bg-[#ffe7a0] shadow-[0_0_55px_18px_rgb(255_204_94_/_0.32)]" />
      <div aria-hidden="true" className="login-moon absolute left-0 top-[16%] size-12 rounded-full bg-[#e7eef8] shadow-[0_0_38px_12px_rgb(185_211_242_/_0.2)] after:absolute after:right-1 after:top-2 after:size-3 after:rounded-full after:bg-[#cbd7e7]/45 after:content-['']" />
      <div className="login-sky-glow absolute -left-[15vw] -top-[28vw] size-[72vw] rounded-full bg-amber-300/15 blur-[90px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_20%,rgba(255,255,255,0.36),transparent_7%),radial-gradient(circle_at_78%_18%,rgba(255,255,255,0.12),transparent_9%)]" />
      <div aria-hidden="true" className="login-cloud login-cloud-one absolute left-0 top-[14%] h-5 w-28 rounded-full bg-white/12 blur-[1px]" />
      <div aria-hidden="true" className="login-cloud login-cloud-two absolute left-0 top-[27%] h-3 w-20 rounded-full bg-white/8 blur-[1px]" />
      <div aria-hidden="true" className="login-flight absolute left-0 top-[24%] h-px w-16 bg-gradient-to-r from-transparent via-amber-100/50 to-white/80" />
      <div aria-hidden="true" className="login-haze absolute inset-x-[-15%] bottom-36 h-24 bg-gradient-to-r from-transparent via-amber-200/10 to-transparent blur-2xl" />
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
          <LoginForm accountDeleted={account === 'deleted'} defaultSignUp={mode === 'signup'} />
        </section>
      </div>
    </div>
  )
}
