import type {
  MirAggregate, MirBody, MirCallee, MirConstantValue, MirPlaceBase, MirRvalue, MirStatement, MirTerminator,
} from "../ir-mir/contract.js";
import type { TirBody } from "../ir-tir/contract.js";
import type { InstantiationStop, ProjectionInventory } from "./program-values.js";
import {
  inventoryArtifactBindings, inventoryBindings, inventoryEach, inventoryEvidence, inventoryFields,
  inventoryInstance, inventoryRecord, inventorySignature, inventoryType,
} from "./program-values.js";
import { inventoryCallee, inventorySelection, inventoryTypedOperation } from "./instantiate-phase.js";

export function inventoryTirBody(scan: ProjectionInventory, value: TirBody): InstantiationStop | null {
  inventoryEach(scan, value.params, parameter => inventoryRecord(scan, 6) ?? inventoryType(scan, parameter.storage));
  inventoryEach(scan, value.locals, local => inventoryRecord(scan, 7) ?? inventoryType(scan, local.storage));
  inventoryEach(scan, value.evidence, evidence => inventoryEvidence(scan, evidence));
  return inventoryRecord(scan, 18) ?? inventoryBindings(scan, value.lexicalBindings)
    ?? inventorySignature(scan, value.signature) ?? inventoryType(scan, value.completion)
    ?? inventoryType(scan, value.yielded) ?? inventoryType(scan, value.sent);
}

function constantValue(scan: ProjectionInventory, value: MirConstantValue): InstantiationStop | null {
  switch (value.kind) {
    case "literal":
    case "observation": return inventoryFields(scan, 1);
    case "definition":
    case "metadata": return inventoryRecord(scan, 3) ?? inventoryArtifactBindings(scan, value.bindings);
    case "constant": return inventoryRecord(scan, 2) ?? inventoryRecord(scan, 1) ?? inventoryInstance(scan, value.reference.initializer);
  }
}

function placeBase(scan: ProjectionInventory, value: MirPlaceBase): InstantiationStop | null {
  switch (value.kind) {
    case "local":
    case "static": return inventoryFields(scan, 1);
    case "place":
      switch (value.projection.kind) {
        case "field": return inventoryRecord(scan, 3) ?? inventoryRecord(scan, 2) ?? inventorySelection(scan, value.projection.member);
        case "index":
        case "element":
        case "deref":
        case "capture": return inventoryFields(scan, 2);
      }
  }
}

function aggregate(scan: ProjectionInventory, value: MirAggregate): InstantiationStop | null {
  switch (value.kind) {
    case "array":
    case "tuple":
    case "fixed-array": return inventoryFields(scan, 1);
    case "object":
    case "record":
      inventoryEach(scan, value.fields, field => inventoryRecord(scan, 2) ?? inventorySelection(scan, field.member));
      return inventoryRecord(scan, 2);
  }
}

function rvalue(scan: ProjectionInventory, value: MirRvalue): InstantiationStop | null {
  switch (value.kind) {
    case "use": return inventoryFields(scan, 1);
    case "unary": return inventoryRecord(scan, 3) ?? inventoryTypedOperation(scan, value.operation);
    case "binary": return inventoryRecord(scan, 4) ?? inventoryTypedOperation(scan, value.operation);
    case "convert": return inventoryRecord(scan, 4) ?? inventoryTypedOperation(scan, value.operation) ?? inventoryType(scan, value.to);
    case "refine": return inventoryRecord(scan, 3) ?? inventoryType(scan, value.to);
    case "aggregate": return inventoryRecord(scan, 3) ?? inventoryType(scan, value.type) ?? aggregate(scan, value.aggregate);
    case "address-of": return inventoryRecord(scan, 3) ?? inventoryType(scan, value.type);
    case "closure": return inventoryRecord(scan, 3) ?? inventoryInstance(scan, value.instance);
  }
}

function statement(scan: ProjectionInventory, value: MirStatement): InstantiationStop | null {
  switch (value.kind) {
    case "storage-live":
    case "storage-dead": return inventoryFields(scan, 1);
    case "assign": return inventoryRecord(scan, 5) ?? rvalue(scan, value.value);
  }
}

function callee(scan: ProjectionInventory, value: MirCallee): InstantiationStop | null {
  switch (value.kind) {
    case "direct": return inventoryRecord(scan, 2) ?? inventoryCallee(scan, value.resolution);
    case "indirect": return inventoryRecord(scan, 3) ?? inventoryCallee(scan, value.resolution);
  }
}

function terminator(scan: ProjectionInventory, value: MirTerminator): InstantiationStop | null {
  switch (value.kind) {
    case "goto":
    case "switch":
    case "await":
    case "yield":
    case "delegate":
    case "throw":
    case "return":
    case "unreachable": return inventoryFields(scan, 1);
    case "call": return inventoryRecord(scan, 9) ?? callee(scan, value.callee);
    case "invoke": return inventoryRecord(scan, 8) ?? inventoryTypedOperation(scan, value.operation);
  }
}

export function inventoryMirBody(scan: ProjectionInventory, value: MirBody): InstantiationStop | null {
  inventoryEach(scan, value.locals, local => inventoryRecord(scan, 5) ?? inventoryType(scan, local.storage));
  inventoryEach(scan, value.constants, constant => inventoryRecord(scan, 3) ?? inventoryType(scan, constant.type) ?? constantValue(scan, constant.value));
  inventoryEach(scan, value.places, place => inventoryRecord(scan, 4) ?? placeBase(scan, place.base) ?? inventoryType(scan, place.storage));
  inventoryEach(scan, value.blocks, block => {
    inventoryEach(scan, block.statements, value => statement(scan, value));
    return inventoryRecord(scan, 5) ?? terminator(scan, block.terminator);
  });
  return inventoryRecord(scan, 7) ?? inventoryType(scan, value.result);
}
