export function snapshotTargetReadonlyMap<Key, Value>(entries: Iterable<readonly [Key, Value]>): ReadonlyMap<Key, Value> {
  const values = new Map(entries);
  const view: ReadonlyMap<Key, Value> = Object.freeze({
    size: values.size,
    get: (key: Key) => values.get(key),
    has: (key: Key) => values.has(key),
    entries: () => values.entries(),
    keys: () => values.keys(),
    values: () => values.values(),
    [Symbol.iterator]: () => values[Symbol.iterator](),
    [Symbol.toStringTag]: "ReadonlyMap",
    forEach(callback: (value: Value, key: Key, map: ReadonlyMap<Key, Value>) => void, thisArg?: unknown) {
      values.forEach((value, key) => callback.call(thisArg, value, key, view));
    },
  });
  return view;
}
