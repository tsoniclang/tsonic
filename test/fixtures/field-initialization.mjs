export const fieldInitializationSource = `
import { field } from "@tsonic/core/lang.js";
import type { int32 } from "@tsonic/core/types.js";
class Record {
  raw = field<int32>();
}
export function run(): boolean {
  const value = new Record();
  if (value.raw !== 0) return false;
  value.raw = 17;
  value.raw++;
  return value.raw === 18;
}
`;
