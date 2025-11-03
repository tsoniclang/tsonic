/**
 * Tests for validator - now only checks truly unsupported features
 *
 * Most generic constructs are now handled via:
 * - Monomorphisation
 * - CRTP pattern
 * - Tuple specialisations
 * - Structural adapters
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as ts from "typescript";
import { TsonicProgram } from "./program.js";
import { validateProgram } from "./validator.js";
import { DotnetMetadataRegistry } from "./dotnet-metadata.js";
import { BindingRegistry } from "./program/bindings.js";

/**
 * Helper to create a test program from source code
 */
const createTestProgram = (
  source: string,
  fileName = "test.ts"
): TsonicProgram => {
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

  return {
    program,
    checker: program.getTypeChecker(),
    options: {
      sourceRoot: "/test",
      rootNamespace: "Test",
    },
    sourceFiles: [sourceFile],
    metadata: new DotnetMetadataRegistry(),
    bindings: new BindingRegistry(),
  };
};

describe("Generic Validation", () => {
  describe("TSN7203 - Symbol Index Signatures (still blocked)", () => {
    it("should detect symbol index signatures", () => {
      const source = `
        export interface WithSymbolIndex {
          [key: symbol]: string;
        }
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const symbolDiag = diagnostics.diagnostics.find(
        (d) => d.code === "TSN7203"
      );
      expect(symbolDiag).not.to.equal(undefined);
      expect(symbolDiag?.message).to.include(
        "Symbol keys are not supported in C#"
      );
    });

    it("should not flag string index signatures", () => {
      const source = `
        interface WithStringIndex {
          [key: string]: number;
        }
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const symbolDiag = diagnostics.diagnostics.find(
        (d) => d.code === "TSN7203"
      );
      expect(symbolDiag).to.equal(undefined);
    });

    it("should not flag number index signatures", () => {
      const source = `
        interface WithNumberIndex {
          [key: number]: string;
        }
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const symbolDiag = diagnostics.diagnostics.find(
        (d) => d.code === "TSN7203"
      );
      expect(symbolDiag).to.equal(undefined);
    });
  });

  describe("Previously-blocked constructs (now ALLOWED)", () => {
    it("should allow recursive mapped types (handled via monomorphisation)", () => {
      const source = `
        type RecursiveMapped<T> = {
          [K in keyof T]: RecursiveMapped<T[K]>
        };
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      // Should NOT have TSN7101 error anymore
      const recursiveDiag = diagnostics.diagnostics.find(
        (d) => d.code === "TSN7101"
      );
      expect(recursiveDiag).to.equal(undefined);
    });

    it("should allow conditional types with infer (handled via monomorphisation)", () => {
      const source = `
        type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      // Should NOT have TSN7102 error anymore
      const inferDiag = diagnostics.diagnostics.find(
        (d) => d.code === "TSN7102"
      );
      expect(inferDiag).to.equal(undefined);
    });

    it("should allow this typing (handled via CRTP pattern)", () => {
      const source = `
        interface Chainable {
          add(value: number): this;
        }
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      // Should NOT have TSN7103 error anymore
      const thisDiag = diagnostics.diagnostics.find(
        (d) => d.code === "TSN7103"
      );
      expect(thisDiag).to.equal(undefined);
    });

    it("should allow variadic type parameters (handled via tuple specialisations)", () => {
      const source = `
        type VariadicFunction<T extends unknown[]> = (...args: T) => void;
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      // Should NOT have TSN7104 error anymore
      const variadicDiag = diagnostics.diagnostics.find(
        (d) => d.code === "TSN7104"
      );
      expect(variadicDiag).to.equal(undefined);
    });

    it("should allow recursive structural aliases (emit as C# classes)", () => {
      const source = `
        type Node = {
          name: string;
          children: Node[];
        };
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      // Should NOT have TSN7201 error anymore
      const recursiveDiag = diagnostics.diagnostics.find(
        (d) => d.code === "TSN7201"
      );
      expect(recursiveDiag).to.equal(undefined);
    });

    it("should allow complex generic code without errors", () => {
      const source = `
        // Conditional type with infer
        type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

        // This typing
        interface Builder {
          set(key: string, value: any): this;
        }

        // Variadic parameters
        function concat<T extends any[]>(...arrays: T): T {
          return arrays;
        }

        // Recursive structural alias
        type Tree = {
          value: number;
          left?: Tree;
          right?: Tree;
        };
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      // Should have NO generic-related diagnostics (TSN7xxx)
      const genericDiags = diagnostics.diagnostics.filter((d) =>
        d.code.startsWith("TSN7")
      );
      expect(genericDiags).to.have.lengthOf(0);
    });
  });
});
