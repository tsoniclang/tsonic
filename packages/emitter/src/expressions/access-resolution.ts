/**
 * Member access resolution helpers — receiver type resolution,
 * member name emission, runtime-union member helpers, reification,
 * array wrapper element type emission, and binding-backed member resolution.
 */

import { IrExpression, type IrType } from "@tsonic/frontend";
import type { NarrowedBinding } from "../types.js";
import { EmitterContext } from "../types.js";
import { emitTypeAst } from "../type-emitter.js";
import {
  getArrayLikeElementType,
  getPropertyType,
  resolveTypeAlias,
  stripNullish,
  hasDeterministicPropertyMembership,
  normalizeStructuralEmissionType,
  resolveLocalTypeInfo,
  resolveArrayLikeReceiverType,
  resolveStructuralReferenceType,
} from "../core/semantic/type-resolution.js";
import { emitCSharpName } from "../naming-policy.js";
import {
  identifierType,
  stringLiteral,
} from "../core/format/backend-ast/builders.js";
import { stripNullableTypeAst } from "../core/format/backend-ast/utils.js";
import {
  lookupLocalTypeMemberKind,
  resolveTypeMemberKind,
  typeMemberKindToBucket,
} from "../core/semantic/member-surfaces.js";
import { getMemberAccessNarrowKey } from "../core/semantic/narrowing-keys.js";
import { getCanonicalRuntimeUnionMembers } from "../core/semantic/runtime-unions.js";
import { tryBuildRuntimeReificationPlan } from "../core/semantic/runtime-reification.js";
import { resolveEffectiveExpressionType } from "../core/semantic/narrowed-expression-types.js";
import { matchesExpectedEmissionType } from "../core/semantic/expected-type-matching.js";
import { normalizeRuntimeStorageType } from "../core/semantic/storage-types.js";
import { adaptStorageErasedValueAst } from "../core/semantic/storage-erased-adaptation.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";

// ============================================================================
// CONTRACT: Emitter ONLY consumes proof markers.
// ============================================================================

/**
 * Check if an expression has proven Int32 type from the numeric proof pass.
 */
export const hasInt32Proof = (expr: IrExpression): boolean => {
  if (
    expr.inferredType?.kind === "primitiveType" &&
    expr.inferredType.name === "int"
  ) {
    return true;
  }

  if (
    expr.inferredType?.kind === "referenceType" &&
    expr.inferredType.name === "int"
  ) {
    return true;
  }

  return false;
};

export type MemberAccessUsage = "value" | "call";

