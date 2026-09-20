import { Reveal } from "./Reveal";
import { PrimaryCta } from "./PrimaryCta";

export default function Pricing({
  isMvp,
  onWaitlist,
}: {
  isMvp: boolean
  onWaitlist: () => void
}) {
  return (
    <section id="pricing" className="border-t border-[#f3efe6] px-5 py-16 sm:py-[5.75rem]">
      <Reveal className="mx-auto flex max-w-[720px] flex-col items-start gap-3.5">
        <h2 className="[font-family:var(--font-nightfall-display)] text-[clamp(2.1rem,4.4vw,2.8rem)] font-extrabold leading-tight">
          Completely for free. No trial, no card, no tiered features.
        </h2>
        <p className="text-[#6f6b63]">
          Every template, every field type, every habit, the whole game. No trial, no card,
          nothing held back behind a tier that doesn&apos;t exist yet.
        </p>
        <PrimaryCta isMvp={isMvp} onWaitlist={onWaitlist} className="mt-2" />
      </Reveal>
    </section>
  );
}
