import type {
  ArgumentTransport, BodyFacts, BodyObservations, ClosedArrayFact, MemoryField, MemoryLayout,
  MetadataFieldRef, MetadataKey, MetadataLayoutRef, MetadataRecord, OriginFacts, Summary, SummaryKey,
} from "../ir-facts/contract.js";
import type { BindingVector, BodyInstance, Execution } from "../ir-types/contract.js";
import { instanceKey } from "../ir-types/index.js";
import { chargeWork } from "../dataflow/index.js";
import { admitArtifactIdentity, admitSummaryIdentity, argumentTransportKey, compareBoundActivations,
  compareConstructionAlternatives, escapeTargetKey, summaryPositionKey } from "../ir-facts/index.js";
import type { TypeReferenceRewrite } from "./canonical-types.js";
import type { ProjectionInventory, ProjectionResult } from "./program-values.js";
import {
  copiedProjection, finishProjection, followingProjection, prepareArtifactBindings, prepareBindingsProjection,
  prepareInstance, orderProjection, projectRead, projectRecord, projectRows,
} from "./program-values.js";
import { prepareCallee, prepareSelection } from "./instantiate-phase.js";
import { prepareExecution, prepareRelationalOwner, prepareRelationalArena, prepareSummary, prepareSummaryKey } from "./instantiate-facts.js";

export function projectInstance(scan: ProjectionInventory, image: TypeReferenceRewrite, instance: BodyInstance):
  ProjectionResult<BodyInstance> {
  return finishProjection(scan, prepareInstance(scan, instance, null), image);
}

export function projectExecution(scan: ProjectionInventory, image: TypeReferenceRewrite, execution: Execution):
  ProjectionResult<Execution> {
  return finishProjection(scan, prepareExecution(scan, execution, null), image);
}

export function projectSummaryKey(scan: ProjectionInventory, image: TypeReferenceRewrite, key: SummaryKey):
  ProjectionResult<SummaryKey> {
  return finishProjection(scan, prepareSummaryKey(scan, key, null), image);
}

export function projectSummary(scan: ProjectionInventory, image: TypeReferenceRewrite, summary: Summary): ProjectionResult<Summary> {
  return followingProjection(finishProjection(scan, prepareSummary(scan, summary, null), image), row => {
    if (row.retention.length < 2) return copiedProjection(row);
    const keyed = projectRows(scan, row.retention, read => projectRecord(scan, 3, () => {
      const retention = read();
      const at = retention.at;
      const stop = admitSummaryIdentity(at.kind === "body"
        ? { kind: "body", execution: at.execution } : { kind: "declared", execution: at.execution }, scan.meter.account);
      if (stop !== null) return { kind: "refused", stop };
      const target = escapeTargetKey(retention.into, scan.meter.account);
      return target.kind === "complete" ? copiedProjection({ retention, point: summaryPositionKey(at), key: target.value })
        : { kind: "refused", stop: target };
    }));
    if (keyed.kind === "refused") return keyed;
    const ordered = orderProjection(scan, keyed.value, (left, right) => {
      const stop = chargeWork(scan.meter.account, left.point.length + right.point.length + left.key.length + right.key.length);
      return stop === null ? copiedProjection(left.retention.source - right.retention.source
        || compareText(left.point, right.point) || compareText(left.key, right.key)) : { kind: "refused", stop };
    });
    return followingProjection(ordered, rows => {
      for (let index = 0; index < rows.length; index += 1) {
        const stop = chargeWork(scan.meter.account, 1);
        if (stop !== null) return { kind: "refused", stop };
        const entry = rows[index];
        if (entry === undefined) throw new TypeError("The completed Summary order must have dense rows.");
        row.retention[index] = entry.retention;
      }
      return copiedProjection(row);
    });
  });
}

const compareText = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

function projectBindings(scan: ProjectionInventory, image: TypeReferenceRewrite, bindings: BindingVector):
  ProjectionResult<BindingVector> {
  return finishProjection(scan, prepareBindingsProjection(scan, bindings), image);
}

export function projectMetadataKey(scan: ProjectionInventory, image: TypeReferenceRewrite, key: MetadataKey):
  ProjectionResult<MetadataKey> {
  return projectRecord(scan, 2, () => followingProjection(finishProjection(scan, prepareArtifactBindings(scan, key.bindings), image),
    bindings => copiedProjection({ definition: key.definition, bindings })));
}

