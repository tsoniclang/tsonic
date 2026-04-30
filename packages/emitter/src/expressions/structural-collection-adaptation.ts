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
import {
  extractCalleeNameFromAst,
  sameTypeAstSurface,
} from "../core/format/backend-ast/utils.js";
import { allocateLocalName } from "../core/format/local-names.js";
import type { EmitterContext } from "../types.js";
import { emitCSharpName } from "../naming-policy.js";
import { hasNullishBranch } from "./exact-comparison.js";
import { StructuralAdaptFn, UpcastFn } from "./structural-adaptation-types.js";
import { buildInvokedLambdaExpressionAst } from "./invoked-lambda.js";
import {
  getArrayElementType,
  getSemanticArrayElementType,
  getDictionaryValueType,
  getDirectIterableElementType,
  getIterableSourceShape,
  canPreferAnonymousStructuralTarget,
} from "./structural-type-shapes.js";
import { normalizeStructuralEmissionType } from "../core/semantic/type-resolution.js";
import { resolveAnonymousStructuralReferenceType } from "./structural-anonymous-targets.js";
import { isBroadObjectSlotType } from "../core/semantic/broad-object-types.js";
import { areIrTypesEquivalent } from "../core/semantic/type-equivalence.js";
import { collectStructuralProperties } from "./structural-property-model.js";
import {
  isExactArrayCreationToType,
  isExactExpressionToType,
  tryEmitExactComparisonTargetAst,
} from "./exact-comparison.js";

