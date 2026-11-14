import type { TypedName, TypedPropertyKey, TypedDecorator, TypedIteration, TypedControlTransfer, TypedVariableList, TypedClassValue, TypedOmission, TypedKeyword, TypedString, TypedNumber, TypedBigInt, TypedBinary, TypedPrefix, TypedUpdate, TypedProtocolValue, TypedClosure, TypedConditional, TypedMember, TypedApplication, TypedSpread, TypedTemplate, TypedConstruction, TypedObjectSpread, TypedProperty, TypedShorthand, TypedUnary, TypedInstantiation } from "../ir-tir/contract.js";
import type { TextWork } from "./text-values.js";
import { token, text, numeric, numericIdentity, identity, field, record, sequence, deferred, boolean, integer, textNodeRef } from "./text-values.js";
import { textConversionDecision, textTirDemand, textTirResolution, textTargetAccess, textTirApplication, textTirProtocol, textTypedOperation, textTirSelection, textMemberSelection } from "./text-tir.js";
import { textRefinementDecision, textRuleOutcome, textConstructionPartDecision, textApplicationDecision, textClosureDecision } from "./text-inference.js";
import { textMemberKey, textExactRational, textBindingVector } from "./text-types.js";
import { textDeclarationTarget, textImportTarget } from "./text-core.js";
import { textTypedClass, textTypedCallable } from "./text-phase-declarations.js";

export function textTypedName(value: TypedName): TextWork {
  return deferred(value, () => {
    switch (value.role) {
      case "value":
        return record("TypedName", [
      field("type", numericIdentity("t", value.type)),
      field("convertedType", numericIdentity("t", value.convertedType)),
      field("conversion", textConversionDecision(value.conversion)),
      field("narrowing", (value.narrowing === null ? token("null") : textRefinementDecision(value.narrowing))),
      field("evidenceIndex", (value.evidenceIndex === null ? token("null") : numeric(value.evidenceIndex))),
      field("demand", textTirDemand(value.demand)),
      field("role", text(value.role)),
      field("resolution", textTirResolution(value.resolution)),
    ]);
      case "shorthand-value":
        return record("TypedName", [
      field("type", numericIdentity("t", value.type)),
      field("convertedType", numericIdentity("t", value.convertedType)),
      field("conversion", textConversionDecision(value.conversion)),
      field("narrowing", (value.narrowing === null ? token("null") : textRefinementDecision(value.narrowing))),
      field("evidenceIndex", (value.evidenceIndex === null ? token("null") : numeric(value.evidenceIndex))),
      field("demand", textTirDemand(value.demand)),
      field("role", text(value.role)),
      field("key", textMemberKey(value.key)),
      field("resolution", textTirResolution(value.resolution)),
    ]);
      case "assignment-target":
        return record("TypedName", [
      field("role", text(value.role)),
      field("resolution", textTirResolution(value.resolution)),
      field("access", textTargetAccess(value.access)),
    ]);
      case "declaration-name":
        return record("TypedName", [
      field("role", text(value.role)),
      field("declaration", textDeclarationTarget(value.declaration)),
      field("storage", (value.storage === null ? token("null") : numericIdentity("t", value.storage))),
    ]);
      case "property-name":
        return record("TypedName", [
      field("role", text(value.role)),
      field("key", textMemberKey(value.key)),
    ]);
      case "type-name":
        return record("TypedName", [
      field("role", text(value.role)),
      field("type", numericIdentity("t", value.type)),
      field("declarations", sequence(value.declarations, entry0 => identity("def", entry0))),
    ]);
      case "label":
        return record("TypedName", [
      field("role", text(value.role)),
      field("target", textNodeRef(value.target)),
    ]);
      case "private-name":
        return record("TypedName", [
      field("role", text(value.role)),
      field("declaration", identity("def", value.declaration)),
    ]);
    }
  });
}

