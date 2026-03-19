/**
 * Call argument emission.
 * Handles argument list construction, spread expansion, rest parameter
 * flattening, and expected-type threading for call arguments.
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
import { resolveEffectiveExpressionType } from "../../core/semantic/narrowed-expression-types.js";
import {
  getArrayLikeElementType,
  resolveArrayLikeReceiverType,
  normalizeStructuralEmissionType,
} from "../../core/semantic/type-resolution.js";
import { matchesExpectedEmissionType } from "../../core/semantic/expected-type-matching.js";
import { getAcceptedParameterType } from "../../core/semantic/defaults.js";
import { getPassingModifierFromCast, isLValue } from "./call-analysis.js";
import { shouldEraseRecursiveRuntimeUnionArrayElement } from "../../core/semantic/runtime-unions.js";
import { normalizeRecursiveArrayExpectedType } from "../../core/semantic/array-expected-types.js";

const normalizeCallArgumentExpectedType = (
  type: IrType | undefined,
  context: EmitterContext
): IrType | undefined => normalizeRecursiveArrayExpectedType(type, context);

const emitArrayWrapperElementTypeAst = (
  receiverType: IrType,
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
  const resolvedReceiverType = resolveArrayLikeReceiverType(
    receiverType,
    context
  );
  if (resolvedReceiverType) {
    const elementType: IrType = shouldEraseRecursiveRuntimeUnionArrayElement(
      resolvedReceiverType.elementType,
      context
    )
      ? {
          kind: "referenceType",
          name: "object",
          resolvedClrType: "System.Object",
        }
      : normalizeStructuralEmissionType(
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

const expandTupleLikeSpreadArguments = (
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

/**
 * Wrap an expression AST with an optional argument modifier (ref/out/in).
 */
const wrapArgModifier = (
  modifier: string | undefined,
  expr: CSharpExpressionAst
): CSharpExpressionAst =>
  modifier
    ? { kind: "argumentModifierExpression", modifier, expression: expr }
    : expr;

/**
 * Wrap an invocation AST with an optional (int) cast.
 */
