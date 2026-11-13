import type { DefId, TyId, NodeRef, LocalRef } from "../ids/contract.js";
import type { BindingVector, ExactRational, MemberKey } from "../ir-types/contract.js";
import type { ImportTarget, DeclarationTarget } from "../ir-hir/contract.js";
import type { ApplicationDecision, ClosureDecision, ConstructionPartDecision, RuleOutcome, RefinementDecision } from "../ir-infer/contract.js";
import type { TypedOperation, TirResolution, MemberSelection, TirApplication, TirProtocol, TirSelection, TirDemand, ConversionDecision, TypedName, TypedPropertyKey, TypedString, TypedNumber, TypedBigInt, TypedKeyword, TypedBinary, TypedUnary, TypedPrefix, TypedUpdate, TypedConditional, TargetAccess, TypedMember, TypedApplication, TypedProtocolValue, TypedSpread, TypedObjectSpread, TypedConstruction, TypedTemplate, TypedInstantiation, TypedProperty, TypedShorthand, TypedOmission, TypedIteration, TypedControlTransfer, TypedDecorator, TypedVariableList, TypedCallable, TypedClosure, TypedClass, TypedClassValue } from "../ir-tir/contract.js";
import type { Cursor, RecordFields, TextStep } from "./parse-values.js";
import { delimiter, readString, readNumber, readBigInt, choice, readBoolean, readStringChoice, openRecord, startFieldChoice, closeRecord, readDefinitionId, readTypeId, acceptText, atomicText, fieldText, nullableText, arrayText } from "./parse-values.js";
import { readMemberKeyText, readExactRational, readBindings } from "./parse-types.js";
import { readLocalRef, readNodeRef } from "./parse-diagnostics.js";
import { readDeclarationTargetText, readImportTargetText } from "./parse-core.js";
import { readApplicationDecisionText, readClosureDecisionText, readConstructionPartDecisionText, readRefinementDecisionText, readRuleOutcomeText } from "./parse-inference.js";
import { readConversionDecisionText, readTirDemandText, readTirResolutionText, readTargetAccessText, readTirApplicationText, readTirProtocolText, readTypedOperationText, readTirSelectionText, readMemberSelectionText } from "./parse-tir.js";
import { readTypedCallableText, readTypedClassText } from "./parse-phase-declarations.js";

export function readTypedNameText<Root>(cursor: Cursor, finish: (value: TypedName) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedName"), fields =>
    atomicText(cursor, next => startFieldChoice(next, fields, ["type","role"]), nextField => {
    switch (nextField) {
      case "type":
        return atomicText(cursor, readTypeId, typeValue => fieldText<TyId, Root>(cursor, fields, "convertedType", (next, done) => atomicText(next, readTypeId, done), convertedTypeValue =>
        fieldText<ConversionDecision, Root>(cursor, fields, "conversion", readConversionDecisionText, conversionValue =>
          fieldText<RefinementDecision | null, Root>(cursor, fields, "narrowing", (next, done) => nullableText(next, readRefinementDecisionText, done), narrowingValue =>
            fieldText<number | null, Root>(cursor, fields, "evidenceIndex", (next, done) => nullableText(next, (next, done) => atomicText(next, readNumber, done), done), evidenceIndexValue =>
              fieldText<TirDemand, Root>(cursor, fields, "demand", readTirDemandText, demandValue =>
                fieldText<"value" | "shorthand-value", Root>(cursor, fields, "role", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["value","shorthand-value"]), done), roleValue => {
                  switch (roleValue) {
                    case "value":
                      return fieldText<TirResolution, Root>(cursor, fields, "resolution", readTirResolutionText, resolutionValue =>
                      atomicText(cursor, next => closeRecord(next, fields), () =>
                          acceptText({ type: typeValue, convertedType: convertedTypeValue, conversion: conversionValue, narrowing: narrowingValue, evidenceIndex: evidenceIndexValue, demand: demandValue, role: roleValue, resolution: resolutionValue }, finish)));
                    case "shorthand-value":
                      return fieldText<MemberKey, Root>(cursor, fields, "key", readMemberKeyText, keyValue =>
                      fieldText<TirResolution, Root>(cursor, fields, "resolution", readTirResolutionText, resolutionValue =>
                        atomicText(cursor, next => closeRecord(next, fields), () =>
                            acceptText({ type: typeValue, convertedType: convertedTypeValue, conversion: conversionValue, narrowing: narrowingValue, evidenceIndex: evidenceIndexValue, demand: demandValue, role: roleValue, key: keyValue, resolution: resolutionValue }, finish))));
                  }
                  })))))));
      case "role":
        return atomicText(cursor, next => readStringChoice(next, ["assignment-target","declaration-name","property-name","type-name","label","private-name"]), roleValue => {
          switch (roleValue) {
            case "assignment-target": return fieldText<TirResolution, Root>(cursor, fields, "resolution", readTirResolutionText, resolutionValue =>
              fieldText<TargetAccess, Root>(cursor, fields, "access", readTargetAccessText, accessValue =>
                atomicText(cursor, next => closeRecord(next, fields), () =>
                    acceptText({ role: roleValue, resolution: resolutionValue, access: accessValue }, finish))));
            case "declaration-name": return fieldText<DeclarationTarget, Root>(cursor, fields, "declaration", readDeclarationTargetText, declarationValue =>
              fieldText<TyId | null, Root>(cursor, fields, "storage", (next, done) => nullableText(next, (next, done) => atomicText(next, readTypeId, done), done), storageValue =>
                atomicText(cursor, next => closeRecord(next, fields), () =>
                    acceptText({ role: roleValue, declaration: declarationValue, storage: storageValue }, finish))));
            case "property-name": return fieldText<MemberKey, Root>(cursor, fields, "key", readMemberKeyText, keyValue =>
              atomicText(cursor, next => closeRecord(next, fields), () =>
                  acceptText({ role: roleValue, key: keyValue }, finish)));
            case "type-name": return fieldText<TyId, Root>(cursor, fields, "type", (next, done) => atomicText(next, readTypeId, done), typeValue =>
              fieldText<readonly (DefId)[], Root>(cursor, fields, "declarations", (next, done) => arrayText(next, (next, done) => atomicText(next, readDefinitionId, done), done), declarationsValue =>
                atomicText(cursor, next => closeRecord(next, fields), () =>
                    acceptText({ role: roleValue, type: typeValue, declarations: declarationsValue }, finish))));
            case "label": return fieldText<NodeRef, Root>(cursor, fields, "target", (next, done) => atomicText(next, readNodeRef, done), targetValue =>
              atomicText(cursor, next => closeRecord(next, fields), () =>
                  acceptText({ role: roleValue, target: targetValue }, finish)));
            case "private-name": return fieldText<DefId, Root>(cursor, fields, "declaration", (next, done) => atomicText(next, readDefinitionId, done), declarationValue =>
              atomicText(cursor, next => closeRecord(next, fields), () =>
                  acceptText({ role: roleValue, declaration: declarationValue }, finish)));
          }
        });
    }
    }));
}

