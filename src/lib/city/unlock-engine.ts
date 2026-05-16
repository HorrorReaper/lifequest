import { createClient } from '@/lib/supabase/client';
import { supabaseInsert } from '@/lib/supabase/helpers'
import type {
  CityBuilding,
  CityBuildingWithStatus,
  PlayerStats,
  UnlockType,
} from '@/lib/types';

/**
 * Determines whether a building's unlock condition is met
 * given the player's current stats.
 */
export function isBuildingUnlockable(
  building: CityBuilding,
  stats: PlayerStats
): boolean {
  const { unlock_type, unlock_value } = building;

  switch (unlock_type as UnlockType) {
    case 'level':
      return stats.level >= unlock_value;
    case 'streak':
      return stats.currentStreak >= unlock_value;
    case 'entries_count':
      return stats.totalEntries >= unlock_value;
    case 'entry_types':
      return stats.uniqueTemplatesUsed >= unlock_value;
    default:
      return false;
  }
}

/**
 * Returns a human-readable requirement string for a locked building.
 */
export function getUnlockRequirementText(building: CityBuilding): string {
  const { unlock_type, unlock_value } = building;

  switch (unlock_type as UnlockType) {
    case 'level':
      return `Reach Level ${unlock_value}`;
    case 'streak':
      return `Reach a ${unlock_value}-day streak`;
    case 'entries_count':
      return `Write ${unlock_value} journal ${unlock_value === 1 ? 'entry' : 'entries'}`;
    case 'entry_types':
      return `Use ${unlock_value} different template${unlock_value === 1 ? '' : 's'}`;
    default:
      return `Unknown requirement`;
  }
}

/**
 * Returns the player's current progress toward a locked building as a 0–100 percent.
 */
export function getUnlockProgress(
  building: CityBuilding,
  stats: PlayerStats
): number {
  const { unlock_type, unlock_value } = building;
  let current = 0;

  switch (unlock_type as UnlockType) {
    case 'level':
      current = stats.level;
      break;
    case 'streak':
      current = stats.currentStreak;
      break;
    case 'entries_count':
      current = stats.totalEntries;
      break;
    case 'entry_types':
      current = stats.uniqueTemplatesUsed;
      break;
  }

  return Math.min(100, Math.round((current / unlock_value) * 100));
}

/**
 * Core unlock check: fetches all buildings, compares with user_buildings,
 * unlocks any newly-qualifying buildings, and returns the full status list.
 *
 * Returns newly unlocked buildings separately for celebration modals.
 */
export async function checkAndUnlockBuildings(
  userId: string,
  stats: PlayerStats
): Promise<{
  allBuildings: CityBuildingWithStatus[];
  newlyUnlocked: CityBuildingWithStatus[];
}> {
  const supabase = createClient();

  // 1. Fetch all buildings
  const { data: buildings, error: buildingsError } = await supabase
    .from('city_buildings')
    .select('*')
    .order('sort_order', { ascending: true });

  if (buildingsError || !buildings) {
    console.error('Failed to fetch buildings:', buildingsError);
    return { allBuildings: [], newlyUnlocked: [] };
  }

  // 2. Fetch user's already-unlocked buildings
  const { data: userBuildings, error: userBuildingsError } = await supabase
    .from('user_buildings')
    .select('*')
    .eq('user_id', userId);

  if (userBuildingsError) {
    console.error('Failed to fetch user buildings:', userBuildingsError);
    return { allBuildings: [], newlyUnlocked: [] };
  }

  const unlockedMap = new Map(
    ((userBuildings ?? []) as any[]).map((ub: any) => [ub.building_id, ub.unlocked_at])
  );

  // 3. Determine which buildings are newly unlockable
  const newlyUnlockable: CityBuilding[] = [];

  const buildingList = (buildings ?? []) as any[]

  for (const building of buildingList) {
    const alreadyUnlocked = unlockedMap.has(building.id);
    if (!alreadyUnlocked && isBuildingUnlockable(building, stats)) {
      newlyUnlockable.push(building);
    }
  }

  // 4. Batch-insert newly unlocked buildings
  if (newlyUnlockable.length > 0) {
    const inserts = newlyUnlockable.map((b) => ({
      user_id: userId,
      building_id: b.id,
    }));

    const { error: insertError } = await supabaseInsert(supabase, 'user_buildings', inserts)

    if (insertError) {
      console.error('Failed to insert new unlocks:', insertError);
    } else {
      // Update the map so allBuildings reflects the new state
      const now = new Date().toISOString();
      newlyUnlockable.forEach((b) => unlockedMap.set(b.id, now));
    }
  }

  // 5. Build the full status list
  const allBuildings: CityBuildingWithStatus[] = buildingList.map((b: any) => ({
    ...b,
    is_unlocked: unlockedMap.has(b.id),
    unlocked_at: unlockedMap.get(b.id) ?? null,
    is_newly_unlocked: newlyUnlockable.some((n) => n.id === b.id),
  }));

  const newlyUnlocked: CityBuildingWithStatus[] = allBuildings.filter(
    (b) => b.is_newly_unlocked
  );

  return { allBuildings, newlyUnlocked };
}
