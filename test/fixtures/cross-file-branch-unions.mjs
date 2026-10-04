export const crossFileBranchUnionFiles = {
  "values.ts": `
import type { uint64 } from "@tsonic/core/types.js";
export type Choice = string | { readonly code: uint64 };
export type Alias = Choice;
export function first(record: boolean): Alias {
  return record ? { code: 9007199254740993n } : "first";
}
export function second(record: boolean): Choice {
  return record ? { code: 18446744073709551615n } : "second";
}
`,
  "selection.ts": `
import { first, second } from "./values.js";
export function select(present: boolean, left: boolean, record: boolean) {
  return present ? left ? first(record) : second(record) : undefined;
}
`,
  "index.ts": `
import { select } from "./selection.js";
export function run(): boolean {
  const leftText = select(true, true, false);
  const rightText = select(true, false, false);
  const leftRecord = select(true, true, true);
  const rightRecord = select(true, false, true);
  return leftText === "first" && rightText === "second" &&
    leftRecord !== undefined && typeof leftRecord !== "string" && leftRecord.code === 9007199254740993n &&
    rightRecord !== undefined && typeof rightRecord !== "string" && rightRecord.code === 18446744073709551615n &&
    select(false, true, false) === undefined && select(false, false, true) === null;
}
`,
};
