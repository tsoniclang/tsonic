import {
  describe,
  it,
  expect,
  collectCodes,
  collectCodesInTempProject,
} from "./helpers.js";

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
        name: "unsupported import.meta field",
        code: "TSN2001",
        source: `
          const env = import.meta.env;
          console.log(env);
        `,
      },
      {
        name: "dynamic import with unsupported runtime namespace export",
        code: "TSN2001",
        source: `
          async function load() {
            const module = await import("./module.js");
            return module.Box;
          }
          void load();
        `,
      },
    ];

    for (const scenario of shouldReject) {
      it(`rejects ${scenario.name}`, () => {
        const extraFiles: Readonly<Record<string, string>> =
          scenario.name ===
          "dynamic import with unsupported runtime namespace export"
            ? { "src/module.ts": "export class Box {}\n" }
            : {};
        const codes =
          scenario.name ===
          "dynamic import with unsupported runtime namespace export"
            ? collectCodesInTempProject(scenario.source, extraFiles)
            : collectCodes(scenario.source, extraFiles);
        expect(codes.includes(scenario.code)).to.equal(true);
      });
    }

    const shouldAllow: ReadonlyArray<{
      readonly name: string;
      readonly source: string;
    }> = [
      {
        name: "import.meta.url",
        source: `
          const url = import.meta.url;
          console.log(url);
        `,
      },
      {
        name: "import.meta.filename",
        source: `
          const file = import.meta.filename;
          console.log(file);
        `,
      },
      {
        name: "import.meta.dirname",
        source: `
          const dir = import.meta.dirname;
          console.log(dir);
        `,
      },
      {
        name: "bare import.meta object",
        source: `
          declare global {
            interface ImportMeta {
              readonly url: string;
              readonly filename: string;
              readonly dirname: string;
            }
          }
          const meta = import.meta;
          console.log(meta.url, meta.filename, meta.dirname);
        `,
      },
      {
        name: "awaited local dynamic import side-effect",
        source: `
          async function load(): Promise<void> {
            await import("./module.js");
          }
          void load();
        `,
      },
      {
        name: "closed-world dynamic import namespace value",
        source: `
          async function load(): Promise<number> {
            const module = await import("./module.js");
            return module.value;
          }
          void load();
        `,
      },
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
          void value;
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
        const extraFiles: Readonly<Record<string, string>> =
          scenario.name === "closed-world dynamic import namespace value" ||
          scenario.name === "awaited local dynamic import side-effect"
            ? { "src/module.ts": "export const value = 42;\n" }
            : {};
        const codes =
          scenario.name === "closed-world dynamic import namespace value" ||
          scenario.name === "awaited local dynamic import side-effect"
            ? collectCodesInTempProject(scenario.source, extraFiles)
            : collectCodes(scenario.source, extraFiles);
        expect(codes.includes("TSN2001")).to.equal(false);
        expect(codes.includes("TSN3011")).to.equal(false);
      });
    }
  });
});
