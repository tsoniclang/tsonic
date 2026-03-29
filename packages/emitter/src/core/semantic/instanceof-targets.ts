import type { IrType } from "@tsonic/frontend";

/**
 * Emitter-side instanceof target normalization.
 *
 * The frontend should already attach the explicit instance target type. The
 * emitter only normalizes native array/tuple runtime shapes to the C# array
 * type used in `is` patterns.
 */
export const normalizeInstanceofTargetType = (
  type: IrType | undefined
): IrType | undefined => {
  if (!type) return undefined;
  if (type.kind === "arrayType" || type.kind === "tupleType") {
    return {
      kind: "referenceType",
      name: "Array",
      resolvedClrType: "System.Array",
    };
  }

  return type;
};