export function readTypedPropertyKeyText<Root>(cursor: Cursor, finish: (value: TypedPropertyKey) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["constant","computed"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      switch (label) {
        case "constant":
          return fieldText<MemberKey, Root>(cursor, fields, "key", readMemberKeyText, keyValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, key: keyValue }, finish)));
        case "computed":
          return fieldText<TyId, Root>(cursor, fields, "type", (next, done) => atomicText(next, readTypeId, done), typeValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, type: typeValue }, finish)));
      }
    }));
}

export function readTypedDecoratorText<Root>(cursor: Cursor, finish: (value: TypedDecorator) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedDecorator"), fields =>
    fieldText<RuleOutcome<TirApplication>, Root>(cursor, fields, "application", (next, done) => readRuleOutcomeText(next, readTirApplicationText, done), applicationValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ application: applicationValue }, finish))));
}

export function readTypedIterationText<Root>(cursor: Cursor, finish: (value: TypedIteration) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedIteration"), fields =>
    fieldText<RuleOutcome<TirProtocol>, Root>(cursor, fields, "protocol", (next, done) => readRuleOutcomeText(next, readTirProtocolText, done), protocolValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ protocol: protocolValue }, finish))));
}

export function readTypedControlTransferText<Root>(cursor: Cursor, finish: (value: TypedControlTransfer) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedControlTransfer"), fields =>
    fieldText<NodeRef, Root>(cursor, fields, "target", (next, done) => atomicText(next, readNodeRef, done), targetValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ target: targetValue }, finish))));
}

export function readTypedVariableListText<Root>(cursor: Cursor, finish: (value: TypedVariableList) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedVariableList"), fields =>
    fieldText<"ordinary" | "using", Root>(cursor, fields, "role", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["ordinary","using"]), done), roleValue => {
    switch (roleValue) {
      case "ordinary":
        return atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ role: roleValue }, finish));
      case "using":
        return fieldText<boolean, Root>(cursor, fields, "asynchronous", (next, done) => atomicText(next, readBoolean, done), asynchronousValue =>
        fieldText<readonly (RuleOutcome<TirProtocol>)[], Root>(cursor, fields, "protocols", (next, done) => arrayText(next, (next, done) => readRuleOutcomeText(next, readTirProtocolText, done), done), protocolsValue =>
          atomicText(cursor, next => closeRecord(next, fields), () =>
              acceptText({ role: roleValue, asynchronous: asynchronousValue, protocols: protocolsValue }, finish))));
    }
    }));
}

export function readTypedClassValueText<Root>(cursor: Cursor, finish: (value: TypedClassValue) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedClassValue"), fields =>
    fieldText<TyId, Root>(cursor, fields, "type", (next, done) => atomicText(next, readTypeId, done), typeValue =>
    fieldText<TyId, Root>(cursor, fields, "convertedType", (next, done) => atomicText(next, readTypeId, done), convertedTypeValue =>
      fieldText<ConversionDecision, Root>(cursor, fields, "conversion", readConversionDecisionText, conversionValue =>
        fieldText<RefinementDecision | null, Root>(cursor, fields, "narrowing", (next, done) => nullableText(next, readRefinementDecisionText, done), narrowingValue =>
          fieldText<number | null, Root>(cursor, fields, "evidenceIndex", (next, done) => nullableText(next, (next, done) => atomicText(next, readNumber, done), done), evidenceIndexValue =>
            fieldText<TirDemand, Root>(cursor, fields, "demand", readTirDemandText, demandValue =>
              fieldText<TypedClass, Root>(cursor, fields, "declaration", readTypedClassText, declarationValue =>
                atomicText(cursor, next => closeRecord(next, fields), () =>
                    acceptText({ type: typeValue, convertedType: convertedTypeValue, conversion: conversionValue, narrowing: narrowingValue, evidenceIndex: evidenceIndexValue, demand: demandValue, declaration: declarationValue }, finish))))))))));
}

export function readTypedOmissionText<Root>(cursor: Cursor, finish: (value: TypedOmission) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedOmission"), fields =>
    fieldText<TyId, Root>(cursor, fields, "storage", (next, done) => atomicText(next, readTypeId, done), storageValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ storage: storageValue }, finish))));
}

