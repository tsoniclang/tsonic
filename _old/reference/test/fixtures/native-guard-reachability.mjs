export const nativeGuardReachabilitySource = `
function read(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number") return "number";
  return value[0];
}
function unified(value: string | null | undefined): number {
  if (value === undefined) {
    if (value === null) return 7;
    return 9;
  }
  return 3;
}
function mutable(value: string | number, other: string | number): boolean {
  if (typeof value === "string") {
    value = other;
    return typeof value === "number";
  }
  return false;
}
function preserveEffects(value: string): string {
  const selected = { get value(): string { return value; } };
  if (typeof selected.value === "string") return selected.value;
  return "wrong";
}
export function run(): boolean {
  return read("kept") === "kept" && read(undefined) === undefined &&
    unified(null) === 7 && unified(undefined) === 7 && unified("kept") === 3 &&
    mutable("original", 4) && !mutable("original", "replacement") && preserveEffects("live") === "live";
}
`;

export const nativeHeaderReachabilitySource = `
import type { ServerResponse } from "node:http";
export function headerValue(response: ServerResponse, name: string): string | undefined {
  const value = response.getHeader(name);
  if (value === undefined) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return value[0];
}
export function run(): boolean { return true; }
`;

export const nativeGuardGetterEffectsSource = `
let reads = 0;
function count(): number { return reads; }
class Probe {
  get value(): string {
    reads++;
    if (reads === 3) throw new Error("guard getter");
    return "kept";
  }
}
function inspect(probe: Probe): string {
  if (typeof probe.value === "string") return "kept";
  return "wrong";
}
export function run(): boolean {
  const probe = new Probe();
  if (inspect(probe) !== "kept" || count() !== 1) return false;
  if (inspect(probe) !== "kept" || count() !== 2) return false;
  try { inspect(probe); return false; }
  catch (failure) { return count() === 3 && failure instanceof Error && failure.message === "guard getter"; }
}
`;
