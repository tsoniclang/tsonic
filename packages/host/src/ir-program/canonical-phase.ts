import type {
  TargetAccess, TypedAlias, TypedApplication, TypedBigInt, TypedBinary, TypedBinding, TypedBindingElement,
  TypedCallable, TypedClass, TypedClosure, TypedConstruction, TypedInstantiation,
  TypedInterface, TypedKeyword, TypedMember, TypedName, TypedNumber, TypedPrefix,
  TypedProtocolValue, TypedSourceFile, TypedString, TypedTemplate, TypedUnary,
  TypedUpdate, TypedVariableList,
  TypedClassValue, TypedConditional, TypedDecorator, TypedEnum, TypedHeritage,
  TypedIndexDeclaration, TypedIteration, TypedNamespace, TypedObjectSpread, TypedOmission,
  TypedParameter, TypedPredicate, TypedProperty, TypedPropertyKey, TypedStaticBlock,
  TypedStorageDeclaration, TypedType, TypedTypeParameter,
} from "../ir-tir/contract.js";
import type { TypeRewrite } from "./canonical-types.js";
import { rewriteBindings, rewriteEndpoint, rewriteParameter } from "./canonical-types.js";
import { rewriteApplication, rewriteClosureDecision, rewriteConstructionPart, rewriteOutcome, rewriteRefinement } from "./canonical-inference.js";
import {
  rewriteProtocol, rewriteSelection, rewriteTirApplication, rewriteTypedOperation, rewriteValue,
} from "./canonical-tir.js";

export function rewriteAccess(rewrite: TypeRewrite, access: TargetAccess, at: string): TargetAccess {
  switch (access.kind) {
    case "write": return { kind: "write", storage: rewrite.type(access.storage) };
    case "read-write": return {
      kind: "read-write", storage: rewrite.type(access.storage), read: rewrite.type(access.read),
      narrowing: access.narrowing === null ? null : rewriteRefinement(rewrite, access.narrowing, `${at}.narrowing`),
      evidenceIndex: access.evidenceIndex,
    };
  }
}

export function rewriteName(rewrite: TypeRewrite, name: TypedName, at: string): TypedName {
  switch (name.role) {
    case "value": return { ...rewriteValue(rewrite, name, at), role: "value", resolution: name.resolution };
    case "shorthand-value": return { ...rewriteValue(rewrite, name, at), role: "shorthand-value", key: name.key, resolution: name.resolution };
    case "assignment-target": return { role: "assignment-target", resolution: name.resolution, access: rewriteAccess(rewrite, name.access, `${at}.access`) };
    case "declaration-name": return { role: "declaration-name", declaration: name.declaration, storage: name.storage === null ? null : rewrite.type(name.storage) };
    case "type-name": return { role: "type-name", type: rewrite.type(name.type), declarations: name.declarations };
    case "property-name":
    case "label":
    case "private-name": return name;
  }
}

export function rewriteString(rewrite: TypeRewrite, value: TypedString, at: string): TypedString {
  switch (value.role) {
    case "value": return { ...rewriteValue(rewrite, value, at), role: "value", value: value.value };
    case "type-literal": return { role: "type-literal", type: rewrite.type(value.type) };
    case "property-name":
    case "declaration-name":
    case "module-specifier":
    case "export-name":
    case "attribute-value": return value;
  }
}

export function rewriteNumber(rewrite: TypeRewrite, value: TypedNumber, at: string): TypedNumber {
  switch (value.role) {
    case "value": return { ...rewriteValue(rewrite, value, at), role: "value", value: value.value };
    case "type-literal": return { role: "type-literal", type: rewrite.type(value.type) };
    case "property-name":
    case "declaration-name": return value;
  }
}

export function rewriteBigInt(rewrite: TypeRewrite, value: TypedBigInt, at: string): TypedBigInt {
  switch (value.role) {
    case "value": return { ...rewriteValue(rewrite, value, at), role: "value", value: value.value };
    case "type-literal": return { role: "type-literal", type: rewrite.type(value.type) };
    case "property-name":
    case "declaration-name": return value;
  }
}

