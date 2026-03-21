import { describe, it } from "mocha";
import { expect } from "chai";
import { runValidation, hasDiagnostic } from "./test-helpers.js";

describe("validateUnsupportedFeatures", () => {
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
