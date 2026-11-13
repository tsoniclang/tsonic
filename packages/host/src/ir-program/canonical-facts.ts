import type {
  ArgumentTransport, BodyFacts, ClosedArrayFact, MemoryField, MemoryLayout, MetadataFieldRef,
  MetadataKey, MetadataLayoutRef, MetadataRecord, OriginFacts, ProducerRef, RelationalArena,
  RelationalOwner, Summary, SummaryKey,
} from "../ir-facts/contract.js";
import type { TypeRewrite } from "./canonical-types.js";
import type { BodyInstance } from "../ir-types/contract.js";
import { rewriteArtifactBindings, rewriteBindings, rewriteInstance } from "./canonical-types.js";
import { rewriteCallee, rewriteSelection } from "./canonical-tir.js";

function rewriteRelationalOwner(rewrite: TypeRewrite, owner: RelationalOwner): RelationalOwner {
  switch (owner.kind) {
    case "body": return { kind: "body", instance: rewriteInstance(rewrite, owner.instance) };
    case "summary": return { kind: "summary", definition: owner.definition, bindings: rewriteArtifactBindings(rewrite, owner.bindings) };
  }
}

function rewriteProducerRef(rewrite: TypeRewrite, reference: ProducerRef): ProducerRef {
  return { owner: rewriteRelationalOwner(rewrite, reference.owner), producer: reference.producer };
}

function rewriteTransport(rewrite: TypeRewrite, transport: ArgumentTransport): ArgumentTransport {
  return {
    authoredIndex: transport.authoredIndex, parameter: transport.parameter, parameterIndex: transport.parameterIndex,
    repeated: transport.repeated, passing: transport.passing, actual: transport.actual,
    formal: rewriteProducerRef(rewrite, transport.formal), projection: transport.projection,
  };
}

function rewriteArena(rewrite: TypeRewrite, arena: RelationalArena): RelationalArena {
  return {
    projections: arena.projections.map(path => {
      switch (path.projection.kind) {
        case "field":
        case "method-value": return {
          id: path.id, parent: path.parent,
          projection: { kind: path.projection.kind, member: rewriteSelection(rewrite, path.projection.member) },
        };
        case "element":
        case "index":
        case "deref": return path;
      }
    }),
    producers: arena.producers, contexts: arena.contexts,
    boundProducers: arena.boundProducers.map(producer => ({
      id: producer.id, producer: producer.producer, bindings: rewriteBindings(rewrite, producer.bindings), context: producer.context,
    })), origins: arena.origins,
    boundaries: arena.boundaries.map(boundary => ({
      id: boundary.id, kind: boundary.kind, at: boundary.at, subject: boundary.subject, owner: boundary.owner,
      bindings: rewriteBindings(rewrite, boundary.bindings), context: boundary.context, detail: boundary.detail,
    })),
  };
}

function rewriteSummaryKey(rewrite: TypeRewrite, key: SummaryKey): SummaryKey {
  return { definition: key.definition, bindings: rewriteArtifactBindings(rewrite, key.bindings) };
}

function rewriteOrigins(rewrite: TypeRewrite, origins: OriginFacts): OriginFacts {
  return {
    points: origins.points, reads: origins.reads, subjects: origins.subjects, writes: origins.writes, escapes: origins.escapes,
    invocations: origins.invocations.map(invocation => ({
      node: invocation.node, kind: invocation.kind,
      alternatives: invocation.alternatives.map(alternative => ({
        resolution: rewriteCallee(rewrite, alternative.resolution), context: alternative.context,
        arguments: alternative.arguments.map(argument => rewriteTransport(rewrite, argument)),
        result: alternative.result, thrown: alternative.thrown, summary: rewriteSummaryKey(rewrite, alternative.summary),
      })), boundaries: invocation.boundaries,
    })),
    callbacks: origins.callbacks.map(callback => ({
      node: callback.node, argument: rewriteTransport(rewrite, callback.argument), timing: callback.timing,
      rejection: callback.rejection, inputs: callback.inputs,
    })),
    activations: origins.activations.map(activation => ({
      node: activation.node, activation: rewriteInstance(rewrite, activation.activation), context: activation.context, caller: activation.caller,
      entry: activation.entry === null ? null : rewriteTransport(rewrite, activation.entry),
    })), frontiers: origins.frontiers,
    constructions: origins.constructions.map(construction => ({
      node: construction.node, root: construction.root, allocation: construction.allocation, implementation: construction.implementation,
      body: construction.body === null ? null : rewriteInstance(rewrite, construction.body), regions: construction.regions,
    })), instanceRegions: origins.instanceRegions,
  };
}

function rewriteMetadataKey(rewrite: TypeRewrite, key: MetadataKey): MetadataKey {
  return { definition: key.definition, bindings: rewriteArtifactBindings(rewrite, key.bindings) };
}

function rewriteLayoutRef(rewrite: TypeRewrite, reference: MetadataLayoutRef): MetadataLayoutRef {
  return { metadata: rewriteMetadataKey(rewrite, reference.metadata), layout: reference.layout };
}

function rewriteFieldRef(rewrite: TypeRewrite, reference: MetadataFieldRef): MetadataFieldRef {
  return { metadata: rewriteMetadataKey(rewrite, reference.metadata), field: reference.field };
}

