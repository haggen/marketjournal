import { describe, expect, it } from "bun:test";
import {
  addEntry,
  createEmptyData,
  deleteItem,
  deleteLocation,
  getGlobalMarket,
  getInitialData,
  getLocalMarket,
  getMarketGap,
  getMarketSpread,
  migrate,
  type Entry,
  type EntryTuple,
} from "./data";

function createEntry(
  timestamp: number,
  item: string,
  location: string,
  bid: number,
  ask: number,
): Entry {
  return { timestamp, item, location, price: { bid, ask } };
}

function fakeStorage(value: string | null = null) {
  Object.defineProperty(globalThis, "localStorage", {
    value: { getItem: () => value },
    configurable: true,
    writable: true,
  });
}

describe("createEmptyData", () => {
  it("creates a fresh dataset with no entries, items, or locations", () => {
    const data = createEmptyData();

    expect(data.version).toBe(5);
    expect(data.entries).toEqual([]);
    expect(data.items).toEqual([]);
    expect(data.locations).toEqual([]);
    expect(data.market.local).toEqual({});
    expect(data.market.global).toEqual({});
  });
});

describe("migrate", () => {
  it("upgrades v3 data, converting flat prices to bid/ask pairs and building the market index", () => {
    const legacy = {
      version: 3,
      entries: [
        { timestamp: 1, item: "Thin Hide", location: "Thetford", price: 100 },
        {
          timestamp: 2,
          item: "Thin Hide",
          location: "Fort Sterling",
          price: 140,
        },
      ],
      items: [],
      locations: [],
      index: {},
    } as any;

    migrate(legacy);

    expect(legacy.version).toBe(5);
    expect(legacy.index).toBeUndefined();
    expect(legacy.items).toEqual(["Thin Hide"]);
    expect(legacy.locations.sort()).toEqual(["Fort Sterling", "Thetford"]);

    expect(legacy.market.local["Thin Hide-Thetford"].latest).toEqual({
      bid: 100,
      ask: 100,
    });
    expect(legacy.market.local["Thin Hide-Fort Sterling"].latest).toEqual({
      bid: 140,
      ask: 140,
    });

    const global = legacy.market.global["Thin Hide"];
    expect(global.count).toBe(2);
    expect(global.min).toEqual({ bid: 100, ask: 100 });
    expect(global.max).toEqual({ bid: 140, ask: 140 });
    expect(global.average).toEqual({ bid: 120, ask: 120 });
  });

  it("skips malformed entries during v3 migration", () => {
    const legacy = {
      version: 3,
      entries: [
        { timestamp: 1, item: "Thin Hide", location: "Thetford", price: 100 },
        { item: "Thin Hide", location: "Fort Sterling" }, // missing timestamp and price
        null,
        { timestamp: 2, item: "Rough Log", location: "Thetford", price: 80 },
      ],
      items: [],
      locations: [],
      index: {},
    } as any;

    migrate(legacy);

    expect(legacy.items).toEqual(["Thin Hide", "Rough Log"]);
    expect(legacy.entries).toHaveLength(2);
  });

  it("upgrades v4 data, converting entry objects to tuples", () => {
    const v4data = {
      version: 4,
      entries: [
        {
          timestamp: 1,
          item: "Thin Hide",
          location: "Thetford",
          price: { bid: 100, ask: 120 },
        },
        {
          timestamp: 2,
          item: "Thin Hide",
          location: "Fort Sterling",
          price: { bid: 200, ask: 240 },
        },
      ] as Entry[],
      items: ["Thin Hide"],
      locations: ["Thetford", "Fort Sterling"],
      market: { local: {}, global: {} },
    } as any;

    migrate(v4data);

    expect(v4data.version).toBe(5);
    expect(v4data.entries).toEqual<EntryTuple[]>([
      [1, "Thin Hide", "Thetford", 100, 120],
      [2, "Thin Hide", "Fort Sterling", 200, 240],
    ]);
  });

  it("leaves v5 data unchanged", () => {
    const current = createEmptyData();
    migrate(current);
    expect(current.version).toBe(5);
    expect(current.market.local).toEqual({});
    expect(current.market.global).toEqual({});
  });
});

describe("getInitialData", () => {
  it("returns empty data when storage is empty", () => {
    fakeStorage(null);
    expect(getInitialData()).toEqual(createEmptyData());
  });

  it("returns stored data as-is when already current", () => {
    const current = createEmptyData();
    addEntry(current, createEntry(1, "Thin Hide", "Thetford", 100, 120));

    fakeStorage(JSON.stringify(current));

    expect(getInitialData()).toEqual(current);
  });

  it("migrates outdated data from storage on load", () => {
    const stored = {
      version: 3,
      entries: [
        { timestamp: 1, item: "Raw Fish", location: "Martlock", price: 300 },
      ],
      items: [],
      locations: [],
      index: {},
    };

    fakeStorage(JSON.stringify(stored));

    const data = getInitialData();

    expect(data.version).toBe(5);
    expect(data.items).toEqual(["Raw Fish"]);
    expect(data.locations).toEqual(["Martlock"]);
    expect(data.market.global["Raw Fish"]?.average).toEqual({
      bid: 300,
      ask: 300,
    });
  });
});