function layoutRef(scan: ProjectionInventory, image: TypeReferenceRewrite, read: () => MetadataLayoutRef): ProjectionResult<MetadataLayoutRef> {
  return projectRecord(scan, 2, () => {
    const reference = read();
    return followingProjection(projectMetadataKey(scan, image, reference.metadata), metadata =>
      copiedProjection({ metadata, layout: reference.layout }));
  });
}

function fieldRef(scan: ProjectionInventory, image: TypeReferenceRewrite, read: () => MetadataFieldRef): ProjectionResult<MetadataFieldRef> {
  return projectRecord(scan, 2, () => {
    const reference = read();
    return followingProjection(projectMetadataKey(scan, image, reference.metadata), metadata =>
      copiedProjection({ metadata, field: reference.field }));
  });
}

export function projectObservations(scan: ProjectionInventory, image: TypeReferenceRewrite, source: BodyObservations):
  ProjectionResult<BodyObservations> {
  return projectRecord(scan, 2, () => followingProjection(projectInstance(scan, image, source.instance), instance =>
    followingProjection(projectRows(scan, source.rows, read => projectRecord(scan, 8, () => {
      const row = read();
      return followingProjection(layoutRef(scan, image, () => row.layout), layout => {
        const field = row.field;
        const mapped = field === null ? copiedProjection(null) : fieldRef(scan, image, () => field);
        return followingProjection(mapped, field => followingProjection(projectBindings(scan, image, row.bindings), bindings =>
          copiedProjection({ node: row.node, operation: row.operation, operand: row.operand, layout, field,
            result: image.type(row.result), value: row.value, bindings })));
      });
    })), rows => copiedProjection({ instance, rows }))));
}

function transport(scan: ProjectionInventory, image: TypeReferenceRewrite, read: () => ArgumentTransport):
  ProjectionResult<ArgumentTransport> {
  return projectRecord(scan, 5, () => {
    const row = read();
    return projectRecord(scan, 2, () => {
      const reference = row.formal;
      return followingProjection(finishProjection(scan, prepareRelationalOwner(scan, reference.owner), image), owner =>
        copiedProjection({ ...row, formal: { owner, producer: reference.producer } }));
    });
  });
}

function orderActivations(scan: ProjectionInventory, rows: OriginFacts["activations"][number][]):
  ProjectionResult<OriginFacts["activations"]> {
  if (rows.length < 2) return copiedProjection(rows);
  const keys = projectRows(scan, rows, read => projectRecord(scan, 3, () => {
    const row = read();
    const stop = chargeWork(scan.meter.account, row.activation.body.length) ?? admitArtifactIdentity(row.activation.bindings, scan.meter.account);
    if (stop !== null) return { kind: "refused", stop };
    const formal = argumentTransportKey(row.entry, scan.meter.account);
    return formal.kind === "complete" ? copiedProjection({ row, instance: instanceKey(row.activation), formal: formal.value })
      : { kind: "refused", stop: formal };
  }));
  if (keys.kind === "refused") return keys;
  return followingProjection(orderProjection(scan, keys.value, (left, right) => {
    const stop = chargeWork(scan.meter.account, left.instance.length + right.instance.length + left.formal.length + right.formal.length);
    return stop === null ? copiedProjection(compareBoundActivations(left.row, left.instance, left.formal, right.row, right.instance, right.formal))
      : { kind: "refused", stop };
  }), ordered => projectRows(scan, ordered, read => projectRead(scan, () => copiedProjection(read().row))));
}

function orderConstructions(scan: ProjectionInventory, rows: OriginFacts["constructions"][number][]):
  ProjectionResult<OriginFacts["constructions"]> {
  if (rows.length < 2) return copiedProjection(rows);
  const keys = projectRows(scan, rows, read => projectRecord(scan, 2, () => {
    const row = read();
    const body = row.body;
    const stop = chargeWork(scan.meter.account, row.root.body.length + row.allocation.body.length
      + (row.implementation?.length ?? 0) + (body?.body.length ?? 0))
      ?? (body === null ? null : admitArtifactIdentity(body.bindings, scan.meter.account));
    return stop === null ? copiedProjection({ row, body: body === null ? "" : instanceKey(body) }) : { kind: "refused", stop };
  }));
  if (keys.kind === "refused") return keys;
  return followingProjection(orderProjection(scan, keys.value, (left, right) => {
    const stop = chargeWork(scan.meter.account, left.body.length + right.body.length);
    return stop === null ? copiedProjection(compareConstructionAlternatives(left.row, left.body, right.row, right.body))
      : { kind: "refused", stop };
  }), ordered => projectRows(scan, ordered, read => projectRead(scan, () => copiedProjection(read().row))));
}