export function textTypedPropertyKey(value: TypedPropertyKey): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "constant":
        return record(value.kind, [
      field("key", textMemberKey(value.key)),
    ]);
      case "computed":
        return record(value.kind, [
      field("type", numericIdentity("t", value.type)),
    ]);
    }
  });
}

export function textTypedDecorator(value: TypedDecorator): TextWork {
  return deferred(value, () => {
    return record("TypedDecorator", [
      field("application", textRuleOutcome(value.application, entry0 => textTirApplication(entry0))),
    ]);
  });
}

export function textTypedIteration(value: TypedIteration): TextWork {
  return deferred(value, () => {
    return record("TypedIteration", [
      field("protocol", textRuleOutcome(value.protocol, entry0 => textTirProtocol(entry0))),
    ]);
  });
}

export function textTypedControlTransfer(value: TypedControlTransfer): TextWork {
  return deferred(value, () => {
    return record("TypedControlTransfer", [
      field("target", textNodeRef(value.target)),
    ]);
  });
}

export function textTypedVariableList(value: TypedVariableList): TextWork {
  return deferred(value, () => {
    switch (value.role) {
      case "ordinary":
        return record("TypedVariableList", [
      field("role", text(value.role)),
    ]);
      case "using":
        return record("TypedVariableList", [
      field("role", text(value.role)),
      field("asynchronous", boolean(value.asynchronous)),
      field("protocols", sequence(value.protocols, entry0 => textRuleOutcome(entry0, entry1 => textTirProtocol(entry1)))),
    ]);
    }
  });
}

export function textTypedClassValue(value: TypedClassValue): TextWork {
  return deferred(value, () => {
    return record("TypedClassValue", [
      field("type", numericIdentity("t", value.type)),
      field("convertedType", numericIdentity("t", value.convertedType)),
      field("conversion", textConversionDecision(value.conversion)),
      field("narrowing", (value.narrowing === null ? token("null") : textRefinementDecision(value.narrowing))),
      field("evidenceIndex", (value.evidenceIndex === null ? token("null") : numeric(value.evidenceIndex))),
      field("demand", textTirDemand(value.demand)),
      field("declaration", textTypedClass(value.declaration)),
    ]);
  });
}

export function textTypedOmission(value: TypedOmission): TextWork {
  return deferred(value, () => {
    return record("TypedOmission", [
      field("storage", numericIdentity("t", value.storage)),
    ]);
  });
}

export function textTypedKeyword(value: TypedKeyword): TextWork {
  return deferred(value, () => {
    switch (value.role) {
      case "value":
        return record("TypedKeyword", [
      field("type", numericIdentity("t", value.type)),
      field("convertedType", numericIdentity("t", value.convertedType)),
      field("conversion", textConversionDecision(value.conversion)),
      field("narrowing", (value.narrowing === null ? token("null") : textRefinementDecision(value.narrowing))),
      field("evidenceIndex", (value.evidenceIndex === null ? token("null") : numeric(value.evidenceIndex))),
      field("demand", textTirDemand(value.demand)),
      field("role", text(value.role)),
    ]);
      case "receiver":
        return record("TypedKeyword", [
      field("type", numericIdentity("t", value.type)),
      field("convertedType", numericIdentity("t", value.convertedType)),
      field("conversion", textConversionDecision(value.conversion)),
      field("narrowing", (value.narrowing === null ? token("null") : textRefinementDecision(value.narrowing))),
      field("evidenceIndex", (value.evidenceIndex === null ? token("null") : numeric(value.evidenceIndex))),
      field("demand", textTirDemand(value.demand)),
      field("role", text(value.role)),
      field("owner", identity("def", value.owner)),
    ]);
      case "super":
        return record("TypedKeyword", [
      field("type", numericIdentity("t", value.type)),
      field("convertedType", numericIdentity("t", value.convertedType)),
      field("conversion", textConversionDecision(value.conversion)),
      field("narrowing", (value.narrowing === null ? token("null") : textRefinementDecision(value.narrowing))),
      field("evidenceIndex", (value.evidenceIndex === null ? token("null") : numeric(value.evidenceIndex))),
      field("demand", textTirDemand(value.demand)),
      field("role", text(value.role)),
      field("owner", identity("def", value.owner)),
      field("base", numericIdentity("t", value.base)),
    ]);
      case "type-literal":
        return record("TypedKeyword", [
      field("role", text(value.role)),
      field("type", numericIdentity("t", value.type)),
    ]);
    }
  });
}

