/**
 * Member access type helpers and member name resolution.
 * Handles type proof checks, member name emission, static type references,
 * property membership from bindings registry, and plain object type checks.
 */

import { IrExpression, type IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import {
  resolveTypeAlias,
  stripNullish,
  hasDeterministicPropertyMembership,
  resolveLocalTypeInfo,
} from "../core/semantic/type-resolution.js";
import { emitCSharpName } from "../naming-policy.js";
import { stringLiteral } from "../core/format/backend-ast/builders.js";
import {
  lookupLocalTypeMemberKind,
  resolveTypeMemberKind,
  typeMemberKindToBucket,
} from "../core/semantic/member-surfaces.js";
import { stripNullableTypeAst } from "../core/format/backend-ast/utils.js";
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

export type MemberAccessUsage = "value" | "call" | "write";

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
