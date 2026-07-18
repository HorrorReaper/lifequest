// src/lib/city.ts

import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// ---------- Types ----------

export interface Building {
  id: string;
  type: BuildingType;
  row: number;
  col: number;
  placedAt: string;
}

export interface CityState {
  coins: number;
  xp: number;
  level: number;
  buildings: Building[];
  claimedEntryIds: string[];
}

export interface BuildingType {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  xpRequired: number;
  description: string;
  category: "residential" | "commercial" | "nature" | "civic" | "landmark";
}

type CityBuildingPlacementRow = Database["public"]["Tables"]["city_buildings_placing"]["Row"];
type JournalEntryIdRow = Pick<Database["public"]["Tables"]["journal_entries"]["Row"], "id">;

// ---------- Building Catalog ----------

export const BUILDING_CATALOG: BuildingType[] = [
  // Level 1
  { id: "house", name: "House", emoji: "🏠", cost: 10, xpRequired: 0, description: "A cozy starter home.", category: "residential" },
  { id: "tree", name: "Tree", emoji: "🌳", cost: 5, xpRequired: 0, description: "Every city needs greenery.", category: "nature" },
  { id: "flower", name: "Flower Garden", emoji: "🌷", cost: 5, xpRequired: 0, description: "A beautiful flower bed.", category: "nature" },
  // Level 2
  { id: "shop", name: "Shop", emoji: "🏪", cost: 20, xpRequired: 50, description: "A small retail store.", category: "commercial" },
  { id: "bench", name: "Park Bench", emoji: "🪑", cost: 8, xpRequired: 50, description: "A place to rest.", category: "nature" },
  { id: "mailbox", name: "Mailbox", emoji: "📮", cost: 8, xpRequired: 50, description: "Connecting your citizens.", category: "civic" },
  // Level 3
  { id: "cafe", name: "Café", emoji: "☕", cost: 30, xpRequired: 150, description: "Fuel for founders.", category: "commercial" },
  { id: "school", name: "School", emoji: "🏫", cost: 35, xpRequired: 150, description: "Educate the next generation.", category: "civic" },
  { id: "fountain", name: "Fountain", emoji: "⛲", cost: 25, xpRequired: 150, description: "A beautiful centerpiece.", category: "nature" },
  // Level 4
  { id: "library", name: "Library", emoji: "📚", cost: 40, xpRequired: 300, description: "Knowledge is power.", category: "civic" },
  { id: "apartment", name: "Apartment", emoji: "🏢", cost: 50, xpRequired: 300, description: "Housing more citizens.", category: "residential" },
  { id: "gym", name: "Gym", emoji: "🏋️", cost: 40, xpRequired: 300, description: "Stay healthy!", category: "commercial" },
  // Level 5
  { id: "hospital", name: "Hospital", emoji: "🏥", cost: 60, xpRequired: 500, description: "Keeping everyone well.", category: "civic" },
  { id: "park", name: "Park", emoji: "🏞️", cost: 45, xpRequired: 500, description: "A sprawling green space.", category: "nature" },
  { id: "restaurant", name: "Restaurant", emoji: "🍽️", cost: 55, xpRequired: 500, description: "Fine dining experience.", category: "commercial" },
  // Level 6
  { id: "theater", name: "Theater", emoji: "🎭", cost: 70, xpRequired: 750, description: "Arts and culture.", category: "civic" },
  { id: "hotel", name: "Hotel", emoji: "🏨", cost: 75, xpRequired: 750, description: "Welcome visitors.", category: "commercial" },
  { id: "statue", name: "Statue", emoji: "🗽", cost: 80, xpRequired: 750, description: "A city monument.", category: "landmark" },
  // Level 7
  { id: "stadium", name: "Stadium", emoji: "🏟️", cost: 100, xpRequired: 1000, description: "Home of champions.", category: "landmark" },
  { id: "skyscraper", name: "Skyscraper", emoji: "🏙️", cost: 120, xpRequired: 1000, description: "Reaching for the sky.", category: "landmark" },
  { id: "castle", name: "Castle", emoji: "🏰", cost: 150, xpRequired: 1000, description: "The crown jewel of your city.", category: "landmark" },

  // Level 10
  { id: "research-lab", name: "Research Lab", emoji: "🧪", cost: 180, xpRequired: 2750, description: "Where experiments become breakthroughs.", category: "civic" },
  { id: "transit-hub", name: "Transit Hub", emoji: "🚉", cost: 200, xpRequired: 2750, description: "Connects every district in your growing city.", category: "civic" },
  { id: "botanical-dome", name: "Botanical Dome", emoji: "🌐", cost: 170, xpRequired: 2750, description: "A glass garden for calm, focus, and recovery.", category: "nature" },

  // Level 20
  { id: "spaceport", name: "Spaceport", emoji: "🚀", cost: 460, xpRequired: 10500, description: "Launches your ambitions beyond the skyline.", category: "landmark" },
  { id: "innovation-district", name: "Innovation District", emoji: "🧬", cost: 520, xpRequired: 10500, description: "A dense hub of builders, operators, and ideas.", category: "commercial" },
  { id: "grand-observatory", name: "Grand Observatory", emoji: "🔭", cost: 430, xpRequired: 10500, description: "A place to study patterns and plan the next move.", category: "civic" },

  // Level 50
  { id: "orbital-elevator", name: "Orbital Elevator", emoji: "🛰️", cost: 1250, xpRequired: 63750, description: "A monument to compounding progress.", category: "landmark" },
  { id: "quantum-archive", name: "Quantum Archive", emoji: "🧠", cost: 1350, xpRequired: 63750, description: "Stores the lessons of a fully evolved city.", category: "civic" },
  { id: "sky-citadel", name: "Sky Citadel", emoji: "🏯", cost: 1500, xpRequired: 63750, description: "The final crown for a city built through discipline.", category: "landmark" },
];

