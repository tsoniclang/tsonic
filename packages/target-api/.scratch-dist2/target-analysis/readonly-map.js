export function snapshotTargetReadonlyMap(entries) {
    const values = new Map(entries);
    const view = Object.freeze({
        size: values.size,
        get: (key) => values.get(key),
        has: (key) => values.has(key),
        entries: () => values.entries(),
        keys: () => values.keys(),
        values: () => values.values(),
        [Symbol.iterator]: () => values[Symbol.iterator](),
        [Symbol.toStringTag]: "ReadonlyMap",
        forEach(callback, thisArg) {
            values.forEach((value, key) => callback.call(thisArg, value, key, view));
        },
    });
    return view;
}
//# sourceMappingURL=readonly-map.js.map