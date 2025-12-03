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
import { createClrBindingsResolver } from "./resolver/clr-bindings-resolver.js";

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
      projectRoot: "/test",
      sourceRoot: "/test",
      rootNamespace: "Test",
    },
    sourceFiles: [sourceFile],
    metadata: new DotnetMetadataRegistry(),
    bindings: new BindingRegistry(),
    clrResolver: createClrBindingsResolver("/test"),
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

      // Should have NO generic-specific diagnostics (TSN71xx, TSN72xx)
      // Note: TSN74xx (static safety) may fire due to 'any' in test code, but that's expected
      const genericDiags = diagnostics.diagnostics.filter(
        (d) => d.code.startsWith("TSN71") || d.code.startsWith("TSN72")
      );
      expect(genericDiags).to.have.lengthOf(0);
    });
  });
});

describe("Static Safety Validation", () => {
  describe("TSN7401 - 'any' type banned", () => {
    it("should reject explicit any type annotation", () => {
      const source = `
        export const x: any = 1;
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const anyDiag = diagnostics.diagnostics.find((d) => d.code === "TSN7401");
      expect(anyDiag).not.to.equal(undefined);
      expect(anyDiag?.message).to.include("'any' type is not supported");
    });

    it("should reject 'as any' type assertion", () => {
      const source = `
        export const x = (123 as any);
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const anyDiag = diagnostics.diagnostics.find((d) => d.code === "TSN7401");
      expect(anyDiag).not.to.equal(undefined);
      expect(anyDiag?.message).to.include("'as any'");
    });

    it("should allow unknown type", () => {
      const source = `
        export function process(data: unknown): void {
          console.log(data);
        }
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const anyDiag = diagnostics.diagnostics.find((d) => d.code === "TSN7401");
      expect(anyDiag).to.equal(undefined);
    });
  });

  describe("TSN7403 - Object literal requires nominal type", () => {
    it("should reject object literal without contextual type", () => {
      const source = `
        const a = { x: 1 };
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const objDiag = diagnostics.diagnostics.find((d) => d.code === "TSN7403");
      expect(objDiag).not.to.equal(undefined);
      expect(objDiag?.message).to.include("contextual nominal type");
    });

    it("should allow object literal with interface type", () => {
      const source = `
        interface Point { x: number; y: number }
        const p: Point = { x: 1, y: 2 };
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const objDiag = diagnostics.diagnostics.find((d) => d.code === "TSN7403");
      expect(objDiag).to.equal(undefined);
    });

    it("should allow object literal with Record type", () => {
      const source = `
        const d: Record<string, number> = { a: 1, b: 2 };
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const objDiag = diagnostics.diagnostics.find((d) => d.code === "TSN7403");
      expect(objDiag).to.equal(undefined);
    });
  });

  describe("TSN7405 - Untyped function parameters", () => {
    it("should reject untyped function parameter", () => {
      const source = `
        export function greet(name): void {
          console.log(name);
        }
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const paramDiag = diagnostics.diagnostics.find(
        (d) => d.code === "TSN7405"
      );
      expect(paramDiag).not.to.equal(undefined);
      expect(paramDiag?.message).to.include("explicit type annotation");
    });

    it("should reject untyped arrow function parameter", () => {
      const source = `
        const fn = (x) => x + 1;
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const paramDiag = diagnostics.diagnostics.find(
        (d) => d.code === "TSN7405"
      );
      expect(paramDiag).not.to.equal(undefined);
      expect(paramDiag?.message).to.include("explicit type annotation");
    });

    it("should reject untyped function expression parameter", () => {
      const source = `
        const fn = function(x) { return x + 1; };
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const paramDiag = diagnostics.diagnostics.find(
        (d) => d.code === "TSN7405"
      );
      expect(paramDiag).not.to.equal(undefined);
      expect(paramDiag?.message).to.include("explicit type annotation");
    });

    it("should allow typed function parameter", () => {
      const source = `
        export function greet(name: string): void {
          console.log(name);
        }
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const paramDiag = diagnostics.diagnostics.find(
        (d) => d.code === "TSN7405"
      );
      expect(paramDiag).to.equal(undefined);
    });

    it("should allow typed arrow function parameter", () => {
      const source = `
        const fn = (x: number): number => x + 1;
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const paramDiag = diagnostics.diagnostics.find(
        (d) => d.code === "TSN7405"
      );
      expect(paramDiag).to.equal(undefined);
    });

    // Contextual type inference tests
    it("should allow lambda with contextually inferred params in array.sort", () => {
      const source = `
        const nums: number[] = [3, 1, 2];
        const sorted = nums.sort((a, b) => a - b);
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const paramDiag = diagnostics.diagnostics.find(
        (d) => d.code === "TSN7405"
      );
      expect(paramDiag).to.equal(undefined);
    });

    it("should allow lambda with contextually inferred params in array.map", () => {
      const source = `
        const nums: number[] = [1, 2, 3];
        const doubled = nums.map((x) => x * 2);
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const paramDiag = diagnostics.diagnostics.find(
        (d) => d.code === "TSN7405"
      );
      expect(paramDiag).to.equal(undefined);
    });

    it("should allow lambda with contextually inferred params in array.filter", () => {
      const source = `
        const nums: number[] = [1, 2, 3, 4];
        const evens = nums.filter((x) => x % 2 === 0);
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const paramDiag = diagnostics.diagnostics.find(
        (d) => d.code === "TSN7405"
      );
      expect(paramDiag).to.equal(undefined);
    });

    it("should allow lambda with contextually inferred params in array.find", () => {
      const source = `
        const nums: number[] = [1, 2, 3];
        const found = nums.find((x) => x > 2);
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const paramDiag = diagnostics.diagnostics.find(
        (d) => d.code === "TSN7405"
      );
      expect(paramDiag).to.equal(undefined);
    });

    it("should allow lambda assigned to typed function variable", () => {
      const source = `
        const fn: (x: number) => number = (x) => x + 1;
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const paramDiag = diagnostics.diagnostics.find(
        (d) => d.code === "TSN7405"
      );
      expect(paramDiag).to.equal(undefined);
    });

    it("should allow lambda passed to higher-order function", () => {
      const source = `
        function apply(fn: (x: number) => number, value: number): number {
          return fn(value);
        }
        const result = apply((x) => x * 2, 5);
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const paramDiag = diagnostics.diagnostics.find(
        (d) => d.code === "TSN7405"
      );
      expect(paramDiag).to.equal(undefined);
    });

    it("should allow Promise executor callback without explicit types", () => {
      const source = `
        export async function delay(ms: number): Promise<void> {
          return new Promise((resolve) => {
            setTimeout(resolve, ms);
          });
        }
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const paramDiag = diagnostics.diagnostics.find(
        (d) => d.code === "TSN7405"
      );
      expect(paramDiag).to.equal(undefined);
    });

    it("should allow Promise executor with both resolve and reject", () => {
      const source = `
        export function fetchData(): Promise<string> {
          return new Promise((resolve, reject) => {
            resolve("data");
          });
        }
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const paramDiag = diagnostics.diagnostics.find(
        (d) => d.code === "TSN7405"
      );
      expect(paramDiag).to.equal(undefined);
    });
  });

  describe("TSN7413 - Dictionary key must be string", () => {
    it("should reject Record with number key", () => {
      const source = `
        const d: Record<number, string> = {};
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const keyDiag = diagnostics.diagnostics.find((d) => d.code === "TSN7413");
      expect(keyDiag).not.to.equal(undefined);
      expect(keyDiag?.message).to.include("string");
    });

    it("should reject index signature with number key", () => {
      const source = `
        interface NumIndexed {
          [key: number]: string;
        }
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const keyDiag = diagnostics.diagnostics.find((d) => d.code === "TSN7413");
      expect(keyDiag).not.to.equal(undefined);
      expect(keyDiag?.message).to.include("string");
    });

    it("should allow Record with string key", () => {
      const source = `
        const d: Record<string, number> = {};
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const keyDiag = diagnostics.diagnostics.find((d) => d.code === "TSN7413");
      expect(keyDiag).to.equal(undefined);
    });

    it("should allow index signature with string key", () => {
      const source = `
        interface StringIndexed {
          [key: string]: number;
        }
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const keyDiag = diagnostics.diagnostics.find((d) => d.code === "TSN7413");
      expect(keyDiag).to.equal(undefined);
    });
  });
});
