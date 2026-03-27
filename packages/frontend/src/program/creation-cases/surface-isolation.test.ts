/**
 * Tests for surface isolation: CLR vs JS surface member visibility,
 * Array.from/RangeError exposure, array mutators, and CLR string members
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { buildIrModule } from "../../ir/builder.js";
import { createProgramContext } from "../../ir/program-context-factory.js";
import { validateIrSoundness } from "../../ir/validation/index.js";
import { createProgram } from "../creation.js";

const installMinimalJsSurface = (projectRoot: string): void => {
  const jsRoot = path.join(projectRoot, "node_modules", "@tsonic", "js");

  fs.mkdirSync(jsRoot, { recursive: true });

  fs.writeFileSync(
    path.join(jsRoot, "package.json"),
    JSON.stringify(
      {
        name: "@tsonic/js",
        version: "0.0.0",
        type: "module",
      },
      null,
      2
    )
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
    path.join(jsRoot, "index.d.ts"),
    [
      "declare global {",
      "  interface String {",
      "    trim(): string;",
      "    join(separator?: string): string;",
      "  }",
      "  interface Number {",
      "    toString(radix?: int): string;",
      "  }",
      "  interface Array<T> {",
      "    readonly length: int;",
      "    push(...items: T[]): int;",
      "    join(separator?: string): string;",
      "  }",
      "  interface Error {",
      "    message: string;",
      "  }",
      "  interface ErrorConstructor {",
      "    readonly prototype: Error;",
      "    new(message?: string): Error;",
      "  }",
      "  interface RangeError extends Error {}",
      "  interface RangeErrorConstructor {",
      "    readonly prototype: RangeError;",
      "    new(message?: string): RangeError;",
      "  }",
      "  interface ArrayConstructor {",
      "    readonly prototype: unknown[];",
      "    new<T>(...items: T[]): T[];",
      "    of<T>(...items: T[]): T[];",
      "    from(source: string): string[];",
      "    isArray(value: unknown): value is readonly unknown[] | unknown[];",
      "  }",
      "  const Array: ArrayConstructor;",
      "  const Error: ErrorConstructor;",
      "  const RangeError: RangeErrorConstructor;",
      "}",
      "export {};",
      "",
    ].join("\n")
  );
};

const installMinimalClrSurface = (projectRoot: string): void => {
  const globalsRoot = path.join(projectRoot, "node_modules", "@tsonic", "globals");

  fs.mkdirSync(globalsRoot, { recursive: true });

  fs.writeFileSync(
    path.join(globalsRoot, "package.json"),
    JSON.stringify(
      {
        name: "@tsonic/globals",
        version: "0.0.0",
        type: "module",
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(globalsRoot, "tsonic.surface.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        id: "clr",
        extends: [],
        requiredTypeRoots: ["."],
        useStandardLib: false,
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(globalsRoot, "tsonic.bindings.json"),
    JSON.stringify(
      {
        bindingVersion: 1,
        packageName: "@tsonic/globals",
        packageVersion: "0.0.0",
        surfaceMode: "clr",
        requiredTypeRoots: ["."],
        runtimePackages: ["@tsonic/globals"],
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(globalsRoot, "index.d.ts"),
    [
      "declare global {",
      "  interface String {",
      "    Trim(): string;",
      "  }",
      "  interface Error {",
      "    message: string;",
      "  }",
      "  interface ErrorConstructor {",
      "    readonly prototype: Error;",
      "    new(message?: string): Error;",
      "  }",
      "  const Error: ErrorConstructor;",
      "}",
      "export {};",
      "",
    ].join("\n")
  );
  fs.writeFileSync(
    path.join(globalsRoot, "bindings.json"),
    JSON.stringify(
      {
        bindings: {
          Error: {
            kind: "global",
            assembly: "System.Runtime",
            type: "System.Exception",
          },
        },
      },
      null,
      2
    )
  );
};

describe("Program Creation – surface isolation", function () {
  this.timeout(90_000);

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
      installMinimalJsSurface(tempDir);

      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(entryPath, 'export const bad = "  hi  ".Trim();\n');

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@tsonic/js",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const sourceFile = result.value.sourceFiles.find(
        (candidate) => candidate.fileName === entryPath
      );
      expect(sourceFile).to.not.equal(undefined);
      if (!sourceFile) return;

      const ctx = createProgramContext(result.value, {
        sourceRoot: srcDir,
        rootNamespace: "Test",
      });
      const moduleResult = buildIrModule(
        sourceFile,
        result.value,
        {
          sourceRoot: srcDir,
          rootNamespace: "Test",
        },
        ctx
      );

      expect(moduleResult.ok).to.equal(true);
      if (!moduleResult.ok) return;
      const soundness = validateIrSoundness([moduleResult.value]);
      expect(soundness.ok).to.equal(false);
      expect(
        soundness.diagnostics.some((diagnostic) =>
          diagnostic.code === "TSN5203" &&
          diagnostic.message.includes("Trim")
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
      installMinimalJsSurface(tempDir);

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
      installMinimalJsSurface(tempDir);

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
      installMinimalClrSurface(tempDir);

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

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const sourceFile = result.value.sourceFiles.find(
        (candidate) => candidate.fileName === entryPath
      );
      expect(sourceFile).to.not.equal(undefined);
      if (!sourceFile) return;

      const ctx = createProgramContext(result.value, {
        sourceRoot: srcDir,
        rootNamespace: "Test",
      });
      const moduleResult = buildIrModule(
        sourceFile,
        result.value,
        {
          sourceRoot: srcDir,
          rootNamespace: "Test",
        },
        ctx
      );

      expect(moduleResult.ok).to.equal(true);
      if (!moduleResult.ok) return;
      const soundness = validateIrSoundness([moduleResult.value]);
      expect(soundness.ok).to.equal(false);
      expect(
        soundness.diagnostics.some((diagnostic) =>
          diagnostic.message.includes("RangeError")
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
      installMinimalClrSurface(tempDir);

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
