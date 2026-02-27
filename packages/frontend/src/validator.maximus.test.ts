import { describe, it } from "mocha";
import { expect } from "chai";
import * as ts from "typescript";
import type { TsonicProgram } from "./program.js";
import { validateProgram } from "./validator.js";
import { DotnetMetadataRegistry } from "./dotnet-metadata.js";
import { BindingRegistry } from "./program/bindings.js";
import { createClrBindingsResolver } from "./resolver/clr-bindings-resolver.js";
import { createBinding } from "./ir/binding/index.js";

const createTestProgram = (
  source: string,
  fileName = "test.ts"
): TsonicProgram => {
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

  const program = ts.createProgram([fileName], compilerOptions, host);
  const checker = program.getTypeChecker();

  return {
    program,
    checker,
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
    binding: createBinding(checker),
  };
};

const collectCodes = (source: string): readonly string[] =>
  validateProgram(createTestProgram(source)).diagnostics.map((d) => d.code);

const hasCode = (source: string, code: string): boolean =>
  collectCodes(source).includes(code);

describe("Maximus Validation Coverage", () => {
  describe("TSN2001 / TSN3011 end-to-end feature gating", () => {
    const shouldReject: ReadonlyArray<{
      readonly name: string;
      readonly code: string;
      readonly source: string;
    }> = [
      {
        name: "with statement",
        code: "TSN2001",
        source: `
          const scope = { x: 1 };
          with (scope) { console.log(x); }
        `,
      },
      {
        name: "import.meta",
        code: "TSN2001",
        source: `
          const url = import.meta.url;
          console.log(url);
        `,
      },
      {
        name: "dynamic import",
        code: "TSN2001",
        source: `
          async function load() { return import("./module.js"); }
          void load();
        `,
      },
      {
        name: "Promise.then chain",
        code: "TSN3011",
        source: `
          const p: Promise<number> = Promise.resolve(1);
          p.then((x) => x + 1);
        `,
      },
      {
        name: "Promise.catch chain",
        code: "TSN3011",
        source: `
          const p: Promise<number> = Promise.resolve(1);
          p.catch(() => 0);
        `,
      },
      {
        name: "Promise.finally chain",
        code: "TSN3011",
        source: `
          const p: Promise<number> = Promise.resolve(1);
          p.finally(() => {});
        `,
      },
    ];

    for (const scenario of shouldReject) {
      it(`rejects ${scenario.name}`, () => {
        expect(hasCode(scenario.source, scenario.code)).to.equal(true);
      });
    }

    const shouldAllow: ReadonlyArray<{
      readonly name: string;
      readonly source: string;
    }> = [
      {
        name: "class method named then",
        source: `
          class Builder {
            then(v: number): number { return v + 1; }
          }
          new Builder().then(1);
        `,
      },
      {
        name: "class method named catch",
        source: `
          class Catcher {
            catch(v: number): number { return v + 1; }
          }
          new Catcher().catch(1);
        `,
      },
      {
        name: "class method named finally",
        source: `
          class Finalizer {
            finally(v: number): number { return v + 1; }
          }
          new Finalizer().finally(1);
        `,
      },
      {
        name: "static import declaration",
        source: `
          import { value } from "./module.js";
          console.log(value);
        `,
      },
    ];

    for (const scenario of shouldAllow) {
      it(`does not falsely reject ${scenario.name}`, () => {
        const codes = collectCodes(scenario.source);
        expect(codes.includes("TSN2001")).to.equal(false);
        expect(codes.includes("TSN3011")).to.equal(false);
      });
    }
  });

  describe("Mixed variadic tuples", () => {
    const allowCases: ReadonlyArray<{
      readonly name: string;
      readonly source: string;
    }> = [
      {
        name: "[string, ...number[]]",
        source: `type T = [string, ...number[]];`,
      },
      {
        name: "[number, ...string[], boolean]",
        source: `type T = [number, ...string[], boolean];`,
      },
      {
        name: "rest parameter with mixed tuple",
        source: `function f(...args: [string, ...number[]]): void { void args; }`,
      },
      {
        name: "generic head + variadic tail",
        source: `type T<U extends unknown[]> = [string, ...U];`,
      },
      {
        name: "generic variadic head + fixed tail",
        source: `type T<U extends unknown[]> = [...U, string];`,
      },
      { name: "fixed tuple", source: `type T = [string, number];` },
      { name: "pure variadic tuple", source: `type T = [...number[]];` },
      {
        name: "generic pure variadic tuple",
        source: `type T<U extends unknown[]> = [...U];`,
      },
      {
        name: "plain rest parameter",
        source: `function f(...args: number[]): void { void args; }`,
      },
      { name: "empty tuple", source: `type T = [];` },
      { name: "single fixed tuple element", source: `type T = [string];` },
    ];

    for (const c of allowCases) {
      it(`allows ${c.name}`, () => {
        expect(hasCode(c.source, "TSN7408")).to.equal(false);
      });
    }
  });

  describe("TSN7409 - infer keyword", () => {
    const rejectCases: ReadonlyArray<{
      readonly name: string;
      readonly source: string;
    }> = [
      {
        name: "simple infer in conditional",
        source: `type Unwrap<T> = T extends Promise<infer U> ? U : T;`,
      },
      {
        name: "infer in tuple extraction",
        source: `type Head<T> = T extends [infer H, ...unknown[]] ? H : never;`,
      },
      {
        name: "infer in function return extraction",
        source: `type Return<T> = T extends (...args: never[]) => infer R ? R : never;`,
      },
      {
        name: "infer in nested conditional",
        source: `type Deep<T> = T extends Promise<infer U> ? (U extends Promise<infer V> ? V : U) : T;`,
      },
      {
        name: "multiple infer clauses",
        source: `type Pair<T> = T extends [infer A, infer B] ? [A, B] : never;`,
      },
    ];

    for (const c of rejectCases) {
      it(`rejects ${c.name}`, () => {
        expect(hasCode(c.source, "TSN7409")).to.equal(true);
      });
    }

    const allowCases: ReadonlyArray<{
      readonly name: string;
      readonly source: string;
    }> = [
      {
        name: "identifier containing infer",
        source: `const inferredValue = 1; console.log(inferredValue);`,
      },
      {
        name: "interface property named infer",
        source: `interface X { infer: string; } const x: X = { infer: "ok" };`,
      },
      {
        name: "simple conditional without infer",
        source: `type T<U> = U extends string ? 1 : 2;`,
      },
      {
        name: "generic alias without conditional",
        source: `type Mapper<T> = { value: T };`,
      },
    ];

    for (const c of allowCases) {
      it(`allows ${c.name}`, () => {
        expect(hasCode(c.source, "TSN7409")).to.equal(false);
      });
    }
  });

  describe("Array constructor inference", () => {
    const allowCases: ReadonlyArray<{
      readonly name: string;
      readonly source: string;
    }> = [
      { name: "new Array()", source: `const a = new Array();` },
      { name: "new Array(10)", source: `const a = new Array(10);` },
      { name: "new Array('a', 'b')", source: `const a = new Array("a", "b");` },
      {
        name: "new Array(...spread)",
        source: `const xs = [1, 2, 3]; const a = new Array(...xs);`,
      },
      {
        name: "new Array in expression",
        source: `console.log(new Array(3));`,
      },
      {
        name: "new Array inside function",
        source: `function f(): void { const arr = new Array(); console.log(arr); }`,
      },
      {
        name: "new Array<number>()",
        source: `const a = new Array<number>();`,
      },
      {
        name: "new Array<number>(10)",
        source: `const a = new Array<number>(10);`,
      },
      {
        name: "new Array<string>('a', 'b')",
        source: `const a = new Array<string>("a", "b");`,
      },
      {
        name: "Array() call expression",
        source: `const a = Array(10);`,
      },
      {
        name: "qualified type named Array",
        source: `
          namespace Custom {
            export class Array {
              constructor(public readonly value: number) {}
            }
          }
          const a = new Custom.Array(1);
          console.log(a.value);
        `,
      },
      {
        name: "typed factory wrapping Array",
        source: `
          function make(): number[] {
            return new Array<number>(5);
          }
          console.log(make().length);
        `,
      },
    ];

    for (const c of allowCases) {
      it(`allows ${c.name}`, () => {
        expect(hasCode(c.source, "TSN7416")).to.equal(false);
      });
    }
  });

  describe("Empty array literals", () => {
    const allowCases: ReadonlyArray<{
      readonly name: string;
      readonly source: string;
    }> = [
      { name: "const x = []", source: `const x = [];` },
      { name: "let x = []", source: `let x = [];` },
      { name: "var x = []", source: `var x = [];` },
      {
        name: "untyped function local empty array",
        source: `function f(): void { const local = []; console.log(local); }`,
      },
      { name: "annotated variable", source: `const x: number[] = [];` },
      { name: "type assertion", source: `const x = [] as number[];` },
      {
        name: "typed function return",
        source: `function f(): number[] { return []; }`,
      },
      {
        name: "typed function parameter",
        source: `function consume(xs: number[]): void { console.log(xs.length); } consume([]);`,
      },
      {
        name: "typed object property",
        source: `const x: { items: number[] } = { items: [] }; console.log(x.items.length);`,
      },
      {
        name: "typed conditional expression",
        source: `const x: number[] = true ? [] : []; console.log(x.length);`,
      },
      {
        name: "untyped conditional expression",
        source: `const x = Math.random() > 0.5 ? [] : []; console.log(x.length);`,
      },
      {
        name: "untyped nested object property",
        source: `const x = { items: [] }; console.log(x.items.length);`,
      },
      {
        name: "typed class field initializer",
        source: `class Box { items: number[] = []; } console.log(new Box().items.length);`,
      },
      {
        name: "return from typed arrow",
        source: `const make: () => number[] = () => []; console.log(make().length);`,
      },
    ];

    for (const c of allowCases) {
      it(`allows ${c.name}`, () => {
        expect(hasCode(c.source, "TSN7417")).to.equal(false);
      });
    }
  });

  describe("TSN7430 - arrow function escape hatch", () => {
    const rejectCases: ReadonlyArray<{
      readonly name: string;
      readonly source: string;
    }> = [
      { name: "no contextual type", source: `const f = (x) => x + 1;` },
      { name: "destructuring param", source: `const f = ({ x }) => x;` },
      { name: "defaulted param", source: `const f = (x = 1) => x;` },
      { name: "rest param", source: `const f = (...xs) => xs.length;` },
      {
        name: "async arrow without context",
        source: `const f = async (x) => x + 1;`,
      },
      {
        name: "explicit param but implicit return",
        source: `const f = (x: number) => x + 1;`,
      },
      {
        name: "nested non-simple arrow",
        source: `const outer = () => ({ run: (...xs) => xs.length });`,
      },
    ];

    for (const c of rejectCases) {
      it(`rejects ${c.name}`, () => {
        expect(hasCode(c.source, "TSN7430")).to.equal(true);
      });
    }

    const allowCases: ReadonlyArray<{
      readonly name: string;
      readonly source: string;
    }> = [
      {
        name: "fully typed arrow",
        source: `const f = (x: number): number => x + 1; console.log(f(1));`,
      },
      {
        name: "contextual typing via variable annotation",
        source: `
          type Mapper = (x: number) => number;
          const f: Mapper = (x) => x + 1;
          console.log(f(1));
        `,
      },
      {
        name: "contextual typing via function argument",
        source: `
          const apply = (f: (x: number) => number): number => f(1);
          console.log(apply((x) => x + 1));
        `,
      },
      {
        name: "contextual typing via array element",
        source: `
          type Op = (a: number, b: number) => number;
          const ops: Op[] = [(a, b) => a + b];
          console.log(ops[0](1, 2));
        `,
      },
      {
        name: "nested contextual typing via explicit return type",
        source: `
          const factory: () => ((x: number) => number) = () => (x) => x + 1;
          console.log(factory()(1));
        `,
      },
      {
        name: "simple arrow with explicit param and explicit return",
        source: `const f = (x: number): number => x + 1; console.log(f(1));`,
      },
      {
        name: "simple arrow with explicit return only",
        source: `const f = (x: number): number => x + 1; console.log(f(1));`,
      },
      {
        name: "simple arrow in object literal with contextual type",
        source: `
          type Ops = { add: (x: number, y: number) => number };
          const ops: Ops = { add: (x, y) => x + y };
          console.log(ops.add(1, 2));
        `,
      },
    ];

    for (const c of allowCases) {
      it(`allows ${c.name}`, () => {
        expect(hasCode(c.source, "TSN7430")).to.equal(false);
      });
    }
  });
});
