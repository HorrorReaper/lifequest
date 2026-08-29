import { SKILL_CATEGORIES, type SkillCategory } from "@/lib/skill-categories";
import { getLevel, getXpProgress } from "@/lib/gamification";

export function SkillLevels({
  totals,
}: {
  totals: Record<SkillCategory, number>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {SKILL_CATEGORIES.map((category) => {
        const xp = totals[category.id] ?? 0;
        const level = getLevel(xp);
        const progress = getXpProgress(xp);
        return (
          <div key={category.id} className="rounded-xl border p-4">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="text-lg">
                {category.emoji}
              </span>
              <span className="font-medium">{category.label}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Level {level}
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
