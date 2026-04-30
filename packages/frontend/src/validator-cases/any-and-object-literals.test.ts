/**
 * Static Safety - Any Type & Object Literal tests
 *
 * Covers:
 * - TSN7401: 'any' type banned
 * - unknown as an emitted broad boundary type
 * - TSN7403: Object literal requires nominal type
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { validateProgram } from "../validator.js";
import { createTestProgram } from "./helpers.js";

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
      expect(anyDiag?.message).to.include("'any' type assertion");
    });

    it("should allow broad any signatures on erased overload stubs", () => {
      const source = `
        import { overloads as O } from "@tsonic/core/lang.js";

        export function parse(text: string): string;
        export function parse(bytes: Uint8Array): string;
        export function parse(value: any): any {
          return value;
        }

        export function parse_text(text: string): string {
          return text;
        }

        export function parse_bytes(bytes: Uint8Array): string {
          return String(bytes.length);
        }

        O(parse_text).family(parse);
        O(parse_bytes).family(parse);
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const anyDiag = diagnostics.diagnostics.find((d) => d.code === "TSN7401");
      expect(anyDiag).to.equal(undefined);
    });
  });

  describe("unknown broad boundary typing", () => {
    it("should allow explicit unknown type annotation", () => {
      const source = `
        export function process(data: unknown): void {
          console.log(data);
        }
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const unknownDiag = diagnostics.diagnostics.find(
        (d) => d.code === "TSN7402"
      );
      expect(unknownDiag).to.equal(undefined);
    });

    it("should allow 'as unknown' type assertion", () => {
      const source = `
        export const x = (123 as unknown);
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const unknownDiag = diagnostics.diagnostics.find(
        (d) => d.code === "TSN7402"
      );
      expect(unknownDiag).to.equal(undefined);
    });

    it("should allow broad unknown signatures on erased overload stubs", () => {
      const source = `
        import { overloads as O } from "@tsonic/core/lang.js";

        export function parse(text: string): string;
        export function parse(bytes: Uint8Array): string;
        export function parse(value: unknown): unknown {
          return value;
        }

        export function parse_text(text: string): string {
          return text;
        }

        export function parse_bytes(bytes: Uint8Array): string {
          return String(bytes.length);
        }

        O(parse_text).family(parse);
        O(parse_bytes).family(parse);
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const unknownDiag = diagnostics.diagnostics.find(
        (d) => d.code === "TSN7402"
      );
      expect(unknownDiag).to.equal(undefined);
    });
  });

  describe("TSN7403 - Object literal requires nominal type", () => {
    it("should allow simple object literal (auto-synthesis)", () => {
      // Simple object literals with identifier keys are now synthesized automatically
      const source = `
        const a = { x: 1 };
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const objDiag = diagnostics.diagnostics.find((d) => d.code === "TSN7403");
      expect(objDiag).to.equal(undefined);
    });

    it("should allow object literal with method shorthand", () => {
      const source = `
        const a = { foo(x: number): number { return x + 1; } };
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const objDiag = diagnostics.diagnostics.find((d) => d.code === "TSN7403");
      expect(objDiag).to.equal(undefined);
    });

    it("should allow object literal with computed string-literal method key", () => {
      const source = `
        const a = { ["foo"](x: number): number { return x + 1; } };
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const objDiag = diagnostics.diagnostics.find((d) => d.code === "TSN7403");
      expect(objDiag).to.equal(undefined);
    });

    it("should allow object literal with computed const-literal property and accessor keys", () => {
      const source = `
        const valueKey = "value";
        const doubledKey = "doubled";
        const a = {
          [valueKey]: 2,
          get [doubledKey](): number {
            return this.value * 2;
          },
        };
        void a.doubled;
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const objDiag = diagnostics.diagnostics.find((d) => d.code === "TSN7403");
      expect(objDiag).to.equal(undefined);
    });

    it("should allow object literal with computed const-literal numeric property key", () => {
      const source = `
        const slot = 1;
        const a = { [slot]: 7 };
        void a;
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const objDiag = diagnostics.diagnostics.find((d) => d.code === "TSN7403");
      expect(objDiag).to.equal(undefined);
    });

    it("should allow object literal method shorthand that uses this", () => {
      const source = `
        const a = {
          x: 1,
          foo(): number {
            return this.x;
          },
        };
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const objDiag = diagnostics.diagnostics.find((d) => d.code === "TSN7403");
      expect(objDiag).to.equal(undefined);
    });

    it("should allow object literal method shorthand that uses arguments.length with fixed required parameters", () => {
      const source = `
        const a = {
          foo(x: number): number {
            return arguments.length + x;
          },
        };
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const objDiag = diagnostics.diagnostics.find((d) => d.code === "TSN7403");
      expect(objDiag).to.equal(undefined);
    });

    it("should allow object literal method shorthand that uses arguments[n] with fixed required identifier parameters", () => {
      const source = `
        const a = {
          foo(x: number, y: number): number {
            return (arguments[0] as number) + y;
          },
        };
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const objDiag = diagnostics.diagnostics.find((d) => d.code === "TSN7403");
      expect(objDiag).to.equal(undefined);
    });

    it("should reject object literal method shorthand that uses unsupported arguments patterns", () => {
      const source = `
        const a = {
          foo(x?: number): number {
            return arguments[0] as number;
          },
        };
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const objDiag = diagnostics.diagnostics.find((d) => d.code === "TSN7403");
      expect(objDiag).not.to.equal(undefined);
      expect(objDiag?.message).to.include("arguments");
    });

    it("should allow object literal getter shorthand", () => {
      const source = `
        const a = {
          get foo(): number {
            return 1;
          },
        };
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const objDiag = diagnostics.diagnostics.find((d) => d.code === "TSN7403");
      expect(objDiag).to.equal(undefined);
    });

    it("should allow object literal getter shorthand that returns this-bound property type", () => {
      const source = `
        const counter = {
          x: 1,
          get value() {
            return this.x;
          },
        };
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const objDiag = diagnostics.diagnostics.find((d) => d.code === "TSN7403");
      expect(objDiag).to.equal(undefined);
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

    it("should reject object literal assigned to broad object type", () => {
      const source = `
        const value: object = { x: 1 };
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const objDiag = diagnostics.diagnostics.find((d) => d.code === "TSN7403");
      expect(objDiag).not.to.equal(undefined);
      expect(objDiag?.message).to.include("broad runtime object type");
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
});
