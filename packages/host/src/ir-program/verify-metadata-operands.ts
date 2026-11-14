import type { NodeId, SourceNodeRef } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type { BindingVector, TypeInterner } from "../ir-types/contract.js";
import { bindingVectorKey, rigidBindings, substituteBindingValues } from "../ir-types/index.js";
import type { MetadataKey, MetadataRecord } from "../ir-facts/contract.js";
import type { HirFieldBindingCapture } from "../ir-hir/contract.js";
import type { TirVerifierInput } from "../ir-tir/contract.js";
import type { MirOperand, MirRvalue, MirSite, MirTerminator } from "../ir-mir/contract.js";
import type { ModuleBodiesVerification, ProgramVerificationContext, PublishedBody } from "./contract.js";
import type { InstantiationAllocationStop, ProgramLookup, ProgramViolation } from "./program-values.js";
import { artifactEnvironmentKey, chargeInstantiationWork, emitInstantiationRecord, numberDetail, textDetail, uniqueRows } from "./program-values.js";

const sourceKey = (source: SourceNodeRef): string => encodeKey([source.kind,
  source.kind === "body" ? source.value.body : source.value.owner, source.value.node]);
const stopped = (stop: InstantiationAllocationStop): ModuleBodiesVerification => {
  return { kind: "resource-limit", site: { kind: "index" }, dimension: stop.dimension, maximum: stop.maximum };
};
const rootOccurrence = (metadata: MetadataRecord): SourceNodeRef | null => metadata.kind === "data-layout"
  ? metadata.occurrence : metadata.kind === "memory-layout" ? metadata.layouts[metadata.root]?.occurrence ?? null
  : metadata.fields[metadata.root]?.occurrence ?? null;

