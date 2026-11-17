import { sourcePackageGraphFixture } from "./source-package-graph.mjs";

export const closedGenericDispatchProofFiles = Object.freeze({
  "dispatch.ts": `
export class Base {
  count: number = 0;
  choose<T>(value: T): T { this.count += 1; return value; }
}
export class Derived extends Base {
  choose<T>(value: T): T { this.count += 10; return value; }
}
export function relay<T>(receiver: Base, value: T): T {
  return receiver.choose<T>(value);
}
export function nested<T>(receiver: Base, value: T): T {
  return relay<T>(receiver, value);
}
`,
  "index.ts": `
import type { uint32 } from "@tsonic/core/types.js";
import { Base, Derived, nested, relay } from "./dispatch.js";
export function run(): boolean {
  const first = new Base();
  const second = new Derived();
  const maximum: uint32 = 4294967295;
  const firstValue = relay<uint32>(first, maximum);
  const secondValue = nested<uint32>(second, maximum);
  const text = nested<string>(second, "native");
  return firstValue === maximum && secondValue === maximum && text === "native" &&
    first.count === 1 && second.count === 20;
}
`,
});

export const closedGenericDispatchPackageFiles = Object.freeze({
  "node_modules/@acme/dispatch/package.json": JSON.stringify({
    name: "@acme/dispatch", version: "1.0.0", type: "module",
    exports: { ".": "./index.ts" },
  }),
  "node_modules/@acme/dispatch/index.ts": closedGenericDispatchProofFiles["dispatch.ts"],
  "index.ts": closedGenericDispatchProofFiles["index.ts"].replace('"./dispatch.js"', '"@acme/dispatch"'),
});

export const closedGenericDispatchPackageGraph = sourcePackageGraphFixture(["index.ts"], {
  "@acme/dispatch": { files: ["index.ts"], dependencies: [] },
});
