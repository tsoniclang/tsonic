/**
 * Member access property type resolution and name extraction helpers
 *
 * ALICE'S SPEC: All member type queries go through TypeSystem.typeOfMember().
 */

import * as ts from "typescript";
import {
  IrType,
  ComputedAccessKind,
  ComputedAccessProtocol,
} from "../../../types.js";
import type { ProgramContext } from "../../../program-context.js";
import type { BindingInternal } from "../../../binding/index.js";
import { getNumericKindFromIrType } from "../../../type-system/inference-utilities.js";

const memberHasExplicitUnknownAnnotation = (
  node: ts.PropertyAccessExpression,
  ctx: ProgramContext
): boolean => {
  const memberId = ctx.binding.resolvePropertyAccess(node);
  if (!memberId) {
    return false;
  }

  const memberInfo = (ctx.binding as BindingInternal)
    ._getHandleRegistry()
    .getMember(memberId);
  const typeNode = memberInfo?.typeNode;
  return (
    !!typeNode &&
    typeof typeNode === "object" &&
    "kind" in typeNode &&
    typeNode.kind === ts.SyntaxKind.UnknownKeyword
  );
};

export const hasDeclaredMemberByName = (
  receiverIrType: IrType | undefined,
  propertyName: string,
  ctx: ProgramContext
): boolean => {
  if (!receiverIrType || receiverIrType.kind === "unknownType") return false;

  if (receiverIrType.kind === "dictionaryType") {
    return true;
  }

  if (receiverIrType.kind === "objectType") {
    return receiverIrType.members.some(
      (member) => member.name === propertyName
    );
  }

  if (
    receiverIrType.kind === "referenceType" &&
    receiverIrType.structuralMembers &&
    receiverIrType.structuralMembers.length > 0
  ) {
    return receiverIrType.structuralMembers.some(
      (member) => member.name === propertyName
    );
  }

  if (receiverIrType.kind === "referenceType") {
    const indexer = ctx.typeSystem.getIndexerInfo(receiverIrType);
    return (
      indexer !== undefined && isDictionaryKeyTypeName(indexer.keyClrType)
    );
  }

  return false;
};

/**
 * Get the declared property type from a property access expression.
 *
 * ALICE'S SPEC: Uses explicit TypeSystem queries only.
 * Prefer exact member-handle typing when Binding resolved the property access to a
 * concrete declaration; otherwise use receiver+member TypeSystem lookup.
 *
 * @param node - Property access expression node
 * @param receiverIrType - Already-computed IR type of the receiver (object) expression
 * @param ctx - ProgramContext for type system and binding access
 * @returns The deterministically computed property type
 */
export const getDeclaredPropertyType = (
  node: ts.PropertyAccessExpression,
  receiverIrType: IrType | undefined,
  ctx: ProgramContext
): IrType | undefined => {
  const DEBUG = process.env.DEBUG_PROPERTY_TYPE === "1";
  const propertyName = node.name.text;

  if (DEBUG) {
    console.log(
      "[getDeclaredPropertyType]",
      propertyName,
      "on receiver:",
      receiverIrType
    );
  }

  const typeSystem = ctx.typeSystem;
  const memberId = ctx.binding.resolvePropertyAccess(node);
  if (memberId) {
    const exactMemberType = typeSystem.typeOfMemberId(memberId, receiverIrType);
    if (DEBUG) {
      console.log(
        "[getDeclaredPropertyType]",
        propertyName,
        "TypeSystem memberId returned:",
        exactMemberType
      );
    }
    if (exactMemberType.kind !== "unknownType") {
      return exactMemberType;
    }
    if (memberHasExplicitUnknownAnnotation(node, ctx)) {
      return exactMemberType;
    }
  }

  if (receiverIrType && receiverIrType.kind !== "unknownType") {
    const memberType = typeSystem.typeOfMember(receiverIrType, {
      kind: "byName",
      name: propertyName,
    });
    if (DEBUG) {
      console.log(
        "[getDeclaredPropertyType]",
        propertyName,
        "TypeSystem returned:",
        memberType
      );
    }
    // If TypeSystem returned a valid type (not unknownType), use it
    if (memberType.kind !== "unknownType") {
      return memberType;
    }
    if (hasDeclaredMemberByName(receiverIrType, propertyName, ctx)) {
      return memberType;
    }
  }
  return undefined;
};

