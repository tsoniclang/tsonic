import type {
  ApplicationDecision, ConstructionPartDecision, DeferredDecision, DeferredInvocation, EmbeddingDecision,
  EmbeddingProof, MemberDecision, OperationDecision, OperationIdentity, ProtocolStepDecision,
  RefinementDecision, RuleOutcome,
} from "../ir-infer/contract.js";
import type {
  ConversionDecision, MemberSelection, ResolvedCallee, TirApplication, TirProtocol, TypedOperation, TypedValue,
  TargetAccess, TypedAlias, TypedApplication, TypedBigInt, TypedBinary, TypedBinding, TypedBindingElement,
  TypedCallable, TypedClass, TypedClassValue, TypedClosure, TypedConditional, TypedConstruction, TypedDecorator,
  TypedEnum, TypedExportAssignment, TypedHeritage, TypedIndexDeclaration, TypedInstantiation, TypedInterface, TypedIteration,
  TypedKeyword, TypedMember, TypedName, TypedNamespace, TypedNumber, TypedObjectSpread, TypedOmission,
  TypedParameter, TypedPredicate, TypedPrefix, TypedProperty, TypedPropertyKey, TypedProtocolValue,
  TypedSourceFile, TypedStaticBlock, TypedStorageDeclaration, TypedString, TypedTemplate, TypedType,
  TypedTypeParameter, TypedUnary, TypedUpdate, TypedVariableList,
} from "../ir-tir/contract.js";
import type {
  CapturedFact, HirCapturedType, HirCoreCapture, HirFieldMarkerCapture, HirMarkersCapture, HirPointerTypeCapture,
} from "../ir-hir/contract.js";
import type { InstantiationStop, ProjectionInventory } from "./program-values.js";
import {
  inventoryBindings, inventoryComponent, inventoryEach, inventoryEndpoint, inventoryEvidence, inventoryFields,
  inventoryInstance, inventoryParameter, inventoryRecord, inventorySignature, inventoryType,
} from "./program-values.js";

function embeddingProof(scan: ProjectionInventory, value: EmbeddingProof): InstantiationStop | null {
  inventoryEach(scan, value.steps, step => inventoryRecord(scan, 4)
    ?? inventoryComponent(scan, step.from) ?? inventoryComponent(scan, step.to));
  return inventoryRecord(scan, 2);
}

export function inventoryEmbedding(scan: ProjectionInventory, value: EmbeddingDecision): InstantiationStop | null {
  switch (value.kind) {
    case "identity":
    case "refused": return inventoryFields(scan, 1);
    case "conversion": return inventoryRecord(scan, 3) ?? embeddingProof(scan, value.proof);
  }
}

function memberDecision(scan: ProjectionInventory, value: MemberDecision): InstantiationStop | null {
  if (value.getter !== null) {
    const getter = value.getter;
    scan.pending.push(() => inventoryEndpoint(scan, getter));
  }
  if (value.setter !== null) {
    const setter = value.setter;
    scan.pending.push(() => inventoryEndpoint(scan, setter));
  }
  return inventoryRecord(scan, 9) ?? inventoryType(scan, value.read)
    ?? inventoryType(scan, value.write) ?? inventoryBindings(scan, value.bindings);
}

export function inventoryApplication(scan: ProjectionInventory, value: ApplicationDecision): InstantiationStop | null {
  inventoryEach(scan, value.parameters, parameter => {
    switch (parameter.kind) {
      case "argument":
      case "default":
      case "rest": return inventoryFields(scan, 1);
      case "omitted": return inventoryRecord(scan, 3) ?? inventoryType(scan, parameter.type);
    }
  });
  return inventoryRecord(scan, 8) ?? inventoryEndpoint(scan, value.advertised) ?? inventoryEndpoint(scan, value.api)
    ?? inventoryBindings(scan, value.bindings) ?? inventoryBindings(scan, value.implementationBindings)
    ?? inventoryRecord(scan, 4) ?? inventorySignature(scan, value.completion.signature)
    ?? inventoryType(scan, value.completion.completion) ?? inventoryType(scan, value.completion.yielded)
    ?? inventoryType(scan, value.completion.sent) ?? inventoryType(scan, value.result);
}

