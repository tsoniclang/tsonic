/**
 * Pattern-specific type derivation helpers.
 *
 * Semantic type computations for extracting element/rest types from
 * arrays and tuples during pattern destructuring. These are the pattern
 * analogue of deriveForOfElementType in iteration-types.ts.
 *
 * No emission imports — only IR type manipulation and peer semantic helpers.
 */

import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import {
  resolveTypeAlias,
  stripNullish,
  getArrayLikeElementType,
} from "./type-resolution.js";

/**
 * Resolved array pattern type info.
 *
 * Discriminated union so callers can switch on `.kind` to route
 * into tuple vs array lowering paths.
 */
export type ArrayPatternTypeInfo =
  | {
      readonly kind: "tuple";
      readonly tupleType: Extract<IrType, { kind: "tupleType" }>;
    }
  | {
      readonly kind: "array";
      readonly elementType: IrType | undefined;
      readonly originalType: IrType | undefined;
    };

/**
 * Resolve the element type info for an array pattern.
 *
 * Tuple routing: resolves aliases and strips nullish to check for tuples,
 * which need dedicated lowering (ValueTuple member access).
 *
 * Array element derivation: delegates to the canonical `getArrayLikeElementType`
 * which handles nullish stripping, aliases, Array<T>, ReadonlyArray<T>,
 * ArrayLike<T>, and JSArray<T>.
 *
 * Callers switch on `.kind` to route into tuple vs array lowering.
 */
export const resolveArrayPatternType = (
  type: IrType | undefined,
  context: EmitterContext
): ArrayPatternTypeInfo => {
  if (!type)
    return { kind: "array", elementType: undefined, originalType: undefined };

  // Resolve through aliases and strip nullish for tuple detection.
  const resolved = resolveTypeAlias(stripNullish(type), context);

  // Tuples need dedicated lowering (ValueTuple.ItemN member access).
  if (resolved.kind === "tupleType") {
    return { kind: "tuple", tupleType: resolved };
  }

  // For everything else (arrays, reference-backed array-likes),
  // use the canonical shared helper.
  return {
    kind: "array",
    elementType: getArrayLikeElementType(type, context),
    originalType: type,
  };
};

/**
 * Extract the element type at a given index from a tuple type.
 *
 * For indices >= 7, follows the C# ValueTuple nesting convention
 * (Rest field holds remaining elements as a nested tuple).
 */
export const getTupleElementType = (
  tupleType: Extract<IrType, { kind: "tupleType" }>,
  index: number
): IrType | undefined => {
  const direct = tupleType.elementTypes[index];
  if (direct) return direct;

  if (index < 7) return undefined;
  const rest = tupleType.elementTypes.slice(7);
  if (rest.length === 0) return undefined;

  return getTupleElementType(
    {
      kind: "tupleType",
      elementTypes: rest,
    },
    index - 7
  );
};

/**
 * Derive the array type for a rest binding from a tuple pattern.
 *
 * For `const [a, b, ...rest] = tuple`, computes the type of `rest`
 * as an array of the remaining tuple element types (or their union).
 */
export const getTupleRestArrayType = (
  tupleType: Extract<IrType, { kind: "tupleType" }>,
  startIndex: number
): IrType | undefined => {
  const remaining = tupleType.elementTypes.slice(startIndex);
  if (remaining.length === 0) {
    return {
      kind: "arrayType",
      elementType: { kind: "unknownType" },
    };
  }

  const [first, ...rest] = remaining;
  if (!first) {
    return {
      kind: "arrayType",
      elementType: { kind: "unknownType" },
    };
  }

  if (rest.length === 0) {
    return { kind: "arrayType", elementType: first };
  }

  return {
    kind: "arrayType",
    elementType: {
      kind: "unionType",
      types: remaining.filter((item): item is IrType => item !== undefined),
    },
  };
};