// ---------- XP / Level ----------

export function xpForLevel(level: number): number {
  return Math.round(25 * level * level + 25 * level);
}

export function getLevel(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

export function getLevelProgress(xp: number) {
  const level = getLevel(xp);
  const current = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const pct = next === current ? 100 : Math.round(((xp - current) / (next - current)) * 100);
  return { current, next, pct };
}

export function calculateRewards(entryCount: number, streakDays: number) {
  const baseCoins = 10;
  const baseXp = 15;
  const streakMultiplier = 1 + Math.min(streakDays, 30) * 0.05;
  return {
    coins: Math.round(baseCoins * streakMultiplier * entryCount),
    xp: Math.round(baseXp * streakMultiplier * entryCount),
  };
}

export const GRID_SIZE = 10;

export function isCellOccupied(buildings: Building[], row: number, col: number): boolean {
  return buildings.some((b) => b.row === row && b.col === col);
}

export function getUnlockedBuildings(xp: number): BuildingType[] {
  return BUILDING_CATALOG.filter((b) => b.xpRequired <= xp);
}

export function getLockedBuildings(xp: number): BuildingType[] {
  return BUILDING_CATALOG.filter((b) => b.xpRequired > xp);
}

function catalogLookup(typeId: string): BuildingType {
  return BUILDING_CATALOG.find((b) => b.id === typeId) ?? BUILDING_CATALOG[0];
}

// ---------- Supabase helpers ----------

export function getDefaultCityState(): CityState {
  return { coins: 0, xp: 0, level: 1, buildings: [], claimedEntryIds: [] };
}

export async function fetchCityState(
  supabase: SupabaseClient,
  userId: string
): Promise<CityState> {
  // Fetch or create city_states row
  let { data: cityRow } = await supabase
    .from("city_states")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (!cityRow) {
    const { data: newRow, error } = await supabase
      .from("city_states")
      .insert({ user_id: userId })
      .select("*")
      .single();

    if (error) throw error;
    cityRow = newRow;
  }

  // Fetch buildings
  const { data: buildingRows } = await supabase
    .from("city_buildings_placing")
    .select("*")
    .eq("user_id", userId);

  const buildings: Building[] = ((buildingRows ?? []) as CityBuildingPlacementRow[]).map((b) => ({
    id: b.id,
    type: catalogLookup(b.building_type),
    row: b.row,
    col: b.col,
    placedAt: b.placed_at,
  }));

  // Also fetch profile XP so we can present a single combined XP value
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("total_xp")
    .eq("id", userId)
    .single();

  const profileXp = (profileRow?.total_xp as number) ?? 0;
 // const cityXp = (cityRow.xp as number) ?? 0;
  const combinedXp = profileXp //+ cityXp;

  return {
    coins: cityRow.coins,
    // Return combined XP so UI and logic use a single XP value
    xp: combinedXp,
    // Compute level from combined XP instead of relying on stored city level
    level: getLevel(combinedXp),
    buildings,
    claimedEntryIds: cityRow.claimed_entry_ids ?? [],
  };
}
export async function getCityCoins(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data: cityRow } = await supabase
    .from("city_states")
    .select("coins")
    .eq("user_id", userId)
    .single();
  return cityRow?.coins ?? 0;
}