export function inventoryConstructionPart(scan: ProjectionInventory, value: ConstructionPartDecision): InstantiationStop | null {
  return inventoryRecord(scan, 5) ?? inventoryComponent(scan, value.destination)
    ?? (value.member === null ? null : memberDecision(scan, value.member)) ?? inventoryEmbedding(scan, value.embedding);
}

function protocolStep(scan: ProjectionInventory, value: ProtocolStepDecision): InstantiationStop | null {
  inventoryEach(scan, value.operands, type => inventoryType(scan, type));
  const base = inventoryRecord(scan, 4) ?? inventoryType(scan, value.result);
  if (base !== null) return base;
  switch (value.operation.kind) {
    case "call": return inventoryRecord(scan, 2) ?? inventoryApplication(scan, value.operation.application);
    case "core": return inventoryRecord(scan, 3) ?? inventoryBindings(scan, value.operation.bindings);
    case "completion": return inventoryRecord(scan, 1);
  }
}

function operationIdentity(scan: ProjectionInventory, value: OperationIdentity): InstantiationStop | null {
  switch (value.kind) {
    case "native-operator":
    case "bigint-operator":
    case "string-operator":
    case "boolean-operator":
    case "absence-test":
    case "pointer-address":
    case "pointer-read":
    case "pointer-write":
    case "pointer-offset":
    case "type-query":
    case "discard": return inventoryFields(scan, 1);
    case "object-construction":
    case "array-construction":
      inventoryEach(scan, value.parts, part => inventoryConstructionPart(scan, part));
      return inventoryRecord(scan, 2);
    case "protocol":
      inventoryEach(scan, value.steps, step => protocolStep(scan, step));
      return inventoryRecord(scan, 9) ?? inventoryType(scan, value.value) ?? inventoryType(scan, value.completion)
        ?? inventoryType(scan, value.yielded) ?? inventoryType(scan, value.sent) ?? inventoryType(scan, value.thrown);
    case "conversion": return inventoryRecord(scan, 4) ?? inventoryType(scan, value.from)
      ?? inventoryType(scan, value.to) ?? inventoryEmbedding(scan, value.embedding);
    case "library":
    case "core": return inventoryRecord(scan, 3) ?? inventoryBindings(scan, value.bindings);
  }
}

function operationDecision(scan: ProjectionInventory, value: OperationDecision): InstantiationStop | null {
  inventoryEach(scan, value.operands, type => inventoryType(scan, type));
  scan.pending.push(() => operationIdentity(scan, value.operation));
  return inventoryRecord(scan, 4) ?? inventoryType(scan, value.result);
}

export function inventoryTypedOperation(scan: ProjectionInventory, value: TypedOperation): InstantiationStop | null {
  return inventoryRecord(scan, 2) ?? operationDecision(scan, value.decision);
}

export function inventoryRefinement(scan: ProjectionInventory, value: RefinementDecision): InstantiationStop | null {
  switch (value.kind) {
    case "identity": return inventoryRecord(scan, 2) ?? inventoryType(scan, value.type);
    case "narrowed": return inventoryRecord(scan, 4) ?? inventoryType(scan, value.source)
      ?? inventoryType(scan, value.result) ?? embeddingProof(scan, value.proof);
  }
}

