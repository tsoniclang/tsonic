import type { IrType } from "@tsonic/frontend";

export const unwrapParameterModifierType = (
  type: IrType | undefined
): IrType | undefined => {
  let current = type;

  while (
    current?.kind === "referenceType" &&
    (current.name === "out" ||
      current.name === "ref" ||
      current.name === "In" ||
      current.name === "inref") &&
    current.typeArguments?.length === 1
  ) {
    const inner = current.typeArguments[0];
    if (!inner) {
      break;
    }
    current = inner;
  }

  return current;
};
