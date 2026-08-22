export interface SkylineBuilding {
  height: number;
  windows: boolean[];
}

const BUILDING_HEIGHTS = [70, 110, 90, 150, 80, 130, 170, 100, 140, 75, 120, 95, 160, 85, 105];

export function buildSkylineBuildings(): SkylineBuilding[] {
  return BUILDING_HEIGHTS.map((height, index) => {
    const rows = Math.floor((height - 12) / 11);
    const windowCount = rows * 3;
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
