import { sourcePackageGraphFixture } from "./source-package-graph.mjs";

export const nativeBackgroundCompletionSource = `
import { gzip } from "node:zlib";
import { Buffer } from "node:buffer";
export function main(): void {
  gzip(Buffer.from("native compression"), (error, output): void => {
    if (error !== undefined) throw error;
    if (output === undefined || output.length === 0) throw new Error("missing compression output");
    console.log("native completion");
  });
}
`;

export const nativeBackgroundAsyncSource = `
import { gzip } from "node:zlib";
import { Buffer } from "node:buffer";
export async function main(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    gzip(Buffer.from("native async compression"), (error, output): void => {
      if (error !== undefined) { reject(error); return; }
      if (output === undefined || output.length === 0) { reject(new Error("missing compression output")); return; }
      console.log("native async completion");
      resolve();
    });
  });
}
`;

export const nativeBackgroundOriginalErrorSource = `
import { gzip } from "node:zlib";
import { Buffer } from "node:buffer";
export function schedule(): Error {
  const original = new Error("original compression failure");
  gzip(Buffer.from("native failure"), (error, output): void => {
    if (error !== undefined) throw error;
    if (output === undefined) throw new Error("missing output");
    throw original;
  });
  return original;
}
`;

export const nativeBackgroundNoDemandSource = `
import { gzipSync } from "node:zlib";
import { Buffer } from "node:buffer";
export function main(): void {
  if (gzipSync(Buffer.from("native sync")).length === 0) throw new Error("missing output");
}
`;

function packageSource(name, dependency) {
  return `
import { gzip } from "node:zlib";
import { Buffer } from "node:buffer";
import type { int64 } from "@tsonic/core/types.js";
${dependency === undefined ? "" : `import { schedule as scheduleDependency } from "@acme/${dependency}";`}
export class ${name}Failure { constructor(public readonly value: int64) {} }
export function schedule(): void {
  ${dependency === undefined ? "" : "scheduleDependency();"}
  gzip(Buffer.from("${name}"), (error, output): void => {
    if (error !== undefined) throw error;
    if (output === undefined || output.length === 0) throw new ${name}Failure(9007199254740993n);
    console.log("${name} completion");
  });
}
`;
}

export const nativeBackgroundPackageFiles = Object.freeze({
  "package.json": JSON.stringify({ name: "background-root", type: "module", dependencies: { "@acme/middle": "1.0.0" } }),
  "index.ts": `${packageSource("Root", "middle")}\nexport function main(): void { schedule(); }`,
  "node_modules/@acme/middle/package.json": JSON.stringify({ name: "@acme/middle", type: "module",
    exports: { ".": "./index.ts" }, dependencies: { "@acme/leaf": "1.0.0" } }),
  "node_modules/@acme/middle/index.ts": packageSource("Middle", "leaf"),
  "node_modules/@acme/leaf/package.json": JSON.stringify({ name: "@acme/leaf", type: "module", exports: { ".": "./index.ts" } }),
  "node_modules/@acme/leaf/index.ts": packageSource("Leaf"),
});

export const nativeBackgroundPackageGraph = sourcePackageGraphFixture(["index.ts"], {
  "@acme/middle": { files: ["index.ts"], dependencies: ["@acme/leaf"] },
  "@acme/leaf": { files: ["index.ts"], dependencies: [] },
}, ["@acme/middle"]);
