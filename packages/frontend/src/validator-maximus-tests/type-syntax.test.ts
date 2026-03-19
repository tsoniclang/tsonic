import { describe, it, expect, hasCode } from "./helpers.js";

describe("Maximus Validation Coverage", () => {
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

  describe("infer keyword support", () => {
    const allowCases: ReadonlyArray<{
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

  describe("mapped and conditional type syntax", () => {
    const allowCases: ReadonlyArray<{
      readonly name: string;
      readonly source: string;
    }> = [
      {
        name: "direct mapped type alias",
        source: `
          type Mapper<T> = { [K in keyof T]: T[K] };
          type X = Mapper<{ a: string; b: number }>;
        `,
      },
      {
        name: "direct conditional type alias",
        source: `
          type C<T> = T extends string ? number : boolean;
          type A = C<string>;
          type B = C<number>;
        `,
      },
      {
        name: "mapped + conditional with infer",
        source: `
          type Normalize<T> = {
            [K in keyof T]: T[K] extends Promise<infer U> ? U : T[K]
          };
          type N = Normalize<{ a: Promise<number>; b: string }>;
        `,
      },
      {
        name: "parenthesized mapped type syntax",
        source: `
          type Mapper<T> = ({ [K in keyof T]: T[K] });
          type X = Mapper<{ a: string }>;
        `,
      },
      {
        name: "parenthesized conditional syntax",
        source: `
          type C<T> = (T extends string ? number : boolean);
          type A = C<string>;
        `,
      },
      {
        name: "mapped syntax in interface member",
        source: `
          type M<T> = { [K in keyof T]: T[K] };
          interface Box {
            map: M<{ a: string; b: number }>;
          }
          const box: Box = { map: { a: "ok", b: 1 } };
          void box;
        `,
      },
      {
        name: "conditional syntax in generic constraint position",
        source: `
          type Normalize<T> = T extends Promise<infer U> ? U : T;
          function f<T>(x: Normalize<T>): void { void x; }
        `,
      },
    ];

    for (const c of allowCases) {
      it(`allows ${c.name}`, () => {
        expect(hasCode(c.source, "TSN7406")).to.equal(false);
        expect(hasCode(c.source, "TSN7407")).to.equal(false);
        expect(hasCode(c.source, "TSN7409")).to.equal(false);
      });
    }
  });
});