function authorize(published: PublishedBody, input: TirVerifierInput, lookup: ProgramLookup,
  context: ProgramVerificationContext, types: TypeInterner,
  requests: Iterable<{ readonly node: NodeId; readonly key: MetadataKey }>, allowed: Map<NodeId, Set<string>>): ModuleBodiesVerification {
  const candidates: { readonly node: NodeId; readonly key: MetadataKey; readonly vector: number }[] = [];
  const vectors: BindingVector[] = [];
  function allow(node: NodeId, key: MetadataKey): InstantiationAllocationStop | null {
    const stop = emitInstantiationRecord(context.resources);
    if (stop !== null) return stop;
    const encoded = artifactEnvironmentKey(key.definition, key.bindings);
    const existing = allowed.get(node);
    if (existing === undefined) allowed.set(node, new Set([encoded]));
    else existing.add(encoded);
    return null;
  }
  for (const row of published.observations.rows) {
    const stop = allow(row.node, row.layout.metadata);
    if (stop !== null) return stopped(stop);
    if (row.field !== null) {
      const stop = allow(row.node, row.field.metadata);
      if (stop !== null) return stopped(stop);
    }
  }
  const consider = (node: NodeId, key: MetadataKey, record: MetadataRecord,
    source: SourceNodeRef, bindings: BindingVector): InstantiationAllocationStop | null => {
    const actual = rootOccurrence(record);
    if (actual === null || sourceKey(actual) !== sourceKey(source) || input.nodeOf(source) === null) return null;
    const stop = emitInstantiationRecord(context.resources);
    if (stop !== null) return stop;
    const vector = vectors.length;
    vectors.push(bindings);
    candidates.push({ node, key, vector });
    return null;
  };
  const field = (node: NodeId, key: MetadataKey, record: MetadataRecord,
    capture: HirFieldBindingCapture): InstantiationAllocationStop | null => {
    if (capture.occurrence.body !== published.instance.body
      || capture.field.kind !== "available" || capture.bindings.kind !== "available") return null;
    if (record.kind === "memory-field") return consider(node, key, record, capture.field.value, capture.bindings.value);
    if (record.kind !== "memory-layout") return null;
    const selected = input.nodeOf(capture.field.value)?.tsonic;
    if (selected === undefined || selected === null || !("value" in selected)) return null;
    const memory = "memory" in selected.value ? selected.value.memory : null;
    if (memory === null || memory.kind !== "available" || memory.value === null || memory.value.kind !== "field"
      || sourceKey(memory.value.occurrence) !== sourceKey(capture.field.value) || memory.value.fieldLayout.kind !== "available") return null;
    const layout = input.nodeOf(memory.value.fieldLayout.value)?.tsonic;
    if (layout === undefined || layout === null || !("value" in layout)) return null;
    const descriptor = "memory" in layout.value ? layout.value.memory : null;
    if (descriptor === null || descriptor.kind !== "available" || descriptor.value === null
      || (descriptor.value.kind !== "value" && descriptor.value.kind !== "array")
      || sourceKey(descriptor.value.occurrence) !== sourceKey(memory.value.fieldLayout.value)
      || descriptor.value.bindings.kind !== "available") return null;
    return consider(node, key, record, memory.value.fieldLayout.value, descriptor.value.bindings.value);
  };
  for (const request of requests) {
    const stop = chargeInstantiationWork(context.resources);
    if (stop !== null) return stopped(stop);
    const source: SourceNodeRef = { kind: "body", value: { body: published.instance.body, node: request.node } };
    const node = input.nodeOf(source);
    const annotation = node?.tsonic;
    const record = lookup.metadata.get(artifactEnvironmentKey(request.key.definition, request.key.bindings));
    if (annotation === undefined || annotation === null || !("core" in annotation) || record === undefined || record === null) continue;
    const capturedField = annotation.core.fieldBinding;
    if (capturedField.kind === "available" && capturedField.value !== null && capturedField.value.occurrence.node === request.node) {
      const stop = field(request.node, request.key, record, capturedField.value);
      if (stop !== null) return stopped(stop);
    }
    const pointer = annotation.core.pointerOperation;
    if (pointer.kind === "available" && pointer.value !== null && pointer.value.family === "raw-memory") {
      const operation = pointer.value;
      const descriptor = operation.operation === "to-raw" || operation.operation === "reinterpret" ? operation.layout : operation.dataLayout;
      const expectedKind = operation.operation === "to-raw" || operation.operation === "reinterpret" ? "memory-layout" : "data-layout";
      const selected = input.nodeOf(descriptor)?.tsonic;
      if (record.kind === expectedKind && selected !== undefined && selected !== null && "core" in selected) {
        const value = "value" in selected ? selected.value : selected;
        const memory = "memory" in value ? value.memory : null;
        const kind = record.kind === "memory-layout" ? record.layouts[record.root]?.kind : record.kind;
        if (memory !== null && memory.kind === "available" && memory.value !== null && memory.value.bindings.kind === "available"
          && memory.value.kind === kind && sourceKey(memory.value.occurrence) === sourceKey(descriptor)) {
          const stop = consider(request.node, request.key, record, descriptor, memory.value.bindings.value);
          if (stop !== null) return stopped(stop);
        }
      }
    }
    const capturedRecord = annotation.core.recordBinding;
    if (capturedRecord.kind === "available" && capturedRecord.value !== null) {
      const capture = capturedRecord.value;
      if (capture.occurrence.body !== published.instance.body || capture.occurrence.node !== request.node) continue;
      if (record.kind === "memory-layout" && capture.layout.kind === "available" && capture.bindings.kind === "available") {
        const stop = consider(request.node, request.key, record, capture.layout.value, capture.bindings.value);
        if (stop !== null) return stopped(stop);
      }
      for (const linked of capture.fields) {
        const stop = chargeInstantiationWork(context.resources);
        if (stop !== null) return stopped(stop);
        const linkedNode = input.nodeOf({ kind: "body", value: linked.binding });
        const linkedAnnotation = linkedNode?.tsonic;
        if (linkedAnnotation === undefined || linkedAnnotation === null || !("core" in linkedAnnotation)) continue;
        const linkedCapture = linkedAnnotation.core.fieldBinding;
        if (linkedCapture.kind === "available" && linkedCapture.value !== null
          && linkedCapture.value.occurrence.body === linked.binding.body && linkedCapture.value.occurrence.node === linked.binding.node) {
          const stop = field(request.node, request.key, record, linkedCapture.value);
          if (stop !== null) return stopped(stop);
        }
      }
    }
  }
  let selected: readonly BindingVector[] = vectors;
  if (published.instance.bindings.kind === "instantiated") {
    const transformed = substituteBindingValues(types, { types: [], bindings: vectors },
      published.instance.bindings.bindings, context.resources.limits.typeExpansion);
    if (transformed.kind === "resource-limit") return { ...transformed, site: { kind: "body", instance: published.instance } };
    selected = transformed.value.bindings;
  }
  for (const candidate of candidates) {
    const vector = selected[candidate.vector];
    const scope = candidate.key.bindings.kind === "parametric" ? context.facts.bindingScopeOf(candidate.key.definition) : null;
    const expected = candidate.key.bindings.kind === "instantiated" ? candidate.key.bindings.bindings
      : scope === null ? null : rigidBindings(scope);
    if (vector !== undefined && expected !== null && bindingVectorKey(vector) === bindingVectorKey(expected)) {
      const stop = allow(candidate.node, candidate.key);
      if (stop !== null) return stopped(stop);
    }
  }
  return { kind: "complete", violations: [] };
}

