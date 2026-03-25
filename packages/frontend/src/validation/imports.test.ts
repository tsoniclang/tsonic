import { describe, it } from "mocha";
import { expect } from "chai";
import * as ts from "typescript";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { validateImports } from "./imports.js";
import { createDiagnosticsCollector } from "../types/diagnostic.js";
import type { TsonicProgram } from "../program.js";
import { DotnetMetadataRegistry } from "../dotnet-metadata.js";
import { BindingRegistry } from "../program/bindings.js";
import { createClrBindingsResolver } from "../resolver/clr-bindings-resolver.js";
import { createBinding } from "../ir/binding/index.js";
import type { SurfaceMode } from "../program/types.js";

type ValidationResult = ReturnType<typeof createDiagnosticsCollector>;

type TestProgramOptions = {
  readonly surface?: SurfaceMode;
};

const createTestProgram = (
  source: string,
  fileName = "/test/test.ts",
  sourceRoot = "/test",
  options?: TestProgramOptions
): TsonicProgram & { readonly sourceFile: ts.SourceFile } => {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
  };

  const host = ts.createCompilerHost(compilerOptions);
  const originalGetSourceFile = host.getSourceFile;
  host.getSourceFile = (
    name: string,
    languageVersionOrOptions: ts.ScriptTarget | ts.CreateSourceFileOptions,
    onError?: (message: string) => void,
    shouldCreateNewSourceFile?: boolean
  ) => {
    if (name === fileName) {
      return sourceFile;
    }
    return originalGetSourceFile.call(
      host,
      name,
      languageVersionOrOptions,
      onError,
      shouldCreateNewSourceFile
    );
  };

  const program = ts.createProgram([fileName], compilerOptions, host);
  const checker = program.getTypeChecker();

  return {
    program,
    checker,
    options: {
      projectRoot: sourceRoot,
      sourceRoot,
      rootNamespace: "Test",
      surface: options?.surface,
    },
    sourceFiles: [sourceFile],
    declarationSourceFiles: [],
    metadata: new DotnetMetadataRegistry(),
    bindings: new BindingRegistry(),
    clrResolver: createClrBindingsResolver(sourceRoot),
    binding: createBinding(checker),
    sourceFile,
  };
};

const runValidation = (
  sourceText: string,
  fileName?: string,
  sourceRoot?: string,
  options?: TestProgramOptions
): ValidationResult => {
  const testProgram = createTestProgram(
    sourceText,
    fileName,
    sourceRoot,
    options
  );
  return validateImports(
    testProgram.sourceFile,
    testProgram,
    createDiagnosticsCollector()
  );
};

const codes = (result: ValidationResult): readonly string[] =>
  result.diagnostics.map((diag) => diag.code);

const attachNodejsSurfaceBindings = (
  testProgram: TsonicProgram,
  moduleNames: readonly string[]
): void => {
  const uniqueModules = Array.from(new Set(moduleNames));
  testProgram.bindings.addBindings("/test/node-types.json", {
    namespace: "nodejs",
    types: uniqueModules.map((moduleName) => ({
      clrName: `nodejs.${moduleName}`,
      assemblyName: "nodejs",
      methods: [],
      properties: [],
      fields: [],
    })),
  });
  const bindings = Object.fromEntries(
    uniqueModules.flatMap((moduleName) => [
      [
        `node:${moduleName}`,
        {
          kind: "module" as const,
          assembly: "nodejs",
          type: `nodejs.${moduleName}`,
        },
      ],
      [
        moduleName,
        {
          kind: "module" as const,
          assembly: "nodejs",
          type: `nodejs.${moduleName}`,
        },
      ],
    ])
  );
  testProgram.bindings.addBindings("/test/node-bindings.json", {
    bindings,
  });
};

