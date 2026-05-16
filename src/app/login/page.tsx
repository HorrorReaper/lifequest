import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div
      className="relative min-h-svh bg-background"
      style={{
        backgroundImage: "url('/images/login-bg.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Overlay for readability */}
      <div className="absolute inset-0 bg-black/30 pointer-events-none" />

      <div className="relative flex min-h-svh items-center justify-center px-4 py-12">
        <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-0 items-stretch">
          {/* Left description shown on md+ */}
          <div className="hidden md:flex items-stretch">
            <div className="h-full flex flex-col justify-center p-12 bg-white/8 backdrop-blur-sm text-white">
              <h2 className="text-3xl font-bold">Welcome to LifeQuest</h2>
              <p className="mt-4 text-sm text-white/90">
                Track your habits, journal daily, earn XP, and build a city that reflects your progress. Plan your day, claim rewards, and grow routines into lasting habits.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-white/90">
                <li>• Daily journaling & mood tracking</li>
                <li>• Habit streaks, XP, and rewards</li>
                <li>• City-building gamification and progress</li>
              </ul>
            </div>
          </div>

          {/* Right: form card */}
          <div className="flex items-center justify-center">
            <div className="w-full max-w-md">
              <LoginForm />
              <p className="mt-6 text-center text-xs text-muted-foreground">
                By signing in you agree to our Terms of Service and Privacy Policy.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
