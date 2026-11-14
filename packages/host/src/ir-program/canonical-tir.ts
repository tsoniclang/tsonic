import type { BodyRoot } from "../ir-hir/contract.js";
import type {
  MirAggregate, MirBody, MirCallee, MirConstantValue, MirPlaceBase, MirRvalue, MirStatement, MirTerminator,
} from "../ir-mir/contract.js";
import type {
  ConversionDecision, MemberSelection, ResolvedCallee, TirApplication, TirArgument, TirBody,
  TirProtocol, TirRestPart, TypedOperation, TypedPhase, TypedValue,
} from "../ir-tir/contract.js";
import type { TypeRewrite } from "./canonical-types.js";
import type { ArtifactBindings } from "../ir-types/contract.js";
import { rewriteArtifactBindings, rewriteBindings, rewriteEvidence, rewriteInstance } from "./canonical-types.js";
import {
  rewriteApplication, rewriteBackedIdentity, rewriteConversionIdentity, rewriteDeferred, rewriteEmbedding, rewriteMember, rewriteOperation,
  rewriteOperationAs, rewriteRefinement,
} from "./canonical-inference.js";

export function rewriteTypedOperation(rewrite: TypeRewrite, operation: TypedOperation, at: string): TypedOperation {
  return { decision: rewriteOperation(rewrite, operation.decision, `${at}.decision`), permissionScope: operation.permissionScope };
}

export function rewriteCallee(rewrite: TypeRewrite, callee: ResolvedCallee): ResolvedCallee {
  return {
    decision: rewriteApplication(rewrite, callee.decision),
    activation: callee.activation === null ? null : rewriteInstance(rewrite, callee.activation),
  };
}

export function rewriteSelection(rewrite: TypeRewrite, selection: MemberSelection): MemberSelection {
  return {
    decision: rewriteMember(rewrite, selection.decision),
    getter: selection.getter === null ? null : rewriteCallee(rewrite, selection.getter),
    setter: selection.setter === null ? null : rewriteCallee(rewrite, selection.setter),
  };
}

function rewriteRestPart(rewrite: TypeRewrite, part: TirRestPart): TirRestPart {
  switch (part.kind) {
    case "value": return part;
    case "spread": return { kind: "spread", expression: part.expression, tuple: part.tuple === null ? null : part.tuple.map(rewrite.type) };
  }
}

function rewriteArgument(rewrite: TypeRewrite, argument: TirArgument): TirArgument {
  switch (argument.kind) {
    case "provided": return argument;
    case "rest": return { kind: "rest", parameter: argument.parameter, parts: argument.parts.map(part => rewriteRestPart(rewrite, part)) };
    case "omitted": {
      const value = argument.value;
      switch (value.kind) {
        case "absence":
        case "empty-rest": return argument;
        case "initializer": return {
          kind: "omitted", parameter: argument.parameter,
          value: { kind: "initializer", instance: rewriteInstance(rewrite, value.instance) },
        };
      }
    }
  }
}

export function rewriteTirApplication(rewrite: TypeRewrite, application: TirApplication): TirApplication {
  return {
    callee: rewriteCallee(rewrite, application.callee), receiver: application.receiver,
    arguments: application.arguments.map(argument => rewriteArgument(rewrite, argument)),
  };
}

export function rewriteProtocol(rewrite: TypeRewrite, protocol: TirProtocol, at: string): TirProtocol {
  return {
    kind: protocol.kind, asynchronous: protocol.asynchronous,
    steps: protocol.steps.map((step, position) => ({
      role: step.role, operation: rewriteTypedOperation(rewrite, step.operation, `${at}.steps[${position}].operation`),
      callee: step.callee === null ? null : rewriteCallee(rewrite, step.callee),
    })),
    value: rewrite.type(protocol.value), completion: rewrite.type(protocol.completion),
    sent: protocol.sent === null ? null : rewrite.type(protocol.sent), thrown: rewrite.type(protocol.thrown),
  };
}

