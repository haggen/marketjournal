export type Entry = {
  timestamp: number;
  location: string;
  item: string;
  price: number;
};

export type IndexEntry = {
  latest: number;
  delta: number;
  average: number;
  count: number;
  min: number;
  max: number;
};

export type Data = {
  version?: number;
  entries: Entry[];
  items: string[];
  locations: string[];
  index: Record<string, IndexEntry>;
};

export function getVersion(data: any) {
  if ("version" in data && typeof data.version === "number") {
    return data.version;
  }
  return 1;
}

function recalculateStats(data: Data, itemName: string) {
  const item = data.index[itemName];
  if (!item) return;

  let sum = 0;
  let count = 0;
  let min = Infinity;
  let max = -Infinity;

  for (const loc of data.locations) {
    const locItem = data.index[`${itemName}-${loc}`];
    if (locItem) {
      sum += locItem.latest;
      count++;
      if (locItem.latest < min) min = locItem.latest;
      if (locItem.latest > max) max = locItem.latest;
    }
  }

  item.count = count;
  item.average = count > 0 ? sum / count : 0;
  item.min = count > 0 ? min : 0;
  item.max = count > 0 ? max : 0;

  for (const loc of data.locations) {
    const locItem = data.index[`${itemName}-${loc}`];
    if (locItem) {
      locItem.delta = locItem.latest - item.min;
    }
  }
}

export function createEmptyData() {
  return {
    version: 3,
    entries: [],
    items: [],
    locations: [],
    index: {},
  } as Data;
}

export function migrate(data: any) {
  if (getVersion(data) === 1) {
    const oldIndex = data.index;
    const newIndex: Record<string, IndexEntry> = {};

    for (const [key, value] of Object.entries(oldIndex)) {
      if (value && typeof value === "object" && "locations" in value) {
        const oldItem = value as any;
        newIndex[key] = {
          latest: 0,
          delta: 0,
          average: oldItem.average ?? 0,
          count: oldItem.count ?? 0,
          min: 0,
          max: 0,
        };

        if (oldItem.locations) {
          for (const [loc, locData] of Object.entries(oldItem.locations)) {
            newIndex[`${key}-${loc}`] = {
              latest: (locData as any).latest ?? 0,
              delta: (locData as any).delta ?? 0,
              average: 0,
              count: 0,
              min: 0,
              max: 0,
            };
          }
        }
      }
    }

    data.index = newIndex;
    data.version = 2;

    // Recalculate to ensure min, max, and the new delta logic are applied
    if (data.items) {
      for (const itemName of data.items) {
        recalculateStats(data, itemName);
      }
    }
  }

  if (getVersion(data) === 2) {
    if (data.index) {
      for (const key of Object.keys(data.index)) {
        if (data.index[key].min === undefined) data.index[key].min = 0;
        if (data.index[key].max === undefined) data.index[key].max = 0;
      }
    }

    // Recalculate stats for the new delta logic (latest - min) and populating min/max
    if (data.items) {
      for (const itemName of data.items) {
        recalculateStats(data, itemName);
      }
    }

    data.version = 3;
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
      latest: 0,
      delta: 0,
      average: 0,
      count: 0,
      min: 0,
      max: 0,
    };
  }

  let location = data.index[`${entry.item}-${entry.location}`];

  if (!location) {
    data.index[`${entry.item}-${entry.location}`] = location = {
      latest: 0,
      delta: 0,
      average: 0,
      count: 0,
      min: 0,
      max: 0,
    };
  }

  location.latest = entry.price;

  recalculateStats(data, entry.item);
}

export function deleteItem(data: Data, target: string) {
  data.entries = data.entries.filter(({ item }) => item !== target);

  data.items = data.items.filter((item) => item !== target);

  delete data.index[target];
  for (const loc of data.locations) {
    delete data.index[`${target}-${loc}`];
  }
}

export function deleteLocation(data: Data, target: string) {
  data.entries = data.entries.filter(({ location }) => location !== target);

  data.locations = data.locations.filter((location) => location !== target);

  for (const item of data.items) {
    if (data.index[`${item}-${target}`]) {
      delete data.index[`${item}-${target}`];
      recalculateStats(data, item);
    }
  }
}
