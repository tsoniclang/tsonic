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
import { sameTypeAstSurface } from "../core/format/backend-ast/utils.js";
import { allocateLocalName } from "../core/format/local-names.js";
import type { EmitterContext } from "../types.js";
import { emitCSharpName } from "../naming-policy.js";
import { hasNullishBranch } from "./exact-comparison.js";
import {
  StructuralAdaptFn,
  UpcastFn,
  buildDelegateType,
} from "./structural-adaptation-types.js";
import {
  getArrayElementType,
  getDictionaryValueType,
  getDirectIterableElementType,
  getIterableSourceShape,
} from "./structural-type-shapes.js";
import {
  isExactArrayCreationToType,
  isExactExpressionToType,
  tryEmitExactComparisonTargetAst,
} from "./exact-comparison.js";

const tryResolveExactCollectionSurfaceMatch = (
  sourceType: IrType | undefined,
  targetType: IrType | undefined,
  context: EmitterContext
): [boolean, EmitterContext] => {
  if (!sourceType || !targetType) {
    return [false, context];
  }

  const sourceExact = tryEmitExactComparisonTargetAst(sourceType, context);
  if (!sourceExact) {
    return [false, context];
  }

  const [targetExactTypeAst, targetExactContext] = (() => {
    const targetExact = tryEmitExactComparisonTargetAst(
      targetType,
      sourceExact[1]
    );
    if (!targetExact) {
      return [undefined, sourceExact[1]] as const;
    }
    return targetExact;
  })();

  if (!targetExactTypeAst) {
    return [false, targetExactContext];
  }

  return [
    sameTypeAstSurface(sourceExact[0], targetExactTypeAst),
    targetExactContext,
  ];
};

const isDirectlyReusableExpression = (
  expression: CSharpExpressionAst
): boolean =>
  expression.kind === "identifierExpression" ||
  expression.kind === "memberAccessExpression" ||
  expression.kind === "elementAccessExpression";

const isIteratorAccessExpression = (
  expression: CSharpExpressionAst,
  context: EmitterContext
): boolean => {
  const methodName = emitCSharpName("[symbol:iterator]", "methods", context);
  const propertyName = emitCSharpName("[symbol:iterator]", "properties", context);

  if (expression.kind === "memberAccessExpression") {
    return (
      expression.memberName === methodName ||
      expression.memberName === propertyName
    );
  }

  return (
    expression.kind === "invocationExpression" &&
    expression.arguments.length === 0 &&
    expression.expression.kind === "memberAccessExpression" &&
    expression.expression.memberName === methodName
  );
};

const buildIterableSourceAst = (
  emittedAst: CSharpExpressionAst,
  sourceType: IrType | undefined,
  context: EmitterContext
):
  | {
      readonly sourceAst: CSharpExpressionAst;
      readonly elementType: IrType;
      readonly context: EmitterContext;
    }
  | undefined => {
  const shape = getIterableSourceShape(sourceType, context);
  if (!shape) {
    return undefined;
  }

  if (shape.accessKind === "direct" || isIteratorAccessExpression(emittedAst, context)) {
    return {
      sourceAst: emittedAst,
      elementType: shape.elementType,
      context,
    };
  }

  const memberName = emitCSharpName(
    "[symbol:iterator]",
    shape.accessKind === "iteratorMethod" ? "methods" : "properties",
    context
  );
  const memberAccessAst: CSharpExpressionAst = {
    kind: "memberAccessExpression",
    expression: emittedAst,
    memberName,
  };

  return {
    sourceAst:
      shape.accessKind === "iteratorMethod"
        ? {
            kind: "invocationExpression",
            expression: memberAccessAst,
            arguments: [],
          }
        : memberAccessAst,
    elementType: shape.elementType,
    context,
  };
};

const hasMatchingRuntimeCarrierElementType = (
  sourceType: IrType,
  targetType: IrType,
  context: EmitterContext
): boolean => {
  const [sourceTypeAst, , sourceContext] = emitRuntimeCarrierTypeAst(
    sourceType,
    context,
    emitTypeAst
  );
  const [targetTypeAst] = emitRuntimeCarrierTypeAst(
    targetType,
    sourceContext,
    emitTypeAst
  );
  return sameTypeAstSurface(sourceTypeAst, targetTypeAst);
};