function rewriteConversion(rewrite: TypeRewrite, conversion: ConversionDecision, at: string): ConversionDecision {
  switch (conversion.kind) {
    case "identity": return conversion;
    case "convert": {
      const decision = conversion.operation.decision;
      return { kind: "convert", role: conversion.role, operation: { permissionScope: conversion.operation.permissionScope,
        decision: rewriteOperationAs(rewrite, decision, rewriteConversionIdentity(rewrite, decision.operation, `${at}.operation.decision.operation`)) } };
    }
    case "backed-convert": {
      const decision = conversion.operation.decision;
      return { kind: "backed-convert", role: conversion.role, embedding: rewriteEmbedding(rewrite, conversion.embedding, `${at}.embedding`),
        operation: { permissionScope: conversion.operation.permissionScope,
          decision: rewriteOperationAs(rewrite, decision, rewriteBackedIdentity(rewrite, decision.operation)) } };
    }
    case "deferred": return { kind: "deferred", deferred: rewriteDeferred(rewrite, conversion.deferred, `${at}.deferred`) };
  }
}

export function rewriteValue(rewrite: TypeRewrite, value: TypedValue, at: string): TypedValue {
  return {
    type: rewrite.type(value.type), convertedType: rewrite.type(value.convertedType),
    conversion: rewriteConversion(rewrite, value.conversion, `${at}.conversion`),
    narrowing: value.narrowing === null ? null : rewriteRefinement(rewrite, value.narrowing, `${at}.narrowing`),
    evidenceIndex: value.evidenceIndex, demand: value.demand,
  };
}

export function rewriteTirBody(
  rewrite: TypeRewrite, body: TirBody, root: BodyRoot<TypedPhase>, bindings: ArtifactBindings,
): TirBody {
  return {
    body: body.body, owner: body.owner, bindings,
    lexicalBindings: rewriteBindings(rewrite, body.lexicalBindings), dependence: body.dependence,
    signature: rewrite.signature(body.signature), completion: rewrite.type(body.completion),
    yielded: body.yielded === null ? null : rewrite.type(body.yielded), sent: body.sent === null ? null : rewrite.type(body.sent),
    params: body.params.map(parameter => ({
      local: parameter.local, declaration: parameter.declaration, role: parameter.role, passing: parameter.passing,
      initializer: parameter.initializer, storage: rewrite.type(parameter.storage),
    })),
    locals: body.locals.map(local => ({
      id: local.id, declaration: local.declaration, name: local.name, role: local.role,
      capturedFrom: local.capturedFrom, mutable: local.mutable, storage: rewrite.type(local.storage),
    })), root,
    nestedBodies: body.nestedBodies, captures: body.captures, scopes: body.scopes,
    evidence: body.evidence.map(evidence => rewriteEvidence(rewrite, evidence)), asynchronous: body.asynchronous, generator: body.generator,
  };
}

function rewriteMirConstant(rewrite: TypeRewrite, value: MirConstantValue): MirConstantValue {
  switch (value.kind) {
    case "literal":
    case "observation": return value;
    case "definition":
    case "metadata": return { kind: value.kind, definition: value.definition, bindings: rewriteArtifactBindings(rewrite, value.bindings) };
    case "constant": return {
      kind: "constant", reference: { initializer: rewriteInstance(rewrite, value.reference.initializer), context: value.reference.context },
    };
  }
}

function rewritePlaceBase(rewrite: TypeRewrite, base: MirPlaceBase): MirPlaceBase {
  switch (base.kind) {
    case "local":
    case "static": return base;
    case "place": {
      switch (base.projection.kind) {
        case "field": return {
          kind: "place", place: base.place,
          projection: { kind: "field", member: rewriteSelection(rewrite, base.projection.member) }, tir: base.tir,
        };
        case "index":
        case "element":
        case "deref":
        case "capture":
        case "refined": return base;
      }
    }
    case "checked": {
      switch (base.projection.kind) {
        case "field": return {
          kind: "checked", place: base.place,
          projection: { kind: "field", member: rewriteSelection(rewrite, base.projection.member) }, tir: base.tir,
        };
        case "index":
        case "element":
        case "deref":
        case "capture":
        case "refined": return base;
      }
    }
  }
}

function rewriteAggregate(rewrite: TypeRewrite, aggregate: MirAggregate): MirAggregate {
  switch (aggregate.kind) {
    case "array":
    case "tuple":
    case "fixed-array": return aggregate;
    case "object":
    case "record": return {
      kind: aggregate.kind, fields: aggregate.fields.map(field => ({ member: rewriteSelection(rewrite, field.member), value: field.value })),
    };
  }
}

