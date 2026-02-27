/**
 * End-to-end integration tests for generics implementation
 * Tests the complete pipeline: TypeScript -> IR -> C#
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as ts from "typescript";
import {
  buildIrModule,
  DotnetMetadataRegistry,
  BindingRegistry,
  createClrBindingsResolver,
  createBinding,
  createProgramContext,
} from "@tsonic/frontend";
import { emitModule } from "./emitter.js";

/**
 * Helper to compile TypeScript source to C#
 */
const compileToCSharp = (
  source: string,
  fileName = "/test/test.ts"
): string => {
  // Phase 5: Each test creates fresh ProgramContext - no global cleanup needed

  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    strict: true,
    noEmit: true,
    noLib: true,
    skipLibCheck: true,
  };

  const host = ts.createCompilerHost(compilerOptions);
  const originalGetSourceFile = host.getSourceFile;
  host.getSourceFile = (
    name: string,
    languageVersionOrOptions: ts.ScriptTarget | ts.CreateSourceFileOptions,
    onError?: (message: string) => void,
    shouldCreateNewSourceFile?: boolean
  ) => {
    if (name === fileName) {
      return sourceFile;
    }
    return originalGetSourceFile.call(
      host,
      name,
      languageVersionOrOptions,
      onError,
      shouldCreateNewSourceFile
    );
  };

  const tsProgram = ts.createProgram([fileName], compilerOptions, host);
  const checker = tsProgram.getTypeChecker();

  const tsonicProgram = {
    program: tsProgram,
    checker,
    binding: createBinding(checker),
    options: {
      projectRoot: "/test",
      sourceRoot: "/test",
      rootNamespace: "Test",
    },
    sourceFiles: [sourceFile],
    declarationSourceFiles: [],
    metadata: new DotnetMetadataRegistry(),
    bindings: new BindingRegistry(),
    clrResolver: createClrBindingsResolver("/test"),
  };

  // Phase 5: Create ProgramContext for this compilation
  const options = { sourceRoot: "/test", rootNamespace: "Test" };
  const ctx = createProgramContext(tsonicProgram, options);

  // Build IR
  const irResult = buildIrModule(sourceFile, tsonicProgram, options, ctx);

  if (!irResult.ok) {
    throw new Error(`IR build failed: ${irResult.error.message}`);
  }

  // Emit C#
  return emitModule(irResult.value);
};

