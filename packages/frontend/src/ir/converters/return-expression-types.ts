import type { IrType } from "../types.js";
import { getAwaitedIrType } from "../types/type-ops.js";

export const getReturnExpressionExpectedType = (
  declaredReturnType: IrType | undefined,
  isAsync: boolean
): IrType | undefined => {
  if (!declaredReturnType) {
    return undefined;
  }

  return isAsync
    ? (getAwaitedIrType(declaredReturnType) ?? declaredReturnType)
    : declaredReturnType;
};
