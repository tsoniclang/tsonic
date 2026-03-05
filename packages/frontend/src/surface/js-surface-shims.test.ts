import { describe, it } from "mocha";
import { expect } from "chai";
import {
  JS_SURFACE_GLOBALS_SHIMS,
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
export declare const path: typeof path$instance;
export abstract class fs$instance {
  static existsSync(path: string): boolean;
}
export declare const fs: typeof fs$instance;
`
      );

      const generated = buildJsSurfaceNodeModuleShims(root);
      expect(generated).to.include('declare module "node:path" {');
      expect(generated).to.include(
        'export { path } from "@tsonic/nodejs/index.js";'
      );
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
      expect(generated).to.not.include('declare module "node:os"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("discovers node module aliases from tsbindgen type aliases", () => {
    const root = mkdtempSync(join(tmpdir(), "tsonic-node-shims-tsb-"));
    try {
      const internalDir = join(root, "versions", "10", "index", "internal");
      mkdirSync(internalDir, { recursive: true });
      writeFileSync(
        join(internalDir, "index.d.ts"),
        `
export abstract class fs$instance {
  static readFileSync(path: string): string;
}
export type fs = fs$instance;
`
      );

      const generated = buildJsSurfaceNodeModuleShims(root);
      expect(generated).to.include('declare module "node:fs" {');
      expect(generated).to.include(
        'export const readFileSync: typeof import("@tsonic/nodejs/index.js").fs.readFileSync;'
      );
      expect(generated).to.include(
        'declare module "fs" { export * from "node:fs"; }'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns an empty shim set when package root is missing", () => {
    const generated = buildJsSurfaceNodeModuleShims(undefined);
    expect(generated).to.equal("");
  });
});
