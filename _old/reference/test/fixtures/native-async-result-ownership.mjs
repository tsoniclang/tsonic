export const nativeAsyncResultOwnershipFiles = {
  "producer.ts": `
import type { int64, uint64 } from "@tsonic/core/types.js";
export async function signed(): Promise<int64> { return 9007199254740993n; }
export async function unsigned(): Promise<uint64> { return 18446744073709551615n; }
`,
  "public.ts": `export { signed as readSigned, unsigned as readUnsigned } from "./producer.js";`,
  "index.ts": `
import type { int64, uint64 } from "@tsonic/core/types.js";
import { readSigned, readUnsigned } from "./public.js";
export async function run(): Promise<boolean> {
  const signed: int64 = await readSigned();
  const unsigned: uint64 = await readUnsigned();
  return signed === 9007199254740993n && unsigned === 18446744073709551615n;
}
`,
};
