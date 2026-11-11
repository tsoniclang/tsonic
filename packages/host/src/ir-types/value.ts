import type { TyId, SigId } from "../ids/contract.js";
import { tyId, sigId } from "../ids/index.js";

function numericIdentity(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
}

export function typeIdentifier(value: number): TyId {
  if (numericIdentity(value)) return tyId(value);
  throw new Error("A newly issued type ID must be a nonnegative safe integer.");
}

export function signatureIdentifier(value: number): SigId {
  if (numericIdentity(value)) return sigId(value);
  throw new Error("A newly issued signature ID must be a nonnegative safe integer.");
}

export function required<Key, Value>(values: ReadonlyMap<Key, Value>, key: Key): Value {
  const value = values.get(key);
  if (value === undefined) throw new Error("Canonical publication requires a complete arena reference.");
  return value;
}

export function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
