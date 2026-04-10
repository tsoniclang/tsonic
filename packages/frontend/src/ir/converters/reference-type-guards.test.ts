import { expect } from "chai";
import { describe, it } from "mocha";
import type { IrType } from "../types.js";
import { narrowTypeByAssignableTarget } from "./reference-type-guards.js";

const makeRef = (name: string): IrType => ({
  kind: "referenceType",
  name,
});

const makeUnion = (...types: IrType[]): IrType => ({
  kind: "unionType",
  types,
});

describe("reference-type-guards", () => {
  it("narrows nominal base-class values directly to instanceof targets", () => {
    const templateValue = makeRef("TemplateValue");
    const siteValue = makeRef("SiteValue");

    const result = narrowTypeByAssignableTarget(
      {
        collectNarrowingCandidates: () => [],
        isAssignableTo: (source, target) => {
          if (
            source.kind !== "referenceType" ||
            target.kind !== "referenceType"
          ) {
            return false;
          }
          return (
            source.name === target.name ||
            (source.name === "SiteValue" && target.name === "TemplateValue")
          );
        },
      },
      templateValue,
      siteValue,
      true
    );

    expect(result).to.deep.equal(siteValue);
  });

  it("reuses expanded target leaves when nominal base-class narrowing flows through aliases", () => {
    const templateValue = makeRef("TemplateValue");
    const wrapperAlias = makeRef("WrapperValue");
    const pageValue = makeRef("PageValue");
    const siteValue = makeRef("SiteValue");

    const result = narrowTypeByAssignableTarget(
      {
        collectNarrowingCandidates: (type) =>
          type.kind === "referenceType" && type.name === "WrapperValue"
            ? [pageValue, siteValue]
            : [],
        isAssignableTo: (source, target) => {
          if (
            source.kind !== "referenceType" ||
            target.kind !== "referenceType"
          ) {
            return false;
          }
          return (
            source.name === target.name ||
            ((source.name === "PageValue" || source.name === "SiteValue") &&
              target.name === "TemplateValue")
          );
        },
      },
      templateValue,
      wrapperAlias,
      true
    );

    expect(result).to.deep.equal(makeUnion(pageValue, siteValue));
  });
});
