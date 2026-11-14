import type {
  ArgumentTransport, BodyFacts, MetadataFieldRef, MetadataKey, MetadataLayoutRef, OriginFacts,
  ProducerRef, RelationalArena, RelationalOwner, Summary, SummaryKey,
} from "../ir-facts/contract.js";
import type { InstantiationStop, ProjectionInventory } from "./program-values.js";
import {
  inventoryArtifactBindings, inventoryBindings, inventoryEach, inventoryFields, inventoryInstance,
  inventoryRecord, inventorySignature, inventoryType,
} from "./program-values.js";
import { inventoryCallee, inventorySelection } from "./instantiate-phase.js";

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

function arena(scan: ProjectionInventory, value: RelationalArena): InstantiationStop | null {
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
  inventoryEach(scan, value.boundaries, boundary => inventoryRecord(scan, 8) ?? inventoryBindings(scan, boundary.bindings));
  return inventoryRecord(scan, 6);
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
    return inventoryRecord(scan, 4);
  });
  inventoryEach(scan, value.callbacks, callback => inventoryRecord(scan, 5) ?? transport(scan, callback.argument));
  inventoryEach(scan, value.activations, activation => inventoryRecord(scan, 5) ?? inventoryInstance(scan, activation.activation)
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

export function inventorySummary(scan: ProjectionInventory, value: Summary): InstantiationStop | null {
  return inventoryRecord(scan, 13) ?? summaryKey(scan, value.key) ?? inventorySignature(scan, value.signature) ?? arena(scan, value.arena);
}
