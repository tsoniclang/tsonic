import { describe, it } from "mocha";
import { expect } from "chai";
import { compileToCSharp } from "./helpers.js";

describe("End-to-End Integration", () => {
  describe("Object Literal Methods", () => {
    it("rewrites supported arguments.length usage to a fixed arity literal", () => {
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

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("return 2 + x + y;");
      expect(csharp).not.to.include("arguments");
    });

    it("rewrites supported arguments[n] usage to captured parameter temps", () => {
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

      const csharp = compileToCSharp(source);
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