export const tryAdaptStructuralCollectionExpressionAst = (
  emittedAst: CSharpExpressionAst,
  sourceType: IrType | undefined,
  context: EmitterContext,
  expectedType: IrType | undefined,
  adaptStructuralExpressionAst: StructuralAdaptFn,
  upcastFn?: UpcastFn
): [CSharpExpressionAst, EmitterContext] | undefined => {
  const [hasExactCollectionSurfaceMatch, exactCollectionSurfaceContext] =
    tryResolveExactCollectionSurfaceMatch(sourceType, expectedType, context);
  if (hasExactCollectionSurfaceMatch) {
    return [emittedAst, exactCollectionSurfaceContext];
  }

  if (expectedType) {
    const exactTarget = tryEmitExactComparisonTargetAst(expectedType, context);
    if (
      exactTarget &&
      (isExactExpressionToType(emittedAst, exactTarget[0]) ||
        isExactArrayCreationToType(emittedAst, exactTarget[0]))
    ) {
      return [emittedAst, exactTarget[1]];
    }
  }

  const targetElementType = getArrayElementType(expectedType, context);
  const sourceElementType = getArrayElementType(sourceType, context);
  if (targetElementType && sourceElementType) {
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
    const runtimeCarrierMatches = hasMatchingRuntimeCarrierElementType(
      sourceElementType,
      targetElementType,
      currentContext
    );
    const needsElementAdaptation =
      adaptedElementAst !== undefined || !runtimeCarrierMatches;
    if (
      !needsElementAdaptation &&
      matchesExpectedEmissionType(sourceElementType, targetElementType, context)
    ) {
      return [emittedAst, currentContext];
    }
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
      const effectiveElementAst =
        adaptedElementAst ??
        (!runtimeCarrierMatches
          ? {
              kind: "castExpression" as const,
              type: targetElementTypeAst,
              expression: itemIdentifier,
            }
          : itemIdentifier);
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
                body: effectiveElementAst,
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

  const targetIterableElementType =
    targetElementType === undefined
      ? getDirectIterableElementType(expectedType, context)
      : undefined;
  const sourceIterable = buildIterableSourceAst(emittedAst, sourceType, context);
  if (targetIterableElementType && sourceIterable) {
    const item = allocateLocalName("__item", sourceIterable.context);
    let currentContext = item.context;
    const itemIdentifier: CSharpExpressionAst = {
      kind: "identifierExpression",
      identifier: item.emittedName,
    };
    const structuralElementAdaptation = adaptStructuralExpressionAst(
      itemIdentifier,
      sourceIterable.elementType,
      currentContext,
      targetIterableElementType,
      upcastFn
    );
    const upcastElementAdaptation =
      structuralElementAdaptation ??
      (upcastFn
        ? upcastFn(
            itemIdentifier,
            sourceIterable.elementType,
            currentContext,
            targetIterableElementType,
            new Set<string>()
          )
        : undefined);
    const adaptedElementAst =
      structuralElementAdaptation?.[0] ?? upcastElementAdaptation?.[0];
    currentContext =
      structuralElementAdaptation?.[1] ??
      upcastElementAdaptation?.[1] ??
      currentContext;
    const runtimeCarrierMatches = hasMatchingRuntimeCarrierElementType(
      sourceIterable.elementType,
      targetIterableElementType,
      currentContext
    );
    const effectiveElementAst = adaptedElementAst ?? itemIdentifier;
    const needsElementAdaptation =
      effectiveElementAst !== itemIdentifier || !runtimeCarrierMatches;

    if (!needsElementAdaptation) {
      if (
        sourceIterable.sourceAst === emittedAst &&
        matchesExpectedEmissionType(
          sourceIterable.elementType,
          targetIterableElementType,
          context
        )
      ) {
        return [emittedAst, currentContext];
      }

      return [sourceIterable.sourceAst, currentContext];
    }

    const [sourceElementTypeAst, , sourceElementTypeContext] =
      emitRuntimeCarrierTypeAst(
        sourceIterable.elementType,
        currentContext,
        emitTypeAst
      );
    currentContext = sourceElementTypeContext;
    const [targetElementTypeAst, , targetElementTypeContext] =
      emitRuntimeCarrierTypeAst(
        targetIterableElementType,
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
        sourceIterable.sourceAst,
        {
          kind: "lambdaExpression",
          isAsync: false,
          parameters: [{ name: item.emittedName }],
          body: effectiveElementAst,
        },
      ],
    };

    if (!hasNullishBranch(sourceType)) {
      return [selectAst, currentContext];
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
          whenFalse: selectAst,
        },
        currentContext,
      ];
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
