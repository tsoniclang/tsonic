import type { Node } from "@tsonic/tsts";
import type { ResolvedSourceCallInfo } from "../../source-semantics/index.js";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageCallEffect } from "./types.js";

export function snapshotSourceStorageCallEffect(
  value: unknown,
  selected: ResolvedSourceCallInfo,
  budget: SourceStorageBudget,
): SourceStorageCallEffect | undefined {
  const reject = (): undefined => {
    budget.reject("Source storage call effects require an exact checked allocation or unique checked scalar inputs.");
    return undefined;
  };
  if (!budget.row() || typeof value !== "object" || value === null) return reject();
  const keys = Reflect.ownKeys(value);
  if (keys.length > 3 || keys.some(key => key !== "resultAlias" && key !== "resultAllocation" && key !== "preservedInputs")) return reject();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.values(descriptors).some(descriptor => !("value" in descriptor))) return reject();
  const alias: unknown = descriptors.resultAlias?.value;
  const allocation: unknown = descriptors.resultAllocation?.value;
  const preserved: unknown = descriptors.preservedInputs?.value;
  if (allocation !== undefined && (alias !== undefined || allocation !== selected.call || selected.sourceSelectedSignatureKind !== "resolved")) return reject();
  const bindingCounts = new Map<number, { count: number; scalar: boolean }>();
  for (const binding of selected.sourceArgumentBindings) {
    if (!budget.step()) return undefined;
    const previous = bindingCounts.get(binding.sourceArgumentIndex);
    bindingCounts.set(binding.sourceArgumentIndex, {
      count: (previous?.count ?? 0) + 1,
      scalar: binding.sourceForm === "value" && binding.sourceParameterForm === "parameter",
    });
  }
  const admitted = new Map<Node, number>();
  const admit = (node: Node): void => { admitted.set(node, (admitted.get(node) ?? 0) + 1); };
  for (const [argumentIndex, argument] of selected.sourceArguments.entries()) {
    if (!budget.step()) return undefined;
    const binding = bindingCounts.get(argumentIndex);
    if (binding?.count === 1 && binding.scalar) admit(argument.expression);
  }
  if (selected.sourceReceiver !== undefined) admit(selected.sourceReceiver.expression);
  const input = (node: unknown): node is Node => admitted.get(node as Node) === 1;
  if (alias !== undefined && !input(alias)) return reject();
  if (preserved !== undefined && (!Array.isArray(preserved) || preserved.length > admitted.size)) return reject();
  const inputs: Node[] = [];
  const uniqueInputs = new Set<Node>();
  if (Array.isArray(preserved)) {
    for (let index = 0; index < preserved.length; index += 1) {
      if (!budget.row()) return undefined;
      const descriptor = Object.getOwnPropertyDescriptor(preserved, index);
      const node: unknown = descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
      if (!input(node) || uniqueInputs.has(node)) return reject();
      uniqueInputs.add(node);
      inputs.push(node);
    }
  }
  return Object.freeze({
    ...(alias === undefined ? {} : { resultAlias: alias as Node }),
    ...(allocation === undefined ? {} : { resultAllocation: allocation as Node }),
    ...(preserved === undefined ? {} : { preservedInputs: Object.freeze(inputs) }),
  });
}
