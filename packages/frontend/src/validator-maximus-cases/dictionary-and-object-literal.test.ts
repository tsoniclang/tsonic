import { describe, it, expect, collectCodes, hasCode } from "./helpers.js";

describe("Maximus Validation Coverage", () => {
  describe("Dictionary key domains (TSN7413 / TSN7203)", () => {
    const allowCases: ReadonlyArray<{
      readonly name: string;
      readonly source: string;
    }> = [
      {
        name: "Record with string key",
        source: `
          type Strings = Record<string, number>;
          const table: Strings = {} as Strings;
          console.log(table);
        `,
      },
      {
        name: "number index signature",
        source: `
          interface NumberMap {
            [key: number]: string;
          }
          const table: NumberMap = {} as NumberMap;
          console.log(table);
        `,
      },
    ];

    for (const c of allowCases) {
      it(`allows ${c.name}`, () => {
        const codes = collectCodes(c.source);
        expect(codes.includes("TSN7413")).to.equal(false);
        expect(codes.includes("TSN7203")).to.equal(false);
        expect(codes.includes("TSN7414")).to.equal(false);
      });
    }

    const rejectCases: ReadonlyArray<{
      readonly name: string;
      readonly source: string;
    }> = [
      {
        name: "Record with object key type",
        source: `
          interface Key { id: string; }
          type Dict = Record<Key, number>;
          const value: Dict = {} as Dict;
          void value;
        `,
      },
      {
        name: "index signature with object key type",
        source: `
          interface Key { id: string; }
          interface Dict {
            [key: Key]: number;
          }
        `,
      },
      {
        name: "Record with symbol key",
        source: `
          type Symbols = Record<symbol, number>;
          const table: Symbols = {} as Symbols;
          console.log(table);
        `,
      },
      {
        name: "symbol index signature",
        source: `
          interface SymbolMap {
            [key: symbol]: string;
          }
        `,
      },
      {
        name: "mixed PropertyKey union",
        source: `
          type Dict = Record<string | number | symbol, number>;
          const value: Dict = {} as Dict;
          console.log(value);
        `,
      },
      {
        name: "symbol-typed parameter used for dictionary indexing",
        source: `
          function read(table: Record<symbol, number>, key: symbol): number {
            return table[key];
          }
          console.log(read);
        `,
      },
    ];

    for (const c of rejectCases) {
      it(`rejects ${c.name}`, () => {
        expect(hasCode(c.source, "TSN7413")).to.equal(true);
      });
    }
  });

  describe("Object literal synthesis (TSN7403 narrowing)", () => {
    const allowCases: ReadonlyArray<{
      readonly name: string;
      readonly source: string;
    }> = [
      {
        name: "method shorthand without dynamic receiver semantics",
        source: `
          const point = {
            add(x: number, y: number): number {
              return x + y;
            },
          };
          const n = point.add(1, 2);
          void n;
        `,
      },
      {
        name: "mixed property assignments and method shorthand",
        source: `
          const obj = {
            base: 2,
            mul(x: number): number {
              return x * 2;
            },
          };
          const n = obj.mul(obj.base);
          void n;
        `,
      },
      {
        name: "computed string-literal method shorthand",
        source: `
          const obj = {
            ["mul"](x: number, y: number): number {
              return x * y;
            },
          };
          const n = obj.mul(2, 3);
          void n;
        `,
      },
      {
        name: "computed const-literal property and accessor keys",
        source: `
          const valueKey = "value";
          const doubledKey = "doubled";
          const obj = {
            [valueKey]: 21,
            get [doubledKey](): number {
              return this.value * 2;
            },
          };
          const n = obj.doubled;
          void n;
        `,
      },
      {
        name: "computed const-literal numeric property key",
        source: `
          const slot = 1;
          const obj = {
            [slot]: 7,
          };
          void obj;
        `,
      },
      {
        name: "method shorthand in typed generic call argument",
        source: `
          interface Ops {
            add: (x: number, y: number) => number;
          }
          function box<T>(x: T): T { return x; }
          const ops = box<Ops>({
            add(x: number, y: number): number {
              return x + y;
            },
          });
          const n = ops.add(1, 2);
          void n;
        `,
      },
      {
        name: "method shorthand using this",
        source: `
          const obj = {
            base: 2,
            mul(x: number): number {
              return this.base * x;
            },
          };
          const n = obj.mul(3);
          void n;
        `,
      },
      {
        name: "getter shorthand in synthesized object literal",
        source: `
          const obj = {
            get value(): number {
              return 1;
            },
          };
          const n = obj.value;
          void n;
        `,
      },
      {
        name: "method shorthand using arguments.length with fixed required parameters",
        source: `
          const obj = {
            mul(x: number): number {
              return arguments.length + x;
            },
          };
          const n = obj.mul(3);
          void n;
        `,
      },
      {
        name: "method shorthand using arguments[n] with fixed required identifier parameters",
        source: `
          const obj = {
            mul(x: number, y: number): number {
              return (arguments[0] as number) + y;
            },
          };
          const n = obj.mul(3, 4);
          void n;
        `,
      },
    ];

    for (const c of allowCases) {
      it(`allows ${c.name}`, () => {
        expect(hasCode(c.source, "TSN7403")).to.equal(false);
      });
    }

    const rejectCases: ReadonlyArray<{
      readonly name: string;
      readonly source: string;
    }> = [
      {
        name: "method shorthand using unsupported arguments indexing",
        source: `
          const obj = {
            mul({ x }: { x: number }): number {
              return arguments[0] as number;
            },
          };
          void obj;
        `,
      },
      {
        name: "method shorthand using super",
        source: `
          const base = {
            mul(x: number): number {
              return x * 2;
            },
          };
          const obj = {
            __proto__: base,
            mul(x: number): number {
              return super.mul(x);
            },
          };
          void obj;
        `,
      },
    ];

    for (const c of rejectCases) {
      it(`rejects ${c.name}`, () => {
        expect(hasCode(c.source, "TSN7403")).to.equal(true);
      });
    }
  });
});
