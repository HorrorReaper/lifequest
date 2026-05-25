import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function Navbar({ is_MVP, setWaitlistOpen }: { is_MVP: boolean; setWaitlistOpen: (open: boolean) => void }) {
    return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-6xl">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <Image src="/images/logo2.png" alt="LifeQuest logo" width={170} height={170} className="rounded-sm" />
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#features" className="text-muted-foreground hover:text-foreground">Features</a>
            <a href="#how-it-works" className="text-muted-foreground hover:text-foreground">How it works</a>
            <a href="#roadmap" className="text-muted-foreground hover:text-foreground">Roadmap</a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground">Pricing</a>
          </nav>
          {is_MVP ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Log in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/login">Get started</Link>
              </Button>
            </div>
          ) : (
            <div className="flex items-center">
              <Button size="sm" variant="outline"
                onClick={() => setWaitlistOpen(true)}
                className="px-5 py-3 rounded-lg bg-black text-white hover:cursor-pointer "
              >
                Join the waitlist
              </Button>
            </div>
          )}
        </div>
      </header>
    );
}