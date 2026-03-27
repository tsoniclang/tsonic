import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { shouldEraseRecursiveRuntimeUnionArrayElement } from "./runtime-unions.js";
import {
  getArrayLikeElementType,
  resolveTypeAlias,
  splitRuntimeNullishUnionMembers,
  stripNullish,
} from "./type-resolution.js";

const OBJECT_REFERENCE_TYPE: IrType = {
  kind: "referenceType",
  name: "object",
  resolvedClrType: "System.Object",
};

export const resolveArrayLiteralContextType = (
  expectedType: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!expectedType) return undefined;

  const strippedExpected = stripNullish(expectedType);
  const resolvedExpected = resolveTypeAlias(strippedExpected, context);
  if (resolvedExpected.kind !== "unionType") {
    return strippedExpected;
  }

  const arrayLikeMembers = resolvedExpected.types.filter(
    (member): member is IrType =>
      getArrayLikeElementType(member, context) !== undefined ||
      resolveTypeAlias(stripNullish(member), context).kind === "tupleType"
  );

  if (arrayLikeMembers.length === 1) {
    return arrayLikeMembers[0];
  }

  return strippedExpected;
};

export const normalizeRecursiveArrayExpectedType = (
  type: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!type) {
    return undefined;
  }

  const split = splitRuntimeNullishUnionMembers(type);
  if (
    type.kind === "unionType" &&
    split?.hasRuntimeNullish &&
    split.nonNullishMembers.length === 1
  ) {
    const [member] = split.nonNullishMembers;
    const normalizedMember = normalizeRecursiveArrayExpectedType(
      member,
      context
    );
    if (!normalizedMember) {
      return type;
    }

    return {
      kind: "unionType",
      types: [
        ...type.types.filter(
          (candidate: IrType) =>
            candidate.kind === "primitiveType" &&
            (candidate.name === "null" || candidate.name === "undefined")
        ),
        normalizedMember,
      ],
    };
  }

  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (
    resolved.kind === "arrayType" &&
    shouldEraseRecursiveRuntimeUnionArrayElement(resolved.elementType, context)
  ) {
    return {
      kind: "arrayType",
      elementType: OBJECT_REFERENCE_TYPE,
      origin: resolved.origin,
    };
  }

  if (
    resolved.kind === "referenceType" &&
    (resolved.name === "Array" ||
      resolved.name === "ReadonlyArray") &&
    resolved.typeArguments?.length === 1 &&
    resolved.typeArguments[0] &&
    shouldEraseRecursiveRuntimeUnionArrayElement(
      resolved.typeArguments[0],
      context
    )
  ) {
    return {
      kind: "arrayType",
      elementType: OBJECT_REFERENCE_TYPE,
      origin: "explicit",
    };
  }

  return type;
};
