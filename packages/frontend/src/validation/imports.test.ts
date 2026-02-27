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

type ValidationResult = ReturnType<typeof createDiagnosticsCollector>;

const createTestProgram = (
  source: string,
  fileName = "/test/test.ts",
  sourceRoot = "/test"
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
  sourceRoot?: string
): ValidationResult => {
  const testProgram = createTestProgram(sourceText, fileName, sourceRoot);
  return validateImports(
    testProgram.sourceFile,
    testProgram,
    createDiagnosticsCollector()
  );
};

const codes = (result: ValidationResult): readonly string[] =>
  result.diagnostics.map((diag) => diag.code);

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

  it("allows inline import type queries", () => {
    const result = runValidation(`
      type StackAlloc = import("@tsonic/core/lang.js").stackalloc;
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
});
