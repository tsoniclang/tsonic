/**
 * Type operator helpers – keyof, indexed access, template literals,
 * and shared structural helpers used across the type converter.
 */

import type * as ts from "typescript";
import type {
  IrType,
  IrFunctionType,
  IrInterfaceMember,
} from "../../../types.js";
import {
  irTypesEqual,
  normalizedUnionType,
  stableIrTypeKeyIfDeterministic,
} from "../../../types/type-ops.js";
import type { Binding } from "../../../binding/index.js";

export const dedupeUnionMembers = (
  types: readonly IrType[]
): readonly IrType[] => {
  const seen = new Set<string>();
  const result: IrType[] = [];
  for (const type of types) {
    const key = stableIrTypeKeyIfDeterministic(type);
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    result.push(type);
  }
  return result;
};

export const toUnionOrSingle = (types: readonly IrType[]): IrType => {
  const deduped = dedupeUnionMembers(types);
  if (deduped.length === 0) return { kind: "unknownType" };
  return normalizedUnionType(deduped);
};

export const getMembersFromType = (
  type: IrType
): readonly IrInterfaceMember[] | undefined => {
  if (type.kind === "objectType") return type.members;
  if (type.kind === "referenceType" && type.structuralMembers) {
    return type.structuralMembers;
  }
  return undefined;
};

export const memberValueType = (member: IrInterfaceMember): IrType =>
  member.kind === "propertySignature"
    ? member.type
    : ({
        kind: "functionType",
        parameters: member.parameters,
        returnType: member.returnType ?? { kind: "voidType" },
      } as IrFunctionType);

export const typesSyntacticallyEqual = (left: IrType, right: IrType): boolean =>
  irTypesEqual(left, right);

export const resolveKeyofFromType = (type: IrType): IrType => {
  if (type.kind === "unionType") {
    // TS semantics for keyof unions are intersection-like; for deterministic AOT
    // lowering we conservatively use the union of keys from all members.
    const memberKeys = type.types.map((member) => resolveKeyofFromType(member));
    return toUnionOrSingle(memberKeys);
  }

  const members = getMembersFromType(type);
  if (members && members.length > 0) {
    return toUnionOrSingle(
      members.map((m) => ({ kind: "literalType", value: m.name }) as IrType)
    );
  }

  if (type.kind === "dictionaryType") {
    if (
      type.keyType.kind === "primitiveType" &&
      type.keyType.name === "string"
    ) {
      return toUnionOrSingle([
        { kind: "primitiveType", name: "string" },
        { kind: "primitiveType", name: "number" },
      ]);
    }
    return type.keyType;
  }

  if (type.kind === "arrayType" || type.kind === "tupleType") {
    return { kind: "primitiveType", name: "number" };
  }

  if (type.kind === "typeParameterType") {
    return toUnionOrSingle([
      { kind: "primitiveType", name: "string" },
      { kind: "primitiveType", name: "number" },
      { kind: "referenceType", name: "object" },
    ]);
  }

  return { kind: "unknownType" };
};

const lookupMemberTypeByKey = (
  type: IrType,
  key: string
): IrType | undefined => {
  if (type.kind === "tupleType") {
    const index = Number(key);
    if (
      Number.isInteger(index) &&
      index >= 0 &&
      index < type.elementTypes.length
    ) {
      const element = type.elementTypes[index];
      return element ?? undefined;
    }
    return undefined;
  }

  if (type.kind === "arrayType") {
    const index = Number(key);
    if (Number.isInteger(index)) return type.elementType;
    return undefined;
  }

  const members = getMembersFromType(type);
  if (!members || members.length === 0) return undefined;

  const hits = members.filter((m) => m.name === key).map(memberValueType);
  if (hits.length === 0) return undefined;
  return toUnionOrSingle(hits);
};

export const resolveIndexedAccessFromTypes = (
  objectType: IrType,
  indexType: IrType
): IrType => {
  if (objectType.kind === "unionType") {
    return toUnionOrSingle(
      objectType.types.map((member) =>
        resolveIndexedAccessFromTypes(member, indexType)
      )
    );
  }

  if (indexType.kind === "unionType") {
    return toUnionOrSingle(
      indexType.types.map((member) =>
        resolveIndexedAccessFromTypes(objectType, member)
      )
    );
  }

  if (indexType.kind === "literalType") {
    const key = String(indexType.value);
    const hit = lookupMemberTypeByKey(objectType, key);
    if (hit) return hit;

    if (objectType.kind === "dictionaryType") {
      return objectType.valueType;
    }

    if (
      objectType.kind === "arrayType" &&
      typeof indexType.value === "number"
    ) {
      return objectType.elementType;
    }

    if (
      objectType.kind === "tupleType" &&
      typeof indexType.value === "number"
    ) {
      const element = objectType.elementTypes[indexType.value];
      return element ?? { kind: "unknownType" };
    }

    return { kind: "unknownType" };
  }

  if (indexType.kind === "primitiveType") {
    if (
      objectType.kind === "dictionaryType" &&
      (indexType.name === "string" ||
        indexType.name === "number" ||
        indexType.name === "int")
    ) {
      return objectType.valueType;
    }
    if (
      objectType.kind === "arrayType" &&
      (indexType.name === "number" || indexType.name === "int")
    ) {
      return objectType.elementType;
    }
    if (
      objectType.kind === "tupleType" &&
      (indexType.name === "number" || indexType.name === "int")
    ) {
      return toUnionOrSingle(objectType.elementTypes);
    }
    const members = getMembersFromType(objectType);
    if (members && members.length > 0) {
      return toUnionOrSingle(members.map(memberValueType));
    }
    return { kind: "unknownType" };
  }

  if (
    indexType.kind === "typeParameterType" ||
    indexType.kind === "unknownType"
  ) {
    if (objectType.kind === "dictionaryType") {
      return objectType.valueType;
    }
    const members = getMembersFromType(objectType);
    if (members && members.length > 0) {
      return toUnionOrSingle(members.map(memberValueType));
    }
    return { kind: "unknownType" };
  }

  return { kind: "unknownType" };
};

const finiteTemplateTypeStrings = (
  type: IrType
): readonly string[] | undefined => {
  if (type.kind === "literalType") {
    return [String(type.value)];
  }
  if (type.kind === "unionType") {
    const all: string[] = [];
    for (const member of type.types) {
      const expanded = finiteTemplateTypeStrings(member);
      if (!expanded) return undefined;
      all.push(...expanded);
    }
    return all;
  }
  return undefined;
};

export const convertTemplateLiteralType = (
  node: ts.TemplateLiteralTypeNode,
  binding: Binding,
  convertTypeFn: (node: ts.TypeNode, binding: Binding) => IrType
): IrType => {
  const MAX_COMBINATIONS = 64;
  let current = [node.head.text];
  for (const span of node.templateSpans) {
    const options = finiteTemplateTypeStrings(
      convertTypeFn(span.type, binding)
    );
    if (!options || options.length === 0) {
      return { kind: "primitiveType", name: "string" };
    }
    const next: string[] = [];
    for (const prefix of current) {
      for (const option of options) {
        next.push(`${prefix}${option}${span.literal.text}`);
        if (next.length > MAX_COMBINATIONS) {
          return { kind: "primitiveType", name: "string" };
        }
      }
    }
    current = next;
  }
  return toUnionOrSingle(
    current.map((value) => ({ kind: "literalType", value }) as IrType)
  );
};
