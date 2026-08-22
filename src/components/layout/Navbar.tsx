import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function Navbar({ is_MVP, setWaitlistOpen }: { is_MVP: boolean; setWaitlistOpen: (open: boolean) => void }) {
    return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-[#060a14]/90 border-b border-white/[0.08]">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-6xl">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <Image src="/images/logo2.png" alt="LifeQuest logo" width={170} height={170} className="rounded-sm" />
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#features" className="text-[#93a3c4] hover:text-[#f3f5fb]">Features</a>
            <a href="#how-it-works" className="text-[#93a3c4] hover:text-[#f3f5fb]">How it works</a>
            <a href="#roadmap" className="text-[#93a3c4] hover:text-[#f3f5fb]">Roadmap</a>
            <a href="#pricing" className="text-[#93a3c4] hover:text-[#f3f5fb]">Pricing</a>
          </nav>
          {is_MVP ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild className="text-[#f3f5fb] hover:bg-white/10 hover:text-[#f3f5fb]">
                <Link href="/login">Log in</Link>
              </Button>
              <Button size="sm" asChild className="bg-[linear-gradient(180deg,#ffc873,#f7b955)] text-[#1a1204] hover:opacity-90">
                <Link href="/login">Get started</Link>
              </Button>
            </div>
          ) : (
            <div className="flex items-center">
              <Button size="sm"
                onClick={() => setWaitlistOpen(true)}
                className="px-5 py-3 rounded-lg bg-[linear-gradient(180deg,#ffc873,#f7b955)] text-[#1a1204] hover:cursor-pointer hover:opacity-90"
              >
                Join the waitlist
              </Button>
            </div>
          )}
        </div>
      </header>
    );
}