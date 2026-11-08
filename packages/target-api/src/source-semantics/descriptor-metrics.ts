import type { SourceTypeDescriptor } from "../public/source/contracts.js";

export function sourceTypeDescriptorDepth(type: SourceTypeDescriptor): number {
  const depths = new WeakMap<SourceTypeDescriptor, number>();
  const active = new Set<SourceTypeDescriptor>();
  function depth(value: SourceTypeDescriptor): number {
    const previous = depths.get(value);
    if (previous !== undefined) return previous;
    if (active.has(value)) throw new Error("Source descriptor geometry must use nominal references instead of object cycles.");
    active.add(value);
    const signatures = value.kind === "shape" || value.kind === "callable" ? [...value.calls, ...value.constructs] : [];
    const children = value.kind === "array" ? [value.element] : value.kind === "optional" ? [value.value]
      : value.kind === "projection" ? [value.source] : value.kind === "union" ? value.types
      : value.kind === "tuple" ? value.elements.map(element => element.type) : value.kind === "declared" ? value.typeArguments
      : value.kind === "shape" ? [...value.members.map(member => member.type), ...value.indexes.flatMap(index => [index.key, index.value])] : [];
    let result = -1;
    for (const child of children) result = Math.max(result, depth(child));
    for (const signature of signatures) {
      if (signature.receiver !== undefined) result = Math.max(result, depth(signature.receiver.type));
      for (const parameter of signature.parameters) result = Math.max(result, depth(parameter.type));
      result = Math.max(result, depth(signature.result));
    }
    active.delete(value);
    depths.set(value, result + 1);
    return result + 1;
  }
  return depth(type);
}
