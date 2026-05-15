import type { ProgramContext } from "../program-context.js";
import {
  IrExpression,
  IrIfBranchPlan,
  IrIfGuardShape,
  IrModule,
  IrParameter,
  IrStatement,
  IrType,
} from "../types.js";
import { getAwaitedIrType, referenceTypeIdentity } from "../types/type-ops.js";
import {
  collectResolutionArguments,
  resolveCallableCandidate,
} from "../converters/expressions/calls/call-resolution.js";
import { getBoundGlobalCallParameterTypes } from "../converters/expressions/calls/bound-global-call-parameters.js";
import {
  finalizeInvocationMetadata,
  getAuthoritativeDirectCalleeParameterTypes,
  getDirectStructuralMemberType,
} from "../converters/expressions/calls/invocation-finalization.js";

export type CallResolutionRefreshResult = {
  readonly ok: true;
  readonly modules: readonly IrModule[];
};

const preserveResolvedReturnType = (
  current: IrExpression["inferredType"],
  next: IrExpression["inferredType"],
  hasDeclaredReturnType: boolean | undefined
): IrExpression["inferredType"] => {
  const nextIsBroadOrVoid =
    next?.kind === "voidType" ||
    next?.kind === "unknownType" ||
    next?.kind === "anyType";
  const currentIsConcrete =
    current &&
    current.kind !== "voidType" &&
    current.kind !== "unknownType" &&
    current.kind !== "anyType";

  if (currentIsConcrete && nextIsBroadOrVoid) {
    return current;
  }

  if (hasDeclaredReturnType === false && current && next && nextIsBroadOrVoid) {
    return current;
  }

  return next ?? current;
};

const preserveConcreteRefreshExpectedType = (
  current: IrExpression["inferredType"],
  explicitExpected: IrExpression["inferredType"] | undefined,
  sourceBackedReturnType: IrExpression["inferredType"] | undefined
): IrExpression["inferredType"] => {
  if (explicitExpected) {
    return explicitExpected;
  }

  const concreteCurrent =
    current &&
    current.kind !== "voidType" &&
    current.kind !== "unknownType" &&
    current.kind !== "anyType"
      ? current
      : undefined;
  if (concreteCurrent) {
    return concreteCurrent;
  }

  return sourceBackedReturnType &&
    sourceBackedReturnType.kind !== "voidType" &&
    sourceBackedReturnType.kind !== "unknownType" &&
    sourceBackedReturnType.kind !== "anyType"
    ? sourceBackedReturnType
    : explicitExpected;
};

const getDeterministicReferenceIdentity = (
  type: Extract<IrType, { kind: "referenceType" }>
): string | undefined => {
  const identity = referenceTypeIdentity(type);
  return identity !== undefined &&
    (identity.startsWith("id:") || identity.startsWith("clr:"))
    ? identity
    : undefined;
};

const hasDeterministicIdentityConflict = (
  left: IrType | undefined,
  right: IrType | undefined
): boolean => {
  if (!left || !right || left.kind !== right.kind) {
    return false;
  }

  switch (left.kind) {
    case "referenceType": {
      if (right.kind !== "referenceType") {
        return false;
      }
      const leftIdentity = getDeterministicReferenceIdentity(left);
      const rightIdentity = getDeterministicReferenceIdentity(right);
      if (leftIdentity && rightIdentity && leftIdentity !== rightIdentity) {
        return true;
      }
      const leftArgs = left.typeArguments ?? [];
      const rightArgs = right.typeArguments ?? [];
      if (leftArgs.length !== rightArgs.length) {
        return false;
      }
      return leftArgs.some((typeArgument, index) =>
        hasDeterministicIdentityConflict(typeArgument, rightArgs[index])
      );
    }
    case "arrayType":
      return (
        right.kind === "arrayType" &&
        hasDeterministicIdentityConflict(left.elementType, right.elementType)
      );
    case "dictionaryType":
      return (
        right.kind === "dictionaryType" &&
        (hasDeterministicIdentityConflict(left.keyType, right.keyType) ||
          hasDeterministicIdentityConflict(left.valueType, right.valueType))
      );
    case "tupleType":
      return (
        right.kind === "tupleType" &&
        left.elementTypes.length === right.elementTypes.length &&
        left.elementTypes.some((typeElement, index) =>
          hasDeterministicIdentityConflict(
            typeElement,
            right.elementTypes[index]
          )
        )
      );
    case "functionType":
      return (
        right.kind === "functionType" &&
        left.parameters.length === right.parameters.length &&
        (hasDeterministicIdentityConflict(left.returnType, right.returnType) ||
          left.parameters.some((parameter, index) =>
            hasDeterministicIdentityConflict(
              parameter.type,
              right.parameters[index]?.type
            )
          ))
      );
    default:
      return false;
  }
};