function origins(scan: ProjectionInventory, image: TypeReferenceRewrite, source: OriginFacts): ProjectionResult<OriginFacts> {
  return projectRecord(scan, 13, () => {
    const invocations = projectRows(scan, source.invocations, read => projectRecord(scan, 5, () => {
      const row = read();
      return followingProjection(projectRows(scan, row.alternatives, read => projectRecord(scan, 6, () => {
        const alternative = read();
        return followingProjection(finishProjection(scan, prepareCallee(scan, alternative.resolution), image), resolution =>
          followingProjection(projectRows(scan, alternative.arguments, read => transport(scan, image, read)), args =>
            followingProjection(projectSummaryKey(scan, image, alternative.summary), summary =>
              copiedProjection({ resolution, context: alternative.context, arguments: args,
                result: alternative.result, thrown: alternative.thrown, summary }))));
      })), alternatives => copiedProjection({ node: row.node, point: row.point, kind: row.kind, alternatives, boundaries: row.boundaries }));
    }));
    if (invocations.kind === "refused") return invocations;
    const callbacks = projectRows(scan, source.callbacks, read => projectRecord(scan, 5, () => {
      const row = read();
      return followingProjection(transport(scan, image, () => row.argument), argument =>
        copiedProjection({ node: row.node, argument, timing: row.timing, rejection: row.rejection, inputs: row.inputs }));
    }));
    if (callbacks.kind === "refused") return callbacks;
    const activations = projectRows(scan, source.activations, read => projectRecord(scan, 6, () => {
      const row = read();
      return followingProjection(projectInstance(scan, image, row.activation), activation => {
        const entry = row.entry;
        return followingProjection(entry === null ? copiedProjection(null) : transport(scan, image, () => entry), entry =>
          copiedProjection({ node: row.node, point: row.point, activation, context: row.context, caller: row.caller, entry }));
      });
    }));
    if (activations.kind === "refused") return activations;
    const orderedActivations = orderActivations(scan, activations.value);
    if (orderedActivations.kind === "refused") return orderedActivations;
    const constructions = projectRows(scan, source.constructions, read => projectRecord(scan, 6, () => {
      const row = read();
      const body = row.body;
      return followingProjection(body === null ? copiedProjection(null) : projectInstance(scan, image, body), body =>
        copiedProjection({ node: row.node, root: row.root, allocation: row.allocation, implementation: row.implementation, body, regions: row.regions }));
    }));
    if (constructions.kind === "refused") return constructions;
    const orderedConstructions = orderConstructions(scan, constructions.value);
    if (orderedConstructions.kind === "refused") return orderedConstructions;
    const { points, reads, subjects, writes, escapes, exitContents, frontiers, instanceRegions } = source;
    return copiedProjection({ points, reads, subjects, writes, escapes, exitContents, frontiers, instanceRegions,
      invocations: invocations.value, callbacks: callbacks.value, activations: orderedActivations.value, constructions: orderedConstructions.value });
  });
}

function closedArray(scan: ProjectionInventory, image: TypeReferenceRewrite, read: () => ClosedArrayFact): ProjectionResult<ClosedArrayFact> {
  return projectRead<ClosedArrayFact>(scan, () => {
    const row = read();
    if (row.kind === "unproven") return copiedProjection(row);
    return projectRecord(scan, 6, () => followingProjection(projectRows(scan, row.elements, read => projectRead(scan, () =>
      finishProjection(scan, prepareSelection(scan, read()), image))), elements => copiedProjection({ node: row.node, kind: "closed",
      declarations: row.declarations, references: row.references, literals: row.literals, elements })));
  });
}

