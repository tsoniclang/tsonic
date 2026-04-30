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

    it("rejects JavaScript string and array length on the default surface", () => {
      const result = runValidation(`
        export function run(text: string, items: readonly string[]): number {
          return text.length + items.length;
        }
      `);

      expect(
        hasDiagnostic(result, "TSN2001", "JavaScript surface member 'length'")
      ).to.equal(true);
    });

    it("allows source-owned length properties", () => {
      const result = runValidation(`
        type HasLength = { length: number };

        export function run(value: HasLength): number {
          return value.length;
        }
      `);

      expect(hasDiagnostic(result, "TSN2001")).to.equal(false);
      expect(hasDiagnostic(result, "TSN5001")).to.equal(false);
    });

    it("allows CLR-style Length spelling on the default surface", () => {
      const result = runValidation(`
        export function run(items: readonly string[]): number {
          return items.Length;
        }
      `);

      expect(hasDiagnostic(result, "TSN2001")).to.equal(false);
      expect(hasDiagnostic(result, "TSN5001")).to.equal(false);
    });
  });
});
