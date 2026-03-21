import { describe, it } from "mocha";
import { expect } from "chai";
import {
  runValidation,
  runValidationInTempProject,
  hasDiagnostic,
} from "./test-helpers.js";

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
});
