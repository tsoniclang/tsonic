/**
 * Call expression emitter — main dispatch and orchestration.
 *
 * Routes call expressions to specialized emitters (promise, array interop,
 * JSON, extension methods) and handles the default regular-call path.
 *
 * Extension method lowering lives in:
 *   - call-extension-methods.ts
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import {
  emitTypeArgumentsAst,
  generateSpecializedName,
} from "../identifiers.js";
import { emitTypeAst } from "../../type-emitter.js";
import { emitMemberAccess } from "../access.js";
import {
  isJsonSerializerCall,
  isGlobalJsonCall,
  isInstanceMemberAccess,
  needsIntCast,
} from "./call-analysis.js";
import { extractCalleeNameFromAst } from "../../core/format/backend-ast/utils.js";
import type {
  CSharpBlockStatementAst,
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";
import {
  identifierExpression,
  identifierType,
  nullLiteral,
} from "../../core/format/backend-ast/builders.js";
import { normalizeClrQualifiedName } from "../../core/format/backend-ast/utils.js";
import { resolveStructuralViewMethodSurface } from "../../core/semantic/structural-view-types.js";
import { resolveTypeMemberKind } from "../../core/semantic/member-surfaces.js";
import {
  resolveTypeAlias,
  stripNullish,
  substituteTypeArgs,
} from "../../core/semantic/type-resolution.js";
import { resolveDirectStorageIrType } from "../../core/semantic/direct-storage-ir-types.js";
import { areIrTypesEquivalent } from "../../core/semantic/type-equivalence.js";
import { resolveEffectiveExpressionType } from "../../core/semantic/narrowed-expression-types.js";
import {
  getDirectIterableElementType,
  getIterableSourceShape,
} from "../structural-type-shapes.js";
import { emitJsonSerializerCall, emitGlobalJsonCall } from "./call-json.js";
import { emitGlobalSymbolCall } from "./call-symbol.js";
import {
  emitPromiseStaticCall,
  emitPromiseThenCatchFinally,
  buildDelegateType,
} from "./call-promise.js";
import {
  emitArrayMutationInteropCall,
  emitArrayWrapperInteropCall,
} from "./call-array-interop.js";
import { emitRuntimeUnionArrayIsArrayCall } from "./call-runtime-union-guards.js";
import { emitCallArguments, wrapIntCast } from "./call-arguments.js";
import { tryEmitExtensionMethodCall } from "./call-extension-methods.js";
import {
  resolveDirectStorageCompatibleExpressionAst,
  resolveDirectStorageCompatibleExpressionType,
} from "../expected-type-adaptation.js";
import { stripClrGenericArity } from "../access-resolution.js";
import { buildInvokedLambdaExpressionAst } from "../invoked-lambda.js";
import { generateTemp } from "../../patterns/local-lowering.js";
import { typeArgumentsAreInScope } from "./call-type-argument-safety.js";
import { willCarryAsRuntimeUnion } from "../../core/semantic/union-semantics.js";
import { materializeDirectNarrowingAst } from "../../core/semantic/materialized-narrowing.js";
import {
  isNumericSourceIrType,
  maybeCastNumericToExpectedJsNumberAst,
} from "../post-emission-adaptation.js";

const buildCallTargetExpectedType = (
  expr: Extract<IrExpression, { kind: "call" }>,
  preferParameterTypes = false
): IrType | undefined => {
  const calleeType = expr.callee.inferredType;
  if (!preferParameterTypes && calleeType?.kind === "functionType") {
    return calleeType;
  }

  const parameterTypes =
    expr.sourceBackedSurfaceParameterTypes ??
    expr.sourceBackedParameterTypes ??
    expr.surfaceParameterTypes ??
    expr.parameterTypes;
  const restParameter = expr.restParameter ?? expr.surfaceRestParameter;

  if (!parameterTypes || !expr.inferredType) {
    return undefined;
  }

  return {
    kind: "functionType",
    parameters: parameterTypes.map((parameterType, index) => ({
      kind: "parameter",
      pattern: {
        kind: "identifierPattern",
        name: `__tsonic_arg_${index}`,
      },
      type:
        restParameter && restParameter.index === index
          ? (restParameter.arrayType ?? parameterType)
          : parameterType,
      initializer: undefined,
      isOptional: false,
      isRest: restParameter?.index === index,
      passing: expr.argumentPassing?.[index] ?? "value",
    })),
    returnType: expr.inferredType,
  };
};

const resolveStructuralViewCallParameterTypes = (
  callee: IrExpression,
  context: EmitterContext
): readonly (IrType | undefined)[] | undefined =>
  resolveStructuralViewMethodSurface(callee, context)?.parameterTypes;

const getBareTypeParameterName = (
  type: IrType,
  context: EmitterContext
): string | undefined => {
  if (type.kind === "typeParameterType") {
    return type.name;
  }

  if (
    type.kind === "referenceType" &&
    (context.typeParameters?.has(type.name) ?? false) &&
    (!type.typeArguments || type.typeArguments.length === 0)
  ) {
    return type.name;
  }

  return undefined;
};

const containsTypeParameterInCSharpInferableSurface = (
  type: IrType | undefined,
  typeParameterName: string,
  context: EmitterContext,
  underNullishUnion = false,
  visited = new Set<IrType>()
): boolean => {
  if (!type || visited.has(type)) {
    return false;
  }
  visited.add(type);

  const bareName = getBareTypeParameterName(type, context);
  if (bareName) {
    return !underNullishUnion && bareName === typeParameterName;
  }

  switch (type.kind) {
    case "arrayType":
      return containsTypeParameterInCSharpInferableSurface(
        type.elementType,
        typeParameterName,
        context,
        underNullishUnion,
        visited
      );
    case "tupleType":
      return type.elementTypes.some((elementType) =>
        containsTypeParameterInCSharpInferableSurface(
          elementType,
          typeParameterName,
          context,
          underNullishUnion,
          visited
        )
      );
    case "dictionaryType":
      return (
        containsTypeParameterInCSharpInferableSurface(
          type.keyType,
          typeParameterName,
          context,
          underNullishUnion,
          visited
        ) ||
        containsTypeParameterInCSharpInferableSurface(
          type.valueType,
          typeParameterName,
          context,
          underNullishUnion,
          visited
        )
      );
    case "functionType":
      return (
        type.parameters.some((parameter) =>
          containsTypeParameterInCSharpInferableSurface(
            parameter.type,
            typeParameterName,
            context,
            underNullishUnion,
            visited
          )
        ) ||
        containsTypeParameterInCSharpInferableSurface(
          type.returnType,
          typeParameterName,
          context,
          underNullishUnion,
          visited
        )
      );
    case "intersectionType":
      return type.types.some((memberType) =>
        containsTypeParameterInCSharpInferableSurface(
          memberType,
          typeParameterName,
          context,
          underNullishUnion,
          visited
        )
      );
    case "unionType": {
      const nextUnderNullishUnion =
        underNullishUnion || type.types.some(isRuntimeNullishType);
      return type.types.some((memberType) =>
        containsTypeParameterInCSharpInferableSurface(
          memberType,
          typeParameterName,
          context,
          nextUnderNullishUnion,
          visited
        )
      );
    }
    case "referenceType":
      return (type.typeArguments ?? []).some((typeArgument) =>
        containsTypeParameterInCSharpInferableSurface(
          typeArgument,
          typeParameterName,
          context,
          underNullishUnion,
          visited
        )
      );
    case "objectType":
      return type.members.some((member) => {
        if (member.kind === "propertySignature") {
          return containsTypeParameterInCSharpInferableSurface(
            member.type,
            typeParameterName,
            context,
            underNullishUnion,
            visited
          );
        }

        return (
          member.parameters.some((parameter) =>
            containsTypeParameterInCSharpInferableSurface(
              parameter.type,
              typeParameterName,
              context,
              underNullishUnion,
              visited
            )
          ) ||
          containsTypeParameterInCSharpInferableSurface(
            member.returnType,
            typeParameterName,
            context,
            underNullishUnion,
            visited
          )
        );
      });
    default:
      return false;
  }
};

const emitStaticNumericGlobalNumberCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (
    expr.callee.kind !== "identifier" ||
    expr.callee.name !== "Number" ||
    expr.arguments.length !== 1 ||
    context.importBindings?.has("Number") ||
    context.localValueTypes?.has("Number") ||
    context.localSemanticTypes?.has("Number") ||
    context.valueSymbols?.has("Number")
  ) {
    return undefined;
  }

  const argument = expr.arguments[0];
  if (!argument || argument.kind === "spread") {
    return undefined;
  }

  const numberBinding = context.bindingRegistry?.getExactBindingByKind(
    "Number",
    "global"
  );
  if (
    !numberBinding ||
    numberBinding.assembly !== "js" ||
    numberBinding.type !== "js.Globals.Number"
  ) {
    return undefined;
  }

  const argumentType =
    resolveEffectiveExpressionType(argument, context) ?? argument.inferredType;
  if (!isNumericSourceIrType(argumentType, context)) {
    return undefined;
  }

  const [argumentAst, argumentContext] = emitExpressionAst(argument, context);
  return maybeCastNumericToExpectedJsNumberAst(
    argumentAst,
    argumentType,
    argumentContext,
    expectedType ?? expr.inferredType ?? { kind: "primitiveType", name: "number" }
  );
};

const allImplicitMethodTypeArgumentsAreCSharpInferable = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): boolean => {
  const calleeType = expr.callee.inferredType;
  if (
    calleeType?.kind !== "functionType" ||
    !calleeType.typeParameters ||
    calleeType.typeParameters.length === 0 ||
    !expr.typeArguments ||
    expr.typeArguments.length !== calleeType.typeParameters.length
  ) {
    return true;
  }

  return calleeType.typeParameters.every((typeParameter) =>
    calleeType.parameters.some((parameter) =>
      containsTypeParameterInCSharpInferableSurface(
        parameter.type,
        typeParameter.name,
        context
      )
    )
  );
};

const shouldLetCSharpInferImplicitCallTypeArguments = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): boolean => {
  if (expr.explicitTypeArguments && expr.explicitTypeArguments.length > 0) {
    return false;
  }
  if (expr.requiresSpecialization) {
    return false;
  }
  const hasOverloadCandidates =
    expr.candidateSignatureIds && expr.candidateSignatureIds.length > 0;

  const parameterTypes =
    expr.sourceBackedSurfaceParameterTypes ??
    expr.sourceBackedParameterTypes ??
    expr.surfaceParameterTypes ??
    expr.parameterTypes;
  if (!parameterTypes || parameterTypes.length === 0) {
    return false;
  }

  if (!allImplicitMethodTypeArgumentsAreCSharpInferable(expr, context)) {
    return false;
  }

  if (hasOverloadCandidates) {
    return expr.arguments.length > 0;
  }

  return expr.arguments.some((argument, index) => {
    if (argument.kind === "spread") {
      return false;
    }

    const parameterType = parameterTypes[index];
    const argumentType =
      resolveEffectiveExpressionType(argument, context) ?? argument.inferredType;

    return (
      !!getDirectIterableElementType(parameterType, context) &&
      !!getIterableSourceShape(argumentType, context)
    );
  });
};

const referenceGenericConstructorsMatch = (
  left: Extract<IrType, { kind: "referenceType" }>,
  right: Extract<IrType, { kind: "referenceType" }>
): boolean => {
  const leftName =
    left.providerQualifiedName ?? left.typeId?.providerName ?? left.name;
  const rightName =
    right.providerQualifiedName ?? right.typeId?.providerName ?? right.name;
  return leftName === rightName;
};

const genericInferenceTypesMatch = (
  left: IrType,
  right: IrType,
  context: EmitterContext
): boolean =>
  areIrTypesEquivalent(stripNullish(left), stripNullish(right), context) ||
  areIrTypesEquivalent(
    resolveTypeAlias(stripNullish(left), context),
    resolveTypeAlias(stripNullish(right), context),
    context
  );

const inferContextualCallTypeArguments = (
  expr: Extract<IrExpression, { kind: "call" }>,
  expectedType: IrType | undefined,
  context: EmitterContext
): readonly IrType[] | undefined => {
  if (!expectedType || expr.explicitTypeArguments?.length) {
    return undefined;
  }

  const calleeType = expr.callee.inferredType;
  if (calleeType?.kind !== "functionType") {
    return undefined;
  }

  const typeParameters = calleeType.typeParameters;
  if (!typeParameters || typeParameters.length === 0) {
    return undefined;
  }

  const parameterNames = new Set(typeParameters.map((param) => param.name));
  const visit = (
    pattern: IrType,
    actual: IrType,
    mapped: Map<string, IrType>
  ): boolean => {
    const resolvedPattern =
      pattern.kind === "referenceType"
        ? pattern
        : resolveTypeAlias(pattern, context);
    const resolvedActual =
      actual.kind === "referenceType"
        ? actual
        : resolveTypeAlias(actual, context);

    if (
      resolvedPattern.kind === "typeParameterType" &&
      parameterNames.has(resolvedPattern.name)
    ) {
      const existing = mapped.get(resolvedPattern.name);
      if (existing) {
        return genericInferenceTypesMatch(existing, actual, context);
      }
      mapped.set(resolvedPattern.name, actual);
      return true;
    }

    if (
      resolvedPattern.kind === "referenceType" &&
      resolvedActual.kind === "referenceType" &&
      referenceGenericConstructorsMatch(resolvedPattern, resolvedActual)
    ) {
      const patternArgs = resolvedPattern.typeArguments ?? [];
      const actualArgs = resolvedActual.typeArguments ?? [];
      if (patternArgs.length !== actualArgs.length) {
        return false;
      }
      return patternArgs.every((patternArg, index) => {
        const actualArg = actualArgs[index];
        return !!actualArg && visit(patternArg, actualArg, mapped);
      });
    }

    if (
      resolvedPattern.kind === "unionType" &&
      resolvedActual.kind === "unionType" &&
      resolvedPattern.runtimeCarrierFamilyKey &&
      resolvedPattern.runtimeCarrierFamilyKey ===
        resolvedActual.runtimeCarrierFamilyKey
    ) {
      const patternArgs =
        resolvedPattern.runtimeCarrierTypeArguments ??
        resolvedPattern.runtimeCarrierTypeParameters?.map(
          (name): IrType => ({ kind: "typeParameterType", name })
        ) ??
        [];
      const actualArgs = resolvedActual.runtimeCarrierTypeArguments ?? [];
      if (patternArgs.length !== actualArgs.length) {
        return false;
      }
      return patternArgs.every((patternArg, index) => {
        const actualArg = actualArgs[index];
        return !!actualArg && visit(patternArg, actualArg, mapped);
      });
    }

    return false;
  };

  const inferFromParameters = (
    selectArgumentType: (argument: IrExpression) => IrType | undefined
  ): Map<string, IrType> => {
    const mapped = new Map<string, IrType>();
    const params = calleeType.parameters;
    const restParameter = expr.restParameter ?? expr.surfaceRestParameter;

    expr.arguments.forEach((argument, index) => {
      const param =
        params[index] ??
        (restParameter && restParameter.index <= index
          ? params[restParameter.index]
          : undefined);
      const patternType =
        restParameter && restParameter.index <= index
          ? (restParameter.elementType ?? param?.type)
          : param?.type;
      const argumentType = selectArgumentType(argument);
      if (!patternType || !argumentType) {
        return;
      }
      visit(patternType, argumentType, mapped);
    });

    return mapped;
  };

  const mapped = new Map<string, IrType>();
  const returnTypeCandidates = [
    calleeType.returnType,
    expr.sourceBackedReturnType,
    expr.inferredType,
  ].filter((type): type is IrType => type !== undefined);
  if (
    !returnTypeCandidates.some((returnType) => {
      mapped.clear();
      return visit(returnType, expectedType, mapped);
    })
  ) {
    return undefined;
  }

  const inferred = typeParameters.map((param) => mapped.get(param.name));
  if (!inferred.every((type): type is IrType => type !== undefined)) {
    return undefined;
  }

  if (!typeArgumentsAreInScope(inferred, context)) {
    return undefined;
  }

  const semanticParameterInferred = inferFromParameters(
    (argument) =>
      resolveEffectiveExpressionType(argument, context) ?? argument.inferredType
  );
  const emittedSurfaceParameterInferred = inferFromParameters(
    (argument) =>
      resolveDirectStorageIrType(argument, context) ??
      resolveEffectiveExpressionType(argument, context) ??
      argument.inferredType
  );
  const declaredParameterInferred = inferFromParameters(
    (argument) => argument.inferredType
  );
  const csharpWouldInferSameTypeArguments = typeParameters.every((param) => {
    const parameterType =
      emittedSurfaceParameterInferred.get(param.name) ??
      semanticParameterInferred.get(param.name);
    const declaredParameterType = declaredParameterInferred.get(param.name);
    const contextualType = mapped.get(param.name);
    return (
      parameterType !== undefined &&
      contextualType !== undefined &&
      genericInferenceTypesMatch(parameterType, contextualType, context) &&
      (declaredParameterType === undefined ||
        genericInferenceTypesMatch(
          declaredParameterType,
          contextualType,
          context
        ))
    );
  });
  return csharpWouldInferSameTypeArguments ? undefined : inferred;
};

const isRuntimeNullishType = (type: IrType): boolean =>
  type.kind === "primitiveType" &&
  (type.name === "null" || type.name === "undefined");

const isUnconstrainedGenericNullishUnion = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (type?.kind !== "unionType" || !type.types.some(isRuntimeNullishType)) {
    return false;
  }

  const nonNullish = stripNullish(type);
  const typeParameterName = getBareTypeParameterName(nonNullish, context);
  return (
    typeParameterName !== undefined &&
    (context.typeParamConstraints?.get(typeParameterName) ??
      "unconstrained") === "unconstrained"
  );
};

const maybeRewriteOptionalGenericNullishInvocation = (
  invocation: CSharpExpressionAst,
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (
    invocation.kind !== "invocationExpression" ||
    invocation.expression.kind !== "conditionalMemberAccessExpression" ||
    !isUnconstrainedGenericNullishUnion(expr.inferredType, context)
  ) {
    return undefined;
  }

  const [returnTypeAst, returnTypeContext] = emitTypeAst(
    expr.inferredType ?? { kind: "unknownType" },
    context
  );
  const [receiverName, tempContext] = generateTemp(
    "tsonic_optional_receiver_",
    returnTypeContext
  );
  const receiverAst = identifierExpression(receiverName);
  const memberName = invocation.expression.memberName;
  const body: CSharpBlockStatementAst = {
    kind: "blockStatement",
    statements: [
      {
        kind: "localDeclarationStatement",
        modifiers: [],
        type: { kind: "varType" },
        declarators: [
          {
            name: receiverName,
            initializer: invocation.expression.expression,
          },
        ],
      },
      {
        kind: "returnStatement",
        expression: {
          kind: "conditionalExpression",
          condition: {
            kind: "binaryExpression",
            left: receiverAst,
            operatorToken: "==",
            right: nullLiteral(),
          },
          whenTrue: { kind: "defaultExpression" },
          whenFalse: {
            kind: "invocationExpression",
            expression: {
              kind: "memberAccessExpression",
              expression: receiverAst,
              memberName,
            },
            arguments: invocation.arguments,
            typeArguments: invocation.typeArguments,
          },
        },
      },
    ],
  };

  return [
    buildInvokedLambdaExpressionAst({
      parameters: [],
      parameterTypes: [],
      returnType: returnTypeAst,
      body,
      arguments: [],
      context: tempContext,
    }),
    tempContext,
  ];
};

const maybeWrapGenericNullishMethodInvocation = (
  invocation: CSharpExpressionAst,
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (
    invocation.kind !== "invocationExpression" ||
    !expectedType ||
    !isUnconstrainedGenericNullishUnion(
      expr.callee.inferredType?.kind === "functionType"
        ? expr.callee.inferredType.returnType
        : undefined,
      context
    )
  ) {
    return undefined;
  }

  const [targetTypeAst, targetTypeContext] = emitTypeAst(
    stripNullish(expectedType),
    context
  );
  return [
    {
      kind: "invocationExpression",
      expression: {
        kind: "memberAccessExpression",
        expression: identifierExpression(
          "global::Tsonic.Internal.GenericOptional"
        ),
        memberName: "FromObject",
      },
      typeArguments: [targetTypeAst],
      arguments: [invocation],
    },
    targetTypeContext,
  ];
};

const extractTransparentIdentifier = (
  expr: IrExpression
): Extract<IrExpression, { kind: "identifier" }> | undefined => {
  let current: IrExpression = expr;

  while (
    current.kind === "typeAssertion" ||
    current.kind === "numericNarrowing"
  ) {
    current = current.expression;
  }

  return current.kind === "identifier" ? current : undefined;
};

const unwrapCallableMemberAssertion = (
  callee: IrExpression,
  context: EmitterContext
): Extract<IrExpression, { kind: "memberAccess" }> | undefined => {
  if (
    callee.kind !== "typeAssertion" ||
    callee.targetType.kind !== "functionType" ||
    callee.expression.kind !== "memberAccess" ||
    callee.expression.isComputed ||
    typeof callee.expression.property !== "string"
  ) {
    return undefined;
  }

  const memberKind = resolveTypeMemberKind(
    callee.expression.object.inferredType,
    callee.expression.property,
    context
  );
  return memberKind === "method" ? callee.expression : undefined;
};

const normalizePromiseResolveCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): Extract<IrExpression, { kind: "call" }> => {
  const transparentCalleeIdentifier = extractTransparentIdentifier(expr.callee);
  if (!transparentCalleeIdentifier) {
    return expr;
  }

  const promisedValueType = context.promiseResolveValueTypes?.get(
    transparentCalleeIdentifier.name
  );
  if (!promisedValueType) {
    return expr;
  }

  return {
    ...expr,
    callee: transparentCalleeIdentifier,
    parameterTypes: [promisedValueType],
    surfaceParameterTypes: [promisedValueType],
    restParameter: undefined,
    surfaceRestParameter: undefined,
  };
};

const tryGetCallableStaticAccessorCall = (
  expr: Extract<IrExpression, { kind: "call" }>
):
  | {
      readonly kind: "property" | "field";
      readonly binding: NonNullable<
        Extract<IrExpression, { kind: "call" }>["callee"] extends infer T
          ? T extends { kind: "memberAccess"; memberBinding?: infer B }
            ? B
            : never
          : never
      >;
    }
  | undefined => {
  if (expr.callee.kind !== "memberAccess") {
    return undefined;
  }

  const memberBinding = expr.callee.memberBinding;
  const kind = memberBinding?.emitSemantics?.callableStaticAccessorKind;
  if (!memberBinding || !kind) {
    return undefined;
  }

  return { kind, binding: memberBinding };
};

const getCallableStaticAccessorOwnerTypeArgs = (
  expr: Extract<IrExpression, { kind: "call" }>,
  expectedArity: number
): readonly IrType[] => {
  if (expectedArity === 0) {
    return [];
  }

  if (expr.typeArguments?.length === expectedArity) {
    return expr.typeArguments;
  }

  const inferredResult = expr.inferredType;
  if (
    inferredResult?.kind === "referenceType" &&
    inferredResult.typeArguments?.length === expectedArity
  ) {
    return inferredResult.typeArguments;
  }

  throw new Error(
    `Internal Compiler Error: callable static accessor call '${expectedArity}' generic arity could not be specialized from call-site type arguments.`
  );
};

const emitCallableStaticAccessorCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  binding: NonNullable<
    Extract<IrExpression, { kind: "call" }>["callee"] extends infer T
      ? T extends { kind: "memberAccess"; memberBinding?: infer B }
        ? B
        : never
      : never
  >,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  if (expr.arguments.length !== 0) {
    throw new Error(
      `Internal Compiler Error: callable static accessor '${binding.type}.${binding.member}' was invoked with arguments.`
    );
  }
  if (expr.isOptional) {
    throw new Error(
      `Internal Compiler Error: callable static accessor '${binding.type}.${binding.member}' cannot be optional.`
    );
  }

  const arityText = binding.type.match(/`(\d+)$/)?.[1];
  const genericArity = arityText ? Number.parseInt(arityText, 10) : 0;
  const ownerTypeArgs = getCallableStaticAccessorOwnerTypeArgs(
    expr,
    genericArity
  );

  let currentContext = context;
  const ownerTypeArgAsts: CSharpTypeAst[] = [];
  for (const typeArgument of ownerTypeArgs) {
    const [typeArgAst, typeArgContext] = emitTypeAst(
      typeArgument,
      currentContext
    );
    ownerTypeArgAsts.push(typeArgAst);
    currentContext = typeArgContext;
  }

  const ownerTypeAst = identifierType(
    normalizeClrQualifiedName(stripClrGenericArity(binding.type), true),
    ownerTypeArgAsts.length > 0 ? ownerTypeArgAsts : undefined
  );

  return [
    {
      kind: "memberAccessExpression",
      expression: {
        kind: "typeReferenceExpression",
        type: ownerTypeAst,
      },
      memberName: binding.member,
    },
    currentContext,
  ];
};

const castInvokedLambdaTarget = (
  calleeExpr: CSharpExpressionAst,
  calleeType: IrType | undefined,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  if (calleeExpr.kind !== "lambdaExpression") {
    return [calleeExpr, context];
  }
  if (!calleeType || calleeType.kind !== "functionType") {
    throw new Error(
      "Internal Compiler Error: Immediately-invoked function expression reached call emission without a concrete function type."
    );
  }

  let currentContext = context;
  const parameterTypeAsts: CSharpTypeAst[] = [];
  for (const parameter of calleeType.parameters) {
    if (!parameter?.type) {
      throw new Error(
        "Internal Compiler Error: Function-expression invocation parameter is missing a concrete type."
      );
    }
    const [parameterTypeAst, parameterTypeContext] = emitTypeAst(
      parameter.type,
      currentContext
    );
    parameterTypeAsts.push(parameterTypeAst);
    currentContext = parameterTypeContext;
  }

  const [returnTypeAst, returnTypeContext] = emitTypeAst(
    calleeType.returnType,
    currentContext
  );

  return [
    {
      kind: "parenthesizedExpression",
      expression: {
        kind: "castExpression",
        type: buildDelegateType(parameterTypeAsts, returnTypeAst),
        expression: {
          kind: "parenthesizedExpression",
          expression: calleeExpr,
        },
      },
    },
    returnTypeContext,
  ];
};

const emitSyntheticArraySliceCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (expr.callee.kind !== "memberAccess") {
    return undefined;
  }

  const binding = expr.callee.memberBinding;
  if (
    binding?.assembly !== "__synthetic" ||
    binding.type !== "Array" ||
    binding.member !== "slice" ||
    expr.arguments.length !== 1
  ) {
    return undefined;
  }

  const startIndex = expr.arguments[0];
  if (!startIndex || startIndex.kind === "spread") {
    return undefined;
  }

  const [receiverAst, receiverContext] = emitExpressionAst(
    expr.callee.object,
    context
  );
  const [startAst, startContext] = emitExpressionAst(
    startIndex,
    receiverContext,
    { kind: "primitiveType", name: "int" }
  );

  return [
    {
      kind: "invocationExpression",
      expression: identifierExpression(
        "global::System.Linq.Enumerable.ToArray"
      ),
      arguments: [
        {
          kind: "invocationExpression",
          expression: identifierExpression(
            "global::System.Linq.Enumerable.Skip"
          ),
          arguments: [receiverAst, startAst],
        },
      ],
    },
    startContext,
  ];
};

const isBigIntRuntimeType = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) {
    return false;
  }

  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (resolved.kind === "primitiveType") {
    return resolved.name === "bigint";
  }
  if (resolved.kind !== "referenceType") {
    return false;
  }

  const identities = [
    resolved.name,
    resolved.providerQualifiedName,
    resolved.typeId?.sourceName,
    resolved.typeId?.providerName,
  ];
  return identities.some((identity) => {
    const normalized = identity?.replace(/^global::/, "");
    return normalized === "System.Numerics.BigInteger";
  });
};

const emitBigIntToStringCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (
    expr.callee.kind !== "memberAccess" ||
    expr.callee.isComputed ||
    expr.callee.property !== "toString" ||
    expr.arguments.length !== 0
  ) {
    return undefined;
  }

  const receiverType =
    resolveEffectiveExpressionType(expr.callee.object, context) ??
    expr.callee.object.inferredType;
  if (!isBigIntRuntimeType(receiverType, context)) {
    return undefined;
  }

  const [receiverAst, receiverContext] = emitExpressionAst(
    expr.callee.object,
    context
  );
  return [
    {
      kind: "invocationExpression",
      expression: {
        kind: expr.callee.isOptional
          ? "conditionalMemberAccessExpression"
          : "memberAccessExpression",
        expression: receiverAst,
        memberName: "ToString",
      },
      arguments: [
        identifierExpression(
          "global::System.Globalization.CultureInfo.InvariantCulture"
        ),
      ],
    },
    receiverContext,
  ];
};

const emitObjectDictionaryStaticCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (
    expr.callee.kind !== "memberAccess" ||
    expr.callee.object.kind !== "identifier" ||
    expr.callee.object.name !== "Object" ||
    typeof expr.callee.property !== "string" ||
    expr.arguments.length !== 1
  ) {
    return undefined;
  }

  const memberName = expr.callee.property;
  if (
    memberName !== "keys" &&
    memberName !== "values" &&
    memberName !== "entries"
  ) {
    return undefined;
  }

  const argument = expr.arguments[0];
  if (!argument || argument.kind === "spread") {
    return undefined;
  }
  if (!argument.inferredType) {
    return undefined;
  }

  const rawStorageArgumentAst = resolveDirectStorageCompatibleExpressionAst({
    expr: argument,
    context,
  });
  const storageArgumentType = resolveDirectStorageIrType(argument, context);
  const resolvedStorageArgumentType = storageArgumentType
    ? resolveTypeAlias(stripNullish(storageArgumentType), context)
    : undefined;
  const dictionaryTypeFromEntriesReturn = (() => {
    if (memberName !== "entries") {
      return undefined;
    }

    const returnType =
      ("sourceBackedReturnType" in expr
        ? expr.sourceBackedReturnType
        : undefined) ?? expr.inferredType;
    const resolvedReturnType = returnType
      ? resolveTypeAlias(stripNullish(returnType), context)
      : undefined;
    if (resolvedReturnType?.kind !== "arrayType") {
      return undefined;
    }

    const resolvedElementType = resolveTypeAlias(
      stripNullish(resolvedReturnType.elementType),
      context
    );
    if (
      resolvedElementType.kind !== "tupleType" ||
      resolvedElementType.elementTypes.length !== 2
    ) {
      return undefined;
    }

    const [keyType, valueType] = resolvedElementType.elementTypes;
    return keyType && valueType
      ? ({
          kind: "dictionaryType",
          keyType,
          valueType,
        } satisfies IrType)
      : undefined;
  })();
  const unwrapDictionaryStorageAst = (
    ast: CSharpExpressionAst
  ): CSharpExpressionAst => {
    let current = ast;
    while (current.kind === "parenthesizedExpression") {
      current = current.expression;
    }

    if (current.kind !== "castExpression" && current.kind !== "asExpression") {
      return ast;
    }

    if (resolvedStorageArgumentType?.kind === "dictionaryType") {
      return current.expression;
    }

    const innerType = resolveDirectStorageCompatibleExpressionType({
      expr: argument,
      valueAst: current.expression,
      context,
    });
    const resolvedInnerType = innerType
      ? resolveTypeAlias(stripNullish(innerType), context)
      : undefined;
    return resolvedInnerType?.kind === "dictionaryType"
      ? current.expression
      : ast;
  };
  const storageArgumentAst = rawStorageArgumentAst
    ? unwrapDictionaryStorageAst(rawStorageArgumentAst)
    : undefined;
  const storageExpressionType = storageArgumentAst
    ? resolveDirectStorageCompatibleExpressionType({
        expr: argument,
        valueAst: storageArgumentAst,
        context,
      })
    : undefined;
  const resolvedStorageExpressionType = storageExpressionType
    ? resolveTypeAlias(stripNullish(storageExpressionType), context)
    : undefined;
  const argumentTypeCandidate =
    (resolvedStorageArgumentType?.kind === "dictionaryType"
      ? storageArgumentType
      : undefined) ??
    (resolvedStorageExpressionType?.kind === "dictionaryType"
      ? storageExpressionType
      : undefined) ??
    dictionaryTypeFromEntriesReturn ??
    storageArgumentType ??
    resolveEffectiveExpressionType(argument, context) ??
    argument.inferredType;
  const argumentType = resolveTypeAlias(
    stripNullish(argumentTypeCandidate),
    context
  );
  if (argumentType.kind !== "dictionaryType") {
    return undefined;
  }

  let currentContext = context;
  const [rawDictionaryAst, dictionaryContext] =
    storageArgumentAst
      ? [storageArgumentAst, currentContext]
      : emitExpressionAst(argument, currentContext);
  currentContext = dictionaryContext;
  const [dictionaryAst, materializedContext] = materializeDirectNarrowingAst(
    rawDictionaryAst,
    storageArgumentType ??
      resolveEffectiveExpressionType(argument, context) ??
      argument.inferredType,
    argumentType,
    currentContext
  );
  currentContext = materializedContext;

  if (memberName === "entries") {
    return [
      {
        kind: "invocationExpression",
        expression: identifierExpression("global::js.Object.entries"),
        arguments: [dictionaryAst],
      },
      currentContext,
    ];
  }

  const elementType =
    memberName === "keys" ? argumentType.keyType : argumentType.valueType;
  const [elementTypeAst, elementTypeContext] = emitTypeAst(
    elementType,
    currentContext
  );
  currentContext = elementTypeContext;

  const listTypeAst = identifierType(
    "global::System.Collections.Generic.List",
    [elementTypeAst]
  );
  const collectionMemberAst: CSharpExpressionAst = {
    kind: "memberAccessExpression",
    expression: dictionaryAst,
    memberName: memberName === "keys" ? "Keys" : "Values",
  };
  const listAst: CSharpExpressionAst = {
    kind: "objectCreationExpression",
    type: listTypeAst,
    arguments: [collectionMemberAst],
  };

  return [
    {
      kind: "invocationExpression",
      expression: {
        kind: "memberAccessExpression",
        expression: listAst,
        memberName: "ToArray",
      },
      arguments: [],
    },
    currentContext,
  ];
};

const buildGenericCallParameterTypeOverrides = (
  expr: Extract<IrExpression, { kind: "call" }>,
  typeArguments: readonly IrType[] | undefined
): readonly (IrType | undefined)[] | undefined => {
  if (!typeArguments || typeArguments.length === 0) {
    return undefined;
  }

  const calleeType = expr.callee.inferredType;
  if (
    calleeType?.kind !== "functionType" ||
    !calleeType.typeParameters ||
    calleeType.typeParameters.length !== typeArguments.length
  ) {
    return undefined;
  }

  const typeParameterNames = calleeType.typeParameters.map(
    (parameter) => parameter.name
  );
  return calleeType.parameters.map((parameter) => {
    if (!parameter?.type) {
      return undefined;
    }

    return substituteTypeArgs(
      parameter.type,
      typeParameterNames,
      typeArguments
    );
  });
};

/**
 * Emit a function call expression as CSharpExpressionAst
 */
