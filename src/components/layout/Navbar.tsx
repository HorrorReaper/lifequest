import Link from "next/link";

// The landing page's own nav. Literal colours, like the page it belongs to —
// it must not follow the in-app theme.
export default function Navbar({
  is_MVP,
  setWaitlistOpen,
}: {
  is_MVP: boolean;
  setWaitlistOpen: (open: boolean) => void;
}) {
  const cta =
    "inline-flex items-center justify-center rounded-lg bg-[#d1870b] px-4 py-2.5 text-[0.92rem] font-bold text-[#1b1a17] transition-colors hover:bg-[#c07b08]";

  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-50 border-b border-[#f3efe6] bg-[#fdfcf9]/95 px-5 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1040px] items-center justify-between gap-4">
        <Link href="/" className="[font-family:var(--font-nightfall-display)] text-[1.35rem] font-extrabold tracking-tight text-[#1b1a17]">
          Life<span className="text-[#d1870b]">Quest</span>
        </Link>

        <nav className="hidden items-center gap-7 text-[0.95rem] font-medium text-[#6f6b63] md:flex">
          <a href="#how" className="hover:text-[#1b1a17]">How it works</a>
          <a href="#features" className="hover:text-[#1b1a17]">Features</a>
          <a href="#roadmap" className="hover:text-[#1b1a17]">Roadmap</a>
          <a href="#pricing" className="hover:text-[#1b1a17]">Pricing</a>
        </nav>

        {is_MVP ? (
          <div className="flex items-center gap-1">
            <Link
              href="/login"
              className="hidden rounded-lg px-3 py-2.5 text-[0.92rem] font-semibold text-[#6f6b63] transition-colors hover:text-[#1b1a17] sm:inline-flex"
            >
              Log in
            </Link>
            <Link href="/login" className={cta}>
              Get started
            </Link>
          </div>
        ) : (
          <button type="button" onClick={() => setWaitlistOpen(true)} className={`${cta} cursor-pointer`}>
            Join the waitlist
          </button>
        )}
      </div>
    </header>
  );
}
