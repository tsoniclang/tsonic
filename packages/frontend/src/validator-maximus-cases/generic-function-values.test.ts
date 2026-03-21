import { describe, it, expect, hasCode } from "./helpers.js";

describe("Maximus Validation Coverage", () => {
  describe("generic function values (TSN7432 narrowing)", () => {
    const allowCases: ReadonlyArray<{
      readonly name: string;
      readonly source: string;
    }> = [
      {
        name: "module-level const generic arrow with direct call",
        source: `
          const id = <T>(x: T): T => x;
          const n = id<number>(1);
          void n;
        `,
      },
      {
        name: "module-level const generic function expression with direct call",
        source: `
          const id = function <T>(x: T): T { return x; };
          const s = id<string>("x");
          void s;
        `,
      },
      {
        name: "module-level generic value with direct call and export specifier",
        source: `
          const id = <T>(x: T): T => x;
          export { id };
          const s = id<string>("x");
          void s;
        `,
      },
      {
        name: "module-level generic value with typeof usage",
        source: `
          const id = <T>(x: T): T => x;
          type IdFn = typeof id;
          const s = id<string>("x");
          void s;
          type Alias = IdFn;
          const marker: Alias | undefined = undefined;
          void marker;
        `,
      },
      {
        name: "generic function declaration with direct call",
        source: `
          function id<T>(x: T): T { return x; }
          const n = id<number>(1);
          void n;
        `,
      },
      {
        name: "const alias to generic value with direct generic call",
        source: `
          const id = <T>(x: T): T => x;
          const copy = id;
          const n = copy<number>(1);
          void n;
        `,
      },
      {
        name: "const alias to generic function declaration with direct call",
        source: `
          function id<T>(x: T): T { return x; }
          const copy = id;
          const n = copy<number>(1);
          void n;
        `,
      },
      {
        name: "chained const aliases to generic value",
        source: `
          const id = <T>(x: T): T => x;
          const copy = id;
          const finalCopy = copy;
          const n = finalCopy<number>(1);
          void n;
        `,
      },
      {
        name: "let alias to generic value without reassignment",
        source: `
          const id = <T>(x: T): T => x;
          let copy = id;
          const n = copy<number>(1);
          void n;
        `,
      },
      {
        name: "nested generic arrow value inside function scope with direct call",
        source: `
          function wrap(): void {
            const id = <T>(x: T): T => x;
            void id<number>(1);
          }
          void wrap;
        `,
      },
      {
        name: "module-level let generic value with no reassignment",
        source: `
          let id = <T>(x: T): T => x;
          const s = id<string>("x");
          void s;
        `,
      },
      {
        name: "outer let generic value with reassigned shadow remains valid",
        source: `
          let id = <T>(x: T): T => x;
          {
            let id = 1;
            id = 2;
            void id;
          }
          const s = id<string>("outer");
          void s;
        `,
      },
      {
        name: "generic value passed in monomorphic callable argument context",
        source: `
          const id = <T>(x: T): T => x;
          function use(fn: (x: number) => number): number {
            return fn(1);
          }
          const out = use(id);
          void out;
        `,
      },
      {
        name: "generic value assigned to monomorphic callable context",
        source: `
          const id = <T>(x: T): T => x;
          const copy: (x: number) => number = id;
          const out = copy(2);
          void out;
        `,
      },
      {
        name: "generic value asserted to monomorphic callable context",
        source: `
          const id = <T>(x: T): T => x;
          const copy = id as (x: number) => number;
          const out = copy(2);
          void out;
        `,
      },
      {
        name: "generic value in parenthesized monomorphic callable context",
        source: `
          const id = <T>(x: T): T => x;
          const copy: (x: number) => number = (id);
          const out = copy(2);
          void out;
        `,
      },
      {
        name: "generic value in typed object/array callable contexts",
        source: `
          const id = <T>(x: T): T => x;
          type Box = { run: (x: number) => number };
          const box: Box = { run: id };
          const handlers: Array<(x: number) => number> = [id];
          const out = box.run(handlers[0]!(3));
          void out;
        `,
      },
      {
        name: "generic value in typed object shorthand callable context",
        source: `
          const id = <T>(x: T): T => x;
          type Box = { id: (x: number) => number };
          const box: Box = { id };
          const out = box.id(5);
          void out;
        `,
      },
      {
        name: "generic value returned through monomorphic callable return type",
        source: `
          function make(): (x: number) => number {
            const id = <T>(x: T): T => x;
            return id;
          }
          const out = make()(4);
          void out;
        `,
      },
      {
        name: "generic value in monomorphic callable conditional return",
        source: `
          function pick(flag: boolean): (x: number) => number {
            const id = <T>(x: T): T => x;
            const inc = (x: number): number => x + 1;
            return flag ? id : inc;
          }
          const out = pick(true)(2);
          void out;
        `,
      },
      {
        name: "generic function value as default export expression",
        source: `
          const id = <T>(x: T): T => x;
          export default id;
          void id<number>(1);
        `,
      },
      {
        name: "generic function value in multi-declarator const statement",
        source: `
          const id = <T>(x: T): T => x, other = 1;
          const n = id<number>(1);
          void n;
          void other;
        `,
      },
    ];

    for (const c of allowCases) {
      it(`allows ${c.name}`, () => {
        expect(hasCode(c.source, "TSN7432")).to.equal(false);
      });
    }

    const rejectCases: ReadonlyArray<{
      readonly name: string;
      readonly source: string;
    }> = [
      {
        name: "generic function value used as value (non-call usage)",
        source: `
          const id = <T>(x: T): T => x;
          const copy = id;
          void copy;
        `,
      },
      {
        name: "generic function declaration used as value (non-call usage)",
        source: `
          function id<T>(x: T): T { return x; }
          void id;
        `,
      },
      {
        name: "generic function value passed as argument",
        source: `
          const id = <T>(x: T): T => x;
          function use(fn: unknown): void { void fn; }
          use(id);
        `,
      },
      {
        name: "generic function value assigned to generic callable context",
        source: `
          const id = <T>(x: T): T => x;
          const copy: <T>(x: T) => T = id;
          void copy;
        `,
      },
      {
        name: "generic function value returned from function",
        source: `
          const id = <T>(x: T): T => x;
          function wrap(): unknown { return id; }
          void wrap;
        `,
      },
      {
        name: "generic function value returned through generic callable return type",
        source: `
          const id = <T>(x: T): T => x;
          function wrap(): <T>(x: T) => T { return id; }
          void wrap;
        `,
      },
      {
        name: "generic function value in object property position",
        source: `
          const id = <T>(x: T): T => x;
          const obj = { id };
          void obj;
        `,
      },
      {
        name: "generic function value in array literal position",
        source: `
          const id = <T>(x: T): T => x;
          const arr = [id];
          void arr;
        `,
      },
      {
        name: "generic function value property access usage",
        source: `
          const id = <T>(x: T): T => x;
          const n = id.name;
          void n;
        `,
      },
      {
        name: "reassigned let generic function value",
        source: `
          let id = <T>(x: T): T => x;
          id = <T>(x: T): T => x;
          void id<string>("x");
        `,
      },
      {
        name: "destructuring-reassigned let generic function value",
        source: `
          let id = <T>(x: T): T => x;
          [id] = [id];
          void id<string>("x");
        `,
      },
      {
        name: "for-of-target let generic function value",
        source: `
          let id = <T>(x: T): T => x;
          const handlers = [id];
          for (id of handlers) {
            void id<string>("x");
          }
        `,
      },
      {
        name: "reassigned let alias to generic function value",
        source: `
          const id = <T>(x: T): T => x;
          let copy = id;
          copy = id;
          void copy<string>("x");
        `,
      },
      {
        name: "var alias to generic function value",
        source: `
          const id = <T>(x: T): T => x;
          var copy = id;
          void copy<string>("x");
        `,
      },
    ];

    for (const c of rejectCases) {
      it(`rejects ${c.name}`, () => {
        expect(hasCode(c.source, "TSN7432")).to.equal(true);
      });
    }
  });
});
