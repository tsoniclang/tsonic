import type {
  ArgumentTransport, BodyFacts, MetadataFieldRef, MetadataKey, MetadataLayoutRef, OriginFacts,
  ProducerRef, RelationalArena, RelationalOwner, Summary, SummaryKey, LogicalCell, StableReference,
} from "../ir-facts/contract.js";
import type { ProjectionInventory } from "./program-values.js";
import type { InstantiationStop } from "./work.js";
import { inventoryArtifactBindings, inventoryBindings, inventoryEach, inventoryFields, inventoryInstance, inventoryRecord, inventorySignature, inventoryType } from "./program-values.js";
import { inventoryCallee, inventorySelection } from "./instantiate-phase.js";
import type { InitializationTable, SummaryPosition } from "../ir-facts/contract.js";

function relationalOwner(scan: ProjectionInventory, value: RelationalOwner): InstantiationStop | null {
  switch (value.kind) {
    case "body": return inventoryRecord(scan, 2) ?? inventoryRecord(scan, 2) ?? inventoryInstance(scan, value.execution.instance);
    case "summary": return inventoryRecord(scan, 2) ?? summaryKey(scan, value.key);
  }
}

function producerRef(scan: ProjectionInventory, value: ProducerRef): InstantiationStop | null {
  return inventoryRecord(scan, 2) ?? relationalOwner(scan, value.owner);
}

function transport(scan: ProjectionInventory, value: ArgumentTransport): InstantiationStop | null {
  return inventoryRecord(scan, 8) ?? producerRef(scan, value.formal);
}

function stableCell(scan: ProjectionInventory, value: StableReference): InstantiationStop | null {
  return value.kind === "static" ? inventoryRecord(scan, 2) ?? inventoryRecord(scan, 2)
    ?? inventoryArtifactBindings(scan, value.declaration.bindings) : inventoryFields(scan, value.kind === "receiver" ? 1 : 2);
}

function cellRole(scan: ProjectionInventory, value: LogicalCell): InstantiationStop | null {
  if (value.kind === "detached") return inventoryFields(scan, 1);
  if (value.kind !== "created") return stableCell(scan, value);
  const admitted = inventoryRecord(scan, 3);
  if (admitted !== null) return admitted;
  const anchor = value.anchor.kind === "result" ? inventoryFields(scan, 1) : stableCell(scan, value.anchor);
  if (anchor !== null) return anchor;
  switch (value.slot.kind) {
    case "field": return inventoryRecord(scan, 2) ?? inventoryRecord(scan, 5) ?? inventoryBindings(scan, value.slot.member.bindings);
    case "capture": return inventoryFields(scan, 3);
    case "local":
    case "entity": return inventoryFields(scan, value.slot.kind === "local" ? 2 : 1);
  }
}

function arena(scan: ProjectionInventory, value: RelationalArena): InstantiationStop | null {
  inventoryEach(scan, value.cells, cell => {
    const base = inventoryRecord(scan, 4) ?? cellRole(scan, cell.role);
    if (base !== null) return base;
    inventoryEach(scan, cell.lifetimes, marker => inventoryRecord(scan, 4)
      ?? inventoryRecord(scan, 2) ?? inventoryInstance(scan, marker.execution.instance));
    const occurrence = cell.occurrence;
    return occurrence.kind === "declared" ? inventoryFields(scan, 2) : inventoryRecord(scan, 3)
      ?? inventoryRecord(scan, 2) ?? inventoryInstance(scan, occurrence.execution.instance);
  });
  inventoryEach(scan, value.projections, path => {
    switch (path.projection.kind) {
      case "field":
      case "method-value": return inventoryRecord(scan, 3) ?? inventoryRecord(scan, 2)
        ?? inventorySelection(scan, path.projection.member);
      case "element":
      case "index":
      case "deref": return inventoryFields(scan, 2);
    }
  });
  inventoryEach(scan, value.boundProducers, producer => inventoryRecord(scan, 4) ?? inventoryBindings(scan, producer.bindings));
  inventoryEach(scan, value.producers, producer => {
    const lookup = inventoryFields(scan, 1);
    if (lookup !== null) return lookup;
    return producer.kind === "local" ? inventoryRecord(scan, 4) ?? inventoryRecord(scan, 2) : null;
  });
  inventoryEach(scan, value.boundaries, boundary => inventoryRecord(scan, 8) ?? inventoryBindings(scan, boundary.bindings));
  return inventoryRecord(scan, 7);
}

function summaryKey(scan: ProjectionInventory, value: SummaryKey): InstantiationStop | null {
  return inventoryRecord(scan, 2) ?? inventoryRecord(scan, 2) ?? (value.kind === "body"
    ? inventoryInstance(scan, value.execution.instance)
    : inventoryRecord(scan, 4) ?? inventoryArtifactBindings(scan, value.execution.request.bindings));
}

function metadataKey(scan: ProjectionInventory, value: MetadataKey): InstantiationStop | null {
  return inventoryRecord(scan, 2) ?? inventoryArtifactBindings(scan, value.bindings);
}

function layoutRef(scan: ProjectionInventory, value: MetadataLayoutRef): InstantiationStop | null {
  return inventoryRecord(scan, 2) ?? metadataKey(scan, value.metadata);
}

function fieldRef(scan: ProjectionInventory, value: MetadataFieldRef): InstantiationStop | null {
  return inventoryRecord(scan, 2) ?? metadataKey(scan, value.metadata);
}