export function rewriteKeyword(rewrite: TypeRewrite, value: TypedKeyword, at: string): TypedKeyword {
  switch (value.role) {
    case "value": return { ...rewriteValue(rewrite, value, at), role: "value" };
    case "receiver": return { ...rewriteValue(rewrite, value, at), role: "receiver", owner: value.owner };
    case "super": return { ...rewriteValue(rewrite, value, at), role: "super", owner: value.owner, base: rewrite.type(value.base) };
    case "type-literal": return { role: "type-literal", type: rewrite.type(value.type) };
  }
}

export function rewriteBinary(rewrite: TypeRewrite, value: TypedBinary, at: string): TypedBinary {
  const common = rewriteValue(rewrite, value, at);
  switch (value.role) {
    case "arithmetic":
    case "comparison": return {
      ...common, role: value.role,
      operation: rewriteOutcome(rewrite, value.operation, operation => rewriteTypedOperation(rewrite, operation, `${at}.operation.decision`), `${at}.operation`),
    };
    case "short-circuit": return { ...common, role: "short-circuit", selection: value.selection };
    case "assignment": return {
      ...common, role: "assignment", storage: rewrite.type(value.storage),
      calculation: value.calculation === null ? null : rewriteOutcome(rewrite, value.calculation,
        operation => rewriteTypedOperation(rewrite, operation, `${at}.calculation.decision`), `${at}.calculation`),
      selection: value.selection,
    };
    case "sequence": return { ...common, role: "sequence" };
  }
}

export function rewriteUnary(rewrite: TypeRewrite, value: TypedUnary, at: string): TypedUnary {
  return {
    ...rewriteValue(rewrite, value, at),
    operation: rewriteOutcome(rewrite, value.operation, operation => rewriteTypedOperation(rewrite, operation, `${at}.operation.decision`), `${at}.operation`),
  };
}

export function rewritePrefix(rewrite: TypeRewrite, value: TypedPrefix, at: string): TypedPrefix {
  switch (value.role) {
    case "type-literal": return { role: "type-literal", type: rewrite.type(value.type) };
    case "value": return { ...rewriteUnary(rewrite, value, at), role: "value" };
    case "update": return { ...rewriteUnary(rewrite, value, at), role: "update", storage: rewrite.type(value.storage) };
  }
}

export function rewriteUpdate(rewrite: TypeRewrite, value: TypedUpdate, at: string): TypedUpdate {
  return { ...rewriteUnary(rewrite, value, at), storage: rewrite.type(value.storage) };
}

export function rewriteTypedMember(rewrite: TypeRewrite, value: TypedMember, at: string): TypedMember {
  const selection = rewriteOutcome(rewrite, value.selection, member => rewriteSelection(rewrite, member), `${at}.selection`);
  switch (value.role) {
    case "value": return { ...rewriteValue(rewrite, value, at), role: "value", selection };
    case "assignment-target": return { role: "assignment-target", selection, access: rewriteAccess(rewrite, value.access, `${at}.access`) };
  }
}

export function rewriteTypedApplication(rewrite: TypeRewrite, value: TypedApplication, at: string): TypedApplication {
  return {
    ...rewriteValue(rewrite, value, at),
    application: rewriteOutcome(rewrite, value.application, application => rewriteTirApplication(rewrite, application), `${at}.application`),
    operation: value.operation === null ? null : rewriteOutcome(rewrite, value.operation,
      operation => rewriteTypedOperation(rewrite, operation, `${at}.operation.decision`), `${at}.operation`),
  };
}

export function rewriteProtocolValue(rewrite: TypeRewrite, value: TypedProtocolValue, at: string): TypedProtocolValue {
  return {
    ...rewriteValue(rewrite, value, at),
    protocol: rewriteOutcome(rewrite, value.protocol, protocol => rewriteProtocol(rewrite, protocol, `${at}.protocol.decision`), `${at}.protocol`),
  };
}

export function rewriteConstruction(rewrite: TypeRewrite, value: TypedConstruction, at: string): TypedConstruction {
  switch (value.role) {
    case "value": return {
      ...rewriteValue(rewrite, value, at), role: "value",
      construction: rewriteOutcome(rewrite, value.construction, operation => rewriteTypedOperation(rewrite, operation, `${at}.construction.decision`), `${at}.construction`),
    };
    case "assignment-pattern": return {
      role: "assignment-pattern", storage: rewrite.type(value.storage),
      parts: value.parts.map((part, position) => rewriteConstructionPart(rewrite, part, `${at}.parts[${position}]`)),
    };
  }
}

