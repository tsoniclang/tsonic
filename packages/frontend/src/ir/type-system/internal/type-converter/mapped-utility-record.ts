/**
 * Record type expansion and type assignability helpers.
 *
 * Contains expandRecordType for expanding Record<K, T> to IrObjectType,
 * flattenUnionIrType, and isProvablyAssignable.
 */

import { TstsSyntax, type TstsNode } from "@tsonic/tsts";
import {
  IrType,
  IrObjectType,
  IrPropertySignature,
  IrInterfaceMember,
} from "../../../types.js";
import { irTypesEqual } from "../../../types/type-ops.js";
import type { Binding } from "../../../binding/index.js";
import {
  isTypeParameterNode,
  typeNodeContainsTypeParameter,
} from "./mapped-utility-expansion.js";

/**
 * Expand Record<K, T> to IrObjectType when K is a finite set of literal keys.
 *
 * DETERMINISTIC IR TYPING (INV-0 compliant):
 * Uses syntax-based analysis only. Extracts literal keys from the TSTS type node,
 * not from source-engine computed types.
 *
 * Gating conditions:
 * - Returns null if K contains type parameters (generic context)
 * - Returns null if K is string or number (should remain IrDictionaryType)
 * - Returns null if K contains non-literal types
 */
export const expandRecordType = (
  node: TstsNode,
  binding: Binding,
  convertType: (node: TstsNode, binding: Binding) => IrType
): IrObjectType | null => {
  const typeArgs = TstsSyntax.Node_TypeArguments(node) ?? [];
  if (typeArgs.length !== 2) {
    return null;
  }

  const keyTypeNode = typeArgs[0];
  const valueTypeNode = typeArgs[1];

  if (!keyTypeNode || !valueTypeNode) {
    return null;
  }

  // Check for type parameters in key (AST-based)
  if (typeNodeContainsTypeParameter(keyTypeNode, binding)) {
    return null;
  }

  // Check for type parameters in value (AST-based)
  if (typeNodeContainsTypeParameter(valueTypeNode, binding)) {
    return null;
  }

  // Try to extract finite literal keys (AST-based)
  const literalKeys = extractLiteralKeysFromTypeNode(keyTypeNode, binding);
  if (literalKeys === null || literalKeys.size === 0) {
    // Not a finite set of literals - use IrDictionaryType
    return null;
  }

  // Convert the value type
  const irValueType = convertType(valueTypeNode, binding);

  // Build IrObjectType with a property for each key
  // Prefix numeric keys with '_' to make them valid target identifiers
  const members: IrPropertySignature[] = Array.from(literalKeys).map((key) => ({
    kind: "propertySignature" as const,
    name: /^\d/.test(key) ? `_${key}` : key,
    type: irValueType,
    isOptional: false,
    isReadonly: false,
  }));

  return { kind: "objectType", members };
};

/**
 * Extract literal keys from a TypeNode (AST-based).
 * Returns null if the type contains non-literal constituents or is a type parameter.
 */
const extractLiteralKeysFromTypeNode = (
  node: TstsNode,
  binding: Binding
): Set<string> | null => {
  // Check for type parameter
  if (isTypeParameterNode(node, binding)) {
    return null;
  }

  // Handle string literal: "foo"
  if (TstsSyntax.IsLiteralTypeNode(node)) {
    const literal = TstsSyntax.AsLiteralTypeNode(node)?.Literal;
    if (literal?.Kind === TstsSyntax.KindStringLiteral) {
      const text = TstsSyntax.Node_Text(literal);
      return text !== undefined ? new Set([text]) : null;
    }
    if (literal?.Kind === TstsSyntax.KindNumericLiteral) {
      const text = TstsSyntax.Node_Text(literal);
      return text !== undefined ? new Set([text]) : null;
    }
  }

  // Handle union: "a" | "b" | "c"
  if (TstsSyntax.IsUnionTypeNode(node)) {
    const keys = new Set<string>();
    for (const member of TstsSyntax.AsUnionTypeNode(node)?.Types?.Nodes ?? []) {
      if (!member || !TstsSyntax.IsLiteralTypeNode(member)) {
        return null;
      }
      const literal = TstsSyntax.AsLiteralTypeNode(member)?.Literal;
      if (
        literal?.Kind !== TstsSyntax.KindStringLiteral &&
        literal?.Kind !== TstsSyntax.KindNumericLiteral
      ) {
        return null;
      }
      const text = TstsSyntax.Node_Text(literal);
      if (text === undefined) return null;
      keys.add(text);
    }
    return keys;
  }

  // String keyword - infinite set, can't expand
  if (node.Kind === TstsSyntax.KindStringKeyword) {
    return null;
  }

  // Number keyword - infinite set, can't expand
  if (node.Kind === TstsSyntax.KindNumberKeyword) {
    return null;
  }

  return null; // Not supported
};