/**
 * Normalize a receiver type for computed access classification.
 *
 * This supports common TS shapes that appear at runtime:
 * - Nullish unions (`T | undefined` / `T | null | undefined`)
 * - tsbindgen-style intersection views (`T$instance & __T$views`, and primitives like
 *   `string & String$instance & __String$views`)
 *
 * The goal is to preserve deterministic proof behavior without heuristics.
 */
export const normalizeForComputedAccess = (
  type: IrType | undefined
): IrType | undefined => {
  if (!type) return undefined;

  if (type.kind === "unionType") {
    const nonNullish = type.types.filter(
      (t) =>
        !(
          t.kind === "primitiveType" &&
          (t.name === "null" || t.name === "undefined")
        )
    );
    if (nonNullish.length === 1) {
      const only = nonNullish[0];
      return only ? normalizeForComputedAccess(only) : undefined;
    }
  }

  if (type.kind === "intersectionType") {
    const pick =
      type.types.find((t) => t.kind === "arrayType") ??
      type.types.find((t) => t.kind === "dictionaryType") ??
      type.types.find(
        (t) => t.kind === "primitiveType" && t.name === "string"
      ) ??
      type.types.find((t) => t.kind === "referenceType");

    return pick ? normalizeForComputedAccess(pick) : type;
  }

  return type;
};

const isNumericIndexerKeyTypeName = (keyTypeName: string): boolean =>
  new Set([
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
    "System.SByte",
    "System.Byte",
    "System.Int16",
    "System.UInt16",
    "System.Int32",
    "System.UInt32",
    "System.Int64",
    "System.UInt64",
    "System.IntPtr",
    "System.UIntPtr",
    "System.Int128",
    "System.UInt128",
    "System.Half",
    "System.Single",
    "System.Double",
    "System.Decimal",
  ]).has(keyTypeName);

const isDictionaryKeyTypeName = (keyTypeName: string): boolean =>
  new Set([
    "string",
    "object",
    "unknown",
    "System.String",
    "System.Object",
  ]).has(keyTypeName);

const INT_IR_TYPE: IrType = { kind: "primitiveType", name: "int" };

const getCallableSignatures = (
  type: IrType | undefined
): readonly Extract<IrType, { kind: "functionType" }>[] => {
  if (!type) {
    return [];
  }

  if (type.kind === "functionType") {
    return [type];
  }

  if (type.kind === "intersectionType") {
    return type.types.filter(
      (member): member is Extract<IrType, { kind: "functionType" }> =>
        member.kind === "functionType"
    );
  }

  return [];
};

const stripUndefinedFromType = (type: IrType): IrType => {
  if (type.kind !== "unionType") {
    return type;
  }

  const nonUndefined = type.types.filter(
    (member) =>
      !(member.kind === "primitiveType" && member.name === "undefined")
  );

  if (nonUndefined.length === 1 && nonUndefined[0]) {
    return nonUndefined[0];
  }

  return {
    kind: "unionType",
    types: nonUndefined,
  };
};

const hasGetterProtocol = (
  objectType: IrType,
  indexerValueType: IrType,
  ctx: ProgramContext
): boolean => {
  const memberType = ctx.typeSystem.tryTypeOfMember(objectType, {
    kind: "byName",
    name: "at",
  });

  return getCallableSignatures(memberType).some((signature) => {
    const [indexParam] = signature.parameters;
    if (!indexParam?.type) {
      return false;
    }

    if (!ctx.typeSystem.isAssignableTo(INT_IR_TYPE, indexParam.type)) {
      return false;
    }

    const returnType = stripUndefinedFromType(signature.returnType);
    const getterReturnNumericKind = getNumericKindFromIrType(returnType);
    const indexerValueNumericKind = getNumericKindFromIrType(indexerValueType);
    return (
      ctx.typeSystem.isAssignableTo(indexerValueType, returnType) ||
      ctx.typeSystem.typesEqual(indexerValueType, returnType) ||
      (getterReturnNumericKind !== undefined &&
        indexerValueNumericKind !== undefined)
    );
  });
};