export function rewriteTemplate(rewrite: TypeRewrite, value: TypedTemplate, at: string): TypedTemplate {
  return rewriteUnary(rewrite, value, at);
}

export function rewriteInstantiation(rewrite: TypeRewrite, value: TypedInstantiation, at: string): TypedInstantiation {
  const bindings = rewriteBindings(rewrite, value.bindings);
  switch (value.role) {
    case "value": return {
      ...rewriteValue(rewrite, value, at), role: "value", bindings,
      application: value.application === null ? null : rewriteOutcome(rewrite, value.application,
        application => rewriteApplication(rewrite, application), `${at}.application`),
    };
    case "heritage": return { role: "heritage", type: rewrite.type(value.type), bindings, declarations: value.declarations };
  }
}

export function rewriteBinding(rewrite: TypeRewrite, value: TypedBinding): TypedBinding {
  return { declaration: value.declaration, storage: rewrite.type(value.storage), initializer: value.initializer };
}

export function rewriteBindingElement(rewrite: TypeRewrite, value: TypedBindingElement): TypedBindingElement {
  switch (value.role) {
    case "binding": return { ...rewriteBinding(rewrite, value), role: "binding" };
    case "hole": return value;
  }
}

export function rewriteVariableList(rewrite: TypeRewrite, value: TypedVariableList, at: string): TypedVariableList {
  switch (value.role) {
    case "ordinary": return value;
    case "using": return {
      role: "using", asynchronous: value.asynchronous,
      protocols: value.protocols.map((protocol, position) => rewriteOutcome(rewrite, protocol,
        decision => rewriteProtocol(rewrite, decision, `${at}.protocols[${position}].decision`), `${at}.protocols[${position}]`)),
    };
  }
}

export function rewriteCallable(rewrite: TypeRewrite, value: TypedCallable): TypedCallable {
  return {
    definition: value.definition, parameters: value.parameters.map(parameter => rewriteParameter(rewrite, parameter)),
    signatures: value.signatures.map(signature => rewriteEndpoint(rewrite, signature)),
    template: value.template === null ? null : {
      body: value.template.body, lexicalBindings: rewriteBindings(rewrite, value.template.lexicalBindings), dependence: value.template.dependence,
    }, attributes: value.attributes,
  };
}

export function rewriteClosure(rewrite: TypeRewrite, value: TypedClosure, at: string): TypedClosure {
  return { ...rewriteValue(rewrite, value, at), callable: rewriteCallable(rewrite, value.callable),
    closure: rewriteOutcome(rewrite, value.closure, decision => rewriteClosureDecision(rewrite, decision), `${at}.closure`) };
}

export function rewriteClass(rewrite: TypeRewrite, value: TypedClass): TypedClass {
  return {
    definition: value.definition, parameters: value.parameters.map(parameter => rewriteParameter(rewrite, parameter)),
    type: rewrite.type(value.type), heritage: value.heritage.map(rewrite.type), members: value.members, attributes: value.attributes,
  };
}

export function rewriteInterface(rewrite: TypeRewrite, value: TypedInterface): TypedInterface {
  return {
    definition: value.definition, parameters: value.parameters.map(parameter => rewriteParameter(rewrite, parameter)),
    type: rewrite.type(value.type), members: value.members,
  };
}

export function rewriteAlias(rewrite: TypeRewrite, value: TypedAlias): TypedAlias {
  return {
    definition: value.definition, parameters: value.parameters.map(parameter => rewriteParameter(rewrite, parameter)), type: rewrite.type(value.type),
  };
}

export function rewriteSourceFilePhase(rewrite: TypeRewrite, value: TypedSourceFile): TypedSourceFile {
  return {
    module: value.module, template: value.template === null ? null : {
      body: value.template.body, lexicalBindings: rewriteBindings(rewrite, value.template.lexicalBindings), dependence: value.template.dependence,
    },
  };
}

export function rewritePropertyKey(rewrite: TypeRewrite, value: TypedPropertyKey): TypedPropertyKey {
  switch (value.kind) {
    case "constant": return value;
    case "computed": return { kind: "computed", type: rewrite.type(value.type) };
  }
}

