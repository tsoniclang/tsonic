import type { SourceNodeRef } from "../ids/contract.js";
import type { CheckedLayoutConstructionOf, CheckedLayoutOperandOf, CheckedLayoutRoleOf, HirModuleBinding, HirNode, ResolveCheckedLayout } from "./contract.js";

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

function sameOccurrence(left: SourceNodeRef, right: SourceNodeRef): boolean {
  if (left.value.node !== right.value.node) return false;
  return left.kind === "item" ? right.kind === "item" && left.value.owner === right.value.owner
    : right.kind === "body" && left.value.body === right.value.body;
}

function absent(): { readonly kind: "complete"; readonly value: null } {
  return { kind: "complete", value: null };
}

export const resolveCheckedLayout: ResolveCheckedLayout = (deps, reference) => {
  const initial = deps.admit(1, 1);
  if (initial !== null) return { kind: "resource-stop", stop: initial };
  const visited = new Set<HirNode | HirModuleBinding>();
  let node = deps.nodeOf(reference);
  while (node !== null) {
    const step = deps.admit(1, 1);
    if (step !== null) return { kind: "resource-stop", stop: step };
    if (visited.has(node)) return absent();
    visited.add(node);
    if (node.kind === "ParenthesizedExpression") {
      node = node.expression;
      continue;
    }
    const layout = checkedLayoutConstructionOf(node);
    const memory = node.kind === "VariableDeclaration" ? node.tsonic.memory : null;
    const capture = layout ?? (memory?.kind === "available" && memory.value?.kind === "data-layout" ? memory.value : null);
    if (capture !== null) {
      const read = deps.admit(2, 1);
      if (read !== null) return { kind: "resource-stop", stop: read };
      const item = deps.itemOf(node);
      if (item === null || deps.nodeOf(capture.occurrence) !== node
        || capture.kind === "data-layout" && (capture.declaration.kind !== "available" || capture.declaration.value !== item.owner))
        return absent();
      return { kind: "complete", value: { definition: item.owner, capture, node } };
    }
    if (node.kind === "VariableDeclaration") {
      const read = deps.admit(2, 0);
      if (read !== null) return { kind: "resource-stop", stop: read };
      const parent = deps.parentOf(node);
      if (parent?.kind !== "VariableDeclarationList" || !parent.flags.includes("Const")) return absent();
      node = node.initializer;
      continue;
    }
    if (node.kind !== "Identifier" || node.tsonic.role !== "value") return absent();
    let resolution = node.tsonic.resolution;
    while (resolution.kind === "binding") {
      const read = deps.admit(2, 1);
      if (read !== null) return { kind: "resource-stop", stop: read };
      const binding = deps.bindingOf(resolution.occurrence);
      if (binding === null || visited.has(binding) || !sameOccurrence(resolution.occurrence, binding.occurrence)
        || binding.target.kind !== "available") return absent();
      visited.add(binding);
      resolution = binding.target.value;
    }
    const read = deps.admit(2, 0);
    if (read !== null) return { kind: "resource-stop", stop: read };
    const owner = resolution.kind === "local" ? deps.localDeclarationOf(resolution.local)
      : resolution.kind === "declarations" && resolution.definitions.length === 1
        ? deps.declarationSourceOf(resolution.definitions[0]) : null;
    if (owner === null) return absent();
    node = deps.nodeOf(owner);
  }
  return absent();
};
