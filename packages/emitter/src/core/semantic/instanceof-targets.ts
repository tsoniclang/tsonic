import type { IrType } from "@tsonic/frontend";

/**
 * JS-surface global constructors (e.g. Uint8Array, Date, Map) are modeled in
 * TypeScript as constructor objects, but C# `is` patterns must target the
 * instance type. Normalize synthetic `*Constructor` reference types back to the
 * instance type for emitter-side instanceof lowering.
 */
export const normalizeInstanceofTargetType = (
  type: IrType | undefined
): IrType | undefined => {
  if (!type) return undefined;
  if (type.kind === "referenceType" && type.name.endsWith("Constructor")) {
    return {
      kind: "referenceType",
      name: type.name.slice(0, -"Constructor".length),
    };
  }

  return type;
};