const cohereSourceBackedReturnType = (
  inferredType: IrExpression["inferredType"],
  sourceBackedReturnType: IrExpression["inferredType"] | undefined,
  ctx: ProgramContext
): IrExpression["inferredType"] | undefined => {
  if (
    inferredType &&
    sourceBackedReturnType &&
    !ctx.typeSystem.typesEqual(inferredType, sourceBackedReturnType) &&
    hasDeterministicIdentityConflict(inferredType, sourceBackedReturnType)
  ) {
    return inferredType;
  }

  return sourceBackedReturnType;
};

const cohereAwaitedSourceBackedReturnType = (
  awaitedInferredType: IrExpression["inferredType"],
  sourceBackedReturnType: IrExpression["inferredType"] | undefined,
  ctx: ProgramContext
): IrExpression["inferredType"] | undefined => {
  if (!awaitedInferredType || !sourceBackedReturnType) {
    return sourceBackedReturnType;
  }

  const sourceAwaitedType =
    getAwaitedIrType(sourceBackedReturnType) ?? sourceBackedReturnType;
  if (
    ctx.typeSystem.typesEqual(awaitedInferredType, sourceAwaitedType) ||
    !hasDeterministicIdentityConflict(awaitedInferredType, sourceAwaitedType)
  ) {
    return sourceBackedReturnType;
  }

  return getAwaitedIrType(sourceBackedReturnType) &&
    sourceBackedReturnType.kind === "referenceType" &&
    (sourceBackedReturnType.typeArguments?.length ?? 0) === 1
    ? {
        ...sourceBackedReturnType,
        typeArguments: [awaitedInferredType],
      }
    : awaitedInferredType;
};

const sameSourceSpan = (
  left: IrExpression | undefined,
  right: IrExpression | undefined
): boolean => {
  if (!left?.sourceSpan || !right?.sourceSpan) {
    return false;
  }

  return (
    left.sourceSpan.file === right.sourceSpan.file &&
    left.sourceSpan.line === right.sourceSpan.line &&
    left.sourceSpan.column === right.sourceSpan.column &&
    left.sourceSpan.length === right.sourceSpan.length
  );
};

const isTransparentFlowAssertion = (
  expression: IrExpression
): expression is Extract<IrExpression, { kind: "typeAssertion" }> =>
  expression.kind === "typeAssertion" &&
  (expression.expression.kind === "identifier" ||
    expression.expression.kind === "memberAccess") &&
  sameSourceSpan(expression, expression.expression);

type SourceBackedLocalTypes = ReadonlyMap<string, IrType>;

const EMPTY_SOURCE_BACKED_LOCAL_TYPES: SourceBackedLocalTypes = new Map();

const isRuntimeNullishType = (type: IrType): boolean =>
  type.kind === "primitiveType" &&
  (type.name === "undefined" || type.name === "null");

const containsRuntimeNullishType = (type: IrType): boolean =>
  type.kind === "unionType" && type.types.some(isRuntimeNullishType);

const stripRuntimeNullishType = (type: IrType): IrType => {
  if (type.kind !== "unionType") {
    return type;
  }

  const retainedTypes = type.types.filter(
    (member) => !isRuntimeNullishType(member)
  );
  if (retainedTypes.length === 0) {
    return type;
  }
  if (retainedTypes.length === 1) {
    return retainedTypes[0]!;
  }

  return {
    ...type,
    types: retainedTypes,
  };
};

const invocationTypesStructurallyEquivalent = (
  left: IrType | undefined,
  right: IrType | undefined,
  ctx: ProgramContext
): boolean =>
  !!left &&
  !!right &&
  (ctx.typeSystem.typesEqual(left, right) ||
    (ctx.typeSystem.isAssignableTo(left, right) &&
      ctx.typeSystem.isAssignableTo(right, left)));

const reconcileSourceBackedLocalType = (
  currentType: IrType | undefined,
  sourceBackedType: IrType | undefined,
  ctx: ProgramContext
): IrType | undefined => {
  if (!sourceBackedType) {
    return currentType;
  }

  if (!currentType) {
    return sourceBackedType;
  }

  if (ctx.typeSystem.typesEqual(currentType, sourceBackedType)) {
    return sourceBackedType;
  }

  if (hasDeterministicIdentityConflict(currentType, sourceBackedType)) {
    return currentType;
  }

  if (
    invocationTypesStructurallyEquivalent(currentType, sourceBackedType, ctx)
  ) {
    return sourceBackedType;
  }

  const strippedCurrentType = stripRuntimeNullishType(currentType);
  const strippedSourceBackedType = stripRuntimeNullishType(sourceBackedType);
  if (
    invocationTypesStructurallyEquivalent(
      strippedCurrentType,
      strippedSourceBackedType,
      ctx
    )
  ) {
    return containsRuntimeNullishType(currentType)
      ? sourceBackedType
      : strippedSourceBackedType;
  }

  return currentType;
};

const refreshIdentifierSourceBackedType = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  sourceBackedLocals: SourceBackedLocalTypes,
  ctx: ProgramContext
): IrExpression => {
  const sourceBackedType = sourceBackedLocals.get(expr.name);
  if (!sourceBackedType) {
    return expr;
  }

  const inferredType = reconcileSourceBackedLocalType(
    expr.inferredType,
    sourceBackedType,
    ctx
  );
  return inferredType === expr.inferredType ? expr : { ...expr, inferredType };
};

