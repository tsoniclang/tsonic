import type { ProgramContext } from "../../../program-context.js";
import type { IrExpression, IrType } from "../../../types.js";
import {
  referenceTypeHasClrIdentity,
  stableIrTypeKeyIfDeterministic,
} from "../../../types/type-ops.js";
import {
  expandParameterTypesForArguments,
  substitutePolymorphicThis,
} from "../../../type-system/type-system-call-resolution.js";
import { choosePreferredEquivalentInferenceType } from "../../../type-system/inference-type-preference.js";
import {
  deriveSubstitutionsFromExpectedReturn,
  substituteTypeParameters,
  unifyTypeTemplate,
} from "./call-site-analysis.js";

const BROAD_EXACTNESS_LOSER_CLR_NAMES = new Set([
  "System.Object",
  "global::System.Object",
  "Tsonic.Runtime.JsValue",
  "global::Tsonic.Runtime.JsValue",
]);

const invocationFinalizationOpaqueTypeIds = new WeakMap<object, number>();
let nextInvocationFinalizationOpaqueTypeId = 0;

const invocationFinalizationVisitKey = (type: IrType): string => {
  const stableKey = stableIrTypeKeyIfDeterministic(type);
  if (stableKey) {
    return stableKey;
  }
  const existing = invocationFinalizationOpaqueTypeIds.get(type);
  if (existing !== undefined) {
    return `opaque:${existing}`;
  }
  const next = nextInvocationFinalizationOpaqueTypeId;
  nextInvocationFinalizationOpaqueTypeId += 1;
  invocationFinalizationOpaqueTypeIds.set(type, next);
  return `opaque:${next}`;
};

export const containsTypeParameter = (
  type: IrType | undefined,
  seen: ReadonlySet<string> = new Set<string>()
): boolean => {
  if (!type) {
    return false;
  }

  const typeKey = invocationFinalizationVisitKey(type);
  if (seen.has(typeKey)) {
    return false;
  }

  const nextSeen = new Set(seen);
  nextSeen.add(typeKey);

  switch (type.kind) {
    case "typeParameterType":
      return true;
    case "arrayType":
      return containsTypeParameter(type.elementType, nextSeen);
    case "tupleType":
      return type.elementTypes.some((elementType) =>
        containsTypeParameter(elementType, nextSeen)
      );
    case "dictionaryType":
      return (
        containsTypeParameter(type.keyType, nextSeen) ||
        containsTypeParameter(type.valueType, nextSeen)
      );
    case "referenceType":
      return (
        (type.typeArguments?.some((typeArgument) =>
          containsTypeParameter(typeArgument, nextSeen)
        ) ??
          false) ||
        (type.structuralMembers?.some((member) =>
          member.kind === "propertySignature"
            ? containsTypeParameter(member.type, nextSeen)
            : member.parameters.some((parameter) =>
                containsTypeParameter(parameter.type, nextSeen)
              ) || containsTypeParameter(member.returnType, nextSeen)
        ) ??
          false)
      );
    case "unionType":
    case "intersectionType":
      return type.types.some((memberType) =>
        containsTypeParameter(memberType, nextSeen)
      );
    case "functionType":
      return (
        type.parameters.some((parameter) =>
          containsTypeParameter(parameter.type, nextSeen)
        ) || containsTypeParameter(type.returnType, nextSeen)
      );
    case "objectType":
      return type.members.some((member) =>
        member.kind === "propertySignature"
          ? containsTypeParameter(member.type, nextSeen)
          : member.parameters.some((parameter) =>
              containsTypeParameter(parameter.type, nextSeen)
            ) || containsTypeParameter(member.returnType, nextSeen)
      );
    default:
      return false;
  }
};

export const getDirectStructuralMemberType = (
  receiverType: IrType | undefined,
  memberName: string
): IrType | undefined => {
  const members =
    receiverType?.kind === "referenceType"
      ? receiverType.structuralMembers
      : receiverType?.kind === "objectType"
        ? receiverType.members
        : undefined;
  if (!members || members.length === 0) {
    return undefined;
  }

  const matchingMembers = members.filter(
    (member) => member.name === memberName
  );
  if (matchingMembers.length === 0) {
    return undefined;
  }

  const methodMembers = matchingMembers.filter(
    (
      member
    ): member is Extract<
      (typeof matchingMembers)[number],
      { kind: "methodSignature" }
    > => member.kind === "methodSignature"
  );
  if (methodMembers.length > 0) {
    const callableTypes = methodMembers.map((member) => ({
      kind: "functionType" as const,
      typeParameters: member.typeParameters,
      parameters: member.parameters,
      returnType: member.returnType ?? ({ kind: "unknownType" } as const),
    }));

    const callableType =
      callableTypes.length === 1
        ? callableTypes[0]
        : {
            kind: "intersectionType" as const,
            types: callableTypes,
          };

    if (
      receiverType?.kind === "referenceType" &&
      (!receiverType.typeArguments ||
        receiverType.typeArguments.length === 0) &&
      containsTypeParameter(callableType)
    ) {
      return undefined;
    }

    return callableType;
  }

  const propertyMember = matchingMembers.find(
    (
      member
    ): member is Extract<
      (typeof matchingMembers)[number],
      { kind: "propertySignature" }
    > => member.kind === "propertySignature"
  );
  if (
    receiverType?.kind === "referenceType" &&
    (!receiverType.typeArguments || receiverType.typeArguments.length === 0) &&
    containsTypeParameter(propertyMember?.type)
  ) {
    return undefined;
  }

  return propertyMember?.type;
};

