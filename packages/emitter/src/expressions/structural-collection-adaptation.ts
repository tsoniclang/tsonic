import { IrType } from "@tsonic/frontend";
import { emitTypeAst } from "../type-emitter.js";
import { emitRuntimeCarrierTypeAst } from "../core/semantic/runtime-unions.js";
import { matchesExpectedEmissionType } from "../core/semantic/expected-type-matching.js";
import type {
  CSharpExpressionAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";
import {
  identifierExpression,
  identifierType,
  nullLiteral,
} from "../core/format/backend-ast/builders.js";
import { allocateLocalName } from "../core/format/local-names.js";
import type { EmitterContext } from "../types.js";
import { hasNullishBranch } from "./exact-comparison.js";
import {
  StructuralAdaptFn,
  UpcastFn,
  buildDelegateType,
} from "./structural-adaptation-types.js";
import {
  getArrayElementType,
  getDictionaryValueType,
} from "./structural-type-shapes.js";

const isDirectlyReusableExpression = (
  expression: CSharpExpressionAst
): boolean =>
  expression.kind === "identifierExpression" ||
  expression.kind === "memberAccessExpression" ||
  expression.kind === "elementAccessExpression";

export const tryAdaptStructuralCollectionExpressionAst = (
  emittedAst: CSharpExpressionAst,
  sourceType: IrType | undefined,
  context: EmitterContext,
  expectedType: IrType | undefined,
  adaptStructuralExpressionAst: StructuralAdaptFn,
  upcastFn?: UpcastFn
): [CSharpExpressionAst, EmitterContext] | undefined => {
  const targetElementType = getArrayElementType(expectedType, context);
  const sourceElementType = getArrayElementType(sourceType, context);
  if (targetElementType && sourceElementType) {
    if (
      matchesExpectedEmissionType(sourceElementType, targetElementType, context)
    ) {
      return [emittedAst, context];
    }

    const item = allocateLocalName("__item", context);
    let currentContext = item.context;
    const itemIdentifier: CSharpExpressionAst = {
      kind: "identifierExpression",
      identifier: item.emittedName,
    };
    const structuralElementAdaptation = adaptStructuralExpressionAst(
      itemIdentifier,
      sourceElementType,
      currentContext,
      targetElementType,
      upcastFn
    );
    const upcastElementAdaptation =
      structuralElementAdaptation ??
      (upcastFn
        ? upcastFn(
            itemIdentifier,
            sourceElementType,
            currentContext,
            targetElementType,
            new Set<string>()
          )
        : undefined);
    const adaptedElementAst =
      structuralElementAdaptation?.[0] ?? upcastElementAdaptation?.[0];
    currentContext =
      structuralElementAdaptation?.[1] ??
      upcastElementAdaptation?.[1] ??
      currentContext;
    const needsElementAdaptation =
      adaptedElementAst !== undefined && adaptedElementAst !== itemIdentifier;
    if (needsElementAdaptation) {
      const [sourceElementTypeAst, , sourceElementTypeContext] =
        emitRuntimeCarrierTypeAst(
          sourceElementType,
          currentContext,
          emitTypeAst
        );
      currentContext = sourceElementTypeContext;
      const [targetElementTypeAst, , targetElementTypeContext] =
        emitRuntimeCarrierTypeAst(
          targetElementType,
          currentContext,
          emitTypeAst
        );
      currentContext = targetElementTypeContext;
      const selectAst: CSharpExpressionAst = {
        kind: "invocationExpression",
        expression: {
          ...identifierExpression("global::System.Linq.Enumerable.Select"),
        },
        typeArguments: [sourceElementTypeAst, targetElementTypeAst],
        arguments: [
          emittedAst,
          {
            kind: "lambdaExpression",
            isAsync: false,
            parameters: [{ name: item.emittedName }],
            body: adaptedElementAst,
          },
        ],
      };
      const toArrayAst: CSharpExpressionAst = {
        kind: "invocationExpression",
        expression: {
          ...identifierExpression("global::System.Linq.Enumerable.ToArray"),
        },
        typeArguments: [targetElementTypeAst],
        arguments: [selectAst],
      };
      const [targetArrayTypeAst, targetArrayTypeContext] = emitTypeAst(
        expectedType!,
        currentContext
      );
      currentContext = targetArrayTypeContext;
      const materializedArrayAst: CSharpExpressionAst = {
        kind: "castExpression",
        type: targetArrayTypeAst,
        expression: toArrayAst,
      };

      if (!hasNullishBranch(sourceType)) {
        return [materializedArrayAst, currentContext];
      }

      if (isDirectlyReusableExpression(emittedAst)) {
        return [
          {
            kind: "conditionalExpression",
            condition: {
              kind: "binaryExpression",
              operatorToken: "==",
              left: emittedAst,
              right: nullLiteral(),
            },
            whenTrue: { kind: "defaultExpression" },
            whenFalse: materializedArrayAst,
          },
          currentContext,
        ];
      }
    }
  }

  const targetValueType = getDictionaryValueType(expectedType, context);
  const sourceValueType = getDictionaryValueType(sourceType, context);
  if (!targetValueType || !sourceValueType) {
    return undefined;
  }

  let currentContext = context;
  const [targetValueTypeAst, valueTypeContext] = emitTypeAst(
    targetValueType,
    currentContext
  );
  currentContext = valueTypeContext;
  const dictTypeAst: CSharpTypeAst = identifierType(
    "global::System.Collections.Generic.Dictionary",
    [{ kind: "predefinedType", keyword: "string" }, targetValueTypeAst]
  );
  const sourceTemp = allocateLocalName("__dict", currentContext);
  currentContext = sourceTemp.context;
  const entryTemp = allocateLocalName("__entry", currentContext);
  currentContext = entryTemp.context;
  const resultTemp = allocateLocalName("__result", currentContext);
  currentContext = resultTemp.context;

  const entryValueAst: CSharpExpressionAst = {
    kind: "memberAccessExpression",
    expression: {
      kind: "identifierExpression",
      identifier: entryTemp.emittedName,
    },
    memberName: "Value",
  };
  const [adaptedValueAst, adaptedContext] = adaptStructuralExpressionAst(
    entryValueAst,
    sourceValueType,
    currentContext,
    targetValueType,
    upcastFn
  ) ?? [undefined, currentContext];
  currentContext = adaptedContext;
  if (adaptedValueAst === undefined) {
    return undefined;
  }

  const statements: CSharpStatementAst[] = [
    {
      kind: "localDeclarationStatement",
      modifiers: [],
      type: { kind: "varType" },
      declarators: [
        {
          name: sourceTemp.emittedName,
          initializer: emittedAst,
        },
      ],
    },
    {
      kind: "ifStatement",
      condition: {
        kind: "binaryExpression",
        operatorToken: "==",
        left: {
          kind: "identifierExpression",
          identifier: sourceTemp.emittedName,
        },
        right: nullLiteral(),
      },
      thenStatement: {
        kind: "blockStatement",
        statements: [
          {
            kind: "returnStatement",
            expression: { kind: "defaultExpression", type: dictTypeAst },
          },
        ],
      },
    },
    {
      kind: "localDeclarationStatement",
      modifiers: [],
      type: { kind: "varType" },
      declarators: [
        {
          name: resultTemp.emittedName,
          initializer: {
            kind: "objectCreationExpression",
            type: dictTypeAst,
            arguments: [],
          },
        },
      ],
    },
    {
      kind: "foreachStatement",
      isAwait: false,
      type: { kind: "varType" },
      identifier: entryTemp.emittedName,
      expression: {
        kind: "identifierExpression",
        identifier: sourceTemp.emittedName,
      },
      body: {
        kind: "blockStatement",
        statements: [
          {
            kind: "expressionStatement",
            expression: {
              kind: "assignmentExpression",
              operatorToken: "=",
              left: {
                kind: "elementAccessExpression",
                expression: {
                  kind: "identifierExpression",
                  identifier: resultTemp.emittedName,
                },
                arguments: [
                  {
                    kind: "memberAccessExpression",
                    expression: {
                      kind: "identifierExpression",
                      identifier: entryTemp.emittedName,
                    },
                    memberName: "Key",
                  },
                ],
              },
              right: adaptedValueAst,
            },
          },
        ],
      },
    },
    {
      kind: "returnStatement",
      expression: {
        kind: "identifierExpression",
        identifier: resultTemp.emittedName,
      },
    },
  ];

  return [
    {
      kind: "invocationExpression",
      expression: {
        kind: "parenthesizedExpression",
        expression: {
          kind: "castExpression",
          type: buildDelegateType([], dictTypeAst),
          expression: {
            kind: "parenthesizedExpression",
            expression: {
              kind: "lambdaExpression",
              isAsync: false,
              parameters: [],
              body: {
                kind: "blockStatement",
                statements,
              },
            },
          },
        },
      },
      arguments: [],
    },
    currentContext,
  ];
};