function invocation(scan: ProjectionInventory, value: DeferredInvocation): InstantiationStop | null {
  const context = inventoryRecord(scan, 2) ?? inventoryRecord(scan, 3) ?? inventoryBindings(scan, value.input.context.bindings);
  if (context !== null) return context;
  switch (value.rule) {
    case "embed": return inventoryRecord(scan, 4) ?? inventoryEvidence(scan, value.input.from) ?? inventoryEvidence(scan, value.input.to);
    case "domain-fit": return inventoryRecord(scan, 3) ?? inventoryEvidence(scan, value.input.value) ?? inventoryEvidence(scan, value.input.domain);
    case "memory-equivalent": return inventoryRecord(scan, 3) ?? inventoryEvidence(scan, value.input.left) ?? inventoryEvidence(scan, value.input.right);
    case "member": return inventoryRecord(scan, 5) ?? inventoryEvidence(scan, value.input.receiver);
    case "index": return inventoryRecord(scan, 4) ?? inventoryEvidence(scan, value.input.receiver) ?? inventoryEvidence(scan, value.input.key);
    case "construct-literal":
      inventoryEach(scan, value.input.parts, part => inventoryRecord(scan, part.kind === "property" ? 4 : 3) ?? inventoryEvidence(scan, part.value));
      return inventoryRecord(scan, 4) ?? (value.input.destination === null ? null : inventoryEvidence(scan, value.input.destination));
    case "candidate":
      inventoryEach(scan, value.input.typeArguments, type => inventoryEvidence(scan, type));
      inventoryEach(scan, value.input.arguments, argument => {
        if (argument.tuple !== null) inventoryEach(scan, argument.tuple, type => inventoryEvidence(scan, type));
        return inventoryRecord(scan, 4) ?? inventoryEvidence(scan, argument.value);
      });
      inventoryEach(scan, value.input.candidates, candidate => inventoryRecord(scan, 6)
        ?? inventoryEndpoint(scan, candidate.advertised) ?? inventoryEndpoint(scan, candidate.api)
        ?? inventoryBindings(scan, candidate.bindings));
      return inventoryRecord(scan, 7) ?? inventoryEvidence(scan, value.input.callee)
        ?? (value.input.receiver === null ? null : inventoryEvidence(scan, value.input.receiver));
    case "operator":
      inventoryEach(scan, value.input.operands, operand => inventoryEvidence(scan, operand));
      return inventoryRecord(scan, 4);
    case "literal-fit": return inventoryRecord(scan, 3) ?? inventoryEvidence(scan, value.input.destination);
    case "protocol":
      inventoryEach(scan, value.input.operands, operand => inventoryEvidence(scan, operand));
      return inventoryRecord(scan, 9)
        ?? (value.input.subject === null ? null : inventoryEvidence(scan, value.input.subject))
        ?? (value.input.completion === null ? null : inventoryEvidence(scan, value.input.completion))
        ?? (value.input.yielded === null ? null : inventoryEvidence(scan, value.input.yielded))
        ?? (value.input.sent === null ? null : inventoryEvidence(scan, value.input.sent))
        ?? inventoryEvidence(scan, value.input.thrown);
    case "refinement": return inventoryRecord(scan, 3) ?? inventoryEvidence(scan, value.input.source) ?? inventoryEvidence(scan, value.input.checked);
    case "library":
      inventoryEach(scan, value.input.arguments, argument => inventoryEvidence(scan, argument));
      return inventoryRecord(scan, 5) ?? (value.input.receiver === null ? null : inventoryEvidence(scan, value.input.receiver))
        ?? inventoryEvidence(scan, value.input.result);
    case "core":
      inventoryEach(scan, value.input.operands, operand => inventoryEvidence(scan, operand));
      return inventoryRecord(scan, 6) ?? inventoryCoreCapture(scan, value.input.captured) ?? inventoryEvidence(scan, value.input.result);
  }
}

export function inventoryDeferred(scan: ProjectionInventory, value: DeferredDecision): InstantiationStop | null {
  scan.pending.push(() => invocation(scan, value.invocation));
  return inventoryRecord(scan, 2) ?? inventoryType(scan, value.result);
}

export function inventoryOutcome<Decision>(
  scan: ProjectionInventory, value: RuleOutcome<Decision>, visit: (decision: Decision) => InstantiationStop | null,
): InstantiationStop | null {
  const record = inventoryRecord(scan, 2);
  if (record !== null) return record;
  switch (value.kind) {
    case "decided": return visit(value.decision);
    case "deferred": return inventoryDeferred(scan, value.deferred);
  }
}

