import { Reveal } from "./Reveal";
import {
  MetricsPanel,
  PlannerPanel,
  ReflectionPanel,
  StreakPanel,
  TemplatesPanel,
  ToolsPanel,
} from "./ProductPanels";

export default function Features() {
  return (
    <section id="features" className="border-t border-[#f3efe6] px-5 py-16 sm:py-[5.75rem]">
      <div className="mx-auto flex max-w-[1040px] flex-col gap-16 sm:gap-24">
        <Reveal className="mx-auto max-w-[720px] text-center">
          <h2 className="[font-family:var(--font-nightfall-display)] text-[clamp(2.1rem,4.4vw,2.8rem)] font-extrabold leading-tight">
            Features
          </h2>
        </Reveal>
        <Reveal className="grid items-center gap-8 md:grid-cols-2 md:gap-16">
          <div className="flex flex-col gap-3.5">
            <h3 className="text-balance [font-family:var(--font-nightfall-display)] text-[clamp(1.35rem,2.6vw,1.75rem)] font-extrabold leading-tight">
              A <span className="text-[#9a6200]">JOURNAL</span> that is adjusted to you, not just generic prompts
            </h3>
            <p className="text-[#6f6b63]">
              Start with the built-in templates, then build your own out of sixteen field
              types like moods, sliders, ratings, checklists, even a habit tracker and a day
              planner inside the entry.
            </p>
            <p className="text-[#6f6b63]">
              Every template carries its own XP, so a two-minute check-in and a full weekly
              review are both worth doing.
            </p>
          </div>
          <TemplatesPanel />
        </Reveal>

        <Reveal className="grid items-center gap-8 md:grid-cols-2 md:gap-16">
          <div className="md:order-2 flex flex-col gap-3.5">
            <h3 className="text-balance [font-family:var(--font-nightfall-display)] text-[clamp(1.35rem,2.6vw,1.75rem)] font-extrabold leading-tight">
              <span className="text-[#9a6200]">HABITS</span> that pay more the longer it runs
            </h3>
            <p className="text-[#6f6b63]">
              The XP per habit grows with your streak, up to double, so consistency pays more
              than a single good day. So build MOMENTUM and stay consistent, and you&apos;ll be rewarded for it.
            </p>
          </div>
          <div className="md:order-1">
            <StreakPanel />
          </div>
        </Reveal>

        <Reveal className="grid items-center gap-8 md:grid-cols-2 md:gap-16">
          <div className="flex flex-col gap-3.5">
            <h3 className="text-balance [font-family:var(--font-nightfall-display)] text-[clamp(1.35rem,2.6vw,1.75rem)] font-extrabold leading-tight">
              <span className="text-[#9a6200]">REFLECT DAILY</span> with a new question every day
            </h3>
            <p className="text-[#6f6b63]">
              A new question every day to challenge your current thinking, and a library of past questions to look back on. The goal is to make you think deeply about your day, your habits, and your life, and to help you grow as a person.
            </p>
          </div>
          <ReflectionPanel />
        </Reveal>
        <Reveal className="grid items-center gap-8 md:grid-cols-2 md:gap-16">
          <div className="md:order-2 flex flex-col gap-3.5">

            <h3 className="text-balance [font-family:var(--font-nightfall-display)] text-[clamp(1.35rem,2.6vw,1.75rem)] font-extrabold leading-tight">
              A <span className="text-[#9a6200]">TOOLS & RESOURCES</span> library  to help you grow
            </h3>
            <p className="text-[#6f6b63]">
              A collection of tools and resources to support your journey of self-improvement and personal development. Learn about new habits, track your progress, and discover new ways to grow and improve yourself.
            </p>
          </div>
          <div className="md:order-1">
            <ToolsPanel />
          </div>
        </Reveal>

        <Reveal className="grid items-center gap-8 md:grid-cols-2 md:gap-16">
          <div className="flex flex-col gap-3.5">
            <h3 className="text-balance [font-family:var(--font-nightfall-display)] text-[clamp(1.35rem,2.6vw,1.75rem)] font-extrabold leading-tight">
              <span className="text-[#9a6200]">METRICS & LEARNINGS</span> to track your progress and insights
            </h3>
            <p className="text-[#6f6b63]">
              Turn on &quot;Track as metric&quot; on any number field and it becomes a chart,
              with a target you can hold yourself to and a line on the dashboard showing
              whether you are keeping it.
            </p>
            <p className="text-[#6f6b63]">
              Mark any answer as a learning, a problem, an idea, a decision or a win, and it
              lands in a library you can search through to keep track of.
            </p>
          </div>
          <MetricsPanel />
        </Reveal>

        <Reveal className="grid items-center gap-8 md:grid-cols-2 md:gap-16">
          <div className="md:order-2 flex flex-col gap-3.5">
            <h3 className="text-balance [font-family:var(--font-nightfall-display)] text-[clamp(1.35rem,2.6vw,1.75rem)] font-extrabold leading-tight">
              <span className="text-[#9a6200]">TASKS & DAY PLANNER</span> to organize your day
            </h3>
            <p className="text-[#6f6b63]">
              Capture a task inside an entry or on its own, give it a priority, and find it
              waiting on your dashboard. Finish it to earn XP, and if you don&apos;t finish it, it rolls over to tomorrow so you can keep your streak going without losing XP.
            </p>
            <p className="text-[#6f6b63]">
              Then block tomorrow out between the hours you really work, while the review of
              today is still in front of you.
            </p>
          </div>
          <div className="md:order-1">
            <PlannerPanel />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