export function readTypedKeywordText<Root>(cursor: Cursor, finish: (value: TypedKeyword) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedKeyword"), fields =>
    atomicText(cursor, next => startFieldChoice(next, fields, ["type","role"]), nextField => {
    switch (nextField) {
      case "type":
        return atomicText(cursor, readTypeId, typeValue => fieldText<TyId, Root>(cursor, fields, "convertedType", (next, done) => atomicText(next, readTypeId, done), convertedTypeValue =>
        fieldText<ConversionDecision, Root>(cursor, fields, "conversion", readConversionDecisionText, conversionValue =>
          fieldText<RefinementDecision | null, Root>(cursor, fields, "narrowing", (next, done) => nullableText(next, readRefinementDecisionText, done), narrowingValue =>
            fieldText<number | null, Root>(cursor, fields, "evidenceIndex", (next, done) => nullableText(next, (next, done) => atomicText(next, readNumber, done), done), evidenceIndexValue =>
              fieldText<TirDemand, Root>(cursor, fields, "demand", readTirDemandText, demandValue =>
                fieldText<"value" | "receiver" | "super", Root>(cursor, fields, "role", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["value","receiver","super"]), done), roleValue => {
                  switch (roleValue) {
                    case "value":
                      return atomicText(cursor, next => closeRecord(next, fields), () =>
                        acceptText({ type: typeValue, convertedType: convertedTypeValue, conversion: conversionValue, narrowing: narrowingValue, evidenceIndex: evidenceIndexValue, demand: demandValue, role: roleValue }, finish));
                    case "receiver":
                      return fieldText<DefId, Root>(cursor, fields, "owner", (next, done) => atomicText(next, readDefinitionId, done), ownerValue =>
                      atomicText(cursor, next => closeRecord(next, fields), () =>
                          acceptText({ type: typeValue, convertedType: convertedTypeValue, conversion: conversionValue, narrowing: narrowingValue, evidenceIndex: evidenceIndexValue, demand: demandValue, role: roleValue, owner: ownerValue }, finish)));
                    case "super":
                      return fieldText<DefId, Root>(cursor, fields, "owner", (next, done) => atomicText(next, readDefinitionId, done), ownerValue =>
                      fieldText<TyId, Root>(cursor, fields, "base", (next, done) => atomicText(next, readTypeId, done), baseValue =>
                        atomicText(cursor, next => closeRecord(next, fields), () =>
                            acceptText({ type: typeValue, convertedType: convertedTypeValue, conversion: conversionValue, narrowing: narrowingValue, evidenceIndex: evidenceIndexValue, demand: demandValue, role: roleValue, owner: ownerValue, base: baseValue }, finish))));
                  }
                  })))))));
      case "role":
        return atomicText(cursor, next => readStringChoice(next, ["type-literal"]), roleValue => fieldText<TyId, Root>(cursor, fields, "type", (next, done) => atomicText(next, readTypeId, done), typeValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ role: roleValue, type: typeValue }, finish))));
    }
    }));
}

export function readTypedStringText<Root>(cursor: Cursor, finish: (value: TypedString) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedString"), fields =>
    atomicText(cursor, next => startFieldChoice(next, fields, ["type","role"]), nextField => {
    switch (nextField) {
      case "type":
        return atomicText(cursor, readTypeId, typeValue => fieldText<TyId, Root>(cursor, fields, "convertedType", (next, done) => atomicText(next, readTypeId, done), convertedTypeValue =>
        fieldText<ConversionDecision, Root>(cursor, fields, "conversion", readConversionDecisionText, conversionValue =>
          fieldText<RefinementDecision | null, Root>(cursor, fields, "narrowing", (next, done) => nullableText(next, readRefinementDecisionText, done), narrowingValue =>
            fieldText<number | null, Root>(cursor, fields, "evidenceIndex", (next, done) => nullableText(next, (next, done) => atomicText(next, readNumber, done), done), evidenceIndexValue =>
              fieldText<TirDemand, Root>(cursor, fields, "demand", readTirDemandText, demandValue =>
                fieldText<"value", Root>(cursor, fields, "role", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["value"]), done), roleValue =>
                  fieldText<string, Root>(cursor, fields, "value", (next, done) => atomicText(next, readString, done), valueValue =>
                    atomicText(cursor, next => closeRecord(next, fields), () =>
                        acceptText({ type: typeValue, convertedType: convertedTypeValue, conversion: conversionValue, narrowing: narrowingValue, evidenceIndex: evidenceIndexValue, demand: demandValue, role: roleValue, value: valueValue }, finish))))))))));
      case "role":
        return atomicText(cursor, next => readStringChoice(next, ["property-name","declaration-name","type-literal","module-specifier","export-name","attribute-value"]), roleValue => {
          switch (roleValue) {
            case "property-name": return fieldText<MemberKey, Root>(cursor, fields, "key", readMemberKeyText, keyValue =>
              atomicText(cursor, next => closeRecord(next, fields), () =>
                  acceptText({ role: roleValue, key: keyValue }, finish)));
            case "declaration-name": return fieldText<DeclarationTarget, Root>(cursor, fields, "declaration", readDeclarationTargetText, declarationValue =>
              atomicText(cursor, next => closeRecord(next, fields), () =>
                  acceptText({ role: roleValue, declaration: declarationValue }, finish)));
            case "type-literal": return fieldText<TyId, Root>(cursor, fields, "type", (next, done) => atomicText(next, readTypeId, done), typeValue =>
              atomicText(cursor, next => closeRecord(next, fields), () =>
                  acceptText({ role: roleValue, type: typeValue }, finish)));
            case "module-specifier": return fieldText<ImportTarget, Root>(cursor, fields, "target", readImportTargetText, targetValue =>
              atomicText(cursor, next => closeRecord(next, fields), () =>
                  acceptText({ role: roleValue, target: targetValue }, finish)));
            case "export-name": return fieldText<DefId, Root>(cursor, fields, "definition", (next, done) => atomicText(next, readDefinitionId, done), definitionValue =>
              atomicText(cursor, next => closeRecord(next, fields), () =>
                  acceptText({ role: roleValue, definition: definitionValue }, finish)));
            case "attribute-value": return fieldText<string, Root>(cursor, fields, "value", (next, done) => atomicText(next, readString, done), valueValue =>
              atomicText(cursor, next => closeRecord(next, fields), () =>
                  acceptText({ role: roleValue, value: valueValue }, finish)));
          }
        });
    }
    }));
}

