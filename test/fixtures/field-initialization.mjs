export const fieldInitializationSource = `
import { field, field as nativefield } from "@tsonic/core/lang.js";
import type { int32, int64 } from "@tsonic/core/types.js";
class Record {
  raw = field<int32>();
  wide = nativefield<int64>();
  flag = field<boolean>();
  absent = field<int64 | undefined>();
  static total = field<int32>();
}
export function run(): boolean {
  const value = new Record();
  if (value.raw !== 0 || value.wide !== 0n || value.flag || value.absent !== null || Record.total !== 0) return false;
  value.raw = 17;
  value.raw++;
  value.wide = 9007199254740993n;
  value.flag = true;
  value.absent = value.wide;
  Record.total++;
  const other = new Record();
  return value.raw === 18 && value.wide === 9007199254740993n && value.flag &&
    value.absent === 9007199254740993n && other.raw === 0 && other.wide === 0n &&
    other.absent === undefined && !other.flag && Record.total === 1;
}
`;
