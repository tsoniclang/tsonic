import type { SyntaxPhaseCopy } from "../ir-hir/contract.js";
import type { TyId } from "../ids/contract.js";
import type { RuleOutcome, ClosureDecision, IndexDecision } from "../ir-infer/contract.js";
import type {
  DeclarationNameExpression, TargetAccess, TirEnumResolution, TirProtocol, TirResolution, TypedAlias, TypedApplication, TypedBigInt, TypedBinary, TypedBinding,
  TypedBindingElement, TypedBodyTemplate, TypedCallable, TypedClass, TypedClassValue, TypedClosure, TypedConditional,
  TypedConstruction, TypedDecorator, TypedElement, TypedEnum, TypedExportAssignment, TypedHeritage, TypedIndexDeclaration, TypedInstantiation,
  TypedInterface, TypedIteration, TypedKeyword, TypedLayoutApplication, TypedMember, TypedName, TypedNamespace, TypedNumber, TypedObjectSpread,
  TypedOmission, TypedParameter, TypedPhase, TypedPredicate, TypedPrefix, TypedProperty, TypedPropertyKey, TypedProtocolValue,
  TypedSourceFile, TypedStaticBlock, TypedStorageDeclaration, TypedString, TypedType, TypedTypeParameter, TypedUnary, TypedUpdate,
  TypedValue, TypedValueOccurrence, TypedVariableList, TypedOperation,
} from "../ir-tir/contract.js";
import type { TypeReferenceRewrite } from "./canonical-types.js";
import type { InstantiationStop } from "./work.js";
import type { ProjectionInventory } from "./program-values.js";
import type { CandidateReplayPlan, PreparedPhase } from "./instantiate-phase.js";
import {
  inventoryRecord, inventoryType, prepareArtifactBindings, prepareBindingsProjection, prepareEndpoint, prepareParameterProjection, prepareProjectionRows,
} from "./program-values.js";
import {
  borrowPhase, holdPhase, optionalTypePhase, paidPhase, prepareApplication, prepareConstructionPart, prepareOutcome, prepareProtocol,
  prepareRefinement, prepareReplayedApplication, prepareSelection, prepareTirApplication, prepareTypedOperation, prepareValue, typePhase, typesPhase, withOptionalPlan, withPlan,
} from "./instantiate-phase.js";

function prepareValueOccurrence(scan: ProjectionInventory, value: TypedValueOccurrence, at: string): PreparedPhase<TypedValueOccurrence> {
  return "role" in value ? holdPhase(value) : prepareValue(scan, value, at);
}

function prepareAccess(scan: ProjectionInventory, value: TargetAccess, at: string): PreparedPhase<TargetAccess> {
  switch (value.kind) {
    case "write": return paidPhase(scan, 2, () => withPlan(typePhase(scan, value.storage), storage =>
      ({ kind: "copied", value: image => ({ kind: "write", storage: storage(image) }) })));
    case "read-write": return paidPhase(scan, 5, () => withPlan(typePhase(scan, value.storage), storage =>
      withPlan(typePhase(scan, value.read), read =>
        withPlan(withOptionalPlan(value.narrowing, row => prepareRefinement(scan, row, at + ".narrowing")), narrowing => {
          const { evidenceIndex } = value;
          return { kind: "copied", value: image => ({ kind: "read-write", storage: storage(image), read: read(image),
            narrowing: narrowing(image), evidenceIndex }) };
        }))));
  }
}

function prepareNameResolution(scan: ProjectionInventory, resolution: TirResolution): PreparedPhase<TirResolution> {
  return resolution.kind === "enum-member" ? prepareEnumResolution(scan, resolution) : holdPhase(resolution);
}

function prepareEnumResolution(scan: ProjectionInventory, resolution: TirEnumResolution): PreparedPhase<TirEnumResolution> {
  return paidPhase(scan, 4, () => withPlan(prepareArtifactBindings(scan, resolution.bindings), bindings => {
    const declaration = resolution.declaration;
    const aliases = prepareProjectionRows(scan, resolution.aliases, read => paidPhase(scan, 2, () => holdPhase(read())));
    return { kind: "copied", value: image => ({ kind: "enum-member", declaration, bindings: bindings(image), aliases: aliases(image) }) };
  }));
}

function prepareName(scan: ProjectionInventory, value: TypedName, at: string): PreparedPhase<TypedName> {
  switch (value.role) {
    case "declaration-name-expression": return paidPhase(scan, 1, () => holdPhase(value));
    case "value": return paidPhase(scan, 8, () => withPlan(prepareValue(scan, value, at), common =>
      withPlan(prepareNameResolution(scan, value.resolution), resolution =>
        ({ kind: "copied", value: image => ({ ...common(image), role: "value", resolution: resolution(image) }) }))));
    case "shorthand-value": return paidPhase(scan, 9, () => withPlan(prepareValue(scan, value, at), common => {
      const { key, resolution } = value;
      return { kind: "copied", value: image => ({ ...common(image), role: "shorthand-value", key, resolution }) };
    }));
    case "assignment-target": return paidPhase(scan, 3, () => withPlan(prepareAccess(scan, value.access, at + ".access"), access => {
      const { resolution } = value;
      return { kind: "copied", value: image => ({ role: "assignment-target", resolution, access: access(image) }) };
    }));
    case "declaration-name": return paidPhase(scan, 3, () => withPlan(optionalTypePhase(scan, value.storage), storage => {
      const { declaration } = value;
      return { kind: "copied", value: image => ({ role: "declaration-name", declaration, storage: storage(image) }) };
    }));
    case "type-name": return paidPhase(scan, 3, () => withPlan(typePhase(scan, value.type), type => {
      const { declarations } = value;
      return { kind: "copied", value: image => ({ role: "type-name", type: type(image), declarations }) };
    }));
    case "property-name": case "label": case "binding-name": case "private-name": case "enum-qualifier": return borrowPhase(scan, 1, value);
  }
}

