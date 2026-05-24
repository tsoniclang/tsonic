import { describe, it } from "mocha";
import { expect } from "chai";
import {
  addResidualYieldDiagnostics,
  type LoweringContext,
} from "./yield-lowering-helpers.js";

describe("yield lowering helpers", () => {
  it("scans cyclic lowered structures without overflowing the stack", () => {
    const cyclic: Record<string, unknown> = {
      kind: "referenceType",
      name: "Recursive",
    };
    cyclic.self = cyclic;

    const ctx: LoweringContext = {
      filePath: "/test/test.ts",
      diagnostics: [],
      inGenerator: true,
      yieldTempCounter: 0,
    };

    expect(() => addResidualYieldDiagnostics(ctx, cyclic)).to.not.throw();
    expect(ctx.diagnostics).to.have.length(0);
  });
});
