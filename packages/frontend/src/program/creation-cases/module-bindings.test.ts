/**
 * Tests for module binding resolution: node module imports, root-namespace
 * internal remapping, custom surface packages, and source-package loading
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createProgram } from "../creation.js";

describe("Program Creation – module bindings", function () {
  this.timeout(90_000);

  it("should resolve node module imports from package-provided declarations and bindings", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-js-surface-")
    );

    try {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify(
          { name: "app", version: "1.0.0", type: "module" },
          null,
          2
        )
      );

      const srcDir = path.join(tempDir, "src");
      fs.mkdirSync(srcDir, { recursive: true });

      const nodejsRoot = path.join(tempDir, "node_modules/@tsonic/nodejs");
      fs.mkdirSync(nodejsRoot, { recursive: true });
      fs.writeFileSync(
        path.join(nodejsRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/nodejs", version: "0.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(nodejsRoot, "index.d.ts"),
        'declare module "node:fs" { export const readFileSync: (path: string) => string; }\n'
      );
      fs.writeFileSync(
        path.join(nodejsRoot, "index.js"),
        "export const fs = {};\n"
      );
      const nodejsInternalDir = path.join(nodejsRoot, "index");
      fs.mkdirSync(nodejsInternalDir, { recursive: true });
      fs.writeFileSync(
        path.join(nodejsRoot, "bindings.json"),
        JSON.stringify(
          {
            bindings: {
              "node:fs": {
                kind: "module",
                assembly: "nodejs",
                type: "nodejs.fs",
              },
              fs: {
                kind: "module",
                assembly: "nodejs",
                type: "nodejs.fs",
              },
            },
          },
          null,
          2
        )
      );

      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(
        entryPath,
        'import { readFileSync } from "node:fs";\nexport const x = readFileSync("a.txt");\n'
      );

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@tsonic/js",
        typeRoots: ["node_modules/@tsonic/nodejs"],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const nodeFs = result.value.bindings.getBinding("node:fs");
      expect(nodeFs?.kind).to.equal("module");
      if (nodeFs?.kind === "module") {
        expect(nodeFs.type).to.equal("nodejs.fs");
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should resolve module-binding source imports into installed source-package modules", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-module-source-import-")
    );

    try {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify(
          { name: "app", version: "1.0.0", type: "module" },
          null,
          2
        )
      );

      const srcDir = path.join(tempDir, "src");
      fs.mkdirSync(srcDir, { recursive: true });

      const nodejsRoot = path.join(tempDir, "node_modules/@tsonic/nodejs");
      fs.mkdirSync(path.join(nodejsRoot, "tsonic"), { recursive: true });
      fs.mkdirSync(path.join(nodejsRoot, "src", "http"), {
        recursive: true,
      });
      fs.writeFileSync(
        path.join(nodejsRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/nodejs", version: "0.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(nodejsRoot, "bindings.json"),
        JSON.stringify(
          {
            bindings: {
              "node:http": {
                kind: "module",
                assembly: "nodejs",
                type: "nodejs.Http.http",
                sourceImport: "@tsonic/nodejs/http.js",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(nodejsRoot, "tsonic", "package-manifest.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                "./http.js": "./src/http/index.ts",
              },
            },
          },
          null,
          2
        )
      );
      const packageEntry = path.join(nodejsRoot, "src", "http", "index.ts");
      fs.writeFileSync(
        packageEntry,
        "export const createServer = (): number => 42;\n"
      );

      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(
        entryPath,
        'import { createServer } from "node:http";\nexport const value = createServer();\n'
      );

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@tsonic/js",
        typeRoots: ["node_modules/@tsonic/nodejs"],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(result.value.program.getSourceFile(packageEntry)).to.not.equal(
        undefined
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should include source-package entrypoints referenced by global bindings", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-global-source-import-")
    );

    try {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify(
          { name: "app", version: "1.0.0", type: "module" },
          null,
          2
        )
      );

      const srcDir = path.join(tempDir, "src");
      fs.mkdirSync(srcDir, { recursive: true });

      const jsRoot = path.join(tempDir, "node_modules", "@fixture", "js");
      fs.mkdirSync(path.join(jsRoot, "tsonic"), { recursive: true });
      fs.mkdirSync(path.join(jsRoot, "src"), { recursive: true });
      fs.writeFileSync(
        path.join(jsRoot, "package.json"),
        JSON.stringify(
          { name: "@fixture/js", version: "1.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(jsRoot, "index.js"),
        "export {};\n"
      );
      fs.writeFileSync(
        path.join(jsRoot, "index.d.ts"),
        [
          "declare global {",
          "  const console: {",
          "    log(message: string): void;",
          "  };",
          "}",
          "",
          "export {};",
          "",
        ].join("\n")
      );
      fs.writeFileSync(
        path.join(jsRoot, "bindings.json"),
        JSON.stringify(
          {
            bindings: {
              console: {
                kind: "global",
                assembly: "Fixture.JsRuntime",
                type: "Fixture.JsRuntime.console",
                sourceImport: "@fixture/js/console.js",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(jsRoot, "tsonic.surface.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            id: "@fixture/js",
            extends: [],
            requiredTypeRoots: ["."],
            useStandardLib: false,
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(jsRoot, "tsonic", "package-manifest.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@fixture/js"],
            source: {
              exports: {
                "./console.js": "./src/console.ts",
              },
            },
          },
          null,
          2
        )
      );
      const packageEntry = path.join(jsRoot, "src", "console.ts");
      fs.writeFileSync(
        packageEntry,
        "export function log(_message: string): void {}\n"
      );

      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(
        entryPath,
        'export const value = console.log("hello");\n'
      );

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@fixture/js",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(result.value.program.getSourceFile(packageEntry)).to.not.equal(
        undefined
      );
      expect(
        result.value.sourceFiles.some(
          (sourceFile) => path.resolve(sourceFile.fileName) === packageEntry
        )
      ).to.equal(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should remap root-namespace internal imports to package index internals", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-root-namespace-internal-")
    );

    try {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify(
          { name: "app", version: "1.0.0", type: "module" },
          null,
          2
        )
      );

      const srcDir = path.join(tempDir, "src");
      fs.mkdirSync(srcDir, { recursive: true });

      const jsRoot = path.join(tempDir, "node_modules/@tsonic/js-temp");
      fs.mkdirSync(path.join(jsRoot, "index", "internal"), {
        recursive: true,
      });
      fs.writeFileSync(
        path.join(jsRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/js-temp", version: "0.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(jsRoot, "index", "bindings.json"),
        JSON.stringify({ namespace: "Acme.JsRuntime", types: [] }, null, 2)
      );
      fs.writeFileSync(
        path.join(jsRoot, "index", "internal", "index.d.ts"),
        "export interface Date$instance { toISOString(): string; }\nexport type Date = Date$instance;\n"
      );
      fs.writeFileSync(path.join(jsRoot, "index.js"), "export {};\n");

      const nodeRoot = path.join(tempDir, "node_modules/@tsonic/node-temp");
      fs.mkdirSync(path.join(nodeRoot, "index", "internal"), {
        recursive: true,
      });
      fs.writeFileSync(
        path.join(nodeRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/node-temp", version: "0.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(nodeRoot, "index", "bindings.json"),
        JSON.stringify({ namespace: "acme.node", types: [] }, null, 2)
      );
      fs.writeFileSync(
        path.join(nodeRoot, "index", "internal", "index.d.ts"),
        [
          'import type { Date } from "@tsonic/js-temp/Acme.JsRuntime/internal/index.js";',
          "export interface Stats$instance {",
          "  mtime: Date;",
          "}",
          "export type Stats = Stats$instance;",
        ].join("\n")
      );
      fs.writeFileSync(path.join(nodeRoot, "index.js"), "export {};\n");

      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(
        entryPath,
        'import type { Stats } from "@tsonic/node-temp/index/internal/index.js";\nexport type Result = Stats;\n'
      );

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        useStandardLib: true,
        typeRoots: [
          "node_modules/@tsonic/node-temp",
          "node_modules/@tsonic/js-temp",
        ],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(
        result.value.program.getSourceFile(
          path.join(jsRoot, "index", "internal", "index.d.ts")
        )
      ).to.not.equal(undefined);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should include declaration files from custom non-@tsonic surface packages", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-custom-surface-")
    );

    try {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify(
          { name: "app", version: "1.0.0", type: "module" },
          null,
          2
        )
      );

      const srcDir = path.join(tempDir, "src");
      fs.mkdirSync(srcDir, { recursive: true });

      const surfaceRoot = path.join(
        tempDir,
        "node_modules",
        "@acme",
        "surface-web"
      );
      fs.mkdirSync(surfaceRoot, { recursive: true });

      fs.writeFileSync(
        path.join(surfaceRoot, "package.json"),
        JSON.stringify(
          { name: "@acme/surface-web", version: "1.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(surfaceRoot, "tsonic.surface.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            id: "@acme/surface-web",
            extends: [],
            requiredTypeRoots: ["."],
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(surfaceRoot, "index.d.ts"),
        "declare global { interface String { shout(): string; } }\nexport {};\n"
      );
      fs.writeFileSync(path.join(surfaceRoot, "index.js"), "export {};\n");

      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(entryPath, 'export const x = "hello".shout();\n');

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@acme/surface-web",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const expectedDts = path.resolve(path.join(surfaceRoot, "index.d.ts"));
      expect(
        result.value.declarationSourceFiles.some(
          (sf) => path.resolve(sf.fileName) === expectedDts
        )
      ).to.equal(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should load imported source-package modules into the program graph", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-source-package-")
    );

    try {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify(
          { name: "app", version: "1.0.0", type: "module" },
          null,
          2
        )
      );

      const srcDir = path.join(tempDir, "src");
      fs.mkdirSync(srcDir, { recursive: true });

      const packageRoot = path.join(tempDir, "node_modules", "@acme", "math");
      fs.mkdirSync(path.join(packageRoot, "tsonic"), { recursive: true });
      fs.mkdirSync(path.join(packageRoot, "src"), { recursive: true });
      fs.writeFileSync(
        path.join(packageRoot, "package.json"),
        JSON.stringify(
          { name: "@acme/math", version: "1.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(packageRoot, "tsonic", "package-manifest.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                ".": "./src/index.ts",
              },
            },
          },
          null,
          2
        )
      );
      const packageEntry = path.join(packageRoot, "src", "index.ts");
      fs.writeFileSync(
        packageEntry,
        "export function clamp(x: number, min: number, max: number): number { return x < min ? min : x > max ? max : x; }\n"
      );

      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(
        entryPath,
        'import { clamp } from "@acme/math";\nexport const x = clamp(10, 0, 5);\n'
      );

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@tsonic/js",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(result.value.program.getSourceFile(packageEntry)).to.not.equal(
        undefined
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
