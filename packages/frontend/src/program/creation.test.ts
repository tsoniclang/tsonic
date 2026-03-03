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
  it("should enable TypeScript standard lib in js surface mode", () => {
    const options = createCompilerOptions({
      projectRoot: "/tmp/app",
      sourceRoot: "/tmp/app/src",
      rootNamespace: "App",
      surface: "js",
    });

    expect(options.noLib).to.equal(false);
  });

  it("should enable TypeScript standard lib in nodejs surface mode", () => {
    const options = createCompilerOptions({
      projectRoot: "/tmp/app",
      sourceRoot: "/tmp/app/src",
      rootNamespace: "App",
      surface: "nodejs",
    });

    expect(options.noLib).to.equal(false);
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

  it("should support node: module shims in nodejs surface mode", () => {
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
        "export declare const fs: { readFileSync(path: string): string; };\n"
      );
      fs.writeFileSync(
        path.join(nodejsRoot, "index.js"),
        "export const fs = {};\n"
      );

      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(
        entryPath,
        'import { fs } from "node:fs";\nexport const x = fs.readFileSync("a.txt");\n'
      );

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "nodejs",
        typeRoots: [],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(result.value.bindings.getBinding("console")?.kind).to.equal(
        "global"
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
      fs.writeFileSync(path.join(jsRoot, "index.d.ts"), "export {};\n");
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
        surface: "js",
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
});