type ScalarLiteral<Literal> =
  | DeclarationNameExpression | (TypedValue & { readonly role: "value"; readonly value: Literal })
  | { readonly role: "type-literal"; readonly type: TyId };

function prepareLiteralValue<Literal>(scan: ProjectionInventory, value: TypedValue & { readonly value: Literal },
  at: string): PreparedPhase<TypedValue & { readonly role: "value"; readonly value: Literal }> {
  return paidPhase(scan, 8, () => withPlan(prepareValue(scan, value, at), common => {
    const literal = value.value;
    return { kind: "copied", value: image => ({ ...common(image), role: "value", value: literal }) };
  }));
}

function prepareLiteralType(scan: ProjectionInventory, value: { readonly type: TyId }):
  PreparedPhase<{ readonly role: "type-literal"; readonly type: TyId }> {
  return paidPhase(scan, 2, () => withPlan(typePhase(scan, value.type), type =>
    ({ kind: "copied", value: image => ({ role: "type-literal", type: type(image) }) })));
}

function prepareLiteral<Literal>(scan: ProjectionInventory, value: ScalarLiteral<Literal>, at: string): PreparedPhase<ScalarLiteral<Literal>> {
  switch (value.role) {
    case "declaration-name-expression": return paidPhase(scan, 1, () => holdPhase(value));
    case "value": return prepareLiteralValue(scan, value, at);
    case "type-literal": return prepareLiteralType(scan, value);
  }
}

function prepareString(scan: ProjectionInventory, value: TypedString, at: string): PreparedPhase<TypedString> {
  switch (value.role) {
    case "property-name": case "declaration-name": case "module-specifier": case "export-name": case "attribute-value":
      return borrowPhase(scan, 1, value);
    default: return prepareLiteral(scan, value, at);
  }
}

function prepareNumber(scan: ProjectionInventory, value: TypedNumber, at: string): PreparedPhase<TypedNumber> {
  switch (value.role) {
    case "property-name": case "declaration-name": return borrowPhase(scan, 1, value);
    default: return prepareLiteral(scan, value, at);
  }
}

function prepareBigInt(scan: ProjectionInventory, value: TypedBigInt, at: string): PreparedPhase<TypedBigInt> {
  switch (value.role) {
    case "property-name": case "declaration-name": return borrowPhase(scan, 1, value);
    case "value": return prepareLiteralValue(scan, value, at);
    case "type-literal": return prepareLiteralType(scan, value);
  }
}

function prepareKeyword(scan: ProjectionInventory, value: TypedKeyword, at: string): PreparedPhase<TypedKeyword> {
  switch (value.role) {
    case "value": return paidPhase(scan, 7, () => withPlan(prepareValue(scan, value, at), common =>
      ({ kind: "copied", value: image => ({ ...common(image), role: "value" }) })));
    case "receiver": return paidPhase(scan, 8, () => withPlan(prepareValue(scan, value, at), common => {
      const { owner } = value;
      return { kind: "copied", value: image => ({ ...common(image), role: "receiver", owner }) };
    }));
    case "super": return paidPhase(scan, 9, () => withPlan(prepareValue(scan, value, at), common =>
      withPlan(typePhase(scan, value.base), base => {
        const { owner } = value;
        return { kind: "copied", value: image => ({ ...common(image), role: "super", owner, base: base(image) }) };
      })));
    case "type-literal": return prepareLiteralType(scan, value);
  }
}

function operationOutcome(scan: ProjectionInventory, value: RuleOutcome<TypedOperation>, at: string):
  PreparedPhase<RuleOutcome<TypedOperation>> {
  return prepareOutcome(scan, () => value, operation => prepareTypedOperation(scan, operation, at + ".decision"), at);
}

function protocolOutcome(scan: ProjectionInventory, value: RuleOutcome<TirProtocol>, at: string):
  PreparedPhase<RuleOutcome<TirProtocol>> {
  return prepareOutcome(scan, () => value, protocol => prepareProtocol(scan, protocol, at + ".decision"), at);
}

function prepareBinary(scan: ProjectionInventory, value: TypedBinary, at: string): PreparedPhase<TypedBinary> {
  return withPlan(prepareValue(scan, value, at), (common): PreparedPhase<TypedBinary> => {
    switch (value.role) {
      case "arithmetic": case "comparison": return paidPhase(scan, 8, () =>
        withPlan(operationOutcome(scan, value.operation, at + ".operation"), operation => {
          const { role } = value;
          return { kind: "copied", value: image => ({ ...common(image), role, operation: operation(image) }) };
        }));
      case "short-circuit": return paidPhase(scan, 8, () => {
        const { selection } = value;
        return { kind: "copied", value: image => ({ ...common(image), role: "short-circuit", selection }) };
      });
      case "assignment": return paidPhase(scan, 10, () => withPlan(typePhase(scan, value.storage), storage =>
        withPlan(withOptionalPlan(value.calculation, calculation => operationOutcome(scan, calculation, at + ".calculation")), calculation => {
          const { selection } = value;
          return { kind: "copied", value: image => ({ ...common(image), role: "assignment", storage: storage(image),
            calculation: calculation(image), selection }) };
        })));
      case "sequence": return paidPhase(scan, 7, () => ({ kind: "copied", value: image => ({ ...common(image), role: "sequence" }) }));
    }
  });
}

function prepareUnary(scan: ProjectionInventory, value: TypedUnary, at: string): PreparedPhase<TypedUnary> {
  return paidPhase(scan, 7, () => withPlan(prepareValue(scan, value, at), common =>
    withPlan(operationOutcome(scan, value.operation, at + ".operation"), operation =>
      ({ kind: "copied", value: image => ({ ...common(image), operation: operation(image) }) }))));
}

