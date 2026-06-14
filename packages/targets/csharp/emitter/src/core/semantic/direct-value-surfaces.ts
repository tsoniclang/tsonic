import type { IrExpression, IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../format/backend-ast/types.js";
import { getRuntimeUnionReferenceMembers } from "./runtime-union-shared.js";
import { collectRuntimeUnionRawMembers } from "./runtime-union-expansion.js";
import {
  findExactRuntimeUnionMemberIndices,
  findRuntimeUnionMemberIndices,
} from "./runtime-union-matching.js";
import { getCanonicalRuntimeUnionMembers } from "./runtime-union-frame.js";
import { isRuntimeUnionTypeAst } from "./runtime-reification-helpers.js";
import {
  getPropertyType,
  resolveLocalTypeInfo,
  resolveTypeAlias,
  stripNullish,
} from "./type-resolution.js";
import {
  sameTypeAstSurface,
  stripNullableTypeAst,
} from "../format/backend-ast/utils.js";
import { emitCSharpName } from "../../naming-policy.js";

const resolveDirectIdentifierName = (
  emittedIdentifier: string,
  context: EmitterContext
): string | undefined => {
  if (
    context.localValueTypes?.has(emittedIdentifier) ||
    context.localSemanticTypes?.has(emittedIdentifier) ||
    context.narrowedBindings?.has(emittedIdentifier)
  ) {
    return emittedIdentifier;
  }

  const narrowedRename = Array.from(context.narrowedBindings ?? []).find(
    ([, binding]) =>
      binding.kind === "rename" && binding.name === emittedIdentifier
  )?.[0];
  if (narrowedRename) {
    return narrowedRename;
  }

  return Array.from(context.localNameMap ?? []).find(
    ([, emitted]) => emitted === emittedIdentifier
  )?.[0];
};

const resolveStaticValueSymbolSurfaceType = (
  emittedIdentifier: string,
  context: EmitterContext
): IrType | undefined => {
  if (!context.valueSymbols) {
    return undefined;
  }

  const moduleStaticClassName = context.moduleStaticClassName;
  const moduleNamespace =
    context.moduleNamespace ?? context.options.rootNamespace;
  const containerPrefix = moduleNamespace.startsWith("global::")
    ? moduleNamespace
    : `global::${moduleNamespace}`;

  for (const [sourceName, symbol] of context.valueSymbols) {
    if (!symbol.valueType) {
      continue;
    }

    if (
      emittedIdentifier === sourceName ||
      emittedIdentifier === symbol.csharpName ||
      (moduleStaticClassName &&
        emittedIdentifier ===
          `${containerPrefix}.${moduleStaticClassName}.${symbol.csharpName}`)
    ) {
      return symbol.valueType;
    }
  }

  return undefined;
};

const resolveDirectIdentifierBinding = (
  emittedIdentifier: string,
  context: EmitterContext
):
  | {
      readonly sourceName: string;
      readonly isNarrowedRenameIdentifier: boolean;
    }
  | undefined => {
  if (
    context.localValueTypes?.has(emittedIdentifier) ||
    context.localSemanticTypes?.has(emittedIdentifier) ||
    context.narrowedBindings?.has(emittedIdentifier)
  ) {
    return {
      sourceName: emittedIdentifier,
      isNarrowedRenameIdentifier: false,
    };
  }

  const narrowedRename = Array.from(context.narrowedBindings ?? []).find(
    ([, binding]) =>
      binding.kind === "rename" && binding.name === emittedIdentifier
  )?.[0];
  if (narrowedRename) {
    return {
      sourceName: narrowedRename,
      isNarrowedRenameIdentifier: true,
    };
  }

  const sourceName = Array.from(context.localNameMap ?? []).find(
    ([, emitted]) => emitted === emittedIdentifier
  )?.[0];
  return sourceName
    ? {
        sourceName,
        isNarrowedRenameIdentifier: false,
      }
    : undefined;
};

const unwrapTransparentValueAst = (
  valueAst: CSharpExpressionAst
): CSharpExpressionAst =>
  valueAst.kind === "parenthesizedExpression"
    ? unwrapTransparentValueAst(valueAst.expression)
    : valueAst;

const qualifiedIdentifierExpressionName = (
  valueAst: CSharpExpressionAst
): string | undefined => {
  if (valueAst.kind !== "qualifiedIdentifierExpression") {
    return undefined;
  }

  const prefix = valueAst.name.aliasQualifier
    ? `${valueAst.name.aliasQualifier}::`
    : "";
  return `${prefix}${valueAst.name.segments.join(".")}`;
};

const resolveQualifiedImportedValueSurfaceType = (
  valueAst: CSharpExpressionAst,
  context: EmitterContext
): IrType | undefined => {
  const qualifiedName = qualifiedIdentifierExpressionName(valueAst);
  if (!qualifiedName || !context.importBindings) {
    return undefined;
  }

  for (const binding of context.importBindings.values()) {
    if (binding.kind !== "value" || !binding.valueType) {
      continue;
    }

    if (`${binding.clrName}.${binding.member}` === qualifiedName) {
      return binding.valueType;
    }
  }

  return undefined;
};

const hasExplicitRuntimeCarrierIdentity = (
  candidate: IrType | undefined,
  context: EmitterContext
): candidate is IrType => {
  if (!candidate) {
    return false;
  }

  if (
    candidate.kind === "referenceType" &&
    getRuntimeUnionReferenceMembers(candidate) !== undefined
  ) {
    return true;
  }

  const resolved = resolveTypeAlias(candidate, context);
  return (
    resolved.kind === "unionType" &&
    (resolved.runtimeCarrierFamilyKey !== undefined ||
      resolved.runtimeUnionLayout === "carrierSlotOrder")
  );
};

const preferRuntimeCarrierCandidate = (
  context: EmitterContext,
  ...candidates: (IrType | undefined)[]
): IrType | undefined =>
  candidates.find((candidate) =>
    hasExplicitRuntimeCarrierIdentity(candidate, context)
  ) ??
  candidates.find((candidate): candidate is IrType => candidate !== undefined);

const tryResolveRuntimeUnionAsMemberType = (
  valueAst: CSharpExpressionAst,
  context: EmitterContext
): IrType | undefined => {
  const directAst = unwrapTransparentValueAst(valueAst);
  if (directAst.kind !== "invocationExpression") {
    return undefined;
  }

  if (
    directAst.expression.kind !== "memberAccessExpression" ||
    directAst.arguments.length !== 0
  ) {
    return undefined;
  }

  const memberMatch = /^As(\d+)$/.exec(directAst.expression.memberName);
  if (!memberMatch) {
    return undefined;
  }

  const memberIndex = Number(memberMatch[1]) - 1;
  if (!Number.isInteger(memberIndex) || memberIndex < 0) {
    return undefined;
  }

  const receiverCarrierType =
    resolveProjectionReceiverRuntimeCarrierType(
      directAst.expression.expression,
      context
    ) ??
    resolveDirectValueSurfaceType(directAst.expression.expression, context);
  if (!receiverCarrierType) {
    return undefined;
  }

  const rawRuntimeMembers = collectRuntimeUnionRawMembers(
    receiverCarrierType,
    context
  );
  const rawRuntimeMember = rawRuntimeMembers[memberIndex];
  if (hasExplicitRuntimeCarrierIdentity(rawRuntimeMember, context)) {
    return rawRuntimeMember;
  }

  const runtimeMembers = getCanonicalRuntimeUnionMembers(
    receiverCarrierType,
    context
  );
  return runtimeMembers?.[memberIndex];
};

const tryConvertSurfaceTypeAstToIrType = (
  typeAst: CSharpTypeAst
): IrType | undefined => {
  const concreteTypeAst = stripNullableTypeAst(typeAst);
  switch (concreteTypeAst.kind) {
    case "predefinedType":
      switch (concreteTypeAst.keyword) {
        case "bool":
          return { kind: "primitiveType", name: "boolean" };
        case "string":
          return { kind: "primitiveType", name: "string" };
        case "void":
          return { kind: "voidType" };
        case "object":
          return { kind: "referenceType", name: "object" };
        case "int":
          return { kind: "primitiveType", name: "int" };
        case "double":
          return { kind: "primitiveType", name: "number" };
        case "char":
          return { kind: "primitiveType", name: "char" };
        default:
          return { kind: "referenceType", name: concreteTypeAst.keyword };
      }
    case "identifierType": {
      const typeArguments = concreteTypeAst.typeArguments?.map(
        tryConvertSurfaceTypeAstToIrType
      );
      if (typeArguments?.some((type) => type === undefined)) {
        return undefined;
      }
      return {
        kind: "referenceType",
        name: concreteTypeAst.name,
        ...(typeArguments && typeArguments.length > 0
          ? { typeArguments: typeArguments as readonly IrType[] }
          : {}),
      };
    }
    case "qualifiedIdentifierType": {
      const typeArguments = concreteTypeAst.typeArguments?.map(
        tryConvertSurfaceTypeAstToIrType
      );
      if (typeArguments?.some((type) => type === undefined)) {
        return undefined;
      }
      const externalQualifiedName = `${
        concreteTypeAst.name.aliasQualifier
          ? `${concreteTypeAst.name.aliasQualifier}::`
          : ""
      }${concreteTypeAst.name.segments.join(".")}`;
      const name =
        concreteTypeAst.name.segments[
          concreteTypeAst.name.segments.length - 1
        ] ?? externalQualifiedName;
      return {
        kind: "referenceType",
        name,
        externalQualifiedName,
        ...(typeArguments && typeArguments.length > 0
          ? { typeArguments: typeArguments as readonly IrType[] }
          : {}),
      };
    }
    case "arrayType": {
      if (concreteTypeAst.rank !== 1) {
        return undefined;
      }
      const elementType = tryConvertSurfaceTypeAstToIrType(
        concreteTypeAst.elementType
      );
      return elementType ? { kind: "arrayType", elementType } : undefined;
    }
    default:
      return undefined;
  }
};

const tryResolveRuntimeUnionSurfaceTypeAst = (
  typeAst: CSharpTypeAst,
  context: EmitterContext
): IrType | undefined => {
  const concreteTypeAst = stripNullableTypeAst(typeAst);
  if (isRuntimeUnionTypeAst(concreteTypeAst)) {
    if (
      concreteTypeAst.kind !== "identifierType" &&
      concreteTypeAst.kind !== "qualifiedIdentifierType"
    ) {
      return undefined;
    }
    const members = concreteTypeAst.typeArguments?.map(
      tryConvertSurfaceTypeAstToIrType
    );
    if (
      !members ||
      members.length < 2 ||
      members.some((member) => member === undefined)
    ) {
      return undefined;
    }
    return {
      kind: "unionType",
      types: members as readonly IrType[],
      runtimeUnionLayout: "carrierSlotOrder",
    };
  }

  const surfaceType = tryConvertSurfaceTypeAstToIrType(concreteTypeAst);
  return hasExplicitRuntimeCarrierIdentity(surfaceType, context)
    ? surfaceType
    : undefined;
};

const tryResolveRuntimeUnionFactoryTypeAst = (
  valueAst: CSharpExpressionAst
): CSharpTypeAst | undefined => {
  const directAst = unwrapTransparentValueAst(valueAst);

  if (directAst.kind === "throwExpression") {
    return undefined;
  }

  if (
    directAst.kind === "invocationExpression" &&
    directAst.expression.kind === "memberAccessExpression" &&
    /^From[1-9][0-9]*$/.test(directAst.expression.memberName) &&
    directAst.expression.expression.kind === "typeReferenceExpression"
  ) {
    return directAst.expression.expression.type;
  }

  if (directAst.kind !== "conditionalExpression") {
    return undefined;
  }

  const whenTrueType = tryResolveRuntimeUnionFactoryTypeAst(directAst.whenTrue);
  const whenFalseType = tryResolveRuntimeUnionFactoryTypeAst(
    directAst.whenFalse
  );
  if (!whenTrueType) {
    return whenFalseType;
  }
  if (!whenFalseType) {
    return whenTrueType;
  }
  return sameTypeAstSurface(whenTrueType, whenFalseType)
    ? whenTrueType
    : undefined;
};

const tryResolveExplicitRuntimeUnionSurfaceType = (
  valueAst: CSharpExpressionAst,
  context: EmitterContext
): IrType | undefined => {
  const directAst = unwrapTransparentValueAst(valueAst);
  const factoryTypeAst = tryResolveRuntimeUnionFactoryTypeAst(directAst);
  if (factoryTypeAst) {
    return tryResolveRuntimeUnionSurfaceTypeAst(factoryTypeAst, context);
  }

  if (
    directAst.kind === "castExpression" ||
    directAst.kind === "asExpression"
  ) {
    return tryResolveRuntimeUnionSurfaceTypeAst(directAst.type, context);
  }

  if (
    directAst.kind === "invocationExpression" &&
    directAst.expression.kind === "memberAccessExpression" &&
    directAst.expression.memberName === "Match"
  ) {
    const [resultTypeAst] = directAst.typeArguments ?? [];
    return resultTypeAst
      ? tryResolveRuntimeUnionSurfaceTypeAst(resultTypeAst, context)
      : undefined;
  }

  return undefined;
};

const tryResolveExplicitGenericInvocationResultType = (
  valueAst: CSharpExpressionAst
): IrType | undefined => {
  const directAst = unwrapTransparentValueAst(valueAst);
  if (
    directAst.kind !== "invocationExpression" ||
    directAst.expression.kind !== "memberAccessExpression"
  ) {
    return undefined;
  }

  const [resultTypeAst] = directAst.typeArguments ?? [];
  if (!resultTypeAst) {
    return undefined;
  }

  switch (directAst.expression.memberName) {
    case "Match":
      return tryConvertSurfaceTypeAstToIrType(resultTypeAst);
    case "ReadOptionalObject":
    case "ReadOptionalReference":
    case "ReadOptionalValue": {
      const resultType = tryConvertSurfaceTypeAstToIrType(resultTypeAst);
      return resultType ? withOptionalUndefined(resultType) : undefined;
    }
    default:
      return undefined;
  }
};

const tryResolveExplicitSurfaceType = (
  valueAst: CSharpExpressionAst
): IrType | undefined => {
  const directAst = unwrapTransparentValueAst(valueAst);
  return directAst.kind === "castExpression" ||
    directAst.kind === "asExpression"
    ? tryConvertSurfaceTypeAstToIrType(directAst.type)
    : undefined;
};

const withOptionalUndefined = (type: IrType): IrType => {
  if (
    type.kind === "unionType" &&
    type.types.some(
      (member) => member.kind === "primitiveType" && member.name === "undefined"
    )
  ) {
    return type;
  }

  return type.kind === "unionType"
    ? {
        ...type,
        types: [...type.types, { kind: "primitiveType", name: "undefined" }],
      }
    : {
        kind: "unionType",
        types: [type, { kind: "primitiveType", name: "undefined" }],
      };
};

const tryResolveDirectMemberAccessSurfaceType = (
  valueAst: CSharpExpressionAst,
  context: EmitterContext
): IrType | undefined => {
  const directAst = unwrapTransparentValueAst(valueAst);
  if (
    directAst.kind !== "memberAccessExpression" &&
    directAst.kind !== "conditionalMemberAccessExpression"
  ) {
    return undefined;
  }

  const receiverType = preferRuntimeCarrierCandidate(
    context,
    resolveDirectRuntimeCarrierType(directAst.expression, context),
    resolveDirectValueSurfaceType(directAst.expression, context)
  );
  if (!receiverType) {
    return undefined;
  }

  const memberType = resolveEmittedPropertySurfaceType(
    receiverType,
    directAst.memberName,
    context
  );
  if (!memberType) {
    return undefined;
  }

  return directAst.kind === "conditionalMemberAccessExpression"
    ? withOptionalUndefined(memberType)
    : memberType;
};

const resolveEmittedPropertySurfaceType = (
  receiverType: IrType,
  emittedMemberName: string,
  context: EmitterContext
): IrType | undefined => {
  const direct = getPropertyType(receiverType, emittedMemberName, context);
  if (direct) {
    return direct;
  }

  const resolvedReceiver = resolveTypeAlias(
    stripNullish(receiverType),
    context
  );
  if (resolvedReceiver.kind !== "referenceType") {
    return undefined;
  }

  const localInfo = resolveLocalTypeInfo(resolvedReceiver, context)?.info;
  if (localInfo?.kind !== "class" && localInfo?.kind !== "interface") {
    return undefined;
  }

  for (const member of localInfo.members) {
    if (
      (member.kind === "propertyDeclaration" ||
        member.kind === "propertySignature") &&
      member.type &&
      emitCSharpName(member.name, "properties", context) === emittedMemberName
    ) {
      return member.type;
    }
  }

  return undefined;
};

const resolveNamedRuntimeCarrierType = (
  name: string,
  context: EmitterContext
): IrType | undefined => {
  const localSemanticType = context.localSemanticTypes?.get(name);
  const localStorageType = context.localValueTypes?.get(name);
  const narrowed = context.narrowedBindings?.get(name);

  if (!narrowed) {
    return preferRuntimeCarrierCandidate(
      context,
      localStorageType,
      localSemanticType
    );
  }

  switch (narrowed.kind) {
    case "expr":
      return narrowed.carrierExprAst
        ? preferRuntimeCarrierCandidate(
            context,
            narrowed.carrierType,
            narrowed.sourceType,
            localSemanticType,
            narrowed.type,
            narrowed.storageType,
            localStorageType
          )
        : preferRuntimeCarrierCandidate(
            context,
            narrowed.sourceType,
            localSemanticType,
            narrowed.type,
            narrowed.storageType,
            localStorageType
          );
    case "runtimeSubset":
      return preferRuntimeCarrierCandidate(
        context,
        narrowed.sourceType,
        localSemanticType,
        narrowed.type,
        localStorageType
      );
    case "rename":
      return preferRuntimeCarrierCandidate(
        context,
        narrowed.sourceType,
        localSemanticType,
        narrowed.type,
        localStorageType
      );
  }
};

const resolveProjectionReceiverRuntimeCarrierType = (
  valueAst: CSharpExpressionAst,
  context: EmitterContext
): IrType | undefined => {
  const directAst = unwrapTransparentValueAst(valueAst);
  if (directAst.kind !== "identifierExpression") {
    return resolveDirectRuntimeCarrierType(directAst, context);
  }

  const identifierBinding = resolveDirectIdentifierBinding(
    directAst.identifier,
    context
  );
  if (!identifierBinding) {
    return undefined;
  }

  const localStorageType = context.localValueTypes?.get(
    identifierBinding.sourceName
  );
  const localSemanticType = context.localSemanticTypes?.get(
    identifierBinding.sourceName
  );
  const narrowed = context.narrowedBindings?.get(identifierBinding.sourceName);
  if (narrowed?.kind !== "expr") {
    return preferRuntimeCarrierCandidate(
      context,
      localStorageType,
      localSemanticType,
      resolveNamedRuntimeCarrierType(identifierBinding.sourceName, context)
    );
  }

  return preferRuntimeCarrierCandidate(
    context,
    localStorageType,
    localSemanticType,
    narrowed.carrierType,
    narrowed.sourceType,
    narrowed.storageType,
    narrowed.type
  );
};

const resolveCanonicalNarrowedMemberType = (
  type: IrType | undefined,
  sourceType: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!type || !sourceType) {
    return type;
  }

  if (type.kind === "referenceType" && type.name !== "object") {
    return type;
  }

  const sourceMembers = getCanonicalRuntimeUnionMembers(sourceType, context);
  if (!sourceMembers) {
    return type;
  }

  const exactMatches = findExactRuntimeUnionMemberIndices(
    sourceMembers,
    type,
    context
  );
  const matches =
    exactMatches.length === 1
      ? exactMatches
      : findRuntimeUnionMemberIndices(sourceMembers, type, context);
  if (matches.length !== 1) {
    return type;
  }

  const [memberIndex] = matches;
  return memberIndex !== undefined
    ? (sourceMembers[memberIndex] ?? type)
    : type;
};