export function readTypedNumberText<Root>(cursor: Cursor, finish: (value: TypedNumber) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedNumber"), fields =>
    atomicText(cursor, next => startFieldChoice(next, fields, ["type","role"]), nextField => {
    switch (nextField) {
      case "type":
        return atomicText(cursor, readTypeId, typeValue => fieldText<TyId, Root>(cursor, fields, "convertedType", (next, done) => atomicText(next, readTypeId, done), convertedTypeValue =>
        fieldText<ConversionDecision, Root>(cursor, fields, "conversion", readConversionDecisionText, conversionValue =>
          fieldText<RefinementDecision | null, Root>(cursor, fields, "narrowing", (next, done) => nullableText(next, readRefinementDecisionText, done), narrowingValue =>
            fieldText<number | null, Root>(cursor, fields, "evidenceIndex", (next, done) => nullableText(next, (next, done) => atomicText(next, readNumber, done), done), evidenceIndexValue =>
              fieldText<TirDemand, Root>(cursor, fields, "demand", readTirDemandText, demandValue =>
                fieldText<"value", Root>(cursor, fields, "role", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["value"]), done), roleValue =>
                  fieldText<ExactRational, Root>(cursor, fields, "value", (next, done) => atomicText(next, readExactRational, done), valueValue =>
                    atomicText(cursor, next => closeRecord(next, fields), () =>
                        acceptText({ type: typeValue, convertedType: convertedTypeValue, conversion: conversionValue, narrowing: narrowingValue, evidenceIndex: evidenceIndexValue, demand: demandValue, role: roleValue, value: valueValue }, finish))))))))));
      case "role":
        return atomicText(cursor, next => readStringChoice(next, ["property-name","declaration-name","type-literal"]), roleValue => {
          switch (roleValue) {
            case "property-name": return fieldText<MemberKey, Root>(cursor, fields, "key", readMemberKeyText, keyValue =>
              atomicText(cursor, next => closeRecord(next, fields), () =>
                  acceptText({ role: roleValue, key: keyValue }, finish)));
            case "declaration-name": return fieldText<DeclarationTarget, Root>(cursor, fields, "declaration", readDeclarationTargetText, declarationValue =>
              atomicText(cursor, next => closeRecord(next, fields), () =>
                  acceptText({ role: roleValue, declaration: declarationValue }, finish)));
            case "type-literal": return fieldText<TyId, Root>(cursor, fields, "type", (next, done) => atomicText(next, readTypeId, done), typeValue =>
              atomicText(cursor, next => closeRecord(next, fields), () =>
                  acceptText({ role: roleValue, type: typeValue }, finish)));
          }
        });
    }
    }));
}

export function readTypedBigIntText<Root>(cursor: Cursor, finish: (value: TypedBigInt) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedBigInt"), fields =>
    atomicText(cursor, next => startFieldChoice(next, fields, ["type","role"]), nextField => {
    switch (nextField) {
      case "type":
        return atomicText(cursor, readTypeId, typeValue => fieldText<TyId, Root>(cursor, fields, "convertedType", (next, done) => atomicText(next, readTypeId, done), convertedTypeValue =>
        fieldText<ConversionDecision, Root>(cursor, fields, "conversion", readConversionDecisionText, conversionValue =>
          fieldText<RefinementDecision | null, Root>(cursor, fields, "narrowing", (next, done) => nullableText(next, readRefinementDecisionText, done), narrowingValue =>
            fieldText<number | null, Root>(cursor, fields, "evidenceIndex", (next, done) => nullableText(next, (next, done) => atomicText(next, readNumber, done), done), evidenceIndexValue =>
              fieldText<TirDemand, Root>(cursor, fields, "demand", readTirDemandText, demandValue =>
                fieldText<"value", Root>(cursor, fields, "role", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["value"]), done), roleValue =>
                  fieldText<bigint, Root>(cursor, fields, "value", (next, done) => atomicText(next, readBigInt, done), valueValue =>
                    atomicText(cursor, next => closeRecord(next, fields), () =>
                        acceptText({ type: typeValue, convertedType: convertedTypeValue, conversion: conversionValue, narrowing: narrowingValue, evidenceIndex: evidenceIndexValue, demand: demandValue, role: roleValue, value: valueValue }, finish))))))))));
      case "role":
        return atomicText(cursor, next => readStringChoice(next, ["property-name","declaration-name","type-literal"]), roleValue => {
          switch (roleValue) {
            case "property-name": return fieldText<MemberKey, Root>(cursor, fields, "key", readMemberKeyText, keyValue =>
              atomicText(cursor, next => closeRecord(next, fields), () =>
                  acceptText({ role: roleValue, key: keyValue }, finish)));
            case "declaration-name": return fieldText<DeclarationTarget, Root>(cursor, fields, "declaration", readDeclarationTargetText, declarationValue =>
              atomicText(cursor, next => closeRecord(next, fields), () =>
                  acceptText({ role: roleValue, declaration: declarationValue }, finish)));
            case "type-literal": return fieldText<TyId, Root>(cursor, fields, "type", (next, done) => atomicText(next, readTypeId, done), typeValue =>
              atomicText(cursor, next => closeRecord(next, fields), () =>
                  acceptText({ role: roleValue, type: typeValue }, finish)));
          }
        });
    }
    }));
}

export function readTypedBinaryText<Root>(cursor: Cursor, finish: (value: TypedBinary) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedBinary"), fields =>
    fieldText<TyId, Root>(cursor, fields, "type", (next, done) => atomicText(next, readTypeId, done), typeValue =>
    fieldText<TyId, Root>(cursor, fields, "convertedType", (next, done) => atomicText(next, readTypeId, done), convertedTypeValue =>
      fieldText<ConversionDecision, Root>(cursor, fields, "conversion", readConversionDecisionText, conversionValue =>
        fieldText<RefinementDecision | null, Root>(cursor, fields, "narrowing", (next, done) => nullableText(next, readRefinementDecisionText, done), narrowingValue =>
          fieldText<number | null, Root>(cursor, fields, "evidenceIndex", (next, done) => nullableText(next, (next, done) => atomicText(next, readNumber, done), done), evidenceIndexValue =>
            fieldText<TirDemand, Root>(cursor, fields, "demand", readTirDemandText, demandValue =>
              fieldText<"arithmetic" | "comparison" | "short-circuit" | "assignment" | "sequence", Root>(cursor, fields, "role", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["arithmetic","comparison","short-circuit","assignment","sequence"]), done), roleValue => {
                switch (roleValue) {
                  case "arithmetic":
                  case "comparison":
                    return fieldText<RuleOutcome<TypedOperation>, Root>(cursor, fields, "operation", (next, done) => readRuleOutcomeText(next, readTypedOperationText, done), operationValue =>
                    atomicText(cursor, next => closeRecord(next, fields), () =>
                        acceptText({ type: typeValue, convertedType: convertedTypeValue, conversion: conversionValue, narrowing: narrowingValue, evidenceIndex: evidenceIndexValue, demand: demandValue, role: roleValue, operation: operationValue }, finish)));
                  case "short-circuit":
                    return fieldText<TirSelection, Root>(cursor, fields, "selection", readTirSelectionText, selectionValue =>
                    atomicText(cursor, next => closeRecord(next, fields), () =>
                        acceptText({ type: typeValue, convertedType: convertedTypeValue, conversion: conversionValue, narrowing: narrowingValue, evidenceIndex: evidenceIndexValue, demand: demandValue, role: roleValue, selection: selectionValue }, finish)));
                  case "assignment":
                    return fieldText<TyId, Root>(cursor, fields, "storage", (next, done) => atomicText(next, readTypeId, done), storageValue =>
                    fieldText<RuleOutcome<TypedOperation> | null, Root>(cursor, fields, "calculation", (next, done) => nullableText(next, (next, done) => readRuleOutcomeText(next, readTypedOperationText, done), done), calculationValue =>
                      fieldText<TirSelection | null, Root>(cursor, fields, "selection", (next, done) => nullableText(next, readTirSelectionText, done), selectionValue =>
                        atomicText(cursor, next => closeRecord(next, fields), () =>
                            acceptText({ type: typeValue, convertedType: convertedTypeValue, conversion: conversionValue, narrowing: narrowingValue, evidenceIndex: evidenceIndexValue, demand: demandValue, role: roleValue, storage: storageValue, calculation: calculationValue, selection: selectionValue }, finish)))));
                  case "sequence":
                    return atomicText(cursor, next => closeRecord(next, fields), () =>
                      acceptText({ type: typeValue, convertedType: convertedTypeValue, conversion: conversionValue, narrowing: narrowingValue, evidenceIndex: evidenceIndexValue, demand: demandValue, role: roleValue }, finish));
                }
                }))))))));
}