const refreshTransparentAssertionSourceBackedType = (
  expr: Extract<IrExpression, { kind: "typeAssertion" }>,
  expression: IrExpression,
  ctx: ProgramContext
): IrExpression => {
  const refreshedAssertion = {
    ...expr,
    expression,
  };
  if (
    !isTransparentFlowAssertion(refreshedAssertion) ||
    !expression.inferredType
  ) {
    return refreshedAssertion;
  }

  const targetType = reconcileSourceBackedLocalType(
    expr.targetType,
    expression.inferredType,
    ctx
  );
  const inferredType = reconcileSourceBackedLocalType(
    expr.inferredType,
    expression.inferredType,
    ctx
  );

  return {
    ...refreshedAssertion,
    targetType: targetType ?? expr.targetType,
    inferredType: inferredType ?? expr.inferredType,
  };
};

const resolveSourceBackedExpressionType = (
  expression: IrExpression
): IrType | undefined => {
  switch (expression.kind) {
    case "call":
    case "new":
      return expression.sourceBackedReturnType;
    case "await": {
      const innerSourceBackedType = resolveSourceBackedExpressionType(
        expression.expression
      );
      return innerSourceBackedType
        ? (getAwaitedIrType(innerSourceBackedType) ?? innerSourceBackedType)
        : undefined;
    }
    case "typeAssertion": {
      const assertion = expression as Extract<
        IrExpression,
        { kind: "typeAssertion" }
      >;
      const transparent =
        (assertion.expression.kind === "identifier" ||
          assertion.expression.kind === "memberAccess") &&
        sameSourceSpan(assertion, assertion.expression);
      return transparent
        ? resolveSourceBackedExpressionType(assertion.expression)
        : assertion.targetType;
    }
    default:
      return undefined;
  }
};

const extendSourceBackedLocalsFromParameters = (
  parameters: readonly IrParameter[],
  sourceBackedLocals: SourceBackedLocalTypes
): SourceBackedLocalTypes => {
  let nextLocals: Map<string, IrType> | undefined;
  for (const parameter of parameters) {
    if (parameter.pattern.kind !== "identifierPattern" || !parameter.type) {
      continue;
    }

    nextLocals ??= new Map(sourceBackedLocals);
    nextLocals.set(parameter.pattern.name, parameter.type);
  }

  return nextLocals ?? sourceBackedLocals;
};

const refreshSpreadArgument = (
  argument: Extract<IrExpression, { kind: "array" }>["elements"][number],
  ctx: ProgramContext,
  sourceBackedLocals: SourceBackedLocalTypes
) =>
  argument?.kind === "spread"
    ? (() => {
        const expression = refreshExpression(
          argument.expression,
          ctx,
          sourceBackedLocals
        );
        return {
          ...argument,
          expression,
          inferredType: expression.inferredType,
        };
      })()
    : argument
      ? refreshExpression(argument, ctx, sourceBackedLocals)
      : argument;

