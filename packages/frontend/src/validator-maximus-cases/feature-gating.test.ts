import { describe, it, expect, collectCodes } from "./helpers.js";

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
          const env = import.meta.env;
          console.log(env);
        `,
      },
      {
        name: "dynamic import",
        code: "TSN2001",
        source: `
          async function load() {
            const module = await import("./module.js");
            return module.Box;
          }
          load();
        `,
      },
      {
        name: "in operator over broad object",
        code: "TSN2001",
        source: `
          export function hasName(value: object): boolean {
            return "name" in value;
          }
        `,
      },
      {
        name: "in operator over declared object property",
        code: "TSN2001",
        source: `
          export function hasName(value: { name?: string }): boolean {
            return "name" in value;
          }
        `,
      },
    ];

    for (const scenario of shouldReject) {
      it(`rejects ${scenario.name}`, () => {
        const codes = collectCodes(scenario.source);
        expect(codes.includes(scenario.code)).to.equal(true);
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
      {
        name: "import type query",
        source: `
          import type { Value } from "./module.js";
          const value: Value | undefined = undefined;
          console.log(value);
        `,
      },
      {
        name: "Promise.then chain",
        source: `
          const p: Promise<number> = Promise.resolve(1);
          p.then((x) => x + 1);
        `,
      },
      {
        name: "Promise.catch chain",
        source: `
          const p: Promise<number> = Promise.resolve(1);
          p.catch(() => 0);
        `,
      },
      {
        name: "Promise.finally chain",
        source: `
          const p: Promise<number> = Promise.resolve(1);
          p.finally(() => {});
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
});