type TriBool = true | false | null;

const structuralMembersOf = (
  type: IrType
): readonly IrInterfaceMember[] | undefined => {
  if (type.kind === "objectType") return type.members;
  if (type.kind === "referenceType") return type.structuralMembers;
  return undefined;
};

const structuralMemberType = (member: IrInterfaceMember): IrType | undefined =>
  member.kind === "propertySignature"
    ? member.type
    : member.returnType
      ? {
          kind: "functionType",
          parameters: member.parameters,
          returnType: member.returnType,
        }
      : undefined;

const isProvablyStructurallyAssignable = (
  source: IrType,
  target: IrType
): TriBool => {
  const sourceMembers = structuralMembersOf(source);
  const targetMembers = structuralMembersOf(target);
  if (!sourceMembers || !targetMembers) {
    return null;
  }

  let sawUnknown = false;
  for (const targetMember of targetMembers) {
    if (targetMember.kind !== "propertySignature") {
      sawUnknown = true;
      continue;
    }

    const sourceMember = sourceMembers.find(
      (candidate) => candidate.name === targetMember.name
    );
    if (!sourceMember) {
      if (targetMember.isOptional) {
        continue;
      }
      return false;
    }
    if (
      sourceMember.kind === "propertySignature" &&
      sourceMember.isOptional &&
      !targetMember.isOptional
    ) {
      return false;
    }

    const sourceMemberType = structuralMemberType(sourceMember);
    const targetMemberType = structuralMemberType(targetMember);
    if (!sourceMemberType || !targetMemberType) {
      sawUnknown = true;
      continue;
    }

    const memberAssignable = isProvablyAssignable(
      sourceMemberType,
      targetMemberType
    );
    if (memberAssignable === false) {
      return false;
    }
    if (memberAssignable === null) {
      sawUnknown = true;
    }
  }

  return sawUnknown ? null : true;
};

export const flattenUnionIrType = (type: IrType): readonly IrType[] => {
  if (type.kind === "neverType") return [];
  if (type.kind !== "unionType") return [type];

  const flat: IrType[] = [];
  for (const t of type.types) {
    flat.push(...flattenUnionIrType(t));
  }
  return flat;
};

export const isProvablyAssignable = (
  source: IrType,
  target: IrType
): TriBool => {
  if (irTypesEqual(source, target)) {
    return true;
  }

  // Union target: assignable if assignable to any constituent
  if (target.kind === "unionType") {
    let sawUnknown = false;
    for (const t of target.types) {
      const res = isProvablyAssignable(source, t);
      if (res === true) return true;
      if (res === null) sawUnknown = true;
    }
    return sawUnknown ? null : false;
  }

  // Top types
  if (target.kind === "anyType") return true;
  if (target.kind === "unknownType") return true;

  // Bottom
  if (target.kind === "neverType") return source.kind === "neverType";
  if (source.kind === "neverType") return true;

  // Exact literals
  if (source.kind === "literalType" && target.kind === "literalType") {
    return source.value === target.value;
  }

  // Primitive <-> primitive
  if (source.kind === "primitiveType" && target.kind === "primitiveType") {
    return source.name === target.name;
  }

  // Literal -> primitive
  if (source.kind === "literalType" && target.kind === "primitiveType") {
    switch (typeof source.value) {
      case "string":
        return target.name === "string";
      case "number":
        // Numeric literal types are always assignable to `number`.
        // Assignability to `int` is intentionally left unknown here (range-dependent).
        if (target.name === "number") return true;
        if (target.name === "int") return null;
        return false;
      case "boolean":
        return target.name === "boolean";
      default:
        return null;
    }
  }

  // Primitive -> literal is never provable (would require narrowing)
  if (source.kind === "primitiveType" && target.kind === "literalType") {
    return false;
  }

  const structuralAssignable = isProvablyStructurallyAssignable(source, target);
  if (structuralAssignable !== null) {
    return structuralAssignable;
  }

  // Other kinds (reference types, functions, objects, etc.) require richer typing.
  return null;
};
