import { describe, it, expect, collectCodes } from "./helpers.js";

describe("Maximus Validation Coverage", () => {
  describe("Deterministic typing regressions (TSN520x / TSN7414)", () => {
    const allowCases: ReadonlyArray<{
      readonly name: string;
      readonly source: string;
    }> = [
      {
        name: "expected-return generic inference through helper call",
        source: `
          type Ok<T> = { ok: true; value: T };
          function ok<T>(value: T): Ok<T> {
            return { ok: true, value };
          }
          function build(): Ok<{ id: number; name: string }> {
            return ok({ id: 1, name: "alice" });
          }
          void build;
        `,
      },
      {
        name: "generic member recovery through interface substitution",
        source: `
          interface Box<T> { value: T; }
          function read<T>(box: Box<T>): T {
            return box.value;
          }
          const n = read<number>({ value: 1 });
          void n;
        `,
      },
      {
        name: "nested contextual object through generic wrapper",
        source: `
          interface User {
            id: number;
            info: { name: string; active: boolean };
          }
          function wrap<T>(value: T): T { return value; }
          const user = wrap<User>({
            id: 1,
            info: { name: "alice", active: true },
          });
          void user;
        `,
      },
      {
        name: "generic rest parameter inference for static helpers",
        source: `
          interface ArrayConstructor {
            of<T>(...items: T[]): T[];
          }

          declare const Array: ArrayConstructor;

          const xs = Array.of(1, 2, 3);
          void xs;
        `,
      },
      {
        name: "typed conditional array return with empty literal branch",
        source: `
          function pick(flag: boolean): number[] {
            return flag ? [1, 2, 3] : [];
          }
          const xs = pick(true);
          void xs;
        `,
      },
      {
        name: "typed conditional object branch with nullish fallback",
        source: `
          interface Profile { name: string; age: number; }
          function build(flag: boolean): Profile {
            const base = flag ? { name: "a", age: 1 } : undefined;
            return base ?? { name: "b", age: 2 };
          }
          void build;
        `,
      },
      {
        name: "async promise return typing remains deterministic",
        source: `
          async function getValue(): Promise<number> {
            return Promise.resolve(1);
          }
          void getValue;
        `,
      },
      {
        name: "generic discriminated union constructor helper remains representable",
        source: `
          type Result<T> = { ok: true; value: T } | { ok: false; error: string };
          function ok<T>(value: T): Result<T> {
            return { ok: true, value };
          }
          function run(): Result<{ total: number }> {
            return ok({ total: 1 });
          }
          void run;
        `,
      },
      {
        name: "object shorthand + explicit generic call site",
        source: `
          interface Payload { id: number; slug: string; }
          function identity<T>(value: T): T { return value; }
          const id = 1;
          const slug = "hello";
          const payload = identity<Payload>({ id, slug });
          void payload;
        `,
      },
      {
        name: "generic array element member recovery in loop body",
        source: `
          interface Item<T> { value: T; }
          function sum(items: Item<number>[]): number {
            let total = 0;
            for (const item of items) {
              total = total + item.value;
            }
            return total;
          }
          void sum;
        `,
      },
      {
        name: "nullable union narrowing through in-operator remains deterministic",
        source: `
          type R = { ok: true; value: number } | { ok: false; error: string };
          function read(r: R): number {
            if ("error" in r) {
              return 0;
            }
            return r.value;
          }
          void read;
        `,
      },
      {
        name: "anonymous object callback properties keep builtin PromiseLike resolvable",
        source: `
          type AppHandlers = {
            readonly handleHealth: (ctx: number) => PromiseLike<void>;
            readonly handleMetrics: (ctx: number) => PromiseLike<void>;
          };

          function createAppHandlers(): AppHandlers {
            return {
              handleHealth: async (_ctx: number): PromiseLike<void> => {},
              handleMetrics: async (_ctx: number): PromiseLike<void> => {},
            };
          }

          void createAppHandlers;
        `,
      },
    ];

    for (const c of allowCases) {
      it(`avoids deterministic diagnostics for ${c.name}`, () => {
        const codes = collectCodes(c.source);
        expect(codes.includes("TSN5201")).to.equal(false);
        expect(codes.includes("TSN5202")).to.equal(false);
        expect(codes.includes("TSN5203")).to.equal(false);
        expect(codes.includes("TSN7414")).to.equal(false);
      });
    }
  });
});
