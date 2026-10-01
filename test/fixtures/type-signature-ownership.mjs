export const typeSignatureOwnershipFiles = {
  "contracts.ts": `
import type { int64 } from "@tsonic/core/types.js";
import type { Counter } from "./model.js";
export interface Readable<Value> { read(value: Value): Value; }
export type Factory = { new(value: int64): Counter; };
`,
  "model.ts": `
import type { int64 } from "@tsonic/core/types.js";
export class Counter {
  readonly value: int64;
  constructor(value: int64) { this.value = value; }
  read(value: int64): int64 { return this.value + value; }
}
`,
  "bridge.ts": `
export { Counter as Imported } from "./model.js";
export type { Factory, Readable } from "./contracts.js";
`,
  "index.ts": `
import type { int64 } from "@tsonic/core/types.js";
import { Imported } from "./bridge.js";
import type { Factory, Readable } from "./bridge.js";
import type { Counter } from "./model.js";
function construct(factory: Factory, value: int64): Counter {
  return new factory(value);
}
export function run(): boolean {
  const value: int64 = 9007199254740993n;
  const factory: Factory = Imported;
  const instance = construct(factory, value);
  const alias: Readable<int64> = instance;
  return instance.read(0n) === value && alias.read(2n) === value + 2n;
}
`,
};

export const conflictingNativeInterfaceFiles = {
  ...typeSignatureOwnershipFiles,
  "index.ts": `
import type { uint64 } from "@tsonic/core/types.js";
import { Imported } from "./bridge.js";
import type { Readable } from "./bridge.js";
export const invalid: Readable<uint64> = new Imported(1n);
`,
};