export function verifyMetadataOperands(published: PublishedBody, input: TirVerifierInput, lookup: ProgramLookup,
  context: ProgramVerificationContext, types: TypeInterner): ModuleBodiesVerification {
  const allowed = new Map<NodeId, Set<string>>();
  const requested = new Map<string, { readonly node: NodeId; readonly key: MetadataKey;
    readonly uses: { readonly constant: number; readonly path: string }[] }>();
  let refusal: InstantiationAllocationStop | null = null;
  const constants = uniqueRows(published.mir.constants, constant => encodeKey([constant.id]));
  const constantKeys = new Map<string, string>();
  const violations: ProgramViolation[] = [];
  function operand(value: MirOperand, site: MirSite, path: string): void {
    if (refusal !== null || value.kind !== "constant") return;
    refusal = chargeInstantiationWork(context.resources);
    if (refusal !== null) return;
    const identity = encodeKey([value.constant]);
    const constant = constants.get(identity);
    if (constant === undefined || constant === null || constant.value.kind !== "metadata") return;
    let key = constantKeys.get(identity);
    if (key === undefined) {
      key = artifactEnvironmentKey(constant.value.definition, constant.value.bindings);
      constantKeys.set(identity, key);
    }
    if (site.tir.body !== published.instance.body) {
      violations.push({ rule: "metadata-constant-not-materialised", site: { kind: "body", instance: published.instance },
        detail: [textDetail(path), numberDetail(value.constant), textDetail(key)] });
      return;
    }
    const position = encodeKey([site.tir.node, key]);
    let request = requested.get(position);
    if (request === undefined) {
      refusal = emitInstantiationRecord(context.resources);
      if (refusal !== null) return;
      request = { node: site.tir.node, key: constant.value, uses: [] };
      requested.set(position, request);
    }
    refusal = emitInstantiationRecord(context.resources);
    if (refusal !== null) return;
    request.uses.push({ constant: value.constant, path });
  }
  function rvalue(value: MirRvalue, site: MirSite, path: string): void {
    switch (value.kind) {
      case "use":
      case "unary":
      case "convert": operand(value.operand, site, path + ".operand"); break;
      case "binary":
        operand(value.left, site, path + ".left");
        if (refusal !== null) return;
        operand(value.right, site, path + ".right");
        break;
      case "aggregate":
        switch (value.aggregate.kind) {
          case "array":
          case "tuple":
          case "fixed-array":
            for (const [position, entry] of value.aggregate.elements.entries()) {
              operand(entry, site, path + ".aggregate.elements[" + position + "]");
              if (refusal !== null) return;
            }
            break;
          case "object":
          case "record":
            for (const [position, field] of value.aggregate.fields.entries()) {
              operand(field.value, site, path + ".aggregate.fields[" + position + "].value");
              if (refusal !== null) return;
            }
            break;
        }
        break;
      case "address-of":
      case "closure": break;
    }
  }
  function terminator(value: MirTerminator, path: string): void {
    switch (value.kind) {
      case "goto":
      case "unreachable": break;
      case "switch":
        operand(value.operand, value, path + ".operand");
        if (refusal !== null) return;
        for (const [position, target] of value.targets.entries()) {
          operand({ kind: "constant", constant: target.constant }, value, path + ".targets[" + position + "].constant");
          if (refusal !== null) return;
        }
        break;
      case "call":
        if (value.callee.kind === "indirect") operand(value.callee.operand, value, path + ".callee.operand");
        if (refusal !== null) return;
        if (value.receiver !== null) operand(value.receiver, value, path + ".receiver");
        if (refusal !== null) return;
        for (const [position, argument] of value.arguments.entries()) {
          if (argument.kind === "value") operand(argument.operand, value, path + ".arguments[" + position + "].operand");
          if (refusal !== null) return;
        }
        break;
      case "invoke":
        for (const [position, entry] of value.operands.entries()) {
          operand(entry, value, path + ".operands[" + position + "]");
          if (refusal !== null) return;
        }
        break;
      case "await":
      case "throw": operand(value.operand, value, path + ".operand"); break;
      case "yield": if (value.operand !== null) operand(value.operand, value, path + ".operand"); break;
      case "delegate": operand(value.iterator, value, path + ".iterator"); break;
      case "return": if (value.value !== null) operand(value.value, value, path + ".value"); break;
    }
  }
  for (const [blockIndex, block] of published.mir.blocks.entries()) {
    const path = "mir.blocks[" + blockIndex + "]";
    for (const [position, statement] of block.statements.entries()) {
      switch (statement.kind) {
        case "storage-live":
        case "storage-dead": break;
        case "assign": rvalue(statement.value, statement, path + ".statements[" + position + "].value"); break;
      }
      if (refusal !== null) return stopped(refusal);
    }
    terminator(block.terminator, path + ".terminator");
    if (refusal !== null) return stopped(refusal);
  }
  const authorization = authorize(published, input, lookup, context, types, requested.values(), allowed);
  if (authorization.kind === "resource-limit") return authorization;
  for (const request of requested.values()) {
    const key = artifactEnvironmentKey(request.key.definition, request.key.bindings);
    if (!allowed.get(request.node)?.has(key)) for (const use of request.uses) {
      const stop = chargeInstantiationWork(context.resources) ?? emitInstantiationRecord(context.resources);
      if (stop !== null) return stopped(stop);
      violations.push({ rule: "metadata-constant-not-materialised", site: { kind: "body", instance: published.instance },
        detail: [textDetail(use.path), numberDetail(use.constant), textDetail(key)] });
    }
  }
  return { kind: "complete", violations };
}