const wrapIntCast = (
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

const getFunctionValueSignature = (
  expr: Extract<IrExpression, { kind: "call" }>
): Extract<IrType, { kind: "functionType" }> | undefined => {
  const calleeType = expr.callee.inferredType;
  if (!calleeType || calleeType.kind !== "functionType") return undefined;

  if (expr.callee.kind === "identifier" && expr.callee.resolvedClrType) {
    return undefined;
  }

  if (expr.callee.kind === "memberAccess" && expr.callee.memberBinding) {
    return undefined;
  }

  return calleeType;
};

const emitFunctionValueCallArguments = (
  args: readonly IrExpression[],
  signature: Extract<IrType, { kind: "functionType" }>,
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): [readonly CSharpExpressionAst[], EmitterContext] => {
  let currentContext = context;
  const argAsts: CSharpExpressionAst[] = [];
  const parameters = signature.parameters;

  const extractTupleRestCandidates = (
    type: IrType | undefined
  ): readonly (readonly IrType[])[] | undefined => {
    if (!type) return undefined;
    if (type.kind === "tupleType") {
      return [type.elementTypes];
    }
    if (type.kind !== "unionType") {
      return undefined;
    }
    const candidates: (readonly IrType[])[] = [];
    for (const member of type.types) {
      if (!member || member.kind !== "tupleType") {
        return undefined;
      }
      candidates.push(member.elementTypes);
    }
    return candidates;
  };

  const tryEmitTupleRestArguments = (
    startIndex: number,
    parameterType: IrType | undefined
  ): [readonly CSharpExpressionAst[], EmitterContext] | undefined => {
    const remainingArgs = args.slice(startIndex);
    if (remainingArgs.some((arg) => arg?.kind === "spread")) {
      return undefined;
    }

    const tupleCandidates = extractTupleRestCandidates(parameterType);
    if (!tupleCandidates || tupleCandidates.length === 0) {
      return undefined;
    }

    const matchingCandidates = tupleCandidates.filter(
      (candidate) => candidate.length === remainingArgs.length
    );
    if (matchingCandidates.length !== 1) {
      return undefined;
    }

    const tupleElements = matchingCandidates[0] ?? [];
    const emittedArgs: CSharpExpressionAst[] = [];
    let tupleContext = currentContext;

    for (let index = 0; index < remainingArgs.length; index++) {
      const arg = remainingArgs[index];
      const expectedType = tupleElements[index];
      if (!arg) continue;
      const [argAst, argContext] = emitExpressionAst(
        arg,
        tupleContext,
        expectedType
      );
      emittedArgs.push(argAst);
      tupleContext = argContext;
    }

    return [emittedArgs, tupleContext];
  };

  for (let i = 0; i < parameters.length; i++) {
    const parameter = parameters[i];
    if (!parameter) continue;

    if (parameter.isRest) {
      const tupleRestResult = tryEmitTupleRestArguments(i, parameter.type);
      if (tupleRestResult) {
        const [tupleArgs, tupleContext] = tupleRestResult;
        argAsts.push(...tupleArgs);
        currentContext = tupleContext;
        break;
      }

      const spreadArg = args[i];
      if (args.length === i + 1 && spreadArg && spreadArg.kind === "spread") {
        const [spreadAst, spreadCtx] = emitExpressionAst(
          spreadArg.expression,
          currentContext
        );
        argAsts.push(spreadAst);
        currentContext = spreadCtx;
        break;
      }

      const restElementType =
        getArrayLikeElementType(parameter.type, currentContext) ??
        parameter.type;
      let elementTypeAst: CSharpTypeAst = {
        kind: "predefinedType",
        keyword: "object",
      };
      if (restElementType) {
        const [emittedType, typeCtx] = emitTypeAst(
          restElementType,
          currentContext
        );
        elementTypeAst = emittedType;
        currentContext = typeCtx;
      }

      const restItems: CSharpExpressionAst[] = [];
      for (let j = i; j < args.length; j++) {
        const arg = args[j];
        if (!arg) continue;
        if (arg.kind === "spread") {
          const [spreadAst, spreadCtx] = emitExpressionAst(
            arg.expression,
            currentContext
          );
          argAsts.push(spreadAst);
          currentContext = spreadCtx;
          return [argAsts, currentContext];
        }
        const [argAst, argCtx] = emitExpressionAst(
          arg,
          currentContext,
          restElementType
        );
        restItems.push(argAst);
        currentContext = argCtx;
      }

      argAsts.push({
        kind: "arrayCreationExpression",
        elementType: elementTypeAst,
        initializer: restItems,
      });
      break;
    }

    const arg = args[i];
    if (arg) {
      const [argAst, argCtx] = emitExpressionAst(
        arg,
        currentContext,
        normalizeCallArgumentExpectedType(
          getAcceptedParameterType(parameter?.type, !!parameter?.isOptional),
          currentContext
        )
      );
      const modifier =
        expr.argumentPassing?.[i] &&
        expr.argumentPassing[i] !== "value" &&
        isLValue(arg)
          ? expr.argumentPassing[i]
          : undefined;
      argAsts.push(wrapArgModifier(modifier, argAst));
      currentContext = argCtx;
      continue;
    }

    if (parameter.isOptional || parameter.initializer) {
      let defaultType: CSharpTypeAst | undefined;
      if (parameter.type) {
        const [emittedType, typeCtx] = emitTypeAst(
          parameter.type,
          currentContext
        );
        currentContext = typeCtx;
        defaultType =
          parameter.isOptional || parameter.initializer
            ? emittedType.kind === "nullableType"
              ? emittedType
              : { kind: "nullableType", underlyingType: emittedType }
            : emittedType;
      }
      argAsts.push({ kind: "defaultExpression", type: defaultType });
    }
  }

  return [argAsts, currentContext];
};

const emitFlattenedRestArguments = (
  restArgs: readonly IrExpression[],
  restElementType: IrType,
  context: EmitterContext
): [readonly CSharpExpressionAst[], EmitterContext] => {
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
      const [spreadAst, spreadContext] = emitExpressionAst(
        arg.expression,
        currentContext
      );
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

/**
 * Emit call arguments as typed AST array.
 * Handles spread arrays, castModifier (ref/out from cast), and argumentPassing modes.
 */
const emitCallArguments = (
  args: readonly IrExpression[],
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext,
  parameterTypeOverrides?: readonly (IrType | undefined)[]
): [readonly CSharpExpressionAst[], EmitterContext] => {
  const functionValueSignature = getFunctionValueSignature(expr);
  const valueSymbolSignature =
    expr.callee.kind === "identifier"
      ? context.valueSymbols?.get(expr.callee.name)?.type
      : undefined;
  if (
    functionValueSignature &&
    functionValueSignature.parameters.some(
      (parameter) =>
        parameter?.isRest ||
        parameter?.isOptional ||
        parameter?.initializer !== undefined
    )
  ) {
    return emitFunctionValueCallArguments(
      args,
      functionValueSignature,
      expr,
      context
    );
  }

  const parameterTypes =
    parameterTypeOverrides && parameterTypeOverrides.length > 0
      ? parameterTypeOverrides
      : expr.surfaceParameterTypes && expr.surfaceParameterTypes.length > 0
        ? expr.surfaceParameterTypes
        : expr.parameterTypes && expr.parameterTypes.length > 0
          ? expr.parameterTypes
          : ((
              functionValueSignature?.parameters ??
              valueSymbolSignature?.parameters
            )?.map((parameter) => parameter?.type) ?? []);
  const restParameter = expr.surfaceRestParameter ?? expr.restParameter;
  const normalizedArgs = expandTupleLikeSpreadArguments(args);
  const restInfo:
    | {
        readonly index: number;
        readonly arrayType: IrType;
        readonly elementType: IrType;
      }
    | undefined =
    restParameter?.arrayType &&
    restParameter.elementType &&
    normalizedArgs
      .slice(restParameter.index)
      .some((candidate) => candidate?.kind === "spread")
      ? {
          index: restParameter.index,
          arrayType: restParameter.arrayType,
          elementType: restParameter.elementType,
        }
      : undefined;
  let currentContext = context;
  const argAsts: CSharpExpressionAst[] = [];

  for (let i = 0; i < normalizedArgs.length; i++) {
    const arg = normalizedArgs[i];
    if (!arg) continue;

    if (
      restInfo &&
      i === restInfo.index &&
      normalizedArgs
        .slice(restInfo.index)
        .some((candidate) => candidate?.kind === "spread")
    ) {
      const [flattenedRestArgs, flattenedContext] = emitFlattenedRestArguments(
        normalizedArgs.slice(restInfo.index),
        restInfo.elementType,
        currentContext
      );
      argAsts.push(...flattenedRestArgs);
      currentContext = flattenedContext;
      break;
    }

    const expectedType =
      restInfo && i >= restInfo.index
        ? restInfo.elementType
        : normalizeCallArgumentExpectedType(parameterTypes[i], currentContext);

    const runtimeParameterType =
      parameterTypeOverrides && parameterTypeOverrides.length > 0
        ? parameterTypeOverrides[i]
        : expr.parameterTypes?.[i];
    const effectiveExpectedType = (() => {
      const normalizedRuntime = normalizeCallArgumentExpectedType(
        runtimeParameterType,
        currentContext
      );
      if (!normalizedRuntime) {
        return expectedType;
      }

      const actualArgumentType =
        resolveEffectiveExpressionType(arg, currentContext) ?? arg.inferredType;

      if (
        actualArgumentType &&
        matchesExpectedEmissionType(
          actualArgumentType,
          normalizedRuntime,
          currentContext
        )
      ) {
        return normalizedRuntime;
      }

      if (
        normalizedRuntime.kind === "unknownType" ||
        normalizedRuntime.kind === "anyType" ||
        (normalizedRuntime.kind === "referenceType" &&
          normalizedRuntime.name === "object")
      ) {
        return normalizedRuntime;
      }
      return expectedType ?? normalizedRuntime;
    })();

    if (arg.kind === "spread") {
      const [spreadAst, ctx] = emitExpressionAst(
        arg.expression,
        currentContext
      );
      argAsts.push(spreadAst);
      currentContext = ctx;
    } else {
      const castModifier = getPassingModifierFromCast(arg);
      if (castModifier && isLValue(arg)) {
        const [argAst, ctx] = emitExpressionAst(arg, currentContext);
        argAsts.push(wrapArgModifier(castModifier, argAst));
        currentContext = ctx;
      } else {
        const [argAst, ctx] = emitExpressionAst(
          arg,
          currentContext,
          effectiveExpectedType
        );
        const passingMode = expr.argumentPassing?.[i];
        const modifier =
          passingMode && passingMode !== "value" && isLValue(arg)
            ? passingMode
            : undefined;
        argAsts.push(wrapArgModifier(modifier, argAst));
        currentContext = ctx;
      }
    }
  }

  return [argAsts, currentContext];
};

export {
  emitCallArguments,
  wrapIntCast,
  normalizeCallArgumentExpectedType,
  emitArrayWrapperElementTypeAst,
};