function preparePrefix(scan: ProjectionInventory, value: TypedPrefix, at: string): PreparedPhase<TypedPrefix> {
  switch (value.role) {
    case "type-literal": return prepareLiteralType(scan, value);
    case "value": return paidPhase(scan, 8, () => withPlan(prepareUnary(scan, value, at), unary =>
      ({ kind: "copied", value: image => ({ ...unary(image), role: "value" }) })));
    case "update": return paidPhase(scan, 9, () => withPlan(prepareUnary(scan, value, at), unary =>
      withPlan(typePhase(scan, value.storage), storage =>
        ({ kind: "copied", value: image => ({ ...unary(image), role: "update", storage: storage(image) }) }))));
  }
}

function prepareUpdate(scan: ProjectionInventory, value: TypedUpdate, at: string): PreparedPhase<TypedUpdate> {
  return paidPhase(scan, 8, () => withPlan(prepareUnary(scan, value, at), unary =>
    withPlan(typePhase(scan, value.storage), storage =>
      ({ kind: "copied", value: image => ({ ...unary(image), storage: storage(image) }) }))));
}

function prepareTypedMember(scan: ProjectionInventory, value: TypedMember, at: string): PreparedPhase<TypedMember> {
  if (value.role === "declaration-name-expression") return paidPhase(scan, 1, () => holdPhase(value));
  if (value.role === "array-extent") return paidPhase(scan, 8, () => withPlan(prepareValue(scan, value, at), common =>
    withPlan(prepareOutcome(scan, () => value.operation, operation => prepareTypedOperation(scan, operation, at + ".operation"), at + ".operation"),
      operation => ({ kind: "copied", value: image => ({ ...common(image), role: "array-extent", operation: operation(image) }) }))));
  if (value.role === "enum-member") return paidPhase(scan, 8, () => withPlan(prepareValue(scan, value, at), common =>
    withPlan(prepareEnumResolution(scan, value.resolution), resolution =>
      ({ kind: "copied", value: image => ({ ...common(image), role: "enum-member", resolution: resolution(image) }) }))));
  return withPlan(prepareOutcome(scan, () => value.selection, member => prepareSelection(scan, member), at + ".selection"),
    (selection): PreparedPhase<TypedMember> => {
      switch (value.role) {
        case "value": return paidPhase(scan, 8, () => withPlan(prepareValue(scan, value, at), common =>
          ({ kind: "copied", value: image => ({ ...common(image), role: "value", selection: selection(image) }) })));
        case "assignment-target": return paidPhase(scan, 3, () =>
          withPlan(prepareAccess(scan, value.access, at + ".access"), access =>
            ({ kind: "copied", value: image => ({ role: "assignment-target", selection: selection(image), access: access(image) }) })));
      }
    });
}

function prepareIndexDecision(scan: ProjectionInventory, value: IndexDecision): PreparedPhase<IndexDecision> {
  return paidPhase(scan, 8, () => {
    const { carrier, holding, failure, writeCheck } = value;
    return withPlan(typePhase(scan, value.receiver), receiver =>
      withPlan(typePhase(scan, value.key), key =>
        withPlan(optionalTypePhase(scan, value.read), read =>
          withPlan(optionalTypePhase(scan, value.write), write => ({ kind: "copied", value: image =>
            ({ carrier, holding, receiver: receiver(image), key: key(image), read: read(image), write: write(image), failure, writeCheck }) })))));
  });
}

function prepareTypedElement(scan: ProjectionInventory, value: TypedElement, at: string): PreparedPhase<TypedElement> {
  if (!("index" in value)) return prepareTypedMember(scan, value, at);
  return paidPhase(scan, 3, () => withPlan(prepareIndexDecision(scan, value.index), (index): PreparedPhase<TypedElement> =>
    value.role === "value" ? withPlan(prepareValue(scan, value, at), common =>
      ({ kind: "copied", value: image => ({ ...common(image), role: "value", index: index(image) }) }))
      : withPlan(prepareAccess(scan, value.access, at + ".access"), access =>
        ({ kind: "copied", value: image => ({ role: "assignment-target", index: index(image), access: access(image) }) }))));
}

function prepareTypedApplication(scan: ProjectionInventory, value: TypedApplication, at: string,
  replay: CandidateReplayPlan | null): PreparedPhase<TypedApplication>;
function prepareTypedApplication(scan: ProjectionInventory, value: TypedApplication | TypedLayoutApplication, at: string,
  replay: CandidateReplayPlan | null): PreparedPhase<TypedApplication | TypedLayoutApplication>;
function prepareTypedApplication(scan: ProjectionInventory, value: TypedApplication | TypedLayoutApplication, at: string,
  replay: CandidateReplayPlan | null): PreparedPhase<TypedApplication | TypedLayoutApplication> {
  return paidPhase(scan, 8, () => withPlan(prepareValue(scan, value, at), common =>
    withPlan(replay === null ? prepareOutcome(scan, () => value.application, application => prepareTirApplication(scan, application, "transport"), at + ".application")
      : prepareReplayedApplication(scan, () => value.application, at + ".application", replay), (application): PreparedPhase<TypedApplication | TypedLayoutApplication> =>
      {
        if ("layout" in value) {
          const { layout } = value;
          return { kind: "copied", value: image => ({ ...common(image), application: application(image), layout }) };
        }
        return withPlan(withOptionalPlan(value.operation, operation => operationOutcome(scan, operation, at + ".operation")), operation =>
          ({ kind: "copied", value: image => ({ ...common(image), application: application(image), operation: operation(image) }) }));
      })));
}

