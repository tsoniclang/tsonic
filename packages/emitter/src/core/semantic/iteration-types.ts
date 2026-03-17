/**
 * Iteration type derivation — pure helpers for extracting element types
 * from collection types for for-of loops.
 *
 * Lives in core/semantic so both symbol-types.ts (canonical registration)
 * and loops.ts (emitter) can depend on it without cycles.
 */

import { IrExpression, normalizedUnionType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { resolveTypeAlias, stripNullish } from "./type-resolution.js";

const normalizeForIteration = (
  type: IrExpression["inferredType"],
  context: EmitterContext
): IrExpression["inferredType"] => {
  if (!type) return type;

  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (resolved.kind !== "unionType") {
    return resolved;
  }

  const preferred = resolved.types.find(
    (part) => part.kind === "referenceType"
  );
  return preferred
    ? resolveTypeAlias(stripNullish(preferred), context)
    : resolved;
};

const deriveTupleIterationElementType = (
  elementTypes: readonly (IrExpression["inferredType"] | undefined)[]
): IrExpression["inferredType"] | undefined => {
  const concrete = elementTypes.filter(
    (element): element is NonNullable<typeof element> => element !== undefined
  );

  if (concrete.length === 0) return undefined;
  if (concrete.length === 1) return concrete[0];
  return normalizedUnionType(concrete);
};

export const deriveForOfElementType = (
  type: IrExpression["inferredType"],
  context: EmitterContext
): IrExpression["inferredType"] | undefined => {
  const normalized = normalizeForIteration(type, context);
  if (!normalized) return undefined;

  if (normalized.kind === "arrayType") {
    return normalized.elementType;
  }

  if (normalized.kind === "tupleType") {
    return deriveTupleIterationElementType(normalized.elementTypes);
  }

  if (normalized.kind === "primitiveType" && normalized.name === "string") {
    return { kind: "primitiveType", name: "string" };
  }

  if (
    normalized.kind === "referenceType" &&
    normalized.typeArguments &&
    normalized.typeArguments.length > 0
  ) {
    const [firstTypeArg, secondTypeArg] = normalized.typeArguments;
    switch (normalized.name) {
      case "Array":
      case "ReadonlyArray":
      case "Iterable":
      case "IterableIterator":
      case "Iterator":
      case "AsyncIterable":
      case "AsyncIterableIterator":
      case "Generator":
      case "AsyncGenerator":
      case "Set":
      case "ReadonlySet":
        return firstTypeArg;
      case "Map":
      case "ReadonlyMap":
        return firstTypeArg && secondTypeArg
          ? {
              kind: "tupleType",
              elementTypes: [firstTypeArg, secondTypeArg],
            }
          : undefined;
      default:
        return undefined;
    }
  }

  return undefined;
};
