
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
  lastClaimedEntryIds: string[];
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

// ---------- XP / Level math ----------
export function xpForLevel(level: number): number {
  // Each level requires more XP: 50, 150, 300, 500, 750, 1000, ...
  return Math.round(25 * level * level + 25 * level);
}

export function getLevel(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) {
    level++;
  }
  return level;
}

export function getLevelProgress(xp: number): { current: number; next: number; pct: number } {
  const level = getLevel(xp);
  const current = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const pct = next === current ? 100 : Math.round(((xp - current) / (next - current)) * 100);
  return { current, next, pct };
}

// ---------- Rewards from entries ----------
export function calculateRewards(entryCount: number, streakDays: number) {
  const baseCoins = 10;
  const baseXp = 15;
  const streakMultiplier = 1 + Math.min(streakDays, 30) * 0.05; // up to 2.5x at 30-day streak
  return {
    coins: Math.round(baseCoins * streakMultiplier * entryCount),
    xp: Math.round(baseXp * streakMultiplier * entryCount),
  };
}

// ---------- Grid ----------
export const GRID_SIZE = 10;

export function isCellOccupied(buildings: Building[], row: number, col: number): boolean {
  return buildings.some((b) => b.row === row && b.col === col);
}

export function getDefaultCityState(): CityState {
  return {
    coins: 0,
    xp: 0,
    level: 1,
    buildings: [],
    lastClaimedEntryIds: [],
  };
}

// ---------- Available buildings for current level ----------
export function getUnlockedBuildings(xp: number): BuildingType[] {
  return BUILDING_CATALOG.filter((b) => b.xpRequired <= xp);
}

export function getLockedBuildings(xp: number): BuildingType[] {
  return BUILDING_CATALOG.filter((b) => b.xpRequired > xp);
}
