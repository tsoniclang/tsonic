export const broadRecordFlowSource = `
function append(target: Record<string, unknown>, key: string, value: string): void {
  const current = target[key];
  if (current === undefined) { target[key] = value; return; }
  if (Array.isArray(current)) {
    const items = current as unknown[];
    const alias = items;
    alias.push(value);
    return;
  }
  target[key] = [String(current), value];
}
function length(value: unknown): number {
  if (value === undefined) return 0;
  if (Array.isArray(value)) return value.length;
  return String(value).length;
}
export function run(): boolean {
  const backing: unknown[] = ["first"];
  const target: Record<string, unknown> = { text: "one", existing: backing, absent: null };
  append(target, "missing", "new");
  append(target, "absent", "present");
  append(target, "text", "two");
  append(target, "existing", "second");
  const text = target["text"];
  const missing = target["missing"];
  return length(backing) === 2 && length(missing) === 3 && length(undefined) === 0 &&
    length(null) === 0 && length(target["absent"]) === 7 && backing.length === 2 &&
    backing[1] === "second" && typeof missing === "string" &&
    !Array.isArray(missing) && Array.isArray(text);
}
`;

export const typedBroadRecordFlowSource = `
function append(target: Record<string, unknown>, key: string, value: string): void {
  const current = target[key];
  if (current === undefined) { target[key] = value; return; }
  if (Array.isArray(current)) {
    const items = current as string[];
    const alias = items;
    alias.push(value);
    return;
  }
  target[key] = [String(current), value];
}
export function run(): boolean {
  const backing: unknown[] = ["first"];
  const target: Record<string, unknown> = { existing: backing };
  append(target, "existing", "second");
  return backing.length === 2 && backing[1] === "second";
}
`;

export const freshBroadArraySource = `
import type { uint64 } from "@tsonic/core/types.js";
function fresh(value: uint64): unknown { return [[], ["text", 2], false, value]; }
export function run(): boolean {
  const value: uint64 = 9007199254740993n;
  const result = fresh(value);
  if (!Array.isArray(result) || result.length !== 4) return false;
  const empty = result[0];
  const nested = result[1];
  return Array.isArray(empty) && empty.length === 0 && Array.isArray(nested) &&
    nested.length === 2 && typeof nested[0] === "string" && typeof nested[1] === "number" &&
    typeof result[2] === "boolean" && typeof result[3] === "bigint";
}
`;

export const mixedNativeArraySource = `
import type { uint64 } from "@tsonic/core/types.js";
function mixed(value: uint64) { return ["text", value]; }
export function run(): boolean {
  const value: uint64 = 9007199254740993n;
  const result = mixed(value);
  let count = 0;
  for (const entry of result) {
    if (typeof entry === "string" || typeof entry === "bigint") count++;
    else return false;
  }
  return count === 2 && typeof result[0] === "string" && typeof result[1] === "bigint" &&
    result[0] === "text" && result[1] === value;
}
`;
