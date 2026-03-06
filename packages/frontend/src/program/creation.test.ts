/**
 * Tests for program creation
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
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

  it("should keep noLib mode in nodejs surface mode", () => {
    const options = createCompilerOptions({
      projectRoot: "/tmp/app",
      sourceRoot: "/tmp/app/src",
      rootNamespace: "App",
      surface: "@tsonic/nodejs",
    });

    expect(options.noLib).to.equal(true);
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

  it("should resolve @tsonic/* imports from the project root (global install)", () => {
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

      const fakeDotnetRoot = path.join(tempDir, "node_modules/@tsonic/dotnet");
      fs.mkdirSync(fakeDotnetRoot, { recursive: true });
      fs.writeFileSync(
        path.join(fakeDotnetRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/dotnet", version: "0.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(fakeDotnetRoot, "System.d.ts"),
        "export const Marker: unique symbol;\n"
      );
      fs.writeFileSync(
        path.join(fakeDotnetRoot, "System.js"),
        "export const Marker = Symbol('marker');\n"
      );

      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(
        entryPath,
        'import { Marker } from "@tsonic/dotnet/System.js";\nexport const ok = Marker;\n'
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

      const expectedDts = path.resolve(
        path.join(fakeDotnetRoot, "System.d.ts")
      );
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
        surface: "@tsonic/nodejs",
        typeRoots: [],
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