export function inventoryCallee(scan: ProjectionInventory, value: ResolvedCallee): InstantiationStop | null {
  return inventoryRecord(scan, 3) ?? inventoryApplication(scan, value.decision)
    ?? (value.activation === null ? null : inventoryInstance(scan, value.activation));
}

export function inventorySelection(scan: ProjectionInventory, value: MemberSelection): InstantiationStop | null {
  return inventoryRecord(scan, 3) ?? memberDecision(scan, value.decision)
    ?? (value.getter === null ? null : inventoryCallee(scan, value.getter))
    ?? (value.setter === null ? null : inventoryCallee(scan, value.setter));
}

export function inventoryTirApplication(scan: ProjectionInventory, value: TirApplication): InstantiationStop | null {
  inventoryEach(scan, value.arguments, argument => {
    switch (argument.kind) {
      case "provided": return inventoryFields(scan, 1);
      case "rest":
        inventoryEach(scan, argument.parts, part => {
          switch (part.kind) {
            case "value": return inventoryFields(scan, 1);
            case "spread":
              if (part.tuple !== null) inventoryEach(scan, part.tuple, type => inventoryType(scan, type));
              return inventoryRecord(scan, 3);
          }
        });
        return inventoryRecord(scan, 3);
      case "omitted":
        switch (argument.value.kind) {
          case "absence":
          case "empty-rest": return inventoryFields(scan, 2);
          case "initializer": return inventoryRecord(scan, 3) ?? inventoryRecord(scan, 2)
            ?? inventoryInstance(scan, argument.value.instance);
        }
    }
  });
  return inventoryRecord(scan, 3) ?? inventoryCallee(scan, value.callee);
}

export function inventoryProtocol(scan: ProjectionInventory, value: TirProtocol): InstantiationStop | null {
  inventoryEach(scan, value.steps, step => inventoryRecord(scan, 3) ?? inventoryTypedOperation(scan, step.operation)
    ?? (step.callee === null ? null : inventoryCallee(scan, step.callee)));
  return inventoryRecord(scan, 7) ?? inventoryType(scan, value.value) ?? inventoryType(scan, value.completion)
    ?? inventoryType(scan, value.sent) ?? inventoryType(scan, value.thrown);
}

function conversion(scan: ProjectionInventory, value: ConversionDecision): InstantiationStop | null {
  switch (value.kind) {
    case "identity": return inventoryFields(scan, 1);
    case "convert": return inventoryRecord(scan, 4) ?? inventoryEmbedding(scan, value.embedding) ?? inventoryTypedOperation(scan, value.operation);
    case "deferred": return inventoryRecord(scan, 2) ?? inventoryDeferred(scan, value.deferred);
  }
}

export function inventoryValue(scan: ProjectionInventory, value: TypedValue): InstantiationStop | null {
  return inventoryRecord(scan, 6) ?? inventoryType(scan, value.type) ?? inventoryType(scan, value.convertedType)
    ?? conversion(scan, value.conversion) ?? (value.narrowing === null ? null : inventoryRefinement(scan, value.narrowing));
}

function captured<Value>(
  scan: ProjectionInventory, value: CapturedFact<Value>, visit: (value: Value) => InstantiationStop | null,
): InstantiationStop | null {
  switch (value.kind) {
    case "unavailable": return inventoryFields(scan, 1);
    case "available": return inventoryRecord(scan, 2) ?? visit(value.value);
  }
}

function fieldMarker(scan: ProjectionInventory, value: HirFieldMarkerCapture): InstantiationStop | null {
  return inventoryRecord(scan, 4) ?? captured(scan, value.type, type => inventoryType(scan, type));
}

