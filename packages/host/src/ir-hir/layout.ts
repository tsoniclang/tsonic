import type { CheckedLayoutOperandOf } from "./contract.js";

export const checkedLayoutOperandOf: CheckedLayoutOperandOf = (call, position) => {
  const memory = call.tsonic.memory;
  const descriptor = memory.kind === "available" ? memory.value : null;
  switch (descriptor?.kind) {
    case "field": return position === 1 ? descriptor.byteOffsetExpression : position === 2 ? descriptor.byteAlignmentExpression : null;
    case "value": case "array":
      if (position === 1) return descriptor.geometry.byteSizeExpression;
      if (position === 2) return descriptor.geometry.byteAlignmentExpression;
      if (position === 3) return descriptor.geometry.strideExpression;
      return descriptor.kind === "array" && position === 5 ? descriptor.extentExpression : null;
    default: return null;
  }
};