function rewriteRvalue(rewrite: TypeRewrite, value: MirRvalue, at: string): MirRvalue {
  switch (value.kind) {
    case "use": return value;
    case "unary": return { kind: "unary", operation: rewriteTypedOperation(rewrite, value.operation, `${at}.operation`), operand: value.operand };
    case "binary": return { kind: "binary", operation: rewriteTypedOperation(rewrite, value.operation, `${at}.operation`), left: value.left, right: value.right };
    case "convert": return {
      kind: "convert", operation: rewriteTypedOperation(rewrite, value.operation, `${at}.operation`), operand: value.operand, to: rewrite.type(value.to),
    };
    case "aggregate": return { kind: "aggregate", type: rewrite.type(value.type), aggregate: rewriteAggregate(rewrite, value.aggregate) };
    case "address-of": return { kind: "address-of", place: value.place, type: rewrite.type(value.type) };
    case "closure": return { kind: "closure", instance: rewriteInstance(rewrite, value.instance), captures: value.captures };
  }
}

function rewriteStatement(rewrite: TypeRewrite, statement: MirStatement, at: string): MirStatement {
  switch (statement.kind) {
    case "storage-live":
    case "storage-dead": return statement;
    case "assign": return {
      origin: statement.origin, tir: statement.tir, kind: "assign", place: statement.place,
      value: rewriteRvalue(rewrite, statement.value, `${at}.value`), step: statement.step,
    };
  }
}

function rewriteMirCallee(rewrite: TypeRewrite, callee: MirCallee): MirCallee {
  switch (callee.kind) {
    case "direct": return { kind: "direct", resolution: rewriteCallee(rewrite, callee.resolution) };
    case "indirect": return { kind: "indirect", operand: callee.operand, resolution: rewriteCallee(rewrite, callee.resolution) };
    case "body": return { kind: "body", instance: rewriteInstance(rewrite, callee.instance), captures: callee.captures };
  }
}

function rewriteTerminator(rewrite: TypeRewrite, terminator: MirTerminator, at: string): MirTerminator {
  switch (terminator.kind) {
    case "goto":
    case "switch":
    case "check":
    case "await":
    case "yield":
    case "delegate":
    case "throw":
    case "return":
    case "unreachable": return terminator;
    case "call": return {
      origin: terminator.origin, tir: terminator.tir, kind: "call", callee: rewriteMirCallee(rewrite, terminator.callee),
      receiver: terminator.receiver, arguments: terminator.arguments, destination: terminator.destination,
      next: terminator.next, unwind: terminator.unwind, step: terminator.step,
    };
    case "invoke": return {
      origin: terminator.origin, tir: terminator.tir, kind: "invoke",
      operation: rewriteTypedOperation(rewrite, terminator.operation, `${at}.operation`), operands: terminator.operands,
      destination: terminator.destination, next: terminator.next, unwind: terminator.unwind, step: terminator.step,
    };
  }
}

export function rewriteMirBody(rewrite: TypeRewrite, body: MirBody, at: string, bindings: ArtifactBindings): MirBody {
  return {
    body: body.body, bindings, entries: body.entries,
    locals: body.locals.map(local => ({ id: local.id, storage: rewrite.type(local.storage), role: local.role, mode: local.mode, source: local.source, origin: local.origin })),
    constants: body.constants.map(constant => ({ id: constant.id, type: rewrite.type(constant.type), value: rewriteMirConstant(rewrite, constant.value) })),
    places: body.places.map(place => ({ id: place.id, base: rewritePlaceBase(rewrite, place.base), storage: rewrite.type(place.storage), origin: place.origin })),
    blocks: body.blocks.map((block, position) => ({
      id: block.id, origin: block.origin, tir: block.tir,
      statements: block.statements.map((statement, index) => rewriteStatement(rewrite, statement, `${at}.blocks[${position}].statements[${index}]`)),
      terminator: rewriteTerminator(rewrite, block.terminator, `${at}.blocks[${position}].terminator`),
    })), result: rewrite.type(body.result),
  };
}