export function readTypedPrefixText<Root>(cursor: Cursor, finish: (value: TypedPrefix) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedPrefix"), fields =>
    atomicText(cursor, next => startFieldChoice(next, fields, ["type","role"]), nextField => {
    switch (nextField) {
      case "type":
        return atomicText(cursor, readTypeId, typeValue => fieldText<TyId, Root>(cursor, fields, "convertedType", (next, done) => atomicText(next, readTypeId, done), convertedTypeValue =>
        fieldText<ConversionDecision, Root>(cursor, fields, "conversion", readConversionDecisionText, conversionValue =>
          fieldText<RefinementDecision | null, Root>(cursor, fields, "narrowing", (next, done) => nullableText(next, readRefinementDecisionText, done), narrowingValue =>
            fieldText<number | null, Root>(cursor, fields, "evidenceIndex", (next, done) => nullableText(next, (next, done) => atomicText(next, readNumber, done), done), evidenceIndexValue =>
              fieldText<TirDemand, Root>(cursor, fields, "demand", readTirDemandText, demandValue =>
                fieldText<"value" | "update", Root>(cursor, fields, "role", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["value","update"]), done), roleValue => {
                  switch (roleValue) {
                    case "value":
                      return fieldText<RuleOutcome<TypedOperation>, Root>(cursor, fields, "operation", (next, done) => readRuleOutcomeText(next, readTypedOperationText, done), operationValue =>
                      atomicText(cursor, next => closeRecord(next, fields), () =>
                          acceptText({ type: typeValue, convertedType: convertedTypeValue, conversion: conversionValue, narrowing: narrowingValue, evidenceIndex: evidenceIndexValue, demand: demandValue, role: roleValue, operation: operationValue }, finish)));
                    case "update":
                      return fieldText<TyId, Root>(cursor, fields, "storage", (next, done) => atomicText(next, readTypeId, done), storageValue =>
                      fieldText<RuleOutcome<TypedOperation>, Root>(cursor, fields, "operation", (next, done) => readRuleOutcomeText(next, readTypedOperationText, done), operationValue =>
                        atomicText(cursor, next => closeRecord(next, fields), () =>
                            acceptText({ type: typeValue, convertedType: convertedTypeValue, conversion: conversionValue, narrowing: narrowingValue, evidenceIndex: evidenceIndexValue, demand: demandValue, role: roleValue, storage: storageValue, operation: operationValue }, finish))));
                  }
                  })))))));
      case "role":
        return atomicText(cursor, next => readStringChoice(next, ["type-literal"]), roleValue => fieldText<TyId, Root>(cursor, fields, "type", (next, done) => atomicText(next, readTypeId, done), typeValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ role: roleValue, type: typeValue }, finish))));
    }
    }));
}

export function readTypedUpdateText<Root>(cursor: Cursor, finish: (value: TypedUpdate) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedUpdate"), fields =>
    fieldText<TyId, Root>(cursor, fields, "type", (next, done) => atomicText(next, readTypeId, done), typeValue =>
    fieldText<TyId, Root>(cursor, fields, "convertedType", (next, done) => atomicText(next, readTypeId, done), convertedTypeValue =>
      fieldText<ConversionDecision, Root>(cursor, fields, "conversion", readConversionDecisionText, conversionValue =>
        fieldText<RefinementDecision | null, Root>(cursor, fields, "narrowing", (next, done) => nullableText(next, readRefinementDecisionText, done), narrowingValue =>
          fieldText<number | null, Root>(cursor, fields, "evidenceIndex", (next, done) => nullableText(next, (next, done) => atomicText(next, readNumber, done), done), evidenceIndexValue =>
            fieldText<TirDemand, Root>(cursor, fields, "demand", readTirDemandText, demandValue =>
              fieldText<TyId, Root>(cursor, fields, "storage", (next, done) => atomicText(next, readTypeId, done), storageValue =>
                fieldText<RuleOutcome<TypedOperation>, Root>(cursor, fields, "operation", (next, done) => readRuleOutcomeText(next, readTypedOperationText, done), operationValue =>
                  atomicText(cursor, next => closeRecord(next, fields), () =>
                      acceptText({ type: typeValue, convertedType: convertedTypeValue, conversion: conversionValue, narrowing: narrowingValue, evidenceIndex: evidenceIndexValue, demand: demandValue, storage: storageValue, operation: operationValue }, finish)))))))))));
}

