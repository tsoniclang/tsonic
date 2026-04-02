/**
 * Array literal expression converters
 */

import * as ts from "typescript";
import { IrArrayExpression, IrType, IrExpression } from "../../types.js";
import {
  containsTypeParameter,
  typesEqual,
} from "../../types/ir-substitution.js";
import { stableIrTypeKey } from "../../types/type-ops.js";
import { getSourceSpan } from "./helpers.js";
import { convertExpression } from "../../expression-converter.js";
import { NumericKind } from "../../types/numeric-kind.js";
import type { ProgramContext } from "../../program-context.js";

export const isNullishPrimitive = (type: IrType): boolean =>
  type.kind === "primitiveType" &&
  (type.name === "null" || type.name === "undefined");

/**
 * Compute the element type for an array literal from its elements' types.
 *
 * Rules:
 * 1. All numeric literals with same intent → use that intent (int, long, double)
 * 2. Mixed Int32/Int64 → Int64
 * 3. Any Double present → double
 * 4. String literals → string
 * 5. Boolean literals → boolean
 * 6. Mixed or complex → fall back to TS inference
 */
const computeArrayElementType = (
  elements: readonly (IrExpression | undefined)[],
  fallbackType: IrType | undefined
): IrType | undefined => {
  const mergeElementTypes = (types: readonly IrType[]): IrType | undefined => {
    if (types.length === 0) return undefined;
    if (types.some((type) => type.kind === "anyType")) {
      return { kind: "anyType" };
    }
    if (types.some((type) => type.kind === "unknownType")) {
      return { kind: "unknownType" };
    }
    const first = types[0];
    if (first && types.every((t) => typesEqual(t, first))) {
      return first;
    }
    return {
      kind: "unionType",
      types,
    };
  };

  const extractSpreadElementTypes = (
    type: IrType | undefined
  ): readonly IrType[] | undefined => {
    if (!type) return undefined;

    if (type.kind === "arrayType") {
      return [type.elementType];
    }

    if (type.kind === "tupleType") {
      return type.elementTypes.filter(
        (element): element is IrType => element !== undefined
      );
    }

    if (type.kind === "unionType") {
      const members: IrType[] = [];
      for (const member of type.types) {
        const extracted = extractSpreadElementTypes(member);
        if (!extracted) return undefined;
        members.push(...extracted);
      }
      return members;
    }

    if (
      type.kind === "referenceType" &&
      type.typeArguments &&
      type.typeArguments.length > 0
    ) {
      const simpleName = type.name.split(".").pop() ?? type.name;
      switch (simpleName) {
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
        case "IEnumerable":
        case "IReadOnlyList":
        case "List":
          return type.typeArguments[0] ? [type.typeArguments[0]] : undefined;
        case "Map":
        case "ReadonlyMap":
          return type.typeArguments[0] && type.typeArguments[1]
            ? [
                {
                  kind: "tupleType",
                  elementTypes: [type.typeArguments[0], type.typeArguments[1]],
                },
              ]
            : undefined;
        default:
          return undefined;
      }
    }

    return undefined;
  };

  // Filter out holes and spreads for type analysis
  const regularElements = elements.filter(
    (e): e is IrExpression => e !== undefined && e.kind !== "spread"
  );
  const spreadElements = elements.filter(
    (e): e is Extract<IrExpression, { kind: "spread" }> =>
      e !== undefined && e.kind === "spread"
  );

  if (regularElements.length === 0 && spreadElements.length === 0) {
    // Empty array - use fallback
    return fallbackType;
  }

  // Check if all elements are numeric literals
  const numericIntents: NumericKind[] = [];
  let allNumericLiterals = true;
  let allStringLiterals = true;
  let allBooleanLiterals = true;

  for (const elem of regularElements) {
    if (elem.kind === "literal") {
      if (typeof elem.value === "number" && elem.numericIntent) {
        numericIntents.push(elem.numericIntent);
        allStringLiterals = false;
        allBooleanLiterals = false;
      } else if (typeof elem.value === "string") {
        allNumericLiterals = false;
        allBooleanLiterals = false;
      } else if (typeof elem.value === "boolean") {
        allNumericLiterals = false;
        allStringLiterals = false;
      } else {
        // null or other literal
        allNumericLiterals = false;
        allStringLiterals = false;
        allBooleanLiterals = false;
      }
    } else {
      // Non-literal element - can't determine type deterministically from literals
      allNumericLiterals = false;
      allStringLiterals = false;
      allBooleanLiterals = false;
    }
  }

  const hasOnlyRegularElements =
    regularElements.length > 0 && spreadElements.length === 0;

  // All numeric literals - determine widest type
  if (
    hasOnlyRegularElements &&
    allNumericLiterals &&
    numericIntents.length > 0
  ) {
    // Any Double → number (emits as "double" in C#)
    if (
      numericIntents.includes("Double") ||
      numericIntents.includes("Single")
    ) {
      return { kind: "primitiveType", name: "number" };
    }
    // Any Int64/UInt64 → fall back to TS inference (no primitive for long)
    if (numericIntents.includes("Int64") || numericIntents.includes("UInt64")) {
      return fallbackType;
    }
    // All Int32 or smaller → int
    return { kind: "primitiveType", name: "int" };
  }

  // All string literals
  if (hasOnlyRegularElements && allStringLiterals) {
    return { kind: "primitiveType", name: "string" };
  }

  // All boolean literals
  if (hasOnlyRegularElements && allBooleanLiterals) {
    return { kind: "primitiveType", name: "boolean" };
  }

  // Mixed or complex - fall back to TS inference
  // If all elements have a deterministically known IR type and they match, use it.
  // This enables arrays like `[wrap(1), wrap(2)]` to infer `Container<int>[]`
  // instead of defaulting to `number[]`.
  const knownTypes: IrType[] = [];
  for (const elem of regularElements) {
    const t = elem.inferredType;
    if (!t) {
      return fallbackType;
    }
    knownTypes.push(t);
  }

  for (const spread of spreadElements) {
    const spreadTypes = extractSpreadElementTypes(
      spread.expression.inferredType
    );
    if (!spreadTypes) {
      return fallbackType;
    }
    knownTypes.push(...spreadTypes);
  }

  const merged = mergeElementTypes(knownTypes);
  if (merged) {
    return merged;
  }

  return fallbackType;
};

