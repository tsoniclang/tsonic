import { describe, it } from "mocha";
import { expect } from "chai";
import * as ts from "typescript";
import { validateUnsupportedFeatures } from "./features.js";
import { createDiagnosticsCollector } from "../types/diagnostic.js";
import type { TsonicProgram } from "../program.js";

const runValidation = (sourceText: string) => {
  const sourceFile = ts.createSourceFile(
    "test.ts",
    sourceText,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TS
  );

  return validateUnsupportedFeatures(
    sourceFile,
    {} as TsonicProgram,
    createDiagnosticsCollector()
  );
};

describe("validateUnsupportedFeatures", () => {
  it("rejects with-statement in strict AOT mode (TSN2001)", () => {
    const result = runValidation(`
      const scope = { x: 1 };
      with (scope) {
        console.log(x);
      }
    `);

    expect(result.hasErrors).to.equal(true);
    expect(
      result.diagnostics.some(
        (d) =>
          d.code === "TSN2001" &&
          d.message.includes(
            "'with' statement is not supported in strict AOT mode"
          )
      )
    ).to.equal(true);
  });

  it("rejects import.meta (TSN2001)", () => {
    const result = runValidation(`
      const url = import.meta.url;
      console.log(url);
    `);

    expect(
      result.diagnostics.some(
        (d) =>
          d.code === "TSN2001" &&
          d.message.includes("Meta properties (import.meta) not supported")
      )
    ).to.equal(true);
  });

  it("rejects dynamic import() (TSN2001)", () => {
    const result = runValidation(`
      async function load() {
        return import("./module.js");
      }
    `);

    expect(
      result.diagnostics.some(
        (d) =>
          d.code === "TSN2001" &&
          d.message.includes("Dynamic import() not supported")
      )
    ).to.equal(true);
  });

  it("rejects Promise.then/catch/finally chaining (TSN3011)", () => {
    const result = runValidation(`
      declare const p: Promise<number>;
      p.then((x) => x + 1).catch(() => 0).finally(() => {});
    `);

    expect(
      result.diagnostics.some(
        (d) =>
          d.code === "TSN3011" &&
          d.message.includes("Promise.then() is not supported")
      )
    ).to.equal(true);
    expect(
      result.diagnostics.some(
        (d) =>
          d.code === "TSN3011" &&
          d.message.includes("Promise.catch() is not supported")
      )
    ).to.equal(true);
    expect(
      result.diagnostics.some(
        (d) =>
          d.code === "TSN3011" &&
          d.message.includes("Promise.finally() is not supported")
      )
    ).to.equal(true);
  });
});
