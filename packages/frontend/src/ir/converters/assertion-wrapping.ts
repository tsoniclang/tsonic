import type { ProgramContext } from "../program-context.js";
import type { IrType } from "../types.js";
import { TSONIC_TO_NUMERIC_KIND } from "../types/numeric-kind.js";

const isExactNumericIrType = (type: IrType): boolean =>
  type.kind === "referenceType" && TSONIC_TO_NUMERIC_KIND.has(type.name);

export const shouldWrapExpressionWithAssertion = (
  ctx: ProgramContext,
  fromDecl: IrType | undefined,
  fromEnv: IrType | undefined
): boolean => {
  if (!fromEnv) return false;
  if (!fromDecl || fromDecl.kind === "unknownType") {
    if (fromEnv.kind === "unknownType") {
      return false;
    }
    if (fromEnv.kind === "unionType") {
      return true;
    }
    if (isExactNumericIrType(fromEnv)) {
      return true;
    }
    if (fromEnv.kind === "arrayType") {
      return true;
    }
    if (fromEnv.kind === "functionType") {
      return true;
    }
    return false;
  }
  if (ctx.typeSystem.typesEqual(fromEnv, fromDecl)) return false;

  if (fromEnv.kind === "unionType" || fromDecl.kind === "unionType") {
    return true;
  }

  if (isExactNumericIrType(fromEnv) && !isExactNumericIrType(fromDecl)) {
    return true;
  }

  if (fromEnv.kind === "arrayType" && fromDecl.kind !== "arrayType") {
    return true;
  }

  if (fromEnv.kind === "functionType" && fromDecl.kind !== "functionType") {
    return true;
  }

  return false;
};