export const stripClrGenericArity = (typeName: string): string =>
  typeName.replace(/`\d+$/, "");

export const createStringLiteralExpression = (
  value: string
): CSharpExpressionAst => stringLiteral(value);

export const isObjectTypeAst = (typeAst: CSharpTypeAst): boolean => {
  const concrete = stripNullableTypeAst(typeAst);
  if (concrete.kind === "predefinedType") {
    return concrete.keyword === "object";
  }
  if (concrete.kind === "identifierType") {
    const normalized = concrete.name.replace(/^global::/, "");
    return normalized === "object" || normalized === "System.Object";
  }
  if (concrete.kind === "qualifiedIdentifierType") {
    const qualifier = concrete.name.aliasQualifier
      ? `${concrete.name.aliasQualifier}::`
      : "";
    const printed = `${qualifier}${concrete.name.segments.join(".")}`.replace(
      /^global::/,
      ""
    );
    return printed === "System.Object";
  }
  return false;
};

export const isPlainObjectIrType = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) return false;
  const resolved = resolveTypeAlias(stripNullish(type), context);
  return resolved.kind === "referenceType" && resolved.name === "object";
};

const looksLikeTypeParameterName = (name: string): boolean =>
  /^T($|[A-Z0-9_])/.test(name);

export const eraseOutOfScopeArrayWrapperTypeParameters = (
  typeAst: CSharpTypeAst,
  context: EmitterContext
): CSharpTypeAst => {
  switch (typeAst.kind) {
    case "identifierType": {
      if (
        !typeAst.name.includes(".") &&
        !typeAst.name.includes("::") &&
        (context.typeParameters?.has(typeAst.name) ?? false) === false &&
        looksLikeTypeParameterName(typeAst.name)
      ) {
        return identifierType("object");
      }

      if (!typeAst.typeArguments || typeAst.typeArguments.length === 0) {
        return typeAst;
      }

      return {
        ...typeAst,
        typeArguments: typeAst.typeArguments.map((arg) =>
          eraseOutOfScopeArrayWrapperTypeParameters(arg, context)
        ),
      };
    }

    case "arrayType":
      return {
        ...typeAst,
        elementType: eraseOutOfScopeArrayWrapperTypeParameters(
          typeAst.elementType,
          context
        ),
      };

    case "nullableType":
      return {
        ...typeAst,
        underlyingType: eraseOutOfScopeArrayWrapperTypeParameters(
          typeAst.underlyingType,
          context
        ),
      };

    default:
      return typeAst;
  }
};

export const emitArrayWrapperElementTypeAst = (
  receiverType: IrType | undefined,
  fallbackElementType: IrType,
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
  const storageReceiverType = normalizeRuntimeStorageType(
    receiverType,
    context
  );
  const resolvedReceiverType = resolveArrayLikeReceiverType(
    storageReceiverType,
    context
  );

  if (resolvedReceiverType) {
    const [elementTypeAst, nextContext] = emitTypeAst(
      resolvedReceiverType.elementType,
      context
    );
    return [
      eraseOutOfScopeArrayWrapperTypeParameters(elementTypeAst, nextContext),
      nextContext,
    ];
  }

  const [elementTypeAst, nextContext] = emitTypeAst(
    fallbackElementType,
    context
  );
  return [
    eraseOutOfScopeArrayWrapperTypeParameters(elementTypeAst, nextContext),
    nextContext,
  ];
};

export const emitStorageCompatibleArrayWrapperElementTypeAst = (
  receiverExpr: IrExpression,
  receiverType: IrType | undefined,
  fallbackElementType: IrType,
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
  const [storageReceiverTypeAst, storageContext] =
    resolveEmittedReceiverTypeAst(receiverExpr, context);
  const concreteStorageReceiverTypeAst = storageReceiverTypeAst
    ? stripNullableTypeAst(storageReceiverTypeAst)
    : undefined;

  if (concreteStorageReceiverTypeAst?.kind === "arrayType") {
    return [
      eraseOutOfScopeArrayWrapperTypeParameters(
        concreteStorageReceiverTypeAst.elementType,
        storageContext
      ),
      storageContext,
    ];
  }

  if (
    concreteStorageReceiverTypeAst?.kind === "identifierType" &&
    (concreteStorageReceiverTypeAst.name === "global::System.Array" ||
      concreteStorageReceiverTypeAst.name === "System.Array") &&
    concreteStorageReceiverTypeAst.typeArguments?.length === 1
  ) {
    const [elementTypeAst] = concreteStorageReceiverTypeAst.typeArguments;
    if (elementTypeAst) {
      return [
        eraseOutOfScopeArrayWrapperTypeParameters(
          elementTypeAst,
          storageContext
        ),
        storageContext,
      ];
    }
  }

  return emitArrayWrapperElementTypeAst(
    receiverType,
    fallbackElementType,
    storageContext
  );
};

export const maybeReifyErasedArrayElement = (
  accessAst: CSharpExpressionAst,
  receiverExpr: IrExpression,
  desiredType: IrType | undefined,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const normalizedDesiredType =
    desiredType && desiredType.kind === "objectType"
      ? (resolveStructuralReferenceType(desiredType, context) ?? desiredType)
      : desiredType;

  if (
    !normalizedDesiredType ||
    isPlainObjectIrType(normalizedDesiredType, context)
  ) {
    return [accessAst, context];
  }

  const [receiverTypeAst, receiverTypeContext] = resolveEmittedReceiverTypeAst(
    receiverExpr,
    context
  );
  if (!receiverTypeAst) {
    return [accessAst, receiverTypeContext];
  }
  const concreteReceiverTypeAst = stripNullableTypeAst(receiverTypeAst);
  if (concreteReceiverTypeAst.kind !== "arrayType") {
    return [accessAst, receiverTypeContext];
  }
  const concreteElementTypeAst = stripNullableTypeAst(
    concreteReceiverTypeAst.elementType
  );
  if (!isObjectTypeAst(concreteElementTypeAst)) {
    return [accessAst, receiverTypeContext];
  }

  const plan = tryBuildRuntimeReificationPlan(
    accessAst,
    normalizedDesiredType,
    receiverTypeContext,
    emitTypeAst
  );
  if (!plan) {
    return [accessAst, receiverTypeContext];
  }

  return [plan.value, plan.context];
};

export const maybeReifyStorageErasedMemberRead = (
  accessAst: CSharpExpressionAst,
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] => {
  if (!expectedType || expr.isComputed || typeof expr.property !== "string") {
    return [accessAst, context];
  }

  const semanticType = resolveEffectiveExpressionType(expr, context);
  const storageType =
    normalizeRuntimeStorageType(
      getPropertyType(
        resolveEffectiveExpressionType(expr.object, context),
        expr.property,
        context
      ) ?? expr.inferredType,
      context
    ) ?? expr.inferredType;

  const adapted = adaptStorageErasedValueAst({
    valueAst: accessAst,
    semanticType,
    storageType,
    expectedType,
    context,
    emitTypeAst,
  });
  return adapted ?? [accessAst, context];
};

export const tryEmitStorageCompatibleNarrowedMemberRead = (
  narrowed: Extract<NarrowedBinding, { kind: "expr" }>,
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (
    !expectedType ||
    !narrowed.storageExprAst ||
    typeof expr.property !== "string"
  ) {
    return undefined;
  }

  const storageType =
    normalizeRuntimeStorageType(
      getPropertyType(
        resolveEffectiveExpressionType(expr.object, context),
        expr.property,
        context
      ) ?? expr.inferredType,
      context
    ) ?? expr.inferredType;

  if (
    !storageType ||
    !matchesExpectedEmissionType(storageType, expectedType, context)
  ) {
    return undefined;
  }

  return maybeReifyStorageErasedMemberRead(
    narrowed.storageExprAst,
    expr,
    context,
    expectedType
  );
};

export const hasPropertyFromBindingsRegistry = (
  type: Extract<IrType, { kind: "referenceType" }>,
  propertyName: string,
  context: EmitterContext
): boolean | undefined => {
  const registry = context.bindingsRegistry;
  if (!registry || registry.size === 0) return undefined;

  const candidates = new Set<string>();
  const addCandidate = (value: string | undefined): void => {
    if (!value) return;
    candidates.add(value);
    if (value.includes(".")) {
      const leaf = value.split(".").pop();
      if (leaf) candidates.add(leaf);
    }
  };

  addCandidate(type.name);
  addCandidate(type.typeId?.tsName);
  addCandidate(type.resolvedClrType);
  addCandidate(type.typeId?.clrName);

  for (const value of Array.from(candidates)) {
    if (value.endsWith("$instance")) {
      candidates.add(value.slice(0, -"$instance".length));
    }
    if (value.startsWith("__") && value.endsWith("$views")) {
      candidates.add(value.slice("__".length, -"$views".length));
    }
  }

  for (const key of candidates) {
    const binding = registry.get(key);
    if (!binding) continue;
    return binding.members.some(
      (member) =>
        member.kind === "property" &&
        (member.alias === propertyName ||
          member.name === propertyName ||
          member.binding.member === propertyName)
    );
  }

  return undefined;
};

const tryExtractRuntimeUnionMemberN = (
  exprAst: CSharpExpressionAst
): number | undefined => {
  const target =
    exprAst.kind === "parenthesizedExpression" ? exprAst.expression : exprAst;
  if (target.kind !== "invocationExpression" || target.arguments.length !== 0) {
    return undefined;
  }
  if (target.expression.kind !== "memberAccessExpression") {
    return undefined;
  }

  const match = target.expression.memberName.match(/^As(\d+)$/);
  if (!match?.[1]) {
    return undefined;
  }

  return Number.parseInt(match[1], 10);
};

const tryResolveEmittedRuntimeUnionMemberTypeAst = (
  baseType: IrType | undefined,
  exprAst: CSharpExpressionAst,
  context: EmitterContext
): [CSharpTypeAst | undefined, EmitterContext] => {
  if (!baseType) return [undefined, context];

  const memberN = tryExtractRuntimeUnionMemberN(exprAst);
  if (!memberN) return [undefined, context];

  const members = getCanonicalRuntimeUnionMembers(baseType, context);
  if (!members) {
    return [undefined, context];
  }

  const memberIndex = memberN - 1;
  if (memberIndex < 0 || memberIndex >= members.length) {
    return [undefined, context];
  }

  const memberType = members[memberIndex];
  if (!memberType) {
    return [undefined, context];
  }

  const storageMemberType =
    normalizeRuntimeStorageType(memberType, context) ?? memberType;
  return emitTypeAst(
    normalizeStructuralEmissionType(storageMemberType, context),
    context
  );
};

export const resolveEffectiveReceiverType = (
  receiverExpr: IrExpression,
  context: EmitterContext
): IrType | undefined => resolveEffectiveExpressionType(receiverExpr, context);

export const hasSourceDeclaredMember = (
  receiverType: IrType | undefined,
  memberName: string,
  usage: MemberAccessUsage,
  context: EmitterContext
): boolean => {
  if (!receiverType) {
    return false;
  }

  const resolved = resolveTypeAlias(stripNullish(receiverType), context);
  if (usage === "value") {
    if (resolved.kind === "objectType") {
      return resolved.members.some(
        (member) =>
          member.kind === "propertySignature" && member.name === memberName
      );
    }

    if (
      resolved.kind === "referenceType" &&
      hasDeterministicPropertyMembership(resolved, memberName, context) === true
    ) {
      return true;
    }
  }

  if (resolved.kind !== "referenceType") {
    return false;
  }

  if (
    resolved.structuralMembers?.some((member) => member.name === memberName)
  ) {
    return true;
  }

  const localInfo = resolveLocalTypeInfo(resolved, context)?.info;
  if (!localInfo) {
    return false;
  }

  switch (localInfo.kind) {
    case "class":
      return localInfo.members.some((member) =>
        usage === "call"
          ? member.kind === "methodDeclaration" && member.name === memberName
          : member.kind === "propertyDeclaration" && member.name === memberName
      );
    case "interface":
      return localInfo.members.some(
        (member) =>
          (usage === "call"
            ? member.kind === "methodSignature"
            : member.kind === "propertySignature") && member.name === memberName
      );
    default:
      return false;
  }
};

export const resolveEmittedReceiverTypeAst = (
  receiverExpr: IrExpression,
  context: EmitterContext
): [CSharpTypeAst | undefined, EmitterContext] => {
  const baseType = receiverExpr.inferredType;
  if (context.narrowedBindings) {
    const narrowKey =
      receiverExpr.kind === "identifier"
        ? receiverExpr.name
        : receiverExpr.kind === "memberAccess"
          ? getMemberAccessNarrowKey(receiverExpr)
          : undefined;

    if (narrowKey) {
      const narrowed = context.narrowedBindings.get(narrowKey);
      if (narrowed?.kind === "expr") {
        if (narrowed.type) {
          const storageNarrowedType =
            normalizeRuntimeStorageType(narrowed.type, context) ??
            narrowed.type;
          return emitTypeAst(
            normalizeStructuralEmissionType(storageNarrowedType, context),
            context
          );
        }

        const sourceType = narrowed.sourceType ?? baseType;
        const [memberTypeAst, memberContext] =
          tryResolveEmittedRuntimeUnionMemberTypeAst(
            sourceType,
            narrowed.exprAst,
            context
          );
        if (memberTypeAst) {
          return [memberTypeAst, memberContext];
        }
      }
    }
  }

  const receiverType = resolveEffectiveReceiverType(receiverExpr, context);
  if (!receiverType) {
    return [undefined, context];
  }

  const normalizedReceiverType =
    normalizeRuntimeStorageType(receiverType, context) ?? receiverType;
  const arrayLikeElementType = getArrayLikeElementType(
    normalizedReceiverType,
    context
  );
  if (arrayLikeElementType) {
    const [elementTypeAst, elementContext] = emitTypeAst(
      normalizeStructuralEmissionType(arrayLikeElementType, context),
      context
    );
    const storageCompatibleElementTypeAst =
      eraseOutOfScopeArrayWrapperTypeParameters(elementTypeAst, elementContext);
    return [
      {
        kind: "arrayType",
        elementType: storageCompatibleElementTypeAst,
        rank: 1,
      },
      elementContext,
    ];
  }

  return emitTypeAst(
    normalizeStructuralEmissionType(normalizedReceiverType, context),
    context
  );
};

export const emitMemberName = (
  receiverExpr: IrExpression,
  receiverType: IrType | undefined,
  memberName: string,
  context: EmitterContext,
  usage: MemberAccessUsage
): string => {
  if (usage === "call") {
    return emitCSharpName(memberName, "methods", context);
  }

  if (receiverExpr.kind === "identifier") {
    const binding = context.importBindings?.get(receiverExpr.name);
    if (binding?.kind === "namespace") {
      return emitCSharpName(memberName, "fields", context);
    }
  }

  const receiverBindingName =
    receiverExpr.kind === "identifier" ? receiverExpr.name : undefined;
  const fallbackLocalKind = receiverBindingName
    ? lookupLocalTypeMemberKind(receiverBindingName, memberName, context)
    : undefined;
  const memberKind =
    resolveTypeMemberKind(
      receiverType,
      memberName,
      context,
      receiverBindingName
    ) ?? fallbackLocalKind;
  if (memberKind) {
    return emitCSharpName(
      memberName,
      typeMemberKindToBucket(memberKind),
      context
    );
  }

  return emitCSharpName(memberName, "properties", context);
};

/**
 * Check if an expression represents a static type reference (not an instance)
 */
export const isStaticTypeReference = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  context: EmitterContext
): boolean => {
  if (expr.object.kind === "identifier") {
    const importBinding = context.importBindings?.get(expr.object.name);
    if (importBinding) return true;

    if (!expr.object.inferredType) return false;
  }

  const objectType = expr.object.inferredType;

  if (
    objectType?.kind === "referenceType" ||
    objectType?.kind === "arrayType" ||
    objectType?.kind === "intersectionType" ||
    objectType?.kind === "unionType" ||
    objectType?.kind === "primitiveType" ||
    objectType?.kind === "literalType" ||
    objectType?.kind === "typeParameterType" ||
    objectType?.kind === "unknownType"
  ) {
    return false;
  }

  return true;
};
