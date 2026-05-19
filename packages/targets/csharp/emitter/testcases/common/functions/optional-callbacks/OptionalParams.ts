import { int } from "@tsonic/core/types.js";

export type Callback = (result: int) => void;

// Optional callback parameter
export function compute(value: int, callback?: Callback): int {
  const result = value * 2;
  if (callback !== undefined) {
    callback(result);
  }
  return result;
}

// Nullable function type
export function maybeTransform(
  value: int,
  transform: ((x: int) => int) | null
): int {
  if (transform !== null) {
    return transform(value);
  }
  return value;
}