const refreshExpression = (
  expr: IrExpression,
  ctx: ProgramContext,
  sourceBackedLocals: SourceBackedLocalTypes = EMPTY_SOURCE_BACKED_LOCAL_TYPES
): IrExpression => {
  switch (expr.kind) {
    case "identifier":
      return refreshIdentifierSourceBackedType(expr, sourceBackedLocals, ctx);

    case "call": {
      const callee = refreshExpression(expr.callee, ctx, sourceBackedLocals);
      const arguments_ = expr.arguments.map((argument) =>
        argument.kind === "spread"
          ? (() => {
              const expression = refreshExpression(
                argument.expression,
                ctx,
                sourceBackedLocals
              );
              return {
                ...argument,
                expression,
                inferredType: expression.inferredType,
              };
            })()
          : refreshExpression(argument, ctx, sourceBackedLocals)
      );

      if (callee.kind === "identifier" && callee.name === "super") {
        return {
          ...expr,
          callee,
          arguments: arguments_,
        };
      }

      if (!expr.signatureId) {
        return {
          ...expr,
          callee,
          arguments: arguments_,
        };
      }

      const resolutionArgs = collectResolutionArguments(arguments_);
      const argumentCount =
        resolutionArgs.argumentCount > 0
          ? resolutionArgs.argumentCount
          : arguments_.length;
      const argTypes =
        resolutionArgs.argumentCount > 0
          ? resolutionArgs.argTypes
          : arguments_.map((argument) =>
              argument.kind === "spread" ? undefined : argument.inferredType
            );
      const selection = ctx.typeSystem.selectBestCallCandidate(
        expr.signatureId,
        expr.candidateSignatureIds,
        {
          argumentCount,
          receiverType:
            callee.kind === "memberAccess"
              ? callee.object.inferredType
              : undefined,
          explicitTypeArgs: expr.typeArguments,
          argTypes,
          expectedReturnType: expr.resolutionExpectedReturnType,
        }
      );
      const resolved = selection.resolved;
      const usesAuthoritativeSurfaceBindings = ctx.surface !== "clr";
      const boundGlobalCallParameterTypes = getBoundGlobalCallParameterTypes(
        callee,
        argumentCount,
        ctx
      );
      const authoritativeBoundGlobalSurfaceParameterTypes =
        usesAuthoritativeSurfaceBindings
          ? boundGlobalCallParameterTypes?.parameterTypes
          : undefined;
      const authoritativeBoundGlobalReturnType =
        usesAuthoritativeSurfaceBindings
          ? boundGlobalCallParameterTypes?.returnType
          : undefined;
      const preservedAmbientBoundGlobalSurfaceParameterTypes =
        !usesAuthoritativeSurfaceBindings && boundGlobalCallParameterTypes
          ? expr.surfaceParameterTypes
          : undefined;
      const directStructuralResolution =
        callee.kind === "memberAccess" && typeof callee.property === "string"
          ? (() => {
              const directStructuralMemberType = getDirectStructuralMemberType(
                callee.object.inferredType,
                callee.property
              );
              return directStructuralMemberType
                ? resolveCallableCandidate(
                    directStructuralMemberType,
                    argumentCount,
                    ctx,
                    argTypes,
                    expr.typeArguments,
                    expr.resolutionExpectedReturnType
                  )
                : undefined;
            })()
          : undefined;
      const directCalleeResolution =
        callee.inferredType && callee.inferredType.kind !== "unknownType"
          ? resolveCallableCandidate(
              callee.inferredType,
              argumentCount,
              ctx,
              argTypes,
              expr.typeArguments,
              expr.resolutionExpectedReturnType
            )
          : undefined;
      const authoritativeDirectCalleeParameterTypes =
        getAuthoritativeDirectCalleeParameterTypes(callee, argumentCount, ctx);
      const preserveAuthoritativeDirectCalleeSurfaceIdentity =
        !!authoritativeDirectCalleeParameterTypes &&
        !authoritativeBoundGlobalSurfaceParameterTypes &&
        !expr.sourceBackedSurfaceParameterTypes &&
        !preservedAmbientBoundGlobalSurfaceParameterTypes;
      const finalizedInvocationMetadata = finalizeInvocationMetadata({
        ctx,
        callee,
        receiverType:
          callee.kind === "memberAccess"
            ? callee.object.inferredType
            : undefined,
        callableType:
          directStructuralResolution?.callableType ??
          directCalleeResolution?.callableType ??
          (callee.inferredType?.kind === "functionType"
            ? callee.inferredType
            : undefined),
        argumentCount,
        argTypes,
        explicitTypeArgs: expr.typeArguments,
        expectedType: expr.resolutionExpectedReturnType,
        boundGlobalParameterTypes:
          boundGlobalCallParameterTypes?.parameterTypes,
        authoritativeBoundGlobalSurfaceParameterTypes,
        authoritativeBoundGlobalReturnType,
        sourceBackedParameterTypes: expr.sourceBackedParameterTypes,
        sourceBackedSurfaceParameterTypes:
          expr.sourceBackedSurfaceParameterTypes,
        sourceBackedReturnType: expr.sourceBackedReturnType,
        ambientBoundGlobalSurfaceParameterTypes:
          preservedAmbientBoundGlobalSurfaceParameterTypes,
        authoritativeDirectParameterTypes:
          authoritativeDirectCalleeParameterTypes,
        resolvedParameterTypes: resolved?.parameterTypes,
        resolvedSurfaceParameterTypes: resolved?.surfaceParameterTypes,
        resolvedReturnType: resolved?.returnType,
        fallbackParameterTypes: expr.parameterTypes,
        fallbackSurfaceParameterTypes: expr.surfaceParameterTypes,
        exactParameterCandidates: [
          directStructuralResolution?.resolved?.parameterTypes,
          directCalleeResolution?.resolved?.parameterTypes,
        ],
        exactSurfaceParameterCandidates: [
          directStructuralResolution?.resolved?.surfaceParameterTypes ??
            directStructuralResolution?.resolved?.parameterTypes,
          directCalleeResolution?.resolved?.surfaceParameterTypes ??
            directCalleeResolution?.resolved?.parameterTypes,
        ],
        exactReturnCandidates: [
          directStructuralResolution?.resolved?.returnType,
          directCalleeResolution?.resolved?.returnType,
        ],
        preserveDirectSurfaceIdentity:
          preserveAuthoritativeDirectCalleeSurfaceIdentity,
      });
      const refreshedRestParameter = boundGlobalCallParameterTypes
        ? boundGlobalCallParameterTypes.restParameter
        : (expr.sourceBackedRestParameter ??
          resolved?.restParameter ??
          expr.restParameter);
      const refreshedSurfaceRestParameter = boundGlobalCallParameterTypes
        ? boundGlobalCallParameterTypes.restParameter
        : (expr.sourceBackedRestParameter ??
          resolved?.surfaceRestParameter ??
          expr.surfaceRestParameter);
      const coherentSourceBackedReturnType = cohereSourceBackedReturnType(
        expr.inferredType,
        finalizedInvocationMetadata.sourceBackedReturnType,
        ctx
      );

      return {
        ...expr,
        callee,
        arguments: arguments_,
        inferredType: preserveResolvedReturnType(
          expr.inferredType,
          coherentSourceBackedReturnType ?? resolved?.returnType,
          resolved?.hasDeclaredReturnType
        ),
        parameterTypes: finalizedInvocationMetadata.parameterTypes,
        surfaceParameterTypes:
          finalizedInvocationMetadata.surfaceParameterTypes,
        restParameter: refreshedRestParameter,
        surfaceRestParameter: refreshedSurfaceRestParameter,
        sourceBackedParameterTypes:
          finalizedInvocationMetadata.sourceBackedParameterTypes,
        sourceBackedSurfaceParameterTypes:
          finalizedInvocationMetadata.sourceBackedSurfaceParameterTypes,
        sourceBackedReturnType: coherentSourceBackedReturnType,
      };
    }

    case "new": {
      const callee = refreshExpression(expr.callee, ctx, sourceBackedLocals);
      const arguments_ = expr.arguments.map((argument) =>
        argument.kind === "spread"
          ? (() => {
              const expression = refreshExpression(
                argument.expression,
                ctx,
                sourceBackedLocals
              );
              return {
                ...argument,
                expression,
                inferredType: expression.inferredType,
              };
            })()
          : refreshExpression(argument, ctx, sourceBackedLocals)
      );

      if (!expr.signatureId) {
        return {
          ...expr,
          callee,
          arguments: arguments_,
        };
      }

      const argTypes = arguments_.map((argument) =>
        argument.kind === "spread" ? undefined : argument.inferredType
      );
      const refreshedExpectedReturnType = preserveConcreteRefreshExpectedType(
        expr.inferredType,
        expr.resolutionExpectedReturnType,
        expr.sourceBackedReturnType
      );
      const resolved = ctx.typeSystem.resolveCall({
        sigId: expr.signatureId,
        argumentCount: arguments_.length,
        explicitTypeArgs: expr.typeArguments,
        argTypes,
        expectedReturnType: refreshedExpectedReturnType,
      });
      const finalizedInvocationMetadata = finalizeInvocationMetadata({
        ctx,
        callee,
        receiverType:
          callee.kind === "memberAccess"
            ? callee.object.inferredType
            : undefined,
        callableType:
          callee.inferredType?.kind === "functionType"
            ? callee.inferredType
            : undefined,
        argumentCount: arguments_.length,
        argTypes,
        explicitTypeArgs: expr.typeArguments,
        expectedType: refreshedExpectedReturnType,
        boundGlobalParameterTypes: undefined,
        authoritativeBoundGlobalSurfaceParameterTypes: undefined,
        authoritativeBoundGlobalReturnType: undefined,
        sourceBackedParameterTypes: expr.sourceBackedParameterTypes,
        sourceBackedSurfaceParameterTypes:
          expr.sourceBackedSurfaceParameterTypes,
        sourceBackedReturnType: expr.sourceBackedReturnType,
        ambientBoundGlobalSurfaceParameterTypes: undefined,
        authoritativeDirectParameterTypes: undefined,
        resolvedParameterTypes: resolved.parameterTypes,
        resolvedSurfaceParameterTypes: resolved.surfaceParameterTypes,
        resolvedReturnType: resolved.returnType,
        fallbackParameterTypes: expr.parameterTypes,
        fallbackSurfaceParameterTypes: expr.surfaceParameterTypes,
        exactParameterCandidates: [],
        exactSurfaceParameterCandidates: [],
        exactReturnCandidates: [],
        preserveDirectSurfaceIdentity: false,
      });
      const coherentSourceBackedReturnType = cohereSourceBackedReturnType(
        expr.inferredType,
        finalizedInvocationMetadata.sourceBackedReturnType ??
          expr.sourceBackedReturnType,
        ctx
      );

      return {
        ...expr,
        callee,
        arguments: arguments_,
        inferredType:
          coherentSourceBackedReturnType ??
          resolved.returnType ??
          expr.inferredType,
        parameterTypes:
          finalizedInvocationMetadata.parameterTypes ?? expr.parameterTypes,
        surfaceParameterTypes:
          finalizedInvocationMetadata.surfaceParameterTypes ??
          expr.surfaceParameterTypes,
        sourceBackedParameterTypes:
          finalizedInvocationMetadata.sourceBackedParameterTypes ??
          expr.sourceBackedParameterTypes,
        sourceBackedSurfaceParameterTypes:
          finalizedInvocationMetadata.sourceBackedSurfaceParameterTypes ??
          expr.sourceBackedSurfaceParameterTypes,
        sourceBackedRestParameter: expr.sourceBackedRestParameter,
        sourceBackedReturnType: coherentSourceBackedReturnType,
        surfaceRestParameter:
          expr.sourceBackedRestParameter ??
          resolved.surfaceRestParameter ??
          expr.surfaceRestParameter,
      };
    }

    case "memberAccess":
      return {
        ...expr,
        object: refreshExpression(expr.object, ctx, sourceBackedLocals),
        property:
          typeof expr.property === "string"
            ? expr.property
            : refreshExpression(expr.property, ctx, sourceBackedLocals),
      };

    case "binary":
    case "logical":
      return {
        ...expr,
        left: refreshExpression(expr.left, ctx, sourceBackedLocals),
        right: refreshExpression(expr.right, ctx, sourceBackedLocals),
      };

    case "conditional":
      return {
        ...expr,
        condition: refreshExpression(expr.condition, ctx, sourceBackedLocals),
        whenTrue: refreshExpression(expr.whenTrue, ctx, sourceBackedLocals),
        whenFalse: refreshExpression(expr.whenFalse, ctx, sourceBackedLocals),
      };

    case "assignment":
      return {
        ...expr,
        left:
          expr.left.kind === "identifierPattern" ||
          expr.left.kind === "arrayPattern" ||
          expr.left.kind === "objectPattern"
            ? expr.left
            : refreshExpression(expr.left, ctx, sourceBackedLocals),
        right: refreshExpression(expr.right, ctx, sourceBackedLocals),
      };

    case "await": {
      const expression = refreshExpression(
        expr.expression,
        ctx,
        sourceBackedLocals
      );
      if (!("sourceBackedReturnType" in expression)) {
        return {
          ...expr,
          expression,
        };
      }

      const coherentSourceBackedReturnType =
        cohereAwaitedSourceBackedReturnType(
          expr.inferredType,
          expression.sourceBackedReturnType,
          ctx
        );
      return {
        ...expr,
        expression: {
          ...expression,
          inferredType:
            coherentSourceBackedReturnType ?? expression.inferredType,
          sourceBackedReturnType: coherentSourceBackedReturnType,
        } as typeof expression,
        inferredType: coherentSourceBackedReturnType
          ? (getAwaitedIrType(coherentSourceBackedReturnType) ??
            coherentSourceBackedReturnType)
          : expr.inferredType,
      };
    }

    case "unary":
    case "update":
    case "numericNarrowing":
    case "asinterface":
    case "trycast":
      return {
        ...expr,
        expression: refreshExpression(expr.expression, ctx, sourceBackedLocals),
      };

    case "typeAssertion":
      return refreshTransparentAssertionSourceBackedType(
        expr,
        refreshExpression(expr.expression, ctx, sourceBackedLocals),
        ctx
      );

    case "yield":
      return {
        ...expr,
        expression: expr.expression
          ? refreshExpression(expr.expression, ctx, sourceBackedLocals)
          : undefined,
      };

    case "templateLiteral":
      return {
        ...expr,
        expressions: expr.expressions.map((expression) =>
          refreshExpression(expression, ctx, sourceBackedLocals)
        ),
      };

    case "array":
      return {
        ...expr,
        elements: expr.elements.map((element) =>
          refreshSpreadArgument(element, ctx, sourceBackedLocals)
        ),
      };

    case "object":
      return {
        ...expr,
        properties: expr.properties.map((property) =>
          property.kind === "spread"
            ? {
                ...property,
                expression: refreshExpression(
                  property.expression,
                  ctx,
                  sourceBackedLocals
                ),
              }
            : property.kind === "property"
              ? {
                  ...property,
                  value: refreshExpression(
                    property.value,
                    ctx,
                    sourceBackedLocals
                  ),
                }
              : property
        ),
      };

    case "arrowFunction":
      return {
        ...expr,
        body:
          expr.body.kind === "blockStatement"
            ? refreshBlockStatement(
                expr.body,
                ctx,
                extendSourceBackedLocalsFromParameters(
                  expr.parameters,
                  sourceBackedLocals
                )
              )
            : refreshExpression(
                expr.body,
                ctx,
                extendSourceBackedLocalsFromParameters(
                  expr.parameters,
                  sourceBackedLocals
                )
              ),
      };

    case "functionExpression":
      return {
        ...expr,
        body: refreshBlockStatement(
          expr.body,
          ctx,
          extendSourceBackedLocalsFromParameters(
            expr.parameters,
            sourceBackedLocals
          )
        ),
      };

    default:
      return expr;
  }
};

