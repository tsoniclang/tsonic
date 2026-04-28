import type { IrExpression, IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import type { CSharpExpressionAst } from "../format/backend-ast/types.js";
import { getRuntimeUnionReferenceMembers } from "./runtime-union-shared.js";
import { getCanonicalRuntimeUnionMembers } from "./runtime-unions.js";
import { getPropertyType, resolveTypeAlias } from "./type-resolution.js";

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
    resolved.runtimeCarrierFamilyKey !== undefined
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

  const receiverCarrierType = preferRuntimeCarrierCandidate(
    context,
    resolveDirectRuntimeCarrierType(directAst.expression.expression, context),
    resolveDirectValueSurfaceType(directAst.expression.expression, context)
  );
  if (!receiverCarrierType) {
    return undefined;
  }

  const runtimeMembers = getCanonicalRuntimeUnionMembers(
    receiverCarrierType,
    context
  );
  return runtimeMembers?.[memberIndex];
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

export const resolveDirectValueSurfaceType = (
  valueAst: CSharpExpressionAst,
  context: EmitterContext
): IrType | undefined => {
  const directAst = unwrapTransparentValueAst(valueAst);
  if (directAst.kind !== "identifierExpression") {
    return (
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
    return narrowed.type ?? narrowed.sourceType;
  }

  if (narrowed?.kind === "rename") {
    return narrowed.type ?? narrowed.sourceType;
  }

  return context.localValueTypes?.get(originalName);
};

export const resolveDirectRuntimeCarrierType = (
  valueAst: CSharpExpressionAst,
  context: EmitterContext
): IrType | undefined => {
  const directAst = unwrapTransparentValueAst(valueAst);
  if (directAst.kind !== "identifierExpression") {
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
