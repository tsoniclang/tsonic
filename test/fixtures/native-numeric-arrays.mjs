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
  return true;
}
`;
