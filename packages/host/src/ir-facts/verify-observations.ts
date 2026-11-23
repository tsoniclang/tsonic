import type { DataflowAccount, DataflowResult, DataflowStop } from "../dataflow/contract.js";
import { chargeResultEntries, chargeWork } from "../dataflow/index.js";
import { admitArtifactIdentity, admitBindingIdentity, recordFinding } from "./verification.js";
import { sameSource } from "./verify-position.js";
import type { Violation } from "../diag/contract.js";
import type { NodeId, SourceNodeRef, TyId } from "../ids/contract.js";
import type { HirNode, HirObservationCapture } from "../ir-hir/contract.js";
import { iterateChildrenOfSyntax } from "../ir-hir/index.js";
import type { ProjectedBindingValues, BindingVector } from "../ir-types/contract.js";
import { bindingVectorKey, rigidBindings, projectBindingValues } from "../ir-types/index.js";
import type { FactsRule, FactsSite, MemoryField, MemoryLayout, MetadataRecord, ObservationDescriptorEvidence, ObservationSourceEvidence, ObservationVerificationContext, MetadataKey, VerifyObservations } from "./contract.js";
import { sameBindings, validIndex } from "./verify-relations.js";
import { observationBindingInputs } from "./binding-inputs.js";
import { verifyFactBindings } from "./verify-bindings.js";

function descriptorBindings(node: HirNode | null, evidence: ObservationDescriptorEvidence, kind: "value" | "array" | "field",
  account: DataflowAccount): DataflowResult<BindingVector | null> {
  const initial = chargeWork(account, 1);
  if (initial !== null) return initial;
  const annotation = node?.tsonic;
  if (annotation === undefined || annotation === null || !("core" in annotation)) return { kind: "complete", value: null };
  const value = "value" in annotation ? annotation.value : annotation;
  const memory = "memory" in value ? value.memory : null;
  if (memory === null || memory.kind !== "available" || memory.value === null || memory.value.kind !== kind)
    return { kind: "complete", value: null };
  const same = sameSource(memory.value.occurrence, evidence.occurrence, account);
  return same.kind !== "complete" ? same : { kind: "complete", value: same.value ? evidence.bindings : null };
}

function descriptorAgrees(key: MetadataKey, expected: BindingVector | undefined,
  context: ObservationVerificationContext, account: DataflowAccount): DataflowResult<boolean> {
  const start = chargeWork(account, 1);
  if (start !== null) return start;
  if (expected === undefined) return { kind: "complete", value: false };
  const admitted = admitBindingIdentity(expected, account) ?? admitArtifactIdentity(key.bindings, account);
  if (admitted !== null) return admitted;
  if (key.bindings.kind === "instantiated")
    return { kind: "complete", value: bindingVectorKey(expected) === bindingVectorKey(key.bindings.bindings) };
  const scope = context.bindingScopeOf(key.definition);
  if (scope === null) return { kind: "complete", value: false };
  const initial = chargeResultEntries(account, 5);
  if (initial !== null) return initial;
  for (const parameters of [scope.classParameters, scope.methodParameters, scope.capturedParameters]) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    for (const parameter of parameters) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
      const stop = chargeWork(account, 1 + parameter.length) ?? chargeResultEntries(account, 1);
      if (stop !== null) return stop;
    }
  }
  for (const owner of scope.selfOwners) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    const stop = chargeWork(account, 1 + owner.length) ?? chargeResultEntries(account, 2);
    if (stop !== null) return stop;
  }
  return { kind: "complete", value: bindingVectorKey(expected) === bindingVectorKey(rigidBindings(scope)) };
}

function containingField(layout: MemoryLayout, metadata: Exclude<MetadataRecord, { readonly kind: "data-layout" }>, selected: MemoryField,
  account: DataflowAccount): DataflowResult<boolean> {
  const initial = chargeWork(account, 1);
  if (initial !== null) return initial;
  if (layout.kind !== "value") return { kind: "complete", value: false };
  const fields = metadata.fields;
  const references = layout.fields;
  for (let position = 0; position < references.length; position += 1) {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const id = references[position];
    if (id === undefined || !validIndex(id, fields.length)) return { kind: "complete", value: false };
    const row = fields[id];
    if (row === undefined || row.id !== id) return { kind: "complete", value: false };
    const occurrence = sameSource(row.occurrence, selected.occurrence, account);
    if (occurrence.kind !== "complete") return occurrence;
    if (!occurrence.value) continue;
    const compares = chargeWork(account, 1);
    if (compares !== null) return compares;
    return { kind: "complete", value: row.owner === selected.owner && row.value === selected.value &&
      row.byteOffset === selected.byteOffset && row.byteAlignment === selected.byteAlignment };
  }
  return { kind: "complete", value: false };
}