export function projectBodyFacts(scan: ProjectionInventory, image: TypeReferenceRewrite, source: BodyFacts): ProjectionResult<BodyFacts> {
  return projectRecord(scan, 17, () => {
    const execution = projectExecution(scan, image, source.execution);
    if (execution.kind === "refused") return execution;
    const arena = finishProjection(scan, prepareRelationalArena(scan, source.arena), image);
    if (arena.kind === "refused") return arena;
    const origin = origins(scan, image, source.origins);
    if (origin.kind === "refused") return origin;
    const rawLocations = projectRows(scan, source.rawLocations, read => projectRecord(scan, 6, () => {
      const row = read();
      return followingProjection(layoutRef(scan, image, () => row.layout), layout =>
        followingProjection(projectBindings(scan, image, row.bindings), bindings =>
          copiedProjection({ node: row.node, operation: row.operation, pointee: image.type(row.pointee), layout, context: row.context, bindings })));
    }));
    if (rawLocations.kind === "refused") return rawLocations;
    const fieldBindings = projectRows(scan, source.fieldBindings, read => projectRecord(scan, 9, () => {
      const row = read();
      return followingProjection(fieldRef(scan, image, () => row.field), field =>
        followingProjection(projectBindings(scan, image, row.bindings), bindings =>
          copiedProjection({ node: row.node, result: image.type(row.result), owner: image.type(row.owner), fieldExpression: row.fieldExpression,
            field, pointer: row.pointer, pointee: image.type(row.pointee), context: row.context, bindings })));
    }));
    if (fieldBindings.kind === "refused") return fieldBindings;
    const recordBindings = projectRows(scan, source.recordBindings, read => projectRecord(scan, 7, () => {
      const row = read();
      return followingProjection(layoutRef(scan, image, () => row.layout), layout =>
        followingProjection(projectBindings(scan, image, row.bindings), bindings =>
          copiedProjection({ node: row.node, result: image.type(row.result), layoutExpression: row.layoutExpression, layout,
            context: row.context, bindings, fields: row.fields })));
    }));
    if (recordBindings.kind === "refused") return recordBindings;
    const closedArrays = projectRows(scan, source.closedArrays, read => closedArray(scan, image, read));
    if (closedArrays.kind === "refused") return closedArrays;
    const { liveness, initialization, refinements, suspension, errorStorage, pointerBacking, memoryBindings, selectedMemoryDeclarations } = source;
    return copiedProjection({ execution: execution.value, arena: arena.value, origins: origin.value,
      liveness, initialization, refinements, suspension, errorStorage, pointerBacking, memoryBindings, selectedMemoryDeclarations,
      rawLocations: rawLocations.value, fieldBindings: fieldBindings.value, recordBindings: recordBindings.value, closedArrays: closedArrays.value });
  });
}

function memoryLayout(scan: ProjectionInventory, image: TypeReferenceRewrite, read: () => MemoryLayout): ProjectionResult<MemoryLayout> {
  return projectRead(scan, () => {
    const row = read();
    return projectRecord<MemoryLayout>(scan, row.kind === "value" ? 9 : 11, () => {
      const base = { id: row.id, occurrence: row.occurrence, source: image.type(row.source), dataLayout: row.dataLayout,
        byteSize: row.byteSize, byteAlignment: row.byteAlignment, stride: row.stride };
      return row.kind === "value" ? copiedProjection({ ...base, kind: "value", fields: row.fields })
        : copiedProjection({ ...base, kind: "array", length: row.length, runtimeBase: row.runtimeBase, element: row.element });
    });
  });
}

function memoryField(scan: ProjectionInventory, image: TypeReferenceRewrite, read: () => MemoryField): ProjectionResult<MemoryField> {
  return projectRecord(scan, 10, () => {
    const field = read();
    return projectRecord(scan, 4, () => followingProjection(projectBindings(scan, image, field.member.bindings), bindings =>
      copiedProjection({ id: field.id, occurrence: field.occurrence, owner: image.type(field.owner), selector: field.selector,
        selection: field.selection, member: { ...field.member, bindings }, value: image.type(field.value), layout: field.layout,
        byteOffset: field.byteOffset, byteAlignment: field.byteAlignment })));
  });
}

export function projectMetadata(scan: ProjectionInventory, image: TypeReferenceRewrite, value: MetadataRecord): ProjectionResult<MetadataRecord> {
  return projectRecord(scan, value.kind === "data-layout" ? 6 : 5, () =>
    followingProjection(projectMetadataKey(scan, image, value.key), (key): ProjectionResult<MetadataRecord> => {
      switch (value.kind) {
        case "data-layout": return copiedProjection({ key, kind: "data-layout", occurrence: value.occurrence,
          fingerprint: value.fingerprint, byteOrder: value.byteOrder, addressWidth: value.addressWidth });
        case "memory-layout": case "memory-field": return followingProjection(projectRows(scan, value.layouts, read => memoryLayout(scan, image, read)),
          layouts => followingProjection(projectRows(scan, value.fields, read => memoryField(scan, image, read)), fields =>
            value.kind === "memory-layout" ? copiedProjection<MetadataRecord>({ key, kind: value.kind, root: value.root, layouts, fields })
              : copiedProjection<MetadataRecord>({ key, kind: value.kind, root: value.root, layouts, fields })));
      }
    }));
}
