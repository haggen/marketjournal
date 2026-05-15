export type Entry = {
  timestamp: number;
  location: string;
  item: string;
  price: number;
};

export type Data = {
  entries: Entry[];
  items: string[];
  locations: string[];
  index: Record<
    string,
    {
      locations: Record<string, { latest: number; delta: number }>;
      average: number;
      count: number;
    }
  >;
};

export function getVersion(data: Data) {
  if ("version" in data && typeof data.version === "number") {
    return data.version;
  }
  return 1;
}

function recalculateStats(item: Data["index"][string]) {
  item.average =
    item.count > 0
      ? Object.values(item.locations).reduce(
          (sum, { latest }) => sum + latest,
          0,
        ) / item.count
      : 0;

  for (const loc of Object.values(item.locations)) {
    loc.delta = loc.latest - item.average;
  }
}

export function createEmptyData() {
  return {
    entries: [],
    items: [],
    locations: [],
    index: {},
  } as Data;
}

export function migrate(data: Data) {
  if (getVersion(data) === 1) {
  }
}

export function getInitialData() {
  const stored = localStorage.getItem("data");
  if (stored) {
    return JSON.parse(stored) as Data;
  }
  return createEmptyData();
}

export function addEntry(data: Data, entry: Entry) {
  data.entries.push(entry);

  if (!data.items.includes(entry.item)) {
    data.items.push(entry.item);
  }

  if (!data.locations.includes(entry.location)) {
    data.locations.push(entry.location);
  }

  let item = data.index[entry.item];

  if (!item) {
    data.index[entry.item] = item = {
      locations: {},
      average: 0,
      count: 0,
    };
  }

  let location = item.locations[entry.location];

  if (!location) {
    item.locations[entry.location] = location = {
      latest: 0,
      delta: 0,
    };

    item.count += 1;
  }

  location.latest = entry.price;

  recalculateStats(item);
}

export function deleteItem(data: Data, target: string) {
  data.entries = data.entries.filter(({ item }) => item !== target);

  data.items = data.items.filter((item) => item !== target);

  delete data.index[target];
}

export function deleteLocation(data: Data, target: string) {
  data.entries = data.entries.filter(({ location }) => location !== target);

  data.locations = data.locations.filter((location) => location !== target);

  for (const [, item] of Object.entries(data.index)) {
    if (item.locations[target]) {
      delete item.locations[target];

      item.count -= 1;

      recalculateStats(item);
    }
  }
}
