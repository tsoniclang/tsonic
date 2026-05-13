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
  getCanonicalRuntimeUnionMembers,
} from "./runtime-unions.js";
import {
  isRuntimeUnionTypeAst,
} from "./runtime-reification-helpers.js";
import { getPropertyType, resolveTypeAlias } from "./type-resolution.js";
import { stripNullableTypeAst } from "../format/backend-ast/utils.js";

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
    ) ?? resolveDirectValueSurfaceType(directAst.expression.expression, context);
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
      const resolvedClrType = `${
        concreteTypeAst.name.aliasQualifier
          ? `${concreteTypeAst.name.aliasQualifier}::`
          : ""
      }${concreteTypeAst.name.segments.join(".")}`;
      const name =
        concreteTypeAst.name.segments[
          concreteTypeAst.name.segments.length - 1
        ] ?? resolvedClrType;
      return {
        kind: "referenceType",
        name,
        resolvedClrType,
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

const tryResolveExplicitRuntimeUnionSurfaceType = (
  valueAst: CSharpExpressionAst,
  context: EmitterContext
): IrType | undefined => {
  const directAst = unwrapTransparentValueAst(valueAst);
  if (directAst.kind === "castExpression" || directAst.kind === "asExpression") {
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

  const memberType = getPropertyType(
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
  return memberIndex !== undefined ? (sourceMembers[memberIndex] ?? type) : type;
};

export const resolveDirectValueSurfaceType = (
  valueAst: CSharpExpressionAst,
  context: EmitterContext
): IrType | undefined => {
  const directAst = unwrapTransparentValueAst(valueAst);
  if (directAst.kind !== "identifierExpression") {
    return (
      tryResolveExplicitRuntimeUnionSurfaceType(directAst, context) ??
      tryResolveRuntimeUnionAsMemberType(directAst, context) ??
      tryResolveDirectMemberAccessSurfaceType(directAst, context)
    );
  }

  const originalName = resolveDirectIdentifierName(
    directAst.identifier,
    context
  );
  if (!originalName) {
    return undefined;
  }

  const narrowed = context.narrowedBindings?.get(originalName);
  if (narrowed?.kind === "expr" || narrowed?.kind === "runtimeSubset") {
    return (
      resolveCanonicalNarrowedMemberType(
        narrowed.type,
        narrowed.sourceType,
        context
      ) ?? narrowed.sourceType
    );
  }

  if (narrowed?.kind === "rename") {
    return (
      resolveCanonicalNarrowedMemberType(
        narrowed.type,
        narrowed.sourceType,
        context
      ) ?? narrowed.sourceType
    );
  }

  return context.localValueTypes?.get(originalName);
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
  const narrowed = context.narrowedBindings?.get(expr.name);
  if (narrowed?.kind === "expr") {
    return narrowed.type ?? narrowed.sourceType;
  }

  if (narrowed?.kind === "runtimeSubset") {
    return narrowed.type ?? narrowed.sourceType;
  }

  return context.localValueTypes?.get(expr.name);
};
