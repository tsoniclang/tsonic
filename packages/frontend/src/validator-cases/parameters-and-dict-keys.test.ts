/**
 * Static Safety - Function Parameters, Dictionary Keys & Intersection Types
 *
 * Covers:
 * - TSN7405: Untyped function parameters
 * - TSN7413: Dictionary key type validation
 * - Intersection types (now supported)
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { validateProgram } from "../validator.js";
import { createTestProgram } from "./helpers.js";

describe("Static Safety Validation", () => {
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

    it("should allow contextual Promise constructor inference without explicit type arguments", () => {
      const source = `
        export function delay(ms: number): Promise<void> {
          return new Promise((resolve) => {
            setTimeout(() => resolve(), ms);
          });
        }
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const typeArgDiag = diagnostics.diagnostics.find(
        (d) => d.code === "TSN5202"
      );
      expect(typeArgDiag).to.equal(undefined);
    });
  });

  describe("TSN7413 - Dictionary key type validation", () => {
    it("should allow Record with string key", () => {
      const source = `
        const d: Record<string, number> = {};
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const keyDiag = diagnostics.diagnostics.find((d) => d.code === "TSN7413");
      expect(keyDiag).to.equal(undefined);
    });

    it("should allow Record with number key", () => {
      const source = `
        const d: Record<number, string> = {};
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

    it("should allow index signature with number key", () => {
      const source = `
        interface NumIndexed {
          [key: number]: string;
        }
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const keyDiag = diagnostics.diagnostics.find((d) => d.code === "TSN7413");
      expect(keyDiag).to.equal(undefined);
    });

    it("should reject Record with symbol key", () => {
      const source = `
        const d: Record<symbol, string> = {};
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const keyDiag = diagnostics.diagnostics.find((d) => d.code === "TSN7413");
      expect(keyDiag).not.to.equal(undefined);
    });

    it("should reject index signature with symbol key", () => {
      const source = `
        interface SymIndexed {
          [key: symbol]: string;
        }
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const keyDiag = diagnostics.diagnostics.find((d) => d.code === "TSN7413");
      expect(keyDiag).not.to.equal(undefined);
    });

    it("should reject symbol-typed key values in dictionary access", () => {
      const source = `
        function read(table: Record<symbol, number>, key: symbol): number {
          return table[key];
        }
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const keyDiag = diagnostics.diagnostics.find((d) => d.code === "TSN7413");
      const typeDiag = diagnostics.diagnostics.find(
        (d) => d.code === "TSN7414"
      );
      expect(keyDiag).not.to.equal(undefined);
      expect(typeDiag).to.equal(undefined);
    });

    it("should reject Record with object key type", () => {
      const source = `
        interface Key { id: string; }
        const d: Record<Key, string> = {};
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const keyDiag = diagnostics.diagnostics.find((d) => d.code === "TSN7413");
      expect(keyDiag).not.to.equal(undefined);
    });
  });

  describe("Intersection types are supported", () => {
    it("should allow intersection type", () => {
      const source = `
        interface Named { name: string; }
        interface Aged { age: number; }
        type Person = Named & Aged;
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const intDiag = diagnostics.diagnostics.find((d) => d.code === "TSN7410");
      expect(intDiag).to.equal(undefined);
    });

    it("should allow nested intersection type", () => {
      const source = `
        interface A { a: string; }
        interface B { b: number; }
        interface C { c: boolean; }
        type ABC = A & B & C;
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const intDiag = diagnostics.diagnostics.find((d) => d.code === "TSN7410");
      expect(intDiag).to.equal(undefined);
    });
  });
});