const hasSetterProtocol = (
  objectType: IrType,
  indexerValueType: IrType,
  ctx: ProgramContext
): boolean => {
  const memberType = ctx.typeSystem.tryTypeOfMember(objectType, {
    kind: "byName",
    name: "set",
  });

  return getCallableSignatures(memberType).some((signature) => {
    const [indexParam, valueParam] = signature.parameters;
    if (!indexParam?.type || !valueParam?.type) {
      return false;
    }

    if (!ctx.typeSystem.isAssignableTo(INT_IR_TYPE, indexParam.type)) {
      return false;
    }

    const setterValueNumericKind = getNumericKindFromIrType(valueParam.type);
    const indexerValueNumericKind = getNumericKindFromIrType(indexerValueType);

    return (
      ctx.typeSystem.isAssignableTo(indexerValueType, valueParam.type) ||
      ctx.typeSystem.isAssignableTo(valueParam.type, indexerValueType) ||
      ctx.typeSystem.typesEqual(indexerValueType, valueParam.type) ||
      (setterValueNumericKind !== undefined &&
        indexerValueNumericKind !== undefined)
    );
  });
};

export const resolveComputedAccessProtocol = (
  objectType: IrType | undefined,
  ctx: ProgramContext
): ComputedAccessProtocol | undefined => {
  const normalized = normalizeForComputedAccess(objectType);
  if (!normalized || normalized.kind !== "referenceType") {
    return undefined;
  }

  const indexer = ctx.typeSystem.getIndexerInfo(normalized);
  if (!indexer || !isNumericIndexerKeyTypeName(indexer.keyClrType)) {
    return undefined;
  }

  if (!hasGetterProtocol(normalized, indexer.valueType, ctx)) {
    return undefined;
  }

  return hasSetterProtocol(normalized, indexer.valueType, ctx)
    ? { getterMember: "at", setterMember: "set" }
    : { getterMember: "at" };
};

/**
 * Classify computed member access for proof pass.
 * This determines whether Int32 proof is required for the index.
 *
 * Classification is based on IR type kinds, NOT string matching.
 * CLR indexers (arrays, List<T>, etc.) require Int32 proof for indices.
 *
 * IMPORTANT: If classification cannot be determined reliably for a CLR-bound
 * reference type, we conservatively assume `clrIndexer` (requires Int32 proof).
 * This is safer than allowing arbitrary dictionary access without proof.
 *
 * @param objectType - The inferred type of the object being accessed
 * @returns The access kind classification
 */
export const classifyComputedAccess = (
  objectType: IrType | undefined,
  ctx: ProgramContext
): ComputedAccessKind => {
  const normalized = normalizeForComputedAccess(objectType);
  if (!normalized) return "unknown";
  objectType = normalized;

  // TypeScript array type (number[], T[], etc.)
  // Requires Int32 proof
  if (objectType.kind === "arrayType") {
    return "clrIndexer";
  }

  if (objectType.kind === "tupleType") {
    return "clrIndexer";
  }

  // IR dictionary type - this is the PRIMARY way to detect dictionaries
  // tsbindgen should emit dictionaryType for Record<K,V> and {[key: K]: V}
  if (objectType.kind === "dictionaryType") {
    return "dictionary";
  }

  // String character access: string[int]
  if (objectType.kind === "primitiveType" && objectType.name === "string") {
    return "stringChar";
  }

  if (objectType.kind === "referenceType") {
    const indexer = ctx.typeSystem.getIndexerInfo(objectType);
    if (!indexer) return "clrIndexer";
    return isNumericIndexerKeyTypeName(indexer.keyClrType)
      ? "clrIndexer"
      : "dictionary";
  }

  return "unknown";
};

/**
 * Extract the type name from an inferred type for binding lookup.
 * Handles tsbindgen's naming convention where instance types are suffixed with $instance
 * (e.g., List_1$instance → List_1 for binding lookup)
 *
 * Also handles intersection types like `TypeName$instance & __TypeName$views`
 * which are common in tsbindgen-generated types. In this case, we look for
 * the $instance member and extract the type name from it.
 */