export function readTypedProtocolValueText<Root>(cursor: Cursor, finish: (value: TypedProtocolValue) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedProtocolValue"), fields =>
    fieldText<TyId, Root>(cursor, fields, "type", (next, done) => atomicText(next, readTypeId, done), typeValue =>
    fieldText<TyId, Root>(cursor, fields, "convertedType", (next, done) => atomicText(next, readTypeId, done), convertedTypeValue =>
      fieldText<ConversionDecision, Root>(cursor, fields, "conversion", readConversionDecisionText, conversionValue =>
        fieldText<RefinementDecision | null, Root>(cursor, fields, "narrowing", (next, done) => nullableText(next, readRefinementDecisionText, done), narrowingValue =>
          fieldText<number | null, Root>(cursor, fields, "evidenceIndex", (next, done) => nullableText(next, (next, done) => atomicText(next, readNumber, done), done), evidenceIndexValue =>
            fieldText<TirDemand, Root>(cursor, fields, "demand", readTirDemandText, demandValue =>
              fieldText<RuleOutcome<TirProtocol>, Root>(cursor, fields, "protocol", (next, done) => readRuleOutcomeText(next, readTirProtocolText, done), protocolValue =>
                atomicText(cursor, next => closeRecord(next, fields), () =>
                    acceptText({ type: typeValue, convertedType: convertedTypeValue, conversion: conversionValue, narrowing: narrowingValue, evidenceIndex: evidenceIndexValue, demand: demandValue, protocol: protocolValue }, finish))))))))));
}

export function readTypedClosureText<Root>(cursor: Cursor, finish: (value: TypedClosure) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedClosure"), fields =>
    fieldText<TyId, Root>(cursor, fields, "type", (next, done) => atomicText(next, readTypeId, done), typeValue =>
    fieldText<TyId, Root>(cursor, fields, "convertedType", (next, done) => atomicText(next, readTypeId, done), convertedTypeValue =>
      fieldText<ConversionDecision, Root>(cursor, fields, "conversion", readConversionDecisionText, conversionValue =>
        fieldText<RefinementDecision | null, Root>(cursor, fields, "narrowing", (next, done) => nullableText(next, readRefinementDecisionText, done), narrowingValue =>
          fieldText<number | null, Root>(cursor, fields, "evidenceIndex", (next, done) => nullableText(next, (next, done) => atomicText(next, readNumber, done), done), evidenceIndexValue =>
            fieldText<TirDemand, Root>(cursor, fields, "demand", readTirDemandText, demandValue =>
              fieldText<TypedCallable, Root>(cursor, fields, "callable", readTypedCallableText, callableValue =>
                fieldText<readonly (LocalRef)[], Root>(cursor, fields, "captures", (next, done) => arrayText(next, (next, done) => atomicText(next, readLocalRef, done), done), capturesValue =>
                  fieldText<RuleOutcome<ClosureDecision>, Root>(cursor, fields, "closure", (next, done) => readRuleOutcomeText(next, readClosureDecisionText, done), closureValue =>
                    atomicText(cursor, next => closeRecord(next, fields), () =>
                        acceptText({ type: typeValue, convertedType: convertedTypeValue, conversion: conversionValue, narrowing: narrowingValue, evidenceIndex: evidenceIndexValue, demand: demandValue, callable: callableValue, captures: capturesValue, closure: closureValue }, finish))))))))))));
}

export function readTypedConditionalText<Root>(cursor: Cursor, finish: (value: TypedConditional) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedConditional"), fields =>
    fieldText<TyId, Root>(cursor, fields, "type", (next, done) => atomicText(next, readTypeId, done), typeValue =>
    fieldText<TyId, Root>(cursor, fields, "convertedType", (next, done) => atomicText(next, readTypeId, done), convertedTypeValue =>
      fieldText<ConversionDecision, Root>(cursor, fields, "conversion", readConversionDecisionText, conversionValue =>
        fieldText<RefinementDecision | null, Root>(cursor, fields, "narrowing", (next, done) => nullableText(next, readRefinementDecisionText, done), narrowingValue =>
          fieldText<number | null, Root>(cursor, fields, "evidenceIndex", (next, done) => nullableText(next, (next, done) => atomicText(next, readNumber, done), done), evidenceIndexValue =>
            fieldText<TirDemand, Root>(cursor, fields, "demand", readTirDemandText, demandValue =>
              fieldText<TirSelection, Root>(cursor, fields, "selection", readTirSelectionText, selectionValue =>
                atomicText(cursor, next => closeRecord(next, fields), () =>
                    acceptText({ type: typeValue, convertedType: convertedTypeValue, conversion: conversionValue, narrowing: narrowingValue, evidenceIndex: evidenceIndexValue, demand: demandValue, selection: selectionValue }, finish))))))))));
}

export function readTypedMemberText<Root>(cursor: Cursor, finish: (value: TypedMember) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedMember"), fields =>
    atomicText(cursor, next => startFieldChoice(next, fields, ["type","role"]), nextField => {
    switch (nextField) {
      case "type":
        return atomicText(cursor, readTypeId, typeValue => fieldText<TyId, Root>(cursor, fields, "convertedType", (next, done) => atomicText(next, readTypeId, done), convertedTypeValue =>
        fieldText<ConversionDecision, Root>(cursor, fields, "conversion", readConversionDecisionText, conversionValue =>
          fieldText<RefinementDecision | null, Root>(cursor, fields, "narrowing", (next, done) => nullableText(next, readRefinementDecisionText, done), narrowingValue =>
            fieldText<number | null, Root>(cursor, fields, "evidenceIndex", (next, done) => nullableText(next, (next, done) => atomicText(next, readNumber, done), done), evidenceIndexValue =>
              fieldText<TirDemand, Root>(cursor, fields, "demand", readTirDemandText, demandValue =>
                fieldText<"value", Root>(cursor, fields, "role", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["value"]), done), roleValue =>
                  fieldText<RuleOutcome<MemberSelection>, Root>(cursor, fields, "selection", (next, done) => readRuleOutcomeText(next, readMemberSelectionText, done), selectionValue =>
                    atomicText(cursor, next => closeRecord(next, fields), () =>
                        acceptText({ type: typeValue, convertedType: convertedTypeValue, conversion: conversionValue, narrowing: narrowingValue, evidenceIndex: evidenceIndexValue, demand: demandValue, role: roleValue, selection: selectionValue }, finish))))))))));
      case "role":
        return atomicText(cursor, next => readStringChoice(next, ["assignment-target"]), roleValue => fieldText<RuleOutcome<MemberSelection>, Root>(cursor, fields, "selection", (next, done) => readRuleOutcomeText(next, readMemberSelectionText, done), selectionValue =>
        fieldText<TargetAccess, Root>(cursor, fields, "access", readTargetAccessText, accessValue =>
          atomicText(cursor, next => closeRecord(next, fields), () =>
              acceptText({ role: roleValue, selection: selectionValue, access: accessValue }, finish)))));
    }
    }));
}