const refreshIfGuardShape = (
  shape: IrIfGuardShape,
  ctx: ProgramContext,
  sourceBackedLocals: SourceBackedLocalTypes
): IrIfGuardShape => {
  switch (shape.kind) {
    case "typeofGuard":
    case "arrayIsArrayGuard":
    case "nullableGuard":
    case "propertyExistence":
    case "propertyTruthiness":
      return {
        ...shape,
        target: refreshExpression(shape.target, ctx, sourceBackedLocals),
      };

    case "discriminantEquality":
      return {
        ...shape,
        target: refreshExpression(shape.target, ctx, sourceBackedLocals),
      };

    case "instanceofGuard":
      return {
        ...shape,
        target: refreshExpression(shape.target, ctx, sourceBackedLocals),
        typeExpression: refreshExpression(
          shape.typeExpression,
          ctx,
          sourceBackedLocals
        ),
      };

    case "compound":
      return {
        ...shape,
        left: refreshIfGuardShape(shape.left, ctx, sourceBackedLocals),
        right: refreshIfGuardShape(shape.right, ctx, sourceBackedLocals),
      };

    case "opaqueBoolean":
      return shape;
  }
};

const refreshIfBranchPlan = (
  plan: IrIfBranchPlan | undefined,
  ctx: ProgramContext,
  sourceBackedLocals: SourceBackedLocalTypes
): IrIfBranchPlan | undefined =>
  plan
    ? {
        ...plan,
        guardShape: refreshIfGuardShape(
          plan.guardShape,
          ctx,
          sourceBackedLocals
        ),
        narrowedBindings: plan.narrowedBindings.map((narrowing) => ({
          ...narrowing,
          targetExpr: refreshExpression(
            narrowing.targetExpr,
            ctx,
            sourceBackedLocals
          ) as typeof narrowing.targetExpr,
          targetType:
            reconcileSourceBackedLocalType(
              narrowing.targetType,
              narrowing.targetExpr.kind === "identifier"
                ? sourceBackedLocals.get(narrowing.targetExpr.name)
                : undefined,
              ctx
            ) ?? narrowing.targetType,
        })),
      }
    : undefined;

