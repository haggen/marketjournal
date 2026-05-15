export function mutated<T>(database: T, mutate: (data: T) => void) {
  const clone = structuredClone(database);
  mutate(clone);
  return clone;
}
