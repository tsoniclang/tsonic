/**
 * Generic Validation tests
 *
 * Covers:
 * - TSN7106: Extension method receiver marker (thisarg)
 * - TSN7440: Core intrinsic provenance
 * - TSN7203 retired: Symbol index signatures
 * - Previously-blocked constructs (now allowed)
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { validateProgram } from "../validator.js";
import { createTestProgram } from "./helpers.js";

describe("Generic Validation", () => {
  describe("TSN7106 - Extension Method Receiver Marker", () => {
    it("should allow thisarg<T> on first parameter of a top-level function declaration", () => {
      const source = `
        import type { thisarg } from "@tsonic/core/lang.js";

        export function where(x: thisarg<number>, y: number): number {
          return x + y;
        }
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const diag = diagnostics.diagnostics.find((d) => d.code === "TSN7106");
      expect(diag).to.equal(undefined);
    });

    it("should reject thisarg<T> when not the first parameter", () => {
      const source = `
        import type { thisarg } from "@tsonic/core/lang.js";

        export function where(y: number, x: thisarg<number>): number {
          return x + y;
        }
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const diag = diagnostics.diagnostics.find((d) => d.code === "TSN7106");
      expect(diag).not.to.equal(undefined);
      expect(diag?.message).to.include("must be the first parameter");
    });

    it("should reject thisarg<T> on class methods", () => {
      const source = `
        import type { thisarg } from "@tsonic/core/lang.js";

        export class Extensions {
          static where(x: thisarg<number>, y: number): number {
            return x + y;
          }
        }
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const diag = diagnostics.diagnostics.find((d) => d.code === "TSN7106");
      expect(diag).not.to.equal(undefined);
      expect(diag?.message).to.include(
        "only valid on top-level function declarations"
      );
    });

    it("should reject thisarg<T> on arrow functions", () => {
      const source = `
        import type { thisarg } from "@tsonic/core/lang.js";

        export const where = (x: thisarg<number>, y: number): number => x + y;
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const diag = diagnostics.diagnostics.find((d) => d.code === "TSN7106");
      expect(diag).not.to.equal(undefined);
      expect(diag?.message).to.include(
        "only valid on top-level function declarations"
      );
    });

    it("should reject out receiver on thisarg<T> parameters", () => {
      const source = `
        import type { thisarg } from "@tsonic/core/lang.js";
        import type { out } from "@tsonic/core/types.js";

        export function tryGetCount(xs: out<thisarg<number>>): number {
          return xs;
        }
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const diag = diagnostics.diagnostics.find((d) => d.code === "TSN7106");
      expect(diag).not.to.equal(undefined);
      expect(diag?.message).to.include("cannot be `out`");
    });
  });

  describe("TSN7440 - Core Intrinsic Provenance", () => {
    it("should reject locally declared core numeric aliases (int)", () => {
      const source = `
        type int = number;

        export const x: int = 1 as int;
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const diag = diagnostics.diagnostics.find((d) => d.code === "TSN7440");
      expect(diag).not.to.equal(undefined);
      expect(diag?.message).to.include("Core intrinsic 'int'");
    });

    it("should reject locally declared core lang intrinsics (stackalloc)", () => {
      const source = `
        function stackalloc<T>(size: number): T {
          throw new Error("not implemented");
        }

        export function main(): void {
          stackalloc<number>(123);
        }
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const diag = diagnostics.diagnostics.find((d) => d.code === "TSN7440");
      expect(diag).not.to.equal(undefined);
      expect(diag?.message).to.include("Core intrinsic 'stackalloc'");
    });

    it("should allow core intrinsics when imported from @tsonic/core", () => {
      const source = `
        import type { int } from "@tsonic/core/types.js";
        import { stackalloc, nameof, sizeof } from "@tsonic/core/lang.js";

        export const x: int = 1 as int;
        export const fieldName = nameof(x);
        export const intSize: int = sizeof<int>();

        export function main(): void {
          stackalloc<int>(10 as int);
        }
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const diag = diagnostics.diagnostics.find((d) => d.code === "TSN7440");
      expect(diag).to.equal(undefined);
    });
  });

  describe("TSN7203 retired - Symbol index signatures", () => {
    it("should allow symbol index signatures", () => {
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
      expect(symbolDiag).to.equal(undefined);
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

    it("should allow Record<symbol, V> without TSN7203", () => {
      const source = `
        type SymbolMap = Record<symbol, number>;
        const table: SymbolMap = {} as SymbolMap;
        void table;
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const symbolDiag = diagnostics.diagnostics.find(
        (d) => d.code === "TSN7203"
      );
      expect(symbolDiag).to.equal(undefined);
    });

    it("should allow mixed PropertyKey unions including symbol", () => {
      const source = `
        type Key = string | number | symbol;
        type Map = Record<Key, number>;
        const table: Map = {} as Map;
        void table;
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
