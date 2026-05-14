import { describe, it } from "mocha";
import { expect } from "chai";
import { runValidation, hasDiagnostic } from "./test-helpers.js";

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
          "'with' statement is not supported in strict NativeAOT mode"
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

    it("rejects import.meta.url", () => {
      const result = runValidation(`
        const url = import.meta.url;
        console.log(url);
      `);

      expect(hasDiagnostic(result, "TSN2001", "import.meta")).to.equal(true);
    });

    it("rejects import.meta.filename", () => {
      const result = runValidation(`
        const file = import.meta.filename;
        console.log(file);
      `);

      expect(hasDiagnostic(result, "TSN2001", "import.meta")).to.equal(true);
    });

    it("rejects import.meta.dirname", () => {
      const result = runValidation(`
        const dir = import.meta.dirname;
        console.log(dir);
      `);

      expect(hasDiagnostic(result, "TSN2001", "import.meta")).to.equal(true);
    });

    it("rejects unsupported import.meta fields", () => {
      const result = runValidation(`
        const bad = import.meta.env;
        console.log(bad);
      `);

      expect(hasDiagnostic(result, "TSN2001", "import.meta")).to.equal(true);
    });

    it("rejects bare import.meta object usage", () => {
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

      expect(hasDiagnostic(result, "TSN2001", "import.meta")).to.equal(true);
    });

    it("rejects dynamic import() when returned as a value", () => {
      const result = runValidation(`
        async function load() {
          return import("./module.js");
        }
      `);

      expect(hasDiagnostic(result, "TSN2001", "Dynamic import()")).to.equal(
        true
      );
    });

    it("rejects await import() when module namespace is consumed", () => {
      const result = runValidation(`
        async function load() {
          const module = await import("./module.js");
          return module.value;
        }
      `);

      expect(hasDiagnostic(result, "TSN2001", "Dynamic import()")).to.equal(
        true
      );
    });

    it("rejects dynamic import() in side-effect form", () => {
      const result = runValidation(`
        async function load() {
          import("./module.js");
        }
      `);

      expect(hasDiagnostic(result, "TSN2001", "Dynamic import()")).to.equal(
        true
      );
    });

    it("rejects awaited dynamic import() in side-effect form", () => {
      const result = runValidation(`
        async function load() {
          await import("./module.js");
        }
      `);

      expect(hasDiagnostic(result, "TSN2001", "Dynamic import()")).to.equal(
        true
      );
    });

    it("rejects dynamic import() side-effect form with non-literal specifier", () => {
      const result = runValidation(`
        async function load(name: string) {
          await import(name);
        }
      `);

      expect(hasDiagnostic(result, "TSN2001", "Dynamic import()")).to.equal(
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

    it("rejects JavaScript Array construction on the default surface", () => {
      const result = runValidation(`
        export function make(): number[] {
          return new Array<number>(4);
        }
      `);

      expect(
        hasDiagnostic(result, "TSN2001", "JavaScript surface API 'new Array")
      ).to.equal(true);
    });

    it("rejects JavaScript Array function calls on the default surface", () => {
      const result = runValidation(`
        export function make(): number[] {
          return Array(4);
        }
      `);

      expect(
        hasDiagnostic(result, "TSN2001", "JavaScript surface API 'Array")
      ).to.equal(true);
    });

    it("rejects the JavaScript in operator over broad object", () => {
      const result = runValidation(`
        export function hasName(value: object): boolean {
          return "name" in value;
        }
      `);

      expect(hasDiagnostic(result, "TSN2001", "'in' operator")).to.equal(true);
    });

    it("rejects the JavaScript in operator over declared object properties", () => {
      const result = runValidation(`
        export function hasName(value: { name?: string }): boolean {
          return "name" in value;
        }
      `);

      expect(hasDiagnostic(result, "TSN2001", "'in' operator")).to.equal(true);
    });

    it("rejects the JavaScript in operator over non-dictionary expressions", () => {
      const result = runValidation(`
        declare function getValue(): { name?: string };

        export function hasName(): boolean {
          return "name" in getValue();
        }
      `);

      expect(hasDiagnostic(result, "TSN2001", "'in' operator")).to.equal(true);
    });

    it("allows the JavaScript in operator over closed structural unions", () => {
      const result = runValidation(`
        type Success = { property_id: string };
        type Failure = { error: Promise<void> };

        export function hasError(value: Success | Failure): boolean {
          return "error" in value;
        }
      `);

      expect(hasDiagnostic(result, "TSN2001", "'in' operator")).to.equal(false);
    });

    it("allows for...in over string-key records", () => {
      const result = runValidation(`
        export function count(values: Record<string, number>): number {
          let total = 0;
          for (const key in values) {
            total = total + values[key];
          }
          return total;
        }
      `);

      expect(hasDiagnostic(result, "TSN2001", "for...in")).to.equal(false);
    });

    it("allows TypeScript public class modifiers", () => {
      const result = runValidation(`
        export class User {
          public name: string = "";
        }
      `);

      expect(
        hasDiagnostic(result, "TSN2001", "class modifier 'public'")
      ).to.equal(false);
    });

    it("allows TypeScript private class modifiers", () => {
      const result = runValidation(`
        export class User {
          private name: string = "";
        }
      `);

      expect(
        hasDiagnostic(result, "TSN2001", "class modifier 'private'")
      ).to.equal(false);
    });

    it("allows TypeScript protected class modifiers", () => {
      const result = runValidation(`
        export class User {
          protected getName(): string {
            return "";
          }
        }
      `);

      expect(
        hasDiagnostic(result, "TSN2001", "class modifier 'protected'")
      ).to.equal(false);
    });

    it("allows TypeScript readonly class field modifiers", () => {
      const result = runValidation(`
        export class User {
          readonly id: string = "";
        }
      `);

      expect(
        hasDiagnostic(result, "TSN2001", "class modifier 'readonly'")
      ).to.equal(false);
    });

    it("rejects TypeScript abstract class modifiers", () => {
      const result = runValidation(`
        export abstract class Base {
          abstract run(): void;
        }
      `);

      expect(
        hasDiagnostic(result, "TSN2001", "class modifier 'abstract'")
      ).to.equal(true);
    });

    it("rejects TypeScript constructor parameter properties", () => {
      const result = runValidation(`
        export class User {
          constructor(readonly name: string) {}
        }
      `);

      expect(
        hasDiagnostic(result, "TSN2001", "constructor parameter properties")
      ).to.equal(true);
    });

    it("allows deterministic object-literal method arguments.length lowering", () => {
      const result = runValidation(`
        const value = {
          count(x: number): number {
            return arguments.length + x;
          },
        };
        value.count(1);
      `);

      expect(hasDiagnostic(result, "TSN2001", "arguments")).to.equal(false);
    });

    it("allows deterministic object-literal method arguments index lowering", () => {
      const result = runValidation(`
        const value = {
          first(x: number): number {
            return arguments[0] as number;
          },
        };
        value.first(1);
      `);

      expect(hasDiagnostic(result, "TSN2001", "arguments")).to.equal(false);
    });

    it("allows ECMAScript private fields", () => {
      const result = runValidation(`
        export class User {
          #name: string = "";

          getName(): string {
            return this.#name;
          }
        }
      `);

      expect(hasDiagnostic(result, "TSN2001", "class modifier")).to.equal(
        false
      );
    });

    it("allows readonly type-only members", () => {
      const result = runValidation(`
        interface User {
          readonly id: string;
        }
        const user: User = { id: "u1" };
        console.log(user.id);
      `);

      expect(hasDiagnostic(result, "TSN2001", "readonly")).to.equal(false);
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
