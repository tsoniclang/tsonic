import { describe, it } from "mocha";
import { expect } from "chai";
import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../emitter-types/core.js";
import { semanticTypeMap, storageCarrierMap } from "../../types.js";
import { applyBinding } from "./narrowing-builder-core.js";

describe("narrowing builder core", () => {
  it("keeps declared local symbol tables unchanged when applying flow narrowing", () => {
    const valueType: IrType = {
      kind: "referenceType",
      name: "Value",
      resolvedClrType: "App.Value",
    };
    const siteValueType: IrType = {
      kind: "referenceType",
      name: "SiteValue",
      resolvedClrType: "App.SiteValue",
    };
    const context: EmitterContext = {
      indentLevel: 0,
      options: { rootNamespace: "Test", surface: "@tsonic/js", indent: 2 },
      isStatic: false,
      isAsync: false,
      usings: new Set<string>(),
      localSemanticTypes: semanticTypeMap([["cur", valueType]]),
      localValueTypes: storageCarrierMap([["cur", valueType]]),
    };

    const binding = {
      kind: "expr" as const,
      exprAst: {
        kind: "identifierExpression" as const,
        identifier: "cur__site",
      },
      storageExprAst: {
        kind: "identifierExpression" as const,
        identifier: "cur",
      },
      carrierExprAst: {
        kind: "identifierExpression" as const,
        identifier: "cur",
      },
      storageType: siteValueType,
      type: siteValueType,
      sourceType: valueType,
    };

    const nextContext = applyBinding("cur", binding, context);

    expect(nextContext.localSemanticTypes?.get("cur")).to.deep.equal(valueType);
    expect(nextContext.localValueTypes?.get("cur")).to.deep.equal(valueType);
    expect(nextContext.narrowedBindings?.get("cur")).to.deep.equal(binding);
  });
});
