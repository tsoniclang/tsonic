/**
 * Tests for JS surface global type resolution: extension bindings,
 * noLib-mode globals, instanceof narrowing, and generic surface globals
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createProgram } from "../creation.js";

describe("Program Creation – JS surface globals", function () {
  this.timeout(90_000);

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
            namespace: "js",
            types: [
              {
                clrName: "js.String",
                assemblyName: "js",
                methods: [
                  {
                    clrName: "trim",
                    normalizedSignature:
                      "trim|(System.String):System.String|static=true",
                    parameterCount: 1,
                    declaringClrType: "js.String",
                    declaringAssemblyName: "js",
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
          "js",
          "String",
          "trim",
          0
        )
      ).to.not.equal(undefined);
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

  it("should preserve instanceof narrowing for JS global constructors loaded through surface typeRoots", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-js-instanceof-")
    );

    try {
      const authoritativeRoot = path.resolve(
        process.cwd(),
        "../../../js/versions/10"
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

      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(
        entryPath,
        [
          "declare function takesString(value: string): void;",
          "",
          "export function bytes(body: string | Uint8Array): number {",
          "  if (body instanceof Uint8Array) {",
          "    return body.length;",
          "  }",
          "  takesString(body);",
          "  return body.length;",
          "}",
          "",
          "export function arrays(value: string | string[]): number {",
          "  if (value instanceof Array) {",
          "    return value.length;",
          "  }",
          "  takesString(value);",
          "  return value.length;",
          "}",
          "",
          "export function dates(value: string | Date): number {",
          "  if (value instanceof Date) {",
          "    return 1;",
          "  }",
          "  takesString(value);",
          "  return value.length;",
          "}",
          "",
          "export function regexps(value: string | RegExp): boolean {",
          "  if (value instanceof RegExp) {",
          "    return value.test('ok');",
          "  }",
          "  takesString(value);",
          "  return value.length > 0;",
          "}",
          "",
          "export function maps(value: string | Map<string, string>): number {",
          "  if (value instanceof Map) {",
          "    return value.size;",
          "  }",
          "  takesString(value);",
          "  return value.length;",
          "}",
          "",
          "export function sets(value: string | Set<string>): number {",
          "  if (value instanceof Set) {",
          "    return value.size;",
          "  }",
          "  takesString(value);",
          "  return value.length;",
          "}",
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
                assembly: "js",
                type: "js.console",
              },
              parseInt: {
                kind: "global",
                assembly: "js",
                type: "js.Globals",
                csharpName: "Globals.parseInt",
              },
              setInterval: {
                kind: "global",
                assembly: "js",
                type: "js.Timers",
                csharpName: "Timers.setInterval",
              },
              clearInterval: {
                kind: "global",
                assembly: "js",
                type: "js.Timers",
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
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
