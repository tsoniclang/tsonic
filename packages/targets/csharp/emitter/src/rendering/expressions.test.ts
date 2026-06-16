import { describe, it } from "mocha";
import { expect } from "chai";
import type {
  LoweringExpressionPlan,
  LoweringTypeRefPlan,
} from "@tsonic/frontend";
import type { RenderContext } from "../types.js";
import {
  renderExpression,
  renderExpressionWithUseSiteCast,
  renderFunctionExpressionType,
} from "./expressions.js";

const dummySourceFile = {} as LoweringExpressionPlan["sourceFile"];
const dummySourceNode = {} as LoweringExpressionPlan["sourceNode"];

const createRenderContext = (
  unsupportedFeatures: string[] = [],
  externalBindingTargetName: RenderContext["externalBindingTargetName"] = () =>
    undefined
): RenderContext => ({
  diagnostics: [],
  allocateTempName: (prefix) => `${prefix}0`,
  getStructuralTypeName: () => "Structural0",
  externalBindingTargetName,
  overrideMemberAccessibility: () => undefined,
  reportUnsupported: (feature) => {
    unsupportedFeatures.push(feature);
  },
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

const stringType: LoweringTypeRefPlan = {
  kind: "intrinsic",
  name: "string",
};

const voidType: LoweringTypeRefPlan = {
  kind: "intrinsic",
  name: "void",
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
          literalText: "",
        }),
        context
      )
    ).to.equal('""');

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

  it("renders source-level byref passing modes on call arguments", () => {
    const context = createRenderContext();

    const rendered = renderExpression(
      expressionPlan({
        expressionKind: "call",
        expression: expressionPlan({
          expressionKind: "identifier",
          literalText: "tryRead",
        }),
        arguments: [
          expressionPlan({
            expressionKind: "identifier",
            literalText: "target",
            passingMode: "byref-writeonly-must-init",
          }),
          expressionPlan({
            expressionKind: "identifier",
            literalText: "current",
            passingMode: "byref-readwrite",
          }),
          expressionPlan({
            expressionKind: "identifier",
            literalText: "snapshot",
            passingMode: "byref-readonly",
          }),
        ],
      }),
      context
    );

    expect(rendered).to.equal("tryRead(out target, ref current, in snapshot)");
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
      "new global::System.Collections.Generic.List<int>(global::System.Linq.Enumerable.Concat(global::System.Linq.Enumerable.Concat(new int[] { ((int)(1)) }, items), new int[] { ((int)(2)) }))"
    );
  });

  it("uses exact runtime-union arm type before array category matching", () => {
    const context = createRenderContext();
    const stringArrayType: LoweringTypeRefPlan = {
      kind: "array",
      elementType: stringType,
      readonly: false,
    };
    const intArrayType: LoweringTypeRefPlan = {
      kind: "array",
      elementType: intType,
      readonly: false,
    };
    const unionType: LoweringTypeRefPlan = {
      kind: "union",
      types: [stringArrayType, intArrayType],
    };

    const rendered = renderExpressionWithUseSiteCast(
      expressionPlan({
        expressionKind: "array-literal",
        type: intArrayType,
        elements: [],
      }),
      context,
      unionType
    );

    expect(rendered).to.contain(".From2(");
    expect(rendered).to.contain(
      "new global::System.Collections.Generic.List<int>"
    );
  });

  it("selects a runtime-union array arm through a named alias target", () => {
    const context = createRenderContext();
    const stringArrayType: LoweringTypeRefPlan = {
      kind: "array",
      elementType: stringType,
      readonly: true,
    };
    const aliasType: LoweringTypeRefPlan = {
      kind: "named",
      name: "PathItems",
      declarationKind: "type-alias",
      typeArguments: [],
      aliasTarget: stringArrayType,
    };
    const unionType: LoweringTypeRefPlan = {
      kind: "union",
      types: [stringType, aliasType],
    };

    const rendered = renderExpressionWithUseSiteCast(
      expressionPlan({
        expressionKind: "array-literal",
        elements: [
          expressionPlan({
            expressionKind: "literal",
            literalKind: "string",
            literalText: "users",
          }),
        ],
      }),
      context,
      unionType
    );

    expect(rendered).to.contain(".From2(");
    expect(rendered).to.contain('new string[] { ((string)("users")) }');
  });

  it("renders external collection element access through named alias targets", () => {
    const context = createRenderContext([], (binding) =>
      binding.sourceName === "List_1"
        ? "System.Collections.Generic.List`1"
        : undefined
    );
    const listType: LoweringTypeRefPlan = {
      kind: "named",
      name: "List_1",
      externalBinding: {
        bindingFile: "/bindings/System.Collections.Generic/bindings.json",
        sourceName: "List_1",
        arity: 1,
      },
      typeArguments: [intType],
      aliasTarget: {
        kind: "intersection",
        types: [],
      },
    };

    const rendered = renderExpression(
      expressionPlan({
        expressionKind: "element-access",
        expression: expressionPlan({
          expressionKind: "identifier",
          literalText: "numbers",
          storageTypePlan: listType,
        }),
        receiverTypePlan: listType,
        arguments: [
          expressionPlan({
            expressionKind: "literal",
            literalKind: "number",
            literalText: "0",
          }),
        ],
      }),
      context
    );

    expect(rendered).to.equal("numbers[0]");
  });

  it("wraps raw callable storage when selecting a named callable union arm", () => {
    const context = createRenderContext();
    const requestHandlerFunction: LoweringTypeRefPlan = {
      kind: "function",
      parameters: [
        {
          name: "req",
          sourceKindName: "Parameter",
          sourceText: "req",
          type: stringType,
          optional: false,
          rest: false,
        },
      ],
      returnType: voidType,
      typeParameters: [],
    };
    const errorHandlerFunction: LoweringTypeRefPlan = {
      kind: "function",
      parameters: [
        {
          name: "error",
          sourceKindName: "Parameter",
          sourceText: "error",
          type: { kind: "intrinsic", name: "unknown" },
          optional: false,
          rest: false,
        },
        {
          name: "req",
          sourceKindName: "Parameter",
          sourceText: "req",
          type: stringType,
          optional: false,
          rest: false,
        },
      ],
      returnType: voidType,
      typeParameters: [],
    };
    const requestHandlerType: LoweringTypeRefPlan = {
      kind: "named",
      name: "RequestHandler",
      declarationKind: "interface",
      typeArguments: [],
      aliasTarget: requestHandlerFunction,
    };
    const errorHandlerType: LoweringTypeRefPlan = {
      kind: "named",
      name: "ErrorRequestHandler",
      declarationKind: "interface",
      typeArguments: [],
      aliasTarget: errorHandlerFunction,
    };
    const middlewareType: LoweringTypeRefPlan = {
      kind: "named",
      name: "MiddlewareHandler",
      declarationKind: "type-alias",
      typeArguments: [],
      aliasTarget: {
        kind: "union",
        types: [requestHandlerType, errorHandlerType],
      },
    };

    const rendered = renderExpressionWithUseSiteCast(
      expressionPlan({
        expressionKind: "identifier",
        literalText: "handler",
        type: requestHandlerFunction,
        storageTypePlan: requestHandlerFunction,
      }),
      context,
      middlewareType
    );

    expect(rendered).to.equal(
      "Structural0.From1(new RequestHandler(handler.Invoke))"
    );
  });

  it("casts broad storage when TSTS narrows it to a named callable union arm", () => {
    const context = createRenderContext();
    const requestHandlerFunction: LoweringTypeRefPlan = {
      kind: "function",
      parameters: [
        {
          name: "req",
          sourceKindName: "Parameter",
          sourceText: "req",
          type: stringType,
          optional: false,
          rest: false,
        },
      ],
      returnType: voidType,
      typeParameters: [],
    };
    const requestHandlerType: LoweringTypeRefPlan = {
      kind: "named",
      name: "RequestHandler",
      declarationKind: "interface",
      typeArguments: [],
      aliasTarget: requestHandlerFunction,
    };
    const errorHandlerType: LoweringTypeRefPlan = {
      kind: "named",
      name: "ErrorRequestHandler",
      declarationKind: "interface",
      typeArguments: [],
      aliasTarget: {
        kind: "function",
        parameters: [
          {
            name: "error",
            sourceKindName: "Parameter",
            sourceText: "error",
            type: { kind: "intrinsic", name: "unknown" },
            optional: false,
            rest: false,
          },
          {
            name: "req",
            sourceKindName: "Parameter",
            sourceText: "req",
            type: stringType,
            optional: false,
            rest: false,
          },
        ],
        returnType: voidType,
        typeParameters: [],
      },
    };
    const middlewareType: LoweringTypeRefPlan = {
      kind: "named",
      name: "MiddlewareHandler",
      declarationKind: "type-alias",
      typeArguments: [],
      aliasTarget: {
        kind: "union",
        types: [requestHandlerType, errorHandlerType],
      },
    };

    const rendered = renderExpressionWithUseSiteCast(
      expressionPlan({
        expressionKind: "identifier",
        literalText: "handler",
        type: requestHandlerFunction,
        storageTypePlan: { kind: "intrinsic", name: "unknown" },
      }),
      context,
      middlewareType
    );

    expect(rendered).to.equal("Structural0.From1((RequestHandler)handler)");
  });

  it("converts array elements into a named runtime-union carrier", () => {
    const context = createRenderContext();
    const requestHandlerType: LoweringTypeRefPlan = {
      kind: "named",
      name: "RequestHandler",
      declarationKind: "interface",
      typeArguments: [],
      aliasTarget: {
        kind: "function",
        parameters: [],
        returnType: voidType,
        typeParameters: [],
      },
    };
    const middlewareType: LoweringTypeRefPlan = {
      kind: "named",
      name: "MiddlewareHandler",
      declarationKind: "type-alias",
      typeArguments: [],
      aliasTarget: {
        kind: "union",
        types: [
          requestHandlerType,
          {
            kind: "named",
            name: "Router",
            declarationKind: "class",
            typeArguments: [],
          },
        ],
      },
    };

    const rendered = renderExpressionWithUseSiteCast(
      expressionPlan({
        expressionKind: "identifier",
        literalText: "handlers",
        type: {
          kind: "array",
          elementType: requestHandlerType,
          readonly: true,
        },
        storageTypePlan: {
          kind: "array",
          elementType: requestHandlerType,
          readonly: true,
        },
      }),
      context,
      {
        kind: "array",
        elementType: middlewareType,
        readonly: false,
      }
    );

    expect(rendered).to.contain(
      "global::System.Linq.Enumerable.Select<RequestHandler, Structural0>"
    );
    expect(rendered).to.contain("Structural0.From1(item)");
  });

  it("selects the most specific matching runtime-union array arm", () => {
    const context = createRenderContext();
    const stringArrayType: LoweringTypeRefPlan = {
      kind: "array",
      elementType: stringType,
      readonly: true,
    };
    const stringOrNumberArrayType: LoweringTypeRefPlan = {
      kind: "array",
      elementType: {
        kind: "union",
        types: [stringType, { kind: "intrinsic", name: "number" }],
      },
      readonly: true,
    };
    const unionType: LoweringTypeRefPlan = {
      kind: "union",
      types: [stringOrNumberArrayType, stringArrayType],
    };

    const rendered = renderExpressionWithUseSiteCast(
      expressionPlan({
        expressionKind: "array-literal",
        elements: [
          expressionPlan({
            expressionKind: "literal",
            literalKind: "string",
            literalText: "users",
            type: stringType,
          }),
        ],
      }),
      context,
      unionType
    );

    expect(rendered).to.contain(".From2(");
  });

  it("keeps ambiguous runtime-union array literals unsupported", () => {
    const unsupportedFeatures: string[] = [];
    const context = createRenderContext(unsupportedFeatures);
    const unionType: LoweringTypeRefPlan = {
      kind: "union",
      types: [
        {
          kind: "array",
          elementType: stringType,
          readonly: true,
        },
        {
          kind: "array",
          elementType: { kind: "intrinsic", name: "number" },
          readonly: true,
        },
      ],
    };

    const rendered = renderExpressionWithUseSiteCast(
      expressionPlan({
        expressionKind: "array-literal",
        elements: [],
      }),
      context,
      unionType
    );

    expect(rendered).to.not.contain(".From1(");
    expect(rendered).to.not.contain(".From2(");
    expect(unsupportedFeatures).to.include("runtime union arm selection");
  });

  it("renders array literals as tuple values from the tuple use-site", () => {
    const context = createRenderContext();
    const tupleType: LoweringTypeRefPlan = {
      kind: "tuple",
      elements: [stringType, stringType],
      readonly: false,
    };

    const rendered = renderExpressionWithUseSiteCast(
      expressionPlan({
        expressionKind: "array-literal",
        elements: [
          expressionPlan({
            expressionKind: "literal",
            literalKind: "string",
            literalText: "name",
          }),
          expressionPlan({
            expressionKind: "literal",
            literalKind: "string",
            literalText: "value",
          }),
        ],
      }),
      context,
      tupleType
    );

    expect(rendered).to.equal(
      '(((string)("name")), ((string)("value")))'
    );
  });

  it("does not pick an arbitrary runtime-union array arm", () => {
    const unsupportedFeatures: string[] = [];
    const context = createRenderContext(unsupportedFeatures);
    const unionType: LoweringTypeRefPlan = {
      kind: "union",
      types: [
        {
          kind: "array",
          elementType: stringType,
          readonly: false,
        },
        {
          kind: "array",
          elementType: intType,
          readonly: false,
        },
      ],
    };

    const rendered = renderExpressionWithUseSiteCast(
      expressionPlan({
        expressionKind: "array-literal",
        elements: [],
      }),
      context,
      unionType
    );

    expect(rendered).to.not.contain(".From1(");
    expect(rendered).to.not.contain(".From2(");
    expect(rendered).to.not.contain("((Structural0)(");
    expect(unsupportedFeatures).to.include("runtime union arm selection");
  });

  it("renders string length only from a TSTS-proven runtime operation", () => {
    const context = createRenderContext();
    const receiver = expressionPlan({
      expressionKind: "identifier",
      literalText: "value",
      type: stringType,
    });

    expect(
      renderExpression(
        expressionPlan({
          expressionKind: "property-access",
          literalText: "length",
          expression: receiver,
          receiverTypePlan: stringType,
        }),
        context
      )
    ).to.equal("value.length");

    expect(
      renderExpression(
        expressionPlan({
          expressionKind: "property-access",
          literalText: "length",
          expression: receiver,
          receiverTypePlan: stringType,
          sourceOperation: {
            owner: "String",
            member: "length",
            dispatch: "property",
          },
        }),
        context
      )
    ).to.equal("value.Length");
  });

  it("renders Function.length only from a direct function-expression plan", () => {
    const context = createRenderContext();
    const lengthOperation = {
      owner: "Function" as const,
      member: "length",
      dispatch: "property" as const,
    };

    expect(
      renderExpression(
        expressionPlan({
          expressionKind: "property-access",
          literalText: "length",
          sourceOperation: lengthOperation,
          expression: expressionPlan({
            expressionKind: "function-expression",
            parameters: [
              {
                name: "first",
                sourceKindName: "Parameter",
                sourceText: "first",
                optional: false,
                rest: false,
              },
              {
                name: "second",
                sourceKindName: "Parameter",
                sourceText: "second = 1",
                optional: false,
                rest: false,
                initializer: expressionPlan({
                  expressionKind: "literal",
                  literalKind: "number",
                  literalText: "1",
                }),
              },
            ],
          }),
        }),
        context
      )
    ).to.equal("1");
  });

  it("reports unsupported Function.length for non-direct function receivers", () => {
    const unsupportedFeatures: string[] = [];
    const context = createRenderContext(unsupportedFeatures);

    expect(
      renderExpression(
        expressionPlan({
          expressionKind: "property-access",
          literalText: "length",
          sourceOperation: {
            owner: "Function",
            member: "length",
            dispatch: "property",
          },
          expression: expressionPlan({
            expressionKind: "identifier",
            literalText: "fn",
          }),
        }),
        context
      )
    ).to.equal("0");
    expect(unsupportedFeatures).to.include("Function.length receiver");
  });

  it("reports missing required plan data instead of inventing renderer defaults", () => {
    const unsupportedFeatures: string[] = [];
    const context = createRenderContext(unsupportedFeatures);
    const receiver = expressionPlan({
      expressionKind: "identifier",
      literalText: "items",
      type: {
        kind: "array",
        elementType: intType,
        readonly: false,
      },
    });

    expect(
      renderExpression(
        expressionPlan({
          expressionKind: "identifier",
        }),
        context
      )
    ).to.equal("");
    expect(
      renderExpression(
        expressionPlan({
          expressionKind: "property-access",
          expression: receiver,
        }),
        context
      )
    ).to.equal("");
    expect(
      renderExpression(
        expressionPlan({
          expressionKind: "literal",
          literalKind: "number",
        }),
        context
      )
    ).to.equal("");
    expect(
      renderExpression(
        expressionPlan({
          expressionKind: "call",
          expression: expressionPlan({
            expressionKind: "property-access",
            expression: receiver,
            sourceOperation: {
              owner: "Array",
              member: "map",
              dispatch: "receiver-call",
            },
          }),
          sourceOperation: {
            owner: "Array",
            member: "map",
            dispatch: "receiver-call",
          },
        }),
        context
      )
    ).to.contain("Select(");

    expect(unsupportedFeatures).to.include("identifier name");
    expect(unsupportedFeatures).to.include("property member name");
    expect(unsupportedFeatures).to.include("number literal text");
    expect(unsupportedFeatures).to.include("Array.map callback");
  });

  it("reports missing function-expression return types instead of inventing void delegates", () => {
    const unsupportedFeatures: string[] = [];
    const context = createRenderContext(unsupportedFeatures);

    const rendered = renderFunctionExpressionType(
      expressionPlan({
        expressionKind: "arrow-function",
        parameters: [],
        sourceKindName: "ArrowFunction",
        sourceText: "() => value",
      }),
      context
    );

    expect(rendered).to.equal("global::System.Func<object?>");
    expect(unsupportedFeatures).to.include("function return type");
  });
});
