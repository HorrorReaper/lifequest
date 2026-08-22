import { describe, expect, it } from "vitest";
import {
  buildParkShrubs,
  buildParkTrees,
  buildSkylineBuildings,
  buildStarField,
} from "./nightfall-scene";

describe("buildSkylineBuildings", () => {
  it("returns 15 buildings with a positive number of windows each", () => {
    const buildings = buildSkylineBuildings();
    expect(buildings).toHaveLength(15);
    for (const building of buildings) {
      expect(building.height).toBeGreaterThan(0);
      expect(building.windows.length).toBeGreaterThan(0);
    }
  });

  it("returns identical output on every call (deterministic, no Math.random)", () => {
    expect(buildSkylineBuildings()).toEqual(buildSkylineBuildings());
  });
});

describe("buildStarField", () => {
  it("returns identical output on every call", () => {
    expect(buildStarField()).toEqual(buildStarField());
  });

  it("returns at least 10 stars", () => {
    expect(buildStarField().length).toBeGreaterThanOrEqual(10);
  });
});

describe("buildParkTrees", () => {
  it("returns trees on both sides of the path", () => {
    const trees = buildParkTrees();
    expect(trees.some((t) => t.side === "left")).toBe(true);
    expect(trees.some((t) => t.side === "right")).toBe(true);
  });

  it("returns identical output on every call", () => {
    expect(buildParkTrees()).toEqual(buildParkTrees());
  });
});

describe("buildParkShrubs", () => {
  it("returns identical output on every call", () => {
    expect(buildParkShrubs()).toEqual(buildParkShrubs());
  });
});
