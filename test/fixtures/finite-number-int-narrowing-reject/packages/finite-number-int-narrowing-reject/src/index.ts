import type { int, JsValue } from "@tsonic/core/types.js";

export function toIndex(value: JsValue): int | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return value as int;
}