export const emitCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  const normalizedExpr = normalizePromiseResolveCall(expr, context);

  const syntheticArraySlice = emitSyntheticArraySliceCall(
    normalizedExpr,
    context
  );
  if (syntheticArraySlice) {
    return syntheticArraySlice;
  }

  const objectDictionaryStaticCall = emitObjectDictionaryStaticCall(
    normalizedExpr,
    context
  );
  if (objectDictionaryStaticCall) {
    return objectDictionaryStaticCall;
  }

  const promiseStaticCall = emitPromiseStaticCall(
    normalizedExpr,
    context,
    expectedType
  );
  if (promiseStaticCall) return promiseStaticCall;

  const promiseChain = emitPromiseThenCatchFinally(normalizedExpr, context);
  if (promiseChain) return promiseChain;

  const bigIntToStringCall = emitBigIntToStringCall(
    normalizedExpr,
    context
  );
  if (bigIntToStringCall) {
    return bigIntToStringCall;
  }

  const staticNumericGlobalNumberCall = emitStaticNumericGlobalNumberCall(
    normalizedExpr,
    context,
    expectedType
  );
  if (staticNumericGlobalNumberCall) {
    return staticNumericGlobalNumberCall;
  }

  const runtimeUnionArrayIsArray = emitRuntimeUnionArrayIsArrayCall(
    normalizedExpr,
    context
  );
  if (runtimeUnionArrayIsArray) {
    return runtimeUnionArrayIsArray;
  }

  // Void promise resolve: emit as zero-arg call when safe.
  const transparentCalleeIdentifier = extractTransparentIdentifier(
    normalizedExpr.callee
  );
  if (
    transparentCalleeIdentifier &&
    context.voidResolveNames?.has(transparentCalleeIdentifier.name)
  ) {
    const isZeroArg = normalizedExpr.arguments.length === 0;
    const isSingleUndefined =
      normalizedExpr.arguments.length === 1 &&
      normalizedExpr.arguments[0]?.kind === "identifier" &&
      normalizedExpr.arguments[0].name === "undefined";

    if (isZeroArg || isSingleUndefined) {
      const [calleeAst, calleeCtx] = emitExpressionAst(
        transparentCalleeIdentifier,
        context
      );
      return [
        {
          kind: "invocationExpression",
          expression: calleeAst,
          arguments: [],
        },
        calleeCtx,
      ];
    }
  }

  // Check for JsonSerializer calls (NativeAOT support)
  const jsonCall = isJsonSerializerCall(normalizedExpr.callee);
  if (jsonCall) {
    return emitJsonSerializerCall(normalizedExpr, context, jsonCall.method);
  }

  if (normalizedExpr.intrinsicKind === "globalSymbol") {
    return emitGlobalSymbolCall(normalizedExpr, context);
  }

  // Check for global JSON.stringify/parse calls
  const globalJsonCall = isGlobalJsonCall(normalizedExpr.callee, context);
  if (globalJsonCall) {
    return emitGlobalJsonCall(
      normalizedExpr,
      context,
      globalJsonCall.method,
      expectedType
    );
  }

  // EF Core query canonicalization: ToList().ToArray() -> ToArray()
  if (
    normalizedExpr.callee.kind === "memberAccess" &&
    normalizedExpr.callee.property === "ToArray" &&
    normalizedExpr.arguments.length === 0 &&
    normalizedExpr.callee.object.kind === "call"
  ) {
    const innerCall = normalizedExpr.callee.object;

    if (
      innerCall.callee.kind === "memberAccess" &&
      innerCall.callee.memberBinding?.isExtensionMethod &&
      isInstanceMemberAccess(innerCall.callee, context) &&
      innerCall.callee.memberBinding.type.startsWith(
        "System.Linq.Enumerable"
      ) &&
      innerCall.callee.memberBinding.member === "ToList" &&
      innerCall.arguments.length === 0
    ) {
      let currentContext = context;

      currentContext.usings.add("System.Linq");

      const receiverExpr = innerCall.callee.object;
      const [receiverAst, receiverCtx] = emitExpressionAst(
        receiverExpr,
        currentContext
      );
      currentContext = receiverCtx;

      return [
        {
          kind: "invocationExpression",
          expression: {
            kind: "memberAccessExpression",
            expression: receiverAst,
            memberName: "ToArray",
          },
          arguments: [],
        },
        currentContext,
      ];
    }
  }

  const arrayWrapperInteropCall = emitArrayWrapperInteropCall(
    normalizedExpr,
    context,
    expectedType
  );
  const arrayMutationInteropCall = emitArrayMutationInteropCall(
    normalizedExpr,
    context
  );
  if (arrayMutationInteropCall) {
    return arrayMutationInteropCall;
  }
  if (arrayWrapperInteropCall) {
    return arrayWrapperInteropCall;
  }

  // Extension method lowering — delegated to call-extension-methods.ts
  // Keep this after native array interop so lifted/static container array
  // mutation calls cannot fall through to copy-based source-owned array syntax.
  const extensionResult = tryEmitExtensionMethodCall(
    normalizedExpr,
    context,
    expectedType
  );
  if (extensionResult) {
    return extensionResult;
  }

  const callableStaticAccessor =
    tryGetCallableStaticAccessorCall(normalizedExpr);
  if (callableStaticAccessor) {
    return emitCallableStaticAccessorCall(
      normalizedExpr,
      callableStaticAccessor.binding,
      context
    );
  }

  // Regular function call
  const calleeExprForEmission =
    unwrapCallableMemberAssertion(normalizedExpr.callee, context) ??
    normalizedExpr.callee;
  const shouldPreferParameterExpectedType =
    transparentCalleeIdentifier !== undefined &&
    context.promiseResolveValueTypes?.has(transparentCalleeIdentifier.name) ===
      true;
  const calleeExpectedType =
    calleeExprForEmission.kind === "memberAccess" ||
    calleeExprForEmission.kind === "identifier"
      ? undefined
      : buildCallTargetExpectedType(
          normalizedExpr,
          shouldPreferParameterExpectedType
        );
  const [calleeAst, newContext] =
    calleeExprForEmission.kind === "memberAccess"
      ? emitMemberAccess(calleeExprForEmission, context, "call")
      : emitExpressionAst(calleeExprForEmission, context, calleeExpectedType);
  let currentContext = newContext;

  let calleeExpr: CSharpExpressionAst = calleeAst;
  let typeArgAsts: readonly CSharpTypeAst[] = [];
  if (calleeExpr.kind === "lambdaExpression") {
    const castedLambdaTarget = castInvokedLambdaTarget(
      calleeExpr,
      calleeExpectedType,
      currentContext
    );
    calleeExpr = castedLambdaTarget[0];
    currentContext = castedLambdaTarget[1];
  }

  const irTypeArguments =
    normalizedExpr.typeArguments && normalizedExpr.typeArguments.length > 0
      ? normalizedExpr.typeArguments
      : undefined;
  const contextualTypeArguments = normalizedExpr.explicitTypeArguments?.length
    ? undefined
    : inferContextualCallTypeArguments(
        normalizedExpr,
        expectedType,
        currentContext
      );
  const typeArgumentsForEmission =
    contextualTypeArguments ??
    (shouldLetCSharpInferImplicitCallTypeArguments(
      normalizedExpr,
      currentContext
    )
      ? undefined
      : irTypeArguments);

  if (typeArgumentsForEmission && typeArgumentsForEmission.length > 0) {
    if (normalizedExpr.requiresSpecialization) {
      const calleeText = extractCalleeNameFromAst(calleeAst);
      const [specializedName, specContext] = generateSpecializedName(
        calleeText,
        typeArgumentsForEmission,
        currentContext
      );
      calleeExpr = {
        kind: "identifierExpression",
        identifier: specializedName,
      };
      currentContext = specContext;
    } else {
      const [typeArgs, typeContext] = emitTypeArgumentsAst(
        typeArgumentsForEmission,
        currentContext
      );
      typeArgAsts = typeArgs;
      currentContext = typeContext;
    }
  }

  const structuralViewParameterTypes = resolveStructuralViewCallParameterTypes(
    normalizedExpr.callee,
    currentContext
  );
  const genericParameterTypes = buildGenericCallParameterTypeOverrides(
    normalizedExpr,
    typeArgumentsForEmission
  );
  const hasDeclaredArgumentSurface =
    (normalizedExpr.parameterTypes?.length ?? 0) > 0 ||
    (normalizedExpr.surfaceParameterTypes?.length ?? 0) > 0 ||
    (normalizedExpr.sourceBackedParameterTypes?.length ?? 0) > 0 ||
    (normalizedExpr.sourceBackedSurfaceParameterTypes?.length ?? 0) > 0;
  const predicateParameterTypeCandidates =
    !hasDeclaredArgumentSurface &&
    normalizedExpr.narrowing?.kind === "typePredicate"
      ? normalizedExpr.arguments.map((argument, index) =>
          (() => {
            if (
              index !== normalizedExpr.narrowing?.argIndex ||
              argument.kind === "spread"
            ) {
              return undefined;
            }

            const predicateSourceType =
              resolveDirectStorageIrType(
                argument,
                argument.kind === "identifier" &&
                  currentContext.narrowedBindings?.has(argument.name)
                  ? {
                      ...currentContext,
                      narrowedBindings: new Map(
                        [...currentContext.narrowedBindings].filter(
                          ([name]) => name !== argument.name
                        )
                      ),
                    }
                  : currentContext
              ) ??
              argument.inferredType;
            return predicateSourceType &&
              willCarryAsRuntimeUnion(
                stripNullish(predicateSourceType),
                currentContext
              )
              ? argument.inferredType
              : undefined;
          })()
        )
      : undefined;
  const predicateParameterTypes = predicateParameterTypeCandidates?.some(
    (parameterType) => parameterType !== undefined
  )
    ? predicateParameterTypeCandidates
    : undefined;
  const parameterTypeOverrides =
    structuralViewParameterTypes ?? genericParameterTypes ?? predicateParameterTypes;
  const [argAsts, argContext] = emitCallArguments(
    normalizedExpr.arguments,
    normalizedExpr,
    currentContext,
    parameterTypeOverrides
  );
  currentContext = argContext;

  // Build the invocation target (may need optional chaining wrapper)
  const invocationTarget: CSharpExpressionAst = normalizedExpr.isOptional
    ? (() => {
        // Optional call: callee?.(args) — in C# this requires the callee to be
        // a delegate and the call to be ?.Invoke(). For member access callees
        // the optional chaining is already handled by the member access emitter.
        // For identifiers, emit callee?.Invoke(args).
        if (calleeExpr.kind === "identifierExpression") {
          return {
            kind: "conditionalMemberAccessExpression" as const,
            expression: calleeExpr,
            memberName: "Invoke",
          };
        }
        return calleeExpr;
      })()
    : calleeExpr;

  const invocation: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: invocationTarget,
    arguments: argAsts,
    typeArguments: typeArgAsts.length > 0 ? typeArgAsts : undefined,
  };

  const shouldCastSuperCallResult =
    normalizedExpr.callee.kind === "memberAccess" &&
    normalizedExpr.callee.object.kind === "identifier" &&
    normalizedExpr.callee.object.name === "super" &&
    !!expectedType &&
    expectedType.kind !== "voidType" &&
    expectedType.kind !== "anyType" &&
    expectedType.kind !== "unknownType";

  const rewrittenOptionalInvocation = maybeRewriteOptionalGenericNullishInvocation(
    invocation,
    normalizedExpr,
    currentContext
  );
  const genericNullishMethodInvocation =
    rewrittenOptionalInvocation === undefined
      ? maybeWrapGenericNullishMethodInvocation(
          invocation,
          normalizedExpr,
          currentContext,
          expectedType
        )
      : undefined;
  let finalInvocation: CSharpExpressionAst =
    rewrittenOptionalInvocation?.[0] ??
    genericNullishMethodInvocation?.[0] ??
    invocation;
  currentContext =
    rewrittenOptionalInvocation?.[1] ??
    genericNullishMethodInvocation?.[1] ??
    currentContext;
  if (shouldCastSuperCallResult && expectedType) {
    const [expectedTypeAst, expectedTypeContext] = emitTypeAst(
      expectedType,
      currentContext
    );
    finalInvocation = {
      kind: "castExpression",
      type: expectedTypeAst,
      expression: invocation,
    };
    currentContext = expectedTypeContext;
  }

  const calleeText = extractCalleeNameFromAst(calleeAst);
  return [
    wrapIntCast(needsIntCast(normalizedExpr, calleeText), finalInvocation),
    currentContext,
  ];
};