export const getAuthoritativeDirectCalleeParameterTypes = (
  callee: IrExpression,
  argumentCount: number,
  ctx: ProgramContext
): readonly (IrType | undefined)[] | undefined => {
  if (callee.kind !== "identifier" || !callee.declId) {
    return undefined;
  }

  const callableType =
    ctx.typeSystem.typeOfValueRead(callee.declId) ?? callee.inferredType;
  if (!callableType || callableType.kind !== "functionType") {
    return undefined;
  }

  if (
    (callableType.typeParameters?.length ?? 0) > 0 ||
    ctx.typeSystem.containsTypeParameter(callableType)
  ) {
    return undefined;
  }

  return expandParameterTypesForArguments(
    callableType.parameters,
    callableType.parameters.map((parameter) => parameter.type),
    argumentCount
  );
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

export const invocationTypesEquivalent = (
  left: IrType | undefined,
  right: IrType | undefined,
  ctx: ProgramContext
): boolean =>
  !!left &&
  !!right &&
  (ctx.typeSystem.typesEqual(left, right) ||
    (ctx.typeSystem.isAssignableTo(left, right) &&
      ctx.typeSystem.isAssignableTo(right, left)));

const collapseTransparentFlowAssertion = (
  expression: Extract<IrExpression, { kind: "typeAssertion" }>
): IrExpression => ({
  ...expression.expression,
  inferredType: expression.inferredType,
  sourceSpan: expression.sourceSpan ?? expression.expression.sourceSpan,
});

export const normalizeFinalizedInvocationArguments = (
  argumentsList: readonly IrExpression[],
  parameterTypes: readonly (IrType | undefined)[] | undefined,
  surfaceParameterTypes: readonly (IrType | undefined)[] | undefined,
  ctx: ProgramContext
): readonly IrExpression[] =>
  argumentsList.map((argument, index) => {
    if (argument.kind === "spread" || !isTransparentFlowAssertion(argument)) {
      return argument;
    }

    const selectedParameterType = parameterTypes?.[index];
    const surfaceParameterType = surfaceParameterTypes?.[index];

    if (
      !selectedParameterType ||
      !surfaceParameterType ||
      invocationTypesEquivalent(
        selectedParameterType,
        surfaceParameterType,
        ctx
      )
    ) {
      return argument;
    }

    if (
      !invocationTypesEquivalent(
        argument.targetType,
        selectedParameterType,
        ctx
      )
    ) {
      return argument;
    }

    if (
      !ctx.typeSystem.isAssignableTo(
        selectedParameterType,
        surfaceParameterType
      )
    ) {
      return argument;
    }

    return collapseTransparentFlowAssertion(argument);
  });

const isCompilerGeneratedStructuralCarrierName = (name: string): boolean =>
  name.startsWith("__Anon_") || name.startsWith("__Rest_");

const isRuntimeNullishType = (type: IrType): boolean =>
  type.kind === "primitiveType" &&
  (type.name === "null" || type.name === "undefined");

const containsCompilerGeneratedStructuralCarrier = (
  type: IrType | undefined,
  seen: ReadonlySet<string> = new Set<string>()
): boolean => {
  if (!type) {
    return false;
  }

  const typeKey = invocationFinalizationVisitKey(type);
  if (seen.has(typeKey)) {
    return false;
  }

  const nextSeen = new Set(seen);
  nextSeen.add(typeKey);

  switch (type.kind) {
    case "referenceType":
      return (
        isCompilerGeneratedStructuralCarrierName(type.name) ||
        (type.typeArguments?.some((typeArgument) =>
          containsCompilerGeneratedStructuralCarrier(typeArgument, nextSeen)
        ) ??
          false)
      );
    case "unionType":
    case "intersectionType":
      return type.types.some((memberType) =>
        containsCompilerGeneratedStructuralCarrier(memberType, nextSeen)
      );
    case "arrayType":
      return containsCompilerGeneratedStructuralCarrier(
        type.elementType,
        nextSeen
      );
    case "tupleType":
      return type.elementTypes.some((elementType) =>
        containsCompilerGeneratedStructuralCarrier(elementType, nextSeen)
      );
    case "dictionaryType":
      return (
        containsCompilerGeneratedStructuralCarrier(type.keyType, nextSeen) ||
        containsCompilerGeneratedStructuralCarrier(type.valueType, nextSeen)
      );
    case "functionType":
      return (
        type.parameters.some((parameter) =>
          containsCompilerGeneratedStructuralCarrier(parameter.type, nextSeen)
        ) ||
        containsCompilerGeneratedStructuralCarrier(type.returnType, nextSeen)
      );
    case "objectType":
      return true;
    default:
      return false;
  }
};

const hasStableNamedTypeIdentity = (
  type: IrType | undefined,
  seen: ReadonlySet<string> = new Set<string>()
): boolean => {
  if (!type) {
    return false;
  }

  const typeKey = invocationFinalizationVisitKey(type);
  if (seen.has(typeKey)) {
    return false;
  }

  const nextSeen = new Set(seen);
  nextSeen.add(typeKey);

  switch (type.kind) {
    case "referenceType":
      return (
        !isCompilerGeneratedStructuralCarrierName(type.name) &&
        type.name !== "object" &&
        type.name !== "JsValue"
      );
    case "unionType":
    case "intersectionType":
      return type.types.some((memberType) =>
        hasStableNamedTypeIdentity(memberType, nextSeen)
      );
    default:
      return false;
  }
};

export const shouldPreferExactMemberType = (
  currentType: IrType | undefined,
  exactType: IrType | undefined,
  ctx: ProgramContext
): exactType is IrType => {
  void ctx;
  const getNumericKind = (type: IrType | undefined): string | undefined => {
    if (!type) {
      return undefined;
    }
    if (type.kind === "primitiveType") {
      return type.name;
    }
    if (type.kind === "referenceType") {
      return type.name;
    }
    return undefined;
  };

  const hasStrongerNumericIntent = (
    current: IrType | undefined,
    exact: IrType | undefined
  ): boolean => {
    if (!current || !exact) {
      return false;
    }

    const currentNumeric = getNumericKind(current);
    const exactNumeric = getNumericKind(exact);
    if (currentNumeric && exactNumeric) {
      return currentNumeric === "number" && exactNumeric !== "number";
    }

    if (current.kind === "functionType" && exact.kind === "functionType") {
      if (current.parameters.length !== exact.parameters.length) {
        return false;
      }

      if (hasStrongerNumericIntent(current.returnType, exact.returnType)) {
        return true;
      }

      return current.parameters.some((parameter, index) => {
        const exactParameter = exact.parameters[index];
        return (
          exactParameter !== undefined &&
          hasStrongerNumericIntent(parameter.type, exactParameter.type)
        );
      });
    }

    return false;
  };

  const isBroadExactnessLoser = (type: IrType | undefined): boolean => {
    if (!type) {
      return false;
    }

    if (type.kind === "referenceType") {
      return (
        type.name === "JsValue" ||
        type.name === "object" ||
        referenceTypeHasClrIdentity(type, BROAD_EXACTNESS_LOSER_CLR_NAMES)
      );
    }

    return false;
  };

  if (!exactType || exactType.kind === "unknownType") {
    return false;
  }

  if (!currentType || currentType.kind === "unknownType") {
    return true;
  }

  if (
    hasStableNamedTypeIdentity(currentType) &&
    !containsCompilerGeneratedStructuralCarrier(currentType) &&
    containsCompilerGeneratedStructuralCarrier(exactType)
  ) {
    return false;
  }

  if (hasStrongerNumericIntent(currentType, exactType)) {
    return true;
  }

  if (isBroadExactnessLoser(currentType) && !isBroadExactnessLoser(exactType)) {
    return true;
  }

  return (
    containsTypeParameter(currentType) && !containsTypeParameter(exactType)
  );
};

const choosePreferredExactTypeArrayPair = (
  primary: readonly (IrType | undefined)[] | undefined,
  fallback: readonly (IrType | undefined)[] | undefined,
  ctx: ProgramContext
): readonly (IrType | undefined)[] | undefined => {
  if (!primary) {
    return fallback;
  }

  if (!fallback) {
    return primary;
  }

  let primaryWins = 0;
  let fallbackWins = 0;
  const count = Math.max(primary.length, fallback.length);
  for (let index = 0; index < count; index += 1) {
    if (shouldPreferExactMemberType(primary[index], fallback[index], ctx)) {
      fallbackWins += 1;
      continue;
    }
    if (shouldPreferExactMemberType(fallback[index], primary[index], ctx)) {
      primaryWins += 1;
    }
  }

  return fallbackWins > primaryWins ? fallback : primary;
};

export const choosePreferredExactTypeArray = (
  candidates: readonly (readonly (IrType | undefined)[] | undefined)[],
  ctx: ProgramContext
): readonly (IrType | undefined)[] | undefined => {
  let preferred: readonly (IrType | undefined)[] | undefined;
  for (const candidate of candidates) {
    preferred = choosePreferredExactTypeArrayPair(preferred, candidate, ctx);
  }
  return preferred;
};

const choosePreferredExactReturnType = (
  currentType: IrType | undefined,
  candidateType: IrType | undefined,
  ctx: ProgramContext
): IrType | undefined =>
  shouldPreferExactMemberType(currentType, candidateType, ctx)
    ? candidateType
    : (currentType ?? candidateType);

const NUMERIC_SOURCE_BACKED_TYPE_NAMES = new Set([
  "number",
  "int",
  "byte",
  "sbyte",
  "short",
  "ushort",
  "uint",
  "long",
  "ulong",
  "float",
  "double",
  "decimal",
]);

const isNumericSourceBackedType = (type: IrType | undefined): boolean => {
  if (!type) {
    return false;
  }

  if (type.kind === "primitiveType") {
    return NUMERIC_SOURCE_BACKED_TYPE_NAMES.has(type.name);
  }

  if (type.kind === "referenceType") {
    return NUMERIC_SOURCE_BACKED_TYPE_NAMES.has(type.name);
  }

  if (type.kind === "literalType") {
    return typeof type.value === "number";
  }

  if (type.kind === "unionType") {
    return (
      type.types.length > 0 &&
      type.types.every((member) => isNumericSourceBackedType(member))
    );
  }

  return false;
};

export const selectDeterministicSourceBackedParameterType = (
  parameterType: IrType | undefined,
  actualArgType: IrType | undefined,
  ctx: ProgramContext
): IrType | undefined => {
  if (!parameterType || !actualArgType || parameterType.kind !== "unionType") {
    return parameterType;
  }

  const isRuntimeNullishMember = (member: IrType): boolean =>
    member.kind === "primitiveType" &&
    (member.name === "undefined" || member.name === "null");
  const concreteMembers = parameterType.types.filter(
    (member) => !isRuntimeNullishMember(member)
  );
  const selectUniqueNumericMember = (
    members: readonly IrType[]
  ): IrType | undefined => {
    if (!isNumericSourceBackedType(actualArgType)) {
      return undefined;
    }

    const numericMembers = members.filter((member) =>
      isNumericSourceBackedType(member)
    );
    return numericMembers.length === 1 ? numericMembers[0] : undefined;
  };
  const hasNullishWrapperMember = parameterType.types.some((member) =>
    isRuntimeNullishMember(member)
  );
  if (hasNullishWrapperMember) {
    const matchingConcreteMembers = concreteMembers.filter(
      (member) =>
        ctx.typeSystem.typesEqual(actualArgType, member) ||
        ctx.typeSystem.isAssignableTo(actualArgType, member)
    );
    if (matchingConcreteMembers.length === 1) {
      return matchingConcreteMembers[0];
    }

    return parameterType;
  }

  const matchingMembers = parameterType.types.filter(
    (member) =>
      ctx.typeSystem.typesEqual(actualArgType, member) ||
      ctx.typeSystem.isAssignableTo(actualArgType, member)
  );
  if (matchingMembers.length === 1) {
    return matchingMembers[0];
  }

  return selectUniqueNumericMember(parameterType.types) ?? parameterType;
};

export const expandAuthoritativeSourceBackedSurfaceType = (
  type: IrType | undefined,
  ctx: ProgramContext,
  seen: ReadonlySet<string> = new Set<string>(),
  options: {
    readonly preserveCarrierIdentity?: boolean;
  } = {}
): IrType | undefined => {
  if (!type) {
    return undefined;
  }

  const typeKey = invocationFinalizationVisitKey(type);
  if (seen.has(typeKey)) {
    return type;
  }
  const preserveCarrierIdentity = options.preserveCarrierIdentity !== false;

  const nextSeen = new Set(seen);
  nextSeen.add(typeKey);
  const dedupeTypes = (types: readonly IrType[]): readonly IrType[] => {
    const deduped: IrType[] = [];
    for (const candidate of types) {
      if (deduped.some((existing) => ctx.typeSystem.typesEqual(existing, candidate))) {
        continue;
      }
      deduped.push(candidate);
    }
    return deduped;
  };

  switch (type.kind) {
    case "referenceType": {
      const expandedTypeArguments = type.typeArguments?.map(
        (typeArgument) =>
          expandAuthoritativeSourceBackedSurfaceType(
            typeArgument,
            ctx,
            nextSeen,
            options
          ) ?? typeArgument
      );
      const expandedAlias = ctx.typeSystem
        .collectExpectedReturnCandidates(type)
        .find(
          (candidate) =>
            !ctx.typeSystem.typesEqual(candidate, type) &&
            (candidate.kind === "unionType" ||
              candidate.kind === "intersectionType")
        );
      if (expandedAlias) {
        if (
          expandedAlias.kind === "unionType" &&
          expandedAlias.runtimeCarrierFamilyKey &&
          preserveCarrierIdentity
        ) {
          return expandedTypeArguments
            ? {
                ...type,
                typeArguments: expandedTypeArguments,
              }
            : type;
        }

        return expandAuthoritativeSourceBackedSurfaceType(
          expandedAlias,
          ctx,
          nextSeen,
          options
        );
      }
      if (!expandedTypeArguments) {
        return type;
      }

      return {
        ...type,
        typeArguments: expandedTypeArguments,
      };
    }
    case "unionType": {
      const carrierContributors: Extract<IrType, { kind: "unionType" }>[] = [];
      let hasNonCarrierContributor = false;
      const expandedMembers = type.types.flatMap((member) => {
        const expandedMember =
          expandAuthoritativeSourceBackedSurfaceType(
            member,
            ctx,
            nextSeen,
            options
          ) ?? member;
        const preserveNestedCarrierBoundary =
          expandedMember.kind === "unionType" &&
          expandedMember.runtimeCarrierFamilyKey !== undefined &&
          expandedMember.runtimeCarrierFamilyKey !==
            type.runtimeCarrierFamilyKey;
        const memberExpansion =
          expandedMember.kind === "unionType" && !preserveNestedCarrierBoundary
            ? expandedMember.types
            : [expandedMember];
        if (
          memberExpansion.some((candidate) => !isRuntimeNullishType(candidate))
        ) {
          if (
            expandedMember.kind === "unionType" &&
            expandedMember.runtimeCarrierFamilyKey
          ) {
            carrierContributors.push(expandedMember);
          } else {
            hasNonCarrierContributor = true;
          }
        }
        return memberExpansion;
      });
      const nextType = {
        ...type,
        types: dedupeTypes(expandedMembers),
      };
      if (type.runtimeCarrierFamilyKey) {
        return nextType;
      }
      const onlyCarrierContributor = carrierContributors[0];
      if (
        onlyCarrierContributor &&
        carrierContributors.length === 1 &&
        !hasNonCarrierContributor
      ) {
        return {
          ...onlyCarrierContributor,
          types: nextType.types,
        };
      }
      return nextType;
    }
    case "intersectionType": {
      const expandedMembers = type.types.flatMap((member) => {
        const expandedMember =
          expandAuthoritativeSourceBackedSurfaceType(
            member,
            ctx,
            nextSeen,
            options
          ) ?? member;
        return expandedMember.kind === "intersectionType"
          ? expandedMember.types
          : [expandedMember];
      });
      return {
        ...type,
        types: dedupeTypes(expandedMembers),
      };
    }
    case "arrayType":
      return {
        ...type,
        elementType:
          expandAuthoritativeSourceBackedSurfaceType(
            type.elementType,
            ctx,
            nextSeen,
            options
          ) ?? type.elementType,
      };
    case "tupleType":
      return {
        ...type,
        elementTypes: type.elementTypes.map(
          (elementType) =>
            expandAuthoritativeSourceBackedSurfaceType(
              elementType,
              ctx,
              nextSeen,
              options
            ) ?? elementType
        ),
      };
    case "dictionaryType":
      return {
        ...type,
        keyType:
          expandAuthoritativeSourceBackedSurfaceType(
            type.keyType,
            ctx,
            nextSeen,
            options
          ) ?? type.keyType,
        valueType:
          expandAuthoritativeSourceBackedSurfaceType(
            type.valueType,
            ctx,
            nextSeen,
            options
          ) ?? type.valueType,
      };
    case "functionType":
      return {
        ...type,
        parameters: type.parameters.map((parameter) => ({
          ...parameter,
          type:
            expandAuthoritativeSourceBackedSurfaceType(
              parameter.type,
              ctx,
              nextSeen,
              options
            ) ?? parameter.type,
        })),
        returnType:
          expandAuthoritativeSourceBackedSurfaceType(
            type.returnType,
            ctx,
            nextSeen,
            options
          ) ?? type.returnType,
      };
    case "objectType":
      return {
        ...type,
        members: type.members.map((member) =>
          member.kind === "propertySignature"
            ? {
                ...member,
                type:
                  expandAuthoritativeSourceBackedSurfaceType(
                    member.type,
                    ctx,
                    nextSeen,
                    options
                  ) ?? member.type,
              }
            : {
                ...member,
                parameters: member.parameters.map((parameter) => ({
                  ...parameter,
                  type:
                    expandAuthoritativeSourceBackedSurfaceType(
                      parameter.type,
                      ctx,
                      nextSeen,
                      options
                    ) ?? parameter.type,
                })),
                returnType:
                  expandAuthoritativeSourceBackedSurfaceType(
                    member.returnType,
                    ctx,
                    nextSeen,
                    options
                  ) ?? member.returnType,
              }
        ),
      };
    default:
      return type;
  }
};

const mergeTypeSubstitutions = (
  target: Map<string, IrType>,
  next: ReadonlyMap<string, IrType> | undefined,
  ctx: ProgramContext
): void => {
  if (!next) {
    return;
  }

  for (const [name, type] of next) {
    const existing = target.get(name);
    if (!existing) {
      target.set(name, type);
      continue;
    }
    const merged = choosePreferredEquivalentInferenceType(
      ctx.typeSystem,
      existing,
      type
    );
    if (merged) {
      target.set(name, merged);
      continue;
    }
    return;
  }
};

export const deriveInvocationTypeSubstitutions = (
  parameterTypes: readonly (IrType | undefined)[],
  actualArgTypes: readonly (IrType | undefined)[] | undefined,
  returnType: IrType,
  expectedType: IrType | undefined,
  methodTypeParameterNames: readonly string[],
  explicitTypeArgs: readonly IrType[] | undefined,
  ctx: ProgramContext
): ReadonlyMap<string, IrType> | undefined => {
  const substitutions = new Map<string, IrType>();

  if (explicitTypeArgs && methodTypeParameterNames.length > 0) {
    for (
      let index = 0;
      index <
      Math.min(methodTypeParameterNames.length, explicitTypeArgs.length);
      index += 1
    ) {
      const typeParameterName = methodTypeParameterNames[index];
      const explicitTypeArg = explicitTypeArgs[index];
      if (!typeParameterName || !explicitTypeArg) {
        continue;
      }
      substitutions.set(typeParameterName, explicitTypeArg);
    }
  }

  if (actualArgTypes) {
    const pairCount = Math.min(parameterTypes.length, actualArgTypes.length);
    for (let index = 0; index < pairCount; index += 1) {
      const parameterType = parameterTypes[index];
      const actualArgType = actualArgTypes[index];
      if (!parameterType || !actualArgType) {
        continue;
      }
      const attempt = new Map(substitutions);
      if (!unifyTypeTemplate(parameterType, actualArgType, attempt)) {
        continue;
      }
      substitutions.clear();
      for (const [name, type] of attempt) {
        substitutions.set(name, type);
      }
    }
  }

  const expectedReturnCandidates = expectedType
    ? ctx.typeSystem.collectExpectedReturnCandidates(expectedType)
    : undefined;
  mergeTypeSubstitutions(
    substitutions,
    deriveSubstitutionsFromExpectedReturn(returnType, expectedReturnCandidates),
    ctx
  );

  return substitutions.size > 0 ? substitutions : undefined;
};

type InvocationFinalizationInput = {
  readonly ctx: ProgramContext;
  readonly callee: IrExpression;
  readonly receiverType: IrType | undefined;
  readonly callableType: Extract<IrType, { kind: "functionType" }> | undefined;
  readonly argumentCount: number;
  readonly argTypes: readonly (IrType | undefined)[];
  readonly explicitTypeArgs: readonly IrType[] | undefined;
  readonly expectedType: IrType | undefined;
  readonly boundGlobalParameterTypes:
    | readonly (IrType | undefined)[]
    | undefined;
  readonly authoritativeBoundGlobalSurfaceParameterTypes:
    | readonly (IrType | undefined)[]
    | undefined;
  readonly authoritativeBoundGlobalReturnType: IrType | undefined;
  readonly sourceBackedParameterTypes:
    | readonly (IrType | undefined)[]
    | undefined;
  readonly sourceBackedSurfaceParameterTypes:
    | readonly (IrType | undefined)[]
    | undefined;
  readonly sourceBackedReturnType: IrType | undefined;
  readonly ambientBoundGlobalSurfaceParameterTypes:
    | readonly (IrType | undefined)[]
    | undefined;
  readonly authoritativeDirectParameterTypes:
    | readonly (IrType | undefined)[]
    | undefined;
  readonly resolvedParameterTypes: readonly (IrType | undefined)[] | undefined;
  readonly resolvedSurfaceParameterTypes:
    | readonly (IrType | undefined)[]
    | undefined;
  readonly resolvedReturnType: IrType | undefined;
  readonly fallbackParameterTypes: readonly (IrType | undefined)[] | undefined;
  readonly fallbackSurfaceParameterTypes:
    | readonly (IrType | undefined)[]
    | undefined;
  readonly exactParameterCandidates: readonly (
    | readonly (IrType | undefined)[]
    | undefined
  )[];
  readonly exactSurfaceParameterCandidates: readonly (
    | readonly (IrType | undefined)[]
    | undefined
  )[];
  readonly exactReturnCandidates: readonly (IrType | undefined)[];
  readonly preserveDirectSurfaceIdentity: boolean;
};

type InvocationFinalizationResult = {
  readonly parameterTypes: readonly (IrType | undefined)[] | undefined;
  readonly surfaceParameterTypes: readonly (IrType | undefined)[] | undefined;
  readonly sourceBackedParameterTypes:
    | readonly (IrType | undefined)[]
    | undefined;
  readonly sourceBackedSurfaceParameterTypes:
    | readonly (IrType | undefined)[]
    | undefined;
  readonly sourceBackedReturnType: IrType | undefined;
  readonly exactParameterTypes: readonly (IrType | undefined)[] | undefined;
  readonly exactSurfaceParameterTypes:
    | readonly (IrType | undefined)[]
    | undefined;
  readonly exactReturnType: IrType | undefined;
};

export const finalizeInvocationMetadata = ({
  ctx,
  callee,
  receiverType,
  callableType,
  argumentCount,
  argTypes,
  explicitTypeArgs,
  expectedType,
  boundGlobalParameterTypes,
  authoritativeBoundGlobalSurfaceParameterTypes,
  authoritativeBoundGlobalReturnType,
  sourceBackedParameterTypes,
  sourceBackedSurfaceParameterTypes,
  sourceBackedReturnType,
  ambientBoundGlobalSurfaceParameterTypes,
  resolvedParameterTypes,
  resolvedSurfaceParameterTypes,
  resolvedReturnType,
  fallbackParameterTypes,
  fallbackSurfaceParameterTypes,
  exactParameterCandidates,
  exactSurfaceParameterCandidates,
  exactReturnCandidates,
  preserveDirectSurfaceIdentity: _preserveDirectSurfaceIdentity,
}: InvocationFinalizationInput): InvocationFinalizationResult => {
  const applyCallReceiverPolymorphicThis = (
    type: IrType | undefined
  ): IrType | undefined =>
    callee.kind === "memberAccess" && receiverType
      ? type
        ? (substitutePolymorphicThis(type, receiverType) ?? type)
        : type
      : type;

  const specializeGenericInvocationType = (() => {
    const methodTypeParameterNames =
      callableType?.typeParameters?.map((parameter) => parameter.name) ?? [];
    if (!callableType || methodTypeParameterNames.length === 0) {
      return undefined;
    }

    const callableParameterTypes = expandParameterTypesForArguments(
      callableType.parameters,
      callableType.parameters.map((parameter) => parameter.type),
      argumentCount
    );
    const substitutions = deriveInvocationTypeSubstitutions(
      callableParameterTypes,
      argTypes,
      callableType.returnType,
      expectedType,
      methodTypeParameterNames,
      explicitTypeArgs,
      ctx
    );
    if (!substitutions) {
      return undefined;
    }

    return (type: IrType | undefined): IrType | undefined =>
      substituteTypeParameters(type, substitutions);
  })();

  const applyInvocationSpecialization = (
    type: IrType | undefined
  ): IrType | undefined =>
    applyCallReceiverPolymorphicThis(
      specializeGenericInvocationType
        ? (specializeGenericInvocationType(type) ?? type)
        : type
    );

  const applyInvocationSpecializationArray = (
    types: readonly (IrType | undefined)[] | undefined
  ): readonly (IrType | undefined)[] | undefined =>
    types?.map((type) => applyInvocationSpecialization(type));

  const specializedBoundGlobalParameterTypes =
    applyInvocationSpecializationArray(boundGlobalParameterTypes);
  const specializedAuthoritativeBoundGlobalSurfaceParameterTypes =
    applyInvocationSpecializationArray(
      authoritativeBoundGlobalSurfaceParameterTypes
    );
  const specializedSourceBackedParameterTypes =
    applyInvocationSpecializationArray(sourceBackedParameterTypes);
  const specializedSourceBackedSurfaceParameterTypes =
    applyInvocationSpecializationArray(sourceBackedSurfaceParameterTypes);
  const specializedResolvedParameterTypes = applyInvocationSpecializationArray(
    resolvedParameterTypes
  );
  const specializedResolvedSurfaceParameterTypes =
    applyInvocationSpecializationArray(resolvedSurfaceParameterTypes);
  const specializedFallbackParameterTypes = applyInvocationSpecializationArray(
    fallbackParameterTypes
  );
  const specializedFallbackSurfaceParameterTypes =
    applyInvocationSpecializationArray(fallbackSurfaceParameterTypes);
  const specializedAmbientBoundGlobalSurfaceParameterTypes =
    applyInvocationSpecializationArray(ambientBoundGlobalSurfaceParameterTypes);
  const specializedSourceBackedReturnType = applyInvocationSpecialization(
    sourceBackedReturnType
  );
  const specializedResolvedReturnType =
    applyInvocationSpecialization(resolvedReturnType);
  const specializedExactParameterTypes = choosePreferredExactTypeArray(
    exactParameterCandidates.map((candidate) =>
      applyInvocationSpecializationArray(candidate)
    ),
    ctx
  );
  const specializedExactSurfaceParameterTypes = choosePreferredExactTypeArray(
    exactSurfaceParameterCandidates.map((candidate) =>
      applyInvocationSpecializationArray(candidate)
    ),
    ctx
  );
  const specializedExactReturnType = exactReturnCandidates.reduce<
    IrType | undefined
  >(
    (preferred, candidate) =>
      choosePreferredExactReturnType(
        preferred,
        applyInvocationSpecialization(candidate),
        ctx
      ),
    undefined
  );

  const refinedSourceBackedParameterTypes =
    specializedSourceBackedParameterTypes?.map((parameterType, index) =>
      shouldPreferExactMemberType(
        parameterType,
        specializedExactParameterTypes?.[index],
        ctx
      )
        ? specializedExactParameterTypes?.[index]
        : parameterType
    );
  const refinedSourceBackedSurfaceParameterTypes =
    specializedSourceBackedSurfaceParameterTypes?.map((parameterType, index) =>
      shouldPreferExactMemberType(
        parameterType,
        specializedExactSurfaceParameterTypes?.[index],
        ctx
      )
        ? specializedExactSurfaceParameterTypes?.[index]
        : parameterType
    );

  const finalSourceBackedReturnType = (() => {
    const baselineReturnType =
      authoritativeBoundGlobalReturnType ?? specializedSourceBackedReturnType;
    const exactReturnType =
      specializedExactReturnType ?? specializedResolvedReturnType;
    if (authoritativeBoundGlobalReturnType) {
      return baselineReturnType;
    }
    return shouldPreferExactMemberType(baselineReturnType, exactReturnType, ctx)
      ? exactReturnType
      : baselineReturnType;
  })();

  const shouldUseSourceBackedSignature =
    !specializedSourceBackedReturnType ||
    invocationTypesEquivalent(
      specializedSourceBackedReturnType,
      finalSourceBackedReturnType,
      ctx
    );
  const coherentSourceBackedParameterTypes = shouldUseSourceBackedSignature
    ? refinedSourceBackedParameterTypes
    : undefined;
  const coherentSourceBackedSurfaceParameterTypes =
    shouldUseSourceBackedSignature
      ? refinedSourceBackedSurfaceParameterTypes
      : undefined;

  const baselineParameterTypes =
    specializedBoundGlobalParameterTypes ??
    coherentSourceBackedParameterTypes ??
    specializedResolvedParameterTypes ??
    specializedFallbackParameterTypes;
  const parameterTypes = baselineParameterTypes?.map((parameterType, index) =>
    specializedBoundGlobalParameterTypes
      ? parameterType
      : shouldPreferExactMemberType(
            parameterType,
            specializedExactParameterTypes?.[index],
            ctx
          )
        ? specializedExactParameterTypes?.[index]
        : parameterType
  );

  const baselineSurfaceParameterTypes =
    specializedAuthoritativeBoundGlobalSurfaceParameterTypes ??
    coherentSourceBackedSurfaceParameterTypes ??
    specializedAmbientBoundGlobalSurfaceParameterTypes ??
    specializedResolvedSurfaceParameterTypes ??
    specializedFallbackSurfaceParameterTypes ??
    parameterTypes;
  const selectionSurfaceParameterTypes = baselineSurfaceParameterTypes?.map(
    (parameterType) =>
      expandAuthoritativeSourceBackedSurfaceType(
        parameterType,
        ctx,
        new Set(),
        {
          preserveCarrierIdentity: false,
        }
      ) ?? parameterType
  );
  const finalParameterTypes = parameterTypes?.map((parameterType, index) => {
    const originalSurfaceType = baselineSurfaceParameterTypes?.[index];
    const expandedSurfaceType = selectionSurfaceParameterTypes?.[index];
    if (
      !expandedSurfaceType ||
      !originalSurfaceType ||
      ctx.typeSystem.typesEqual(expandedSurfaceType, originalSurfaceType)
    ) {
      return parameterType;
    }

    if (
      invocationTypesEquivalent(parameterType, originalSurfaceType, ctx) &&
      invocationTypesEquivalent(argTypes[index], originalSurfaceType, ctx)
    ) {
      return parameterType;
    }

    return (
      selectDeterministicSourceBackedParameterType(
        expandedSurfaceType,
        argTypes[index],
        ctx
      ) ?? parameterType
    );
  });

  return {
    parameterTypes: finalParameterTypes,
    surfaceParameterTypes: baselineSurfaceParameterTypes,
    sourceBackedParameterTypes: coherentSourceBackedParameterTypes,
    sourceBackedSurfaceParameterTypes:
      coherentSourceBackedSurfaceParameterTypes,
    sourceBackedReturnType: shouldUseSourceBackedSignature
      ? finalSourceBackedReturnType
      : undefined,
    exactParameterTypes: specializedExactParameterTypes,
    exactSurfaceParameterTypes: specializedExactSurfaceParameterTypes,
    exactReturnType: specializedExactReturnType,
  };
};
