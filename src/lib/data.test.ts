import { beforeEach, describe, expect, it } from "bun:test";
import {
  addEntry,
  createEmptyData,
  deleteItem,
  deleteLocation,
  getGlobalMarket,
  getInitialData,
  getLocalMarket,
  getMarketGap,
  migrate,
  type Entry,
} from "./data";

function createMockStorage(initial: Record<string, string> = {}): Storage {
  const store = new Map(Object.entries(initial));

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

function buildEntry(
  timestamp: number,
  item: string,
  location: string,
  bid: number,
  ask: number,
): Entry {
  return {
    timestamp,
    item,
    location,
    price: { bid, ask },
  };
}

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    value: createMockStorage(),
    configurable: true,
    writable: true,
  });
});

describe("createEmptyData", () => {
  it("returns an empty v4 data shape", () => {
    const data = createEmptyData();

    expect(data.version).toBe(4);
    expect(data.entries).toEqual([]);
    expect(data.items).toEqual([]);
    expect(data.locations).toEqual([]);
    expect(data.market.local).toEqual({});
    expect(data.market.global).toEqual({});
  });
});

describe("migrate", () => {
  it("migrates v3 data entries to v4 market shape", () => {
    const legacy = {
      version: 3,
      entries: [
        { timestamp: 1, item: "ore", location: "town", price: 10 },
        { timestamp: 2, item: "ore", location: "city", price: 14 },
      ],
      items: ["ore"],
      locations: ["town", "city"],
      index: { old: true },
    } as any;

    migrate(legacy);

    expect(legacy.version).toBe(4);
    expect(legacy.index).toBeUndefined();
    expect(legacy.items).toEqual(["ore"]);
    expect(legacy.locations.sort()).toEqual(["city", "town"]);

    const global = legacy.market.global["ore"];
    expect(global.count).toBe(2);
    expect(global.average).toEqual({ bid: 12, ask: 12 });
    expect(global.min).toEqual({ bid: 10, ask: 10 });
    expect(global.max).toEqual({ bid: 14, ask: 14 });

    expect(legacy.market.local["ore-town"].latest).toEqual({
      bid: 10,
      ask: 10,
    });
    expect(legacy.market.local["ore-city"].latest).toEqual({
      bid: 14,
      ask: 14,
    });
  });

  it("leaves non-v3 data unchanged", () => {
    const current = createEmptyData();
    migrate(current);
    expect(current.version).toBe(4);
    expect(current.market.local).toEqual({});
    expect(current.market.global).toEqual({});
  });
});

describe("getInitialData", () => {
  it("returns empty data when storage is empty", () => {
    const data = getInitialData();
    expect(data).toEqual(createEmptyData());
  });

  it("loads and migrates stored v3 data", () => {
    const storedV3 = {
      version: 3,
      entries: [{ timestamp: 1, item: "fish", location: "dock", price: 30 }],
      items: [],
      locations: [],
      index: {},
    };

    localStorage.setItem("data", JSON.stringify(storedV3));

    const data = getInitialData();

    expect(data.version).toBe(4);
    expect(data.items).toEqual(["fish"]);
    expect(data.locations).toEqual(["dock"]);
    expect(data.market.global["fish"]?.average).toEqual({ bid: 30, ask: 30 });
  });
});

describe("addEntry", () => {
  it("adds first entry and initializes local/global markets", () => {
    const data = createEmptyData();

    addEntry(data, buildEntry(1, "ore", "town", 10, 12));

    expect(data.entries).toHaveLength(1);
    expect(data.items).toEqual(["ore"]);
    expect(data.locations).toEqual(["town"]);

    expect(data.market.local["ore-town"]?.latest).toEqual({ bid: 10, ask: 12 });
    expect(data.market.global["ore"]?.count).toBe(1);
    expect(data.market.global["ore"]?.average).toEqual({ bid: 10, ask: 12 });
    expect(data.market.global["ore"]?.min).toEqual({ bid: 10, ask: 12 });
    expect(data.market.global["ore"]?.max).toEqual({ bid: 10, ask: 12 });
  });

  it("updates averages correctly when replacing an existing location price", () => {
    const data = createEmptyData();

    addEntry(data, buildEntry(1, "ore", "town", 10, 12));
    addEntry(data, buildEntry(2, "ore", "city", 20, 24));
    addEntry(data, buildEntry(3, "ore", "town", 14, 16));

    expect(data.market.global["ore"]?.count).toBe(2);
    expect(data.market.global["ore"]?.average).toEqual({ bid: 17, ask: 20 });
    expect(data.market.global["ore"]?.min).toEqual({ bid: 14, ask: 16 });
    expect(data.market.global["ore"]?.max).toEqual({ bid: 20, ask: 24 });
  });
});

