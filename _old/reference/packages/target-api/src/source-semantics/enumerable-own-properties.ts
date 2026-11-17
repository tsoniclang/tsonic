const maximumArrayIndex = 4_294_967_294;

export function orderEnumerableOwnStringProperties<Value>(
  values: readonly Value[],
  getName: (value: Value) => string,
): readonly Value[] {
  const indexed: { readonly value: Value; readonly index: number }[] = [];
  const ordinary: Value[] = [];
  for (const value of values) {
    const index = canonicalArrayIndex(getName(value));
    if (index === undefined) {
      ordinary.push(value);
    } else {
      indexed.push({ value, index });
    }
  }
  indexed.sort((left, right) => left.index - right.index);
  return Object.freeze([
    ...indexed.map((entry) => entry.value),
    ...ordinary,
  ]);
}

function canonicalArrayIndex(name: string): number | undefined {
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