const extendSourceBackedLocalsFromVariableDeclaration = (
  stmt: Extract<IrStatement, { kind: "variableDeclaration" }>,
  sourceBackedLocals: SourceBackedLocalTypes
): SourceBackedLocalTypes => {
  if (stmt.declarationKind !== "const") {
    return sourceBackedLocals;
  }

  let nextLocals: Map<string, IrType> | undefined;
  for (const declaration of stmt.declarations) {
    if (declaration.name.kind !== "identifierPattern") {
      continue;
    }

    const sourceBackedType =
      declaration.type ??
      (declaration.initializer
        ? resolveSourceBackedExpressionType(declaration.initializer)
        : undefined) ??
      declaration.initializer?.inferredType;
    if (!sourceBackedType) {
      continue;
    }

    nextLocals ??= new Map(sourceBackedLocals);
    nextLocals.set(declaration.name.name, sourceBackedType);
  }

  return nextLocals ?? sourceBackedLocals;
};

const refreshStatementList = (
  statements: readonly IrStatement[],
  ctx: ProgramContext,
  sourceBackedLocals: SourceBackedLocalTypes
): readonly IrStatement[] => {
  let currentLocals = sourceBackedLocals;
  return statements.map((statement) => {
    const refreshedStatement = refreshStatement(statement, ctx, currentLocals);
    if (refreshedStatement.kind === "variableDeclaration") {
      currentLocals = extendSourceBackedLocalsFromVariableDeclaration(
        refreshedStatement,
        currentLocals
      );
    }
    return refreshedStatement;
  });
};

