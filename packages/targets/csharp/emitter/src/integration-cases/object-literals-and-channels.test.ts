import { describe, it } from "mocha";
import { expect } from "chai";
import { compileToCSharp } from "./helpers.js";

describe("End-to-End Integration", () => {
  describe("Function Return Contracts", () => {
    it("emits assertion functions as void methods", () => {
      const source = `
        export function fail(reason: string): never {
          throw new Error(reason);
        }

        export function assert(value: boolean): asserts value {
          if (value) return;
          fail("False expression.");
        }
      `;

      const csharp = compileToCSharp(source, "/test/debug.ts", {
        surface: "@tsonic/js",
      });

      expect(csharp).to.include("public static void assert(bool value)");
      expect(csharp).to.include("if (value)");
      expect(csharp).to.include("return;");
      expect(csharp).not.to.include("public static bool assert");
    });

    it("emits method-bearing anonymous structural parameters as native interfaces", () => {
      const source = `
        export function fail(reason: string): never {
          throw new Error(reason);
        }

        export function failBadSyntaxKind(node: { kindString(): string }): never {
          fail(\`Node \${node.kindString()} was unexpected.\`);
        }
      `;

      const csharp = compileToCSharp(source, "/test/debug.ts", {
        surface: "@tsonic/js",
      });

      expect(csharp).to.match(
        /public interface __Anon_[A-Za-z0-9_]+[\s\S]*string kindString\(\);/
      );
      expect(csharp).to.match(
        /public static void failBadSyntaxKind\(global::Test\.__Anon_[A-Za-z0-9_]+ node\)/
      );
      expect(csharp).to.include(".kindString()");
    });
  });

  describe("Object Literal Methods", () => {
    it("lowers arguments.length in object literal methods from declared parameters", () => {
      const source = `
        interface Ops {
          add: (x: number, y: number) => number;
        }

        export function run(): number {
          const ops: Ops = {
            add(x: number, y: number): number {
              return arguments.length + x + y;
            },
          };
          return ops.add(1, 2);
        }
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });

      expect(csharp).to.include("add = (double x, double y) =>");
      expect(csharp).to.include("return 2 + x + y;");
      expect(csharp).not.to.include("arguments");
    });

    it("lowers arguments index access in object literal methods from declared parameters", () => {
      const source = `
        interface Ops {
          add: (x: number, y: number) => number;
        }

        export function run(): number {
          const ops: Ops = {
            add(x: number, y: number): number {
              return (arguments[0] as number) + y;
            },
          };
          return ops.add(1, 2);
        }
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });

      expect(csharp).to.include("add = (double x, double y) =>");
      expect(csharp).to.include("var __tsonic_object_method_argument_0 = x;");
      expect(csharp).to.include(
        "return __tsonic_object_method_argument_0 + y;"
      );
      expect(csharp).not.to.include("arguments");
    });
  });

  describe("Semantic/Storage Channel Integration", () => {
    it("instanceof guard reads semantic union type for local variable narrowing", () => {
      const source = `
        class Dog {
          bark(): string { return "woof"; }
        }
        class Cat {
          meow(): string { return "meow"; }
        }

        export function speak(pet: Dog | Cat): string {
          if (pet instanceof Dog) {
            return pet.bark();
          }
          return pet.meow();
        }
      `;

      const csharp = compileToCSharp(source);
      // The guard analysis should correctly narrow the union parameter
      // using the semantic type (Dog | Cat), not a storage-normalized carrier.
      // Both branches should produce valid method calls.
      expect(csharp).to.include("bark()");
      expect(csharp).to.include("meow()");
    });
  });
});
