export const nativeOptionDefaultsSource = `
import type { int32 } from "@tsonic/core/types.js";
export function integer(value?: int32): int32 { return value ?? 0; }
export function floating(value?: number): number { return value ?? 0; }
export function boolean(value?: boolean): boolean { return value ?? false; }
export function text(value = ""): string { return value; }
export function negativeZero(value?: number): number { return value ?? -0; }
export async function main(): Promise<void> {
  if (integer() !== 0 || integer(7) !== 7 || floating() !== 0 || floating(2.5) !== 2.5 ||
    boolean() || !boolean(true) || text() !== "" || text("present") !== "present")
    throw new Error("native literal default");
  if (1 / negativeZero() !== Number.NEGATIVE_INFINITY || 1 / negativeZero(2) !== 0.5)
    throw new Error("native default signed zero");
  let visits = 0 as int32;
  async function supply(): Promise<int32> { visits += 1; return 9; }
  const absent: (int32 | undefined)[] = [undefined];
  const present: (int32 | undefined)[] = [7];
  const [selected = await supply()] = absent;
  const [retained = await supply()] = present;
  if (selected !== 9 || retained !== 7 || visits !== 1)
    throw new Error("native default suspension and laziness");
}
`;
