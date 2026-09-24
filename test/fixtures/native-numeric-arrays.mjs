export const nativeNumericArraysSource = `
import type { nativeUint } from "@tsonic/core/types.js";
export function run(): boolean {
  const wide: nativeUint = 9007199254740993;
  const values: nativeUint[] = [wide, wide + 1];
  const bytes = new Uint8Array(values);
  const words = new Uint32Array(values);
  const clamped = new Uint8ClampedArray(values);
  if (bytes[0] !== 1 || bytes[1] !== 2 || words[0] !== 1 || clamped[0] !== 255) return false;
  bytes.set(values);
  if (bytes[0] !== 1 || bytes[1] !== 2) return false;
  const replacement: nativeUint = 7;
  values[0] = replacement;
  if (bytes[0] !== 1) return false;
  bytes.set(values);
  if (bytes.at(0) !== 7 || words[0] !== 1) return false;
  let rejected = false;
  try { bytes.set(values, 1); } catch { rejected = true; }
  if (!rejected || bytes.at(0) !== 7 || bytes[1] !== 2) return false;
  const ordinary = new Uint8Array([1.5, -1, Number.NaN]);
  if (ordinary[0] !== 1 || ordinary[1] !== 255 || ordinary[2] !== 0) return false;
  const exact = new Float64Array([9007199254740992]);
  const rounded: nativeUint = 9007199254740992;
  if (exact.includes(wide) || exact.indexOf(wide) !== -1 || !exact.includes(rounded)) return false;
  const start: nativeUint = 0;
  if (exact.includes(wide, start) || exact.indexOf(wide, start) !== -1 || exact.indexOf(rounded, start) !== 0) return false;
  const single = new Float32Array([16777216]);
  const unrepresentable: nativeUint = 16777217;
  if (single.includes(unrepresentable) || single.indexOf(unrepresentable) !== -1) return false;
  if (ordinary.includes(1.5) || ordinary.indexOf(-1) !== -1 || ordinary.includes(256)) return false;
  const special = new Float64Array([Number.NaN, -0, Number.POSITIVE_INFINITY]);
  if (!special.includes(Number.NaN) || special.indexOf(Number.NaN) !== -1 || special.indexOf(0) !== 1) return false;
  if (!special.includes(Number.POSITIVE_INFINITY)) return false;
  return true;
}
`;
