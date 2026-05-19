import { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitTypeAst } from "../../type-emitter.js";
import { stableTypeKeyFromAst } from "../../core/format/backend-ast/utils.js";
import { requiresValueTypeMaterialization } from "../../core/semantic/expected-type-matching.js";
import { describeIrTypeForDiagnostics } from "../../core/semantic/deterministic-type-keys.js";
import { resolveStructuralReferenceType } from "../../core/semantic/structural-shape-matching.js";
import {
  normalizeStructuralEmissionType,
  stripNullish,
} from "../../core/semantic/type-resolution.js";

const buildStorageSurfaceDiagnosticContext = (
  actualType: IrType,
  expectedType: IrType,
  strippedActual: IrType,
  strippedExpected: IrType,
  context: EmitterContext
): string =>
  `[storage-surface originalActual=${describeIrTypeForDiagnostics(
    actualType,
    context
  )} originalExpected=${describeIrTypeForDiagnostics(
    expectedType,
    context
  )} actual=${describeIrTypeForDiagnostics(
    strippedActual,
    context
  )} expected=${describeIrTypeForDiagnostics(strippedExpected, context)}]`;

const containsRawObjectType = (
  type: IrType,
  seen = new Set<IrType>()
): boolean => {
  if (seen.has(type)) {
    return false;
  }
  seen.add(type);

  switch (type.kind) {
    case "objectType":
      return true;
    case "arrayType":
      return containsRawObjectType(type.elementType, seen);
    case "tupleType":
      return type.elementTypes.some((elementType) =>
        containsRawObjectType(elementType, seen)
      );
    case "dictionaryType":
      return containsRawObjectType(type.valueType, seen);
    case "unionType":
    case "intersectionType":
      return type.types.some((memberType) =>
        containsRawObjectType(memberType, seen)
      );
    case "referenceType":
      return (
        type.typeArguments?.some((typeArgument) =>
          containsRawObjectType(typeArgument, seen)
        ) ?? false
      );
    default:
      return false;
  }
};

export const matchesEmittedStorageSurface = (
  actualType: IrType | undefined,
  expectedType: IrType | undefined,
  context: EmitterContext
): [boolean, EmitterContext] => {
  const tryEmitSurfaceTypeAst = (
    type: IrType,
    currentContext: EmitterContext
  ): [ReturnType<typeof emitTypeAst>[0], EmitterContext] | undefined => {
    try {
      return emitTypeAst(type, currentContext);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message.startsWith("ICE: Unresolved reference type ") ||
          err.message.startsWith(
            "ICE: Non-transparent intersection type reached emitter"
          ) ||
          err.message.startsWith("ICE: 'unknown' type reached emitter") ||
          err.message.startsWith("ICE: 'any' type reached emitter"))
      ) {
        return undefined;
      }
      throw err;
    }
  };

  if (!actualType || !expectedType) {
    return [false, context];
  }

  if (requiresValueTypeMaterialization(actualType, expectedType, context)) {
    return [false, context];
  }

  const strippedActual = normalizeStructuralEmissionType(
    resolveStructuralReferenceType(stripNullish(actualType), context) ??
      stripNullish(actualType),
    context
  );
  const strippedExpected = normalizeStructuralEmissionType(
    resolveStructuralReferenceType(stripNullish(expectedType), context) ??
      stripNullish(expectedType),
    context
  );
  if (
    containsRawObjectType(strippedActual) ||
    containsRawObjectType(strippedExpected)
  ) {
    return [false, context];
  }
  let actualSurface:
    | [ReturnType<typeof emitTypeAst>[0], EmitterContext]
    | undefined;
  try {
    actualSurface = tryEmitSurfaceTypeAst(strippedActual, context);
  } catch (err) {
    if (err instanceof Error) {
      throw new Error(
        `${err.message} ${buildStorageSurfaceDiagnosticContext(
          actualType,
          expectedType,
          strippedActual,
          strippedExpected,
          context
        )}`
      );
    }
    throw err;
  }
  if (!actualSurface) {
    return [false, context];
  }
  const [actualTypeAst, actualTypeContext] = actualSurface;
  let expectedSurface:
    | [ReturnType<typeof emitTypeAst>[0], EmitterContext]
    | undefined;
  try {
    expectedSurface = tryEmitSurfaceTypeAst(
      strippedExpected,
      actualTypeContext
    );
  } catch (err) {
    if (err instanceof Error) {
      throw new Error(
        `${err.message} ${buildStorageSurfaceDiagnosticContext(
          actualType,
          expectedType,
          strippedActual,
          strippedExpected,
          actualTypeContext
        )}`
      );
    }
    throw err;
  }
  if (!expectedSurface) {
    return [false, context];
  }
  const [expectedTypeAst, expectedTypeContext] = expectedSurface;

  return [
    stableTypeKeyFromAst(actualTypeAst) ===
      stableTypeKeyFromAst(expectedTypeAst),
    expectedTypeContext,
  ];
};
