/**
 * Call argument helper utilities.
 * Handles tuple spread expansion, flattened rest arguments, and
 * argument modifier/cast wrappers.
 */

import { getSpreadTupleShape, IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitTypeAst } from "../../type-emitter.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";
import {
  identifierExpression,
  identifierType,
} from "../../core/format/backend-ast/builders.js";
import {
  resolveArrayLikeReceiverType,
  normalizeStructuralEmissionType,
  splitRuntimeNullishUnionMembers,
  stripNullish,
} from "../../core/semantic/type-resolution.js";
import { matchesExpectedEmissionType } from "../../core/semantic/expected-type-matching.js";
import { normalizeRecursiveArrayExpectedType } from "../../core/semantic/array-expected-types.js";
import { areIrTypesEquivalent } from "../../core/semantic/type-equivalence.js";
import { resolveEffectiveExpressionType } from "../../core/semantic/narrowed-expression-types.js";
import { normalizeRuntimeStorageType } from "../../core/semantic/storage-types.js";
import { unwrapTransparentExpression } from "../../core/semantic/transparent-expressions.js";
import { allocateLocalName } from "../../core/format/local-names.js";

const isExplicitNullishArgument = (arg: IrExpression): boolean =>
  (arg.kind === "literal" && (arg.value === undefined || arg.value === null)) ||
  (arg.kind === "identifier" &&
    (arg.name === "undefined" || arg.name === "null"));

const argumentMayBeNullish = (
  arg: IrExpression,
  context: EmitterContext
): boolean => {
  if (isExplicitNullishArgument(arg)) {
    return true;
  }

  const transparentArg = unwrapTransparentExpression(arg);
  const candidateTypes = [
    resolveEffectiveExpressionType(transparentArg, context),
    transparentArg.inferredType,
    arg.inferredType,
    transparentArg.kind === "identifier"
      ? context.localValueTypes?.get(transparentArg.name)
      : undefined,
  ].filter((candidate): candidate is IrType => candidate !== undefined);
  return candidateTypes.some(
    (candidateType) =>
      splitRuntimeNullishUnionMembers(candidateType)?.hasRuntimeNullish ?? false
  );
};

export const normalizeCallArgumentExpectedType = (
  type: IrType | undefined,
  arg: IrExpression,
  context: EmitterContext
): IrType | undefined => {
  const normalizedType = normalizeRecursiveArrayExpectedType(type, context);
  const emissionAlignedType = normalizedType
    ? normalizeStructuralEmissionType(normalizedType, context)
    : normalizedType;
  const storageAlignedType = emissionAlignedType
    ? (normalizeRuntimeStorageType(emissionAlignedType, context) ??
      emissionAlignedType)
    : emissionAlignedType;
  if (!storageAlignedType) {
    return storageAlignedType;
  }

  const split = splitRuntimeNullishUnionMembers(storageAlignedType);
  if (!split?.hasRuntimeNullish) {
    return storageAlignedType;
  }

  if (argumentMayBeNullish(arg, context)) {
    return storageAlignedType;
  }

  return stripNullish(storageAlignedType);
};

export const emitArrayWrapperElementTypeAst = (
  receiverType: IrType,
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
  const resolvedReceiverType = resolveArrayLikeReceiverType(
    receiverType,
    context
  );
  if (resolvedReceiverType) {
    const elementType = normalizeStructuralEmissionType(
      resolvedReceiverType.elementType,
      context
    );
    return emitTypeAst(elementType, context);
  }
  return [identifierType("object"), context];
};

const buildTupleSpreadElementAccess = (
  spreadExpr: IrExpression,
  index: number,
  inferredType: IrType
): IrExpression => ({
  kind: "memberAccess",
  object: spreadExpr,
  property: {
    kind: "literal",
    value: index,
    inferredType: { kind: "primitiveType", name: "int" },
  },
  isComputed: true,
  isOptional: false,
  inferredType,
  accessKind: "clrIndexer",
});

const buildTupleSpreadSlice = (
  spreadExpr: IrExpression,
  startIndex: number,
  inferredType: IrType
): IrExpression => ({
  kind: "call",
  callee: {
    kind: "memberAccess",
    object: spreadExpr,
    property: "slice",
    isComputed: false,
    isOptional: false,
    memberBinding: {
      kind: "method",
      assembly: "__synthetic",
      type: "Array",
      member: "slice",
      emitSemantics: {
        callStyle: "receiver",
      },
    },
  },
  arguments: [
    {
      kind: "literal",
      value: startIndex,
      inferredType: { kind: "primitiveType", name: "int" },
    },
  ],
  isOptional: false,
  inferredType,
});

