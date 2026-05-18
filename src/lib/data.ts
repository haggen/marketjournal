export type Price = {
  bid: number;
  ask: number;
};

export type Entry = {
  timestamp: number;
  location: string;
  item: string;
  price: Price;
};

// [timestamp, item, location, bid, ask]
export type EntryTuple = [number, string, string, number, number];

export type GlobalMarket = {
  min: Price;
  max: Price;
  average: Price;
  count: number;
};

export type LocalMarket = {
  latest: Price;
};

export type Data = {
  version: 5;
  entries: EntryTuple[];
  items: string[];
  locations: string[];
  market: {
    local: Record<string, LocalMarket>;
    global: Record<string, GlobalMarket>;
  };
};

export function createEmptyData() {
  return {
    version: 5,
    entries: [],
    items: [],
    locations: [],
    market: {
      local: {},
      global: {},
    },
  } as Data;
}

export function migrate(data: any) {
  if (data.version === 3) {
    const migrated = createEmptyData();

    const entries = Array.isArray(data.entries) ? data.entries : [];

    for (const entry of entries) {
      if (!entry || typeof entry !== "object") {
        continue;
      }

      if (
        typeof entry.timestamp !== "number" ||
        typeof entry.location !== "string" ||
        typeof entry.item !== "string" ||
        typeof entry.price !== "number"
      ) {
        continue;
      }

      addEntry(migrated, {
        timestamp: entry.timestamp,
        location: entry.location,
        item: entry.item,
        price: {
          bid: entry.price,
          ask: entry.price,
        },
      });
    }

    data.version = migrated.version;
    data.entries = migrated.entries;
    data.items = migrated.items;
    data.locations = migrated.locations;
    data.market = migrated.market;

    delete data.index;
  }

  if (data.version === 4) {
    data.entries = (Array.isArray(data.entries) ? data.entries : []).map(
      (entry: Entry): EntryTuple => [
        entry.timestamp,
        entry.item,
        entry.location,
        entry.price.bid,
        entry.price.ask,
      ],
    );
    data.version = 5;
  }
}

export function getInitialData() {
  const stored = localStorage.getItem("data");
  if (stored) {
    const parsed = JSON.parse(stored);
    migrate(parsed);
    return parsed as Data;
  }
  return createEmptyData();
}

export function addEntry(data: Data, entry: Entry) {
  data.entries.push([
    entry.timestamp,
    entry.item,
    entry.location,
    entry.price.bid,
    entry.price.ask,
  ]);

  if (!data.items.includes(entry.item)) {
    data.items.push(entry.item);
  }

  if (!data.locations.includes(entry.location)) {
    data.locations.push(entry.location);
  }

  let global = data.market.global[entry.item];

  if (!global) {
    global = data.market.global[entry.item] = {
      count: 0,
      min: { bid: entry.price.bid, ask: entry.price.ask },
      max: { bid: entry.price.bid, ask: entry.price.ask },
      average: { bid: entry.price.bid, ask: entry.price.ask },
    };
  }

  let local = data.market.local[`${entry.item}-${entry.location}`];

  if (local) {
    global.average.bid += (entry.price.bid - local.latest.bid) / global.count;
    global.average.ask += (entry.price.ask - local.latest.ask) / global.count;

    local.latest = { bid: entry.price.bid, ask: entry.price.ask };
  } else {
    local = data.market.local[`${entry.item}-${entry.location}`] = {
      latest: { bid: entry.price.bid, ask: entry.price.ask },
    };

    global.count += 1;

    global.average.bid +=
      (local.latest.bid - global.average.bid) / global.count;
    global.average.ask +=
      (local.latest.ask - global.average.ask) / global.count;
  }

  global.min.bid = Infinity;
  global.max.bid = 0;
  global.min.ask = Infinity;
  global.max.ask = 0;

  for (const location of data.locations) {
    const local = data.market.local[`${entry.item}-${location}`];

    if (!local) {
      continue;
    }

    if (local.latest.bid < global.min.bid) {
      global.min.bid = local.latest.bid;
    }

    if (local.latest.bid > global.max.bid) {
      global.max.bid = local.latest.bid;
    }

    if (local.latest.ask < global.min.ask) {
      global.min.ask = local.latest.ask;
    }

    if (local.latest.ask > global.max.ask) {
      global.max.ask = local.latest.ask;
    }
  }
}

export function deleteItem(data: Data, item: string) {
  data.entries = data.entries.filter((entry) => entry[1] !== item);
  data.items = data.items.filter((name) => name !== item);

  delete data.market.global[item];

  for (const location of data.locations) {
    delete data.market.local[`${item}-${location}`];
  }
}

export function deleteLocation(data: Data, location: string) {
  data.entries = data.entries.filter((entry) => entry[2] !== location);

  data.locations = data.locations.filter((name) => name !== location);

  for (const item of data.items) {
    const local = data.market.local[`${item}-${location}`];

    if (!local) {
      continue;
    }

    delete data.market.local[`${item}-${location}`];

    const global = data.market.global[item];

    if (!global) {
      throw new Error(`Global market missing for ${item}-${location}`);
    }

    global.count -= 1;

    if (global.count === 0) {
      delete data.market.global[item];
      continue;
    }

    global.average.bid -=
      (local.latest.bid - global.average.bid) / global.count;
    global.average.ask -=
      (local.latest.ask - global.average.ask) / global.count;

    global.min.bid = Infinity;
    global.max.bid = 0;
    global.min.ask = Infinity;
    global.max.ask = 0;

    for (const location of data.locations) {
      const local = data.market.local[`${item}-${location}`];

      if (!local) {
        continue;
      }

      if (local.latest.bid < global.min.bid) {
        global.min.bid = local.latest.bid;
      }

      if (local.latest.bid > global.max.bid) {
        global.max.bid = local.latest.bid;
      }

      if (local.latest.ask < global.min.ask) {
        global.min.ask = local.latest.ask;
      }

      if (local.latest.ask > global.max.ask) {
        global.max.ask = local.latest.ask;
      }
    }
  }
}

export function getLocalMarket(data: Data, item: string, location: string) {
  return (
    data.market.local[`${item}-${location}`] ?? { latest: { bid: 0, ask: 0 } }
  );
}

export function getGlobalMarket(data: Data, item: string) {
  return (
    data.market.global[item] ?? {
      min: { bid: 0, ask: 0 },
      max: { bid: 0, ask: 0 },
      average: { bid: 0, ask: 0 },
      count: 0,
    }
  );
}

export function getMarketGap(data: Data, item: string, location: string) {
  const local = getLocalMarket(data, item, location);
  const global = getGlobalMarket(data, item);

  if (!local || !global) {
    return { bid: 0, ask: 0 };
  }

  return {
    bid: local.latest.bid - global.min.bid,
    ask: global.max.ask - local.latest.ask,
  };
}

export function getMarketEfficiency(
  data: Data,
  item: string,
  location: string,
) {
  const local = getLocalMarket(data, item, location);
  const global = getGlobalMarket(data, item);

  if (!local || !global) {
    return { bid: 0, ask: 0 };
  }

  return {
    bid: global.min.bid > 0 ? local.latest.bid / global.min.bid : 0,
    ask: global.max.ask > 0 ? local.latest.ask / global.max.ask : 0,
  };
}
