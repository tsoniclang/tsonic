import { int } from "@tsonic/core/types.js";

export function takes(x: { a: int; b: string }): int {
  return x.a;
}

export const result = takes({ a: 1 as int, b: "hi" });
