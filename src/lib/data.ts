import items from "@/data/items.json";

export type Entry = {
  timestamp: number;
  location: string;
  item: string;
  ask: number;
  bid: number;
};

export type Price = {
  ask: number;
  bid: number;
};

export type GlobalMarket = {
  count: number;
  min: Price;
  max: Price;
  average: Price;
};

export type LocalMarket = {
  timestamp: number;
  ask: number;
  bid: number;
};

export type Data = {
  version: number;
  entries: Entry[];
  items: string[];
  locations: string[];
  market: {
    local: Record<string, LocalMarket>;
    global: Record<string, GlobalMarket>;
  };
};

export function createEmptyData(): Data {
  return {
    version: 6,
    entries: [],
    items: [],
    locations: [],
    market: { local: {}, global: {} },
  };
}

export function migrate(data: any): Data {
  if (
    typeof data === "object" &&
    data !== null &&
    "version" in data &&
    typeof data.version === "number"
  ) {
    if (data.version === 6) {
      return data;
    } else if (data.version === 5) {
      data.entries = data.entries.map((tuple: any) => ({
        timestamp: tuple[0],
        location: tuple[2],
        item: tuple[1],
        ask: tuple[4],
        bid: tuple[3],
      }));

      Object.keys(data.market.local).forEach((key) => {
        data.market.local[key].timestamp = data.entries.reduce((timestamp: any, entry: any) => {
          if (entry.item === key.split("-")[0] && entry.location === key.split("-")[1]) {
            return Math.max(timestamp, entry.timestamp);
          }
          return timestamp;
        }, 0);

        data.market.local[key].ask = data.market.local[key].latest.ask;
        data.market.local[key].bid = data.market.local[key].latest.bid;

        delete data.market.local[key].latest;
      });

      data.version = 6;

      return data;
    }
  }

  return createEmptyData();
}

export function loadStoredData() {
  const stored = localStorage.getItem("data");
  if (stored) {
    return migrate(JSON.parse(stored));
  }
  return createEmptyData();
}

function getLocalMarketKey(item: string, location: string) {
  return `${item}-${location}`;
}

function recompileMarkets(data: Data, item: string) {
  const localMarkets = {} as Record<string, LocalMarket>;

  for (const entry of data.entries) {
    if (entry.item !== item) {
      continue;
    }

    const market = localMarkets[getLocalMarketKey(entry.item, entry.location)];

    if (market) {
      if (entry.timestamp < market.timestamp) {
        continue;
      }
    }

    localMarkets[getLocalMarketKey(entry.item, entry.location)] = {
      timestamp: entry.timestamp,
      ask: entry.ask,
      bid: entry.bid,
    };
  }

  const globalMarket = (data.market.global[item] = {
    count: 0,
    min: { ask: Infinity, bid: Infinity },
    max: { ask: 0, bid: 0 },
    average: { ask: 0, bid: 0 },
  });

  for (const [key, localMarket] of Object.entries(localMarkets)) {
    globalMarket.count += 1;

    globalMarket.average.ask += (localMarket.ask - globalMarket.average.ask) / globalMarket.count;
    globalMarket.average.bid += (localMarket.bid - globalMarket.average.bid) / globalMarket.count;

    if (localMarket.ask < globalMarket.min.ask) {
      globalMarket.min.ask = localMarket.ask;
    }

    if (localMarket.ask > globalMarket.max.ask) {
      globalMarket.max.ask = localMarket.ask;
    }

    if (localMarket.bid < globalMarket.min.bid) {
      globalMarket.min.bid = localMarket.bid;
    }

    if (localMarket.bid > globalMarket.max.bid) {
      globalMarket.max.bid = localMarket.bid;
    }

    data.market.local[key] = localMarket;
  }
}

export function addEntry(data: Data, entry: Entry) {
  data.entries.push(entry);

  if (!data.items.includes(entry.item)) {
    data.items.push(entry.item);
  }

  if (!data.locations.includes(entry.location)) {
    data.locations.push(entry.location);
  }

  recompileMarkets(data, entry.item);
}

export function deleteEntry(data: Data, entry: Entry) {
  data.entries = data.entries.filter(({ timestamp }) => timestamp !== entry.timestamp);
  delete data.market.local[getLocalMarketKey(entry.item, entry.location)];
  recompileMarkets(data, entry.item);
}

export function deleteItem(data: Data, item: string) {
  data.entries = data.entries.filter((entry) => entry.item !== item);
  data.items = data.items.filter((name) => name !== item);

  delete data.market.global[item];

  for (const location of data.locations) {
    delete data.market.local[getLocalMarketKey(item, location)];
  }
}

export function deleteLocation(data: Data, location: string) {
  data.entries = data.entries.filter((entry) => entry.location !== location);
  data.locations = data.locations.filter((name) => name !== location);

  for (const item of data.items) {
    const localMarket = data.market.local[getLocalMarketKey(item, location)];

    if (!localMarket) {
      continue;
    }

    delete data.market.local[getLocalMarketKey(item, location)];

    recompileMarkets(data, item);
  }
}

export function getLocalMarket(data: Data, item: string, location: string) {
  return (
    data.market.local[getLocalMarketKey(item, location)] ?? {
      timestmap: 0,
      ask: 0,
      bid: 0,
    }
  );
}

export function getGlobalMarket(data: Data, item: string) {
  return (
    data.market.global[item] ?? {
      min: { ask: 0, bid: 0 },
      max: { ask: 0, bid: 0 },
      average: { ask: 0, bid: 0 },
      count: 0,
    }
  );
}

export function getMarketGap(data: Data, item: string, location: string) {
  const localMarket = getLocalMarket(data, item, location);
  const globalMarket = getGlobalMarket(data, item);

  if (!localMarket || !globalMarket) {
    return { ask: 0, bid: 0 };
  }

  return {
    ask: localMarket.ask - globalMarket.max.ask,
    bid: localMarket.bid - globalMarket.min.bid,
  };
}

export function getMarketSpread(data: Data, item: string) {
  const global = getGlobalMarket(data, item);

  if (!global) {
    return 0;
  }

  return global.max.ask - global.min.bid;
}

export function getNetProfit(data: Data, item: string, fee: number) {
  const spread = getMarketSpread(data, item);

  if (spread === 0) {
    return 0;
  }

  return spread - getGlobalMarket(data, item).max.bid * fee;
}

export function matchItem(query: string, item: string) {
  if (query.length === 0) {
    return true;
  }

  if (item.toLowerCase().includes(query.toLowerCase())) {
    return true;
  }

  if (item in items) {
    return items[item as keyof typeof items].toLowerCase().includes(query.toLowerCase());
  }

  return false;
}
