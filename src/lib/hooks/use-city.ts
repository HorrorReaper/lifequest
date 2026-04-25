'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useEntries } from '@/lib/hooks/use-entries';
import { calculateStreaks, JournalEntry } from '@/lib/analytics';
import { getLevelFromTotalXp } from '@/lib/leveling';
import { checkAndUnlockBuildings } from '@/lib/city/unlock-engine';
import type { CityBuildingWithStatus, PlayerStats } from '@/lib/types';
import { createClient } from '../supabase/client';

// XP per entry (matches your template xp_reward default)
const XP_PER_ENTRY = 10;

export async function useCity() {
    const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { entries, loading: entriesLoading } = useEntries();

  // Normalize incoming DB rows to analytics JournalEntry shape
  function normalizeEntry(row: any): JournalEntry {
    const fields: Record<string, any> = {};

    // If already normalized
    if (row.fields && typeof row.fields === 'object') {
      Object.assign(fields, row.fields);
    }

    // Map responses array if present (common Supabase relation)
    const responses = row.journal_responses || row.responses || row.responses_json;
    if (Array.isArray(responses)) {
      responses.forEach((r: any) => {
        const key = r.field_key ?? r.field_id ?? r.key ?? r.name ?? r.id;
        if (r.value_number != null) fields[key] = r.value_number;
        else if (r.value_boolean != null) fields[key] = r.value_boolean;
        else if (r.value_text != null) fields[key] = r.value_text;
        else if (r.value_json != null) fields[key] = r.value_json;
      });
    }

    const createdAt = row.createdAt ?? row.created_at ?? row.entry_date ?? row.entry_date_time ?? '';
    const templateId = row.templateId ?? row.template_id ?? row.journal_template_id ?? row.template_id;
    const templateName = row.templateName ?? row.template_name ?? row.journal_templates?.name ?? row.template_name;
    const id = row.id ?? row.entry_id ?? row._id;

    return {
      id: String(id ?? ''),
      templateId: String(templateId ?? ''),
      templateName: String(templateName ?? '') ,
      createdAt: String(createdAt ?? ''),
      fields,
    };
  }

  const normalizedEntries: JournalEntry[] = Array.isArray(entries)
    ? entries.map(normalizeEntry)
    : [];

  const streaks = calculateStreaks(normalizedEntries);

  const [buildings, setBuildings] = useState<CityBuildingWithStatus[]>([]);
  const [newlyUnlocked, setNewlyUnlocked] = useState<CityBuildingWithStatus[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const hasCheckedRef = useRef(false);

  // Compute player stats from normalized entries
  const totalXp = normalizedEntries.length * XP_PER_ENTRY;
  const levelInfo = getLevelFromTotalXp(totalXp);
  const uniqueTemplatesUsed = new Set(
    normalizedEntries.map((e) => e.templateId).filter(Boolean)
  ).size;

  const stats: PlayerStats = {
    level: levelInfo.level,
    xp: totalXp,
    xpToNextLevel: levelInfo.xpToNextLevel,
    currentStreak: streaks.current,
    longestStreak: streaks.longest,
    totalEntries: normalizedEntries.length,
    uniqueTemplatesUsed,
  };

  const checkUnlocks = useCallback(async () => {
    if (!user || entriesLoading) return;

    setLoading(true);
    const result = await checkAndUnlockBuildings(user.id, stats);
    setBuildings(result.allBuildings);
    setNewlyUnlocked(result.newlyUnlocked);
    setLoading(false);
  }, [user, entriesLoading, stats]);

  // Run once when entries are loaded
  useEffect(() => {
    if (!entriesLoading && user && !hasCheckedRef.current) {
      hasCheckedRef.current = true;
      checkUnlocks();
    }
  }, [entriesLoading, user, checkUnlocks]);

  const dismissNewUnlocks = useCallback(() => {
    setNewlyUnlocked([]);
    setBuildings((prev) =>
      prev.map((b) => ({ ...b, is_newly_unlocked: false }))
    );
  }, []);

  return {
    buildings,
    newlyUnlocked,
    stats,
    levelInfo,
    loading: loading || entriesLoading,
    dismissNewUnlocks,
    recheckUnlocks: checkUnlocks,
  };
}