describe("validateImports", () => {
  it("allows import type declarations from @tsonic/core modules", () => {
    const result = runValidation(`
      import type { int } from "@tsonic/core/types.js";
      const x: int | undefined = undefined;
      void x;
    `);

    expect(result.hasErrors).to.equal(false);
    expect(codes(result)).to.deep.equal([]);
  });

  it("allows import type declarations for language intrinsics", () => {
    const result = runValidation(`
      import type { stackalloc as StackAlloc } from "@tsonic/core/lang.js";
      const f: StackAlloc | undefined = undefined;
      void f;
    `);

    expect(result.hasErrors).to.equal(false);
    expect(codes(result)).to.deep.equal([]);
  });

  it("allows runtime imports from @tsonic/core modules", () => {
    const result = runValidation(`
      import { stackalloc } from "@tsonic/core/lang.js";
      void stackalloc;
    `);

    expect(result.hasErrors).to.equal(false);
    expect(codes(result)).to.deep.equal([]);
  });

  it("reports unsupported module imports with TSN1004", () => {
    const result = runValidation(`
      import { x } from "leftpad";
      void x;
    `);

    expect(result.hasErrors).to.equal(true);
    expect(codes(result).includes("TSN1004")).to.equal(true);
  });

  it("warns on default imports from local modules", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tsonic-imports-"));
    const sourceDir = path.join(tempRoot, "src");
    const sourceFile = path.join(sourceDir, "main.ts");
    const importedModule = path.join(sourceDir, "module.ts");
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(importedModule, "export const value = 1;\n", "utf-8");

    try {
      const result = runValidation(
        `
          import value from "./module.js";
          void value;
        `,
        sourceFile,
        tempRoot
      );

      expect(result.hasErrors).to.equal(false);
      const warningCodes = result.diagnostics
        .filter((diag) => diag.severity === "warning")
        .map((diag) => diag.code);
      expect(warningCodes.includes("TSN2001")).to.equal(true);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("does not warn on default imports from source packages", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tsonic-imports-"));
    const sourceDir = path.join(tempRoot, "src");
    const sourceFile = path.join(sourceDir, "main.ts");
    const packageRoot = path.join(tempRoot, "node_modules", "@acme", "runtime");
    fs.mkdirSync(path.join(sourceDir), { recursive: true });
    fs.mkdirSync(path.join(packageRoot, "src"), { recursive: true });
    fs.mkdirSync(path.join(packageRoot, "tsonic"), { recursive: true });
    fs.writeFileSync(
      path.join(packageRoot, "package.json"),
      JSON.stringify(
        {
          name: "@acme/runtime",
          private: true,
          type: "module",
          exports: {
            "./index.js": "./src/index.ts",
          },
        },
        null,
        2
      ) + "\n",
      "utf-8"
    );
    fs.writeFileSync(
      path.join(packageRoot, "tsonic.package.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          kind: "tsonic-source-package",
          surfaces: ["@tsonic/js"],
          source: {
            exports: {
              "./index.js": "./src/index.ts",
            },
          },
        },
        null,
        2
      ) + "\n",
      "utf-8"
    );
    fs.writeFileSync(
      path.join(packageRoot, "src", "index.ts"),
      "export default 1;\n",
      "utf-8"
    );

    try {
      const result = runValidation(
        `
          import value from "@acme/runtime/index.js";
          void value;
        `,
        sourceFile,
        tempRoot,
        { surface: "@tsonic/js" }
      );

      expect(result.hasErrors).to.equal(false);
      const warningCodes = result.diagnostics
        .filter((diag) => diag.severity === "warning")
        .map((diag) => diag.code);
      expect(warningCodes.includes("TSN2001")).to.equal(false);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("allows canonical node module named imports when module bindings exist", () => {
    const testProgram = createTestProgram(
      `
        import { fs } from "node:fs";
        void fs;
      `,
      "/test/node-valid.ts",
      "/test",
      { surface: "@tsonic/js" }
    );
    attachNodejsSurfaceBindings(testProgram, ["fs"]);

    const result = validateImports(
      testProgram.sourceFile,
      testProgram,
      createDiagnosticsCollector()
    );

    expect(result.hasErrors).to.equal(false);
    expect(codes(result)).to.deep.equal([]);
  });

  it("allows named member imports from node aliases when module bindings exist", () => {
    const testProgram = createTestProgram(
      `
        import { readFileSync } from "node:fs";
        void readFileSync;
      `,
      "/test/node-invalid-member.ts",
      "/test",
      { surface: "@tsonic/js" }
    );
    attachNodejsSurfaceBindings(testProgram, ["fs"]);

    const result = validateImports(
      testProgram.sourceFile,
      testProgram,
      createDiagnosticsCollector()
    );

    expect(result.hasErrors).to.equal(false);
    expect(codes(result)).to.deep.equal([]);
  });

  it("allows default imports from node aliases when module bindings exist", () => {
    const testProgram = createTestProgram(
      `
        import fs from "node:fs";
        void fs;
      `,
      "/test/node-default-import.ts",
      "/test",
      { surface: "@tsonic/js" }
    );
    attachNodejsSurfaceBindings(testProgram, ["fs"]);

    const result = validateImports(
      testProgram.sourceFile,
      testProgram,
      createDiagnosticsCollector()
    );

    expect(result.hasErrors).to.equal(false);
    expect(codes(result)).to.deep.equal([]);
  });

  it("allows named member imports from bare node aliases when module bindings exist", () => {
    const testProgram = createTestProgram(
      `
        import { join } from "path";
        void join;
      `,
      "/test/node-bare-invalid-member.ts",
      "/test",
      { surface: "@tsonic/js" }
    );
    attachNodejsSurfaceBindings(testProgram, ["path"]);

    const result = validateImports(
      testProgram.sourceFile,
      testProgram,
      createDiagnosticsCollector()
    );

    expect(result.hasErrors).to.equal(false);
    expect(codes(result)).to.deep.equal([]);
  });

  it("allows namespace imports from node aliases when module bindings exist", () => {
    const testProgram = createTestProgram(
      `
        import * as path from "node:path";
        void path.join("a", "b");
      `,
      "/test/node-namespace-import.ts",
      "/test",
      { surface: "@tsonic/js" }
    );
    attachNodejsSurfaceBindings(testProgram, ["path"]);

    const result = validateImports(
      testProgram.sourceFile,
      testProgram,
      createDiagnosticsCollector()
    );

    expect(result.hasErrors).to.equal(false);
    expect(codes(result)).to.deep.equal([]);
  });

  it("allows node default imports in one pass", () => {
    const testProgram = createTestProgram(
      `
        import badPath from "node:path";
        void badPath;
      `,
      "/test/node-multi-diagnostics.ts",
      "/test",
      { surface: "@tsonic/js" }
    );
    attachNodejsSurfaceBindings(testProgram, ["path", "fs"]);

    const result = validateImports(
      testProgram.sourceFile,
      testProgram,
      createDiagnosticsCollector()
    );

    expect(result.hasErrors).to.equal(false);
    expect(codes(result)).to.deep.equal([]);
  });

  it("rejects node aliases when module bindings are missing", () => {
    const testProgram = createTestProgram(
      `
        import { fs } from "node:fs";
        void fs;
      `,
      "/test/node-missing-bindings.ts",
      "/test",
      { surface: "@tsonic/js" }
    );
    const result = validateImports(
      testProgram.sourceFile,
      testProgram,
      createDiagnosticsCollector()
    );

    expect(result.hasErrors).to.equal(true);
    expect(codes(result)).to.include("TSN1004");
  });
});
