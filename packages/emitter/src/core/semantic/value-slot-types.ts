import type { IrType } from "@tsonic/frontend";

const UNDEFINED_VALUE_SLOT_TYPE: IrType = {
  kind: "primitiveType",
  name: "undefined",
};

export const normalizeValueSlotType = (type: IrType): IrType =>
  type.kind === "voidType" || type.kind === "neverType"
    ? UNDEFINED_VALUE_SLOT_TYPE
    : type;