describe("End-to-End Integration", () => {
  describe("Arrow Field Delegates", () => {
    it("should emit Action for static void arrow fields (never Func<void>)", () => {
      const source = `
        export const noop: () => void = () => {};
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.match(
        /public\s+static\s+readonly\s+global::System\.Action\s+noop\s*=/
      );
      expect(csharp).not.to.match(/global::System\.Func\s*<\s*void\s*>/);
    });
  });

  describe("Generic Functions", () => {
    it("should compile generic identity function to C#", () => {
      const source = `
        export function identity<T>(value: T): T {
          return value;
        }
      `;

      const csharp = compileToCSharp(source);

      // Should emit generic function signature
      expect(csharp).to.match(/public\s+static\s+T\s+identity\s*<T>/);
      expect(csharp).to.include("(T value)");
      expect(csharp).to.include("return value;");
    });

    it("should compile generic function with type alias constraint", () => {
      const source = `
        type HasId = { id: number };

        export function getId<T extends HasId>(obj: T): number {
          return obj.id;
        }
      `;

      const csharp = compileToCSharp(source);

      // Should emit type alias as class
      expect(csharp).to.include("class HasId__Alias");
      expect(csharp).to.match(/required\s+double\s+id\s*\{\s*get;\s*set;/);

      // Should use type alias as constraint
      expect(csharp).to.include("where T : HasId");

      // Should have function
      expect(csharp).to.match(/public\s+static\s+double\s+getId<T>/);
    });
  });

  describe("Interfaces and Type Aliases", () => {
    it("should compile interface to C# class", () => {
      const source = `
        export interface User {
          id: number;
          name: string;
          email?: string;
        }
      `;

      const csharp = compileToCSharp(source);

      // Should emit C# class (not interface)
      expect(csharp).to.match(/public\s+class\s+User/);
      expect(csharp).not.to.include("interface User");

      // Should have auto-properties (required for non-optional)
      expect(csharp).to.match(
        /public\s+required\s+double\s+id\s*\{\s*get;\s*set;/
      );
      expect(csharp).to.match(
        /public\s+required\s+string\s+name\s*\{\s*get;\s*set;/
      );

      // Optional property should be nullable
      expect(csharp).to.match(/public\s+string\?\s+email\s*\{\s*get;\s*set;/);
    });

    it("should compile structural type alias to sealed class", () => {
      const source = `
        export type Point = {
          x: number;
          y: number;
        };
      `;

      const csharp = compileToCSharp(source);

      // Should emit sealed class with __Alias suffix
      expect(csharp).to.match(/public\s+sealed\s+class\s+Point__Alias/);
      expect(csharp).to.match(
        /public\s+required\s+double\s+x\s*\{\s*get;\s*set;/
      );
      expect(csharp).to.match(
        /public\s+required\s+double\s+y\s*\{\s*get;\s*set;/
      );
    });

    it("should compile generic interface", () => {
      const source = `
        export interface Result<T> {
          ok: boolean;
          value: T;
        }
      `;

      const csharp = compileToCSharp(source);

      // Should emit generic class
      expect(csharp).to.match(/public\s+class\s+Result\s*<T>/);
      expect(csharp).to.match(/public\s+required\s+bool\s+ok/);
      expect(csharp).to.match(/public\s+required\s+T\s+value/);
    });
  });

  describe("Generic Classes", () => {
    it("should compile generic class with methods", () => {
      const source = `
        export class Container<T> {
          constructor(private value: T) {}

          getValue(): T {
            return this.value;
          }

          setValue(newValue: T): void {
            this.value = newValue;
          }
        }
      `;

      const csharp = compileToCSharp(source);

      // Should emit generic class
      expect(csharp).to.match(/public\s+class\s+Container\s*<T>/);

      // Should have generic methods
      expect(csharp).to.match(/public\s+T\s+getValue\s*\(\s*\)/);
      expect(csharp).to.match(
        /public\s+void\s+setValue\s*\(\s*T\s+newValue\s*\)/
      );
    });
  });

  describe("Combined Features", () => {
    it("should compile code with multiple generic features", () => {
      const source = `
        import { int } from "@tsonic/core/types.js";

        export interface Repository<T> {
          items: T[];
          add(item: T): void;
          findById(id: number): T | undefined;
        }

        export class InMemoryRepository<T extends { id: number }> {
          private items: T[] = [];

          add(item: T): void {
            this.items.push(item);
          }

          findById(id: number): T | undefined {
            for (let i: int = 0; i < this.items.Length; i++) {
              if (this.items[i].id === id) {
                return this.items[i];
              }
            }
            return undefined;
          }
        }
      `;

      const csharp = compileToCSharp(source);

      // Method-bearing interfaces emit as C# interfaces (required for constraints/implements)
      expect(csharp).to.match(/public\s+interface\s+Repository\s*<T>/);

      // Should emit InMemoryRepository as generic class with constraint
      expect(csharp).to.match(/public\s+class\s+InMemoryRepository\s*<T>/);
      expect(csharp).to.include("where T : __Constraint_T");

      // Should generate constraint adapter
      expect(csharp).to.match(/public\s+interface\s+__Constraint_T/);
      expect(csharp).to.match(/double\s+id\s*\{\s*get;\s*\}/);
    });
  });

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
    });
  });

  describe("Promise Chains", () => {
    it("lowers Promise.then to Task.Run async wrapper", () => {
      const source = `
        declare class Promise<T> {
          then<U>(onFulfilled: (value: T) => U | PromiseLike<U>): Promise<U>;
          catch<U>(onRejected: (reason: unknown) => U | PromiseLike<U>): Promise<T | U>;
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

    it("lowers Promise.catch to Task.Run with try/catch", () => {
      const source = `
        declare class Promise<T> {
          then<U>(onFulfilled: (value: T) => U | PromiseLike<U>): Promise<U>;
          catch<U>(onRejected: (reason: unknown) => U | PromiseLike<U>): Promise<T | U>;
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
          catch<U>(onRejected: (reason: unknown) => U | PromiseLike<U>): Promise<T | U>;
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
  });
});
