import { describe, it } from "mocha";
import { expect } from "chai";
import type {
  LoweringExpressionPlan,
  LoweringTypeRefPlan,
} from "@tsonic/frontend";
import type { RenderContext } from "../types.js";
import { renderExpression } from "./expressions.js";

const dummySourceFile = {} as LoweringExpressionPlan["sourceFile"];
const dummySourceNode = {} as LoweringExpressionPlan["sourceNode"];

const createRenderContext = (): RenderContext => ({
  diagnostics: [],
  allocateTempName: (prefix) => `${prefix}0`,
  getStructuralTypeName: () => "Structural0",
  overrideMemberAccessibility: () => undefined,
  reportUnsupported: () => {},
});

const intType: LoweringTypeRefPlan = {
  kind: "source-primitive",
  fact: {
    sourceName: "int",
    kind: "int32",
    runtimeBase: "number",
    signed: true,
    width: 32,
  },
};

const charType: LoweringTypeRefPlan = {
  kind: "source-primitive",
  fact: {
    sourceName: "char",
    kind: "char",
    runtimeBase: "string",
    width: 16,
  },
};

const expressionPlan = (
  overrides: Partial<LoweringExpressionPlan>
): LoweringExpressionPlan => ({
  kind: "expression",
  sourceFile: dummySourceFile,
  sourceNode: dummySourceNode,
  sourceKind: 0,
  sourceKindName: "TestExpression",
  sourceText: "test",
  nameIsComputed: false,
  expressionKind: "unsupported",
  arguments: [],
  typeArguments: [],
  elements: [],
  properties: [],
  templateParts: [],
  parameters: [],
  ...overrides,
});

describe("C# expression renderer", () => {
  it("renders char-context string literals as C# char literals", () => {
    const context = createRenderContext();

    expect(
      renderExpression(
        expressionPlan({
          expressionKind: "literal",
          literalKind: "string",
          literalText: "A",
          contextualTypePlan: charType,
        }),
        context
      )
    ).to.equal("'A'");
    expect(
      renderExpression(
        expressionPlan({
          expressionKind: "literal",
          literalKind: "string",
          literalText: "'",
          contextualTypePlan: charType,
        }),
        context
      )
    ).to.equal("'\\''");
    expect(
      renderExpression(
        expressionPlan({
          expressionKind: "literal",
          literalKind: "string",
          literalText: "\\",
          contextualTypePlan: charType,
        }),
        context
      )
    ).to.equal("'\\\\'");
  });

  it("renders mutable array literal spread into the JS-mutable list carrier", () => {
    const context = createRenderContext();
    const arrayType: LoweringTypeRefPlan = {
      kind: "array",
      elementType: intType,
      readonly: false,
    };

    const rendered = renderExpression(
      expressionPlan({
        expressionKind: "array-literal",
        contextualTypePlan: arrayType,
        elements: [
          expressionPlan({
            expressionKind: "literal",
            literalKind: "number",
            literalText: "1",
            contextualTypePlan: intType,
          }),
          expressionPlan({
            expressionKind: "spread",
            expression: expressionPlan({
              expressionKind: "identifier",
              literalText: "items",
              type: arrayType,
            }),
          }),
          expressionPlan({
            expressionKind: "literal",
            literalKind: "number",
            literalText: "2",
            contextualTypePlan: intType,
          }),
        ],
      }),
      context
    );

    expect(rendered).to.equal(
      "new global::System.Collections.Generic.List<int>(global::System.Linq.Enumerable.Concat(global::System.Linq.Enumerable.Concat(new int[] { 1 }, items), new int[] { 2 }))"
    );
  });
});