export function readTypedApplicationText<Root>(cursor: Cursor, finish: (value: TypedApplication) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedApplication"), fields =>
    fieldText<TyId, Root>(cursor, fields, "type", (next, done) => atomicText(next, readTypeId, done), typeValue =>
    fieldText<TyId, Root>(cursor, fields, "convertedType", (next, done) => atomicText(next, readTypeId, done), convertedTypeValue =>
      fieldText<ConversionDecision, Root>(cursor, fields, "conversion", readConversionDecisionText, conversionValue =>
        fieldText<RefinementDecision | null, Root>(cursor, fields, "narrowing", (next, done) => nullableText(next, readRefinementDecisionText, done), narrowingValue =>
          fieldText<number | null, Root>(cursor, fields, "evidenceIndex", (next, done) => nullableText(next, (next, done) => atomicText(next, readNumber, done), done), evidenceIndexValue =>
            fieldText<TirDemand, Root>(cursor, fields, "demand", readTirDemandText, demandValue =>
              fieldText<RuleOutcome<TirApplication>, Root>(cursor, fields, "application", (next, done) => readRuleOutcomeText(next, readTirApplicationText, done), applicationValue =>
                fieldText<RuleOutcome<TypedOperation> | null, Root>(cursor, fields, "operation", (next, done) => nullableText(next, (next, done) => readRuleOutcomeText(next, readTypedOperationText, done), done), operationValue =>
                  atomicText(cursor, next => closeRecord(next, fields), () =>
                      acceptText({ type: typeValue, convertedType: convertedTypeValue, conversion: conversionValue, narrowing: narrowingValue, evidenceIndex: evidenceIndexValue, demand: demandValue, application: applicationValue, operation: operationValue }, finish)))))))))));
}

export function readTypedSpreadText<Root>(cursor: Cursor, finish: (value: TypedSpread) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedSpread"), fields =>
    fieldText<TyId, Root>(cursor, fields, "type", (next, done) => atomicText(next, readTypeId, done), typeValue =>
    fieldText<TyId, Root>(cursor, fields, "convertedType", (next, done) => atomicText(next, readTypeId, done), convertedTypeValue =>
      fieldText<ConversionDecision, Root>(cursor, fields, "conversion", readConversionDecisionText, conversionValue =>
        fieldText<RefinementDecision | null, Root>(cursor, fields, "narrowing", (next, done) => nullableText(next, readRefinementDecisionText, done), narrowingValue =>
          fieldText<number | null, Root>(cursor, fields, "evidenceIndex", (next, done) => nullableText(next, (next, done) => atomicText(next, readNumber, done), done), evidenceIndexValue =>
            fieldText<TirDemand, Root>(cursor, fields, "demand", readTirDemandText, demandValue =>
              fieldText<RuleOutcome<TirProtocol>, Root>(cursor, fields, "protocol", (next, done) => readRuleOutcomeText(next, readTirProtocolText, done), protocolValue =>
                atomicText(cursor, next => closeRecord(next, fields), () =>
                    acceptText({ type: typeValue, convertedType: convertedTypeValue, conversion: conversionValue, narrowing: narrowingValue, evidenceIndex: evidenceIndexValue, demand: demandValue, protocol: protocolValue }, finish))))))))));
}

export function readTypedTemplateText<Root>(cursor: Cursor, finish: (value: TypedTemplate) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedTemplate"), fields =>
    fieldText<TyId, Root>(cursor, fields, "type", (next, done) => atomicText(next, readTypeId, done), typeValue =>
    fieldText<TyId, Root>(cursor, fields, "convertedType", (next, done) => atomicText(next, readTypeId, done), convertedTypeValue =>
      fieldText<ConversionDecision, Root>(cursor, fields, "conversion", readConversionDecisionText, conversionValue =>
        fieldText<RefinementDecision | null, Root>(cursor, fields, "narrowing", (next, done) => nullableText(next, readRefinementDecisionText, done), narrowingValue =>
          fieldText<number | null, Root>(cursor, fields, "evidenceIndex", (next, done) => nullableText(next, (next, done) => atomicText(next, readNumber, done), done), evidenceIndexValue =>
            fieldText<TirDemand, Root>(cursor, fields, "demand", readTirDemandText, demandValue =>
              fieldText<RuleOutcome<TypedOperation>, Root>(cursor, fields, "operation", (next, done) => readRuleOutcomeText(next, readTypedOperationText, done), operationValue =>
                atomicText(cursor, next => closeRecord(next, fields), () =>
                    acceptText({ type: typeValue, convertedType: convertedTypeValue, conversion: conversionValue, narrowing: narrowingValue, evidenceIndex: evidenceIndexValue, demand: demandValue, operation: operationValue }, finish))))))))));
}

export function readTypedConstructionText<Root>(cursor: Cursor, finish: (value: TypedConstruction) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedConstruction"), fields =>
    atomicText(cursor, next => startFieldChoice(next, fields, ["type","role"]), nextField => {
    switch (nextField) {
      case "type":
        return atomicText(cursor, readTypeId, typeValue => fieldText<TyId, Root>(cursor, fields, "convertedType", (next, done) => atomicText(next, readTypeId, done), convertedTypeValue =>
        fieldText<ConversionDecision, Root>(cursor, fields, "conversion", readConversionDecisionText, conversionValue =>
          fieldText<RefinementDecision | null, Root>(cursor, fields, "narrowing", (next, done) => nullableText(next, readRefinementDecisionText, done), narrowingValue =>
            fieldText<number | null, Root>(cursor, fields, "evidenceIndex", (next, done) => nullableText(next, (next, done) => atomicText(next, readNumber, done), done), evidenceIndexValue =>
              fieldText<TirDemand, Root>(cursor, fields, "demand", readTirDemandText, demandValue =>
                fieldText<"value", Root>(cursor, fields, "role", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["value"]), done), roleValue =>
                  fieldText<RuleOutcome<TypedOperation>, Root>(cursor, fields, "construction", (next, done) => readRuleOutcomeText(next, readTypedOperationText, done), constructionValue =>
                    atomicText(cursor, next => closeRecord(next, fields), () =>
                        acceptText({ type: typeValue, convertedType: convertedTypeValue, conversion: conversionValue, narrowing: narrowingValue, evidenceIndex: evidenceIndexValue, demand: demandValue, role: roleValue, construction: constructionValue }, finish))))))))));
      case "role":
        return atomicText(cursor, next => readStringChoice(next, ["assignment-pattern"]), roleValue => fieldText<TyId, Root>(cursor, fields, "storage", (next, done) => atomicText(next, readTypeId, done), storageValue =>
        fieldText<readonly (ConstructionPartDecision)[], Root>(cursor, fields, "parts", (next, done) => arrayText(next, readConstructionPartDecisionText, done), partsValue =>
          atomicText(cursor, next => closeRecord(next, fields), () =>
              acceptText({ role: roleValue, storage: storageValue, parts: partsValue }, finish)))));
    }
    }));
}

