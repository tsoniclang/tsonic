import type { Node } from "@tsonic/tsts";
import type { MemorySourceCall } from "./memory-analysis-model.js";
import { publishMemoryFact } from "./memory-analysis-context.js";
import { readSourceFact } from "./provider-calls.js";
import { selectTsonicFixedArray } from "./fixed-array-selection.js";
import type { TsonicFixedArrayFact } from "./fixed-array-facts.js";
import type { MemorySourceProvenance } from "./memory-provenance.js";
import { createMemorySourcePublication, tsonicMemorySourceFactKey } from "./memory-publications.js";

export function captureMemoryBindingSource(call: MemorySourceCall, index: number, ownerIndex?: number): void {
  const source = bindingSource(call, index);
  const owner = ownerIndex === undefined ? undefined : bindingSource(call, ownerIndex);
  if (source === undefined || ownerIndex !== undefined && owner === undefined) return;
  publishMemoryFact(call, tsonicMemorySourceFactKey,
    createMemorySourcePublication(call.selected.call, { source, owner }));
}

function bindingSource(call: MemorySourceCall, index: number): MemorySourceProvenance | undefined {
  const application = call.selected.selection.selection.application;
  const argument = application.signatureTypeArguments[index];
  if (argument?.declaration === undefined || argument.checkedArgument === undefined) return undefined;
  return Object.freeze({ kind: "binding", application, argument, declaration: argument.declaration,
    sourceType: argument.checkedArgument });
}

export function captureMemoryArraySource(call: MemorySourceCall,
  count: { readonly value: bigint; readonly runtimeBase: "number" | "bigint" }): TsonicFixedArrayFact | undefined {
  const observed = call.selected.selection;
  const { typeShape } = call.context;
  const arguments_ = typeShape.getTypeArguments(observed.resultType);
  const sourceType = arguments_.length === 1 ? arguments_[0] : undefined;
  if (sourceType === undefined) return undefined;
  const actual = observed.selection.application.signatureTypeArguments;
  const original = selectTsonicFixedArray(sourceType, call.context,
    { getFact: (subject, key) => readSourceFact(call.context, subject, key) },
    { elementType: actual[0]?.explicitTypeNode, extentType: actual[1]?.explicitTypeNode,
      extent: actual[1]?.explicitTypeNode === undefined ? { length: count.value, lengthRuntimeBase: count.runtimeBase } : undefined });
  if (original?.kind !== "selected" || original.fact.length !== count.value ||
    original.fact.lengthRuntimeBase !== count.runtimeBase) return undefined;
  const application = observed.selection.application;
  const source: MemorySourceProvenance = Object.freeze({ kind: "result", application, component: Object.freeze({
    root: Object.freeze({ kind: "value", node: call.selected.call, type: observed.resultType }),
    path: Object.freeze([{ kind: "type-argument", owner: observed.resultType, index: 0 }]),
    type: sourceType, application }) });
  publishMemoryFact(call, tsonicMemorySourceFactKey,
    createMemorySourcePublication(call.selected.call, { source, owner: undefined }));
  return original.fact;
}