function prepareProtocolValue(scan: ProjectionInventory, value: TypedProtocolValue, at: string): PreparedPhase<TypedProtocolValue> {
  return paidPhase(scan, 7, () => withPlan(prepareValue(scan, value, at), common =>
    withPlan(protocolOutcome(scan, value.protocol, at + ".protocol"), protocol =>
      ({ kind: "copied", value: image => ({ ...common(image), protocol: protocol(image) }) }))));
}

function prepareConstruction(scan: ProjectionInventory, value: TypedConstruction, at: string): PreparedPhase<TypedConstruction> {
  switch (value.role) {
    case "value": return paidPhase(scan, 8, () => withPlan(prepareValue(scan, value, at), common =>
      withPlan(operationOutcome(scan, value.construction, at + ".construction"), construction =>
        ({ kind: "copied", value: image => ({ ...common(image), role: "value", construction: construction(image) }) }))));
    case "assignment-pattern": return paidPhase(scan, 3, () => {
      const parts = prepareProjectionRows(scan, value.parts, (read, index) => prepareConstructionPart(scan, read, at + ".parts[" + index + "]"));
      return withPlan(typePhase(scan, value.storage), storage =>
        ({ kind: "copied", value: image => ({ role: "assignment-pattern", storage: storage(image), parts: parts(image) }) }));
    });
  }
}

function prepareInstantiation(scan: ProjectionInventory, value: TypedInstantiation, at: string): PreparedPhase<TypedInstantiation> {
  return withPlan(prepareBindingsProjection(scan, value.bindings), (bindings): PreparedPhase<TypedInstantiation> => {
    switch (value.role) {
      case "value": return paidPhase(scan, 9, () => withPlan(prepareValue(scan, value, at), common =>
        withPlan(withOptionalPlan(value.application, application =>
          prepareOutcome(scan, () => application, resolved => prepareApplication(scan, resolved), at + ".application")), application =>
          ({ kind: "copied", value: image => ({ ...common(image), role: "value", bindings: bindings(image), application: application(image) }) }))));
      case "heritage": return paidPhase(scan, 4, () => withPlan(typePhase(scan, value.type), type => {
        const { declarations } = value;
        return { kind: "copied", value: image => ({ role: "heritage", type: type(image), bindings: bindings(image), declarations }) };
      }));
    }
  });
}

function prepareBindingElement(scan: ProjectionInventory, value: TypedBindingElement): PreparedPhase<TypedBindingElement> {
  switch (value.role) {
    case "binding": return paidPhase(scan, 4, () => withPlan(prepareBindingPhase(scan, value), binding =>
      ({ kind: "copied", value: image => ({ ...binding(image), role: "binding" }) })));
    case "hole": return borrowPhase(scan, 1, value);
  }
}

function prepareVariableList(scan: ProjectionInventory, value: TypedVariableList, at: string): PreparedPhase<TypedVariableList> {
  switch (value.role) {
    case "ordinary": return borrowPhase(scan, 1, value);
    case "using": return paidPhase(scan, 3, () => {
      const protocols = prepareProjectionRows(scan, value.protocols, (read, index) =>
        prepareOutcome(scan, read, protocol => prepareProtocol(scan, protocol, at + ".protocols[" + index + "].decision"),
          at + ".protocols[" + index + "]"));
      const { asynchronous } = value;
      return { kind: "copied", value: image => ({ role: "using", asynchronous, protocols: protocols(image) }) };
    });
  }
}

function prepareClosureDecision(scan: ProjectionInventory, value: ClosureDecision): PreparedPhase<ClosureDecision> {
  return paidPhase(scan, 3, () => {
    const captures = prepareProjectionRows(scan, value.captures, read => paidPhase(scan, 2, () => holdPhase(read())));
    return withPlan(typePhase(scan, value.carrier), carrier => {
      const { execution } = value;
      return { kind: "copied", value: image => ({ carrier: carrier(image), captures: captures(image), execution }) };
    });
  });
}

function prepareClosure(scan: ProjectionInventory, value: TypedClosure, at: string): PreparedPhase<TypedClosure> {
  return paidPhase(scan, 8, () => withPlan(prepareValue(scan, value, at), common =>
    withPlan(prepareCallablePhase(scan, value.callable), callable =>
      withPlan(prepareOutcome(scan, () => value.closure, decision => prepareClosureDecision(scan, decision), at + ".closure"), closure =>
        ({ kind: "copied", value: image => ({ ...common(image), callable: callable(image), closure: closure(image) }) })))));
}

function preparePropertyKey(scan: ProjectionInventory, value: TypedPropertyKey): PreparedPhase<TypedPropertyKey> {
  switch (value.kind) {
    case "declaration": return paidPhase(scan, 2, () => value.key.kind === "available"
      ? paidPhase(scan, 2, () => holdPhase(value)) : borrowPhase(scan, 2, value));
    case "constant": return borrowPhase(scan, 1, value);
    case "computed": return paidPhase(scan, 2, () => withPlan(typePhase(scan, value.type), type =>
      ({ kind: "copied", value: image => ({ kind: "computed", type: type(image) }) })));
  }
}

function prepareDecorator(scan: ProjectionInventory, value: TypedDecorator, at: string): PreparedPhase<TypedDecorator> {
  return paidPhase(scan, 1, () => withPlan(prepareOutcome(scan, () => value.application,
    application => prepareTirApplication(scan, application, "transport"), at + ".application"), application =>
    ({ kind: "copied", value: image => ({ application: application(image) }) })));
}

function prepareConditional(scan: ProjectionInventory, value: TypedConditional, at: string): PreparedPhase<TypedConditional> {
  return paidPhase(scan, 7, () => withPlan(prepareValue(scan, value, at), common => {
    const { selection } = value;
    return { kind: "copied", value: image => ({ ...common(image), selection }) };
  }));
}