export function rewriteDecorator(rewrite: TypeRewrite, value: TypedDecorator, at: string): TypedDecorator {
  return { application: rewriteOutcome(rewrite, value.application, application => rewriteTirApplication(rewrite, application), `${at}.application`) };
}

export function rewriteConditional(rewrite: TypeRewrite, value: TypedConditional, at: string): TypedConditional {
  return { ...rewriteValue(rewrite, value, at), selection: value.selection };
}

export function rewriteObjectSpread(rewrite: TypeRewrite, value: TypedObjectSpread, at: string): TypedObjectSpread {
  return { construction: rewriteOutcome(rewrite, value.construction,
    operation => rewriteTypedOperation(rewrite, operation, `${at}.construction.decision`), `${at}.construction`) };
}

export function rewriteProperty(rewrite: TypeRewrite, value: TypedProperty, at: string): TypedProperty {
  return { key: value.key, member: rewriteOutcome(rewrite, value.member, member => rewriteSelection(rewrite, member), `${at}.member`) };
}

export function rewriteOmission(rewrite: TypeRewrite, value: TypedOmission): TypedOmission {
  return { storage: rewrite.type(value.storage) };
}

export function rewriteIteration(rewrite: TypeRewrite, value: TypedIteration, at: string): TypedIteration {
  return { protocol: rewriteOutcome(rewrite, value.protocol, protocol => rewriteProtocol(rewrite, protocol, `${at}.protocol.decision`), `${at}.protocol`) };
}

export function rewriteTypedParameter(rewrite: TypeRewrite, value: TypedParameter): TypedParameter {
  return {
    declaration: value.declaration, local: value.local, storage: rewrite.type(value.storage),
    passing: value.passing, initializer: value.initializer,
  };
}

export function rewriteClassValue(rewrite: TypeRewrite, value: TypedClassValue, at: string): TypedClassValue {
  return { ...rewriteValue(rewrite, value, at), declaration: rewriteClass(rewrite, value.declaration) };
}

export function rewriteHeritage(rewrite: TypeRewrite, value: TypedHeritage): TypedHeritage {
  return { types: value.types.map(rewrite.type) };
}

export function rewriteEnum(rewrite: TypeRewrite, value: TypedEnum): TypedEnum {
  return { definition: value.definition, type: rewrite.type(value.type), members: value.members };
}

export function rewriteStorage(rewrite: TypeRewrite, value: TypedStorageDeclaration): TypedStorageDeclaration {
  return { definition: value.definition, storage: rewrite.type(value.storage), initializer: value.initializer, attributes: value.attributes };
}

export function rewriteStaticBlock(rewrite: TypeRewrite, value: TypedStaticBlock): TypedStaticBlock {
  return { template: {
    body: value.template.body, lexicalBindings: rewriteBindings(rewrite, value.template.lexicalBindings), dependence: value.template.dependence,
  } };
}

export function rewriteIndexDeclaration(rewrite: TypeRewrite, value: TypedIndexDeclaration): TypedIndexDeclaration {
  return { definition: value.definition, key: rewrite.type(value.key), read: rewrite.type(value.read), write: value.write === null ? null : rewrite.type(value.write) };
}

export function rewriteType(rewrite: TypeRewrite, value: TypedType): TypedType {
  return { type: rewrite.type(value.type), declarations: value.declarations };
}

export function rewritePredicate(rewrite: TypeRewrite, value: TypedPredicate): TypedPredicate {
  return { parameter: value.parameter, narrowed: value.narrowed === null ? null : rewrite.type(value.narrowed), asserts: value.asserts };
}

export function rewriteTypeParameter(rewrite: TypeRewrite, value: TypedTypeParameter): TypedTypeParameter {
  return { parameter: rewriteParameter(rewrite, value.parameter) };
}

export function rewriteNamespace(rewrite: TypeRewrite, value: TypedNamespace): TypedNamespace {
  return {
    definition: value.definition, type: rewrite.type(value.type), template: value.template === null ? null : {
      body: value.template.body, lexicalBindings: rewriteBindings(rewrite, value.template.lexicalBindings), dependence: value.template.dependence,
    },
  };
}