export const verifyObservations: VerifyObservations = (observations, input) => {
  const { account } = input;
  const initial = chargeWork(account, 1) ?? chargeResultEntries(account, 9);
  if (initial !== null) return initial;
  const context = input.facts;
  const violations: Violation<FactsRule, FactsSite>[] = [];
  const instance = observations.instance;
  const root: FactsSite = { kind: "body", instance };
  const at = (node: NodeId): FactsSite => ({ kind: "node", at: { kind: "body", value: { body: instance.body, node } } });
  const report = (rule: FactsRule, site: FactsSite, text: string): DataflowStop | null =>
    recordFinding(account, violations, "last", rule, site, text);
  if (input.source.body !== instance.body || context.bodyOwner(instance.body) !== input.source.owner) {
    { const stop = report("cross-owner-qualified", root, "Observations belong to their exact checked body instance."); if (stop !== null) return stop; }
  }
  const nestedRoots = new Set<NodeId>();
  for (const body of input.source.nestedBodies) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    const nested = input.bodyOf(body);
    if (nested === null) { const stop = report("cross-owner-qualified", root, "Every nested execution has its actual checked source body."); if (stop !== null) return stop; }
    else {
      const stop = chargeResultEntries(account, 2);
      if (stop !== null) return stop;
      nestedRoots.add(nested.root.id);
    }
  }
  const captures = new Map<NodeId, HirObservationCapture>();
  const visited = new Set<NodeId>();
  const pending: HirNode[] = [input.source.root];
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    if (visited.has(node.id) || node !== input.source.root && nestedRoots.has(node.id)) continue;
    { const stop = chargeResultEntries(account, 2); if (stop !== null) return stop; }
    visited.add(node.id);
    const annotation = node.tsonic;
    if (annotation !== null && "core" in annotation) {
      const value = "value" in annotation ? annotation.value : annotation;
      const captured = "observation" in value ? value.observation : null;
      if (captured !== null) {
        if (captured.kind === "unavailable") {
          { const stop = report("observation-field-exact", at(node.id), "An unavailable observation capture cannot establish a complete static observation result."); if (stop !== null) return stop; }
        } else if (captured.value !== null) {
          if (captured.value.occurrence.body !== instance.body || captured.value.occurrence.node !== node.id) {
            { const stop = report("cross-owner-qualified", at(node.id), "An observation retains its actual qualified checked occurrence."); if (stop !== null) return stop; }
          }
          { const stop = chargeResultEntries(account, 2); if (stop !== null) return stop; }
    captures.set(node.id, captured.value);
        }
      }
    }
    const children = iterateChildrenOfSyntax(node);
    for (;;) {
      const stop = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
      if (stop !== null) return stop;
      const child = children.next();
      if (child.done) break;
      pending.push(child.value);
    }
  }
  const types: TyId[] = [];
  const bindings: BindingVector[] = [];
  const positions = new Map<NodeId, { readonly type: number | null; readonly bindings: number | null; readonly evidence: ObservationSourceEvidence | null }>();
  for (const [node, capture] of captures) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    const type = capture.result.kind === "available" && validIndex(capture.result.value, context.types.terms.length) ? types.length : null;
    const ready = context.observationSourceOf(account, instance, node);
    if (ready.kind !== "complete") return ready;
    const evidence = ready.value;
    const vector = evidence?.bindings ?? null;
    const binding = vector === null ? null : bindings.length;
    if (type !== null && capture.result.kind === "available") types.push(capture.result.value);
    if (vector !== null) bindings.push(vector);
    { const stop = chargeResultEntries(account, 2); if (stop !== null) return stop; }
    positions.set(node, { type, bindings: binding, evidence });
  }
  const descriptorPositions = new Map<NodeId, { readonly layout: number | null; readonly field: number | null }>();
  for (const row of observations.rows) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    const metadata = context.metadataOf(row.layout.metadata);
    const layout = metadata === null || metadata.kind === "data-layout" ? undefined : metadata.layouts[row.layout.layout];
    const selected = positions.get(row.node)?.evidence;
    const layoutBindingResult: DataflowResult<BindingVector | null> = layout === undefined || selected?.layout == null ? { kind: "complete", value: null }
      : descriptorBindings(input.nodeOf(selected.layout.occurrence), selected.layout, layout.kind, account);
    if (layoutBindingResult.kind !== "complete") return layoutBindingResult;
    const layoutBindings = layoutBindingResult.value;
    const layoutPosition = layoutBindings === null ? null : bindings.length;
    if (layoutBindings !== null) bindings.push(layoutBindings);
    const fieldMetadata = row.field === null ? null : context.metadataOf(row.field.metadata);
    const field = row.field === null || fieldMetadata === null || fieldMetadata.kind === "data-layout"
      ? undefined : fieldMetadata.fields[row.field.field];
    const fieldBindingResult: DataflowResult<BindingVector | null> = field === undefined || selected?.field == null ? { kind: "complete", value: null }
      : descriptorBindings(input.nodeOf(selected.field.occurrence), selected.field, "field", account);
    if (fieldBindingResult.kind !== "complete") return fieldBindingResult;
    const fieldBindings = fieldBindingResult.value;
    const fieldPosition = fieldBindings === null ? null : bindings.length;
    if (fieldBindings !== null) bindings.push(fieldBindings);
    { const stop = chargeResultEntries(account, 2); if (stop !== null) return stop; }
    descriptorPositions.set(row.node, { layout: layoutPosition, field: fieldPosition });
  }
  let selected: ProjectedBindingValues = { types, bindings };
  if (instance.bindings.kind === "instantiated" && (types.length !== 0 || bindings.length !== 0)) {
    const transformed = projectBindingValues(input.types, { types, bindings }, instance.bindings.bindings, input.typeExpansion, {
      work: count => chargeWork(account, count), retain: count => chargeResultEntries(account, count),
    });
    if (transformed.kind !== "complete") return transformed;
    selected = transformed.value;
  }
  const seen = new Set<NodeId>();
  let previous: NodeId | null = null;
  for (const row of observations.rows) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    const site = at(row.node);
    if (previous !== null && previous >= row.node || seen.has(row.node)) {
      { const stop = report("observations-order", site, "Observation rows retain distinct canonical source-node order."); if (stop !== null) return stop; }
    }
    previous = row.node;
    { const stop = chargeResultEntries(account, 2); if (stop !== null) return stop; }
    seen.add(row.node);
    const capture = captures.get(row.node);
    const descriptors = descriptorPositions.get(row.node);
    const position = positions.get(row.node);
    const actualType = position === undefined || position.type === null ? undefined : selected.types[position.type] ?? undefined;
    const actualBindings = position === undefined || position.bindings === null ? undefined : selected.bindings[position.bindings] ?? undefined;
    const occurrence: SourceNodeRef = { kind: "body", value: { body: instance.body, node: row.node } };
    const identities = admitBindingIdentity(row.bindings, account)
      ?? (actualBindings === undefined ? null : admitBindingIdentity(actualBindings, account));
    if (identities !== null) return identities;
    if (!context.nodeExists(occurrence) || input.nodeOf(occurrence) === null || capture === undefined
      || row.operation !== capture.operation || row.operand.body !== capture.operand.body || row.operand.node !== capture.operand.node
      || actualBindings === undefined || bindingVectorKey(actualBindings) !== bindingVectorKey(row.bindings)
      || actualType === undefined || !validIndex(actualType, context.types.terms.length) || actualType !== row.result) {
      { const stop = report("observation-field-exact", site, "An observation retains the actual operation, operand, result and complete checked occurrence bindings."); if (stop !== null) return stop; }
    }
    if (!validIndex(row.result, context.types.terms.length)) { const stop = report("type-resolves", site, "An observation result resolves in the canonical type table."); if (stop !== null) return stop; }
    if (!context.nodeExists({ kind: "body", value: row.operand })) { const stop = report("node-resolves", site, "An observation operand retains its qualified checked source occurrence."); if (stop !== null) return stop; }
    const metadata = context.metadataOf(row.layout.metadata);
    const layout = metadata === null || metadata.kind === "data-layout" ? undefined : metadata.layouts[row.layout.layout];
    if (metadata === null || metadata.kind === "data-layout" || layout === undefined || !validIndex(row.layout.layout, metadata.layouts.length)
      || layout.id !== row.layout.layout || metadata.key.definition !== row.layout.metadata.definition
      || !sameBindings(metadata.key.bindings, row.layout.metadata.bindings)) {
      { const stop = report("metadata-reference-resolves", site, "An observation retains its actual selected layout record and complete bindings."); if (stop !== null) return stop; }
    }
    const evidence = position?.evidence;
    const layoutOccurrence: DataflowResult<boolean> = layout === undefined || evidence?.layout == null
      ? { kind: "complete", value: false } : sameSource(evidence.layout.occurrence, layout.occurrence, account);
    if (layoutOccurrence.kind !== "complete") return layoutOccurrence;
    const layoutAgreement: DataflowResult<boolean> = descriptors === undefined || descriptors.layout === null
      ? { kind: "complete", value: false } : descriptorAgrees(row.layout.metadata, selected.bindings[descriptors.layout] ?? undefined, context, account);
    if (layoutAgreement.kind !== "complete") return layoutAgreement;
    if (layout !== undefined && (capture === undefined || evidence?.layout == null
      || !layoutOccurrence.value || input.nodeOf(layout.occurrence) === null
      || descriptors === undefined || descriptors.layout === null || !layoutAgreement.value)) {
      { const stop = report("observation-field-exact", site, "The layout is selected by the actual checked descriptor occurrence, never by its type."); if (stop !== null) return stop; }
    }
    const fieldMetadata = row.field === null ? null : context.metadataOf(row.field.metadata);
    const field = row.field === null || fieldMetadata === null || fieldMetadata.kind === "data-layout"
      ? undefined : fieldMetadata.fields[row.field.field];
    if (row.field !== null && (fieldMetadata === null || fieldMetadata.kind === "data-layout" || field === undefined
      || !validIndex(row.field.field, fieldMetadata.fields.length) || field.id !== row.field.field
      || fieldMetadata.key.definition !== row.field.metadata.definition || !sameBindings(fieldMetadata.key.bindings, row.field.metadata.bindings))) {
      { const stop = report("metadata-reference-resolves", site, "An observation retains its actual selected field record and complete bindings."); if (stop !== null) return stop; }
    }
    const fieldOccurrence: DataflowResult<boolean> = field === undefined || evidence?.field == null ? { kind: "complete", value: false }
      : sameSource(evidence.field.occurrence, field.occurrence, account);
    if (fieldOccurrence.kind !== "complete") return fieldOccurrence;
    const fieldAgreement: DataflowResult<boolean> = row.field === null || descriptors === undefined || descriptors.field === null
      ? { kind: "complete", value: false } : descriptorAgrees(row.field.metadata, selected.bindings[descriptors.field] ?? undefined, context, account);
    if (fieldAgreement.kind !== "complete") return fieldAgreement;
    if (row.operation === "field-offset") {
      if (row.field === null || field === undefined || fieldMetadata === null || fieldMetadata.kind === "data-layout"
        || !validIndex(row.field.field, fieldMetadata.fields.length) || field.id !== row.field.field
        || fieldMetadata.key.definition !== row.field.metadata.definition || !sameBindings(fieldMetadata.key.bindings, row.field.metadata.bindings)
        || capture === undefined || evidence?.field == null
        || !fieldOccurrence.value || input.nodeOf(field.occurrence) === null
        || descriptors === undefined || descriptors.field === null || !fieldAgreement.value
        || layout !== undefined && field.owner !== layout.source) {
        { const stop = report("observation-field-exact", site, "A field-offset observation retains its exact checked field selection and owner layout."); if (stop !== null) return stop; }
      } else if (layout !== undefined && metadata !== null && metadata.kind !== "data-layout") {
        const membership = containingField(layout, metadata, field, account);
        if (membership.kind !== "complete") return membership;
        if (!membership.value) {
          const stop = report("observation-field-exact", site, "The selected field must occur in the actual containing value layout.");
          if (stop !== null) return stop;
        }
      }
    } else if (row.field !== null) { const stop = report("observation-field-exact", site, "Only field-offset observations select a field."); if (stop !== null) return stop; }
    const expected = layout === undefined ? undefined : row.operation === "size" ? layout.byteSize
      : row.operation === "alignment" ? layout.byteAlignment : row.operation === "stride" ? layout.stride : field?.byteOffset;
    if (expected !== undefined && expected !== row.value) {
      { const stop = report("observation-exact-value", site, "The observation retains the exact selected layout or field integer value."); if (stop !== null) return stop; }
    }
  }
  for (const node of captures.keys()) {
    const stop = chargeWork(account, 1);
    if (stop !== null) return stop;
    if (!seen.has(node)) {
    const step = chargeWork(account, 1);
    if (step !== null) return step; const stop = report("observation-field-exact", at(node), "Every checked observation has its one static result row."); if (stop !== null) return stop; }
  }
  const checkedBindings = verifyFactBindings(observationBindingInputs(observations, context), { kind: "observations", instance }, root, context, account);
  if (checkedBindings.kind !== "complete") return checkedBindings;
  for (const violation of checkedBindings.violations) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    { const stop = chargeResultEntries(account, 2); if (stop !== null) return stop; }
    violations.push(violation);
  }
  return { kind: "complete", violations };
};
