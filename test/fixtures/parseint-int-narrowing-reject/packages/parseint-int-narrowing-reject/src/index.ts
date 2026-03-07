import type { int } from "@tsonic/core/types.js";

export function parseStrict(raw: string): int | undefined {
  const parsed = parseInt(raw, 10);
  if (parsed === undefined || Number.isNaN(parsed)) {
    return undefined;
  }
  return parsed as int;
}
