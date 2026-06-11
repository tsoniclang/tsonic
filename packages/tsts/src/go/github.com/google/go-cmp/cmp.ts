import type { bool } from "@tsonic/core/types.js";
import { DeepEqual } from "../../../reflect.js";

export interface Option {
  readonly kind: string;
  readonly args: readonly unknown[];
}

export type Path = readonly unknown[];

export function AllowUnexported(...types: Array<unknown>): Option {
  return { kind: "AllowUnexported", args: types };
}

export function Diff(x: unknown, y: unknown, ..._opts: Array<Option>): string {
  if (DeepEqual(x, y)) {
    return "";
  }
  return `- ${stableStringify(x)}\n+ ${stableStringify(y)}`;
}

export function FilterPath(filter: (path: Path) => bool, opt: Option): Option {
  return { kind: "FilterPath", args: [filter, opt] };
}

export function Ignore(): Option {
  return { kind: "Ignore", args: [] };
}

function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_key, current) => {
    if (typeof current === "bigint") {
      return current.toString();
    }
    if (current !== null && typeof current === "object") {
      if (seen.has(current)) {
        return "[Circular]";
      }
      seen.add(current);
      if (!Array.isArray(current)) {
        const ordered: Record<string, unknown> = {};
        for (const key of Object.keys(current).sort()) {
          ordered[key] = (current as Record<string, unknown>)[key];
        }
        return ordered;
      }
    }
    return current;
  }, 2) ?? String(value);
}