function markers(scan: ProjectionInventory, value: HirMarkersCapture): InstantiationStop | null {
  if (value.struct !== null) {
    const struct = value.struct;
    scan.pending.push(() => inventoryRecord(scan, 2) ?? captured(scan, struct.fields, values => {
      inventoryEach(scan, values, field => fieldMarker(scan, field));
      return null;
    }));
  }
  if (value.field !== null) {
    const field = value.field;
    scan.pending.push(() => fieldMarker(scan, field));
  }
  if (value.defaultValue !== null) {
    const defaultValue = value.defaultValue;
    scan.pending.push(() => inventoryRecord(scan, 2) ?? captured(scan, defaultValue.type, type => inventoryType(scan, type)));
  }
  return inventoryRecord(scan, 4);
}

function capturedType(scan: ProjectionInventory, value: HirCapturedType): InstantiationStop | null {
  return inventoryRecord(scan, 2) ?? captured(scan, value.type, type => inventoryType(scan, type))
    ?? inventoryComponent(scan, value.component);
}

function pointerCapture(scan: ProjectionInventory, value: HirPointerTypeCapture): InstantiationStop | null {
  switch (value.kind) {
    case "raw-address":
    case "native-pointer": return inventoryFields(scan, 1);
    case "typed-location": return inventoryRecord(scan, 3) ?? capturedType(scan, value.pointee);
    case "function-pointer":
      inventoryEach(scan, value.parameters, parameter => capturedType(scan, parameter));
      return inventoryRecord(scan, 5) ?? capturedType(scan, value.result);
  }
}

function inventoryCoreCapture(scan: ProjectionInventory, value: HirCoreCapture): InstantiationStop | null {
  return inventoryRecord(scan, 8) ?? captured(scan, value.markers, value => markers(scan, value))
    ?? captured(scan, value.pointerType, value => value === null ? null : pointerCapture(scan, value));
}

export function inventoryAccess(scan: ProjectionInventory, value: TargetAccess): InstantiationStop | null {
  switch (value.kind) {
    case "write": return inventoryRecord(scan, 2) ?? inventoryType(scan, value.storage);
    case "read-write": return inventoryRecord(scan, 5) ?? inventoryType(scan, value.storage) ?? inventoryType(scan, value.read)
      ?? (value.narrowing === null ? null : inventoryRefinement(scan, value.narrowing));
  }
}

export function inventoryName(scan: ProjectionInventory, value: TypedName): InstantiationStop | null {
  switch (value.role) {
    case "value": return inventoryRecord(scan, 8) ?? inventoryValue(scan, value);
    case "shorthand-value": return inventoryRecord(scan, 9) ?? inventoryValue(scan, value);
    case "assignment-target": return inventoryRecord(scan, 3) ?? inventoryAccess(scan, value.access);
    case "declaration-name": return inventoryRecord(scan, 3) ?? inventoryType(scan, value.storage);
    case "type-name": return inventoryRecord(scan, 3) ?? inventoryType(scan, value.type);
    case "property-name":
    case "label":
    case "private-name": return inventoryFields(scan, 1);
  }
}

export function inventoryString(scan: ProjectionInventory, value: TypedString): InstantiationStop | null {
  switch (value.role) {
    case "value": return inventoryRecord(scan, 8) ?? inventoryValue(scan, value);
    case "type-literal": return inventoryRecord(scan, 2) ?? inventoryType(scan, value.type);
    case "property-name":
    case "declaration-name":
    case "module-specifier":
    case "export-name":
    case "attribute-value": return inventoryFields(scan, 1);
  }
}

export function inventoryNumber(scan: ProjectionInventory, value: TypedNumber | TypedBigInt): InstantiationStop | null {
  switch (value.role) {
    case "value": return inventoryRecord(scan, 8) ?? inventoryValue(scan, value);
    case "type-literal": return inventoryRecord(scan, 2) ?? inventoryType(scan, value.type);
    case "property-name":
    case "declaration-name": return inventoryFields(scan, 1);
  }
}

