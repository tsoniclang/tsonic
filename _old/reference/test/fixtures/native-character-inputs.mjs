export const nativeCharacterInputsSource = `
import type { nativeUint, uint8, uint32 } from "@tsonic/core/types.js";
export function run(): boolean {
  const code: uint32 = 0x1f600;
  const bytes: uint8[] = [65, 66];
  const points: uint32[] = [67, code];
  const empty: uint32[] = [];
  if (String.fromCodePoint(code) !== "😀" || String.fromCharCode(...bytes) !== "AB") return false;
  if (String.fromCodePoint(...bytes, ...points) !== "ABC😀") return false;
  if (String.fromCodePoint() !== "" || String.fromCharCode() !== "") return false;
  if (String.fromCodePoint(...empty) !== "" || String.fromCharCode(...empty) !== "") return false;
  const wide: nativeUint = 9007199254740993;
  let evaluations = 0;
  const next = (): nativeUint => { evaluations += 1; return 65; };
  let rejected = false;
  try { String.fromCodePoint(wide, next()); } catch { rejected = true; }
  return rejected && evaluations === 1;
}
`;
