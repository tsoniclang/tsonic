/**
 * Tests for program creation
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as ts from "typescript";
import { createCompilerOptions, createProgram } from "./creation.js";

describe("Program Creation", () => {
  it("should keep noLib mode in js surface mode", () => {
    const options = createCompilerOptions({
      projectRoot: "/tmp/app",
      sourceRoot: "/tmp/app/src",
      rootNamespace: "App",
      surface: "@tsonic/js",
    });

    expect(options.noLib).to.equal(true);
  });

  it("should widen rootDir to the nearest common ancestor when sourceRoot is outside projectRoot", () => {
    const tempSourceRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-rootdir-")
    );

    try {
      const projectRoot = path.resolve("/home/jester/repos/tsoniclang/tsonic");
      const options = createCompilerOptions({
        projectRoot,
        sourceRoot: tempSourceRoot,
        rootNamespace: "App",
        surface: "@tsonic/js",
      });

      expect(typeof options.rootDir).to.equal("string");
      if (typeof options.rootDir !== "string") return;

      const relativeToProject = path.relative(options.rootDir, projectRoot);
      const relativeToSource = path.relative(options.rootDir, tempSourceRoot);
      expect(relativeToProject.startsWith("..")).to.equal(false);
      expect(path.isAbsolute(relativeToProject)).to.equal(false);
      expect(relativeToSource.startsWith("..")).to.equal(false);
      expect(path.isAbsolute(relativeToSource)).to.equal(false);
    } finally {
      fs.rmSync(tempSourceRoot, { recursive: true, force: true });
    }
  });

  it("should widen rootDir to the workspace node_modules root for installed source packages", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-rootdir-node-modules-")
    );

    try {
      const projectRoot = path.join(tempDir, "packages", "app");
      const sourceRoot = path.join(projectRoot, "src");
      fs.mkdirSync(path.join(tempDir, "node_modules"), { recursive: true });
      fs.mkdirSync(sourceRoot, { recursive: true });

      const options = createCompilerOptions({
        projectRoot,
        sourceRoot,
        rootNamespace: "App",
        surface: "@tsonic/js",
      });

      expect(typeof options.rootDir).to.equal("string");
      if (typeof options.rootDir !== "string") return;
      expect(path.resolve(options.rootDir)).to.equal(path.resolve(tempDir));
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should allow mutable array index writes in clr surface mode", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-clr-array-write-")
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
      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(
        entryPath,
        [
          "const values: number[] = [1, 2, 3];",
          "values[0] = 42;",
          "export const first = values[0];",
        ].join("\n")
      );

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
      });

      expect(result.ok).to.equal(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should resolve project-local @tsonic/* imports when no authoritative package exists", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-creation-")
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

      const fakePkgRoot = path.join(tempDir, "node_modules/@tsonic/custom");
      fs.mkdirSync(fakePkgRoot, { recursive: true });
      fs.writeFileSync(
        path.join(fakePkgRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/custom", version: "0.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(fakePkgRoot, "System.d.ts"),
        "export const Marker: unique symbol;\n"
      );
      fs.writeFileSync(
        path.join(fakePkgRoot, "System.js"),
        "export const Marker = Symbol('marker');\n"
      );

      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(
        entryPath,
        'import { Marker } from "@tsonic/custom/System.js";\nexport const ok = Marker;\n'
      );

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        useStandardLib: true,
        typeRoots: [],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const expectedDts = path.resolve(path.join(fakePkgRoot, "System.d.ts"));
      expect(result.value.program.getSourceFile(expectedDts)).to.not.equal(
        undefined
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

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

  it("should load js-surface extension bindings without explicit typeRoots", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-js-extensions-")
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

      const jsRoot = path.join(tempDir, "node_modules/@tsonic/js");
      fs.mkdirSync(path.join(jsRoot, "index"), { recursive: true });
      fs.writeFileSync(
        path.join(jsRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/js", version: "0.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(jsRoot, "index.d.ts"),
        "declare global { interface String { trim(): string; } }\nexport {};\n"
      );
      fs.writeFileSync(path.join(jsRoot, "index.js"), "export {};\n");
      fs.writeFileSync(
        path.join(jsRoot, "tsonic.surface.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            id: "@tsonic/js",
            extends: [],
            requiredTypeRoots: ["."],
            useStandardLib: false,
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(jsRoot, "index", "bindings.json"),
        JSON.stringify(
          {
            namespace: "Tsonic.JSRuntime",
            types: [
              {
                clrName: "Tsonic.JSRuntime.String",
                assemblyName: "Tsonic.JSRuntime",
                methods: [
                  {
                    clrName: "trim",
                    normalizedSignature:
                      "trim|(System.String):System.String|static=true",
                    parameterCount: 1,
                    declaringClrType: "Tsonic.JSRuntime.String",
                    declaringAssemblyName: "Tsonic.JSRuntime",
                    isExtensionMethod: true,
                  },
                ],
                properties: [],
                fields: [],
              },
            ],
          },
          null,
          2
        )
      );

      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(entryPath, 'export const x = "  hi  ".trim();\n');

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
          "Tsonic_JSRuntime",
          "String",
          "trim",
          0
        )
      ).to.not.equal(undefined);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should keep @tsonic module type queries on the authoritative typeRoot package graph", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-node-authoritative-")
    );

    try {
      const authoritativeRoot = path.resolve(
        process.cwd(),
        "../../../nodejs/versions/10"
      );
      expect(
        fs.existsSync(path.join(authoritativeRoot, "package.json"))
      ).to.equal(true);

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

      const projectNodejsRoot = path.join(
        tempDir,
        "node_modules/@tsonic/nodejs"
      );
      fs.mkdirSync(projectNodejsRoot, { recursive: true });
      fs.writeFileSync(
        path.join(projectNodejsRoot, "package.json"),
        JSON.stringify(
          {
            name: "@tsonic/nodejs",
            version: "9.9.9",
            type: "module",
            types: "./index.d.ts",
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(projectNodejsRoot, "index.js"),
        "export {};\n"
      );
      fs.writeFileSync(
        path.join(projectNodejsRoot, "index.d.ts"),
        [
          '/// <reference path="./node-aliases.d.ts" />',
          "export declare const path: {",
          "  join(...parts: string[]): any;",
          "};",
          "export declare const process: {",
          "  cwd(): any;",
          "};",
        ].join("\n")
      );
      fs.writeFileSync(
        path.join(projectNodejsRoot, "node-aliases.d.ts"),
        [
          'declare module "node:path" {',
          '  export { path } from "@tsonic/nodejs/index.js";',
          '  export const join: typeof import("@tsonic/nodejs/index.js").path.join;',
          "}",
          'declare module "node:process" {',
          '  export { process } from "@tsonic/nodejs/index.js";',
          '  export const cwd: typeof import("@tsonic/nodejs/index.js").process.cwd;',
          "}",
          "export {};",
        ].join("\n")
      );

      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(
        entryPath,
        [
          'import * as path from "node:path";',
          'import * as process from "node:process";',
          'export const joined = path.join("a", "b");',
          "export const cwd = process.cwd();",
        ].join("\n")
      );

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@tsonic/js",
        typeRoots: [authoritativeRoot],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const sourceFile = result.value.program.getSourceFile(entryPath);
      expect(sourceFile).to.not.equal(undefined);
      if (!sourceFile) return;

      const checker = result.value.program.getTypeChecker();
      const returnTypes = new Map<string, string>();
      const declarationFlags = new Map<string, boolean>();

      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression)
        ) {
          const callee = node.expression.getText(sourceFile);
          if (callee === "path.join" || callee === "process.cwd") {
            const signature = checker.getResolvedSignature(node);
            returnTypes.set(
              callee,
              checker.typeToString(checker.getTypeAtLocation(node))
            );
            declarationFlags.set(callee, signature?.declaration !== undefined);
          }
        }
        ts.forEachChild(node, visit);
      };

      visit(sourceFile);

      expect(returnTypes.get("path.join")).to.equal("string");
      expect(returnTypes.get("process.cwd")).to.equal("string");
      expect(declarationFlags.get("path.join")).to.equal(true);
      expect(declarationFlags.get("process.cwd")).to.equal(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should keep direct @tsonic imports on the authoritative package graph", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-direct-authoritative-")
    );

    try {
      const authoritativeRoot = path.resolve(
        process.cwd(),
        "../../../nodejs/versions/10"
      );
      expect(
        fs.existsSync(path.join(authoritativeRoot, "package.json"))
      ).to.equal(true);

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

      const projectNodejsRoot = path.join(
        tempDir,
        "node_modules/@tsonic/nodejs"
      );
      fs.mkdirSync(projectNodejsRoot, { recursive: true });
      fs.writeFileSync(
        path.join(projectNodejsRoot, "package.json"),
        JSON.stringify(
          {
            name: "@tsonic/nodejs",
            version: "9.9.9",
            type: "module",
            types: "./index.d.ts",
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(projectNodejsRoot, "index.js"),
        "export {};\n"
      );
      fs.writeFileSync(
        path.join(projectNodejsRoot, "index.d.ts"),
        [
          "export declare const path: {",
          "  join(...parts: string[]): any;",
          "};",
          "export declare const process: {",
          "  cwd(): any;",
          "};",
        ].join("\n")
      );

      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(
        entryPath,
        [
          'import { path, process } from "@tsonic/nodejs/index.js";',
          'export const joined = path.join("a", "b");',
          "export const cwd = process.cwd();",
        ].join("\n")
      );

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@tsonic/js",
        typeRoots: [authoritativeRoot],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const sourceFile = result.value.program.getSourceFile(entryPath);
      expect(sourceFile).to.not.equal(undefined);
      if (!sourceFile) return;

      const checker = result.value.program.getTypeChecker();
      const returnTypes = new Map<string, string>();
      const declarationFlags = new Map<string, boolean>();

      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression)
        ) {
          const callee = node.expression.getText(sourceFile);
          if (callee === "path.join" || callee === "process.cwd") {
            const signature = checker.getResolvedSignature(node);
            returnTypes.set(
              callee,
              checker.typeToString(checker.getTypeAtLocation(node))
            );
            declarationFlags.set(callee, signature?.declaration !== undefined);
          }
        }
        ts.forEachChild(node, visit);
      };

      visit(sourceFile);

      expect(returnTypes.get("path.join")).to.equal("string");
      expect(returnTypes.get("process.cwd")).to.equal("string");
      expect(declarationFlags.get("path.join")).to.equal(true);
      expect(declarationFlags.get("process.cwd")).to.equal(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should typecheck package-provided js globals in noLib mode", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-js-globals-")
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
      const jsRoot = path.join(tempDir, "node_modules/@tsonic/js");
      fs.mkdirSync(jsRoot, { recursive: true });
      fs.writeFileSync(
        path.join(jsRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/js", version: "0.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(jsRoot, "index.d.ts"),
        `
declare global {
  interface String {
    trim(): string;
    toUpperCase(): string;
    includes(search: string): boolean;
  }

  interface Array<T> {
    readonly length: number;
    map<TResult>(callback: (value: T) => TResult): TResult[];
    filter(callback: (value: T) => boolean): T[];
    reduce<TResult>(
      callback: (previousValue: TResult, currentValue: T) => TResult,
      initialValue: TResult
    ): TResult;
    join(separator?: string): string;
  }

  const console: {
    log(...data: unknown[]): void;
  };

  function parseInt(value: string): number;
}

export {};
`
      );
      fs.writeFileSync(
        path.join(jsRoot, "tsonic.surface.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            id: "@tsonic/js",
            extends: [],
            requiredTypeRoots: ["."],
            useStandardLib: false,
          },
          null,
          2
        )
      );

      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(
        entryPath,
        [
          'const m = "  hi  ".trim().toUpperCase();',
          'const hasNeedle = m.includes("H");',
          "const nums = [1, 2, 3, 4];",
          "const doubled = nums.map((x) => x * 2);",
          "const filtered = doubled.filter((x) => x > 2);",
          "const total = filtered.reduce((a, b) => a + b, 0);",
          "console.log(hasNeedle);",
          'console.log(nums.length, doubled.join(","), total, m);',
          'export const ok = parseInt("42");',
        ].join("\n")
      );

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@tsonic/js",
      });

      expect(result.ok).to.equal(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should load root-level global function bindings from a generic surface package", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-generic-surface-globals-")
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

      const surfaceRoot = path.join(tempDir, "node_modules/@fixture/js");
      fs.mkdirSync(surfaceRoot, { recursive: true });
      fs.writeFileSync(
        path.join(surfaceRoot, "package.json"),
        JSON.stringify(
          { name: "@fixture/js", version: "1.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(path.join(surfaceRoot, "index.js"), "export {};\n");
      fs.writeFileSync(
        path.join(surfaceRoot, "index.d.ts"),
        [
          'import type { int, long } from "@tsonic/core/types.js";',
          "",
          "declare global {",
          "  const console: {",
          "    log(...data: unknown[]): void;",
          "  };",
          "",
          "  function parseInt(str: string, radix?: int): long | undefined;",
          "  function setInterval(handler: (...args: unknown[]) => void, timeout?: int, ...args: unknown[]): int;",
          "  function clearInterval(id: int): void;",
          "}",
          "",
          "export {};",
          "",
        ].join("\n")
      );
      fs.writeFileSync(
        path.join(surfaceRoot, "bindings.json"),
        JSON.stringify(
          {
            bindings: {
              console: {
                kind: "global",
                assembly: "Tsonic.JSRuntime",
                type: "Tsonic.JSRuntime.console",
              },
              parseInt: {
                kind: "global",
                assembly: "Tsonic.JSRuntime",
                type: "Tsonic.JSRuntime.Globals",
                csharpName: "Globals.parseInt",
              },
              setInterval: {
                kind: "global",
                assembly: "Tsonic.JSRuntime",
                type: "Tsonic.JSRuntime.Timers",
                csharpName: "Timers.setInterval",
              },
              clearInterval: {
                kind: "global",
                assembly: "Tsonic.JSRuntime",
                type: "Tsonic.JSRuntime.Timers",
                csharpName: "Timers.clearInterval",
              },
            },
          },
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

      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(
        entryPath,
        [
          'const parsed = parseInt("42", 10);',
          "const timerId = setInterval(() => {}, 1000);",
          "clearInterval(timerId);",
          "console.log(parsed);",
        ].join("\n")
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

      expect(result.value.bindings.getBinding("console")).to.deep.equal({
        kind: "global",
        assembly: "Tsonic.JSRuntime",
        type: "Tsonic.JSRuntime.console",
      });
      expect(result.value.bindings.getBinding("parseInt")).to.deep.equal({
        kind: "global",
        assembly: "Tsonic.JSRuntime",
        type: "Tsonic.JSRuntime.Globals",
        csharpName: "Globals.parseInt",
      });
      expect(result.value.bindings.getBinding("setInterval")).to.deep.equal({
        kind: "global",
        assembly: "Tsonic.JSRuntime",
        type: "Tsonic.JSRuntime.Timers",
        csharpName: "Timers.setInterval",
      });
      expect(result.value.bindings.getBinding("clearInterval")).to.deep.equal({
        kind: "global",
        assembly: "Tsonic.JSRuntime",
        type: "Tsonic.JSRuntime.Timers",
        csharpName: "Timers.clearInterval",
      });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should provide string index access from compiler-owned core globals", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-core-string-index-")
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

      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(
        entryPath,
        [
          'const source = "abc";',
          "const first = source[0];",
          "export const ok = first;",
        ].join("\n")
      );

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
      });

      expect(result.ok).to.equal(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should typecheck core IArguments.length in noLib mode", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-core-iarguments-")
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
      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(
        entryPath,
        [
          "export function count(x: number, y: number): number {",
          "  return arguments.length + x + y;",
          "}",
        ].join("\n")
      );

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
      });

      expect(result.ok).to.equal(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should typecheck core IArguments index access in noLib mode", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-core-iarguments-index-")
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
      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(
        entryPath,
        [
          "export function first(x: number, y: number): number {",
          "  return (arguments[0] as number) + y;",
          "}",
        ].join("\n")
      );

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
      });

      expect(result.ok).to.equal(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should keep JS surface free of CLR string members", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-js-no-clr-")
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

      const jsRoot = path.join(tempDir, "node_modules/@tsonic/js");
      fs.mkdirSync(jsRoot, { recursive: true });
      fs.writeFileSync(
        path.join(jsRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/js", version: "0.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(jsRoot, "index.d.ts"),
        "declare global { interface String { trim(): string; } }\nexport {};\n"
      );
      fs.writeFileSync(path.join(jsRoot, "index.js"), "export {};\n");
      fs.writeFileSync(
        path.join(jsRoot, "tsonic.surface.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            id: "@tsonic/js",
            extends: [],
            requiredTypeRoots: ["."],
            useStandardLib: false,
          },
          null,
          2
        )
      );

      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(entryPath, 'export const bad = "  hi  ".Trim();\n');

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@tsonic/js",
      });

      expect(result.ok).to.equal(false);
      if (result.ok) return;
      expect(result.error.hasErrors).to.equal(true);
      expect(
        result.error.diagnostics.some((diagnostic) =>
          diagnostic.message.includes("Property 'Trim' does not exist")
        )
      ).to.equal(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should expose Array.from and RangeError on js surface", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-js-array-from-")
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

      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(
        entryPath,
        [
          'const chars = Array.from("abc");',
          'const err = new RangeError("bad range");',
          'export const ok = chars.join("") + err.message;',
        ].join("\n")
      );

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@tsonic/js",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;
      expect(result.value.bindings.getBinding("Array")?.staticType).to.equal(
        "Tsonic.JSRuntime.JSArrayStatics"
      );
      expect(result.value.bindings.getBinding("Error")?.type).to.equal(
        "Tsonic.JSRuntime.Error"
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should expose js array mutators and numeric instance helpers on js surface", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-js-array-number-")
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

      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(
        entryPath,
        [
          "const xs = [1, 2];",
          "xs.push(3);",
          "const text = (42).toString();",
          "const other = Array.of(1, 2, 3);",
          "export const ok = Array.isArray(other) ? text + xs.join(',') : text;",
        ].join("\n")
      );

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@tsonic/js",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;
      expect(result.value.bindings.getBinding("Array")?.staticType).to.equal(
        "Tsonic.JSRuntime.JSArrayStatics"
      );
      expect(result.value.bindings.getBinding("Number")?.type).to.equal(
        "Tsonic.JSRuntime.Number"
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should keep RangeError out of clr surface", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-clr-no-rangeerror-")
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

      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(
        entryPath,
        'export const bad = new RangeError("not clr");\n'
      );

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "clr",
      });

      expect(result.ok).to.equal(false);
      if (result.ok) return;
      expect(
        result.error.diagnostics.some((diagnostic) =>
          diagnostic.message.includes("Cannot find name 'RangeError'")
        )
      ).to.equal(true);

      const errorEntryPath = path.join(srcDir, "error.ts");
      fs.writeFileSync(
        errorEntryPath,
        'export const err = new Error("core error");\n'
      );

      const okResult = createProgram([errorEntryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "clr",
      });

      expect(okResult.ok).to.equal(true);
      if (!okResult.ok) return;
      expect(okResult.value.bindings.getBinding("Error")?.type).to.equal(
        "System.Exception"
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should expose CLR string members on clr surface via @tsonic/globals", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-clr-members-")
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

      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(entryPath, 'export const ok = "  hi  ".Trim();\n');

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "clr",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;
      expect(
        result.value.declarationSourceFiles.some((sourceFile) =>
          sourceFile.fileName.endsWith("__clr_globals__.d.ts")
        )
      ).to.equal(false);
      expect(
        result.value.declarationSourceFiles.some(
          (sourceFile) =>
            sourceFile.fileName.includes("@tsonic/globals") ||
            /[/\\]globals[/\\]versions[/\\]\d+[/\\]index\.d\.ts$/.test(
              sourceFile.fileName
            )
        )
      ).to.equal(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