function prepareObjectSpread(scan: ProjectionInventory, value: TypedObjectSpread, at: string): PreparedPhase<TypedObjectSpread> {
  return paidPhase(scan, 1, () => withPlan(operationOutcome(scan, value.construction, at + ".construction"), construction =>
    ({ kind: "copied", value: image => ({ construction: construction(image) }) })));
}

function prepareProperty(scan: ProjectionInventory, value: TypedProperty, at: string): PreparedPhase<TypedProperty> {
  return paidPhase(scan, 2, () => withPlan(prepareOutcome(scan, () => value.member, member => prepareSelection(scan, member), at + ".member"), member => {
    const { key } = value;
    return { kind: "copied", value: image => ({ key, member: member(image) }) };
  }));
}

function prepareIteration(scan: ProjectionInventory, value: TypedIteration, at: string): PreparedPhase<TypedIteration> {
  return paidPhase(scan, 1, () => withPlan(protocolOutcome(scan, value.protocol, at + ".protocol"), protocol =>
    ({ kind: "copied", value: image => ({ protocol: protocol(image) }) })));
}

function prepareClassValue(scan: ProjectionInventory, value: TypedClassValue, at: string): PreparedPhase<TypedClassValue> {
  return paidPhase(scan, 7, () => withPlan(prepareValue(scan, value, at), common =>
    withPlan(prepareClassPhase(scan, value.declaration), declaration =>
      ({ kind: "copied", value: image => ({ ...common(image), declaration: declaration(image) }) }))));
}

function prepareTemplate(scan: ProjectionInventory, source: TypedBodyTemplate | null): PreparedPhase<TypedBodyTemplate | null> {
  if (source === null) return { kind: "copied", value: () => null };
  const header = inventoryRecord(scan, 3);
  if (header !== null) return { kind: "refused", stop: header };
  const bindings = prepareBindingsProjection(scan, source.lexicalBindings);
  if (bindings.kind === "refused") return bindings;
  const { body, dependence } = source;
  return { kind: "copied", value: rewrite => ({ body, dependence, lexicalBindings: bindings.value(rewrite) }) };
}

function prepareCallablePhase(scan: ProjectionInventory, source: TypedCallable): PreparedPhase<TypedCallable> {
  const header = inventoryRecord(scan, 5);
  if (header !== null) return { kind: "refused", stop: header };
  const preparedParameters = prepareProjectionRows(scan, source.parameters, read => prepareParameterProjection(scan, read));
  const preparedEndpoints = prepareProjectionRows(scan, source.signatures, read => prepareEndpoint(scan, read, "image"));
  const template = prepareTemplate(scan, source.template);
  if (template.kind === "refused") return template;
  const { definition, attributes } = source;
  return { kind: "copied", value: rewrite => ({
    definition, attributes, parameters: preparedParameters(rewrite), signatures: preparedEndpoints(rewrite), template: template.value(rewrite),
  }) };
}

function prepareClassPhase(scan: ProjectionInventory, source: TypedClass): PreparedPhase<TypedClass> {
  const header = inventoryRecord(scan, 6);
  if (header !== null) return { kind: "refused", stop: header };
  const preparedParameters = prepareProjectionRows(scan, source.parameters, read => prepareParameterProjection(scan, read));
  const heritage = typesPhase(scan, source.heritage);
  const type = source.type;
  const typeStop = inventoryType(scan, type);
  if (typeStop !== null) return { kind: "refused", stop: typeStop };
  const { definition, members, attributes } = source;
  return { kind: "copied", value: rewrite => ({
    definition, members, attributes, parameters: preparedParameters(rewrite), heritage: heritage(rewrite), type: rewrite.type(type),
  }) };
}

function prepareInterfacePhase(scan: ProjectionInventory, source: TypedInterface): PreparedPhase<TypedInterface> {
  const header = inventoryRecord(scan, 4);
  if (header !== null) return { kind: "refused", stop: header };
  const preparedParameters = prepareProjectionRows(scan, source.parameters, read => prepareParameterProjection(scan, read));
  const type = source.type;
  const typeStop = inventoryType(scan, type);
  if (typeStop !== null) return { kind: "refused", stop: typeStop };
  const { definition, members } = source;
  return { kind: "copied", value: rewrite => ({
    definition, members, parameters: preparedParameters(rewrite), type: rewrite.type(type),
  }) };
}

function prepareAliasPhase(scan: ProjectionInventory, source: TypedAlias): PreparedPhase<TypedAlias> {
  const header = inventoryRecord(scan, 3);
  if (header !== null) return { kind: "refused", stop: header };
  const preparedParameters = prepareProjectionRows(scan, source.parameters, read => prepareParameterProjection(scan, read));
  const type = source.type;
  const typeStop = inventoryType(scan, type);
  if (typeStop !== null) return { kind: "refused", stop: typeStop };
  const definition = source.definition;
  return { kind: "copied", value: rewrite => ({
    definition, parameters: preparedParameters(rewrite), type: rewrite.type(type),
  }) };
}

function prepareSourcePhase(scan: ProjectionInventory, source: TypedSourceFile): PreparedPhase<TypedSourceFile> {
  const header = inventoryRecord(scan, 2);
  if (header !== null) return { kind: "refused", stop: header };
  const template = prepareTemplate(scan, source.template);
  if (template.kind === "refused") return template;
  const module = source.module;
  return { kind: "copied", value: rewrite => ({ module, template: template.value(rewrite) }) };
}

function prepareTypeParameterPhase(scan: ProjectionInventory, source: TypedTypeParameter): PreparedPhase<TypedTypeParameter> {
  const header = inventoryRecord(scan, 1);
  if (header !== null) return { kind: "refused", stop: header };
  const parameter = prepareParameterProjection(scan, () => source.parameter);
  return parameter.kind === "refused" ? parameter : { kind: "copied", value: rewrite => ({ parameter: parameter.value(rewrite) }) };
}

