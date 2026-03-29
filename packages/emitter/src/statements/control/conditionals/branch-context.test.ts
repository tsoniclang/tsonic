import { describe, it } from "mocha";
import { expect } from "chai";
import type { EmitterContext } from "../../../types.js";
import { mergeBranchContextMeta } from "./branch-context.js";

const baseContext = (): EmitterContext => ({
  indentLevel: 0,
  options: { rootNamespace: "Test", indent: 4 },
  isStatic: false,
  isAsync: false,
  usings: new Set<string>(),
});

describe("branch-context", () => {
  it("preserves local-name reservations from both branches", () => {
    const preferred: EmitterContext = {
      ...baseContext(),
      usedLocalNames: new Set(["listener"]),
      tempVarId: 2,
      usings: new Set(["System"]),
    };
    const alternate: EmitterContext = {
      ...baseContext(),
      usedLocalNames: new Set(["result"]),
      tempVarId: 5,
      usings: new Set(["System.Linq"]),
    };

    const merged = mergeBranchContextMeta(preferred, alternate);

    expect([...merged.usedLocalNames ?? []].sort()).to.deep.equal([
      "listener",
      "result",
    ]);
    expect(merged.tempVarId).to.equal(5);
    expect([...merged.usings].sort()).to.deep.equal([
      "System",
      "System.Linq",
    ]);
  });
});