function origins(scan: ProjectionInventory, value: OriginFacts): InstantiationStop | null {
  inventoryEach(scan, value.invocations, invocation => {
    inventoryEach(scan, invocation.alternatives, alternative => {
      inventoryEach(scan, alternative.arguments, argument => transport(scan, argument));
      return inventoryRecord(scan, 6) ?? inventoryCallee(scan, alternative.resolution) ?? summaryKey(scan, alternative.summary);
    });
    return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 2);
  });
  inventoryEach(scan, value.callbacks, callback => inventoryRecord(scan, 5) ?? transport(scan, callback.argument));
  inventoryEach(scan, value.activations, activation => inventoryRecord(scan, 6) ?? inventoryRecord(scan, 2) ?? inventoryInstance(scan, activation.activation)
    ?? (activation.entry === null ? null : transport(scan, activation.entry)));
  inventoryEach(scan, value.constructions, construction => inventoryRecord(scan, 6)
    ?? (construction.body === null ? null : inventoryInstance(scan, construction.body)));
  return inventoryRecord(scan, 12);
}

export function inventoryBodyFacts(scan: ProjectionInventory, value: BodyFacts): InstantiationStop | null {
  inventoryEach(scan, value.rawLocations, location => inventoryRecord(scan, 6) ?? inventoryType(scan, location.pointee)
    ?? layoutRef(scan, location.layout) ?? inventoryBindings(scan, location.bindings));
  inventoryEach(scan, value.fieldBindings, binding => inventoryRecord(scan, 9)
    ?? inventoryType(scan, binding.result) ?? inventoryType(scan, binding.owner) ?? fieldRef(scan, binding.field)
    ?? inventoryType(scan, binding.pointee) ?? inventoryBindings(scan, binding.bindings));
  inventoryEach(scan, value.recordBindings, binding => inventoryRecord(scan, 7)
    ?? inventoryType(scan, binding.result) ?? layoutRef(scan, binding.layout) ?? inventoryBindings(scan, binding.bindings));
  inventoryEach(scan, value.closedArrays, fact => {
    switch (fact.kind) {
      case "unproven": return inventoryFields(scan, 1);
      case "closed":
        inventoryEach(scan, fact.elements, element => inventorySelection(scan, element));
        return inventoryRecord(scan, 6);
    }
  });
  return inventoryRecord(scan, 15) ?? inventoryRecord(scan, 2) ?? inventoryInstance(scan, value.execution.instance)
    ?? arena(scan, value.arena) ?? origins(scan, value.origins);
}

function summaryPosition(scan: ProjectionInventory, at: SummaryPosition): InstantiationStop | null {
  return at.kind === "body"
    ? inventoryRecord(scan, 4) ?? inventoryRecord(scan, 2) ?? inventoryInstance(scan, at.execution.instance)
    : inventoryRecord(scan, 3) ?? inventoryRecord(scan, 2) ?? inventoryRecord(scan, 4)
      ?? inventoryArtifactBindings(scan, at.execution.request.bindings);
}

function initialization(scan: ProjectionInventory, table: InitializationTable): InstantiationStop | null {
  inventoryEach(scan, table.events, event => inventoryRecord(scan, 3) ?? inventoryRecord(scan, 2)
    ?? relationalOwner(scan, event.subject.owner));
  inventoryEach(scan, table.points, point => {
    switch (point.kind) {
      case "return": case "unwind": return inventoryFields(scan, 1);
      case "before": return inventoryRecord(scan, 3) ?? summaryPosition(scan, point.at) ?? inventoryRecord(scan, 2)
        ?? relationalOwner(scan, point.subject.owner);
      case "completed": return inventoryRecord(scan, 3) ?? inventoryRecord(scan, 2) ?? relationalOwner(scan, point.handle.owner);
      case "need": {
        const start = inventoryRecord(scan, 4) ?? summaryPosition(scan, point.at) ?? inventoryRecord(scan, 2);
        if (start !== null) return start;
        inventoryEach(scan, point.witness.via, row => inventoryRecord(scan, 2) ?? summaryKey(scan, row.key));
        return null;
      }
    }
  });
  return inventoryRecord(scan, 5);
}

export function inventorySummary(scan: ProjectionInventory, value: Summary): InstantiationStop | null {
  inventoryEach(scan, value.retention, row => inventoryRecord(scan, 3) ?? summaryPosition(scan, row.at));
  inventoryEach(scan, value.callbacks, callback => {
    const subject = inventoryRecord(scan, callback.kind === "unknown" ? 6 : 11) ?? inventoryRecord(scan, 2)
      ?? relationalOwner(scan, callback.subject.owner);
    if (subject !== null) return subject;
    if (callback.kind === "unknown") {
      inventoryEach(scan, callback.signatures, signature => inventorySignature(scan, signature));
      return inventoryRecord(scan, 2) ?? relationalOwner(scan, callback.boundary.owner);
    }
    return summaryPosition(scan, callback.at) ?? inventorySignature(scan, callback.signature)
      ?? (callback.handle === null ? null : inventoryRecord(scan, 2) ?? relationalOwner(scan, callback.handle.owner));
  });
  inventoryEach(scan, value.backing, backing => inventoryRecord(scan, 5) ?? summaryPosition(scan, backing.at)
    ?? (backing.use.kind === "return" ? inventoryFields(scan, 1) : inventoryRecord(scan, 4) ?? summaryKey(scan, backing.use.callee)));
  return inventoryRecord(scan, 20) ?? summaryKey(scan, value.key) ?? inventorySignature(scan, value.signature)
    ?? arena(scan, value.arena) ?? initialization(scan, value.initialization);
}
