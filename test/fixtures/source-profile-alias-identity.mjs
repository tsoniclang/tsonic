export const sourceProfileAliasIdentityFiles = {
  "aliases.ts": `
import type { int64 } from "@tsonic/core/types.js";
export type Entries<Value> = Record<string, Value | undefined>;
export type WideEntries = Entries<int64>;
export type HeaderEntries = Entries<string[]>;
`,
  "local.ts": `
export type Record<Key, Value> = { key: Key; value: Value };
`,
};

export const sourceProfileAliasIdentitySource = `
import type { int64 } from "@tsonic/core/types.js";
import type { Entries, WideEntries, HeaderEntries } from "./aliases.js";
import type { Record as LocalRecord } from "./local.js";
function present(values: WideEntries, key: string): int64 {
  const selected = values[key];
  if (selected === undefined) throw new Error("missing exact value");
  return selected;
}
function local(value: LocalRecord<string, int64>): int64 { return value.value; }
export function run(): boolean {
  const exact: int64 = 9007199254740993n;
  const values: WideEntries = { wide: exact };
  const generic: Entries<int64> = values;
  const headers: HeaderEntries = { test: ["first"] };
  const alias = headers;
  alias["test"]!.push("second");
  return present(generic, "wide") === exact && values["missing"] === undefined &&
    headers["test"]!.length === 2 && local({ key: "local", value: exact }) === exact;
}
`;