export const resolveDirectValueSurfaceType = (
  valueAst: CSharpExpressionAst,
  context: EmitterContext
): IrType | undefined => {
  const directAst = unwrapTransparentValueAst(valueAst);
  if (directAst.kind !== "identifierExpression") {
    return (
      (directAst.kind === "qualifiedIdentifierExpression"
        ? resolveStaticValueSymbolSurfaceType(
            qualifiedIdentifierExpressionName(directAst) ?? "",
            context
          )
        : undefined) ??
      resolveQualifiedImportedValueSurfaceType(directAst, context) ??
      tryResolveExplicitRuntimeUnionSurfaceType(directAst, context) ??
      tryResolveExplicitGenericInvocationResultType(directAst) ??
      tryResolveExplicitSurfaceType(directAst) ??
      tryResolveRuntimeUnionAsMemberType(directAst, context) ??
      tryResolveDirectMemberAccessSurfaceType(directAst, context)
    );
  }

  const originalName = resolveDirectIdentifierName(
    directAst.identifier,
    context
  );
  if (!originalName) {
    return resolveStaticValueSymbolSurfaceType(directAst.identifier, context);
  }

  const narrowed = context.narrowedBindings?.get(originalName);
  if (narrowed?.kind === "expr" || narrowed?.kind === "runtimeSubset") {
    const localValueType = context.localValueTypes?.get(originalName);
    const storageType =
      narrowed.kind === "expr" ? narrowed.storageType : undefined;
    return (
      resolveCanonicalNarrowedMemberType(
        narrowed.type,
        narrowed.sourceType,
        context
      ) ??
      narrowed.type ??
      storageType ??
      localValueType ??
      narrowed.sourceType
    );
  }

  if (narrowed?.kind === "rename") {
    const localValueType = context.localValueTypes?.get(originalName);
    return (
      resolveCanonicalNarrowedMemberType(
        narrowed.type,
        narrowed.sourceType,
        context
      ) ??
      narrowed.type ??
      localValueType ??
      narrowed.sourceType
    );
  }

  return (
    context.localValueTypes?.get(originalName) ??
    context.localSemanticTypes?.get(originalName) ??
    resolveStaticValueSymbolSurfaceType(directAst.identifier, context)
  );
};

