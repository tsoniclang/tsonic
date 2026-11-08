const maximumArrayIndex = 4294967294;
export function orderEnumerableOwnStringProperties(values, getName) {
    const indexed = [];
    const ordinary = [];
    for (const value of values) {
        const index = canonicalArrayIndex(getName(value));
        if (index === undefined) {
            ordinary.push(value);
        }
        else {
            indexed.push({ value, index });
        }
    }
    indexed.sort((left, right) => left.index - right.index);
    return Object.freeze([
        ...indexed.map((entry) => entry.value),
        ...ordinary,
    ]);
}
function canonicalArrayIndex(name) {
    if (name.length === 0) {
        return undefined;
    }
    const value = Number(name);
    return Number.isInteger(value) &&
        value >= 0 &&
        value <= maximumArrayIndex &&
        String(value) === name
        ? value
        : undefined;
}
//# sourceMappingURL=enumerable-own-properties.js.map