export function textTypedString(value: TypedString): TextWork {
  return deferred(value, () => {
    switch (value.role) {
      case "value":
        return record("TypedString", [
      field("type", numericIdentity("t", value.type)),
      field("convertedType", numericIdentity("t", value.convertedType)),
      field("conversion", textConversionDecision(value.conversion)),
      field("narrowing", (value.narrowing === null ? token("null") : textRefinementDecision(value.narrowing))),
      field("evidenceIndex", (value.evidenceIndex === null ? token("null") : numeric(value.evidenceIndex))),
      field("demand", textTirDemand(value.demand)),
      field("role", text(value.role)),
      field("value", text(value.value)),
    ]);
      case "property-name":
        return record("TypedString", [
      field("role", text(value.role)),
      field("key", textMemberKey(value.key)),
    ]);
      case "declaration-name":
        return record("TypedString", [
      field("role", text(value.role)),
      field("declaration", textDeclarationTarget(value.declaration)),
    ]);
      case "type-literal":
        return record("TypedString", [
      field("role", text(value.role)),
      field("type", numericIdentity("t", value.type)),
    ]);
      case "module-specifier":
        return record("TypedString", [
      field("role", text(value.role)),
      field("target", textImportTarget(value.target)),
    ]);
      case "export-name":
        return record("TypedString", [
      field("role", text(value.role)),
      field("definition", identity("def", value.definition)),
    ]);
      case "attribute-value":
        return record("TypedString", [
      field("role", text(value.role)),
      field("value", text(value.value)),
    ]);
    }
  });
}

export function textTypedNumber(value: TypedNumber): TextWork {
  return deferred(value, () => {
    switch (value.role) {
      case "value":
        return record("TypedNumber", [
      field("type", numericIdentity("t", value.type)),
      field("convertedType", numericIdentity("t", value.convertedType)),
      field("conversion", textConversionDecision(value.conversion)),
      field("narrowing", (value.narrowing === null ? token("null") : textRefinementDecision(value.narrowing))),
      field("evidenceIndex", (value.evidenceIndex === null ? token("null") : numeric(value.evidenceIndex))),
      field("demand", textTirDemand(value.demand)),
      field("role", text(value.role)),
      field("value", textExactRational(value.value)),
    ]);
      case "property-name":
        return record("TypedNumber", [
      field("role", text(value.role)),
      field("key", textMemberKey(value.key)),
    ]);
      case "declaration-name":
        return record("TypedNumber", [
      field("role", text(value.role)),
      field("declaration", textDeclarationTarget(value.declaration)),
    ]);
      case "type-literal":
        return record("TypedNumber", [
      field("role", text(value.role)),
      field("type", numericIdentity("t", value.type)),
    ]);
    }
  });
}