export function inventoryKeyword(scan: ProjectionInventory, value: TypedKeyword): InstantiationStop | null {
  switch (value.role) {
    case "value": return inventoryRecord(scan, 7) ?? inventoryValue(scan, value);
    case "receiver": return inventoryRecord(scan, 8) ?? inventoryValue(scan, value);
    case "super": return inventoryRecord(scan, 9) ?? inventoryValue(scan, value) ?? inventoryType(scan, value.base);
    case "type-literal": return inventoryRecord(scan, 2) ?? inventoryType(scan, value.type);
  }
}

export function inventoryBinary(scan: ProjectionInventory, value: TypedBinary): InstantiationStop | null {
  const common = inventoryValue(scan, value);
  if (common !== null) return common;
  switch (value.role) {
    case "arithmetic":
    case "comparison": return inventoryRecord(scan, 8) ?? inventoryOutcome(scan, value.operation, operation => inventoryTypedOperation(scan, operation));
    case "short-circuit": return inventoryRecord(scan, 8);
    case "assignment": return inventoryRecord(scan, 10) ?? inventoryType(scan, value.storage)
      ?? (value.calculation === null ? null : inventoryOutcome(scan, value.calculation, operation => inventoryTypedOperation(scan, operation)));
    case "sequence": return inventoryRecord(scan, 7);
  }
}

export function inventoryUnary(scan: ProjectionInventory, value: TypedUnary | TypedTemplate): InstantiationStop | null {
  return inventoryRecord(scan, 7) ?? inventoryValue(scan, value)
    ?? inventoryOutcome(scan, value.operation, operation => inventoryTypedOperation(scan, operation));
}

export function inventoryPrefix(scan: ProjectionInventory, value: TypedPrefix): InstantiationStop | null {
  switch (value.role) {
    case "type-literal": return inventoryRecord(scan, 2) ?? inventoryType(scan, value.type);
    case "value": return inventoryRecord(scan, 8) ?? inventoryUnary(scan, value);
    case "update": return inventoryRecord(scan, 9) ?? inventoryUnary(scan, value) ?? inventoryType(scan, value.storage);
  }
}

export function inventoryUpdate(scan: ProjectionInventory, value: TypedUpdate): InstantiationStop | null {
  return inventoryRecord(scan, 8) ?? inventoryUnary(scan, value) ?? inventoryType(scan, value.storage);
}

export function inventoryTypedMember(scan: ProjectionInventory, value: TypedMember): InstantiationStop | null {
  const selection = inventoryOutcome(scan, value.selection, selection => inventorySelection(scan, selection));
  if (selection !== null) return selection;
  switch (value.role) {
    case "value": return inventoryRecord(scan, 8) ?? inventoryValue(scan, value);
    case "assignment-target": return inventoryRecord(scan, 3) ?? inventoryAccess(scan, value.access);
  }
}

export function inventoryTypedApplication(scan: ProjectionInventory, value: TypedApplication): InstantiationStop | null {
  return inventoryRecord(scan, 8) ?? inventoryValue(scan, value)
    ?? inventoryOutcome(scan, value.application, application => inventoryTirApplication(scan, application))
    ?? (value.operation === null ? null : inventoryOutcome(scan, value.operation, operation => inventoryTypedOperation(scan, operation)));
}

export function inventoryProtocolValue(scan: ProjectionInventory, value: TypedProtocolValue): InstantiationStop | null {
  return inventoryRecord(scan, 7) ?? inventoryValue(scan, value)
    ?? inventoryOutcome(scan, value.protocol, protocol => inventoryProtocol(scan, protocol));
}

export function inventoryConstruction(scan: ProjectionInventory, value: TypedConstruction): InstantiationStop | null {
  switch (value.role) {
    case "value": return inventoryRecord(scan, 8) ?? inventoryValue(scan, value)
      ?? inventoryOutcome(scan, value.construction, operation => inventoryTypedOperation(scan, operation));
    case "assignment-pattern":
      inventoryEach(scan, value.parts, part => inventoryConstructionPart(scan, part));
      return inventoryRecord(scan, 3) ?? inventoryType(scan, value.storage);
  }
}

