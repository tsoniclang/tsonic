/**
 * Tests for module binding resolution: node module imports, root-namespace
 * internal remapping, custom surface packages, and source-package loading
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import ts from "typescript";
import { createProgram } from "../creation.js";

const writeFixtureJsSurface = (
  tempDir: string,
  exportEntries: Record<string, string>,
  sourceFiles: Readonly<Record<string, string>>,
  ambientSource = "export {};\n"
): string => {
  const surfaceRoot = path.join(tempDir, "node_modules", "@fixture", "js");
  fs.mkdirSync(path.join(surfaceRoot, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(surfaceRoot, "package.json"),
    JSON.stringify(
      { name: "@fixture/js", version: "1.0.0", type: "module" },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(surfaceRoot, "tsonic.surface.json"),
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
  fs.writeFileSync(path.join(surfaceRoot, "globals.ts"), ambientSource);
  fs.writeFileSync(
    path.join(surfaceRoot, "tsonic.package.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        kind: "tsonic-source-package",
        surfaces: ["@fixture/js"],
        source: {
          namespace: "fixture.js",
          ambient: ["./globals.ts"],
          exports: exportEntries,
        },
      },
      null,
      2
    )
  );

  for (const [relativePath, contents] of Object.entries(sourceFiles)) {
    const absolutePath = path.join(surfaceRoot, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, contents);
  }

  return surfaceRoot;
};

describe("Program Creation – module bindings", function () {
  this.timeout(90_000);

  it("should resolve node module imports from installed source-package module aliases", () => {
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
      writeFixtureJsSurface(
        tempDir,
        {
          "./Globals.js": "./src/Globals.ts",
        },
        {
          "src/Globals.ts": "export const noop = 0;\n",
        }
      );

      const nodejsRoot = path.join(tempDir, "node_modules/@tsonic/nodejs");
      fs.mkdirSync(path.join(nodejsRoot, "src"), { recursive: true });
      fs.writeFileSync(
        path.join(nodejsRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/nodejs", version: "0.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(nodejsRoot, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@fixture/js"],
            source: {
              namespace: "nodejs",
              moduleAliases: {
                "node:fs": "./fs.js",
              },
              exports: {
                "./fs.js": "./src/fs.ts",
              },
            },
          },
          null,
          2
        )
      );
      const packageEntry = path.join(nodejsRoot, "src", "fs.ts");
      fs.writeFileSync(
        packageEntry,
        'export const readFileSync = (filePath: string): string => filePath;\n'
      );
      const typesRoot = path.join(tempDir, "node_modules", "@types", "node");
      fs.mkdirSync(typesRoot, { recursive: true });
      fs.writeFileSync(
        path.join(typesRoot, "fs.d.ts"),
        [
          'declare module "node:fs" {',
          "  export const readFileSync: (filePath: string) => number;",
          "}",
        ].join("\n")
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
        surface: "@fixture/js",
        typeRoots: ["node_modules/@tsonic/nodejs"],
        useStandardLib: false,
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(result.value.program.getSourceFile(packageEntry)).to.not.equal(
        undefined
      );
      const sourceFile = result.value.program.getSourceFile(entryPath);
      expect(sourceFile).to.not.equal(undefined);
      if (!sourceFile) return;

      const importDecl = sourceFile.statements.find(
        (stmt): stmt is ts.ImportDeclaration =>
          ts.isImportDeclaration(stmt) &&
          ts.isStringLiteral(stmt.moduleSpecifier) &&
          stmt.moduleSpecifier.text === "node:fs"
      );
      expect(importDecl).to.not.equal(undefined);
      if (!importDecl?.importClause?.namedBindings) return;
      expect(ts.isNamedImports(importDecl.importClause.namedBindings)).to.equal(
        true
      );
      if (!ts.isNamedImports(importDecl.importClause.namedBindings)) return;

      const importSpecifier = importDecl.importClause.namedBindings.elements.find(
        (element) => element.name.text === "readFileSync"
      );
      expect(importSpecifier).to.not.equal(undefined);
      if (!importSpecifier) return;

      const checker = result.value.program.getTypeChecker();
      const importSymbol = checker.getSymbolAtLocation(importSpecifier.name);
      expect(importSymbol).to.not.equal(undefined);
      if (!importSymbol) return;

      const aliasedSymbol =
        importSymbol.flags & ts.SymbolFlags.Alias
          ? checker.getAliasedSymbol(importSymbol)
          : importSymbol;
      const declarationFiles = (aliasedSymbol.getDeclarations() ?? []).map(
        (declaration) => path.resolve(declaration.getSourceFile().fileName)
      );
      expect(declarationFiles).to.include(path.resolve(packageEntry));

      const moduleResolutionErrors = result.value.program
        .getSemanticDiagnostics()
        .filter((diagnostic) => diagnostic.code === 2307);
      expect(moduleResolutionErrors).to.deep.equal([]);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should resolve declaration-module aliases into installed source-package modules", () => {
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
      writeFixtureJsSurface(
        tempDir,
        {
          "./Globals.js": "./src/Globals.ts",
        },
        {
          "src/Globals.ts": "export const noop = 0;\n",
        }
      );

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
        path.join(nodejsRoot, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@fixture/js"],
            source: {
              namespace: "nodejs",
              moduleAliases: {
                "node:http": "./http.js",
              },
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
        surface: "@fixture/js",
        typeRoots: ["node_modules/@tsonic/nodejs"],
        useStandardLib: false,
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
      const moduleResolutionErrors = result.value.program
        .getSemanticDiagnostics()
        .filter((diagnostic) => diagnostic.code === 2307);
      expect(moduleResolutionErrors).to.deep.equal([]);
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
        path.join(jsRoot, "globals.ts"),
        [
          "declare global {",
          '  const console: typeof import("./src/console.js").console;',
          "}",
          "",
          "export {};",
          "",
        ].join("\n")
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
        path.join(jsRoot, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@fixture/js"],
            source: {
              namespace: "fixture.js",
              ambient: ["./globals.ts"],
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
        [
          "export abstract class console {",
          "  public static log(_message: string): void {}",
          "}",
        ].join("\n")
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
        JSON.stringify({ namespace: "Acme.Js", types: [] }, null, 2)
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
          'import type { Date } from "@tsonic/js-temp/Acme.Js/internal/index.js";',
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
      writeFixtureJsSurface(
        tempDir,
        {
          "./Globals.js": "./src/Globals.ts",
        },
        {
          "src/Globals.ts": "export const noop = 0;\n",
        }
      );

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
        path.join(packageRoot, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@fixture/js"],
            source: {
              namespace: "acme.math",
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
        surface: "@fixture/js",
        useStandardLib: false,
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

  it("dedupes global source-package ambient files when a workspace-installed surface resolves through an ancestor node_modules", () => {
    const workspaceRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-global-source-dedupe-")
    );
    const projectRoot = path.join(workspaceRoot, "packages", "app");
    const externalRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-global-source-pkg-")
    );

    try {
      fs.mkdirSync(projectRoot, { recursive: true });
      fs.writeFileSync(
        path.join(workspaceRoot, "package.json"),
        JSON.stringify(
          {
            name: "workspace",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(projectRoot, "package.json"),
        JSON.stringify(
          { name: "app", version: "1.0.0", private: true, type: "module" },
          null,
          2
        )
      );

      const srcDir = path.join(projectRoot, "src");
      fs.mkdirSync(srcDir, { recursive: true });
      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(
        entryPath,
        'export const value = console.log("hello");\n'
      );

      fs.mkdirSync(path.join(externalRoot, "tsonic"), { recursive: true });
      fs.mkdirSync(path.join(externalRoot, "src"), { recursive: true });
      fs.writeFileSync(
        path.join(externalRoot, "package.json"),
        JSON.stringify(
          { name: "@fixture/js", version: "1.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(path.join(externalRoot, "index.js"), "export {};\n");
      fs.writeFileSync(
        path.join(externalRoot, "globals.ts"),
        [
          "declare global {",
          '  const console: typeof import("./src/console.js").console;',
          "}",
          "",
          "export {};",
          "",
        ].join("\n")
      );
      fs.writeFileSync(
        path.join(externalRoot, "tsonic.surface.json"),
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
        path.join(externalRoot, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@fixture/js"],
            source: {
              ambient: ["./globals.ts"],
              exports: {
                "./console.js": "./src/console.ts",
              },
            },
          },
          null,
          2
        )
      );
      const consolePath = path.join(externalRoot, "src", "console.ts");
      fs.writeFileSync(
        consolePath,
        "export function log(message: string): void { void message; }\n"
      );

      const scopeRoot = path.join(workspaceRoot, "node_modules", "@fixture");
      fs.mkdirSync(scopeRoot, { recursive: true });
      fs.symlinkSync(externalRoot, path.join(scopeRoot, "js"), "dir");

      const result = createProgram([entryPath, consolePath], {
        projectRoot,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@fixture/js",
        typeRoots: [externalRoot],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const consoleSourceFiles = result.value.sourceFiles.filter(
        (sf) => {
          try {
            return fs.realpathSync(sf.fileName) === fs.realpathSync(consolePath);
          } catch {
            return false;
          }
        }
      );
      expect(consoleSourceFiles).to.have.lengthOf(1);
    } finally {
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
      fs.rmSync(externalRoot, { recursive: true, force: true });
    }
  });
});
