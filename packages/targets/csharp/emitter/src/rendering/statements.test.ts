import { describe, it } from "mocha";
import { expect } from "chai";
import type {
  LoweringExpressionPlan,
  LoweringStatementPlan,
  LoweringTypeRefPlan,
} from "@tsonic/frontend";
import type { RenderContext } from "../types.js";
import { renderStatement } from "./statements.js";

const dummySourceFile = {} as LoweringExpressionPlan["sourceFile"];
const dummySourceNode = {} as LoweringExpressionPlan["sourceNode"];

const createRenderContext = (): RenderContext => ({
  diagnostics: [],
  currentNamespace: "App",
  allocateTempName: (prefix) => `${prefix}_1`,
  getStructuralTypeName: () => "Structural0",
  externalBindingTargetName: () => undefined,
  overrideMemberAccessibility: () => undefined,
  reportUnsupported: () => undefined,
});

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

const statementPlan = (
  overrides: Partial<LoweringStatementPlan>
): LoweringStatementPlan => ({
  kind: "statement",
  sourceFile: dummySourceFile as LoweringStatementPlan["sourceFile"],
  sourceNode: dummySourceNode as LoweringStatementPlan["sourceNode"],
  sourceKind: 0,
  sourceKindName: "TestStatement",
  sourceText: "test",
  nameIsComputed: false,
  statementKind: "empty",
  declarations: [],
  statements: [],
  cases: [],
  ...overrides,
});

describe("C# statement renderer", () => {
  it("narrows extracted runtime-union arms to the instanceof constructor type", () => {
    const routerType: LoweringTypeRefPlan = {
      kind: "named",
      name: "Router",
      typeArguments: [],
      sourceQualifiedName: { namespace: "App", name: "Router" },
      declarationKind: "class",
    };
    const applicationType: LoweringTypeRefPlan = {
      kind: "named",
      name: "Application",
      typeArguments: [],
      sourceQualifiedName: { namespace: "App", name: "Application" },
      declarationKind: "class",
    };
    const candidateType: LoweringTypeRefPlan = {
      kind: "named",
      name: "Flattened",
      typeArguments: [],
      sourceQualifiedName: { namespace: "App", name: "Flattened" },
      declarationKind: "type-alias",
      aliasTarget: {
        kind: "union",
        types: [
          {
            kind: "intrinsic",
            name: "string",
          },
          routerType,
        ],
      },
    };

    const rendered = renderStatement(
      statementPlan({
        statementKind: "if",
        condition: expressionPlan({
          expressionKind: "binary",
          binaryOperator: "instanceof",
          left: expressionPlan({
            expressionKind: "identifier",
            name: "candidate",
            type: applicationType,
            storageTypePlan: candidateType,
          }),
          right: expressionPlan({
            expressionKind: "identifier",
            name: "Application",
            type: applicationType,
          }),
        }),
        thenStatement: statementPlan({
          statementKind: "block",
          statements: [
            statementPlan({
              statementKind: "expression",
              expression: expressionPlan({
                expressionKind: "binary",
                binaryOperator: "assign",
                left: expressionPlan({
                  expressionKind: "property-access",
                  expression: expressionPlan({
                    expressionKind: "identifier",
                    name: "candidate",
                    type: applicationType,
                    storageTypePlan: candidateType,
                  }),
                  literalText: "mountpath",
                  type: {
                    kind: "intrinsic",
                    name: "string",
                  },
                }),
                right: expressionPlan({
                  expressionKind: "literal",
                  literalKind: "string",
                  literalText: "/app",
                  type: {
                    kind: "intrinsic",
                    name: "string",
                  },
                }),
              }),
            }),
          ],
        }),
      }),
      createRenderContext()
    );

    expect(rendered).to.contain(
      "if ((candidate.As2()) is Application candidate__is_1)"
    );
    expect(rendered).to.contain('candidate__is_1.mountpath = "/app";');
    expect(rendered).to.not.contain("Router candidate__is_1");
    expect(rendered).to.not.contain("candidate.mountpath");
  });

  it("destructures nullable tuple unions through tuple item access", () => {
    const tupleType: LoweringTypeRefPlan = {
      kind: "tuple",
      readonly: true,
      elements: [
        { kind: "intrinsic", name: "string" },
        { kind: "intrinsic", name: "unknown" },
      ],
    };
    const nullableTupleType: LoweringTypeRefPlan = {
      kind: "union",
      types: [tupleType, { kind: "intrinsic", name: "undefined" }],
    };

    const rendered = renderStatement(
      statementPlan({
        statementKind: "variable",
        declarations: [
          {
            sourceNode: dummySourceNode,
            name: "entry",
            storageType: {
              kind: "object",
              members: [
                { kind: "property", name: "0", optional: false },
                { kind: "property", name: "1", optional: false },
                { kind: "property", name: "length", optional: false },
              ],
            },
            initializer: expressionPlan({
              expressionKind: "identifier",
              name: "first",
              type: nullableTupleType,
              storageTypePlan: nullableTupleType,
              literalText: "first",
            }),
            bindingElements: [
              {
                name: "key",
                accessPath: [{ kind: "element", index: 0 }],
                type: { kind: "intrinsic", name: "string" },
              },
              {
                name: "value",
                accessPath: [{ kind: "element", index: 1 }],
                type: { kind: "intrinsic", name: "unknown" },
              },
            ],
          },
        ],
      }),
      createRenderContext()
    );

    expect(rendered).to.contain("binding_1.Value.Item1");
    expect(rendered).to.contain("binding_1.Value.Item2");
    expect(rendered).not.to.contain("binding_1[0]");
    expect(rendered).not.to.contain("binding_1[1]");
  });
});
