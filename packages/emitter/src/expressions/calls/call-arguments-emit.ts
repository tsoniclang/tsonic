/**
 * Call argument emission.
 * Handles the main emitCallArguments function and function-value call argument emission.
 */

import {
  IrExpression,
  IrType,
  IrParameter,
  stableIrTypeKey,
} from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitTypeAst } from "../../type-emitter.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
import type {
  CSharpExpressionAst,
  CSharpLambdaParameterAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";
import { resolveEffectiveExpressionType } from "../../core/semantic/narrowed-expression-types.js";
import {
  containsTypeParameter,
  getArrayLikeElementType,
} from "../../core/semantic/type-resolution.js";
import { matchesExpectedEmissionType } from "../../core/semantic/expected-type-matching.js";
import { getAcceptedParameterType } from "../../core/semantic/defaults.js";
import { unwrapParameterModifierType } from "../../core/semantic/parameter-modifier-types.js";
import {
  resolveTypeAlias,
  splitRuntimeNullishUnionMembers,
  stripNullish,
} from "../../core/semantic/type-resolution.js";
import { resolveComparableType } from "../../core/semantic/comparable-types.js";
import { resolveRuntimeMaterializationTargetType } from "../../core/semantic/runtime-materialization-targets.js";
import { getPassingModifierFromCast, isLValue } from "./call-analysis.js";
import { shouldPreferRuntimeExpectedType } from "./runtime-expected-type-preference.js";
import { adaptValueToExpectedTypeAst } from "../expected-type-adaptation.js";
import {
  normalizeCallArgumentExpectedType,
  expandTupleLikeSpreadArguments,
  getTransparentRestSpreadPassthroughExpression,
  wrapArgModifier,
  emitFlattenedRestArguments,
} from "./call-arguments-helpers.js";

const getFunctionValueSignature = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): Extract<IrType, { kind: "functionType" }> | undefined => {
  if (expr.callee.kind === "identifier") {
    const symbolType = context.valueSymbols?.get(expr.callee.name)?.type;
    if (symbolType?.kind === "functionType") {
      return symbolType;
    }
  }

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

const emitOutDiscardArgument = (
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const nextId = (context.tempVarId ?? 0) + 1;
  return [
    wrapArgModifier("out", {
      kind: "declarationExpression",
      designation: `__tsonic_out_discard_${nextId}`,
    }),
    {
      ...context,
      tempVarId: nextId,
    },
  ];
};

const resolveFunctionType = (
  type: IrType | undefined,
  context: EmitterContext
): Extract<IrType, { kind: "functionType" }> | undefined => {
  if (!type) {
    return undefined;
  }

  const unwrapped = unwrapParameterModifierType(type) ?? type;
  const resolved = resolveTypeAlias(stripNullish(unwrapped), context);
  return resolved.kind === "functionType" ? resolved : undefined;
};

const countRequiredParameters = (parameters: readonly IrParameter[]): number => {
  let required = 0;
  for (const parameter of parameters) {
    if (!parameter) continue;
    if (
      parameter.isRest ||
      parameter.isOptional ||
      parameter.initializer !== undefined
    ) {
      break;
    }
    required += 1;
  }
  return required;
};

const isNumericBindingParameterType = (
  type: IrType,
  context: EmitterContext
): boolean => {
  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (resolved.kind === "primitiveType") {
    return resolved.name === "number" || resolved.name === "int";
  }

  if (resolved.kind === "literalType") {
    return typeof resolved.value === "number";
  }

  if (resolved.kind !== "referenceType") {
    return false;
  }

  return (
    resolved.name === "sbyte" ||
    resolved.name === "byte" ||
    resolved.name === "short" ||
    resolved.name === "ushort" ||
    resolved.name === "int" ||
    resolved.name === "uint" ||
    resolved.name === "long" ||
    resolved.name === "ulong" ||
    resolved.name === "float" ||
    resolved.name === "double" ||
    resolved.name === "decimal" ||
    resolved.name === "Half" ||
    resolved.name === "SByte" ||
    resolved.name === "Byte" ||
    resolved.name === "Int16" ||
    resolved.name === "UInt16" ||
    resolved.name === "Int32" ||
    resolved.name === "UInt32" ||
    resolved.name === "Int64" ||
    resolved.name === "UInt64" ||
    resolved.name === "Single" ||
    resolved.name === "Double" ||
    resolved.name === "Decimal" ||
    resolved.resolvedClrType === "System.SByte" ||
    resolved.resolvedClrType === "System.Byte" ||
    resolved.resolvedClrType === "System.Int16" ||
    resolved.resolvedClrType === "System.UInt16" ||
    resolved.resolvedClrType === "System.Int32" ||
    resolved.resolvedClrType === "System.UInt32" ||
    resolved.resolvedClrType === "System.Int64" ||
    resolved.resolvedClrType === "System.UInt64" ||
    resolved.resolvedClrType === "System.Single" ||
    resolved.resolvedClrType === "System.Double" ||
    resolved.resolvedClrType === "System.Decimal" ||
    resolved.resolvedClrType === "System.Half" ||
    resolved.resolvedClrType === "global::System.SByte" ||
    resolved.resolvedClrType === "global::System.Byte" ||
    resolved.resolvedClrType === "global::System.Int16" ||
    resolved.resolvedClrType === "global::System.UInt16" ||
    resolved.resolvedClrType === "global::System.Int32" ||
    resolved.resolvedClrType === "global::System.UInt32" ||
    resolved.resolvedClrType === "global::System.Int64" ||
    resolved.resolvedClrType === "global::System.UInt64" ||
    resolved.resolvedClrType === "global::System.Single" ||
    resolved.resolvedClrType === "global::System.Double" ||
    resolved.resolvedClrType === "global::System.Decimal" ||
    resolved.resolvedClrType === "global::System.Half"
  );
};

const requiresDelegateArityAdaptation = (
  actualType: Extract<IrType, { kind: "functionType" }>,
  expectedType: Extract<IrType, { kind: "functionType" }>
): boolean => {
  const actualHasRest = actualType.parameters.some(
    (parameter) => parameter?.isRest
  );
  const expectedHasRest = expectedType.parameters.some(
    (parameter) => parameter?.isRest
  );

  if (actualHasRest || expectedHasRest) {
    return false;
  }

  if (actualType.parameters.length === expectedType.parameters.length) {
    return false;
  }

  const actualRequired = countRequiredParameters(actualType.parameters);
  return actualRequired <= expectedType.parameters.length;
};

const getExpectedParameterBaseName = (
  parameter: IrParameter | undefined,
  index: number
): string => {
  if (parameter?.pattern.kind === "identifierPattern") {
    return escapeCSharpIdentifier(parameter.pattern.name);
  }
  return `arg${index}`;
};

const buildDelegateAdapterParameterName = (
  parameter: IrParameter | undefined,
  index: number,
  preserveExisting: boolean
): string =>
  preserveExisting
    ? getExpectedParameterBaseName(parameter, index)
    : `__unused_${getExpectedParameterBaseName(parameter, index)}`;

const shouldEmitExplicitDelegateAdapterTypes = (
  expectedType: Extract<IrType, { kind: "functionType" }>
): boolean =>
  expectedType.parameters.every(
    (parameter) =>
      parameter?.type !== undefined &&
      parameter.type.kind !== "unknownType" &&
      parameter.type.kind !== "anyType" &&
      !containsTypeParameter(parameter.type)
  );

const wrapOptionalDelegateParameterTypeAst = (
  typeAst: CSharpTypeAst,
  parameter: IrParameter | undefined
): CSharpTypeAst =>
  parameter?.isOptional && typeAst.kind !== "nullableType"
    ? { kind: "nullableType", underlyingType: typeAst }
    : typeAst;

const emitDelegateAdapterParameters = (
  expectedType: Extract<IrType, { kind: "functionType" }>,
  parameterNames: readonly string[],
  context: EmitterContext
): [readonly CSharpLambdaParameterAst[], EmitterContext] => {
  let currentContext = context;
  const emitExplicitTypes = shouldEmitExplicitDelegateAdapterTypes(expectedType);
  const emitted: CSharpLambdaParameterAst[] = [];

  for (let index = 0; index < expectedType.parameters.length; index += 1) {
    const parameter = expectedType.parameters[index];
    if (!parameter) continue;

    const modifier = parameter.passing !== "value" ? parameter.passing : undefined;
    if (emitExplicitTypes && parameter.type) {
      const [typeAst, nextContext] = emitTypeAst(parameter.type, currentContext);
      currentContext = nextContext;
      emitted.push(
        modifier
          ? {
              name: parameterNames[index] ?? `__arg${index}`,
              modifier,
              type: wrapOptionalDelegateParameterTypeAst(typeAst, parameter),
            }
          : {
              name: parameterNames[index] ?? `__arg${index}`,
              type: wrapOptionalDelegateParameterTypeAst(typeAst, parameter),
            }
      );
      continue;
    }

    emitted.push(
      modifier
        ? { name: parameterNames[index] ?? `__arg${index}`, modifier }
        : { name: parameterNames[index] ?? `__arg${index}` }
    );
  }

  return [emitted, currentContext];
};

const adaptLambdaArgumentAst = (
  lambdaAst: Extract<CSharpExpressionAst, { kind: "lambdaExpression" }>,
  expectedType: Extract<IrType, { kind: "functionType" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const parameterNames = expectedType.parameters.map((parameter, index) =>
    index < lambdaAst.parameters.length
      ? (lambdaAst.parameters[index]?.name ?? `__arg${index}`)
      : buildDelegateAdapterParameterName(parameter, index, false)
  );
  const [parameters, nextContext] = emitDelegateAdapterParameters(
    expectedType,
    parameterNames,
    context
  );

  return [
    {
      ...lambdaAst,
      parameters,
    },
    nextContext,
  ];
};

const wrapFunctionValueArgumentAst = (
  originalAst: CSharpExpressionAst,
  actualType: Extract<IrType, { kind: "functionType" }>,
  expectedType: Extract<IrType, { kind: "functionType" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const parameterNames = expectedType.parameters.map((parameter, index) =>
    buildDelegateAdapterParameterName(
      parameter,
      index,
      index < actualType.parameters.length
    )
  );
  const [parameters, nextContext] = emitDelegateAdapterParameters(
    expectedType,
    parameterNames,
    context
  );

  return [
    {
      kind: "lambdaExpression",
      isAsync: false,
      parameters,
      body: {
        kind: "invocationExpression",
        expression: originalAst,
        arguments: parameterNames
          .slice(0, actualType.parameters.length)
          .map((name) => ({
            kind: "identifierExpression",
            identifier: name,
          })),
      },
    },
    nextContext,
  ];
};

const findMemberBindingExpectedType = (
  expr: Extract<IrExpression, { kind: "call" }>,
  argIndex: number,
  context: EmitterContext
): IrType | undefined => {
  if (expr.callee.kind !== "memberAccess" || !expr.callee.memberBinding) {
    return undefined;
  }

  const calleeBinding = expr.callee.memberBinding;
  const preferredOwner = calleeBinding.type;
  const overloads = context.bindingRegistry?.getMemberOverloads(
    preferredOwner,
    calleeBinding.member,
    preferredOwner
  );
  if (!overloads || overloads.length === 0) {
    return undefined;
  }

  const matchingParameterTypes = overloads
    .filter((overload) => {
      if (
        overload.binding.assembly !== calleeBinding.assembly ||
        overload.binding.type !== calleeBinding.type ||
        overload.binding.member !== calleeBinding.member
      ) {
        return false;
      }

      const parameters = overload.semanticSignature?.parameters;
      if (!parameters) {
        return false;
      }

      const parameterOffset = overload.isExtensionMethod ? 1 : 0;
      const required = countRequiredParameters(parameters);
      const visibleRequired = Math.max(0, required - parameterOffset);
      if (expr.arguments.length < visibleRequired) {
        return false;
      }

      const hasRest = parameters.some((parameter) => parameter?.isRest);
      const visibleParameterCount = Math.max(
        0,
        parameters.length - parameterOffset
      );
      if (!hasRest && expr.arguments.length > visibleParameterCount) {
        return false;
      }

      return parameters[argIndex + parameterOffset]?.type !== undefined;
    })
    .map((overload) => {
      const parameters = overload.semanticSignature?.parameters;
      const parameterOffset = overload.isExtensionMethod ? 1 : 0;
      return parameters?.[argIndex + parameterOffset]?.type;
    })
    .filter((parameterType): parameterType is IrType => parameterType !== undefined);

  if (matchingParameterTypes.length === 0) {
    return undefined;
  }

  const uniqueParameterTypes = new Map<string, IrType>();
  for (const parameterType of matchingParameterTypes) {
    uniqueParameterTypes.set(
      stableIrTypeKey(stripNullish(parameterType)),
      parameterType
    );
  }

  if (uniqueParameterTypes.size === 1) {
    return [...uniqueParameterTypes.values()][0];
  }

  const uniqueNumericParameterTypes = new Map<string, IrType>();
  for (const parameterType of uniqueParameterTypes.values()) {
    if (!isNumericBindingParameterType(parameterType, context)) {
      continue;
    }
    uniqueNumericParameterTypes.set(
      stableIrTypeKey(stripNullish(parameterType)),
      parameterType
    );
  }

  return uniqueNumericParameterTypes.size === 1
    ? [...uniqueNumericParameterTypes.values()][0]
    : undefined;
};

const resolveExpectedFunctionTypeForArgument = (
  expr: Extract<IrExpression, { kind: "call" }>,
  argIndex: number,
  expectedType: IrType | undefined,
  context: EmitterContext
): Extract<IrType, { kind: "functionType" }> | undefined =>
  resolveFunctionType(expectedType, context) ??
  resolveFunctionType(findMemberBindingExpectedType(expr, argIndex, context), context);

const resolveActualFunctionTypeForArgument = (
  arg: IrExpression,
  context: EmitterContext
): Extract<IrType, { kind: "functionType" }> | undefined => {
  if (arg.kind === "identifier") {
    return resolveFunctionType(
      context.localSemanticTypes?.get(arg.name) ??
        context.localValueTypes?.get(arg.name) ??
        context.valueSymbols?.get(arg.name)?.type ??
        arg.inferredType,
      context
    );
  }

  return resolveFunctionType(
    resolveEffectiveExpressionType(arg, context) ?? arg.inferredType,
    context
  );
};

const adaptFunctionArgumentAst = (
  expr: Extract<IrExpression, { kind: "call" }>,
  arg: IrExpression,
  argIndex: number,
  argAst: CSharpExpressionAst,
  expectedType: IrType | undefined,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const expectedFunctionType = resolveExpectedFunctionTypeForArgument(
    expr,
    argIndex,
    expectedType,
    context
  );
  const actualFunctionType = resolveActualFunctionTypeForArgument(arg, context);

  if (
    !expectedFunctionType ||
    !actualFunctionType ||
    !requiresDelegateArityAdaptation(actualFunctionType, expectedFunctionType)
  ) {
    return [argAst, context];
  }

  if (argAst.kind === "lambdaExpression") {
    return adaptLambdaArgumentAst(argAst, expectedFunctionType, context);
  }

  return wrapFunctionValueArgumentAst(
    argAst,
    actualFunctionType,
    expectedFunctionType,
    context
  );
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
  const runtimeOmittableCallArities = (() => {
    if (expr.callee.kind === "identifier") {
      const importBinding = context.importBindings?.get(expr.callee.name);
      if (importBinding?.kind === "value") {
        return new Set(importBinding.runtimeOmittableCallArities ?? []);
      }
      return undefined;
    }

    if (
      expr.callee.kind === "memberAccess" &&
      expr.callee.object.kind === "identifier" &&
      !expr.callee.isComputed &&
      typeof expr.callee.property === "string"
    ) {
      const importBinding = context.importBindings?.get(expr.callee.object.name);
      if (importBinding?.kind === "namespace") {
        return new Set(
          importBinding.memberCallArities?.get(expr.callee.property) ?? []
        );
      }
    }

    return undefined;
  })();
  const providedArgumentCount = args.length;

  for (let i = 0; i < parameters.length; i++) {
    const parameter = parameters[i];
    if (!parameter) continue;

    if (parameter.isRest) {
      const tupleRestResult = tryEmitTupleRestArguments(
        args,
        i,
        parameter.type,
        currentContext
      );
      if (tupleRestResult) {
        const [tupleArgs, tupleContext] = tupleRestResult;
        argAsts.push(...tupleArgs);
        currentContext = tupleContext;
        break;
      }

      const spreadArg = args[i];
      if (args.length === i + 1 && spreadArg && spreadArg.kind === "spread") {
        const transparentPassthrough =
          getTransparentRestSpreadPassthroughExpression(
            spreadArg,
            parameter.type,
            currentContext
          );
        const passthroughContext: EmitterContext = {
          ...currentContext,
          localSemanticTypes: undefined,
          localValueTypes: undefined,
        };
        const [spreadAst, spreadCtx] = emitExpressionAst(
          transparentPassthrough ?? spreadArg.expression,
          transparentPassthrough ? passthroughContext : currentContext,
          transparentPassthrough ? undefined : parameter.type
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
          const transparentPassthrough =
            getTransparentRestSpreadPassthroughExpression(
              arg,
              parameter.type,
              currentContext
            );
          const passthroughContext: EmitterContext = {
            ...currentContext,
            localSemanticTypes: undefined,
            localValueTypes: undefined,
          };
          const [spreadAst, spreadCtx] = emitExpressionAst(
            transparentPassthrough ?? arg.expression,
            transparentPassthrough ? passthroughContext : currentContext,
            transparentPassthrough ? undefined : parameter.type
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
      const passingMode = expr.argumentPassing?.[i];
      if (passingMode === "out" && !isLValue(arg)) {
        const [discardAst, discardCtx] = emitOutDiscardArgument(currentContext);
        argAsts.push(discardAst);
        currentContext = discardCtx;
        continue;
      }
      const runtimeParameterType = getAcceptedParameterType(
        parameter?.type,
        !!parameter?.isOptional
      );
      const selectedParameterType =
        expr.parameterTypes?.[i] ?? expr.surfaceParameterTypes?.[i];
      const selectedExpectedType =
        selectedParameterType === undefined
          ? undefined
          : resolveCallArgumentExpectedType(
              expr,
              arg,
              i,
              selectedParameterType,
              currentContext
            );
      const runtimeExpectedType =
        runtimeParameterType === undefined
          ? undefined
          : normalizeCallArgumentExpectedType(
              runtimeParameterType,
              arg,
              currentContext
            );
      const contextualExpectedType =
        selectedExpectedType &&
        runtimeExpectedType &&
        !preservesSurfaceRuntimeMaterialization(
          selectedExpectedType,
          runtimeExpectedType,
          currentContext
        )
          ? runtimeExpectedType
          : (selectedExpectedType ?? runtimeExpectedType);
      const finalExpectedType = runtimeExpectedType ?? contextualExpectedType;
      const [rawArgAst, rawArgCtx] = emitExpressionAst(
        arg,
        currentContext,
        contextualExpectedType
      );
      const actualArgumentType =
        resolveActualFunctionTypeForArgument(arg, rawArgCtx) ??
        resolveEffectiveExpressionType(arg, rawArgCtx) ??
        arg.inferredType;
      const [materializedArgAst, materializedArgCtx] =
        adaptValueToExpectedTypeAst({
          valueAst: rawArgAst,
          actualType: actualArgumentType,
          context: rawArgCtx,
          expectedType: finalExpectedType,
        }) ?? [rawArgAst, rawArgCtx];
      const [argAst, argCtx] = adaptFunctionArgumentAst(
        expr,
        arg,
        i,
        materializedArgAst,
        finalExpectedType,
        materializedArgCtx
      );
      const modifier =
        passingMode && passingMode !== "value" && isLValue(arg)
          ? passingMode
          : undefined;
      argAsts.push(wrapArgModifier(modifier, argAst));
      currentContext = argCtx;
      continue;
    }

    if (runtimeOmittableCallArities?.has(providedArgumentCount)) {
      return [argAsts, currentContext];
    }

    if (parameter.initializer) {
      const [defaultAst, defaultCtx] = emitExpressionAst(
        parameter.initializer,
        currentContext,
        parameter.type
      );
      argAsts.push(defaultAst);
      currentContext = defaultCtx;
      continue;
    }

    if (parameter.isOptional) {
      let defaultType: CSharpTypeAst | undefined;
      if (parameter.type) {
        const [emittedType, typeCtx] = emitTypeAst(
          parameter.type,
          currentContext
        );
        currentContext = typeCtx;
        defaultType = parameter.isOptional
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
  args: readonly (IrExpression | { kind: "spread"; expression: IrExpression })[],
  startIndex: number,
  parameterType: IrType | undefined,
  context: EmitterContext
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
  let tupleContext = context;

  for (let index = 0; index < remainingArgs.length; index++) {
    const arg = remainingArgs[index];
    const expectedType = tupleElements[index];
    if (!arg || arg.kind === "spread") continue;
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

const selectDeterministicUnionParameterMember = (
  expectedType: IrType | undefined,
  arg: IrExpression,
  context: EmitterContext
): IrType | undefined => {
  if (!expectedType) {
    return expectedType;
  }

  const resolvedExpected = resolveTypeAlias(stripNullish(expectedType), context);
  if (resolvedExpected.kind !== "unionType") {
    return expectedType;
  }

  const actualType =
    resolveEffectiveExpressionType(arg, context) ?? arg.inferredType;
  if (!actualType) {
    return expectedType;
  }

  const comparableActual = stableIrTypeKey(
    resolveComparableType(actualType, context)
  );
  const matchingMembers = resolvedExpected.types.filter((member) => {
    const comparableMember = stableIrTypeKey(
      resolveComparableType(member, context)
    );
    return comparableActual === comparableMember;
  });

  return matchingMembers.length === 1 ? matchingMembers[0] : expectedType;
};

const resolveCallArgumentExpectedType = (
  expr: Extract<IrExpression, { kind: "call" }>,
  arg: IrExpression,
  argIndex: number,
  parameterType: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  const expectedType = normalizeCallArgumentExpectedType(
    parameterType,
    arg,
    context
  );
  const bindingExpectedType = (() => {
    const candidate = findMemberBindingExpectedType(expr, argIndex, context);
    return candidate
      ? normalizeCallArgumentExpectedType(candidate, arg, context)
      : undefined;
  })();

  const prefersBindingNumericType = (() => {
    if (!expectedType || !bindingExpectedType) {
      return false;
    }

    const resolvedExpected = resolveTypeAlias(stripNullish(expectedType), context);
    const resolvedBinding = resolveTypeAlias(
      stripNullish(bindingExpectedType),
      context
    );

    const isBroadNumber =
      resolvedExpected.kind === "primitiveType" &&
      resolvedExpected.name === "number";
    if (!isBroadNumber) {
      return false;
    }

    if (resolvedBinding.kind === "primitiveType") {
      return resolvedBinding.name === "int";
    }

    if (resolvedBinding.kind !== "referenceType") {
      return false;
    }

    return (
      resolvedBinding.name === "sbyte" ||
      resolvedBinding.name === "byte" ||
      resolvedBinding.name === "short" ||
      resolvedBinding.name === "ushort" ||
      resolvedBinding.name === "int" ||
      resolvedBinding.name === "uint" ||
      resolvedBinding.name === "long" ||
      resolvedBinding.name === "ulong" ||
      resolvedBinding.name === "SByte" ||
      resolvedBinding.name === "Byte" ||
      resolvedBinding.name === "Int16" ||
      resolvedBinding.name === "UInt16" ||
      resolvedBinding.name === "Int32" ||
      resolvedBinding.name === "UInt32" ||
      resolvedBinding.name === "Int64" ||
      resolvedBinding.name === "UInt64"
    );
  })();

  const narrowedExpectedType =
    !expectedType || prefersBindingNumericType
      ? bindingExpectedType ?? expectedType
      : expectedType;

  return selectDeterministicUnionParameterMember(
    narrowedExpectedType,
    arg,
    context
  );
};

const preservesSurfaceRuntimeMaterialization = (
  surfaceExpectedType: IrType | undefined,
  runtimeExpectedType: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!surfaceExpectedType || !runtimeExpectedType) {
    return true;
  }

  const surfaceHasRuntimeNullish =
    splitRuntimeNullishUnionMembers(surfaceExpectedType)?.hasRuntimeNullish ??
    false;
  const runtimeHasRuntimeNullish =
    splitRuntimeNullishUnionMembers(runtimeExpectedType)?.hasRuntimeNullish ??
    false;
  if (runtimeHasRuntimeNullish && !surfaceHasRuntimeNullish) {
    return false;
  }

  const surfaceTarget = stableIrTypeKey(
    resolveRuntimeMaterializationTargetType(surfaceExpectedType, context)
  );
  const runtimeTarget = stableIrTypeKey(
    resolveRuntimeMaterializationTargetType(runtimeExpectedType, context)
  );
  return surfaceTarget === runtimeTarget;
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
  const functionValueSignature = getFunctionValueSignature(expr, context);
  const identifierImportBinding =
    expr.callee.kind === "identifier"
      ? context.importBindings?.get(expr.callee.name)
      : undefined;
  const memberObjectImportBinding =
    expr.callee.kind === "memberAccess" &&
    expr.callee.object.kind === "identifier"
      ? context.importBindings?.get(expr.callee.object.name)
      : undefined;
  const importedFunctionValueTarget =
    functionValueSignature &&
    ((expr.callee.kind === "identifier" &&
      identifierImportBinding?.kind === "value" &&
      (identifierImportBinding.valueKind === "variable" ||
        identifierImportBinding.moduleObject === true)) ||
      (expr.callee.kind === "memberAccess" &&
        !expr.callee.isComputed &&
        typeof expr.callee.property === "string" &&
        memberObjectImportBinding?.kind === "namespace" &&
        (memberObjectImportBinding.memberKinds?.get(expr.callee.property) ===
          "variable" ||
          memberObjectImportBinding.moduleObject === true)));
  const hasResolvedCallSurface =
    ((expr.parameterTypes?.length ?? 0) > 0) ||
    ((expr.surfaceParameterTypes?.length ?? 0) > 0) ||
    expr.restParameter !== undefined ||
    expr.surfaceRestParameter !== undefined;
  const directCallableTarget =
    (expr.callee.kind === "identifier" &&
      (context.importBindings?.get(expr.callee.name)?.kind === "value" ||
        context.valueSymbols?.get(expr.callee.name)?.kind === "function")) ||
    (expr.callee.kind === "memberAccess" &&
      !expr.callee.isComputed &&
      typeof expr.callee.property === "string");
  const valueSymbolSignature =
    expr.callee.kind === "identifier"
      ? context.valueSymbols?.get(expr.callee.name)?.type
      : undefined;
  if (
    functionValueSignature &&
    !hasResolvedCallSurface &&
    (!directCallableTarget || importedFunctionValueTarget) &&
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

  const selectedParameterTypes =
    expr.parameterTypes && expr.parameterTypes.length > 0
      ? expr.parameterTypes
      : expr.surfaceParameterTypes && expr.surfaceParameterTypes.length > 0
        ? expr.surfaceParameterTypes
        : ((
            functionValueSignature?.parameters ?? valueSymbolSignature?.parameters
          )?.map((parameter) => parameter?.type) ?? []);
  const runtimeParameterTypes =
    parameterTypeOverrides && parameterTypeOverrides.length > 0
      ? parameterTypeOverrides
      : expr.surfaceParameterTypes && expr.surfaceParameterTypes.length > 0
        ? expr.surfaceParameterTypes
        : expr.parameterTypes && expr.parameterTypes.length > 0
          ? expr.parameterTypes
        : selectedParameterTypes;
  const selectedRestParameter = expr.restParameter ?? expr.surfaceRestParameter;
  const runtimeRestParameter =
    expr.surfaceRestParameter ?? expr.restParameter;
  const transparentRestPassthroughExpression =
    runtimeRestParameter?.arrayType &&
    args.length === (runtimeRestParameter.index ?? 0) + 1
      ? getTransparentRestSpreadPassthroughExpression(
          args[runtimeRestParameter.index],
          runtimeRestParameter.arrayType,
          context
        )
      : undefined;
  const normalizedArgs = transparentRestPassthroughExpression
    ? args.map((arg, index) =>
        index === runtimeRestParameter?.index && arg?.kind === "spread"
          ? {
              kind: "spread" as const,
              expression: transparentRestPassthroughExpression,
              inferredType: transparentRestPassthroughExpression.inferredType,
            }
          : arg
      )
    : expandTupleLikeSpreadArguments(args);
  const restInfo:
    | {
        readonly index: number;
        readonly arrayType: IrType;
        readonly elementType: IrType;
      }
    | undefined =
    runtimeRestParameter?.arrayType &&
    runtimeRestParameter.elementType &&
    normalizedArgs
      .slice(runtimeRestParameter.index)
      .some((candidate) => candidate?.kind === "spread")
      ? {
          index: runtimeRestParameter.index,
          arrayType: runtimeRestParameter.arrayType,
          elementType: runtimeRestParameter.elementType,
        }
      : undefined;
  let currentContext = context;
  const argAsts: CSharpExpressionAst[] = [];

  if (runtimeRestParameter) {
    const tupleRestResult = tryEmitTupleRestArguments(
      normalizedArgs,
      runtimeRestParameter.index,
      runtimeRestParameter.arrayType,
      currentContext
    );
    if (tupleRestResult) {
      const [tupleArgs, tupleContext] = tupleRestResult;
      argAsts.push(...tupleArgs);
      return [argAsts, tupleContext];
    }
  }

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
        restInfo.arrayType,
        restInfo.elementType,
        currentContext
      );
      argAsts.push(...flattenedRestArgs);
      currentContext = flattenedContext;
      break;
    }

    const selectedRestElementType =
      selectedRestParameter && i >= selectedRestParameter.index
        ? selectedRestParameter.elementType
        : undefined;
    const expectedType =
      selectedRestElementType ??
      (restInfo && i >= restInfo.index
        ? restInfo.elementType
        : resolveCallArgumentExpectedType(
            expr,
            arg,
            i,
            selectedParameterTypes[i],
            currentContext
          ));

    const runtimeRestElementType =
      runtimeRestParameter && i >= runtimeRestParameter.index
        ? runtimeRestParameter.elementType
        : undefined;
    const runtimeParameterType =
      runtimeRestElementType ?? runtimeParameterTypes[i];
    const prefersSelectedExpectedTypeOverRuntime =
      !parameterTypeOverrides &&
      expectedType !== undefined &&
      normalizedArgs.length > 0 &&
      runtimeParameterType !== undefined &&
      stableIrTypeKey(expectedType) !== stableIrTypeKey(runtimeParameterType);
    const normalizedRuntime =
      runtimeParameterType === undefined
        ? undefined
        : normalizeCallArgumentExpectedType(
            runtimeParameterType,
            arg,
            currentContext
          );
    const contextualExpectedType = (() => {
      if (!normalizedRuntime) {
        return expectedType;
      }

      if (
        expectedType &&
        !preservesSurfaceRuntimeMaterialization(
          expectedType,
          normalizedRuntime,
          currentContext
        )
      ) {
        return normalizedRuntime;
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
        if (prefersSelectedExpectedTypeOverRuntime) {
          return expectedType;
        }
        return normalizedRuntime;
      }

      if (
        shouldPreferRuntimeExpectedType(
          arg,
          actualArgumentType,
          normalizedRuntime,
          currentContext
        )
      ) {
        if (
          expectedType &&
          isNumericBindingParameterType(expectedType, currentContext) &&
          isNumericBindingParameterType(normalizedRuntime, currentContext)
        ) {
          return expectedType;
        }
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
    const finalExpectedType = normalizedRuntime ?? contextualExpectedType;

    if (arg.kind === "spread") {
      const [spreadAst, ctx] = emitExpressionAst(
        arg.expression,
        currentContext
      );
      argAsts.push(spreadAst);
      currentContext = ctx;
    } else {
      const castModifier = getPassingModifierFromCast(arg);
      if (castModifier === "out" && !isLValue(arg)) {
        const [discardAst, discardCtx] = emitOutDiscardArgument(currentContext);
        argAsts.push(discardAst);
        currentContext = discardCtx;
        continue;
      }
      if (castModifier && isLValue(arg)) {
        const [argAst, ctx] = emitExpressionAst(arg, currentContext);
        argAsts.push(wrapArgModifier(castModifier, argAst));
        currentContext = ctx;
      } else {
        const passingMode = expr.argumentPassing?.[i];
        if (passingMode === "out" && !isLValue(arg)) {
          const [discardAst, discardCtx] =
            emitOutDiscardArgument(currentContext);
          argAsts.push(discardAst);
          currentContext = discardCtx;
          continue;
        }
        const [rawArgAst, emittedContext] = emitExpressionAst(
          arg,
          currentContext,
          contextualExpectedType
        );
        const actualArgumentType =
          resolveActualFunctionTypeForArgument(arg, emittedContext) ??
          resolveEffectiveExpressionType(arg, emittedContext) ??
          arg.inferredType;
        const [materializedArgAst, materializedContext] =
          adaptValueToExpectedTypeAst({
            valueAst: rawArgAst,
            actualType: actualArgumentType,
            context: emittedContext,
            expectedType: finalExpectedType,
          }) ?? [rawArgAst, emittedContext];
        const [adaptedArgAst, ctx] = adaptFunctionArgumentAst(
          expr,
          arg,
          i,
          materializedArgAst,
          finalExpectedType,
          materializedContext
        );
        const modifier =
          passingMode && passingMode !== "value" && isLValue(arg)
            ? passingMode
            : undefined;
        argAsts.push(wrapArgModifier(modifier, adaptedArgAst));
        currentContext = ctx;
      }
    }
  }

  return [argAsts, currentContext];
};

export { emitCallArguments };