export async function claimRewards(
  supabase: SupabaseClient,
  userId: string,
  addCoins: number,
  addXp: number,
  newEntryIds: string[]
): Promise<CityState> {
  // Fetch current state
  const { data: cityRow } = await supabase
    .from("city_states")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!cityRow) throw new Error("City state not found");
  // Update profile XP (single source of truth for accumulated XP) and update city coins/claimed ids
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("total_xp")
    .eq("id", userId)
    .single();

  const profileXp = (profileRow?.total_xp as number) ?? 0;
  const updatedProfileXp = profileXp + addXp;
  const updatedCoins = cityRow.coins + addCoins;
  const updatedClaimed = [...(cityRow.claimed_entry_ids ?? []), ...newEntryIds];

  // Update both tables in parallel
  const [profileRes, cityRes] = await Promise.all([
    supabase
      .from("profiles")
      .update({ total_xp: updatedProfileXp, updated_at: new Date().toISOString() })
      .eq("id", userId),
    supabase
      .from("city_states")
      .update({
        coins: updatedCoins,
        claimed_entry_ids: updatedClaimed,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId),
  ]);

  if (profileRes.error) throw profileRes.error;
  if (cityRes.error) throw cityRes.error;

  return fetchCityState(supabase, userId);
}

export async function placeBuilding(
  supabase: SupabaseClient,
  userId: string,
  buildingType: BuildingType,
  row: number,
  col: number
): Promise<CityState> {
  // Deduct coins
  const { data: cityRow } = await supabase
    .from("city_states")
    .select("coins")
    .eq("user_id", userId)
    .single();

  if (!cityRow || cityRow.coins < buildingType.cost) {
    throw new Error("Not enough coins");
  }

  // Insert building
  const { error: buildError } = await supabase.from("city_buildings_placing").insert({
    user_id: userId,
    building_type: buildingType.id,
    row,
    col,
  });

  if (buildError) throw buildError;

  // Update coins
  const { error: coinError } = await supabase
    .from("city_states")
    .update({
      coins: cityRow.coins - buildingType.cost,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (coinError) throw coinError;

  return fetchCityState(supabase, userId);
}

export async function fetchUnclaimedEntryCount(
  supabase: SupabaseClient,
  userId: string,
  claimedIds: string[]
): Promise<{ count: number; entryIds: string[] }> {
  const { data: entries } = await supabase
    .from("journal_entries")
    .select("id")
    .eq("user_id", userId);

  const allIds = ((entries ?? []) as JournalEntryIdRow[]).map((e) => e.id);
  const unclaimed = allIds.filter((id: string) => !claimedIds.includes(id));

  return { count: unclaimed.length, entryIds: unclaimed };
}