export const expandTupleLikeSpreadArguments = (
  args: readonly IrExpression[]
): readonly IrExpression[] => {
  const expanded: IrExpression[] = [];

  for (const arg of args) {
    if (arg.kind !== "spread") {
      expanded.push(arg);
      continue;
    }

    const spreadShape = arg.inferredType
      ? getSpreadTupleShape(arg.inferredType)
      : undefined;
    if (!spreadShape) {
      expanded.push(arg);
      continue;
    }

    for (
      let index = 0;
      index < spreadShape.prefixElementTypes.length;
      index += 1
    ) {
      const elementType = spreadShape.prefixElementTypes[index];
      if (!elementType) continue;
      expanded.push(
        buildTupleSpreadElementAccess(arg.expression, index, elementType)
      );
    }

    if (spreadShape.restElementType) {
      expanded.push({
        kind: "spread",
        expression: buildTupleSpreadSlice(
          arg.expression,
          spreadShape.prefixElementTypes.length,
          {
            kind: "arrayType",
            elementType: spreadShape.restElementType,
            origin: "explicit",
          }
        ),
        inferredType: {
          kind: "arrayType",
          elementType: spreadShape.restElementType,
          origin: "explicit",
        },
      });
      continue;
    }

    if (spreadShape.prefixElementTypes.length === 0) {
      expanded.push(arg);
    }
  }

  if (expanded.length === args.length) {
    return args;
  }

  return expanded;
};

export const getTransparentRestSpreadPassthroughExpression = (
  arg: IrExpression | undefined,
  restArrayType: IrType | undefined,
  context: EmitterContext
): IrExpression | undefined => {
  if (!arg || arg.kind !== "spread" || !restArrayType) {
    return undefined;
  }

  const transparentSpreadExpr = unwrapTransparentExpression(arg.expression);
  const transparentSpreadType =
    resolveEffectiveExpressionType(transparentSpreadExpr, context) ??
    transparentSpreadExpr.inferredType;
  if (
    transparentSpreadType &&
    areIrTypesEquivalent(transparentSpreadType, restArrayType, context)
  ) {
    return transparentSpreadExpr;
  }

  return undefined;
};

/**
 * Wrap an expression AST with an optional argument modifier (ref/out/in).
 */
export const wrapArgModifier = (
  modifier: string | undefined,
  expr: CSharpExpressionAst
): CSharpExpressionAst =>
  modifier
    ? { kind: "argumentModifierExpression", modifier, expression: expr }
    : expr;

/**
 * Wrap an invocation AST with an optional (int) cast.
 */
export const wrapIntCast = (
  needsCast: boolean,
  expr: CSharpExpressionAst
): CSharpExpressionAst =>
  needsCast
    ? {
        kind: "castExpression",
        type: { kind: "predefinedType", keyword: "int" },
        expression: expr,
      }
    : expr;

const tryEmitRestSpreadSegmentAst = (
  spreadArg: Extract<IrExpression, { kind: "spread" }>,
  restElementType: IrType,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  const actualSpreadType =
    resolveEffectiveExpressionType(spreadArg.expression, context) ??
    spreadArg.expression.inferredType;
  const sourceArrayType = actualSpreadType
    ? resolveArrayLikeReceiverType(actualSpreadType, context)
    : undefined;
  if (!sourceArrayType) {
    return undefined;
  }

  const [spreadAst, spreadContext] = emitExpressionAst(
    spreadArg.expression,
    context
  );
  const sourceElementType = normalizeStructuralEmissionType(
    sourceArrayType.elementType,
    spreadContext
  );
  const targetElementType = normalizeStructuralEmissionType(
    restElementType,
    spreadContext
  );
  const [sourceElementTypeAst, sourceTypeContext] = emitTypeAst(
    sourceElementType,
    spreadContext
  );
  const [targetElementTypeAst, targetTypeContext] = emitTypeAst(
    targetElementType,
    sourceTypeContext
  );
  const item = allocateLocalName("__rest_item", targetTypeContext);
  const itemAst = identifierExpression(item.emittedName);
  const canUseImplicitElementConversion = matchesExpectedEmissionType(
    sourceElementType,
    targetElementType,
    item.context
  );
  const elementBody: CSharpExpressionAst = canUseImplicitElementConversion
    ? itemAst
    : {
        kind: "castExpression",
        type: targetElementTypeAst,
        expression: itemAst,
      };
  const selectAst: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: identifierExpression("global::System.Linq.Enumerable.Select"),
    typeArguments: [sourceElementTypeAst, targetElementTypeAst],
    arguments: [
      spreadAst,
      {
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [{ name: item.emittedName }],
        body: elementBody,
      },
    ],
  };

  return [
    {
      kind: "invocationExpression",
      expression: identifierExpression(
        "global::System.Linq.Enumerable.ToArray"
      ),
      typeArguments: [targetElementTypeAst],
      arguments: [selectAst],
    },
    item.context,
  ];
};

