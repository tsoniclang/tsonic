import type { CheckedLayoutConstructionOf, CheckedLayoutOperandOf, CheckedLayoutRoleOf } from "./contract.js";

export const checkedLayoutConstructionOf: CheckedLayoutConstructionOf = node => {
  if (node.kind !== "CallExpression") return null;
  const capture = node.tsonic.memory;
  return capture.kind === "available" && capture.value !== null && capture.value.kind !== "data-layout" ? capture.value : null;
};

export const checkedLayoutRoleOf: CheckedLayoutRoleOf = call => {
  const observation = call.tsonic.observation;
  if (observation.kind === "available" && observation.value !== null) return observation.value.operation;
  const descriptor = checkedLayoutConstructionOf(call);
  switch (descriptor?.kind) {
    case "value": return "value-layout";
    case "array": return "array-layout";
    case "field": return "field-layout";
    default: return null;
  }
};

export const checkedLayoutOperandOf: CheckedLayoutOperandOf = (call, position) => {
  const descriptor = checkedLayoutConstructionOf(call);
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
