import { describe, it, expect, hasCode } from "./helpers.js";

describe("Maximus Validation Coverage", () => {
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
      {
        name: "contextual typing with destructured parameter",
        source: `
          type Getter = ({ x }: { x: number }) => number;
          const getX: Getter = ({ x }) => x;
          console.log(getX({ x: 1 }));
        `,
      },
      {
        name: "contextual typing with defaulted parameter",
        source: `
          type Inc = (x?: number) => number;
          const inc: Inc = (x = 0) => x + 1;
          console.log(inc(), inc(4));
        `,
      },
      {
        name: "contextual typing with rest parameter",
        source: `
          type Count = (...xs: number[]) => number;
          const count: Count = (...xs) => xs.length;
          console.log(count(1, 2, 3));
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