export function readTypedObjectSpreadText<Root>(cursor: Cursor, finish: (value: TypedObjectSpread) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedObjectSpread"), fields =>
    fieldText<RuleOutcome<TypedOperation>, Root>(cursor, fields, "construction", (next, done) => readRuleOutcomeText(next, readTypedOperationText, done), constructionValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ construction: constructionValue }, finish))));
}

export function readTypedPropertyText<Root>(cursor: Cursor, finish: (value: TypedProperty) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedProperty"), fields =>
    fieldText<MemberKey, Root>(cursor, fields, "key", readMemberKeyText, keyValue =>
    fieldText<RuleOutcome<MemberSelection>, Root>(cursor, fields, "member", (next, done) => readRuleOutcomeText(next, readMemberSelectionText, done), memberValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ key: keyValue, member: memberValue }, finish)))));
}

export function readTypedShorthandText<Root>(cursor: Cursor, finish: (value: TypedShorthand) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedShorthand"), fields =>
    fieldText<MemberKey, Root>(cursor, fields, "key", readMemberKeyText, keyValue =>
    fieldText<RuleOutcome<MemberSelection>, Root>(cursor, fields, "member", (next, done) => readRuleOutcomeText(next, readMemberSelectionText, done), memberValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ key: keyValue, member: memberValue }, finish)))));
}

export function readTypedUnaryText<Root>(cursor: Cursor, finish: (value: TypedUnary) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedUnary"), fields =>
    fieldText<TyId, Root>(cursor, fields, "type", (next, done) => atomicText(next, readTypeId, done), typeValue =>
    fieldText<TyId, Root>(cursor, fields, "convertedType", (next, done) => atomicText(next, readTypeId, done), convertedTypeValue =>
      fieldText<ConversionDecision, Root>(cursor, fields, "conversion", readConversionDecisionText, conversionValue =>
        fieldText<RefinementDecision | null, Root>(cursor, fields, "narrowing", (next, done) => nullableText(next, readRefinementDecisionText, done), narrowingValue =>
          fieldText<number | null, Root>(cursor, fields, "evidenceIndex", (next, done) => nullableText(next, (next, done) => atomicText(next, readNumber, done), done), evidenceIndexValue =>
            fieldText<TirDemand, Root>(cursor, fields, "demand", readTirDemandText, demandValue =>
              fieldText<RuleOutcome<TypedOperation>, Root>(cursor, fields, "operation", (next, done) => readRuleOutcomeText(next, readTypedOperationText, done), operationValue =>
                atomicText(cursor, next => closeRecord(next, fields), () =>
                    acceptText({ type: typeValue, convertedType: convertedTypeValue, conversion: conversionValue, narrowing: narrowingValue, evidenceIndex: evidenceIndexValue, demand: demandValue, operation: operationValue }, finish))))))))));
}

export function readTypedInstantiationText<Root>(cursor: Cursor, finish: (value: TypedInstantiation) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedInstantiation"), fields =>
    atomicText(cursor, next => startFieldChoice(next, fields, ["type","role"]), nextField => {
    switch (nextField) {
      case "type":
        return atomicText(cursor, readTypeId, typeValue => fieldText<TyId, Root>(cursor, fields, "convertedType", (next, done) => atomicText(next, readTypeId, done), convertedTypeValue =>
        fieldText<ConversionDecision, Root>(cursor, fields, "conversion", readConversionDecisionText, conversionValue =>
          fieldText<RefinementDecision | null, Root>(cursor, fields, "narrowing", (next, done) => nullableText(next, readRefinementDecisionText, done), narrowingValue =>
            fieldText<number | null, Root>(cursor, fields, "evidenceIndex", (next, done) => nullableText(next, (next, done) => atomicText(next, readNumber, done), done), evidenceIndexValue =>
              fieldText<TirDemand, Root>(cursor, fields, "demand", readTirDemandText, demandValue =>
                fieldText<"value", Root>(cursor, fields, "role", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["value"]), done), roleValue =>
                  fieldText<BindingVector, Root>(cursor, fields, "bindings", (next, done) => atomicText(next, readBindings, done), bindingsValue =>
                    fieldText<RuleOutcome<ApplicationDecision> | null, Root>(cursor, fields, "application", (next, done) => nullableText(next, (next, done) => readRuleOutcomeText(next, readApplicationDecisionText, done), done), applicationValue =>
                      atomicText(cursor, next => closeRecord(next, fields), () =>
                          acceptText({ type: typeValue, convertedType: convertedTypeValue, conversion: conversionValue, narrowing: narrowingValue, evidenceIndex: evidenceIndexValue, demand: demandValue, role: roleValue, bindings: bindingsValue, application: applicationValue }, finish)))))))))));
      case "role":
        return atomicText(cursor, next => readStringChoice(next, ["heritage"]), roleValue => fieldText<TyId, Root>(cursor, fields, "type", (next, done) => atomicText(next, readTypeId, done), typeValue =>
        fieldText<BindingVector, Root>(cursor, fields, "bindings", (next, done) => atomicText(next, readBindings, done), bindingsValue =>
          fieldText<readonly (DefId)[], Root>(cursor, fields, "declarations", (next, done) => arrayText(next, (next, done) => atomicText(next, readDefinitionId, done), done), declarationsValue =>
            atomicText(cursor, next => closeRecord(next, fields), () =>
                acceptText({ role: roleValue, type: typeValue, bindings: bindingsValue, declarations: declarationsValue }, finish))))));
    }
    }));
}
