import type { IrInterfaceMember, IrParameter, IrType } from "@tsonic/frontend";
import type { FirstPartyBindingsExport } from "./types.js";

export const stableSerializeBindingSemanticValue = (value: unknown): string => {
  const seen = new Map<object, number>();

  const encode = (current: unknown): unknown => {
    if (current === null || current === undefined) {
      return null;
    }

    if (typeof current !== "object") {
      return current;
    }

    const cachedId = seen.get(current);
    if (cachedId !== undefined) {
      return { $ref: cachedId };
    }

    const id = seen.size;
    seen.set(current, id);

    if (Array.isArray(current)) {
      return {
        $id: id,
        $array: current.map((item) => encode(item)),
      };
    }

    const encoded: Record<string, unknown> = { $id: id };
    for (const key of Object.keys(current).sort((left, right) =>
      left.localeCompare(right)
    )) {
      encoded[key] = encode((current as Record<string, unknown>)[key]);
    }
    return encoded;
  };

  return JSON.stringify(encode(value));
};

export const areBindingSemanticSignaturesEqual = (
  left:
    | {
        readonly typeParameters?: readonly string[];
        readonly parameters: readonly IrParameter[];
        readonly returnType?: IrType;
      }
    | undefined,
  right:
    | {
        readonly typeParameters?: readonly string[];
        readonly parameters: readonly IrParameter[];
        readonly returnType?: IrType;
      }
    | undefined
): boolean =>
  stableSerializeBindingSemanticValue(left) ===
  stableSerializeBindingSemanticValue(right);

export const areBindingSemanticsEqual = (
  left: FirstPartyBindingsExport,
  right: FirstPartyBindingsExport
): boolean =>
  left.kind === right.kind &&
  left.clrName === right.clrName &&
  left.declaringClrType === right.declaringClrType &&
  left.declaringAssemblyName === right.declaringAssemblyName &&
  left.semanticOptional === right.semanticOptional &&
  stableSerializeBindingSemanticValue(left.semanticType) ===
    stableSerializeBindingSemanticValue(right.semanticType) &&
  areBindingSemanticSignaturesEqual(
    left.semanticSignature,
    right.semanticSignature
  );

export const isIrTypeNode = (value: unknown): value is IrType => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const kind = candidate.kind;
  if (typeof kind !== "string") {
    return false;
  }

  switch (kind) {
    case "primitiveType":
      return typeof candidate.name === "string";
    case "referenceType":
    case "typeParameterType":
      return typeof candidate.name === "string";
    case "arrayType":
      return "elementType" in candidate;
    case "tupleType":
      return Array.isArray(candidate.elementTypes);
    case "functionType":
      return Array.isArray(candidate.parameters) && "returnType" in candidate;
    case "objectType":
      return Array.isArray(candidate.members);
    case "dictionaryType":
      return "keyType" in candidate && "valueType" in candidate;
    case "unionType":
    case "intersectionType":
      return Array.isArray(candidate.types);
    case "literalType":
      return "value" in candidate;
    case "anyType":
    case "unknownType":
    case "voidType":
    case "neverType":
      return true;
  }

  return false;
};

export const serializeRecursiveBindingType = (
  type: IrType,
  serialize: (value: unknown) => unknown
): IrType => {
  switch (type.kind) {
    case "primitiveType":
      return { ...type };
    case "referenceType":
      return {
        kind: "referenceType",
        name: type.name,
        ...(type.typeArguments
          ? {
              typeArguments: type.typeArguments.map(
                (argument) => serialize(argument) as IrType
              ),
            }
          : {}),
        ...(type.resolvedClrType
          ? { resolvedClrType: type.resolvedClrType }
          : {}),
        ...(type.typeId ? { typeId: { ...type.typeId } } : {}),
      };
    case "typeParameterType":
      return { ...type };
    case "arrayType":
      return {
        kind: "arrayType",
        elementType: serialize(type.elementType) as IrType,
        ...(type.origin ? { origin: type.origin } : {}),
        ...(type.tuplePrefixElementTypes
          ? {
              tuplePrefixElementTypes: type.tuplePrefixElementTypes.map(
                (elementType) => serialize(elementType) as IrType
              ),
            }
          : {}),
        ...(type.tupleRestElementType
          ? {
              tupleRestElementType: serialize(
                type.tupleRestElementType
              ) as IrType,
            }
          : {}),
      };
    case "tupleType":
      return {
        kind: "tupleType",
        elementTypes: type.elementTypes.map(
          (elementType) => serialize(elementType) as IrType
        ),
      };
    case "functionType":
      return {
        kind: "functionType",
        parameters: type.parameters.map(
          (parameter) => serialize(parameter) as IrParameter
        ),
        returnType: serialize(type.returnType) as IrType,
      };
    case "objectType":
      return {
        kind: "objectType",
        members: type.members.map(
          (member) => serialize(member) as IrInterfaceMember
        ),
      };
    case "dictionaryType":
      return {
        kind: "dictionaryType",
        keyType: serialize(type.keyType) as IrType,
        valueType: serialize(type.valueType) as IrType,
      };
    case "unionType":
      return {
        kind: "unionType",
        types: type.types.map((member) => serialize(member) as IrType),
      };
    case "intersectionType":
      return {
        kind: "intersectionType",
        types: type.types.map((member) => serialize(member) as IrType),
      };
    case "literalType":
      return { ...type };
    case "anyType":
      return { kind: "anyType" };
    case "unknownType":
      return { kind: "unknownType" };
    case "voidType":
      return { kind: "voidType" };
    case "neverType":
      return { kind: "neverType" };
  }
};

export const serializeBindingsJsonSafe = <T>(value: T): T => {
  const active = new Set<object>();
  const cache = new Map<object, unknown>();

  const collapseRecursiveValue = (current: object): unknown => {
    if (isIrTypeNode(current)) {
      return serializeRecursiveBindingType(current, serialize);
    }

    const collapsed: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(current)) {
      if (
        child === null ||
        typeof child === "string" ||
        typeof child === "number" ||
        typeof child === "boolean"
      ) {
        collapsed[key] = child;
      }
    }
    return collapsed;
  };

  const serialize = (current: unknown): unknown => {
    if (current === null || current === undefined) {
      return current;
    }

    if (
      typeof current === "string" ||
      typeof current === "number" ||
      typeof current === "boolean"
    ) {
      return current;
    }

    if (typeof current !== "object") {
      return current;
    }

    if (active.has(current)) {
      return collapseRecursiveValue(current);
    }

    const cached = cache.get(current);
    if (cached !== undefined) {
      return cached;
    }

    if (Array.isArray(current)) {
      const cloned: unknown[] = [];
      cache.set(current, cloned);
      active.add(current);
      for (const item of current) {
        cloned.push(serialize(item));
      }
      active.delete(current);
      return cloned;
    }

    if (isIrTypeNode(current)) {
      active.add(current);
      const cloned = serializeRecursiveBindingType(current, serialize);
      cache.set(current, cloned);
      active.delete(current);
      return cloned;
    }

    const cloned: Record<string, unknown> = {};
    cache.set(current, cloned);
    active.add(current);
    for (const [key, child] of Object.entries(current)) {
      cloned[key] = serialize(child);
    }
    active.delete(current);
    return cloned;
  };

  return serialize(value) as T;
};