export function textTypedBigInt(value: TypedBigInt): TextWork {
  return deferred(value, () => {
    switch (value.role) {
      case "value":
        return record("TypedBigInt", [
      field("type", numericIdentity("t", value.type)),
      field("convertedType", numericIdentity("t", value.convertedType)),
      field("conversion", textConversionDecision(value.conversion)),
      field("narrowing", (value.narrowing === null ? token("null") : textRefinementDecision(value.narrowing))),
      field("evidenceIndex", (value.evidenceIndex === null ? token("null") : numeric(value.evidenceIndex))),
      field("demand", textTirDemand(value.demand)),
      field("role", text(value.role)),
      field("value", integer(value.value)),
    ]);
      case "property-name":
        return record("TypedBigInt", [
      field("role", text(value.role)),
      field("key", textMemberKey(value.key)),
    ]);
      case "declaration-name":
        return record("TypedBigInt", [
      field("role", text(value.role)),
      field("declaration", textDeclarationTarget(value.declaration)),
    ]);
      case "type-literal":
        return record("TypedBigInt", [
      field("role", text(value.role)),
      field("type", numericIdentity("t", value.type)),
    ]);
    }
  });
}

export function textTypedBinary(value: TypedBinary): TextWork {
  return deferred(value, () => {
    switch (value.role) {
      case "arithmetic":
        return record("TypedBinary", [
      field("type", numericIdentity("t", value.type)),
      field("convertedType", numericIdentity("t", value.convertedType)),
      field("conversion", textConversionDecision(value.conversion)),
      field("narrowing", (value.narrowing === null ? token("null") : textRefinementDecision(value.narrowing))),
      field("evidenceIndex", (value.evidenceIndex === null ? token("null") : numeric(value.evidenceIndex))),
      field("demand", textTirDemand(value.demand)),
      field("role", text(value.role)),
      field("operation", textRuleOutcome(value.operation, entry0 => textTypedOperation(entry0))),
    ]);
      case "comparison":
        return record("TypedBinary", [
      field("type", numericIdentity("t", value.type)),
      field("convertedType", numericIdentity("t", value.convertedType)),
      field("conversion", textConversionDecision(value.conversion)),
      field("narrowing", (value.narrowing === null ? token("null") : textRefinementDecision(value.narrowing))),
      field("evidenceIndex", (value.evidenceIndex === null ? token("null") : numeric(value.evidenceIndex))),
      field("demand", textTirDemand(value.demand)),
      field("role", text(value.role)),
      field("operation", textRuleOutcome(value.operation, entry0 => textTypedOperation(entry0))),
    ]);
      case "short-circuit":
        return record("TypedBinary", [
      field("type", numericIdentity("t", value.type)),
      field("convertedType", numericIdentity("t", value.convertedType)),
      field("conversion", textConversionDecision(value.conversion)),
      field("narrowing", (value.narrowing === null ? token("null") : textRefinementDecision(value.narrowing))),
      field("evidenceIndex", (value.evidenceIndex === null ? token("null") : numeric(value.evidenceIndex))),
      field("demand", textTirDemand(value.demand)),
      field("role", text(value.role)),
      field("selection", textTirSelection(value.selection)),
    ]);
      case "assignment":
        return record("TypedBinary", [
      field("type", numericIdentity("t", value.type)),
      field("convertedType", numericIdentity("t", value.convertedType)),
      field("conversion", textConversionDecision(value.conversion)),
      field("narrowing", (value.narrowing === null ? token("null") : textRefinementDecision(value.narrowing))),
      field("evidenceIndex", (value.evidenceIndex === null ? token("null") : numeric(value.evidenceIndex))),
      field("demand", textTirDemand(value.demand)),
      field("role", text(value.role)),
      field("storage", numericIdentity("t", value.storage)),
      field("calculation", (value.calculation === null ? token("null") : textRuleOutcome(value.calculation, entry0 => textTypedOperation(entry0)))),
      field("selection", (value.selection === null ? token("null") : textTirSelection(value.selection))),
    ]);
      case "sequence":
        return record("TypedBinary", [
      field("type", numericIdentity("t", value.type)),
      field("convertedType", numericIdentity("t", value.convertedType)),
      field("conversion", textConversionDecision(value.conversion)),
      field("narrowing", (value.narrowing === null ? token("null") : textRefinementDecision(value.narrowing))),
      field("evidenceIndex", (value.evidenceIndex === null ? token("null") : numeric(value.evidenceIndex))),
      field("demand", textTirDemand(value.demand)),
      field("role", text(value.role)),
    ]);
    }
  });
}

