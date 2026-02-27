import { describe, it } from "mocha";
import { expect } from "chai";
import * as ts from "typescript";
import { validateUnsupportedFeatures } from "./features.js";
import { createDiagnosticsCollector } from "../types/diagnostic.js";
import type { TsonicProgram } from "../program.js";
import { DotnetMetadataRegistry } from "../dotnet-metadata.js";
import { BindingRegistry } from "../program/bindings.js";
import { createClrBindingsResolver } from "../resolver/clr-bindings-resolver.js";
import { createBinding } from "../ir/binding/index.js";

type ValidationResult = ReturnType<typeof createDiagnosticsCollector>;

const createTestProgram = (
  source: string,
  fileName = "test.ts"
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
      projectRoot: "/test",
      sourceRoot: "/test",
      rootNamespace: "Test",
    },
    sourceFiles: [sourceFile],
    declarationSourceFiles: [],
    metadata: new DotnetMetadataRegistry(),
    bindings: new BindingRegistry(),
    clrResolver: createClrBindingsResolver("/test"),
    binding: createBinding(checker),
    sourceFile,
  };
};

const runValidation = (sourceText: string): ValidationResult => {
  const testProgram = createTestProgram(sourceText);
  return validateUnsupportedFeatures(
    testProgram.sourceFile,
    testProgram,
    createDiagnosticsCollector()
  );
};

const hasDiagnostic = (
  result: ValidationResult,
  code: string,
  messageFragment?: string
) =>
  result.diagnostics.some(
    (d) =>
      d.code === code &&
      (messageFragment === undefined || d.message.includes(messageFragment))
  );

describe("validateUnsupportedFeatures", () => {
  describe("TSN2001", () => {
    it("rejects with-statement in strict AOT mode", () => {
      const result = runValidation(`
        const scope = { x: 1 };
        with (scope) {
          console.log(x);
        }
      `);

      expect(result.hasErrors).to.equal(true);
      expect(
        hasDiagnostic(
          result,
          "TSN2001",
          "'with' statement is not supported in strict AOT mode"
        )
      ).to.equal(true);
    });

    it("rejects nested with-statement in function body", () => {
      const result = runValidation(`
        function f(scope: { x: number }): number {
          with (scope) {
            return x;
          }
        }
      `);

      expect(hasDiagnostic(result, "TSN2001", "'with' statement")).to.equal(
        true
      );
    });

    it("does not flag object property named 'with'", () => {
      const result = runValidation(`
        const obj = { with: 1 };
        console.log(obj.with);
      `);

      expect(hasDiagnostic(result, "TSN2001", "'with' statement")).to.equal(
        false
      );
    });

    it("rejects import.meta", () => {
      const result = runValidation(`
        const url = import.meta.url;
        console.log(url);
      `);

      expect(
        hasDiagnostic(
          result,
          "TSN2001",
          "Meta properties (import.meta) not supported"
        )
      ).to.equal(true);
    });

    it("rejects dynamic import()", () => {
      const result = runValidation(`
        async function load() {
          return import("./module.js");
        }
      `);

      expect(
        hasDiagnostic(result, "TSN2001", "Dynamic import() not supported")
      ).to.equal(true);
    });

    it("rejects await import()", () => {
      const result = runValidation(`
        async function load() {
          const module = await import("./module.js");
          return module;
        }
      `);

      expect(
        hasDiagnostic(result, "TSN2001", "Dynamic import() not supported")
      ).to.equal(true);
    });

    it("does not reject static import declarations", () => {
      const result = runValidation(`
        import { value } from "./module.js";
        console.log(value);
      `);

      expect(hasDiagnostic(result, "TSN2001")).to.equal(false);
    });

    it("does not reject import type queries", () => {
      const result = runValidation(`
        type Foo = import("./module.js").Foo;
        const x: Foo | undefined = undefined;
        console.log(x);
      `);

      expect(hasDiagnostic(result, "TSN2001")).to.equal(false);
    });
  });

  describe("Promise chaining support (TSN3011 retired)", () => {
    it("allows Promise.then chaining", () => {
      const result = runValidation(`
        const p: Promise<number> = Promise.resolve(1);
        p.then((x) => x + 1);
      `);

      expect(hasDiagnostic(result, "TSN3011")).to.equal(false);
    });

    it("allows Promise.catch chaining", () => {
      const result = runValidation(`
        const p: Promise<number> = Promise.resolve(1);
        p.catch(() => 0);
      `);

      expect(hasDiagnostic(result, "TSN3011")).to.equal(false);
    });

    it("allows Promise.finally chaining", () => {
      const result = runValidation(`
        const p: Promise<number> = Promise.resolve(1);
        p.finally(() => {});
      `);

      expect(hasDiagnostic(result, "TSN3011")).to.equal(false);
    });

    it("allows Promise chain composition", () => {
      const result = runValidation(`
        const p: Promise<number> = Promise.resolve(1);
        p.then((x) => x + 1).catch(() => 0).finally(() => {});
      `);

      expect(hasDiagnostic(result, "TSN3011")).to.equal(false);
    });

    it("allows chaining on Promise returned by async functions", () => {
      const result = runValidation(`
        async function load(): Promise<number> {
          return 1;
        }
        load().then((x) => x + 1);
      `);

      expect(hasDiagnostic(result, "TSN3011")).to.equal(false);
    });

    it("allows optional chaining on Promise receivers", () => {
      const result = runValidation(`
        const p: Promise<number> | undefined = Promise.resolve(1);
        p?.then((x) => x + 1);
      `);

      expect(hasDiagnostic(result, "TSN3011")).to.equal(false);
    });

    it("does not flag class methods named then", () => {
      const result = runValidation(`
        class Builder {
          then(v: number): number {
            return v + 1;
          }
        }
        const b = new Builder();
        b.then(1);
      `);

      expect(hasDiagnostic(result, "TSN3011")).to.equal(false);
    });

    it("does not flag class methods named catch", () => {
      const result = runValidation(`
        class Catcher {
          catch(v: number): number {
            return v + 1;
          }
        }
        const c = new Catcher();
        c.catch(1);
      `);

      expect(hasDiagnostic(result, "TSN3011")).to.equal(false);
    });

    it("does not flag class methods named finally", () => {
      const result = runValidation(`
        class Finalizer {
          finally(v: number): number {
            return v + 1;
          }
        }
        const f = new Finalizer();
        f.finally(1);
      `);

      expect(hasDiagnostic(result, "TSN3011")).to.equal(false);
    });

    it("does not flag typed object callbacks named then", () => {
      const result = runValidation(`
        type Builder = { then(v: number): number };
        const b: Builder = { then: (v: number) => v + 1 };
        b.then(1);
      `);

      expect(hasDiagnostic(result, "TSN3011")).to.equal(false);
    });

    it("does not flag non-call property access to 'then'", () => {
      const result = runValidation(`
        const obj = { then: 123 };
        const value = obj.then;
        console.log(value);
      `);

      expect(hasDiagnostic(result, "TSN3011")).to.equal(false);
    });

    it("does not flag regular function name 'then'", () => {
      const result = runValidation(`
        function then(v: number): number {
          return v + 1;
        }
        console.log(then(1));
      `);

      expect(hasDiagnostic(result, "TSN3011")).to.equal(false);
    });
  });
});