export const emitFlattenedRestArguments = (
  restArgs: readonly IrExpression[],
  restArrayType: IrType,
  restElementType: IrType,
  context: EmitterContext
): [readonly CSharpExpressionAst[], EmitterContext] => {
  const passthroughContext: EmitterContext = {
    ...context,
    localSemanticTypes: undefined,
    localValueTypes: undefined,
  };
  if (restArgs.length === 1 && restArgs[0]?.kind === "spread") {
    const spreadArg = restArgs[0];
    const actualSpreadType = spreadArg.expression.inferredType;
    const transparentSpreadExpr = getTransparentRestSpreadPassthroughExpression(
      spreadArg,
      restArrayType,
      context
    );
    if (
      actualSpreadType &&
      areIrTypesEquivalent(actualSpreadType, restArrayType, context)
    ) {
      const [spreadAst, spreadContext] = emitExpressionAst(
        spreadArg.expression,
        passthroughContext
      );
      return [[spreadAst], spreadContext];
    }
    if (transparentSpreadExpr) {
      const [spreadAst, spreadContext] = emitExpressionAst(
        transparentSpreadExpr,
        passthroughContext
      );
      return [[spreadAst], spreadContext];
    }
  }

  let currentContext = context;
  const [elementTypeAst, typeContext] = emitTypeAst(
    restElementType,
    currentContext
  );
  currentContext = typeContext;

  const segments: CSharpExpressionAst[] = [];
  let inlineElements: CSharpExpressionAst[] = [];

  const flushInlineElements = (): void => {
    if (inlineElements.length === 0) return;
    segments.push({
      kind: "arrayCreationExpression",
      elementType: elementTypeAst,
      initializer: inlineElements,
    });
    inlineElements = [];
  };

  for (const arg of restArgs) {
    if (!arg) continue;

    if (arg.kind === "spread") {
      flushInlineElements();
      const [spreadAst, spreadContext] =
        tryEmitRestSpreadSegmentAst(arg, restElementType, currentContext) ??
        emitExpressionAst(arg.expression, currentContext, restArrayType);
      segments.push(spreadAst);
      currentContext = spreadContext;
      continue;
    }

    const [argAst, argContext] = emitExpressionAst(
      arg,
      currentContext,
      restElementType
    );
    inlineElements.push(argAst);
    currentContext = argContext;
  }

  flushInlineElements();

  if (segments.length === 0) {
    return [
      [
        {
          kind: "invocationExpression",
          expression: {
            ...identifierExpression("global::System.Array.Empty"),
          },
          typeArguments: [elementTypeAst],
          arguments: [],
        },
      ],
      currentContext,
    ];
  }

  const firstSegment = segments[0];
  if (!firstSegment) {
    return [
      [
        {
          kind: "arrayCreationExpression",
          elementType: elementTypeAst,
          initializer: [],
        },
      ],
      currentContext,
    ];
  }

  let concatAst = firstSegment;
  for (let index = 1; index < segments.length; index++) {
    const segment = segments[index];
    if (!segment) continue;
    concatAst = {
      kind: "invocationExpression",
      expression: {
        ...identifierExpression("global::System.Linq.Enumerable.Concat"),
      },
      arguments: [concatAst, segment],
    };
  }

  return [
    [
      {
        kind: "invocationExpression",
        expression: {
          ...identifierExpression("global::System.Linq.Enumerable.ToArray"),
        },
        arguments: [concatAst],
      },
    ],
    currentContext,
  ];
};
