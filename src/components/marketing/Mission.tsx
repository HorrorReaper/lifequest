import { Reveal } from "./Reveal";

export default function Mission() {
  return (
    <section className="border-t border-[#f3efe6] px-5 py-16 sm:py-[5.75rem]">
      {/* Narrower than the page's other sections: this is the one stretch of
          running prose on the page, and it reads better short of 70 characters
          a line than at the full column. */}
      <Reveal className="mx-auto flex max-w-[660px] flex-col gap-8">
        <h2 className="text-center [font-family:var(--font-nightfall-display)] text-[clamp(2.1rem,4.4vw,2.8rem)] font-extrabold leading-tight">
          My Mission
        </h2>

        {/* The rule, and the step down in size, are what separate this from
            the heading: both are set in the display face, so without them the
            quote reads as a second, smaller heading rather than as a quote. */}
        <blockquote className="border-l-[3px] border-[#d1870b] pl-5 text-balance [font-family:var(--font-nightfall-display)] text-[clamp(1.3rem,2.7vw,1.65rem)] font-bold leading-snug sm:pl-7">
          &ldquo;Journaling and self-reflection are the most powerful tools I&apos;ve found —
          but only next to the tasks, habits and daily plans they are meant to change.
          Turning the whole thing into a game is what got me making better decisions, and
          that is exactly what this app is built to support.&rdquo;
        </blockquote>

        {/* Set apart from the paragraphs above because it is the one claim
            about where this is going rather than where it already is. */}
        <p className="text-[1.05rem] font-bold leading-relaxed text-[#1b1a17]">
          Where this app is heading is simple: I want to make it the best tool for self-improvement that anyone has ever used. I want to make it the tool that makes it easy to become the best version of yourself, one day at a time and to become your personal Operating System for your life.
        </p>

        <p className="flex items-center gap-3 text-sm text-[#6f6b63]">
          <span aria-hidden="true" className="h-px w-8 shrink-0 bg-[#d9d2c4]" />
          <span>
            <span className="font-bold text-[#1b1a17]">Patrick Eger</span>, Founder of
            LifeQuest
          </span>
        </p>
      </Reveal>
    </section>
  );
}