function rewriteClosedArray(rewrite: TypeRewrite, fact: ClosedArrayFact): ClosedArrayFact {
  switch (fact.kind) {
    case "unproven": return fact;
    case "closed": return {
      node: fact.node, kind: "closed", declarations: fact.declarations, references: fact.references,
      literals: fact.literals, elements: fact.elements.map(element => rewriteSelection(rewrite, element)),
    };
  }
}

export function rewriteBodyFacts(rewrite: TypeRewrite, facts: BodyFacts, instance: BodyInstance): BodyFacts {
  return {
    instance, arena: rewriteArena(rewrite, facts.arena),
    liveness: facts.liveness, initialization: facts.initialization, refinements: facts.refinements,
    origins: rewriteOrigins(rewrite, facts.origins), suspension: facts.suspension,
    errorStorage: facts.errorStorage, pointerBacking: facts.pointerBacking,
    observations: facts.observations.map(observation => ({
      node: observation.node, operation: observation.operation, operand: observation.operand,
      layout: rewriteLayoutRef(rewrite, observation.layout), field: observation.field === null ? null : rewriteFieldRef(rewrite, observation.field),
      result: rewrite.type(observation.result), value: observation.value, context: observation.context,
      bindings: rewriteBindings(rewrite, observation.bindings),
    })),
    rawLocations: facts.rawLocations.map(location => ({
      node: location.node, operation: location.operation, pointee: rewrite.type(location.pointee),
      layout: rewriteLayoutRef(rewrite, location.layout), context: location.context, bindings: rewriteBindings(rewrite, location.bindings),
    })),
    fieldBindings: facts.fieldBindings.map(binding => ({
      node: binding.node, result: rewrite.type(binding.result), owner: rewrite.type(binding.owner), fieldExpression: binding.fieldExpression,
      field: rewriteFieldRef(rewrite, binding.field), pointer: binding.pointer, pointee: rewrite.type(binding.pointee),
      context: binding.context, bindings: rewriteBindings(rewrite, binding.bindings),
    })),
    recordBindings: facts.recordBindings.map(binding => ({
      node: binding.node, result: rewrite.type(binding.result), layoutExpression: binding.layoutExpression,
      layout: rewriteLayoutRef(rewrite, binding.layout), context: binding.context,
      bindings: rewriteBindings(rewrite, binding.bindings), fields: binding.fields,
    })), memoryBindings: facts.memoryBindings, selectedMemoryDeclarations: facts.selectedMemoryDeclarations,
    closedArrays: facts.closedArrays.map(fact => rewriteClosedArray(rewrite, fact)),
  };
}

function rewriteLayout(rewrite: TypeRewrite, layout: MemoryLayout): MemoryLayout {
  const base = {
    id: layout.id, occurrence: layout.occurrence, source: rewrite.type(layout.source), dataLayout: layout.dataLayout,
    byteSize: layout.byteSize, byteAlignment: layout.byteAlignment, stride: layout.stride,
  };
  switch (layout.kind) {
    case "value": return { ...base, kind: "value", fields: layout.fields };
    case "array": return { ...base, kind: "array", length: layout.length, runtimeBase: layout.runtimeBase, element: layout.element };
  }
}

function rewriteMemoryField(rewrite: TypeRewrite, field: MemoryField): MemoryField {
  return {
    id: field.id, occurrence: field.occurrence, owner: rewrite.type(field.owner), selector: field.selector,
    selection: field.selection, member: rewriteSelection(rewrite, field.member), primary: field.primary,
    selectedDeclarations: field.selectedDeclarations, value: rewrite.type(field.value), layout: field.layout,
    byteOffset: field.byteOffset, byteAlignment: field.byteAlignment,
  };
}

export function rewriteMetadata(rewrite: TypeRewrite, metadata: MetadataRecord): MetadataRecord {
  const key = rewriteMetadataKey(rewrite, metadata.key);
  switch (metadata.kind) {
    case "data-layout": return {
      key, kind: "data-layout", occurrence: metadata.occurrence, fingerprint: metadata.fingerprint,
      byteOrder: metadata.byteOrder, addressWidth: metadata.addressWidth,
    };
    case "memory-layout": return {
      key, kind: "memory-layout", root: metadata.root,
      layouts: metadata.layouts.map(layout => rewriteLayout(rewrite, layout)), fields: metadata.fields.map(field => rewriteMemoryField(rewrite, field)),
    };
    case "memory-field": return {
      key, kind: "memory-field", root: metadata.root,
      layouts: metadata.layouts.map(layout => rewriteLayout(rewrite, layout)), fields: metadata.fields.map(field => rewriteMemoryField(rewrite, field)),
    };
  }
}

export function rewriteSummary(rewrite: TypeRewrite, summary: Summary, key: SummaryKey): Summary {
  return {
    key, signature: rewrite.signature(summary.signature), arena: rewriteArena(rewrite, summary.arena),
    parameters: summary.parameters, captures: summary.captures, result: summary.result, thrown: summary.thrown,
    writes: summary.writes, retention: summary.retention, callbacks: summary.callbacks,
    invocationOnlyParameters: summary.invocationOnlyParameters, suspends: summary.suspends, bindingDependent: summary.bindingDependent,
  };
}
