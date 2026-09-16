import Image from "next/image";

/**
 * One screenshot over a "How it works" step.
 *
 * The three shots have quite different shapes — 1.93, 1.58 and 2.13 — so they
 * are fitted rather than cropped, inside one frame of a fixed ratio so the
 * three columns line up whatever is in them. `object-contain` normally means
 * visible letterboxing; here it does not, because all three were taken in the
 * Trail theme and share its #f4eee1 ground, which the frame is painted in. The
 * bands and the screenshot's own margin become the same surface.
 *
 * The colour is literal rather than themed for the same reason as the rest of
 * this page: it sits outside (app) and must not follow the in-app theme — and
 * here it additionally has to match what is baked into the images.
 */
export function StepShot({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[1.25rem] border border-[#eae5da] bg-[#f4eee1] shadow-[0_1px_2px_rgba(27,26,23,0.04)]">
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 860px) calc(100vw - 40px), 33vw"
        className="object-contain"
      />
    </div>
  );
}