export function textTypedPrefix(value: TypedPrefix): TextWork {
  return deferred(value, () => {
    switch (value.role) {
      case "value":
        return record("TypedPrefix", [
      field("type", numericIdentity("t", value.type)),
      field("convertedType", numericIdentity("t", value.convertedType)),
      field("conversion", textConversionDecision(value.conversion)),
      field("narrowing", (value.narrowing === null ? token("null") : textRefinementDecision(value.narrowing))),
      field("evidenceIndex", (value.evidenceIndex === null ? token("null") : numeric(value.evidenceIndex))),
      field("demand", textTirDemand(value.demand)),
      field("role", text(value.role)),
      field("operation", textRuleOutcome(value.operation, entry0 => textTypedOperation(entry0))),
    ]);
      case "update":
        return record("TypedPrefix", [
      field("type", numericIdentity("t", value.type)),
      field("convertedType", numericIdentity("t", value.convertedType)),
      field("conversion", textConversionDecision(value.conversion)),
      field("narrowing", (value.narrowing === null ? token("null") : textRefinementDecision(value.narrowing))),
      field("evidenceIndex", (value.evidenceIndex === null ? token("null") : numeric(value.evidenceIndex))),
      field("demand", textTirDemand(value.demand)),
      field("role", text(value.role)),
      field("storage", numericIdentity("t", value.storage)),
      field("operation", textRuleOutcome(value.operation, entry0 => textTypedOperation(entry0))),
    ]);
      case "type-literal":
        return record("TypedPrefix", [
      field("role", text(value.role)),
      field("type", numericIdentity("t", value.type)),
    ]);
    }
  });
}

export function textTypedUpdate(value: TypedUpdate): TextWork {
  return deferred(value, () => {
    return record("TypedUpdate", [
      field("type", numericIdentity("t", value.type)),
      field("convertedType", numericIdentity("t", value.convertedType)),
      field("conversion", textConversionDecision(value.conversion)),
      field("narrowing", (value.narrowing === null ? token("null") : textRefinementDecision(value.narrowing))),
      field("evidenceIndex", (value.evidenceIndex === null ? token("null") : numeric(value.evidenceIndex))),
      field("demand", textTirDemand(value.demand)),
      field("storage", numericIdentity("t", value.storage)),
      field("operation", textRuleOutcome(value.operation, entry0 => textTypedOperation(entry0))),
    ]);
  });
}

export function textTypedProtocolValue(value: TypedProtocolValue): TextWork {
  return deferred(value, () => {
    return record("TypedProtocolValue", [
      field("type", numericIdentity("t", value.type)),
      field("convertedType", numericIdentity("t", value.convertedType)),
      field("conversion", textConversionDecision(value.conversion)),
      field("narrowing", (value.narrowing === null ? token("null") : textRefinementDecision(value.narrowing))),
      field("evidenceIndex", (value.evidenceIndex === null ? token("null") : numeric(value.evidenceIndex))),
      field("demand", textTirDemand(value.demand)),
      field("protocol", textRuleOutcome(value.protocol, entry0 => textTirProtocol(entry0))),
    ]);
  });
}

export function textTypedClosure(value: TypedClosure): TextWork {
  return deferred(value, () => {
    return record("TypedClosure", [
      field("type", numericIdentity("t", value.type)),
      field("convertedType", numericIdentity("t", value.convertedType)),
      field("conversion", textConversionDecision(value.conversion)),
      field("narrowing", (value.narrowing === null ? token("null") : textRefinementDecision(value.narrowing))),
      field("evidenceIndex", (value.evidenceIndex === null ? token("null") : numeric(value.evidenceIndex))),
      field("demand", textTirDemand(value.demand)),
      field("callable", textTypedCallable(value.callable)),
      field("closure", textRuleOutcome(value.closure, textClosureDecision)),
    ]);
  });
}

