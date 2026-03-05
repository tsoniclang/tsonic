import { describe, it } from "mocha";
import { expect } from "chai";
import { getJsArrayMethodRule } from "./js-array-rules.js";

describe("js-array-rules", () => {
  it("defines deterministic rewrite rules for supported JS array methods", () => {
    const supportedMethods = [
      "at",
      "concat",
      "every",
      "filter",
      "find",
      "findIndex",
      "findLast",
      "findLastIndex",
      "flat",
      "forEach",
      "includes",
      "indexOf",
      "join",
      "lastIndexOf",
      "map",
      "reduce",
      "reduceRight",
      "slice",
      "some",
    ] as const;

    for (const methodName of supportedMethods) {
      expect(getJsArrayMethodRule(methodName)).to.not.equal(undefined);
    }
  });

  it("maps functional terminal rules to explicit strategies", () => {
    expect(getJsArrayMethodRule("map")?.strategy.kind).to.equal(
      "linqSelectToArray"
    );
    expect(getJsArrayMethodRule("filter")?.strategy.kind).to.equal(
      "linqWhereToArray"
    );
    expect(getJsArrayMethodRule("reduce")?.strategy.kind).to.equal(
      "linqAggregate"
    );
    expect(getJsArrayMethodRule("reduceRight")?.strategy.kind).to.equal(
      "linqAggregateReverse"
    );
    expect(getJsArrayMethodRule("join")?.strategy.kind).to.equal("stringJoin");
  });

  it("rejects unsupported mutating methods", () => {
    expect(getJsArrayMethodRule("push")).to.equal(undefined);
    expect(getJsArrayMethodRule("pop")).to.equal(undefined);
    expect(getJsArrayMethodRule("splice")).to.equal(undefined);
  });
});
