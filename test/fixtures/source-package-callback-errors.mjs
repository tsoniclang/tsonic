import { sourcePackageGraphFixture } from "./source-package-graph.mjs";

function packageFile(name) {
  return JSON.stringify({ name, version: "1.0.0", type: "module", exports: { ".": "./index.ts" } });
}

export const sourcePackageCallbackErrorFiles = Object.freeze({
  "node_modules/@acme/failures/package.json": packageFile("@acme/failures"),
  "node_modules/@acme/failures/index.ts": `
export class Failure extends Error {
  code: number;
  constructor(code: number) { super("selected failure"); this.code = code; }
}
export function invoke(callback: () => number): number { return callback(); }
export function retain(callback: () => number): () => number { return callback; }
export function fail(error: Failure): number { throw error; }
`,
  "node_modules/@acme/forward/package.json": packageFile("@acme/forward"),
  "node_modules/@acme/forward/index.ts": `
import { invoke, retain } from "@acme/failures";
export function forwarded(callback: () => number): () => number { return retain(callback); }
export function consume(callback: () => number): number { return invoke(callback); }
`,
  "index.ts": `
import { fail, Failure } from "@acme/failures";
import { forwarded, consume } from "@acme/forward";
export function run(): boolean {
  const expected = new Failure(7);
  const callback = forwarded(() => fail(expected));
  let caught = 0;
  try { callback(); }
  catch (error) {
    if (error instanceof Failure && error === expected && error.code === 7) caught += 1;
  }
  try { consume(callback); }
  catch (error) {
    if (error instanceof Failure && error === expected && error.code === 7) caught += 1;
  }
  return caught === 2;
}
`,
});

export const sourcePackageCallbackErrorGraph = sourcePackageGraphFixture(["index.ts"], {
  "@acme/failures": { files: ["index.ts"], dependencies: [] },
  "@acme/forward": { files: ["index.ts"], dependencies: ["@acme/failures"] },
});
