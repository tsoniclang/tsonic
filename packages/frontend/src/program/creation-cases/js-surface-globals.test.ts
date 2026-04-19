/**
 * Tests for JS surface global type resolution: extension bindings,
 * noLib-mode globals, instanceof narrowing, and generic surface globals
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as path from "node:path";
import { createProgram } from "../creation.js";
import { materializeFrontendFixture } from "../../testing/filesystem-fixtures.js";

describe("Program Creation – JS surface globals", function () {
  this.timeout(90_000);

  it("should load js-surface extension bindings without explicit typeRoots", () => {
    const fixture = materializeFrontendFixture(
      "program/creation/js-surface-globals/js-extension-bindings"
    );

    try {
      const tempDir = fixture.path("app");
      const srcDir = fixture.path("app/src");
      const entryPath = fixture.path("app/src/index.ts");

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@tsonic/js",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(
        result.value.bindings.resolveExtensionMethodByKey(
          "js",
          "String",
          "trim",
          0
        )
      ).to.not.equal(undefined);
    } finally {
      fixture.cleanup();
    }
  });

  it("should typecheck package-provided js globals in noLib mode", () => {
    const fixture = materializeFrontendFixture(
      "program/creation/js-surface-globals/package-js-globals"
    );

    try {
      const tempDir = fixture.path("app");
      const srcDir = fixture.path("app/src");
      const entryPath = fixture.path("app/src/index.ts");

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@tsonic/js",
      });

      expect(result.ok).to.equal(true);
    } finally {
      fixture.cleanup();
    }
  });

  it("should preserve instanceof narrowing for JS global constructors loaded through surface typeRoots", () => {
    const fixture = materializeFrontendFixture(
      "program/creation/js-surface-globals/instanceof-type-roots"
    );

    try {
      const tempDir = fixture.path("app");
      const srcDir = fixture.path("app/src");
      const entryPath = fixture.path("app/src/index.ts");
      const jsRoot = fixture.path("type-roots/@tsonic/js");
      const globalsRoot = fixture.path("type-roots/@tsonic/globals");
      const coreRoot = fixture.path("type-roots/@tsonic/core");

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@tsonic/js",
        typeRoots: [jsRoot, globalsRoot, coreRoot],
      });

      expect(result.ok).to.equal(true);
    } finally {
      fixture.cleanup();
    }
  });

  it("should load root-level global function bindings from a generic surface package", () => {
    const fixture = materializeFrontendFixture(
      "program/creation/js-surface-globals/generic-surface-globals"
    );

    try {
      const tempDir = fixture.path("app");
      const srcDir = fixture.path("app/src");
      const entryPath = fixture.path("app/src/index.ts");

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@fixture/js",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(result.value.bindings.getBinding("console")).to.deep.equal({
        kind: "global",
        assembly: "js",
        type: "js.console",
      });
      expect(result.value.bindings.getBinding("parseInt")).to.deep.equal({
        kind: "global",
        assembly: "js",
        type: "js.Globals",
        csharpName: "Globals.parseInt",
      });
      expect(result.value.bindings.getBinding("setInterval")).to.deep.equal({
        kind: "global",
        assembly: "js",
        type: "js.Timers",
        csharpName: "Timers.setInterval",
      });
      expect(result.value.bindings.getBinding("clearInterval")).to.deep.equal({
        kind: "global",
        assembly: "js",
        type: "js.Timers",
        csharpName: "Timers.clearInterval",
      });
    } finally {
      fixture.cleanup();
    }
  });

  it("includes authoritative source files backing JS globals and member surfaces", () => {
    const fixture = materializeFrontendFixture(
      "program/creation/js-surface-globals/source-backed-globals"
    );

    try {
      const tempDir = fixture.path("app");
      const srcDir = fixture.path("app/src");
      const stringPath = fixture.path(
        "app/node_modules/@fixture/js/src/String.ts"
      );
      const timersPath = fixture.path(
        "app/node_modules/@fixture/js/src/timers.ts"
      );
      const entryPath = fixture.path("app/src/index.ts");

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@fixture/js",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const programFiles = result.value.sourceFiles.map((sourceFile) =>
        fs.realpathSync(sourceFile.fileName)
      );
      expect(programFiles).to.include(fs.realpathSync(stringPath));
      expect(programFiles).to.include(fs.realpathSync(timersPath));
    } finally {
      fixture.cleanup();
    }
  });

  it("loads source-owned JS globals from the installed first-party source package", () => {
    const fixture = materializeFrontendFixture(
      "program/creation/js-surface-globals/package-js-globals"
    );

    try {
      const projectRoot = fixture.path("app");
      const sourceRoot = fixture.path("app/src");
      const entryPath = fixture.path("app/src/index.ts");
      const installedJsRoot = path.join(
        projectRoot,
        "node_modules",
        "@tsonic",
        "js"
      );
      const installedJsSrcRoot = path.join(installedJsRoot, "src");

      fs.mkdirSync(installedJsSrcRoot, { recursive: true });

      fs.writeFileSync(
        entryPath,
        [
          'const message = "  hello  ".trim();',
          "console.log(message);",
          "String(message);",
          "Number.isNaN(0);",
          "export const ok = message.length;",
          "",
        ].join("\n")
      );

      fs.writeFileSync(
        path.join(installedJsRoot, "package.json"),
        JSON.stringify(
          {
            name: "@tsonic/js",
            version: "10.0.49-next.0",
            type: "module",
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(installedJsRoot, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              namespace: "js",
              ambient: ["./globals.ts"],
              exports: {
                "./index.js": "./src/index.ts",
                "./Globals.js": "./src/Globals.ts",
                "./console.js": "./src/console.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(installedJsRoot, "globals.ts"),
        [
          "declare global {",
          '  const console: typeof import("./src/console.js").console;',
          '  const String: typeof import("./src/Globals.js").String;',
          '  const Number: typeof import("./src/Globals.js").Number;',
          "}",
          "export {};",
          "",
        ].join("\n")
      );
      fs.writeFileSync(
        path.join(installedJsSrcRoot, "index.ts"),
        "export * from './Globals.js';\nexport * from './console.js';\n"
      );
      fs.writeFileSync(
        path.join(installedJsSrcRoot, "console.ts"),
        "export function console(..._args: unknown[]): void {}\n"
      );
      fs.writeFileSync(
        path.join(installedJsSrcRoot, "Globals.ts"),
        [
          "export function String(_value: unknown): string {",
          '  return "";',
          "}",
          "",
          "export class Number {",
          "  public static isNaN(_value: unknown): boolean {",
          "    return false;",
          "  }",
          "}",
          "",
        ].join("\n")
      );

      const result = createProgram([entryPath], {
        projectRoot,
        sourceRoot,
        rootNamespace: "App",
        surface: "@tsonic/js",
        typeRoots: [installedJsRoot],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(
        result.value.bindings.getExactBindingByKind("console", "global")
      ).to.deep.equal({
        kind: "global",
        assembly: "js",
        type: "js.console.console",
        staticType: "js.console.console",
        sourceImport: "@tsonic/js/console.js",
      });
      expect(
        result.value.bindings.getExactBindingByKind("String", "global")
      ).to.deep.equal({
        kind: "global",
        assembly: "js",
        type: "js.Globals.String",
        staticType: "js.Globals.String",
        sourceImport: "@tsonic/js/Globals.js",
      });
      const numberBinding = result.value.bindings.getExactBindingByKind(
        "Number",
        "global"
      );
      expect(numberBinding?.kind).to.equal("global");
      expect(numberBinding?.assembly).to.equal("js");
      expect(numberBinding?.sourceImport).to.equal("@tsonic/js/Globals.js");
      expect(numberBinding?.type.startsWith("js.")).to.equal(true);
    } finally {
      fixture.cleanup();
    }
  });
});