function prepareTypePhase(scan: ProjectionInventory, source: TypedType): PreparedPhase<TypedType> {
  const header = inventoryRecord(scan, 2);
  if (header !== null) return { kind: "refused", stop: header };
  const type = source.type;
  const stop = inventoryType(scan, type);
  if (stop !== null) return { kind: "refused", stop };
  const declarations = source.declarations;
  return { kind: "copied", value: rewrite => ({ type: rewrite.type(type), declarations }) };
}

function preparePredicatePhase(scan: ProjectionInventory, source: TypedPredicate): PreparedPhase<TypedPredicate> {
  const header = inventoryRecord(scan, 3);
  if (header !== null) return { kind: "refused", stop: header };
  const narrowed = source.narrowed;
  const stop = inventoryType(scan, narrowed);
  if (stop !== null) return { kind: "refused", stop };
  const { parameter, asserts } = source;
  return { kind: "copied", value: rewrite => ({ parameter, asserts, narrowed: narrowed === null ? null : rewrite.type(narrowed) }) };
}

function prepareBindingPhase(scan: ProjectionInventory, source: TypedBinding): PreparedPhase<TypedBinding> {
  const header = inventoryRecord(scan, 3);
  if (header !== null) return { kind: "refused", stop: header };
  const storage = source.storage;
  const stop = inventoryType(scan, storage);
  if (stop !== null) return { kind: "refused", stop };
  const { declaration, initializer } = source;
  return { kind: "copied", value: rewrite => ({ declaration, initializer, storage: rewrite.type(storage) }) };
}

function prepareStoragePhase(scan: ProjectionInventory, source: TypedStorageDeclaration): PreparedPhase<TypedStorageDeclaration> {
  const header = inventoryRecord(scan, 4);
  if (header !== null) return { kind: "refused", stop: header };
  const storage = source.storage;
  const stop = inventoryType(scan, storage);
  if (stop !== null) return { kind: "refused", stop };
  const { definition, initializer, attributes } = source;
  return { kind: "copied", value: rewrite => ({ definition, initializer, attributes, storage: rewrite.type(storage) }) };
}

function prepareOmissionPhase(scan: ProjectionInventory, source: TypedOmission): PreparedPhase<TypedOmission> {
  const header = inventoryRecord(scan, 1);
  if (header !== null) return { kind: "refused", stop: header };
  const storage = source.storage;
  const stop = inventoryType(scan, storage);
  return stop === null ? { kind: "copied", value: rewrite => ({ storage: rewrite.type(storage) }) } : { kind: "refused", stop };
}

function prepareTypedParameterPhase(scan: ProjectionInventory, source: TypedParameter): PreparedPhase<TypedParameter> {
  const header = inventoryRecord(scan, 6);
  if (header !== null) return { kind: "refused", stop: header };
  const storage = source.storage;
  const stop = inventoryType(scan, storage);
  if (stop !== null) return { kind: "refused", stop };
  const { declaration, local, passing, initializer, role } = source;
  return { kind: "copied", value: rewrite => ({ declaration, local, passing, initializer, role, storage: rewrite.type(storage) }) };
}

function prepareHeritagePhase(scan: ProjectionInventory, source: TypedHeritage): PreparedPhase<TypedHeritage> {
  const header = inventoryRecord(scan, 1);
  if (header !== null) return { kind: "refused", stop: header };
  const prepared = typesPhase(scan, source.types);
  return { kind: "copied", value: rewrite => ({ types: prepared(rewrite) }) };
}

function prepareEnumPhase(scan: ProjectionInventory, source: TypedEnum): PreparedPhase<TypedEnum> {
  const header = inventoryRecord(scan, 3);
  if (header !== null) return { kind: "refused", stop: header };
  const type = source.type;
  const stop = inventoryType(scan, type);
  if (stop !== null) return { kind: "refused", stop };
  const { definition, members } = source;
  return { kind: "copied", value: rewrite => ({ definition, members, type: rewrite.type(type) }) };
}

function prepareNamespacePhase(scan: ProjectionInventory, source: TypedNamespace): PreparedPhase<TypedNamespace> {
  const header = inventoryRecord(scan, 3);
  if (header !== null) return { kind: "refused", stop: header };
  const type = source.type;
  const stop = inventoryType(scan, type);
  if (stop !== null) return { kind: "refused", stop };
  const template = prepareTemplate(scan, source.template);
  if (template.kind === "refused") return template;
  const definition = source.definition;
  return { kind: "copied", value: rewrite => ({ definition, type: rewrite.type(type), template: template.value(rewrite) }) };
}

function prepareStaticBlockPhase(scan: ProjectionInventory, source: TypedStaticBlock): PreparedPhase<TypedStaticBlock> {
  const header = inventoryRecord(scan, 1) ?? inventoryRecord(scan, 3);
  if (header !== null) return { kind: "refused", stop: header };
  const template = source.template;
  const bindings = prepareBindingsProjection(scan, template.lexicalBindings);
  if (bindings.kind === "refused") return bindings;
  const { body, dependence } = template;
  return { kind: "copied", value: rewrite => ({ template: { body, dependence, lexicalBindings: bindings.value(rewrite) } }) };
}

function prepareIndexPhase(scan: ProjectionInventory, source: TypedIndexDeclaration): PreparedPhase<TypedIndexDeclaration> {
  const header = inventoryRecord(scan, 4);
  if (header !== null) return { kind: "refused", stop: header };
  const key = source.key;
  const keyStop = inventoryType(scan, key);
  if (keyStop !== null) return { kind: "refused", stop: keyStop };
  const read = source.read;
  const readStop = inventoryType(scan, read);
  if (readStop !== null) return { kind: "refused", stop: readStop };
  const write = source.write;
  const writeStop = inventoryType(scan, write);
  if (writeStop !== null) return { kind: "refused", stop: writeStop };
  const definition = source.definition;
  return { kind: "copied", value: rewrite => ({
    definition, key: rewrite.type(key), read: rewrite.type(read), write: write === null ? null : rewrite.type(write),
  }) };
}