describe("deleteItem", () => {
  it("removes item entries and corresponding market data", () => {
    const data = createEmptyData();

    addEntry(data, buildEntry(1, "ore", "town", 10, 10));
    addEntry(data, buildEntry(2, "ore", "city", 12, 12));
    addEntry(data, buildEntry(3, "wood", "town", 8, 8));

    deleteItem(data, "ore");

    expect(data.items).toEqual(["wood"]);
    expect(data.entries.every((entry) => entry.item !== "ore")).toBe(true);
    expect(data.market.global["ore"]).toBeUndefined();
    expect(data.market.local["ore-town"]).toBeUndefined();
    expect(data.market.local["ore-city"]).toBeUndefined();
    expect(data.market.global["wood"]).toBeDefined();
  });
});

describe("deleteLocation", () => {
  it("removes location entries and updates globals", () => {
    const data = createEmptyData();

    addEntry(data, buildEntry(1, "ore", "town", 10, 10));
    addEntry(data, buildEntry(2, "ore", "city", 20, 20));
    addEntry(data, buildEntry(3, "wood", "town", 5, 5));

    deleteLocation(data, "town");

    expect(data.locations).toEqual(["city"]);
    expect(data.entries.every((entry) => entry.location !== "town")).toBe(true);

    expect(data.market.local["ore-town"]).toBeUndefined();
    expect(data.market.local["wood-town"]).toBeUndefined();

    expect(data.market.global["wood"]).toBeUndefined();
    expect(data.market.global["ore"]?.count).toBe(1);
    expect(data.market.global["ore"]?.average).toEqual({ bid: 20, ask: 20 });
    expect(data.market.global["ore"]?.min).toEqual({ bid: 20, ask: 20 });
    expect(data.market.global["ore"]?.max).toEqual({ bid: 20, ask: 20 });
  });
});

describe("getLocalMarket", () => {
  it("returns local market when present", () => {
    const data = createEmptyData();
    addEntry(data, buildEntry(1, "ore", "town", 10, 11));

    expect(getLocalMarket(data, "ore", "town")).toEqual({
      latest: { bid: 10, ask: 11 },
    });
  });

  it("throws when local market is missing", () => {
    const data = createEmptyData();

    expect(() => getLocalMarket(data, "ore", "town")).toThrow(
      "Local market missing for ore-town",
    );
  });
});

describe("getGlobalMarket", () => {
  it("returns global market when present", () => {
    const data = createEmptyData();
    addEntry(data, buildEntry(1, "ore", "town", 10, 11));

    expect(getGlobalMarket(data, "ore")).toEqual({
      count: 1,
      min: { bid: 10, ask: 11 },
      max: { bid: 10, ask: 11 },
      average: { bid: 10, ask: 11 },
    });
  });

  it("throws when global market is missing", () => {
    const data = createEmptyData();

    expect(() => getGlobalMarket(data, "ore")).toThrow(
      "Global market missing for ore",
    );
  });
});

describe("getSpread", () => {
  it("computes spread from global and local prices", () => {
    const data = createEmptyData();
    addEntry(data, buildEntry(1, "ore", "town", 15, 17));
    addEntry(data, buildEntry(2, "ore", "city", 25, 30));

    expect(getMarketGap(data, "ore", "city")).toEqual({ bid: 10, ask: 0 });
  });
});
