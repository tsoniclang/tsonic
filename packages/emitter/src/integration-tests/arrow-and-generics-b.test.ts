import { describe, it } from "mocha";
import { expect } from "chai";
import { compileToCSharp } from "./helpers.js";

describe("End-to-End Integration", () => {
  describe("Lambda Parameter Type Inference", () => {
    it("should infer types for Promise executor callback parameters", () => {
      const source = `
        // Inline minimal types for this test
        declare function setTimeout(fn: () => void, ms: number): void;
        declare class Promise<T> {
          constructor(executor: (resolve: () => void) => void);
        }

        export function delay(ms: number): Promise<void> {
          return new Promise((resolve) => {
            setTimeout(resolve, ms);
          });
        }
      `;

      const csharp = compileToCSharp(source);

      // Should emit lambda with typed resolve parameter (function type becomes Action)
      // The key is that resolve has a type annotation, not just the bare identifier
      expect(csharp).to.match(/\(global::System\.Action.*\s+resolve\)\s*=>/);
    });

    it("infers Promise constructor generic from contextual return type", () => {
      const source = `
        declare function setTimeout(fn: () => void, ms: number): void;

        interface PromiseLike<T> {
          then<TResult1 = T, TResult2 = never>(
            onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
            onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null
          ): PromiseLike<TResult1 | TResult2>;
        }

        declare class Promise<T> {
          constructor(
            executor: (
              resolve: (value: T | PromiseLike<T>) => void,
              reject: (reason: unknown) => void
            ) => void
          );
        }

        export function delay(ms: number): Promise<void> {
          return new Promise((resolve) => {
            setTimeout(() => resolve(), ms);
          });
        }
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.include("TaskCompletionSource<bool>");
      expect(csharp).to.match(
        /\(\(global::System\.Action<global::System\.Action,\s*global::System\.Action<object\?>>\)\(\(resolve,\s*__unused_reject\)\s*=>/
      );
      expect(csharp).not.to.include("new Promise(");
    });

    it("should infer types for generic method callbacks", () => {
      const source = `
        // Custom generic class with map method (valid in dotnet mode)
        export class Box<T> {
          value: T;
          constructor(value: T) {
            this.value = value;
          }
          map<U>(fn: (x: T) => U): Box<U> {
            return new Box<U>(fn(this.value));
          }
        }

        export function doubleBox(box: Box<number>): Box<number> {
          return box.map((n) => n * 2);
        }
      `;

      const csharp = compileToCSharp(source);

      // Should emit lambda with typed parameter
      // n should be inferred as number (double in C#) from Box<number>.map's callback type
      expect(csharp).to.include("(double n) => n * 2");
    });
  });

  describe("Type Predicate Functions", () => {
    it("should emit type predicate return type as bool", () => {
      const source = `
        export interface Dog {
          type: "dog";
          bark(): void;
        }

        export type Animal = Dog;

        export function isDog(animal: Animal): animal is Dog {
          return animal.type === "dog";
        }
      `;

      const csharp = compileToCSharp(source);

      // Type predicate (animal is Dog) should emit as bool return type.
      // Note: `Animal` is a TS type alias and does not become a C# type; the emitter
      // resolves non-structural aliases at use sites, so the parameter type is `Dog`.
      expect(csharp).to.match(
        /public\s+static\s+bool\s+isDog\s*\(\s*Dog\s+animal\s*\)/
      );
      // Should not emit 'dynamic' (old broken behavior)
      expect(csharp).not.to.include("dynamic isDog");
    });
  });

});
