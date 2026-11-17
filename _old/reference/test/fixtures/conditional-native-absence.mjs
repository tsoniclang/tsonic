export const conditionalNativeAbsenceSource = `
import type { uint64 } from "@tsonic/core/types.js";
class Reader {
  read(): uint64 | undefined;
  read(set: boolean): uint64;
  read(set?: boolean): uint64 | undefined {
    return set === undefined ? undefined : 9007199254740993n;
  }
}
function selected(present: boolean, first: boolean): uint64 | null | undefined {
  return present ? first ? 9007199254740993n : 18446744073709551615n : null;
}
export function run(): boolean {
  const reader = new Reader();
  return reader.read(true) === 9007199254740993n && reader.read() === undefined &&
    reader.read() === null && selected(true, true) === 9007199254740993n &&
    selected(true, false) === 18446744073709551615n &&
    selected(false, true) === null && selected(false, false) === undefined;
}
`;
