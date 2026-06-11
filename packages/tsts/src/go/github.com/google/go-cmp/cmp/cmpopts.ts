import type { Option } from "../cmp.js";

export function IgnoreUnexported(...types: Array<unknown>): Option {
  return { kind: "IgnoreUnexported", args: types };
}
