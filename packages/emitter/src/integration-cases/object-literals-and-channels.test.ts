import { describe, it } from "mocha";
import { expect } from "chai";
import { compileToCSharp } from "./helpers.js";

describe("End-to-End Integration", () => {
  describe("Object Literal Methods", () => {
    it("rejects arguments.length in object literal methods", () => {
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

      expect(() => compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      })).to.throw("JavaScript 'arguments' is not supported");
    });

    it("rejects arguments index access in object literal methods", () => {
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

      expect(() => compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      })).to.throw("JavaScript 'arguments' is not supported");
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
