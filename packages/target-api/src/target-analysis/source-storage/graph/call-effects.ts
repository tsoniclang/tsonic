import type { Node } from "@tsonic/tsts";
import type { SourceApplication } from "../../../public/source/contracts.js";
import type { SourceJsCallbackEffect } from "../../source-profile.js";
import { sourceStorageValue } from "../model/program.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageCallEffect } from "../model/types.js";

export function snapshotSourceStorageCallbackEffects(value: unknown, selected: SourceApplication,
  budget: SourceStorageBudget): readonly SourceJsCallbackEffect[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const effects: SourceJsCallbackEffect[] = [];
  const positions = new Set<number>();
  for (let index = 0; index < value.length; index += 1) {
    if (!budget.row() || !budget.step()) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, index);
    const element: unknown = descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
    if (element === null || typeof element !== "object") return undefined;
    const fields = Object.getOwnPropertyDescriptors(element);
    if (Reflect.ownKeys(fields).some(key => key !== "parameterIndex" && key !== "timing" && key !== "inputs" && key !== "rejection") ||
      Object.values(fields).some(field => !("value" in field))) return undefined;
    const parameterIndex: unknown = fields.parameterIndex?.value;
    const timing: unknown = fields.timing?.value;
    const rejection: unknown = fields.rejection?.value;
    if (typeof parameterIndex !== "number" || !Number.isSafeInteger(parameterIndex) || parameterIndex < 0 ||
      positions.has(parameterIndex) || timing !== "synchronous" && timing !== "deferred" ||
      !selected.arguments.some(argument => argument.parameter.index === parameterIndex) ||
      rejection !== undefined && (typeof rejection !== "number" || !Number.isSafeInteger(rejection) || rejection < 0)) return undefined;
    positions.add(parameterIndex);
    const supplied: unknown = fields.inputs?.value;
    const inputs: { readonly parameterIndex: number; readonly from: "receiver-element" | "argument-element" | "receiver-rejection";
      readonly sourceParameterIndex?: number }[] = [];
    if (supplied !== undefined) {
      if (!Array.isArray(supplied)) return undefined;
      const parameters = new Set<number>();
      for (let ordinal = 0; ordinal < supplied.length; ordinal += 1) {
        if (!budget.row() || !budget.step()) return undefined;
        const entry = Object.getOwnPropertyDescriptor(supplied, ordinal);
        const value: unknown = entry !== undefined && "value" in entry ? entry.value : undefined;
        if (value === null || typeof value !== "object") return undefined;
        const properties = Object.getOwnPropertyDescriptors(value);
        if (Reflect.ownKeys(properties).some(key => key !== "parameterIndex" && key !== "from" && key !== "sourceParameterIndex") ||
          Object.values(properties).some(property => !("value" in property))) return undefined;
        const input: unknown = properties.parameterIndex?.value;
        const from: unknown = properties.from?.value;
        const sourceParameterIndex: unknown = properties.sourceParameterIndex?.value;
        if (typeof input !== "number" || !Number.isSafeInteger(input) || input < 0 || parameters.has(input) ||
          from !== "receiver-element" && from !== "argument-element" && from !== "receiver-rejection" ||
          from !== "argument-element" && sourceParameterIndex !== undefined ||
          from === "argument-element" && (typeof sourceParameterIndex !== "number" || !Number.isSafeInteger(sourceParameterIndex) ||
            !selected.arguments.some(argument => argument.parameter.index === sourceParameterIndex))) return undefined;
        parameters.add(input);
        inputs.push(Object.freeze({ parameterIndex: input, from,
          ...(from === "argument-element" ? { sourceParameterIndex: sourceParameterIndex as number } : {}) }));
      }
    }
    effects.push(Object.freeze({ parameterIndex, timing, ...(rejection === undefined ? {} : { rejection }),
      ...(supplied === undefined ? {} : { inputs: Object.freeze(inputs) }) }));
  }
  return Object.freeze(effects);
}

export function snapshotSourceStorageCallEffect(
  value: unknown,
  selected: SourceApplication,
  budget: SourceStorageBudget,
): SourceStorageCallEffect | undefined {
  const reject = (): undefined => {
    budget.reject("Source storage call effects require an exact checked allocation or unique checked scalar inputs.");
    return undefined;
  };
  if (!budget.row() || typeof value !== "object" || value === null) return reject();
  const keys = Reflect.ownKeys(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.values(descriptors).some(descriptor => !("value" in descriptor))) return reject();
  const kind: unknown = descriptors.kind?.value;
  if (kind === "no-result-storage" || kind === "receiver-resume") {
    if (keys.length !== 1 || kind === "receiver-resume" && selected.receiver.kind !== "value") return reject();
    return Object.freeze({ kind });
  }
  if (kind === "result-allocation") {
    if (keys.length !== 2 || !keys.includes("allocation") || descriptors.allocation?.value !== selected.identity.invocation) return reject();
    return Object.freeze({ kind, allocation: selected.identity.invocation });
  }
  if (kind !== "result-alias" || keys.length !== 2 || !keys.includes("argument")) return reject();
  const alias: unknown = descriptors.argument?.value;
  const bindingCounts = new Map<number, { count: number; scalar: boolean }>();
  for (const binding of selected.arguments) {
    if (!budget.step()) return undefined;
    const previous = bindingCounts.get(binding.sourceArgumentIndex);
    bindingCounts.set(binding.sourceArgumentIndex, {
      count: (previous?.count ?? 0) + 1,
      scalar: binding.sourceForm === "value" && binding.parameter.form === "parameter",
    });
  }
  const admitted = new Map<unknown, number>();
  const admit = (node: Node): void => { admitted.set(node, (admitted.get(node) ?? 0) + 1); };
  for (const [argumentIndex, argument] of selected.sourceArguments.entries()) {
    if (!budget.step()) return undefined;
    const binding = bindingCounts.get(argumentIndex);
    if (binding?.count === 1 && binding.scalar) admit(sourceStorageValue(argument.operand).occurrence);
  }
  if (selected.receiver.kind === "value") admit(selected.receiver.occurrence);
  const input = (node: unknown): node is Node => admitted.get(node) === 1;
  return input(alias) ? Object.freeze({ kind, argument: alias }) : reject();
}
