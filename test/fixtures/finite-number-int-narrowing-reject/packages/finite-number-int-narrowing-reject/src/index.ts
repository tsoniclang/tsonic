import type { int } from "@tsonic/core/types.js";

export function toIndex(value: unknown): int | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return value as int;
}