export function inventoryInstantiation(scan: ProjectionInventory, value: TypedInstantiation): InstantiationStop | null {
  const bindings = inventoryBindings(scan, value.bindings);
  if (bindings !== null) return bindings;
  switch (value.role) {
    case "value": return inventoryRecord(scan, 9) ?? inventoryValue(scan, value)
      ?? (value.application === null ? null : inventoryOutcome(scan, value.application, application => inventoryApplication(scan, application)));
    case "heritage": return inventoryRecord(scan, 4) ?? inventoryType(scan, value.type);
  }
}

export function inventoryBinding(scan: ProjectionInventory, value: TypedBinding): InstantiationStop | null {
  return inventoryRecord(scan, 3) ?? inventoryType(scan, value.storage);
}

export function inventoryBindingElement(scan: ProjectionInventory, value: TypedBindingElement): InstantiationStop | null {
  switch (value.role) {
    case "binding": return inventoryRecord(scan, 4) ?? inventoryBinding(scan, value);
    case "hole": return inventoryFields(scan, 1);
  }
}

export function inventoryVariableList(scan: ProjectionInventory, value: TypedVariableList): InstantiationStop | null {
  switch (value.role) {
    case "ordinary": return inventoryFields(scan, 1);
    case "using":
      inventoryEach(scan, value.protocols, protocol => inventoryOutcome(scan, protocol, decision => inventoryProtocol(scan, decision)));
      return inventoryRecord(scan, 3);
  }
}

export function inventoryCallable(scan: ProjectionInventory, value: TypedCallable): InstantiationStop | null {
  inventoryEach(scan, value.parameters, parameter => inventoryParameter(scan, parameter));
  inventoryEach(scan, value.signatures, signature => inventoryEndpoint(scan, signature));
  return inventoryRecord(scan, 5) ?? (value.template === null ? null
    : inventoryRecord(scan, 3) ?? inventoryBindings(scan, value.template.lexicalBindings));
}

export function inventoryClosure(scan: ProjectionInventory, value: TypedClosure): InstantiationStop | null {
  return inventoryRecord(scan, 8) ?? inventoryValue(scan, value) ?? inventoryCallable(scan, value.callable);
}

export function inventoryClass(scan: ProjectionInventory, value: TypedClass): InstantiationStop | null {
  inventoryEach(scan, value.parameters, parameter => inventoryParameter(scan, parameter));
  inventoryEach(scan, value.heritage, type => inventoryType(scan, type));
  return inventoryRecord(scan, 6) ?? inventoryType(scan, value.type);
}

export function inventoryInterface(scan: ProjectionInventory, value: TypedInterface): InstantiationStop | null {
  inventoryEach(scan, value.parameters, parameter => inventoryParameter(scan, parameter));
  return inventoryRecord(scan, 4) ?? inventoryType(scan, value.type);
}

export function inventoryAlias(scan: ProjectionInventory, value: TypedAlias): InstantiationStop | null {
  inventoryEach(scan, value.parameters, parameter => inventoryParameter(scan, parameter));
  return inventoryRecord(scan, 3) ?? inventoryType(scan, value.type);
}

export function inventorySourcePhase(scan: ProjectionInventory, value: TypedSourceFile): InstantiationStop | null {
  return inventoryRecord(scan, 2) ?? (value.template === null ? null
    : inventoryRecord(scan, 3) ?? inventoryBindings(scan, value.template.lexicalBindings));
}

export function inventoryPropertyKey(scan: ProjectionInventory, value: TypedPropertyKey): InstantiationStop | null {
  switch (value.kind) {
    case "constant": return inventoryFields(scan, 1);
    case "computed": return inventoryRecord(scan, 2) ?? inventoryType(scan, value.type);
  }
}

export function inventoryDecorator(scan: ProjectionInventory, value: TypedDecorator): InstantiationStop | null {
  return inventoryRecord(scan, 1) ?? inventoryOutcome(scan, value.application, application => inventoryTirApplication(scan, application));
}