export const resolveDirectRuntimeCarrierType = (
  valueAst: CSharpExpressionAst,
  context: EmitterContext
): IrType | undefined => {
  const directAst = unwrapTransparentValueAst(valueAst);
  if (directAst.kind !== "identifierExpression") {
    const explicitSurfaceType = tryResolveExplicitRuntimeUnionSurfaceType(
      directAst,
      context
    );
    if (hasExplicitRuntimeCarrierIdentity(explicitSurfaceType, context)) {
      return explicitSurfaceType;
    }

    const materializedMemberType = tryResolveRuntimeUnionAsMemberType(
      directAst,
      context
    );
    return hasExplicitRuntimeCarrierIdentity(materializedMemberType, context)
      ? materializedMemberType
      : undefined;
  }

  const identifierBinding = resolveDirectIdentifierBinding(
    directAst.identifier,
    context
  );
  if (!identifierBinding) {
    return undefined;
  }

  if (identifierBinding.isNarrowedRenameIdentifier) {
    const narrowed = context.narrowedBindings?.get(
      identifierBinding.sourceName
    );
    return hasExplicitRuntimeCarrierIdentity(narrowed?.type, context)
      ? narrowed?.type
      : undefined;
  }

  return resolveNamedRuntimeCarrierType(identifierBinding.sourceName, context);
};

export const resolveIdentifierValueSurfaceType = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  context: EmitterContext
): IrType | undefined => {
  const localValueType = context.localValueTypes?.get(expr.name);
  const narrowed = context.narrowedBindings?.get(expr.name);
  if (narrowed?.kind === "expr") {
    return (
      narrowed.type ??
      narrowed.storageType ??
      localValueType ??
      narrowed.sourceType
    );
  }

  if (narrowed?.kind === "runtimeSubset") {
    return narrowed.type ?? localValueType ?? narrowed.sourceType;
  }

  const importBinding = context.importBindings?.get(expr.name);
  if (importBinding?.kind === "value" && importBinding.valueType) {
    return importBinding.valueType;
  }

  return localValueType ?? context.valueSymbols?.get(expr.name)?.valueType;
};