export const normalizeExpectedArrayType = (
  expectedType: IrType | undefined,
  ctx: ProgramContext
): Extract<IrType, { kind: "arrayType" }> | undefined => {
  if (!expectedType) return undefined;

  const matchesRecursiveElementTarget = (
    left: IrType,
    right: IrType
  ): boolean => {
    if (ctx.typeSystem.typesEqual(left, right)) {
      return true;
    }

    if (
      left.kind === "referenceType" &&
      right.kind === "referenceType" &&
      left.name === right.name &&
      (left.typeArguments?.length ?? 0) === (right.typeArguments?.length ?? 0)
    ) {
      const leftArgs = left.typeArguments ?? [];
      const rightArgs = right.typeArguments ?? [];
      return leftArgs.every((arg, index) => {
        const rightArg = rightArgs[index];
        return !!rightArg && matchesRecursiveElementTarget(arg, rightArg);
      });
    }

    return false;
  };

  const normalizeCandidate = (
    member: IrType
  ): Extract<IrType, { kind: "arrayType" }> | undefined => {
    if (member.kind === "arrayType") {
      return member;
    }

    if (
      member.kind === "referenceType" &&
      member.typeArguments &&
      member.typeArguments.length > 0
    ) {
      const simpleName = member.name.split(".").pop() ?? member.name;
      switch (simpleName) {
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
        case "IEnumerable":
        case "IReadOnlyList":
        case "List": {
          const elementType = member.typeArguments[0];
          return elementType
            ? {
                kind: "arrayType",
                elementType,
              }
            : undefined;
        }
        default:
          return undefined;
      }
    }

    return undefined;
  };

  const directCandidate = normalizeCandidate(expectedType);
  if (directCandidate) {
    return directCandidate;
  }

  const candidateMap = new Map<
    string,
    Extract<IrType, { kind: "arrayType" }>
  >();
  for (const member of ctx.typeSystem
    .collectNarrowingCandidates(expectedType)
    .filter(
      (candidate): candidate is IrType =>
        !!candidate && !isNullishPrimitive(candidate)
    )) {
    const normalized = normalizeCandidate(member);
    if (!normalized || containsTypeParameter(normalized)) continue;
    candidateMap.set(stableIrTypeKey(normalized), normalized);
  }

  const candidates = [...candidateMap.values()];
  if (candidates.length === 1) {
    return candidates[0];
  }

  const selfRecursiveCandidates = candidates.filter((candidate) =>
    matchesRecursiveElementTarget(candidate.elementType, expectedType)
  );
  if (selfRecursiveCandidates.length === 1) {
    return selfRecursiveCandidates[0];
  }

  const widestCandidates = candidates.filter((candidate) =>
    candidates.every((other) =>
      ctx.typeSystem.isAssignableTo(other.elementType, candidate.elementType)
    )
  );

  return widestCandidates.length === 1 ? widestCandidates[0] : undefined;
};