const normalizeStructuralCarrierEmissionType = (
  type: IrType,
  context: EmitterContext
): IrType => {
  const cache = new Map<IrType, IrType>();

  const normalize = (current: IrType): IrType => {
    const cached = cache.get(current);
    if (cached) {
      return cached;
    }

    const normalized = normalizeStructuralEmissionType(current, context);
    const anonymousTarget = canPreferAnonymousStructuralTarget(normalized)
      ? resolveAnonymousStructuralReferenceType(normalized, context)
      : undefined;
    if (anonymousTarget) {
      cache.set(current, anonymousTarget);
      return anonymousTarget;
    }

    const rewritten = (() => {
      switch (normalized.kind) {
        case "arrayType": {
          const elementType = normalize(normalized.elementType);
          const tuplePrefixElementTypes =
            normalized.tuplePrefixElementTypes?.map(normalize);
          const tupleRestElementType = normalized.tupleRestElementType
            ? normalize(normalized.tupleRestElementType)
            : undefined;
          const prefixChanged =
            !!tuplePrefixElementTypes &&
            tuplePrefixElementTypes.some(
              (element, index) =>
                element !== normalized.tuplePrefixElementTypes?.[index]
            );
          return elementType === normalized.elementType &&
            !prefixChanged &&
            tupleRestElementType === normalized.tupleRestElementType
            ? normalized
            : {
                ...normalized,
                elementType,
                ...(tuplePrefixElementTypes ? { tuplePrefixElementTypes } : {}),
                ...(tupleRestElementType ? { tupleRestElementType } : {}),
              };
        }
        case "tupleType": {
          const elementTypes = normalized.elementTypes.map(normalize);
          return elementTypes.every(
            (element, index) => element === normalized.elementTypes[index]
          )
            ? normalized
            : { ...normalized, elementTypes };
        }
        case "dictionaryType": {
          const keyType = normalize(normalized.keyType);
          const valueType = normalize(normalized.valueType);
          return keyType === normalized.keyType &&
            valueType === normalized.valueType
            ? normalized
            : {
                ...normalized,
                keyType,
                valueType,
              };
        }
        case "unionType":
        case "intersectionType": {
          const types = normalized.types.map(normalize);
          return types.every(
            (member, index) => member === normalized.types[index]
          )
            ? normalized
            : {
                ...normalized,
                types,
              };
        }
        case "functionType": {
          const parameters = normalized.parameters.map((parameter) =>
            parameter.type
              ? {
                  ...parameter,
                  type: normalize(parameter.type),
                }
              : parameter
          );
          const returnType = normalize(normalized.returnType);
          return parameters.every(
            (parameter, index) => parameter === normalized.parameters[index]
          ) && returnType === normalized.returnType
            ? normalized
            : {
                ...normalized,
                parameters,
                returnType,
              };
        }
        case "referenceType": {
          const typeArguments = normalized.typeArguments?.map(normalize);
          const typeArgumentsChanged =
            !!typeArguments &&
            typeArguments.some(
              (argument, index) =>
                argument !== normalized.typeArguments?.[index]
            );
          return !typeArgumentsChanged
            ? normalized
            : {
                ...normalized,
                ...(typeArguments ? { typeArguments } : {}),
              };
        }
        case "objectType":
        case "primitiveType":
        case "typeParameterType":
        case "literalType":
        case "anyType":
        case "unknownType":
        case "voidType":
        case "neverType":
          return normalized;
      }
    })();

    cache.set(current, rewritten);
    return rewritten;
  };

  return normalize(type);
};

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

  const sourceArrayElementType = getArrayElementType(sourceType, context);
  const targetArrayElementType = getArrayElementType(targetType, context);
  if (sourceArrayElementType && targetArrayElementType) {
    return [
      hasMatchingRuntimeCarrierElementType(
        sourceArrayElementType,
        targetArrayElementType,
        targetExactContext
      ),
      targetExactContext,
    ];
  }

  const sourceDictionaryValueType = getDictionaryValueType(sourceType, context);
  const targetDictionaryValueType = getDictionaryValueType(targetType, context);
  if (sourceDictionaryValueType && targetDictionaryValueType) {
    return [
      hasMatchingRuntimeCarrierElementType(
        sourceDictionaryValueType,
        targetDictionaryValueType,
        targetExactContext
      ),
      targetExactContext,
    ];
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

const isArrayEmptyInvocation = (
  expression: CSharpExpressionAst
): expression is Extract<
  CSharpExpressionAst,
  { kind: "invocationExpression" }
> =>
  expression.kind === "invocationExpression" &&
  extractCalleeNameFromAst(expression.expression) ===
    "global::System.Array.Empty";

const isIteratorAccessExpression = (
  expression: CSharpExpressionAst,
  context: EmitterContext
): boolean => {
  const methodName = emitCSharpName("[symbol:iterator]", "methods", context);
  const propertyName = emitCSharpName(
    "[symbol:iterator]",
    "properties",
    context
  );

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

const isSimpleElementCast = (
  expression: CSharpExpressionAst | undefined,
  itemIdentifier: CSharpExpressionAst
): expression is Extract<CSharpExpressionAst, { kind: "castExpression" }> =>
  expression?.kind === "castExpression" &&
  expression.expression === itemIdentifier;

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

  if (
    shape.accessKind === "direct" ||
    isIteratorAccessExpression(emittedAst, context)
  ) {
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

const canReuseSourceCarrierForInlineStructuralElement = (
  sourceType: IrType,
  targetType: IrType,
  context: EmitterContext
): boolean => {
  if (
    canPreferAnonymousStructuralTarget(sourceType) ||
    !canPreferAnonymousStructuralTarget(targetType)
  ) {
    return false;
  }

  const resolvedTarget = normalizeStructuralEmissionType(targetType, context);
  if (
    resolvedTarget.kind !== "objectType" &&
    resolvedTarget.kind !== "referenceType"
  ) {
    return false;
  }

  const sourceProps = collectStructuralProperties(sourceType, context);
  const targetProps = collectStructuralProperties(targetType, context);
  if (
    !sourceProps ||
    !targetProps ||
    sourceProps.length !== targetProps.length
  ) {
    return false;
  }

  const sortedSourceProps = [...sourceProps].sort((left, right) =>
    left.name.localeCompare(right.name)
  );
  const sortedTargetProps = [...targetProps].sort((left, right) =>
    left.name.localeCompare(right.name)
  );

  return sortedSourceProps.every((sourceProp, index) => {
    const targetProp = sortedTargetProps[index];
    return (
      !!targetProp &&
      sourceProp.name === targetProp.name &&
      sourceProp.isOptional === targetProp.isOptional &&
      areIrTypesEquivalent(sourceProp.type, targetProp.type, context)
    );
  });
};

export const hasMatchingRuntimeCarrierElementType = (
  sourceType: IrType,
  targetType: IrType,
  context: EmitterContext
): boolean => {
  if (
    canReuseSourceCarrierForInlineStructuralElement(
      sourceType,
      targetType,
      context
    )
  ) {
    return true;
  }

  const emissionSourceType = normalizeStructuralEmissionType(
    sourceType,
    context
  );
  const normalizedTargetType = normalizeStructuralCarrierEmissionType(
    targetType,
    context
  );
  try {
    const [sourceTypeAst, , sourceContext] = emitRuntimeCarrierTypeAst(
      emissionSourceType,
      context,
      emitTypeAst
    );
    const [targetTypeAst] = emitRuntimeCarrierTypeAst(
      normalizedTargetType,
      sourceContext,
      emitTypeAst
    );
    return sameTypeAstSurface(sourceTypeAst, targetTypeAst);
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.startsWith("ICE: Anonymous object type reached emitter") ||
        err.message.startsWith("ICE: Unresolved reference type ") ||
        err.message.startsWith("ICE: 'unknown' type reached emitter") ||
        err.message.startsWith("ICE: 'any' type reached emitter"))
    ) {
      return false;
    }
    throw err;
  }
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
    const semanticSourceElementType =
      getSemanticArrayElementType(sourceType, context) ?? sourceElementType;
    const semanticTargetElementType =
      getSemanticArrayElementType(expectedType, context) ?? targetElementType;
    const emissionSourceElementType = normalizeStructuralCarrierEmissionType(
      sourceElementType,
      context
    );
    const emissionTargetElementType = normalizeStructuralCarrierEmissionType(
      targetElementType,
      context
    );
    if (isArrayEmptyInvocation(emittedAst)) {
      const [targetElementTypeAst, , targetElementTypeContext] =
        emitRuntimeCarrierTypeAst(
          emissionTargetElementType,
          context,
          emitTypeAst
        );
      return [
        {
          kind: "invocationExpression",
          expression: identifierExpression("global::System.Array.Empty"),
          typeArguments: [targetElementTypeAst],
          arguments: [],
        },
        targetElementTypeContext,
      ];
    }

    const item = allocateLocalName("__item", context);
    let currentContext = item.context;
    const itemIdentifier: CSharpExpressionAst = {
      kind: "identifierExpression",
      identifier: item.emittedName,
    };
    const structuralElementAdaptation = adaptStructuralExpressionAst(
      itemIdentifier,
      semanticSourceElementType,
      currentContext,
      semanticTargetElementType,
      upcastFn
    );
    const upcastElementAdaptation =
      structuralElementAdaptation ??
      (upcastFn
        ? upcastFn(
            itemIdentifier,
            semanticSourceElementType,
            currentContext,
            semanticTargetElementType,
            new Set<string>()
          )
        : undefined);
    const adaptedElementAst =
      structuralElementAdaptation?.[0] ?? upcastElementAdaptation?.[0];
    const hasElementAdaptation =
      adaptedElementAst !== undefined && adaptedElementAst !== itemIdentifier;
    currentContext =
      structuralElementAdaptation?.[1] ??
      upcastElementAdaptation?.[1] ??
      currentContext;
    const runtimeCarrierMatches = hasMatchingRuntimeCarrierElementType(
      sourceElementType,
      targetElementType,
      currentContext
    );
    const canUseImplicitElementConversion = matchesExpectedEmissionType(
      emissionSourceElementType,
      emissionTargetElementType,
      currentContext
    );
    const needsElementAdaptation =
      hasElementAdaptation || !runtimeCarrierMatches;
    if (
      !needsElementAdaptation &&
      matchesExpectedEmissionType(
        emissionSourceElementType,
        emissionTargetElementType,
        context
      )
    ) {
      return [emittedAst, currentContext];
    }
    if (needsElementAdaptation) {
      const [sourceElementTypeAst, , sourceElementTypeContext] =
        emitRuntimeCarrierTypeAst(
          emissionSourceElementType,
          currentContext,
          emitTypeAst
        );
      currentContext = sourceElementTypeContext;
      const [targetElementTypeAst, , targetElementTypeContext] =
        emitRuntimeCarrierTypeAst(
          emissionTargetElementType,
          currentContext,
          emitTypeAst
        );
      currentContext = targetElementTypeContext;
      const effectiveElementAst =
        adaptedElementAst ??
        (!runtimeCarrierMatches && !canUseImplicitElementConversion
          ? {
              kind: "castExpression" as const,
              type: targetElementTypeAst,
              expression: itemIdentifier,
            }
          : itemIdentifier);
      const preferDirectBroadElement = isBroadObjectSlotType(
        targetElementType,
        currentContext
      );
      if (
        emittedAst.kind === "arrayCreationExpression" &&
        emittedAst.initializer &&
        emittedAst.sizeExpression === undefined &&
        !hasNullishBranch(sourceType)
      ) {
        const inlineInitializers: CSharpExpressionAst[] = [];
        let inlineContext = currentContext;
        for (const elementAst of emittedAst.initializer) {
          const inlineStructuralAdaptation = adaptStructuralExpressionAst(
            elementAst,
            semanticSourceElementType,
            inlineContext,
            semanticTargetElementType,
            upcastFn
          );
          const inlineUpcastAdaptation =
            inlineStructuralAdaptation ??
            (upcastFn
              ? upcastFn(
                  elementAst,
                  semanticSourceElementType,
                  inlineContext,
                  semanticTargetElementType,
                  new Set<string>()
                )
              : undefined);
          const inlineAdaptedAst =
            inlineStructuralAdaptation?.[0] ?? inlineUpcastAdaptation?.[0];
          inlineContext =
            inlineStructuralAdaptation?.[1] ??
            inlineUpcastAdaptation?.[1] ??
            inlineContext;
          inlineInitializers.push(
            inlineAdaptedAst ??
              (preferDirectBroadElement
                ? elementAst
                : !runtimeCarrierMatches && !canUseImplicitElementConversion
                  ? {
                      kind: "castExpression",
                      type: targetElementTypeAst,
                      expression: elementAst,
                    }
                  : elementAst)
          );
        }

        return [
          {
            kind: "arrayCreationExpression",
            elementType: targetElementTypeAst,
            initializer: inlineInitializers,
          },
          inlineContext,
        ];
      }
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
      if (!expectedType) {
        return [toArrayAst, currentContext];
      }
      const [targetArrayTypeAst, targetArrayTypeContext] = emitTypeAst(
        normalizeStructuralCarrierEmissionType(expectedType, currentContext),
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
  const sourceIterable = buildIterableSourceAst(
    emittedAst,
    sourceType,
    context
  );
  if (targetIterableElementType && sourceIterable) {
    const emissionSourceIterableElementType =
      normalizeStructuralCarrierEmissionType(
        sourceIterable.elementType,
        sourceIterable.context
      );
    const emissionTargetIterableElementType =
      normalizeStructuralCarrierEmissionType(
        targetIterableElementType,
        sourceIterable.context
      );
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
    const hasElementAdaptation =
      adaptedElementAst !== undefined && adaptedElementAst !== itemIdentifier;
    currentContext =
      structuralElementAdaptation?.[1] ??
      upcastElementAdaptation?.[1] ??
      currentContext;
    const runtimeCarrierMatches = hasMatchingRuntimeCarrierElementType(
      sourceIterable.elementType,
      targetIterableElementType,
      currentContext
    );
    const canUseImplicitElementConversion = matchesExpectedEmissionType(
      emissionSourceIterableElementType,
      emissionTargetIterableElementType,
      currentContext
    );
    const preferDirectBroadElement = isBroadObjectSlotType(
      targetIterableElementType,
      currentContext
    );
    const needsElementAdaptation =
      hasElementAdaptation ||
      (!preferDirectBroadElement && !runtimeCarrierMatches);

    if (!needsElementAdaptation) {
      if (
        sourceIterable.sourceAst === emittedAst &&
        matchesExpectedEmissionType(
          emissionSourceIterableElementType,
          emissionTargetIterableElementType,
          context
        )
      ) {
        return [emittedAst, currentContext];
      }

      return [sourceIterable.sourceAst, currentContext];
    }

    const [sourceElementTypeAst, , sourceElementTypeContext] =
      emitRuntimeCarrierTypeAst(
        emissionSourceIterableElementType,
        currentContext,
        emitTypeAst
      );
    currentContext = sourceElementTypeContext;
    const [targetElementTypeAst, , targetElementTypeContext] =
      emitRuntimeCarrierTypeAst(
        emissionTargetIterableElementType,
        currentContext,
        emitTypeAst
      );
    currentContext = targetElementTypeContext;
    const effectiveElementAst =
      adaptedElementAst ??
      (preferDirectBroadElement ||
      runtimeCarrierMatches ||
      canUseImplicitElementConversion
        ? itemIdentifier
        : {
            kind: "castExpression" as const,
            type: targetElementTypeAst,
            expression: itemIdentifier,
          });
    const canPreferDirectIterableCast =
      expectedType !== undefined &&
      isSimpleElementCast(effectiveElementAst, itemIdentifier) &&
      isBroadObjectSlotType(sourceIterable.elementType, currentContext);
    if (canPreferDirectIterableCast && expectedType) {
      const [targetIterableTypeAst, targetIterableContext] = emitTypeAst(
        normalizeStructuralCarrierEmissionType(expectedType, currentContext),
        currentContext
      );
      const directIterableSourceAst =
        emittedAst.kind === "castExpression"
          ? emittedAst.expression
          : emittedAst;
      const castIterableAst: CSharpExpressionAst = {
        kind: "castExpression",
        type: targetIterableTypeAst,
        expression: directIterableSourceAst,
      };

      if (!hasNullishBranch(sourceType)) {
        return [castIterableAst, targetIterableContext];
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
            whenFalse: castIterableAst,
          },
          targetIterableContext,
        ];
      }
    }
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
  const emissionTargetValueType = normalizeStructuralCarrierEmissionType(
    targetValueType,
    context
  );

  let currentContext = context;
  const [targetValueTypeAst, valueTypeContext] = emitTypeAst(
    emissionTargetValueType,
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
    buildInvokedLambdaExpressionAst({
      parameters: [],
      parameterTypes: [],
      body: {
        kind: "blockStatement",
        statements,
      },
      arguments: [],
      returnType: dictTypeAst,
      context: currentContext,
    }),
    currentContext,
  ];
};