describe("addEntry", () => {
  it("records the first entry for a new item and location", () => {
    const data = createEmptyData();

    addEntry(data, createEntry(1, "Thin Hide", "Thetford", 100, 120));

    expect(data.entries).toEqual([[1, "Thin Hide", "Thetford", 100, 120]]);
    expect(data.items).toEqual(["Thin Hide"]);
    expect(data.locations).toEqual(["Thetford"]);
    expect(data.market.local["Thin Hide-Thetford"]).toEqual({
      latest: { bid: 100, ask: 120 },
    });
    expect(data.market.global["Thin Hide"]).toEqual({
      count: 1,
      average: { bid: 100, ask: 120 },
      min: { bid: 100, ask: 120 },
      max: { bid: 100, ask: 120 },
    });
  });

  it("tracks a second location, updating the count and average", () => {
    const data = createEmptyData();

    addEntry(data, createEntry(1, "Thin Hide", "Thetford", 100, 120));
    addEntry(data, createEntry(2, "Thin Hide", "Fort Sterling", 200, 240));

    expect(data.market.global["Thin Hide"]?.count).toBe(2);
    expect(data.market.global["Thin Hide"]?.average).toEqual({
      bid: 150,
      ask: 180,
    });
    expect(data.market.global["Thin Hide"]?.min).toEqual({
      bid: 100,
      ask: 120,
    });
    expect(data.market.global["Thin Hide"]?.max).toEqual({
      bid: 200,
      ask: 240,
    });
  });

  it("updates an existing location price without changing the count", () => {
    const data = createEmptyData();

    addEntry(data, createEntry(1, "Thin Hide", "Thetford", 100, 120));
    addEntry(data, createEntry(2, "Thin Hide", "Fort Sterling", 200, 240));
    addEntry(data, createEntry(3, "Thin Hide", "Thetford", 140, 160));

    expect(data.market.local["Thin Hide-Thetford"]).toEqual({
      latest: { bid: 140, ask: 160 },
    });
    expect(data.market.global["Thin Hide"]?.count).toBe(2);
    expect(data.market.global["Thin Hide"]?.average).toEqual({
      bid: 170,
      ask: 200,
    });
    expect(data.market.global["Thin Hide"]?.min).toEqual({
      bid: 140,
      ask: 160,
    });
    expect(data.market.global["Thin Hide"]?.max).toEqual({
      bid: 200,
      ask: 240,
    });
  });
});

describe("deleteItem", () => {
  it("removes all entries and market data for the item", () => {
    const data = createEmptyData();

    addEntry(data, createEntry(1, "Thin Hide", "Thetford", 100, 100));
    addEntry(data, createEntry(2, "Thin Hide", "Fort Sterling", 120, 120));

    deleteItem(data, "Thin Hide");

    expect(data.items).toEqual([]);
    expect(data.entries).toEqual([]);
    expect(data.market.global["Thin Hide"]).toBeUndefined();
    expect(data.market.local["Thin Hide-Thetford"]).toBeUndefined();
    expect(data.market.local["Thin Hide-Fort Sterling"]).toBeUndefined();
  });

  it("does not affect other items", () => {
    const data = createEmptyData();

    addEntry(data, createEntry(1, "Thin Hide", "Thetford", 100, 100));
    addEntry(data, createEntry(2, "Thin Hide", "Fort Sterling", 120, 120));
    addEntry(data, createEntry(3, "Rough Log", "Thetford", 80, 80));

    deleteItem(data, "Thin Hide");

    expect(data.items).toEqual(["Rough Log"]);
    expect(data.entries).toEqual([[3, "Rough Log", "Thetford", 80, 80]]);
    expect(data.market.global["Rough Log"]).toBeDefined();
    expect(data.market.local["Rough Log-Thetford"]).toBeDefined();
  });
});