export const extractTypeName = (
  inferredType: IrType | undefined
): string | undefined => {
  if (!inferredType) return undefined;

  // Handle common nullish unions like `Uri | undefined` by stripping null/undefined.
  // This enables CLR member binding after explicit null checks in source code.
  if (inferredType.kind === "unionType") {
    const nonNullish = inferredType.types.filter(
      (t) =>
        !(
          t.kind === "primitiveType" &&
          (t.name === "null" || t.name === "undefined")
        )
    );
    if (nonNullish.length === 1) {
      const only = nonNullish[0];
      return only ? extractTypeName(only) : undefined;
    }

    if (nonNullish.length > 1) {
      const extractedNames = nonNullish
        .map((part) => extractTypeName(part))
        .filter((name): name is string => typeof name === "string");

      if (extractedNames.length !== nonNullish.length) {
        return undefined;
      }

      const uniqueNames = [...new Set(extractedNames)];
      if (uniqueNames.length === 1) {
        return uniqueNames[0];
      }
    }
  }

  if (inferredType.kind === "primitiveType") {
    return undefined;
  }

  if (inferredType.kind === "literalType") {
    return undefined;
  }

  if (inferredType.kind === "referenceType") {
    const name = inferredType.name;

    // Strip $instance suffix from tsbindgen-generated type names
    // e.g., "List_1$instance" → "List_1" for binding lookup
    if (name.endsWith("$instance")) {
      return name.slice(0, -"$instance".length);
    }

    return name;
  }

  // Treat TS arrays as Array for binding lookup so surface packages can
  // bind Array<T> members declaratively (no compiler hardcoding).
  if (inferredType.kind === "arrayType") {
    return "Array";
  }

  // Treat tuples as Array for binding lookup as well. They lower to runtime
  // JS arrays for member resolution and must preserve the same Array surface.
  if (inferredType.kind === "tupleType") {
    return "Array";
  }

  // Handle intersection types: TypeName$instance & __TypeName$views
  // This happens when TypeScript expands a type alias to its underlying intersection
  // during property access (e.g., listener.prefixes returns HttpListenerPrefixCollection
  // which is HttpListenerPrefixCollection$instance & __HttpListenerPrefixCollection$views)
  if (inferredType.kind === "intersectionType") {
    // Look for a member that ends with $instance - that's the main type
    for (const member of inferredType.types) {
      if (
        member.kind === "referenceType" &&
        member.name.endsWith("$instance")
      ) {
        // Found the $instance member, strip the suffix to get the type name
        return member.name.slice(0, -"$instance".length);
      }
    }

    // Fallback: look for any referenceType that's not a $views type
    for (const member of inferredType.types) {
      if (
        member.kind === "referenceType" &&
        !member.name.startsWith("__") &&
        !member.name.endsWith("$views")
      ) {
        return member.name;
      }
    }
  }

  return undefined;
};

/**
 * Derive element type from object type for element access.
 * - Array type → element type
 * - Dictionary type → value type
 * - String → string (single character)
 * - Other → undefined
 */
export const deriveElementType = (
  objectType: IrType | undefined,
  ctx: ProgramContext,
  accessExpression?: ts.Expression
): IrType | undefined => {
  objectType = normalizeForComputedAccess(objectType);
  if (!objectType) return undefined;

  if (objectType.kind === "arrayType") {
    return objectType.elementType;
  }

  if (objectType.kind === "dictionaryType") {
    return objectType.valueType;
  }

  if (objectType.kind === "tupleType") {
    if (
      accessExpression &&
      ts.isNumericLiteral(accessExpression) &&
      Number.isInteger(Number(accessExpression.text))
    ) {
      const elementType = objectType.elementTypes[Number(accessExpression.text)];
      if (elementType) {
        return elementType;
      }
    }

    if (objectType.elementTypes.length === 0) {
      return undefined;
    }

    if (objectType.elementTypes.length === 1) {
      return objectType.elementTypes[0];
    }

    return {
      kind: "unionType",
      types: objectType.elementTypes,
    };
  }

  if (objectType.kind === "primitiveType" && objectType.name === "string") {
    // string[n] returns a single character (string in TS, char in C#)
    return { kind: "primitiveType", name: "string" };
  }

  if (
    objectType.kind === "referenceType" &&
    objectType.name === "Span" &&
    objectType.typeArguments &&
    objectType.typeArguments.length === 1
  ) {
    return objectType.typeArguments[0];
  }

  if (objectType.kind === "referenceType") {
    return ctx.typeSystem.getIndexerInfo(objectType)?.valueType;
  }

  return undefined;
};