function prepareExportAssignmentPhase(scan: ProjectionInventory, source: TypedExportAssignment): PreparedPhase<TypedExportAssignment> {
  const header = inventoryRecord(scan, 2);
  if (header !== null) return { kind: "refused", stop: header };
  const type = source.type;
  const stop = inventoryType(scan, type);
  if (stop !== null) return { kind: "refused", stop };
  const definition = source.definition;
  return { kind: "copied", value: rewrite => ({ definition, type: rewrite.type(type) }) };
}

export function typedSyntaxPhaseCopy(scan: ProjectionInventory, at: string,
  replay: CandidateReplayPlan | null): SyntaxPhaseCopy<TypedPhase, InstantiationStop, TypeReferenceRewrite> {
  return {
    ArrayLiteralExpression: value => prepareConstruction(scan, value, at + ".ArrayLiteralExpression.tsonic"),
    ArrayTypeNode: value => prepareTypePhase(scan, value),
    ArrowFunction: value => prepareClosure(scan, value, at + ".ArrowFunction.tsonic"),
    AsExpression: value => prepareValue(scan, value, at + ".AsExpression.tsonic"),
    AwaitExpression: value => prepareProtocolValue(scan, value, at + ".AwaitExpression.tsonic"),
    BigIntLiteral: value => prepareBigInt(scan, value, at + ".BigIntLiteral.tsonic"),
    BinaryExpression: value => prepareBinary(scan, value, at + ".BinaryExpression.tsonic"),
    BindingElement: value => prepareBindingElement(scan, value),
    BindingPattern: value => prepareOmissionPhase(scan, value),
    CallExpression: value => "role" in value ? holdPhase(value) : prepareTypedApplication(scan, value, at + ".CallExpression.tsonic", replay),
    CallSignatureDeclaration: value => prepareCallablePhase(scan, value),
    CaseClause: value => paidPhase(scan, 1, () => withPlan(operationOutcome(scan, value.operation, at + ".CaseClause.tsonic.operation"),
      operation => ({ kind: "copied", value: image => ({ operation: operation(image) }) }))),
    ClassDeclaration: value => prepareClassPhase(scan, value),
    ClassExpression: value => prepareClassValue(scan, value, at + ".ClassExpression.tsonic"),
    ClassStaticBlockDeclaration: value => prepareStaticBlockPhase(scan, value),
    ComputedPropertyName: value => preparePropertyKey(scan, value),
    ConditionalExpression: value => prepareConditional(scan, value, at + ".ConditionalExpression.tsonic"),
    ConditionalTypeNode: value => prepareTypePhase(scan, value),
    ConstructSignatureDeclaration: value => prepareCallablePhase(scan, value),
    ConstructorDeclaration: value => prepareCallablePhase(scan, value),
    ConstructorTypeNode: value => prepareTypePhase(scan, value),
    Decorator: value => prepareDecorator(scan, value, at + ".Decorator.tsonic"),
    DeleteExpression: value => prepareUnary(scan, value, at + ".DeleteExpression.tsonic"),
    ElementAccessExpression: value => prepareTypedElement(scan, value, at + ".ElementAccessExpression.tsonic"),
    EnumDeclaration: value => prepareEnumPhase(scan, value),
    EnumMember: value => prepareStoragePhase(scan, value),
    ExportAssignment: value => prepareExportAssignmentPhase(scan, value),
    ExportDeclaration: holdPhase,
    ExportSpecifier: holdPhase,
    ExpressionWithTypeArguments: value => prepareInstantiation(scan, value, at + ".ExpressionWithTypeArguments.tsonic"),
    ForInOrOfStatement: value => prepareIteration(scan, value, at + ".ForInOrOfStatement.tsonic"),
    FunctionDeclaration: value => prepareCallablePhase(scan, value),
    FunctionExpression: value => prepareClosure(scan, value, at + ".FunctionExpression.tsonic"),
    FunctionTypeNode: value => prepareTypePhase(scan, value),
    GetAccessorDeclaration: value => prepareCallablePhase(scan, value),
    HeritageClause: value => prepareHeritagePhase(scan, value),
    Identifier: value => prepareName(scan, value, at + ".Identifier.tsonic"),
    ImportAttribute: holdPhase,
    ImportClause: holdPhase,
    ImportDeclaration: holdPhase,
    ImportEqualsDeclaration: holdPhase,
    ImportSpecifier: holdPhase,
    ImportTypeNode: value => prepareTypePhase(scan, value),
    IndexSignatureDeclaration: value => prepareIndexPhase(scan, value),
    IndexedAccessTypeNode: value => prepareTypePhase(scan, value),
    InferTypeNode: value => prepareTypePhase(scan, value),
    InterfaceDeclaration: value => prepareInterfacePhase(scan, value),
    IntersectionTypeNode: value => prepareTypePhase(scan, value),
    JSDocAllType: holdPhase,
    JSDocNameReference: holdPhase,
    JSDocNonNullableType: holdPhase,
    JSDocNullableType: holdPhase,
    JSDocOptionalType: holdPhase,
    JSDocSignature: holdPhase,
    JSDocTypeExpression: holdPhase,
    JSDocTypeLiteral: holdPhase,
    JSDocVariadicType: holdPhase,
    JsxAttributes: holdPhase,
    JsxClosingFragment: holdPhase,
    JsxElement: holdPhase,
    JsxExpression: holdPhase,
    JsxFragment: holdPhase,
    JsxNamespacedName: holdPhase,
    JsxOpeningElement: holdPhase,
    JsxOpeningFragment: holdPhase,
    JsxSelfClosingElement: holdPhase,
    JsxText: holdPhase,
    KeywordExpression: value => prepareKeyword(scan, value, at + ".KeywordExpression.tsonic"),
    KeywordTypeNode: value => prepareTypePhase(scan, value),
    LiteralTypeNode: value => prepareTypePhase(scan, value),
    MappedTypeNode: value => prepareTypePhase(scan, value),
    MetaProperty: value => prepareValue(scan, value, at + ".MetaProperty.tsonic"),
    MethodDeclaration: value => prepareCallablePhase(scan, value),
    MethodSignatureDeclaration: value => prepareCallablePhase(scan, value),
    ModuleDeclaration: value => prepareNamespacePhase(scan, value),
    NamedTupleMember: value => prepareTypePhase(scan, value),
    NamespaceExport: holdPhase,
    NamespaceExportDeclaration: holdPhase,
    NamespaceImport: holdPhase,
    NewExpression: value => prepareTypedApplication(scan, value, at + ".NewExpression.tsonic", null),
    NoSubstitutionTemplateLiteral: value => prepareString(scan, value, at + ".NoSubstitutionTemplateLiteral.tsonic"),
    NonNullExpression: value => prepareValueOccurrence(scan, value, at + ".NonNullExpression.tsonic"),
    NumericLiteral: value => prepareNumber(scan, value, at + ".NumericLiteral.tsonic"),
    ObjectLiteralExpression: value => prepareConstruction(scan, value, at + ".ObjectLiteralExpression.tsonic"),
    OmittedExpression: value => prepareOmissionPhase(scan, value),
    OptionalTypeNode: value => prepareTypePhase(scan, value),
    ParameterDeclaration: value => prepareTypedParameterPhase(scan, value),
    ParenthesizedExpression: value => prepareValueOccurrence(scan, value, at + ".ParenthesizedExpression.tsonic"),
    ParenthesizedTypeNode: value => prepareTypePhase(scan, value),
    PartiallyEmittedExpression: holdPhase,
    PostfixUnaryExpression: value => prepareUpdate(scan, value, at + ".PostfixUnaryExpression.tsonic"),
    PrefixUnaryExpression: value => preparePrefix(scan, value, at + ".PrefixUnaryExpression.tsonic"),
    PrivateIdentifier: value => prepareName(scan, value, at + ".PrivateIdentifier.tsonic"),
    PropertyAccessExpression: value => prepareTypedMember(scan, value, at + ".PropertyAccessExpression.tsonic"),
    PropertyAssignment: value => prepareProperty(scan, value, at + ".PropertyAssignment.tsonic"),
    PropertyDeclaration: value => prepareStoragePhase(scan, value),
    PropertySignatureDeclaration: value => prepareStoragePhase(scan, value),
    QualifiedName: value => prepareName(scan, value, at + ".QualifiedName.tsonic"),
    RegularExpressionLiteral: value => prepareValue(scan, value, at + ".RegularExpressionLiteral.tsonic"),
    RestTypeNode: value => prepareTypePhase(scan, value),
    SatisfiesExpression: value => prepareValue(scan, value, at + ".SatisfiesExpression.tsonic"),
    SetAccessorDeclaration: value => prepareCallablePhase(scan, value),
    ShorthandPropertyAssignment: value => prepareProperty(scan, value, at + ".ShorthandPropertyAssignment.tsonic"),
    SourceFile: value => prepareSourcePhase(scan, value),
    SpreadAssignment: value => prepareObjectSpread(scan, value, at + ".SpreadAssignment.tsonic"),
    SpreadElement: value => "role" in value ? paidPhase(scan, 1, () => holdPhase({ role: value.role }))
      : paidPhase(scan, 8, () => prepareProtocolValue(scan, value, at + ".SpreadElement.tsonic")),
    StringLiteral: value => prepareString(scan, value, at + ".StringLiteral.tsonic"),
    SyntheticReferenceExpression: holdPhase,
    TaggedTemplateExpression: value => prepareTypedApplication(scan, value, at + ".TaggedTemplateExpression.tsonic", null),
    TemplateExpression: value => prepareUnary(scan, value, at + ".TemplateExpression.tsonic"),
    TemplateLiteralTypeNode: value => prepareTypePhase(scan, value),
    TemplateLiteralTypeSpan: value => prepareTypePhase(scan, value),
    ThisTypeNode: value => prepareTypePhase(scan, value),
    TupleTypeNode: value => prepareTypePhase(scan, value),
    TypeAliasDeclaration: value => prepareAliasPhase(scan, value),
    TypeAssertion: value => prepareValue(scan, value, at + ".TypeAssertion.tsonic"),
    TypeLiteralNode: value => prepareTypePhase(scan, value),
    TypeOfExpression: value => prepareUnary(scan, value, at + ".TypeOfExpression.tsonic"),
    TypeOperatorNode: value => prepareTypePhase(scan, value),
    TypeParameterDeclaration: value => prepareTypeParameterPhase(scan, value),
    TypePredicateNode: value => preparePredicatePhase(scan, value),
    TypeQueryNode: value => prepareTypePhase(scan, value),
    TypeReferenceNode: value => prepareTypePhase(scan, value),
    UnionTypeNode: value => prepareTypePhase(scan, value),
    VariableDeclaration: value => prepareBindingPhase(scan, value),
    VariableDeclarationList: value => prepareVariableList(scan, value, at + ".VariableDeclarationList.tsonic"),
    VoidExpression: value => prepareUnary(scan, value, at + ".VoidExpression.tsonic"),
    YieldExpression: value => prepareProtocolValue(scan, value, at + ".YieldExpression.tsonic"),
  };
}
