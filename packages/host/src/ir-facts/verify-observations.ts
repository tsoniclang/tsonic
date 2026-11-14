import type { Violation } from "../diag/contract.js";
import type { NodeId, SourceNodeRef, TyId } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type { HirNode, HirObservationCapture } from "../ir-hir/contract.js";
import { childrenOfSyntax } from "../ir-hir/index.js";
import type { BindingValues, BindingVector } from "../ir-types/contract.js";
import { bindingVectorKey, rigidBindings, substituteBindingValues } from "../ir-types/index.js";
import type { FactsRule, FactsSite, ObservationVerificationContext, MetadataKey, VerifyObservations } from "./contract.js";
import { observationBindingInputs, sameBindings, validIndex, verifyFactBindings } from "./verify-relations.js";

const sourceKey = (source: SourceNodeRef): string => encodeKey([source.kind,
  source.kind === "body" ? source.value.body : source.value.owner, source.value.node]);

function descriptorBindings(node: HirNode | null, occurrence: SourceNodeRef, kind: "value" | "array" | "field"): BindingVector | null {
  const annotation = node?.tsonic;
  if (annotation === undefined || annotation === null || !("core" in annotation)) return null;
  const value = "value" in annotation ? annotation.value : annotation;
  const memory = "memory" in value ? value.memory : null;
  return memory !== null && memory.kind === "available" && memory.value !== null && memory.value.kind === kind
    && sourceKey(memory.value.occurrence) === sourceKey(occurrence) && memory.value.bindings.kind === "available"
    ? memory.value.bindings.value : null;
}

const descriptorAgrees = (key: MetadataKey, expected: BindingVector | undefined, context: ObservationVerificationContext): boolean => {
  if (expected === undefined) return false;
  if (key.bindings.kind === "instantiated") return bindingVectorKey(expected) === bindingVectorKey(key.bindings.bindings);
  const scope = context.bindingScopeOf(key.definition);
  return scope !== null && bindingVectorKey(expected) === bindingVectorKey(rigidBindings(scope));
};