const refreshBlockStatement = (
  stmt: Extract<IrStatement, { kind: "blockStatement" }>,
  ctx: ProgramContext,
  sourceBackedLocals: SourceBackedLocalTypes
): Extract<IrStatement, { kind: "blockStatement" }> => {
  return {
    ...stmt,
    statements: refreshStatementList(stmt.statements, ctx, sourceBackedLocals),
  };
};

const refreshStatement = <T extends IrStatement>(
  stmt: T,
  ctx: ProgramContext,
  sourceBackedLocals: SourceBackedLocalTypes = EMPTY_SOURCE_BACKED_LOCAL_TYPES
): T => {
  switch (stmt.kind) {
    case "expressionStatement":
      return {
        ...stmt,
        expression: refreshExpression(stmt.expression, ctx, sourceBackedLocals),
      } as T;

    case "returnStatement":
      return {
        ...stmt,
        expression: stmt.expression
          ? refreshExpression(stmt.expression, ctx, sourceBackedLocals)
          : undefined,
      } as T;

    case "variableDeclaration":
      return {
        ...stmt,
        declarations: stmt.declarations.map((declaration) => ({
          ...declaration,
          initializer: declaration.initializer
            ? refreshExpression(
                declaration.initializer,
                ctx,
                sourceBackedLocals
              )
            : undefined,
        })),
      } as T;

    case "ifStatement":
      return {
        ...stmt,
        condition: refreshExpression(stmt.condition, ctx, sourceBackedLocals),
        thenStatement: refreshStatement(
          stmt.thenStatement,
          ctx,
          sourceBackedLocals
        ),
        elseStatement: stmt.elseStatement
          ? refreshStatement(stmt.elseStatement, ctx, sourceBackedLocals)
          : undefined,
        thenPlan: refreshIfBranchPlan(stmt.thenPlan, ctx, sourceBackedLocals),
        elsePlan: refreshIfBranchPlan(stmt.elsePlan, ctx, sourceBackedLocals),
      } as T;

    case "blockStatement":
      return refreshBlockStatement(stmt, ctx, sourceBackedLocals) as T;

    case "forStatement": {
      const initializer =
        stmt.initializer && stmt.initializer.kind !== "variableDeclaration"
          ? refreshExpression(stmt.initializer, ctx, sourceBackedLocals)
          : stmt.initializer
            ? refreshStatement(stmt.initializer, ctx, sourceBackedLocals)
            : undefined;
      const loopLocals =
        initializer && initializer.kind === "variableDeclaration"
          ? extendSourceBackedLocalsFromVariableDeclaration(
              initializer,
              sourceBackedLocals
            )
          : sourceBackedLocals;
      return {
        ...stmt,
        initializer,
        condition: stmt.condition
          ? refreshExpression(stmt.condition, ctx, loopLocals)
          : undefined,
        update: stmt.update
          ? refreshExpression(stmt.update, ctx, loopLocals)
          : undefined,
        body: refreshStatement(stmt.body, ctx, loopLocals),
      } as T;
    }

    case "forOfStatement":
    case "forInStatement":
      return {
        ...stmt,
        expression: refreshExpression(stmt.expression, ctx, sourceBackedLocals),
        body: refreshStatement(stmt.body, ctx, sourceBackedLocals),
      } as T;

    case "whileStatement":
      return {
        ...stmt,
        condition: refreshExpression(stmt.condition, ctx, sourceBackedLocals),
        body: refreshStatement(stmt.body, ctx, sourceBackedLocals),
      } as T;

    case "switchStatement":
      return {
        ...stmt,
        expression: refreshExpression(stmt.expression, ctx, sourceBackedLocals),
        cases: stmt.cases.map((switchCase) => ({
          ...switchCase,
          test: switchCase.test
            ? refreshExpression(switchCase.test, ctx, sourceBackedLocals)
            : undefined,
          statements: refreshStatementList(
            switchCase.statements,
            ctx,
            sourceBackedLocals
          ),
        })),
      } as T;

    case "throwStatement":
      return {
        ...stmt,
        expression: refreshExpression(stmt.expression, ctx, sourceBackedLocals),
      } as T;

    case "tryStatement":
      return {
        ...stmt,
        tryBlock: refreshStatement(stmt.tryBlock, ctx, sourceBackedLocals),
        catchClause: stmt.catchClause
          ? {
              ...stmt.catchClause,
              body: refreshStatement(
                stmt.catchClause.body,
                ctx,
                sourceBackedLocals
              ),
            }
          : undefined,
        finallyBlock: stmt.finallyBlock
          ? refreshStatement(stmt.finallyBlock, ctx, sourceBackedLocals)
          : undefined,
      } as T;

    case "functionDeclaration":
      return {
        ...stmt,
        body: refreshBlockStatement(
          stmt.body,
          ctx,
          extendSourceBackedLocalsFromParameters(
            stmt.parameters,
            sourceBackedLocals
          )
        ),
      } as T;

    case "classDeclaration":
      return {
        ...stmt,
        members: stmt.members.map((member) => {
          if (member.kind === "methodDeclaration" && member.body) {
            return {
              ...member,
              body: refreshBlockStatement(
                member.body,
                ctx,
                extendSourceBackedLocalsFromParameters(
                  member.parameters,
                  sourceBackedLocals
                )
              ),
            };
          }
          if (member.kind === "constructorDeclaration" && member.body) {
            return {
              ...member,
              body: refreshBlockStatement(
                member.body,
                ctx,
                extendSourceBackedLocalsFromParameters(
                  member.parameters,
                  sourceBackedLocals
                )
              ),
            };
          }
          if (member.kind === "propertyDeclaration") {
            return {
              ...member,
              initializer: member.initializer
                ? refreshExpression(member.initializer, ctx, sourceBackedLocals)
                : undefined,
              getterBody: member.getterBody
                ? refreshBlockStatement(
                    member.getterBody,
                    ctx,
                    sourceBackedLocals
                  )
                : undefined,
              setterBody: member.setterBody
                ? refreshBlockStatement(
                    member.setterBody,
                    ctx,
                    sourceBackedLocals
                  )
                : undefined,
            };
          }
          return member;
        }),
      } as T;

    default:
      return stmt;
  }
};

export const runCallResolutionRefreshPass = (
  modules: readonly IrModule[],
  ctx: ProgramContext
): CallResolutionRefreshResult => ({
  ok: true,
  modules: modules.map((module) => ({
    ...module,
    body: refreshStatementList(
      module.body,
      ctx,
      EMPTY_SOURCE_BACKED_LOCAL_TYPES
    ),
    exports: module.exports.map((entry) =>
      entry.kind === "declaration"
        ? {
            ...entry,
            declaration: refreshStatement(
              entry.declaration,
              ctx,
              EMPTY_SOURCE_BACKED_LOCAL_TYPES
            ),
          }
        : entry
    ),
  })),
});
