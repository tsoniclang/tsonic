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
            onrejected?: ((reason: JsValue) => TResult2 | PromiseLike<TResult2>) | undefined | null
          ): PromiseLike<TResult1 | TResult2>;
        }

        declare class Promise<T> {
          constructor(
            executor: (
              resolve: (value: T | PromiseLike<T>) => void,
              reject: (reason: JsValue) => void
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
        /\(\(global::System\.Action<global::System\.Action,\s*global::System\.Action<object\?>>\)\(\(global::System\.Action\s+resolve,\s*global::System\.Action<object\?>\s+__unused_reject\)\s*=>/
      );
      expect(csharp).not.to.include("new Promise(");
    });

    it("normalizes Promise executor resolve callbacks to the promised value type", () => {
      const source = `
        interface PromiseLike<T> {
          then<TResult1 = T, TResult2 = never>(
            onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
            onrejected?: ((reason: JsValue) => TResult2 | PromiseLike<TResult2>) | undefined | null
          ): PromiseLike<TResult1 | TResult2>;
        }

        declare class Promise<T> {
          constructor(
            executor: (
              resolve: (value: T | PromiseLike<T>) => void,
              reject: (reason?: JsValue) => void
            ) => void
          );
        }

        export function once(): Promise<JsValue[]> {
          return new Promise<JsValue[]>((resolve) => {
            resolve([]);
          });
        }
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.include("Action<object?[]> __tsonic_resolve");
      expect(csharp).to.match(
        /\(global::System\.Action<object\?\[]>\s+resolve,\s*global::System\.Action<object\?>\s+__unused_reject\)\s*=>/
      );
      expect(csharp).not.to.include(
        "Action<global::Tsonic.Internal.Union<object?[], global::System.Threading.Tasks.Task>> resolve"
      );
    });

    it("does not re-wrap promised array values when resolve is called inside nested callbacks", () => {
      const source = `
        interface PromiseLike<T> {
          then<TResult1 = T, TResult2 = never>(
            onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
            onrejected?: ((reason: JsValue) => TResult2 | PromiseLike<TResult2>) | undefined | null
          ): PromiseLike<TResult1 | TResult2>;
        }

        declare class Promise<T> {
          constructor(
            executor: (
              resolve: (value: T | PromiseLike<T>) => void,
              reject: (reason?: JsValue) => void
            ) => void
          );
        }

        declare class EventEmitter {
          once(eventName: string, listener: (...args: JsValue[]) => void): EventEmitter;
        }

        export function once(emitter: EventEmitter): Promise<JsValue[]> {
          return new Promise<JsValue[]>((resolve) => {
            emitter.once("done", (...args: JsValue[]) => {
              resolve(args);
            });
          });
        }
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.include("Action<object?[]> __tsonic_resolve");
      expect(csharp).to.include("resolve(args);");
      expect(csharp).not.to.include(
        "resolve(global::Tsonic.Internal.Union<object?[], global::System.Threading.Tasks.Task<object?[]>>"
      );
    });

    it("does not re-wrap promised string values when resolve is called inside nested callbacks", () => {
      const source = `
        interface PromiseLike<T> {
          then<TResult1 = T, TResult2 = never>(
            onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
            onrejected?: ((reason: JsValue) => TResult2 | PromiseLike<TResult2>) | undefined | null
          ): PromiseLike<TResult1 | TResult2>;
        }

        declare class Promise<T> {
          constructor(
            executor: (
              resolve: (value: T | PromiseLike<T>) => void,
              reject: (reason?: JsValue) => void
            ) => void
          );
        }

        declare function String(value?: JsValue): string;

        export function readLine(): Promise<string> {
          return new Promise<string>((resolve) => {
            const lineListener = (...args: JsValue[]): void => {
              if (args.length > 0 && typeof args[0] === "string") {
                resolve(String(args[0]));
              }
            };

            lineListener("ok");
          });
        }
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.include("Action<string> __tsonic_resolve");
      expect(csharp).to.include("resolve(String((object)(object)args[0]));");
      expect(csharp).not.to.include(
        "resolve(global::Tsonic.Internal.Union<global::System.Threading.Tasks.Task<string>, string>"
      );
    });

    it("lowers expression-bodied void callbacks as statements when the body is already void", () => {
      const source = `
        declare function take(action: () => void): void;
        declare function chdir(path: string): void;

        export function run(): void {
          take(() => chdir("tmp"));
        }
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.include('chdir("tmp")');
      expect(csharp).not.to.include("__tsonic_discard");
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
        /public\s+static\s+bool\s+isDog\s*\(\s*(?:global::Test\.)?Dog\s+animal\s*\)/
      );
      // Should not emit 'dynamic' (old broken behavior)
      expect(csharp).not.to.include("dynamic isDog");
    });
  });
});
