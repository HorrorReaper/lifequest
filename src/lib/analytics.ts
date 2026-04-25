import { differenceInCalendarDays, format, subDays, startOfDay, eachDayOfInterval } from "date-fns";

export interface JournalEntry {
  id: string;
  templateId: string;
  templateName: string;
  createdAt: string; // ISO string
  fields: Record<string, any>;
}

// ---------- Streak ----------
export function calculateStreaks(entries: JournalEntry[]) {
  if (entries.length === 0) return { current: 0, longest: 0 };

  const validDates = entries
    .map((e) => new Date(e.createdAt))
    .filter((d) => !isNaN(d.getTime()));

  if (validDates.length === 0) return { current: 0, longest: 0 };

  const uniqueDays = [
    ...new Set(validDates.map((d) => format(d, "yyyy-MM-dd"))),
  ].sort();

  let current = 1;
  let longest = 1;
  let tempStreak = 1;

  // Walk backwards from today to find current streak
  const today = format(new Date(), "yyyy-MM-dd");
  const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
  const lastEntry = uniqueDays[uniqueDays.length - 1];

  if (lastEntry !== today && lastEntry !== yesterday) {
    current = 0;
  } else {
    current = 1;
    for (let i = uniqueDays.length - 2; i >= 0; i--) {
      const diff = differenceInCalendarDays(
        new Date(uniqueDays[i + 1]),
        new Date(uniqueDays[i])
      );
      if (diff === 1) {
        current++;
      } else {
        break;
      }
    }
  }

  // Calculate longest streak
  for (let i = 1; i < uniqueDays.length; i++) {
    const diff = differenceInCalendarDays(
      new Date(uniqueDays[i]),
      new Date(uniqueDays[i - 1])
    );
    if (diff === 1) {
      tempStreak++;
      longest = Math.max(longest, tempStreak);
    } else {
      tempStreak = 1;
    }
  }
  longest = Math.max(longest, tempStreak);

  return { current, longest };
}

// ---------- Mood over time ----------
export interface MoodDataPoint {
  date: string;
  mood: number;
  label: string;
}

export function extractMoodTrend(entries: JournalEntry[], days = 30): MoodDataPoint[] {
  const start = subDays(new Date(), days);
  const interval = eachDayOfInterval({ start, end: new Date() });

  const moodByDay: Record<string, number[]> = {};

  entries.forEach((entry) => {
    const d = new Date(entry.createdAt);
    if (isNaN(d.getTime())) return;
    const day = format(d, "yyyy-MM-dd");
    const mood = entry.fields?.mood ?? entry.fields?.Mood;
    if (typeof mood === "number") {
      if (!moodByDay[day]) moodByDay[day] = [];
      moodByDay[day].push(mood);
    }
  });

  return interval.map((d) => {
    const key = format(d, "yyyy-MM-dd");
    const moods = moodByDay[key];
    const avg = moods ? moods.reduce((a, b) => a + b, 0) / moods.length : 0;
    return {
      date: format(d, "MMM dd"),
      mood: Math.round(avg * 10) / 10,
      label: key,
    };
  });
}

// ---------- Template usage ----------
export interface TemplateUsage {
  name: string;
  count: number;
}

export function getTemplateUsage(entries: JournalEntry[]): TemplateUsage[] {
  const counts: Record<string, number> = {};
  entries.forEach((e) => {
    const name = e.templateName || e.templateId;
    counts[name] = (counts[name] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

// ---------- Weekly summary ----------
export function getWeeklySummary(entries: JournalEntry[]) {
  const weekAgo = subDays(startOfDay(new Date()), 7);
  const recent = entries.filter((e) => {
    const d = new Date(e.createdAt);
    return !isNaN(d.getTime()) && d >= weekAgo;
  });

  const moods = recent
    .map((e) => e.fields?.mood ?? e.fields?.Mood)
    .filter((m): m is number => typeof m === "number");

  const avgMood = moods.length
    ? Math.round((moods.reduce((a, b) => a + b, 0) / moods.length) * 10) / 10
    : null;

  return {
    entryCount: recent.length,
    avgMood,
    topTemplate: getTemplateUsage(recent)[0]?.name ?? "—",
    daysActive: new Set(recent.map((e) => format(new Date(e.createdAt), "yyyy-MM-dd"))).size,
  };
}

// ---------- Activity heatmap data ----------
export interface HeatmapDay {
  date: string;
  count: number;
}

export function getActivityHeatmap(entries: JournalEntry[], days = 90): HeatmapDay[] {
  const start = subDays(new Date(), days);
  const interval = eachDayOfInterval({ start, end: new Date() });

  const countByDay: Record<string, number> = {};
  entries.forEach((e) => {
    const d = new Date(e.createdAt);
    if (isNaN(d.getTime())) return;
    const day = format(d, "yyyy-MM-dd");
    countByDay[day] = (countByDay[day] || 0) + 1;
  });

  return interval.map((d) => {
    const key = format(d, "yyyy-MM-dd");
    return { date: key, count: countByDay[key] || 0 };
  });
}