export function textTypedConditional(value: TypedConditional): TextWork {
  return deferred(value, () => {
    return record("TypedConditional", [
      field("type", numericIdentity("t", value.type)),
      field("convertedType", numericIdentity("t", value.convertedType)),
      field("conversion", textConversionDecision(value.conversion)),
      field("narrowing", (value.narrowing === null ? token("null") : textRefinementDecision(value.narrowing))),
      field("evidenceIndex", (value.evidenceIndex === null ? token("null") : numeric(value.evidenceIndex))),
      field("demand", textTirDemand(value.demand)),
      field("selection", textTirSelection(value.selection)),
    ]);
  });
}

export function textTypedMember(value: TypedMember): TextWork {
  return deferred(value, () => {
    switch (value.role) {
      case "value":
        return record("TypedMember", [
      field("type", numericIdentity("t", value.type)),
      field("convertedType", numericIdentity("t", value.convertedType)),
      field("conversion", textConversionDecision(value.conversion)),
      field("narrowing", (value.narrowing === null ? token("null") : textRefinementDecision(value.narrowing))),
      field("evidenceIndex", (value.evidenceIndex === null ? token("null") : numeric(value.evidenceIndex))),
      field("demand", textTirDemand(value.demand)),
      field("role", text(value.role)),
      field("selection", textRuleOutcome(value.selection, entry0 => textMemberSelection(entry0))),
    ]);
      case "assignment-target":
        return record("TypedMember", [
      field("role", text(value.role)),
      field("selection", textRuleOutcome(value.selection, entry0 => textMemberSelection(entry0))),
      field("access", textTargetAccess(value.access)),
    ]);
    }
  });
}

export function textTypedApplication(value: TypedApplication): TextWork {
  return deferred(value, () => {
    return record("TypedApplication", [
      field("type", numericIdentity("t", value.type)),
      field("convertedType", numericIdentity("t", value.convertedType)),
      field("conversion", textConversionDecision(value.conversion)),
      field("narrowing", (value.narrowing === null ? token("null") : textRefinementDecision(value.narrowing))),
      field("evidenceIndex", (value.evidenceIndex === null ? token("null") : numeric(value.evidenceIndex))),
      field("demand", textTirDemand(value.demand)),
      field("application", textRuleOutcome(value.application, entry0 => textTirApplication(entry0))),
      field("operation", (value.operation === null ? token("null") : textRuleOutcome(value.operation, entry0 => textTypedOperation(entry0)))),
    ]);
  });
}

export function textTypedSpread(value: TypedSpread): TextWork {
  return deferred(value, () => {
    return record("TypedSpread", [
      field("type", numericIdentity("t", value.type)),
      field("convertedType", numericIdentity("t", value.convertedType)),
      field("conversion", textConversionDecision(value.conversion)),
      field("narrowing", (value.narrowing === null ? token("null") : textRefinementDecision(value.narrowing))),
      field("evidenceIndex", (value.evidenceIndex === null ? token("null") : numeric(value.evidenceIndex))),
      field("demand", textTirDemand(value.demand)),
      field("protocol", textRuleOutcome(value.protocol, entry0 => textTirProtocol(entry0))),
    ]);
  });
}

export function textTypedTemplate(value: TypedTemplate): TextWork {
  return deferred(value, () => {
    return record("TypedTemplate", [
      field("type", numericIdentity("t", value.type)),
      field("convertedType", numericIdentity("t", value.convertedType)),
      field("conversion", textConversionDecision(value.conversion)),
      field("narrowing", (value.narrowing === null ? token("null") : textRefinementDecision(value.narrowing))),
      field("evidenceIndex", (value.evidenceIndex === null ? token("null") : numeric(value.evidenceIndex))),
      field("demand", textTirDemand(value.demand)),
      field("operation", textRuleOutcome(value.operation, entry0 => textTypedOperation(entry0))),
    ]);
  });
}