export const verifyObservations: VerifyObservations = (observations, input) => {
  const context = input.facts;
  const violations: Violation<FactsRule, FactsSite>[] = [];
  const instance = observations.instance;
  const root: FactsSite = { kind: "body", instance };
  const at = (node: NodeId): FactsSite => ({ kind: "node", at: { kind: "body", value: { body: instance.body, node } } });
  const report = (rule: FactsRule, site: FactsSite, text: string): void => {
    violations.push({ rule, site, detail: [{ kind: "text", value: text }] });
  };
  if (input.source.body !== instance.body || context.bodyOwner(instance.body) !== input.source.owner) {
    report("cross-owner-qualified", root, "Observations belong to their exact checked body instance.");
  }
  const nestedRoots = new Set<NodeId>();
  for (const body of input.source.nestedBodies) {
    const nested = input.bodyOf(body);
    if (nested === null) report("cross-owner-qualified", root, "Every nested execution has its actual checked source body.");
    else nestedRoots.add(nested.root.id);
  }
  const captures = new Map<NodeId, HirObservationCapture>();
  const visited = new Set<NodeId>();
  const pending: HirNode[] = [input.source.root];
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    if (visited.has(node.id) || node !== input.source.root && nestedRoots.has(node.id)) continue;
    visited.add(node.id);
    const annotation = node.tsonic;
    if (annotation !== null && "core" in annotation) {
      const value = "value" in annotation ? annotation.value : annotation;
      const captured = "observation" in value ? value.observation : null;
      if (captured !== null) {
        if (captured.kind === "unavailable") {
          report("observation-field-exact", at(node.id), "An unavailable observation capture cannot establish a complete static observation result.");
        } else if (captured.value !== null) {
          if (captured.value.occurrence.body !== instance.body || captured.value.occurrence.node !== node.id) {
            report("cross-owner-qualified", at(node.id), "An observation retains its actual qualified checked occurrence.");
          }
          captures.set(node.id, captured.value);
        }
      }
    }
    for (const child of childrenOfSyntax(node)) pending.push(child);
  }
  const types: TyId[] = [];
  const bindings: BindingVector[] = [];
  const positions = new Map<NodeId, { readonly type: number | null; readonly bindings: number | null }>();
  for (const [node, capture] of captures) {
    const type = capture.result.kind === "available" && validIndex(capture.result.value, context.types.terms.length) ? types.length : null;
    const binding = capture.bindings.kind === "available" ? bindings.length : null;
    if (type !== null && capture.result.kind === "available") types.push(capture.result.value);
    if (binding !== null && capture.bindings.kind === "available") bindings.push(capture.bindings.value);
    positions.set(node, { type, bindings: binding });
  }
  const descriptorPositions = new Map<NodeId, { readonly layout: number | null; readonly field: number | null }>();
  for (const row of observations.rows) {
    const metadata = context.metadataOf(row.layout.metadata);
    const layout = metadata === null || metadata.kind === "data-layout" ? undefined : metadata.layouts[row.layout.layout];
    const layoutBindings = layout === undefined ? null : descriptorBindings(input.nodeOf(layout.occurrence), layout.occurrence, layout.kind);
    const layoutPosition = layoutBindings === null ? null : bindings.length;
    if (layoutBindings !== null) bindings.push(layoutBindings);
    const fieldMetadata = row.field === null ? null : context.metadataOf(row.field.metadata);
    const field = row.field === null || fieldMetadata === null || fieldMetadata.kind === "data-layout"
      ? undefined : fieldMetadata.fields[row.field.field];
    const fieldBindings = field === undefined ? null : descriptorBindings(input.nodeOf(field.occurrence), field.occurrence, "field");
    const fieldPosition = fieldBindings === null ? null : bindings.length;
    if (fieldBindings !== null) bindings.push(fieldBindings);
    descriptorPositions.set(row.node, { layout: layoutPosition, field: fieldPosition });
  }
  let selected: BindingValues = { types, bindings };
  if (instance.bindings.kind === "instantiated") {
    const transformed = substituteBindingValues(input.types, selected, instance.bindings.bindings, input.typeExpansion);
    if (transformed.kind === "resource-limit") return transformed;
    selected = transformed.value;
  }
  const seen = new Set<NodeId>();
  let previous: NodeId | null = null;
  for (const row of observations.rows) {
    const site = at(row.node);
    if (previous !== null && previous >= row.node || seen.has(row.node)) {
      report("observations-order", site, "Observation rows retain distinct canonical source-node order.");
    }
    previous = row.node;
    seen.add(row.node);
    const capture = captures.get(row.node);
    const descriptors = descriptorPositions.get(row.node);
    const position = positions.get(row.node);
    const actualType = position === undefined || position.type === null ? undefined : selected.types[position.type];
    const actualBindings = position === undefined || position.bindings === null ? undefined : selected.bindings[position.bindings];
    const occurrence: SourceNodeRef = { kind: "body", value: { body: instance.body, node: row.node } };
    if (!context.nodeExists(occurrence) || input.nodeOf(occurrence) === null || capture === undefined
      || row.operation !== capture.operation || row.operand.body !== capture.operand.body || row.operand.node !== capture.operand.node
      || actualBindings === undefined || bindingVectorKey(actualBindings) !== bindingVectorKey(row.bindings)
      || actualType === undefined || !validIndex(actualType, context.types.terms.length) || actualType !== row.result) {
      report("observation-field-exact", site, "An observation retains the actual operation, operand, result and complete checked occurrence bindings.");
    }
    if (!validIndex(row.result, context.types.terms.length)) report("type-resolves", site, "An observation result resolves in the canonical type table.");
    if (!context.nodeExists({ kind: "body", value: row.operand })) report("node-resolves", site, "An observation operand retains its qualified checked source occurrence.");
    const metadata = context.metadataOf(row.layout.metadata);
    const layout = metadata === null || metadata.kind === "data-layout" ? undefined : metadata.layouts[row.layout.layout];
    if (metadata === null || metadata.kind === "data-layout" || layout === undefined || !validIndex(row.layout.layout, metadata.layouts.length)
      || layout.id !== row.layout.layout || metadata.key.definition !== row.layout.metadata.definition
      || !sameBindings(metadata.key.bindings, row.layout.metadata.bindings)) {
      report("metadata-reference-resolves", site, "An observation retains its actual selected layout record and complete bindings.");
    }
    if (layout !== undefined && (capture === undefined || capture.layout.kind !== "available"
      || sourceKey(capture.layout.value) !== sourceKey(layout.occurrence) || input.nodeOf(layout.occurrence) === null
      || descriptors === undefined || descriptors.layout === null || !descriptorAgrees(row.layout.metadata, selected.bindings[descriptors.layout], context))) {
      report("observation-field-exact", site, "The layout is selected by the actual checked descriptor occurrence, never by its type.");
    }
    const fieldMetadata = row.field === null ? null : context.metadataOf(row.field.metadata);
    const field = row.field === null || fieldMetadata === null || fieldMetadata.kind === "data-layout"
      ? undefined : fieldMetadata.fields[row.field.field];
    if (row.field !== null && (fieldMetadata === null || fieldMetadata.kind === "data-layout" || field === undefined
      || !validIndex(row.field.field, fieldMetadata.fields.length) || field.id !== row.field.field
      || fieldMetadata.key.definition !== row.field.metadata.definition || !sameBindings(fieldMetadata.key.bindings, row.field.metadata.bindings))) {
      report("metadata-reference-resolves", site, "An observation retains its actual selected field record and complete bindings.");
    }
    if (row.operation === "field-offset") {
      if (row.field === null || field === undefined || fieldMetadata === null || fieldMetadata.kind === "data-layout"
        || !validIndex(row.field.field, fieldMetadata.fields.length) || field.id !== row.field.field
        || fieldMetadata.key.definition !== row.field.metadata.definition || !sameBindings(fieldMetadata.key.bindings, row.field.metadata.bindings)
        || capture === undefined || capture.field.kind !== "available" || capture.field.value === null
        || sourceKey(capture.field.value) !== sourceKey(field.occurrence) || input.nodeOf(field.occurrence) === null
        || descriptors === undefined || descriptors.field === null || !descriptorAgrees(row.field.metadata, selected.bindings[descriptors.field], context)
        || layout !== undefined && field.owner !== layout.source) {
        report("observation-field-exact", site, "A field-offset observation retains its exact checked field selection and owner layout.");
      }
    } else if (row.field !== null) report("observation-field-exact", site, "Only field-offset observations select a field.");
    const expected = layout === undefined ? undefined : row.operation === "size" ? layout.byteSize
      : row.operation === "alignment" ? layout.byteAlignment : row.operation === "stride" ? layout.stride : field?.byteOffset;
    if (expected !== undefined && expected !== row.value) {
      report("observation-exact-value", site, "The observation retains the exact selected layout or field integer value.");
    }
  }
  for (const node of captures.keys()) if (!seen.has(node)) report("observation-field-exact", at(node), "Every checked observation has its one static result row.");
  for (const violation of verifyFactBindings(observationBindingInputs(observations, context), { kind: "observations", instance }, root, context)) {
    violations.push(violation);
  }
  return { kind: "complete", violations };
};
