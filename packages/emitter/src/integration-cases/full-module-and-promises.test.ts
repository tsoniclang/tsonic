import { describe, it } from "mocha";
import { expect } from "chai";
import { compileToCSharp } from "./helpers.js";

describe("End-to-End Integration", () => {
  describe("Full Module Compilation", () => {
    it("should compile a complete module with all features", () => {
      const source = `
        import { int } from "@tsonic/core/types.js";

        // Type definitions
        export interface User {
          id: number;
          name: string;
          email?: string;
        }

        export type UserId = number;

        // User repository
        export class UserRepository {
          private users: User[] = [];

          add(user: User): void {
            this.users.push(user);
          }

          findById(id: UserId): User | undefined {
            for (let i: int = 0; i < this.users.Length; i++) {
              if (this.users[i].id === id) {
                return this.users[i];
              }
            }
            return undefined;
          }

          all(): User[] {
            return this.users;
          }
        }

        // Generic utility function with manual iteration
        export function transform<T, U>(arr: T[], fn: (item: T) => U): U[] {
          const result: U[] = [];
          for (let i: int = 0; i < arr.Length; i++) {
            result.push(fn(arr[i]));
          }
          return result;
        }
      `;

      const csharp = compileToCSharp(source);

      // Should have all type definitions
      expect(csharp).to.include("class User");
      // Non-structural aliases are erased; usage sites should still resolve correctly.
      expect(csharp).to.not.include("// type UserId = double");
      expect(csharp).to.match(/findById\s*\(\s*double\s+id\s*\)/i);

      // Should have the repository class
      expect(csharp).to.include("class UserRepository");

      // Should have the generic function with native array return type
      expect(csharp).to.match(/public\s+static\s+U\[\]\s+transform\s*<T,\s*U>/);

      // Should have proper namespace structure
      expect(csharp).to.include("namespace Test");
      expect(csharp).to.include("public static class test");
    });

    it("is deterministic across sequential compiles (no cross-program alias cache bleed)", () => {
      const seedSource = `
        export type UserId = string;
        export function seed(id: UserId): UserId {
          return id;
        }
      `;

      const targetSource = `
        export interface User {
          id: number;
        }

        export type UserId = number;

        export class UserRepository {
          findById(id: UserId): User | undefined {
            return undefined;
          }
        }
      `;

      compileToCSharp(seedSource);
      const csharp = compileToCSharp(targetSource);
      expect(csharp).to.match(/findById\s*\(\s*double\s+id\s*\)/i);
    });

    it("does not leak structural alias property types across compiles", () => {
      const seedSource = `
        export type Payload = {
          value: string;
        };
      `;

      const targetSource = `
        export type Payload = {
          value: number;
        };

        export function read(input: Payload): number {
          return input.value;
        }
      `;

      compileToCSharp(seedSource);
      const csharp = compileToCSharp(targetSource);
      expect(csharp).to.match(
        /class\s+Payload__Alias[\s\S]*required\s+double\s+value\s*\{/i
      );
      expect(csharp).to.match(/read\s*\(\s*Payload__Alias\s+input\s*\)/i);
      expect(csharp).not.to.match(
        /class\s+Payload__Alias[\s\S]*required\s+string\s+value\s*\{/i
      );
    });

    it("keeps compile outputs independent when same alias name is reused", () => {
      const sourceA = `
        export type UserId = string;
        export interface User {
          id: UserId;
        }
      `;

      const sourceB = `
        export type UserId = number;
        export interface User {
          id: UserId;
        }
      `;

      const csharpA = compileToCSharp(sourceA);
      const csharpB = compileToCSharp(sourceB);
      const csharpAAgain = compileToCSharp(sourceA);

      expect(csharpA).to.match(/required\s+string\s+id\s*\{/i);
      expect(csharpB).to.match(/required\s+double\s+id\s*\{/i);
      expect(csharpAAgain).to.match(/required\s+string\s+id\s*\{/i);
      expect(csharpAAgain).not.to.match(/required\s+double\s+id\s*\{/i);
    }).timeout(15000);

    it("emits direct IteratorResult property access for async generator next results", () => {
      const source = `
        export async function* ticks(): AsyncGenerator<string, void, JsValue> {
          yield "tick";
        }

        export async function readFirst(): Promise<string> {
          const iterator = ticks();
          const first = await iterator.next();
          return first.done === true ? "" : first.value;
        }
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.include("global::Tsonic.Runtime.IteratorResult<string>");
      expect(csharp).to.include("first.done");
      expect(csharp).to.include("first.value");
      expect(csharp).to.not.include("first.Match");
    });

    it("emits direct IteratorResult property access for alias-based iterator results", () => {
      const source = `
        type IteratorYieldResult<T> = {
          done: false;
          value: T;
        };

        type IteratorReturnResult<TReturn> = {
          done: true;
          value: TReturn;
        };

        type IteratorResult<T, TReturn = JsValue> =
          | IteratorYieldResult<T>
          | IteratorReturnResult<TReturn>;

        declare const iterator: {
          next(): Promise<IteratorResult<string>>;
        };

        export async function readFirst(): Promise<string> {
          const first = await iterator.next();
          return first.done === true ? "" : first.value;
        }
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.include("first.done");
      expect(csharp).to.include("first.value");
      expect(csharp).to.not.include("first.Match");
    });
  });

  describe("Promise Chains", () => {
    it("lowers Promise.then to Task.Run async wrapper", () => {
      const source = `
        declare class Promise<T> {
          then<U>(onFulfilled: (value: T) => U | PromiseLike<U>): Promise<U>;
          catch<U>(onRejected: (reason: JsValue) => U | PromiseLike<U>): Promise<T | U>;
          finally(onFinally: () => void): Promise<T>;
          static resolve<T>(value: T): Promise<T>;
        }
        interface PromiseLike<T> {}

        export async function load(): Promise<number> {
          return 1;
        }

        export async function run(): Promise<number> {
          const p = load();
          return p.then((x) => x + 1);
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("Task.Run<double>(async");
      expect(csharp).to.include("await p");
    });

    it("normalizes Promise.then callback PromiseLike return to inner result type", () => {
      const source = `
        declare class Promise<T> {
          then<U>(onFulfilled: (value: T) => U | PromiseLike<U>): Promise<U>;
          static resolve<T>(value: T): Promise<T>;
        }
        interface PromiseLike<T> {}

        export async function load(): Promise<number> {
          return 1;
        }

        export async function run(): Promise<number> {
          const p = load();
          return p.then((x) => Promise.resolve(x + 1));
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("Task.Run<double>(async");
      expect(csharp).not.to.include("Task.Run<global::Tsonic.Runtime.Union");
    });

    it("preserves int result when Promise.then callback stays in int space", () => {
      const source = `
        import { int } from "@tsonic/core/types.js";

        declare class Promise<T> {
          then<U>(onFulfilled: (value: T) => U | PromiseLike<U>): Promise<U>;
        }
        interface PromiseLike<T> {}

        export async function load(): Promise<int> {
          return 1;
        }

        export async function run(): Promise<int> {
          const p = load();
          return p.then((x) => x + 1);
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("Task.Run<int>(async");
      expect(csharp).not.to.include("Task.Run<double>(async");
    });

    it("lowers Promise.catch to Task.Run with try/catch", () => {
      const source = `
        declare class Promise<T> {
          then<U>(onFulfilled: (value: T) => U | PromiseLike<U>): Promise<U>;
          catch<U>(onRejected: (reason: JsValue) => U | PromiseLike<U>): Promise<T | U>;
          finally(onFinally: () => void): Promise<T>;
          static resolve<T>(value: T): Promise<T>;
        }
        interface PromiseLike<T> {}

        export async function load(): Promise<number> {
          return 1;
        }

        export async function run(): Promise<number> {
          const p = load();
          return p.catch((_e) => 0);
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("Task.Run");
      expect(csharp).to.include(
        "catch (global::System.Exception __tsonic_promise_ex)"
      );
    });

    it("lowers Promise.finally to Task.Run with finally", () => {
      const source = `
        declare class Promise<T> {
          then<U>(onFulfilled: (value: T) => U | PromiseLike<U>): Promise<U>;
          catch<U>(onRejected: (reason: JsValue) => U | PromiseLike<U>): Promise<T | U>;
          finally(onFinally: () => void): Promise<T>;
          static resolve<T>(value: T): Promise<T>;
        }
        interface PromiseLike<T> {}

        export async function load(): Promise<number> {
          return 1;
        }

        export async function run(): Promise<number> {
          const p = load();
          return p.finally(() => {});
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("Task.Run<double>(async");
      expect(csharp).to.include("finally");
    });

    it("keeps Promise chains on the frontend-normalized result type", () => {
      const source = `
        import type { int } from "@tsonic/core/types.js";

        declare class Promise<T> {
          then<U>(onFulfilled: (value: T) => U | PromiseLike<U>): Promise<U>;
          catch<U>(onRejected: (reason: JsValue) => U | PromiseLike<U>): Promise<T | U>;
          finally(onFinally: () => void): Promise<T>;
        }
        interface PromiseLike<T> {}

        export function chainScore(seed: Promise<int>): Promise<int> {
          return seed
            .then((value) => value + 1)
            .catch((_error) => 0)
            .finally(() => {});
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("Task.Run<int>(async");
      expect(csharp).not.to.include("Task.Run<global::Tsonic.Runtime.Union");
    });

    it("lets Promise.catch delegate casts supply exception parameter types", () => {
      const source = `
        import type { int } from "@tsonic/core/types.js";

        declare class Promise<T> {
          catch<TResult>(
            onrejected: ((reason: JsValue) => TResult | PromiseLike<TResult>) | undefined | null
          ): Promise<T | TResult>;
        }
        interface PromiseLike<T> {}

        export function recover(seed: Promise<int>): Promise<int> {
          return seed.catch((_error) => 0);
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("Func<global::System.Exception, int>");
      expect(csharp).not.to.include("(object _error) => 0");
    });

    it("uses Action for block-bodied void callbacks in Promise chains", () => {
      const source = `
        declare class Promise<T> {
          then<U>(onFulfilled: (value: T) => U | PromiseLike<U>): Promise<U>;
        }
        interface PromiseLike<T> {}

        export function chain(seed: Promise<number>): Promise<void> {
          return seed.then(() => {});
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("global::System.Action");
      expect(csharp).not.to.include(
        "global::System.Func<global::Tsonic.Runtime.Union<void"
      );
    });
  });

  describe("Promise Static Methods", () => {
    it("lowers Promise.all to Task.WhenAll over normalized task inputs", () => {
      const source = `
        interface PromiseLike<T> {
          then<TResult1 = T, TResult2 = never>(
            onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
            onrejected?: ((reason: JsValue) => TResult2 | PromiseLike<TResult2>) | undefined | null
          ): PromiseLike<TResult1 | TResult2>;
        }

        declare class Promise<T> {
          static all<T>(values: readonly (T | PromiseLike<T>)[]): Promise<T[]>;
        }

        async function runWorker(name: string): Promise<number> {
          return 1;
        }

        export async function main(): Promise<void> {
          const results = await Promise.all([
            runWorker("a"),
            runWorker("b"),
            runWorker("c"),
          ]);
          void results;
        }
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.include("Task.WhenAll");
      expect(csharp).to.include("Enumerable.Select");
      expect(csharp).to.include(
        "global::System.Threading.Tasks.Task<double>"
      );
      expect(csharp).not.to.include(
        "global::Tsonic.Runtime.Union<global::System.Threading.Tasks.Task<T>, T>"
      );
      expect(csharp).not.to.include("Promise.all(");
    });

    it("lowers Promise.resolve to Task.FromResult", () => {
      const source = `
        declare class PromiseLike<T> {}
        declare class Promise<T> {
          static resolve<T>(value: T | PromiseLike<T>): Promise<T>;
        }

        export function main(): Promise<number> {
          const value: number = 1;
          return Promise.resolve(value);
        }
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.include("Task.FromResult<double>");
      expect(csharp).not.to.include("Promise.resolve(");
    });

    it("lowers Promise.reject to Task.FromException", () => {
      const source = `
        declare class Promise<T> {
          static reject<T = never>(reason?: JsValue): Promise<T>;
        }

        export function main(): Promise<number> {
          return Promise.reject<number>("boom");
        }
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.include("Task.FromException<double>");
      expect(csharp).to.include('"Promise rejected"');
      expect(csharp).not.to.include("Promise.reject(");
    });

    it("uses contextual promise result type for Promise.reject in lambda bodies", () => {
      const source = `
        declare class Error {
          constructor(message?: string);
        }

        declare class Promise<T> {
          static reject<T = never>(reason?: JsValue): Promise<T>;
        }

        export function main(): void {
          const operation = (): Promise<JsValue> => Promise.reject(new Error("boom"));
          void operation;
        }
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.include("System.Func<global::System.Threading.Tasks.Task<object?>>");
      expect(csharp).to.include("Task.FromException<object?>");
      expect(csharp).not.to.include("Task.FromException(new");
    });

    it("prefers concrete contextual JS-surface promise results over unresolved reject generics", () => {
      const source = `
        declare class Error {
          constructor(message?: string);
        }

        export function main(): void {
          const operation = (): Promise<JsValue> => Promise.reject(new Error("boom"));
          void operation;
        }
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });

      expect(csharp).to.include("System.Func<global::System.Threading.Tasks.Task<object?>>");
      expect(csharp).to.include("Task.FromException<object?>");
      expect(csharp).not.to.include("Task.FromException<T>");
    });
  });
});
