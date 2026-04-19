import { expect } from "chai";
import { describe, it } from "mocha";
import { substituteTypeParameters } from "./call-site-analysis-unification.js";

describe("call-site-analysis-unification", () => {
  it("substitutes bare reference placeholders that carry call-site type parameters", () => {
    const result = substituteTypeParameters(
      { kind: "referenceType", name: "TEntity" },
      new Map([["TEntity", { kind: "referenceType", name: "PostEntity" }]])
    );

    expect(result).to.deep.equal({
      kind: "referenceType",
      name: "PostEntity",
    });
  });

  it("does not rewrite unrelated concrete reference types", () => {
    const original = { kind: "referenceType", name: "DbContext" } as const;

    const result = substituteTypeParameters(
      original,
      new Map([["TEntity", { kind: "referenceType", name: "PostEntity" }]])
    );

    expect(result).to.deep.equal(original);
  });
});