export function inventoryConditional(scan: ProjectionInventory, value: TypedConditional): InstantiationStop | null {
  return inventoryRecord(scan, 7) ?? inventoryValue(scan, value);
}

export function inventoryObjectSpread(scan: ProjectionInventory, value: TypedObjectSpread): InstantiationStop | null {
  return inventoryRecord(scan, 1) ?? inventoryOutcome(scan, value.construction, operation => inventoryTypedOperation(scan, operation));
}

export function inventoryProperty(scan: ProjectionInventory, value: TypedProperty): InstantiationStop | null {
  return inventoryRecord(scan, 2) ?? inventoryOutcome(scan, value.member, member => inventorySelection(scan, member));
}

export function inventoryOmission(scan: ProjectionInventory, value: TypedOmission): InstantiationStop | null {
  return inventoryRecord(scan, 1) ?? inventoryType(scan, value.storage);
}

export function inventoryIteration(scan: ProjectionInventory, value: TypedIteration): InstantiationStop | null {
  return inventoryRecord(scan, 1) ?? inventoryOutcome(scan, value.protocol, protocol => inventoryProtocol(scan, protocol));
}

export function inventoryTypedParameter(scan: ProjectionInventory, value: TypedParameter): InstantiationStop | null {
  return inventoryRecord(scan, 5) ?? inventoryType(scan, value.storage);
}

export function inventoryClassValue(scan: ProjectionInventory, value: TypedClassValue): InstantiationStop | null {
  return inventoryRecord(scan, 7) ?? inventoryValue(scan, value) ?? inventoryClass(scan, value.declaration);
}

export function inventoryHeritage(scan: ProjectionInventory, value: TypedHeritage): InstantiationStop | null {
  inventoryEach(scan, value.types, type => inventoryType(scan, type));
  return inventoryRecord(scan, 1);
}

export function inventoryEnum(scan: ProjectionInventory, value: TypedEnum): InstantiationStop | null {
  return inventoryRecord(scan, 3) ?? inventoryType(scan, value.type);
}

export function inventoryStorage(scan: ProjectionInventory, value: TypedStorageDeclaration): InstantiationStop | null {
  return inventoryRecord(scan, 4) ?? inventoryType(scan, value.storage);
}

export function inventoryStaticBlock(scan: ProjectionInventory, value: TypedStaticBlock): InstantiationStop | null {
  return inventoryRecord(scan, 1) ?? inventoryRecord(scan, 3) ?? inventoryBindings(scan, value.template.lexicalBindings);
}

export function inventoryIndexDeclaration(scan: ProjectionInventory, value: TypedIndexDeclaration): InstantiationStop | null {
  return inventoryRecord(scan, 4) ?? inventoryType(scan, value.key) ?? inventoryType(scan, value.read) ?? inventoryType(scan, value.write);
}

export function inventoryTypedType(scan: ProjectionInventory, value: TypedType): InstantiationStop | null {
  return inventoryRecord(scan, 2) ?? inventoryType(scan, value.type);
}

export function inventoryPredicate(scan: ProjectionInventory, value: TypedPredicate): InstantiationStop | null {
  return inventoryRecord(scan, 3) ?? inventoryType(scan, value.narrowed);
}

export function inventoryTypeParameter(scan: ProjectionInventory, value: TypedTypeParameter): InstantiationStop | null {
  return inventoryRecord(scan, 1) ?? inventoryParameter(scan, value.parameter);
}

export function inventoryNamespace(scan: ProjectionInventory, value: TypedNamespace): InstantiationStop | null {
  return inventoryRecord(scan, 3) ?? inventoryType(scan, value.type) ?? (value.template === null ? null
    : inventoryRecord(scan, 3) ?? inventoryBindings(scan, value.template.lexicalBindings));
}

export function inventoryExportAssignment(scan: ProjectionInventory, value: TypedExportAssignment): InstantiationStop | null {
  return inventoryRecord(scan, 2) ?? inventoryType(scan, value.type);
}
