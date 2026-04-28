import type { int } from "@tsonic/core/types.js";

export function toIndex(value: number): int | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return value as int;
}
