import { Reveal } from "./Reveal";

type RoadmapItem = {
  title: string;
  desc: string;
  status: "Shipped" | "In progress" | "Planned";
};

// No quarter dates. The old list promised seven dated milestones out to 2028,
// which a solo project cannot hold to and which ages badly the moment one
// slips. Status is the only claim made here.
const ITEMS: RoadmapItem[] = [
  {
    title: "The daily loop",
    desc: "Journal templates you can build yourself, habits, tasks, the day planner, XP, streaks, quests, and a character to spend coins on.",
    status: "Shipped",
  },
  {
    title: "Insights and metrics",
    desc: "Mark any answer as a learning and keep it in a library you can search. Turn any number into a chart, and give it a target you can check at a glance.",
    status: "Shipped",
  },
  {
    title: "Depth over breadth",
    desc: "Fewer new features, better ones. Sharpening what is already here before anything else gets added.",
    status: "In progress",
  },
  {
    title: "The city returns",
    desc: "A place to spend what you earn that grows with you — coming back once the daily loop is as good as it can be.",
    status: "Planned",
  },
  {
    title: "Mobile apps",
    desc: "iOS and Android, so the two minutes happen wherever you are.",
    status: "Planned",
  },
];

const STATUS_CLASSES: Record<RoadmapItem["status"], string> = {
  Shipped: "bg-[#eaf3ed] text-[#3f7d5b]",
  "In progress": "bg-[#fdf4e2] text-[#9a6200]",
  Planned: "bg-[#f3efe6] text-[#6f6b63]",
};

export default function Roadmap() {
  return (
    <section id="roadmap" className="border-t border-[#f3efe6] px-5 py-16 sm:py-[5.75rem]">
      <div className="mx-auto max-w-[1040px]">
        <Reveal className="max-w-[720px]">
          <h2 className="[font-family:var(--font-nightfall-display)] text-[clamp(1.8rem,3.8vw,2.4rem)] font-extrabold leading-tight">
            What I am building next
          </h2>
          <p className="mt-3 text-[#6f6b63]">
            Shipped is marked shipped. Everything else is a plan, not a promise.
          </p>
        </Reveal>

        <Reveal delay={60}>
        <ul className="mt-10 flex flex-col gap-3">
          {ITEMS.map((item) => (
            <li
              key={item.title}
              className="grid gap-3 rounded-2xl border border-[#eae5da] bg-white px-6 py-5 transition-colors hover:border-[#d9d2c4] sm:grid-cols-[7.5rem_1fr] sm:items-start sm:gap-6"
            >
              <span
                className={`w-fit rounded-full px-2.5 py-1 text-[0.68rem] font-extrabold uppercase tracking-[0.06em] ${STATUS_CLASSES[item.status]}`}
              >
                {item.status}
              </span>
              <div>
                <h3 className="text-[1.06rem] font-bold">{item.title}</h3>
                <p className="mt-1 text-[0.9rem] leading-relaxed text-[#6f6b63]">{item.desc}</p>
              </div>
            </li>
          ))}
        </ul>
        </Reveal>
      </div>
    </section>
  );
}
