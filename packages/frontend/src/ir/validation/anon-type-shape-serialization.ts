/**
 * Anonymous Type Shape Analysis — Serialization & Hashing
 *
 * Type serialization, shape computation, and hash generation for
 * anonymous type lowering. Split from anon-type-shape-analysis.ts
 * for file-size compliance.
 */

import { createHash } from "crypto";
import type { IrType, IrObjectType, IrReferenceType } from "../types.js";
import { normalizeStructuralPropertySignature } from "./anon-type-shape-collectors.js";

export type SerializeState = {
  readonly seen: WeakMap<object, number>;
  nextId: number;
};

export const beginSerializeNode = (
  state: SerializeState,
  node: object
): { readonly id: number; readonly seenBefore: boolean } => {
  const existing = state.seen.get(node);
  if (existing !== undefined) {
    return { id: existing, seenBefore: true };
  }

  const id = state.nextId;
  state.nextId += 1;
  state.seen.set(node, id);
  return { id, seenBefore: false };
};

/**
 * Serialize an IrType to a stable string for shape signature.
 *
 * This must be cycle-safe because source ports can legitimately contain
 * recursive alias/object graphs (for example handler arrays that reference
 * themselves transitively).
 */
export const serializeType = (type: IrType, state?: SerializeState): string => {
  const currentState = state ?? {
    seen: new WeakMap<object, number>(),
    nextId: 0,
  };

  switch (type.kind) {
    case "primitiveType":
      return type.name;
    case "literalType":
      return `lit:${typeof type.value}:${String(type.value)}`;
    case "referenceType":
      if (type.typeArguments && type.typeArguments.length > 0) {
        const visit = beginSerializeNode(currentState, type);
        if (visit.seenBefore) {
          return `refcycle:${visit.id}`;
        }
        return `ref:${type.name}#${visit.id}<${type.typeArguments
          .map((arg) => serializeType(arg, currentState))
          .join(",")}>`;
      }
      return `ref:${type.name}`;
    case "arrayType": {
      const visit = beginSerializeNode(currentState, type);
      if (visit.seenBefore) {
        return `arrcycle:${visit.id}`;
      }
      return `arr#${visit.id}:${serializeType(type.elementType, currentState)}`;
    }
    case "tupleType": {
      const visit = beginSerializeNode(currentState, type);
      if (visit.seenBefore) {
        return `tupcycle:${visit.id}`;
      }
      return `tup#${visit.id}:[${type.elementTypes
        .map((elementType) => serializeType(elementType, currentState))
        .join(",")}]`;
    }
    case "functionType": {
      const visit = beginSerializeNode(currentState, type);
      if (visit.seenBefore) {
        return `fncycle:${visit.id}`;
      }
      const params = type.parameters
        .map((p) => (p.type ? serializeType(p.type, currentState) : "any"))
        .join(",");
      return `fn#${visit.id}:(${params})=>${serializeType(
        type.returnType,
        currentState
      )}`;
    }
    case "unionType": {
      const visit = beginSerializeNode(currentState, type);
      if (visit.seenBefore) {
        return `unioncycle:${visit.id}`;
      }
      return `union#${visit.id}:[${type.types
        .map((member) => serializeType(member, currentState))
        .join("|")}]`;
    }
    case "typeParameterType":
      return `tp:${type.name}`;
    case "voidType":
      return "void";
    case "anyType":
      return "any";
    case "unknownType":
      return "unknown";
    case "neverType":
      return "never";
    case "objectType": {
      const visit = beginSerializeNode(currentState, type);
      if (visit.seenBefore) {
        return `objcycle:${visit.id}`;
      }

      // Serialize property signatures
      const propMembers = type.members
        .filter(
          (m): m is Extract<typeof m, { kind: "propertySignature" }> =>
            m.kind === "propertySignature"
        )
        .map((m) => {
          const normalizedMember = normalizeStructuralPropertySignature(m);
          return `prop:${normalizedMember.isReadonly ? "ro:" : ""}${normalizedMember.name}${normalizedMember.isOptional ? "?" : ""}:${serializeType(
            normalizedMember.type,
            currentState
          )}`;
        });

      // Serialize method signatures
      const methodMembers = type.members
        .filter(
          (m): m is Extract<typeof m, { kind: "methodSignature" }> =>
            m.kind === "methodSignature"
        )
        .map((m) => {
          const params = m.parameters
            .map((p) => (p.type ? serializeType(p.type, currentState) : "any"))
            .join(",");
          const ret = m.returnType
            ? serializeType(m.returnType, currentState)
            : "void";
          return `method:${m.name}(${params})=>${ret}`;
        });

      const allMembers = [...propMembers, ...methodMembers].sort().join(";");
      return `obj#${visit.id}:{${allMembers}}`;
    }
    case "dictionaryType": {
      const visit = beginSerializeNode(currentState, type);
      if (visit.seenBefore) {
        return `dictcycle:${visit.id}`;
      }
      return `dict#${visit.id}:[${serializeType(
        type.keyType,
        currentState
      )}]:${serializeType(type.valueType, currentState)}`;
    }
    case "intersectionType": {
      const visit = beginSerializeNode(currentState, type);
      if (visit.seenBefore) {
        return `intersectioncycle:${visit.id}`;
      }
      return `intersection#${visit.id}:[${type.types
        .map((member) => serializeType(member, currentState))
        .join("&")}]`;
    }
    default:
      return "unknown";
  }
};

/**
 * Compute shape signature for an objectType
 */
export const computeShapeSignature = (objectType: IrObjectType): string => {
  return serializeType(objectType);
};

/**
 * Generate a short hash from shape signature
 */
export const generateShapeHash = (signature: string): string => {
  return createHash("md5").update(signature).digest("hex").slice(0, 8);
};

/**
 * Generate a module-unique hash from file path
 */
export const generateModuleHash = (filePath: string): string => {
  return createHash("md5").update(filePath).digest("hex").slice(0, 4);
};

export const getReferenceLoweringStableKey = (
  type: IrReferenceType
): string | undefined => {
  const baseKey =
    type.typeId?.stableId ??
    type.typeId?.clrName ??
    type.resolvedClrType ??
    undefined;
  if (!baseKey) return undefined;

  const typeArgsKey =
    type.typeArguments && type.typeArguments.length > 0
      ? `<${type.typeArguments.map((arg) => serializeType(arg)).join(",")}>`
      : "";

  return `${baseKey}${typeArgsKey}`;
};
