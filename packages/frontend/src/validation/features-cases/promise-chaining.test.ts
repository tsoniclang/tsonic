import { describe, it } from "mocha";
import { expect } from "chai";
import { runValidation, hasDiagnostic } from "./test-helpers.js";

describe("validateUnsupportedFeatures", () => {
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
