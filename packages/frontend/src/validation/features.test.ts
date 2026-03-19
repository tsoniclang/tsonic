import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
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
  fileName = "/test/index.ts",
  extraFiles: Readonly<Record<string, string>> = {}
): TsonicProgram & { readonly sourceFile: ts.SourceFile } => {
  const allFiles = new Map<string, string>([
    [fileName, source],
    ...Object.entries(extraFiles),
  ]);

  const sourceFiles = new Map<string, ts.SourceFile>(
    Array.from(allFiles.entries(), ([name, text]) => [
      name,
      ts.createSourceFile(
        name,
        text,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
      ),
    ])
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
  const originalFileExists = host.fileExists;
  const originalReadFile = host.readFile;
  host.getSourceFile = (
    name: string,
    languageVersionOrOptions: ts.ScriptTarget | ts.CreateSourceFileOptions,
    onError?: (message: string) => void,
    shouldCreateNewSourceFile?: boolean
  ) => {
    const normalized = name.replace(/\\/g, "/");
    const file = sourceFiles.get(normalized);
    if (file) {
      return file;
    }
    return originalGetSourceFile.call(
      host,
      name,
      languageVersionOrOptions,
      onError,
      shouldCreateNewSourceFile
    );
  };
  host.fileExists = (name: string) =>
    sourceFiles.has(name.replace(/\\/g, "/")) || originalFileExists(name);
  host.readFile = (name: string) => {
    const normalized = name.replace(/\\/g, "/");
    return allFiles.get(normalized) ?? originalReadFile(name);
  };

  const program = ts.createProgram(
    Array.from(allFiles.keys()),
    compilerOptions,
    host
  );
  const checker = program.getTypeChecker();
  const entrySourceFile = program.getSourceFile(fileName);
  if (!entrySourceFile) {
    throw new Error(`Missing test entry source file: ${fileName}`);
  }

  return {
    program,
    checker,
    options: {
      projectRoot: "/test",
      sourceRoot: "/test",
      rootNamespace: "Test",
    },
    sourceFiles: Array.from(sourceFiles.keys())
      .map((name) => program.getSourceFile(name))
      .filter((file): file is ts.SourceFile => file !== undefined),
    declarationSourceFiles: [],
    metadata: new DotnetMetadataRegistry(),
    bindings: new BindingRegistry(),
    clrResolver: createClrBindingsResolver("/test"),
    binding: createBinding(checker),
    sourceFile: entrySourceFile,
  };
};

const runValidation = (
  sourceText: string,
  extraFiles: Readonly<Record<string, string>> = {}
): ValidationResult => {
  const testProgram = createTestProgram(
    sourceText,
    "/test/index.ts",
    extraFiles
  );
  return validateUnsupportedFeatures(
    testProgram.sourceFile,
    testProgram,
    createDiagnosticsCollector()
  );
};

const runValidationInTempProject = (
  sourceText: string,
  extraFiles: Readonly<Record<string, string>> = {}
): ValidationResult => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "tsonic-features-dynamic-import-")
  );

  try {
    const entryPath = path.join(tempDir, "src", "index.ts");
    fs.mkdirSync(path.dirname(entryPath), { recursive: true });
    fs.writeFileSync(entryPath, sourceText);

    const rootNames = [entryPath];
    for (const [relativePath, content] of Object.entries(extraFiles)) {
      const fullPath = path.join(tempDir, relativePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
      rootNames.push(fullPath);
    }

    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      strict: true,
      noEmit: true,
      skipLibCheck: true,
    };

    const program = ts.createProgram(rootNames, compilerOptions);
    const checker = program.getTypeChecker();
    const sourceFile = program.getSourceFile(entryPath);
    if (!sourceFile) {
      throw new Error("Missing temp-project entry source file.");
    }

    return validateUnsupportedFeatures(
      sourceFile,
      {
        program,
        checker,
        options: {
          projectRoot: tempDir,
          sourceRoot: path.join(tempDir, "src"),
          rootNamespace: "Test",
        },
        sourceFiles: rootNames
          .map((fileName) => program.getSourceFile(fileName))
          .filter((file): file is ts.SourceFile => file !== undefined),
        declarationSourceFiles: [],
        metadata: new DotnetMetadataRegistry(),
        bindings: new BindingRegistry(),
        clrResolver: createClrBindingsResolver(tempDir),
        binding: createBinding(checker),
      },
      createDiagnosticsCollector()
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
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

    it("allows import.meta.url", () => {
      const result = runValidation(`
        const url = import.meta.url;
        console.log(url);
      `);

      expect(hasDiagnostic(result, "TSN2001")).to.equal(false);
    });

    it("allows import.meta.filename", () => {
      const result = runValidation(`
        const file = import.meta.filename;
        console.log(file);
      `);

      expect(hasDiagnostic(result, "TSN2001")).to.equal(false);
    });

    it("allows import.meta.dirname", () => {
      const result = runValidation(`
        const dir = import.meta.dirname;
        console.log(dir);
      `);

      expect(hasDiagnostic(result, "TSN2001")).to.equal(false);
    });

    it("rejects unsupported import.meta fields", () => {
      const result = runValidation(`
        const bad = import.meta.env;
        console.log(bad);
      `);

      expect(hasDiagnostic(result, "TSN2001", "import.meta")).to.equal(true);
    });

    it("allows bare import.meta object usage", () => {
      const result = runValidation(`
        declare global {
          interface ImportMeta {
            readonly url: string;
            readonly filename: string;
            readonly dirname: string;
          }
        }
        const meta = import.meta;
        console.log(meta.url, meta.filename, meta.dirname);
      `);

      expect(hasDiagnostic(result, "TSN2001")).to.equal(false);
    });

    it("allows dynamic import() when returned as a local closed-world value", () => {
      const result = runValidationInTempProject(
        `
        async function load() {
          return import("./module.js");
        }
      `,
        {
          "src/module.ts": "export const value = 42;\n",
        }
      );

      expect(hasDiagnostic(result, "TSN2001", "Dynamic import()")).to.equal(
        false
      );
    });

    it("allows await import() when module namespace is consumed deterministically", () => {
      const result = runValidationInTempProject(
        `
        async function load() {
          const module = await import("./module.js");
          return module.value;
        }
      `,
        {
          "src/module.ts": "export const value = 42;\n",
        }
      );

      expect(hasDiagnostic(result, "TSN2001", "Dynamic import()")).to.equal(
        false
      );
    });

    it("rejects dynamic import() in side-effect form", () => {
      const result = runValidation(`
        async function load() {
          import("./module.js");
        }
      `);

      expect(
        hasDiagnostic(result, "TSN2001", 'await import("./local-module.js")')
      ).to.equal(true);
    });

    it("allows awaited dynamic import() in relative side-effect form", () => {
      const result = runValidationInTempProject(
        `
        async function load() {
          await import("./module.js");
        }
      `,
        {
          "src/module.ts": "export class Box {}\n",
        }
      );

      expect(hasDiagnostic(result, "TSN2001")).to.equal(false);
    });

    it("rejects dynamic import() side-effect form with non-literal specifier", () => {
      const result = runValidation(`
        async function load(name: string) {
          await import(name);
        }
      `);

      expect(
        hasDiagnostic(result, "TSN2001", "string-literal specifiers")
      ).to.equal(true);
    });

    it("rejects dynamic import() value usage when runtime exports are not deterministically representable", () => {
      const result = runValidationInTempProject(
        `
        async function load() {
          const module = await import("./module.js");
          return module.Box;
        }
      `,
        {
          "src/module.ts": "export class Box {}\n",
        }
      );

      expect(hasDiagnostic(result, "TSN2001", "Unsupported export")).to.equal(
        true
      );
    });

    it("rejects awaited dynamic import() with bare package specifier", () => {
      const result = runValidation(`
        async function load() {
          await import("@acme/math");
        }
      `);

      expect(hasDiagnostic(result, "TSN2001", "Dynamic import()")).to.equal(
        true
      );
    });

    it("does not reject static import declarations", () => {
      const result = runValidation(`
        import { value } from "./module.js";
        console.log(value);
      `);

      expect(hasDiagnostic(result, "TSN2001")).to.equal(false);
    });

    it("does not reject import type declarations", () => {
      const result = runValidation(`
        import type { Foo } from "./module.js";
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

  describe("TSN5001", () => {
    it("rejects direct function.length access", () => {
      const result = runValidation(`
        type Handler = (value: string) => void;

        export function arity(handler: Handler): number {
          return handler.length;
        }
      `);

      expect(
        hasDiagnostic(result, "TSN5001", "function.length is not supported")
      ).to.equal(true);
    });

    it("rejects structural length views over opaque function values", () => {
      const result = runValidation(`
        export function arity(handler: unknown): number {
          if (typeof handler !== "function") {
            return 0;
          }

          const maybeFunction = handler as unknown as { readonly length?: number };
          return typeof maybeFunction.length === "number" ? maybeFunction.length : 0;
        }
      `);

      expect(
        hasDiagnostic(result, "TSN5001", "function.length is not supported")
      ).to.equal(true);
    });

    it("rejects named structural length views over opaque function values", () => {
      const result = runValidation(`
        interface HandlerShape {
          readonly length?: number;
        }

        export function arity(handler: unknown): number {
          if (typeof handler !== "function") {
            return 0;
          }

          const maybeFunction = handler as unknown as HandlerShape;
          return typeof maybeFunction["length"] === "number" ? maybeFunction["length"] : 0;
        }
      `);

      expect(
        hasDiagnostic(result, "TSN5001", "function.length is not supported")
      ).to.equal(true);
    });

    it("allows array length through structural array views", () => {
      const result = runValidation(`
        export function arity(values: unknown): number {
          if (!Array.isArray(values)) {
            return 0;
          }

          const items = values as readonly unknown[];
          return items.length;
        }
      `);

      expect(hasDiagnostic(result, "TSN5001")).to.equal(false);
    });

    it("allows ordinary string and array length access", () => {
      const result = runValidation(`
        export function run(text: string, items: readonly string[]): number {
          return text.length + items.length;
        }
      `);

      expect(hasDiagnostic(result, "TSN5001")).to.equal(false);
    });
  });
});
