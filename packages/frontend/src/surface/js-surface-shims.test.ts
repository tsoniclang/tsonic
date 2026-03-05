import { describe, it } from "mocha";
import { expect } from "chai";
import {
  JS_SURFACE_GLOBALS_SHIMS,
  JS_SURFACE_NODE_MODULE_SHIMS,
  buildJsSurfaceNodeModuleShims,
} from "./js-surface-shims.js";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("JS Surface Shims", () => {
  it("declares required JS runtime globals", () => {
    const requiredGlobals = [
      "interface String",
      "interface Array<T>",
      "interface ReadonlyArray<T>",
      "const console: Console;",
      "const Date: DateConstructor;",
      "const JSON: JSON;",
      "const Math: Math;",
      "const RegExp: RegExpConstructor;",
      "const Map: MapConstructor;",
      "const Set: SetConstructor;",
      "function parseInt(",
      "function parseFloat(",
      "function isFinite(",
      "function isNaN(",
      "function setTimeout(",
      "function setInterval(",
    ] as const;

    for (const token of requiredGlobals) {
      expect(JS_SURFACE_GLOBALS_SHIMS).to.include(token);
    }
  });

  it("keeps unsupported mutating Array APIs out of compiler-owned shims", () => {
    expect(JS_SURFACE_GLOBALS_SHIMS).to.not.include("push(");
    expect(JS_SURFACE_GLOBALS_SHIMS).to.not.include("pop(");
    expect(JS_SURFACE_GLOBALS_SHIMS).to.not.include("splice(");
    expect(JS_SURFACE_GLOBALS_SHIMS).to.not.include("shift(");
    expect(JS_SURFACE_GLOBALS_SHIMS).to.not.include("unshift(");
  });

  it("declares node alias modules for both node:* and bare specifiers", () => {
    const requiredNodeAliases = [
      'declare module "node:fs" { export { fs } from "@tsonic/nodejs/index.js"; }',
      'declare module "fs" { export { fs } from "@tsonic/nodejs/index.js"; }',
      'declare module "node:path" { export { path } from "@tsonic/nodejs/index.js"; }',
      'declare module "path" { export { path } from "@tsonic/nodejs/index.js"; }',
      'declare module "node:crypto" { export { crypto } from "@tsonic/nodejs/index.js"; }',
      'declare module "crypto" { export { crypto } from "@tsonic/nodejs/index.js"; }',
      'declare module "node:process" { export { process } from "@tsonic/nodejs/index.js"; }',
      'declare module "process" { export { process } from "@tsonic/nodejs/index.js"; }',
      'declare module "node:os" { export { os } from "@tsonic/nodejs/index.js"; }',
      'declare module "os" { export { os } from "@tsonic/nodejs/index.js"; }',
    ] as const;

    for (const alias of requiredNodeAliases) {
      expect(JS_SURFACE_NODE_MODULE_SHIMS).to.include(alias);
    }
  });

  it("builds member-level node module shims when nodejs internal declarations are available", () => {
    const root = mkdtempSync(join(tmpdir(), "tsonic-node-shims-"));
    try {
      const internalDir = join(root, "index", "internal");
      mkdirSync(internalDir, { recursive: true });
      writeFileSync(
        join(internalDir, "index.d.ts"),
        `
export abstract class path$instance {
  static join(...parts: string[]): string;
  static extname(path: string): string;
}
export abstract class fs$instance {
  static existsSync(path: string): boolean;
}
`
      );

      const generated = buildJsSurfaceNodeModuleShims(root);
      expect(generated).to.include('declare module "node:path" {');
      expect(generated).to.include(
        'export const join: typeof import("@tsonic/nodejs/index.js").path.join;'
      );
      expect(generated).to.include(
        'export const extname: typeof import("@tsonic/nodejs/index.js").path.extname;'
      );
      expect(generated).to.include(
        'declare module "path" { export * from "node:path"; }'
      );
      expect(generated).to.include(
        'export const existsSync: typeof import("@tsonic/nodejs/index.js").fs.existsSync;'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("falls back to static node module shims when package root is missing", () => {
    const generated = buildJsSurfaceNodeModuleShims(undefined);
    expect(generated).to.equal(JS_SURFACE_NODE_MODULE_SHIMS);
  });
});