describe("deleteLocation", () => {
  it("removes all entries and local market data for the location", () => {
    const data = createEmptyData();

    addEntry(data, createEntry(1, "Thin Hide", "Thetford", 100, 120));

    deleteLocation(data, "Thetford");

    expect(data.locations).toEqual([]);
    expect(data.entries).toEqual([]);
    expect(data.market.local["Thin Hide-Thetford"]).toBeUndefined();
    expect(data.market.global["Thin Hide"]).toBeUndefined();
  });

  it("removes the global market for items with no remaining locations, and recalculates it for those that do", () => {
    const data = createEmptyData();

    addEntry(data, createEntry(1, "Thin Hide", "Thetford", 100, 100));
    addEntry(data, createEntry(2, "Thin Hide", "Fort Sterling", 200, 200));
    addEntry(data, createEntry(3, "Rough Log", "Thetford", 50, 50));

    deleteLocation(data, "Thetford");

    expect(data.locations).toEqual(["Fort Sterling"]);

    // Rough Log had only Thetford — its global is dropped
    expect(data.market.local["Rough Log-Thetford"]).toBeUndefined();
    expect(data.market.global["Rough Log"]).toBeUndefined();

    // Thin Hide still has Fort Sterling — its global is recalculated
    expect(data.market.local["Thin Hide-Thetford"]).toBeUndefined();
    expect(data.market.global["Thin Hide"]?.count).toBe(1);
    expect(data.market.global["Thin Hide"]?.average).toEqual({
      bid: 200,
      ask: 200,
    });
    expect(data.market.global["Thin Hide"]?.min).toEqual({
      bid: 200,
      ask: 200,
    });
    expect(data.market.global["Thin Hide"]?.max).toEqual({
      bid: 200,
      ask: 200,
    });
  });
});

describe("getLocalMarket", () => {
  it("returns the stored prices for a known location", () => {
    const data = createEmptyData();
    addEntry(data, createEntry(1, "Thin Hide", "Thetford", 100, 110));

    expect(getLocalMarket(data, "Thin Hide", "Thetford")).toEqual({
      latest: { bid: 100, ask: 110 },
    });
  });

  it("returns zero prices for an unknown location", () => {
    const data = createEmptyData();

    expect(getLocalMarket(data, "Thin Hide", "Thetford")).toEqual({
      latest: { bid: 0, ask: 0 },
    });
  });
});

describe("getGlobalMarket", () => {
  it("returns the aggregated market data for a known item", () => {
    const data = createEmptyData();
    addEntry(data, createEntry(1, "Thin Hide", "Thetford", 100, 110));
    addEntry(data, createEntry(2, "Thin Hide", "Fort Sterling", 200, 220));

    expect(getGlobalMarket(data, "Thin Hide")).toEqual({
      count: 2,
      average: { bid: 150, ask: 165 },
      min: { bid: 100, ask: 110 },
      max: { bid: 200, ask: 220 },
    });
  });

  it("returns zero data for an unknown item", () => {
    const data = createEmptyData();

    expect(getGlobalMarket(data, "Thin Hide")).toEqual({
      count: 0,
      average: { bid: 0, ask: 0 },
      min: { bid: 0, ask: 0 },
      max: { bid: 0, ask: 0 },
    });
  });
});

describe("getMarketGap", () => {
  it("returns zero gap when the item has no data", () => {
    const data = createEmptyData();

    expect(getMarketGap(data, "Thin Hide", "Thetford")).toEqual({
      bid: 0,
      ask: 0,
    });
  });

  it("returns zero bid gap at the cheapest location", () => {
    const data = createEmptyData();
    addEntry(data, createEntry(1, "Thin Hide", "Thetford", 100, 120));
    addEntry(data, createEntry(2, "Thin Hide", "Fort Sterling", 200, 240));

    // Thetford has the global minimum bid, so it has nowhere cheaper to buy from
    expect(getMarketGap(data, "Thin Hide", "Thetford")).toEqual({
      bid: 0,
      ask: 120,
    });
  });

  it("returns zero ask gap at the most expensive location", () => {
    const data = createEmptyData();
    addEntry(data, createEntry(1, "Thin Hide", "Thetford", 100, 120));
    addEntry(data, createEntry(2, "Thin Hide", "Fort Sterling", 200, 240));

    // Fort Sterling has the global maximum ask, so there is nowhere more expensive to sell to
    expect(getMarketGap(data, "Thin Hide", "Fort Sterling")).toEqual({
      bid: 100,
      ask: 0,
    });
  });
});

describe("getMarketSpread", () => {
  it("returns zero when the item has no data", () => {
    const data = createEmptyData();

    expect(getMarketSpread(data, "Thin Hide")).toBe(0);
  });

  it("returns the spread between the lowest bid and highest ask across all locations", () => {
    const data = createEmptyData();
    addEntry(data, createEntry(1, "Thin Hide", "Thetford", 100, 120));
    addEntry(data, createEntry(2, "Thin Hide", "Fort Sterling", 200, 240));

    expect(getMarketSpread(data, "Thin Hide")).toBe(140); // 240 - 100
  });
});