const normalizeExpectedTupleType = (
  expectedType: IrType | undefined,
  ctx: ProgramContext
): Extract<IrType, { kind: "tupleType" }> | undefined => {
  if (!expectedType) return undefined;

  const candidates = ctx.typeSystem
    .collectNarrowingCandidates(expectedType)
    .filter(
      (candidate): candidate is IrType =>
        !!candidate && !isNullishPrimitive(candidate)
    )
    .filter(
      (candidate): candidate is Extract<IrType, { kind: "tupleType" }> =>
        candidate.kind === "tupleType" && !containsTypeParameter(candidate)
    );

  if (candidates.length !== 1) {
    return undefined;
  }

  return candidates[0];
};

/**
 * Convert array literal expression
 *
 * DETERMINISTIC TYPING:
 * - If expectedType is provided (from LHS annotation), use it
 * - Otherwise, derive from element types using literal form analysis
 * - Default to number[] (double[]) for ergonomics when type cannot be determined
 *
 * @param node - The TypeScript array literal expression
 * @param ctx - ProgramContext for type system and binding access
 * @param expectedType - Expected type from context (e.g., `const a: number[] = [1,2,3]`).
 *                       Pass `undefined` explicitly when no contextual type exists.
 */
export const convertArrayLiteral = (
  node: ts.ArrayLiteralExpression,
  ctx: ProgramContext,
  expectedType: IrType | undefined
): IrArrayExpression => {
  const contextualTupleType = normalizeExpectedTupleType(expectedType, ctx);
  const contextualArrayType = normalizeExpectedArrayType(expectedType, ctx);

  // Determine element expected type from array expected type
  // Convert all elements, passing expected element type for contextual typing
  const elements = node.elements.map((elem, index) => {
    const expectedElementType =
      contextualTupleType?.elementTypes[index] ?? contextualArrayType?.elementType;

    if (ts.isOmittedExpression(elem)) {
      return undefined; // Hole in sparse array
    }
    if (ts.isSpreadElement(elem)) {
      // Spread element - convert and derive type from expression
      const spreadExpr = convertExpression(
        elem.expression,
        ctx,
        contextualTupleType ?? expectedType
      );
      return {
        kind: "spread" as const,
        expression: spreadExpr,
        inferredType: spreadExpr.inferredType,
        sourceSpan: getSourceSpan(elem),
      };
    }
    return convertExpression(elem, ctx, expectedElementType);
  });

  // DETERMINISTIC TYPING: Determine inferredType using priority:
  // 1. Expected type from context (e.g., LHS annotation, parameter type)
  // 2. Literal-form inference (derive from element types)
  // 3. Default: number[] (double[]) for ergonomics
  const inferredType: IrType | undefined = contextualTupleType
    ? contextualTupleType
    : contextualArrayType
      ? contextualArrayType
    : (() => {
        // No expected type - derive from element types
        const elementType = computeArrayElementType(elements, undefined);
        if (elementType) {
          return { kind: "arrayType" as const, elementType };
        }
        // Default to number[] (double[]) for ergonomics
        // This matches Alice's guidance: untyped arrays default to double[]
        return {
          kind: "arrayType" as const,
          elementType: {
            kind: "primitiveType" as const,
            name: "number" as const,
          },
        };
      })();

  return {
    kind: "array",
    elements,
    inferredType,
    sourceSpan: getSourceSpan(node),
  };
};