export function textTypedConstruction(value: TypedConstruction): TextWork {
  return deferred(value, () => {
    switch (value.role) {
      case "value":
        return record("TypedConstruction", [
      field("type", numericIdentity("t", value.type)),
      field("convertedType", numericIdentity("t", value.convertedType)),
      field("conversion", textConversionDecision(value.conversion)),
      field("narrowing", (value.narrowing === null ? token("null") : textRefinementDecision(value.narrowing))),
      field("evidenceIndex", (value.evidenceIndex === null ? token("null") : numeric(value.evidenceIndex))),
      field("demand", textTirDemand(value.demand)),
      field("role", text(value.role)),
      field("construction", textRuleOutcome(value.construction, entry0 => textTypedOperation(entry0))),
    ]);
      case "assignment-pattern":
        return record("TypedConstruction", [
      field("role", text(value.role)),
      field("storage", numericIdentity("t", value.storage)),
      field("parts", sequence(value.parts, entry0 => textConstructionPartDecision(entry0))),
    ]);
    }
  });
}

export function textTypedObjectSpread(value: TypedObjectSpread): TextWork {
  return deferred(value, () => {
    return record("TypedObjectSpread", [
      field("construction", textRuleOutcome(value.construction, entry0 => textTypedOperation(entry0))),
    ]);
  });
}

export function textTypedProperty(value: TypedProperty): TextWork {
  return deferred(value, () => {
    return record("TypedProperty", [
      field("key", textMemberKey(value.key)),
      field("member", textRuleOutcome(value.member, entry0 => textMemberSelection(entry0))),
    ]);
  });
}

export function textTypedShorthand(value: TypedShorthand): TextWork {
  return deferred(value, () => {
    return record("TypedShorthand", [
      field("key", textMemberKey(value.key)),
      field("member", textRuleOutcome(value.member, entry0 => textMemberSelection(entry0))),
    ]);
  });
}

export function textTypedUnary(value: TypedUnary): TextWork {
  return deferred(value, () => {
    return record("TypedUnary", [
      field("type", numericIdentity("t", value.type)),
      field("convertedType", numericIdentity("t", value.convertedType)),
      field("conversion", textConversionDecision(value.conversion)),
      field("narrowing", (value.narrowing === null ? token("null") : textRefinementDecision(value.narrowing))),
      field("evidenceIndex", (value.evidenceIndex === null ? token("null") : numeric(value.evidenceIndex))),
      field("demand", textTirDemand(value.demand)),
      field("operation", textRuleOutcome(value.operation, entry0 => textTypedOperation(entry0))),
    ]);
  });
}

export function textTypedInstantiation(value: TypedInstantiation): TextWork {
  return deferred(value, () => {
    switch (value.role) {
      case "value":
        return record("TypedInstantiation", [
      field("type", numericIdentity("t", value.type)),
      field("convertedType", numericIdentity("t", value.convertedType)),
      field("conversion", textConversionDecision(value.conversion)),
      field("narrowing", (value.narrowing === null ? token("null") : textRefinementDecision(value.narrowing))),
      field("evidenceIndex", (value.evidenceIndex === null ? token("null") : numeric(value.evidenceIndex))),
      field("demand", textTirDemand(value.demand)),
      field("role", text(value.role)),
      field("bindings", textBindingVector(value.bindings)),
      field("application", (value.application === null ? token("null") : textRuleOutcome(value.application, entry0 => textApplicationDecision(entry0)))),
    ]);
      case "heritage":
        return record("TypedInstantiation", [
      field("role", text(value.role)),
      field("type", numericIdentity("t", value.type)),
      field("bindings", textBindingVector(value.bindings)),
      field("declarations", sequence(value.declarations, entry0 => identity("def", entry0))),
    ]);
    }
  });
}
