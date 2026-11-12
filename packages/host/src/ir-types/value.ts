export { tyId as typeIdentifier, sigId as signatureIdentifier } from "../ids/index.js";

export function required<Key, Value>(values: ReadonlyMap<Key, Value>, key: Key): Value {
  const value = values.get(key);
  if (value === undefined) throw new Error("Canonical publication requires a complete arena reference.");
  return value;
}

export function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
