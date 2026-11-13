import type { DefId, LocalId, Origin, NodeRef } from "../ids/contract.js";
import type { ArtifactBindings, PlacePassingMode } from "../ir-types/contract.js";
import type {
  MirAggregate, MirAggregateField, MirBlock, MirBody, MirCallArgument, MirCallee,
  MirClosureCapture, MirConstant, MirConstantValue, MirEntry, MirLocal, MirLocalRole,
  MirOperand, MirPlace, MirPlaceBase, MirProjection, MirRvalue, MirSite,
  MirStatement, MirStepRef, MirSuspensionReturn, MirSwitchTarget, MirTerminator, MirUnwind,
} from "./contract.js";
import { createDecisionWires } from "./text-decisions.js";
import { choice, field, finish, literals, nullable, record, variants, vector, wireText } from "./text.js";
import { createScalarWires } from "./text.js";
import type { Fields, Wire } from "./text.js";

export function printBody(body: MirBody): string {
  return `${wireText(createBodyWire(), body)}\n`;
}

export function createBodyWire(): Wire<MirBody> {
  const scalars = createScalarWires();
  const { numberWire } = scalars;
  const { artifactWire, blockWire, bodyWire, calleeWire, constantWire, definitionWire, instanceWire, literalWire, localRefWire, localWire, nodeRefWire, operationWire, originWire, placeWire, referenceWire, selectionWire, typeWire } = createDecisionWires(scalars);
  function siteFields<Value extends MirSite>(tail: (origin: Origin, tir: NodeRef) => Fields<Value>): Fields<Value> {
    return field("origin", () => originWire, value => value.origin, origin =>
      field("tir", () => nodeRefWire, value => value.tir, tir => tail(origin, tir)));
  }

  const receiverRole = record<MirLocalRole & { readonly kind: "receiver" }>("receiver", () => finish(() => ({ kind: "receiver" })));

  function indexedRole<Kind extends "parameter" | "capture">(kind: Kind) {
    return record<{ readonly kind: Kind; readonly index: number }>(kind, () =>
      field("index", () => numberWire, value => value.index, index => finish(() => ({ kind, index }))));
  }

  function plainRole<Kind extends "user" | "temporary" | "return" | "exception" | "completion">(kind: Kind) {
    return record<{ readonly kind: Kind }>(kind, () => finish(() => ({ kind })));
  }

  const roleWire: Wire<MirLocalRole> = variants([
    choice("receiver", () => receiverRole), choice("parameter", () => indexedRole("parameter")), choice("capture", () => indexedRole("capture")),
    choice("user", () => plainRole("user")), choice("temporary", () => plainRole("temporary")), choice("return", () => plainRole("return")),
    choice("exception", () => plainRole("exception")), choice("completion", () => plainRole("completion")),
  ], (value, path, next) => {
    switch (value.kind) {
      case "receiver": return receiverRole.write(value, path, next);
      case "parameter": case "capture": return indexedRole(value.kind).write(value, path, next);
      case "user": case "temporary": case "return": case "exception": case "completion": return plainRole(value.kind).write(value, path, next);
    }
  });

  const mirLocal = record<MirLocal>("MirLocal", () =>
    field("id", () => localWire, value => value.id, id =>
      field("storage", () => typeWire, value => value.storage, storage =>
        field("role", () => roleWire, value => value.role, role =>
          field("source", () => nullable(() => localRefWire), value => value.source, source =>
            field("origin", () => originWire, value => value.origin, origin => finish(() => ({ id, storage, role, source, origin }))))))));

  const constantLiteral = record<MirConstantValue & { readonly kind: "literal" }>("literal", () =>
    field("value", () => literalWire, value => value.value, value => finish(() => ({ kind: "literal", value }))));

  function declaredConstant<Kind extends "definition" | "metadata">(kind: Kind) {
    return record<{ readonly kind: Kind; readonly definition: DefId; readonly bindings: ArtifactBindings }>(kind, () =>
      field("definition", () => definitionWire, value => value.definition, definition =>
        field("bindings", () => artifactWire, value => value.bindings, bindings => finish(() => ({ kind, definition, bindings })))));
  }

  const constantObservation = record<MirConstantValue & { readonly kind: "observation" }>("observation", () =>
    field("at", () => nodeRefWire, value => value.at, at => finish(() => ({ kind: "observation", at }))));

  const constantReference = record<MirConstantValue & { readonly kind: "constant" }>("constant", () =>
    field("reference", () => referenceWire, value => value.reference, reference => finish(() => ({ kind: "constant", reference }))));

  const constantValue: Wire<MirConstantValue> = variants([
    choice("literal", () => constantLiteral), choice("definition", () => declaredConstant("definition")),
    choice("metadata", () => declaredConstant("metadata")), choice("observation", () => constantObservation), choice("constant", () => constantReference),
  ], (value, path, next) => {
    switch (value.kind) {
      case "literal": return constantLiteral.write(value, path, next);
      case "definition": case "metadata": return declaredConstant(value.kind).write(value, path, next);
      case "observation": return constantObservation.write(value, path, next);
      case "constant": return constantReference.write(value, path, next);
    }
  });

  const mirConstant = record<MirConstant>("MirConstant", () =>
    field("id", () => constantWire, value => value.id, id =>
      field("type", () => typeWire, value => value.type, type =>
        field("value", () => constantValue, value => value.value, value => finish(() => ({ id, type, value }))))));

  const operandPlace = record<MirOperand & { readonly kind: "place" }>("place", () =>
    field("place", () => placeWire, value => value.place, place => finish(() => ({ kind: "place", place }))));

  const operandConstant = record<MirOperand & { readonly kind: "constant" }>("constant", () =>
    field("constant", () => constantWire, value => value.constant, constant => finish(() => ({ kind: "constant", constant }))));

  const operandWire: Wire<MirOperand> = variants([choice("place", () => operandPlace), choice("constant", () => operandConstant)],
    (value, path, next) => value.kind === "place" ? operandPlace.write(value, path, next) : operandConstant.write(value, path, next));

  const projectionField = record<MirProjection & { readonly kind: "field" }>("field", () =>
    field("member", () => selectionWire, value => value.member, member => finish(() => ({ kind: "field", member }))));

  const projectionIndex = record<MirProjection & { readonly kind: "index" }>("index", () =>
    field("operand", () => operandWire, value => value.operand, operand => finish(() => ({ kind: "index", operand }))));

  function numberedProjection<Kind extends "element" | "capture">(kind: Kind) {
    return record<{ readonly kind: Kind; readonly index: number }>(kind, () =>
      field("index", () => numberWire, value => value.index, index => finish(() => ({ kind, index }))));
  }

  const projectionDeref = record<MirProjection & { readonly kind: "deref" }>("deref", () => finish(() => ({ kind: "deref" })));

  const projectionRefined = record<MirProjection & { readonly kind: "refined" }>("refined", () => finish(() => ({ kind: "refined" })));

  const projectionWire: Wire<MirProjection> = variants([
    choice("field", () => projectionField), choice("index", () => projectionIndex), choice("element", () => numberedProjection("element")),
    choice("deref", () => projectionDeref), choice("capture", () => numberedProjection("capture")), choice("refined", () => projectionRefined),
  ], (value, path, next) => {
    switch (value.kind) {
      case "field": return projectionField.write(value, path, next);
      case "index": return projectionIndex.write(value, path, next);
      case "element": case "capture": return numberedProjection(value.kind).write(value, path, next);
      case "deref": return projectionDeref.write(value, path, next);
      case "refined": return projectionRefined.write(value, path, next);
    }
  });

  const baseLocal = record<MirPlaceBase & { readonly kind: "local" }>("local", () =>
    field("local", () => localWire, value => value.local, local => finish(() => ({ kind: "local", local }))));

  const baseStatic = record<MirPlaceBase & { readonly kind: "static" }>("static", () =>
    field("definition", () => definitionWire, value => value.definition, definition => finish(() => ({ kind: "static", definition }))));

  const basePlace = record<MirPlaceBase & { readonly kind: "place" }>("place", () =>
    field("place", () => placeWire, value => value.place, place =>
      field("projection", () => projectionWire, value => value.projection, projection =>
        field("tir", () => nodeRefWire, value => value.tir, tir => finish(() => ({ kind: "place", place, projection, tir }))))));

  const baseChecked = record<MirPlaceBase & { readonly kind: "checked" }>("checked", () =>
    field("place", () => placeWire, value => value.place, place =>
      field("projection", () => projectionWire, value => value.projection, projection =>
        field("tir", () => nodeRefWire, value => value.tir, tir => finish(() => ({ kind: "checked", place, projection, tir }))))));

  const baseWire: Wire<MirPlaceBase> = variants([choice("local", () => baseLocal), choice("static", () => baseStatic),
    choice("place", () => basePlace), choice("checked", () => baseChecked)],
    (value, path, next) => {
      switch (value.kind) {
        case "local": return baseLocal.write(value, path, next);
        case "static": return baseStatic.write(value, path, next);
        case "place": return basePlace.write(value, path, next);
        case "checked": return baseChecked.write(value, path, next);
      }
    });

  const mirPlace = record<MirPlace>("MirPlace", () =>
    field("id", () => placeWire, value => value.id, id =>
      field("base", () => baseWire, value => value.base, base =>
        field("storage", () => typeWire, value => value.storage, storage =>
          field("origin", () => originWire, value => value.origin, origin => finish(() => ({ id, base, storage, origin })))))));

  const aggregateField = record<MirAggregateField>("MirAggregateField", () =>
    field("member", () => selectionWire, value => value.member, member =>
      field("value", () => operandWire, value => value.value, value => finish(() => ({ member, value })))));

  function aggregateElements<Kind extends "array" | "tuple" | "fixed-array">(kind: Kind) {
    return record<{ readonly kind: Kind; readonly elements: readonly MirOperand[] }>(kind, () =>
      field("elements", () => vector(() => operandWire), value => value.elements, elements => finish(() => ({ kind, elements }))));
  }

  function aggregateFields<Kind extends "object" | "record">(kind: Kind) {
    return record<{ readonly kind: Kind; readonly fields: readonly MirAggregateField[] }>(kind, () =>
      field("fields", () => vector(() => aggregateField), value => value.fields, fields => finish(() => ({ kind, fields }))));
  }

  const aggregateWire: Wire<MirAggregate> = variants([
    choice("array", () => aggregateElements("array")), choice("tuple", () => aggregateElements("tuple")), choice("fixed-array", () => aggregateElements("fixed-array")),
    choice("object", () => aggregateFields("object")), choice("record", () => aggregateFields("record")),
  ], (value, path, next) => {
    switch (value.kind) {
      case "array": case "tuple": case "fixed-array": return aggregateElements(value.kind).write(value, path, next);
      case "object": case "record": return aggregateFields(value.kind).write(value, path, next);
    }
  });

  const closureCapture = record<MirClosureCapture>("MirClosureCapture", () =>
    field("local", () => localRefWire, value => value.local, local =>
      field("place", () => placeWire, value => value.place, place => finish(() => ({ local, place })))));

  const useRvalue = record<MirRvalue & { readonly kind: "use" }>("use", () =>
    field("operand", () => operandWire, value => value.operand, operand => finish(() => ({ kind: "use", operand }))));

  const unaryRvalue = record<MirRvalue & { readonly kind: "unary" }>("unary", () =>
    field("operation", () => operationWire, value => value.operation, operation =>
      field("operand", () => operandWire, value => value.operand, operand => finish(() => ({ kind: "unary", operation, operand })))));

  const binaryRvalue = record<MirRvalue & { readonly kind: "binary" }>("binary", () =>
    field("operation", () => operationWire, value => value.operation, operation =>
      field("left", () => operandWire, value => value.left, left =>
        field("right", () => operandWire, value => value.right, right => finish(() => ({ kind: "binary", operation, left, right }))))));

  const convertRvalue = record<MirRvalue & { readonly kind: "convert" }>("convert", () =>
    field("operation", () => operationWire, value => value.operation, operation =>
      field("operand", () => operandWire, value => value.operand, operand =>
        field("to", () => typeWire, value => value.to, to => finish(() => ({ kind: "convert", operation, operand, to }))))));

  const aggregateRvalue = record<MirRvalue & { readonly kind: "aggregate" }>("aggregate", () =>
    field("type", () => typeWire, value => value.type, type =>
      field("aggregate", () => aggregateWire, value => value.aggregate, aggregate => finish(() => ({ kind: "aggregate", type, aggregate })))));

  const addressRvalue = record<MirRvalue & { readonly kind: "address-of" }>("address-of", () =>
    field("place", () => placeWire, value => value.place, place =>
      field("type", () => typeWire, value => value.type, type => finish(() => ({ kind: "address-of", place, type })))));

  const closureRvalue = record<MirRvalue & { readonly kind: "closure" }>("closure", () =>
    field("instance", () => instanceWire, value => value.instance, instance =>
      field("captures", () => vector(() => closureCapture), value => value.captures, captures => finish(() => ({ kind: "closure", instance, captures })))));

  const rvalueWire: Wire<MirRvalue> = variants([
    choice("use", () => useRvalue), choice("unary", () => unaryRvalue), choice("binary", () => binaryRvalue), choice("convert", () => convertRvalue),
    choice("aggregate", () => aggregateRvalue), choice("address-of", () => addressRvalue), choice("closure", () => closureRvalue),
  ], (value, path, next) => {
    switch (value.kind) {
      case "use": return useRvalue.write(value, path, next);
      case "unary": return unaryRvalue.write(value, path, next);
      case "binary": return binaryRvalue.write(value, path, next);
      case "convert": return convertRvalue.write(value, path, next);
      case "aggregate": return aggregateRvalue.write(value, path, next);
      case "address-of": return addressRvalue.write(value, path, next);
      case "closure": return closureRvalue.write(value, path, next);
    }
  });

  const stepRef = record<MirStepRef>("MirStepRef", () =>
    field("protocol", () => numberWire, value => value.protocol, protocol =>
      field("step", () => numberWire, value => value.step, step => finish(() => ({ protocol, step })))));
  const stepWire = nullable(() => stepRef);

  const assignStatement = record<MirStatement & { readonly kind: "assign" }>("assign", () => siteFields((origin, tir) =>
    field("place", () => placeWire, value => value.place, place =>
      field("value", () => rvalueWire, value => value.value, value =>
        field("step", () => stepWire, statement => statement.step, step => finish(() => ({ origin, tir, kind: "assign", place, value, step })))))));

  function storageStatement<Kind extends "storage-live" | "storage-dead">(kind: Kind) {
    return record<MirSite & { readonly kind: Kind; readonly local: LocalId }>(kind, () => siteFields((origin, tir) =>
      field("local", () => localWire, value => value.local, local => finish(() => ({ origin, tir, kind, local })))));
  }

  const statementWire: Wire<MirStatement> = variants([
    choice("assign", () => assignStatement), choice("storage-live", () => storageStatement("storage-live")), choice("storage-dead", () => storageStatement("storage-dead")),
  ], (value, path, next) => {
    switch (value.kind) {
      case "assign": return assignStatement.write(value, path, next);
      case "storage-live": case "storage-dead": return storageStatement(value.kind).write(value, path, next);
    }
  });

  const handlerUnwind = record<MirUnwind & { readonly kind: "handler" }>("handler", () =>
    field("exception", () => placeWire, value => value.exception, exception =>
      field("target", () => blockWire, value => value.target, target => finish(() => ({ kind: "handler", exception, target })))));

  const escapeUnwind = record<MirUnwind & { readonly kind: "escape" }>("escape", () => finish(() => ({ kind: "escape" })));

  const abortUnwind = record<MirUnwind & { readonly kind: "abort" }>("abort", () => finish(() => ({ kind: "abort" })));

  const noneUnwind = record<MirUnwind & { readonly kind: "none" }>("none", () => finish(() => ({ kind: "none" })));

  const unwindWire: Wire<MirUnwind> = variants([choice("handler", () => handlerUnwind), choice("escape", () => escapeUnwind),
    choice("abort", () => abortUnwind), choice("none", () => noneUnwind)],
    (value, path, next) => {
      switch (value.kind) {
        case "handler": return handlerUnwind.write(value, path, next);
        case "escape": return escapeUnwind.write(value, path, next);
        case "abort": return abortUnwind.write(value, path, next);
        case "none": return noneUnwind.write(value, path, next);
      }
    });

  const suspensionReturn = record<MirSuspensionReturn>("MirSuspensionReturn", () =>
    field("destination", () => placeWire, value => value.destination, destination =>
      field("target", () => blockWire, value => value.target, target => finish(() => ({ destination, target })))));

  const switchTarget = record<MirSwitchTarget>("MirSwitchTarget", () =>
    field("constant", () => constantWire, value => value.constant, constant =>
      field("target", () => blockWire, value => value.target, target => finish(() => ({ constant, target })))));

  const valueArgument = record<MirCallArgument & { readonly kind: "value" }>("value", () =>
    field("passing", () => literals(["by-value", "move"]), value => value.passing, passing =>
      field("operand", () => operandWire, value => value.operand, operand => finish(() => ({ kind: "value", passing, operand })))));

  const placePassing: Wire<PlacePassingMode> = literals(["byref-readonly", "byref-readwrite", "byref-writeonly-must-init", "borrow-shared", "borrow-mut"]);

  const placeArgument = record<MirCallArgument & { readonly kind: "place" }>("place", () =>
    field("passing", () => placePassing, value => value.passing, passing =>
      field("place", () => placeWire, value => value.place, place => finish(() => ({ kind: "place", passing, place })))));

  const omittedArgument = record<MirCallArgument & { readonly kind: "omitted" }>("omitted", () => finish(() => ({ kind: "omitted" })));

  const argumentWire: Wire<MirCallArgument> = variants([choice("value", () => valueArgument), choice("place", () => placeArgument),
    choice("omitted", () => omittedArgument)],
    (value, path, next) => {
      switch (value.kind) {
        case "value": return valueArgument.write(value, path, next);
        case "place": return placeArgument.write(value, path, next);
        case "omitted": return omittedArgument.write(value, path, next);
      }
    });

  const directCallee = record<MirCallee & { readonly kind: "direct" }>("direct", () =>
    field("resolution", () => calleeWire, value => value.resolution, resolution => finish(() => ({ kind: "direct", resolution }))));

  const indirectCallee = record<MirCallee & { readonly kind: "indirect" }>("indirect", () =>
    field("operand", () => operandWire, value => value.operand, operand =>
      field("resolution", () => calleeWire, value => value.resolution, resolution => finish(() => ({ kind: "indirect", operand, resolution })))));

  const bodyCallee = record<MirCallee & { readonly kind: "body" }>("body", () =>
    field("instance", () => instanceWire, value => value.instance, instance =>
      field("captures", () => vector(() => closureCapture), value => value.captures, captures => finish(() => ({ kind: "body", instance, captures })))));

  const mirCallee: Wire<MirCallee> = variants([choice("direct", () => directCallee), choice("indirect", () => indirectCallee),
    choice("body", () => bodyCallee)],
    (value, path, next) => {
      switch (value.kind) {
        case "direct": return directCallee.write(value, path, next);
        case "indirect": return indirectCallee.write(value, path, next);
        case "body": return bodyCallee.write(value, path, next);
      }
    });

  const gotoTerminator = record<MirTerminator & { readonly kind: "goto" }>("goto", () => siteFields((origin, tir) =>
    field("target", () => blockWire, value => value.target, target => finish(() => ({ origin, tir, kind: "goto", target })))));

  const switchTerminator = record<MirTerminator & { readonly kind: "switch" }>("switch", () => siteFields((origin, tir) =>
    field("operand", () => operandWire, value => value.operand, operand =>
      field("targets", () => vector(() => switchTarget), value => value.targets, targets =>
        field("otherwise", () => blockWire, value => value.otherwise, otherwise =>
          field("step", () => stepWire, value => value.step, step => finish(() => ({ origin, tir, kind: "switch", operand, targets, otherwise, step }))))))));

  const checkTerminator = record<MirTerminator & { readonly kind: "check" }>("check", () => siteFields((origin, tir) =>
    field("place", () => placeWire, value => value.place, place =>
      field("next", () => blockWire, value => value.next, next =>
        field("unwind", () => unwindWire, value => value.unwind, unwind => finish(() => ({ origin, tir, kind: "check", place, next, unwind })))))));

  const callTerminator = record<MirTerminator & { readonly kind: "call" }>("call", () => siteFields((origin, tir) =>
    field("callee", () => mirCallee, value => value.callee, callee =>
      field("receiver", () => nullable(() => operandWire), value => value.receiver, receiver =>
        field("arguments", () => vector(() => argumentWire), value => value.arguments, argumentsValue =>
          field("destination", () => nullable(() => placeWire), value => value.destination, destination =>
            field("next", () => blockWire, value => value.next, next =>
              field("unwind", () => unwindWire, value => value.unwind, unwind =>
                field("step", () => stepWire, value => value.step, step =>
                  finish(() => ({ origin, tir, kind: "call", callee, receiver, arguments: argumentsValue, destination, next, unwind, step })))))))))));

  const invokeTerminator = record<MirTerminator & { readonly kind: "invoke" }>("invoke", () => siteFields((origin, tir) =>
    field("operation", () => operationWire, value => value.operation, operation =>
      field("operands", () => vector(() => operandWire), value => value.operands, operands =>
        field("destination", () => nullable(() => placeWire), value => value.destination, destination =>
          field("next", () => blockWire, value => value.next, next =>
            field("unwind", () => unwindWire, value => value.unwind, unwind =>
              field("step", () => stepWire, value => value.step, step =>
                finish(() => ({ origin, tir, kind: "invoke", operation, operands, destination, next, unwind, step }))))))))));

  const awaitTerminator = record<MirTerminator & { readonly kind: "await" }>("await", () => siteFields((origin, tir) =>
    field("operand", () => operandWire, value => value.operand, operand =>
      field("destination", () => placeWire, value => value.destination, destination =>
        field("resume", () => blockWire, value => value.resume, resume =>
          field("unwind", () => unwindWire, value => value.unwind, unwind =>
            field("step", () => stepWire, value => value.step, step => finish(() => ({ origin, tir, kind: "await", operand, destination, resume, unwind, step })))))))));

  const yieldTerminator = record<MirTerminator & { readonly kind: "yield" }>("yield", () => siteFields((origin, tir) =>
    field("operand", () => nullable(() => operandWire), value => value.operand, operand =>
      field("destination", () => placeWire, value => value.destination, destination =>
        field("resume", () => blockWire, value => value.resume, resume =>
          field("return", () => suspensionReturn, value => value.return, returnValue =>
            field("unwind", () => unwindWire, value => value.unwind, unwind =>
              field("step", () => stepWire, value => value.step, step =>
                finish(() => ({ origin, tir, kind: "yield", operand, destination, resume, return: returnValue, unwind, step }))))))))));

  const delegateTerminator = record<MirTerminator & { readonly kind: "delegate" }>("delegate", () => siteFields((origin, tir) =>
    field("iterator", () => operandWire, value => value.iterator, iterator =>
      field("destination", () => placeWire, value => value.destination, destination =>
        field("resume", () => blockWire, value => value.resume, resume =>
          field("return", () => suspensionReturn, value => value.return, returnValue =>
            field("unwind", () => unwindWire, value => value.unwind, unwind =>
              field("step", () => stepWire, value => value.step, step =>
                finish(() => ({ origin, tir, kind: "delegate", iterator, destination, resume, return: returnValue, unwind, step }))))))))));

  const throwTerminator = record<MirTerminator & { readonly kind: "throw" }>("throw", () => siteFields((origin, tir) =>
    field("operand", () => operandWire, value => value.operand, operand =>
      field("unwind", () => unwindWire, value => value.unwind, unwind => finish(() => ({ origin, tir, kind: "throw", operand, unwind }))))));

  const returnTerminator = record<MirTerminator & { readonly kind: "return" }>("return", () => siteFields((origin, tir) =>
    field("value", () => nullable(() => operandWire), value => value.value, value => finish(() => ({ origin, tir, kind: "return", value })))));

  const unreachableTerminator = record<MirTerminator & { readonly kind: "unreachable" }>("unreachable", () =>
    siteFields((origin, tir) => finish(() => ({ origin, tir, kind: "unreachable" }))));

  const terminatorWire: Wire<MirTerminator> = variants([
    choice("goto", () => gotoTerminator), choice("switch", () => switchTerminator), choice("check", () => checkTerminator),
    choice("call", () => callTerminator), choice("invoke", () => invokeTerminator),
    choice("await", () => awaitTerminator), choice("yield", () => yieldTerminator), choice("delegate", () => delegateTerminator), choice("throw", () => throwTerminator),
    choice("return", () => returnTerminator), choice("unreachable", () => unreachableTerminator),
  ], (value, path, next) => {
    switch (value.kind) {
      case "goto": return gotoTerminator.write(value, path, next);
      case "switch": return switchTerminator.write(value, path, next);
      case "check": return checkTerminator.write(value, path, next);
      case "call": return callTerminator.write(value, path, next);
      case "invoke": return invokeTerminator.write(value, path, next);
      case "await": return awaitTerminator.write(value, path, next);
      case "yield": return yieldTerminator.write(value, path, next);
      case "delegate": return delegateTerminator.write(value, path, next);
      case "throw": return throwTerminator.write(value, path, next);
      case "return": return returnTerminator.write(value, path, next);
      case "unreachable": return unreachableTerminator.write(value, path, next);
    }
  });

  const mirBlock = record<MirBlock>("MirBlock", () => siteFields((origin, tir) =>
    field("id", () => blockWire, value => value.id, id =>
      field("statements", () => vector(() => statementWire), value => value.statements, statements =>
        field("terminator", () => terminatorWire, value => value.terminator, terminator => finish(() => ({ origin, tir, id, statements, terminator })))))));

  const mirEntry = record<MirEntry>("MirEntry", () =>
    field("provided", () => numberWire, value => value.provided, provided =>
      field("block", () => blockWire, value => value.block, block => finish(() => ({ provided, block })))));

  const mirBodyWire = record<MirBody>("MirBody", () =>
    field("body", () => bodyWire, value => value.body, body =>
      field("bindings", () => artifactWire, value => value.bindings, bindings =>
       field("entries", () => vector(() => mirEntry), value => value.entries, entries =>
        field("locals", () => vector(() => mirLocal), value => value.locals, locals =>
          field("constants", () => vector(() => mirConstant), value => value.constants, constants =>
            field("places", () => vector(() => mirPlace), value => value.places, places =>
              field("blocks", () => vector(() => mirBlock), value => value.blocks, blocks =>
                field("result", () => typeWire, value => value.result, result => finish(() => ({ body, bindings, entries, locals, constants, places, blocks, result })))))))))));
  return mirBodyWire;
}
