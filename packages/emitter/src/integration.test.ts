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
} from "@tsonic/frontend";
import { emitModule } from "./emitter.js";

/**
 * Helper to compile TypeScript source to C#
 */
const compileToCSharp = (
  source: string,
  fileName = "/test/test.ts"
): string => {
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

  const tsonicProgram = {
    program: tsProgram,
    checker: tsProgram.getTypeChecker(),
    options: {
      projectRoot: "/test",
      sourceRoot: "/test",
      rootNamespace: "Test",
    },
    sourceFiles: [sourceFile],
    metadata: new DotnetMetadataRegistry(),
    bindings: new BindingRegistry(),
    clrResolver: createClrBindingsResolver("/test"),
  };

  // Build IR
  const irResult = buildIrModule(sourceFile, tsonicProgram, {
    sourceRoot: "/test",
    rootNamespace: "Test",
  });

  if (!irResult.ok) {
    throw new Error(`IR build failed: ${irResult.error.message}`);
  }

  // Emit C#
  return emitModule(irResult.value);
};

describe("End-to-End Integration", () => {
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
            return this.items.find(item => item.id === id);
          }
        }
      `;

      const csharp = compileToCSharp(source);

      // Should emit Repository as generic class (interfaces become classes)
      expect(csharp).to.match(/public\s+class\s+Repository\s*<T>/);

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

    it("should infer types for array method callbacks", () => {
      const source = `
        // Inline minimal types for this test
        interface Array<T> {
          map<U>(fn: (item: T) => U): U[];
        }

        export function doubleAll(nums: number[]): number[] {
          return nums.map((n) => n * 2);
        }
      `;

      const csharp = compileToCSharp(source);

      // Should emit lambda with typed parameter
      // n should be inferred as number (double in C#)
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

      // Type predicate (animal is Dog) should emit as bool return type
      expect(csharp).to.match(
        /public\s+static\s+bool\s+isDog\s*\(\s*Animal\s+animal\s*\)/
      );
      // Should not emit 'dynamic' (old broken behavior)
      expect(csharp).not.to.include("dynamic isDog");
    });
  });

  describe("Full Module Compilation", () => {
    it("should compile a complete module with all features", () => {
      const source = `
        // Type definitions
        export interface User {
          id: number;
          name: string;
          email?: string;
        }

        export type UserId = number;

        // Generic repository
        export class UserRepository {
          private users: User[] = [];

          add(user: User): void {
            this.users.push(user);
          }

          findById(id: UserId): User | undefined {
            return this.users.find(u => u.id === id);
          }

          all(): User[] {
            return this.users;
          }
        }

        // Generic utility function
        export function map<T, U>(arr: T[], fn: (item: T) => U): U[] {
          return arr.map(fn);
        }
      `;

      const csharp = compileToCSharp(source);

      // Should have all type definitions
      expect(csharp).to.include("class User");
      expect(csharp).to.include("// type UserId = double"); // number → double in C#

      // Should have the repository class
      expect(csharp).to.include("class UserRepository");

      // Should have the generic function with native array return type
      expect(csharp).to.match(/public\s+static\s+U\[\]\s+map\s*<T,\s*U>/);

      // Should have proper namespace structure
      expect(csharp).to.include("namespace Test");
      expect(csharp).to.include("public static class test");
    });
  });
});
