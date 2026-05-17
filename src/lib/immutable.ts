/**
 * Clone and mutate an object.
 */
export function immutable<T, U>(subject: T, mutate: (subject: T) => U) {
  return mutate(structuredClone(subject));
}
