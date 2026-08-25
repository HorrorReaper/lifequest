export interface SkylineBuilding {
  height: number;
  windows: boolean[];
}

// Wide enough that the skyline bleeds past both edges of a desktop viewport
// instead of sitting as an island in the middle: 27 * 52px + 26 * 8px gap.
const BUILDING_HEIGHTS = [
  112, 168, 138, 205, 126, 190, 232, 152, 214, 118, 178, 145, 246, 130,
  160, 198, 122, 172, 264, 140, 186, 128, 220, 150, 194, 116, 164,
];

export function buildSkylineBuildings(): SkylineBuilding[] {
  return BUILDING_HEIGHTS.map((height, index) => {
    // Matches the rendered window grid: 6px window + 4px gap, 7px padding.
    const rows = Math.floor((height - 14) / 10);
    const windowCount = rows * 4;
    const windows: boolean[] = [];
    for (let i = 0; i < windowCount; i++) {
      windows.push((i + index) % 3 === 0);
    }
    return { height, windows };
  });
}

export interface StarPosition {
  left: string;
  top: string;
  size: number;
}

const STAR_SPOTS: Array<[string, string]> = [
  ["8%", "14%"], ["17%", "27%"], ["29%", "10%"], ["40%", "22%"], ["52%", "12%"],
  ["61%", "30%"], ["72%", "9%"], ["83%", "24%"], ["92%", "15%"], ["48%", "34%"], ["24%", "33%"],
];

export function buildStarField(): StarPosition[] {
  return STAR_SPOTS.map(([left, top], i) => ({
    left,
    top,
    size: i % 3 === 0 ? 2 : 1.2,
  }));
}

export interface ParkTree {
  side: "left" | "right";
  pct: number;
  alt: boolean;
}

const PARK_TREE_SPOTS: Array<["left" | "right", number]> = [
  ["left", 4], ["left", 15], ["left", 24], ["left", 32],
  ["right", 4], ["right", 14], ["right", 25], ["right", 33],
];

export function buildParkTrees(): ParkTree[] {
  return PARK_TREE_SPOTS.map(([side, pct], i) => ({ side, pct, alt: i % 2 === 0 }));
}

export interface ParkShrub {
  side: "left" | "right";
  pct: number;
  width: number;
}

export function buildParkShrubs(): ParkShrub[] {
  return [
    { side: "left", pct: 1, width: 60 },
    { side: "left", pct: 10, width: 46 },
    { side: "left", pct: 20, width: 52 },
    { side: "right", pct: 21, width: 46 },
    { side: "right", pct: 10, width: 60 },
    { side: "right", pct: 1, width: 42 },
  ];
}
