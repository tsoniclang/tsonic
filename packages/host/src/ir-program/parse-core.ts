import type { ModuleId, DefId, BodyId, NodeId, NodeRef, TyId, SigId, LibraryModuleIdentity, SourceNodeRef, LocalRef } from "../ids/contract.js";
import type { BindingVector, PassingMode, TypeComponent } from "../ir-types/contract.js";
import type { CapturedFact, ImportTarget, HirAttribute, HirCallableEndpoint, HirCapturedType, HirFieldMarkerCapture, HirMarkersCapture, HirPointerTypeCapture, HirIntegerOperandCapture, HirAddressIntegerCapture, HirPointerOperationCapture, HirAttributeCapture, HirSafetySelectionCapture, HirSafetyCapture, HirArgumentPassingCapture, HirCoreCapture, DeclarationTarget, HirLexicalScope, HirFieldBindingCapture, HirRecordBindingCapture, HirRecordFieldBindingCapture } from "../ir-hir/contract.js";
import type { Cursor, RecordFields, TextStep, TextReader } from "./parse-values.js";
import { delimiter, readString, choice, readBoolean, readStringChoice, readSignatureId, readNumberChoice, openRecord, closeRecord, readModuleId, readDefinitionId, readBodyId, readTypeId, readNodeId, acceptText, atomicText, fieldText, nullableText, arrayText } from "./parse-values.js";
import { readBindings, readTypeComponentText } from "./parse-types.js";
import { readNodeRef, readSourceNodeRef, readLocalRef, readLibraryModuleIdentity } from "./parse-diagnostics.js";

export function readHirCallableEndpointText<Root>(cursor: Cursor, finish: (value: HirCallableEndpoint) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "HirCallableEndpoint"), fields =>
    fieldText<DefId, Root>(cursor, fields, "declaration", (next, done) => atomicText(next, readDefinitionId, done), declarationValue =>
    fieldText<"advertised" | "api-signature" | "api-body", Root>(cursor, fields, "role", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["advertised","api-signature","api-body"]), done), roleValue =>
      fieldText<SigId, Root>(cursor, fields, "signature", (next, done) => atomicText(next, readSignatureId, done), signatureValue =>
        fieldText<BodyId | null, Root>(cursor, fields, "body", (next, done) => nullableText(next, (next, done) => atomicText(next, readBodyId, done), done), bodyValue =>
          atomicText(cursor, next => closeRecord(next, fields), () =>
              acceptText({ declaration: declarationValue, role: roleValue, signature: signatureValue, body: bodyValue }, finish)))))));
}

export function readHirCoreCaptureText<Root>(cursor: Cursor, finish: (value: HirCoreCapture) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "HirCoreCapture"), fields =>
    fieldText<CapturedFact<DefId | null>, Root>(cursor, fields, "provider", (next, done) => readCapturedFactText(next, (next, done) => nullableText(next, (next, done) => atomicText(next, readDefinitionId, done), done), done), providerValue =>
    fieldText<CapturedFact<HirMarkersCapture>, Root>(cursor, fields, "markers", (next, done) => readCapturedFactText(next, readHirMarkersCaptureText, done), markersValue =>
      fieldText<CapturedFact<HirPointerTypeCapture | null>, Root>(cursor, fields, "pointerType", (next, done) => readCapturedFactText(next, (next, done) => nullableText(next, readHirPointerTypeCaptureText, done), done), pointerTypeValue =>
        fieldText<CapturedFact<HirPointerOperationCapture | null>, Root>(cursor, fields, "pointerOperation", (next, done) => readCapturedFactText(next, (next, done) => nullableText(next, readHirPointerOperationCaptureText, done), done), pointerOperationValue =>
          fieldText<CapturedFact<HirFieldBindingCapture | null>, Root>(cursor, fields, "fieldBinding", (next, done) => readCapturedFactText(next, (next, done) => nullableText(next, readHirFieldBindingCaptureText, done), done), fieldBindingValue =>
          fieldText<CapturedFact<HirRecordBindingCapture | null>, Root>(cursor, fields, "recordBinding", (next, done) => readCapturedFactText(next, (next, done) => nullableText(next, readHirRecordBindingCaptureText, done), done), recordBindingValue =>
          fieldText<CapturedFact<HirAttributeCapture | null>, Root>(cursor, fields, "attribute", (next, done) => readCapturedFactText(next, (next, done) => nullableText(next, readHirAttributeCaptureText, done), done), attributeValue =>
            fieldText<CapturedFact<HirSafetyCapture | null>, Root>(cursor, fields, "safety", (next, done) => readCapturedFactText(next, (next, done) => nullableText(next, readHirSafetyCaptureText, done), done), safetyValue =>
              fieldText<CapturedFact<HirArgumentPassingCapture | null>, Root>(cursor, fields, "argumentPassing", (next, done) => readCapturedFactText(next, (next, done) => nullableText(next, readHirArgumentPassingCaptureText, done), done), argumentPassingValue =>
                fieldText<CapturedFact<"moved" | "borrowed-shared" | "borrowed-mut" | null>, Root>(cursor, fields, "flowState", (next, done) => readCapturedFactText(next, (next, done) => nullableText(next, (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["moved","borrowed-shared","borrowed-mut"]), done), done), done), flowStateValue =>
                  atomicText(cursor, next => closeRecord(next, fields), () =>
                      acceptText({ provider: providerValue, markers: markersValue, pointerType: pointerTypeValue, pointerOperation: pointerOperationValue, fieldBinding: fieldBindingValue, recordBinding: recordBindingValue, attribute: attributeValue, safety: safetyValue, argumentPassing: argumentPassingValue, flowState: flowStateValue }, finish)))))))))))));
}

export function readHirFieldBindingCaptureText<Root>(cursor: Cursor, finish: (value: HirFieldBindingCapture) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "HirFieldBindingCapture"), fields =>
    fieldText<NodeRef, Root>(cursor, fields, "occurrence", (next, done) => atomicText(next, readNodeRef, done), occurrenceValue =>
    fieldText<CapturedFact<BindingVector>, Root>(cursor, fields, "bindings", (next, done) => readCapturedFactText(next, (next, done) => atomicText(next, readBindings, done), done), bindingsValue =>
      fieldText<CapturedFact<TyId>, Root>(cursor, fields, "owner", (next, done) => readCapturedFactText(next, (next, done) => atomicText(next, readTypeId, done), done), ownerValue =>
        fieldText<CapturedFact<TyId>, Root>(cursor, fields, "pointee", (next, done) => readCapturedFactText(next, (next, done) => atomicText(next, readTypeId, done), done), pointeeValue =>
          fieldText<NodeRef, Root>(cursor, fields, "fieldExpression", (next, done) => atomicText(next, readNodeRef, done), fieldExpressionValue =>
            fieldText<CapturedFact<SourceNodeRef>, Root>(cursor, fields, "field", (next, done) => readCapturedFactText(next, (next, done) => atomicText(next, readSourceNodeRef, done), done), fieldValue =>
              fieldText<NodeRef, Root>(cursor, fields, "pointerExpression", (next, done) => atomicText(next, readNodeRef, done), pointerExpressionValue =>
                atomicText(cursor, next => closeRecord(next, fields), () =>
                    acceptText({ occurrence: occurrenceValue, bindings: bindingsValue, owner: ownerValue, pointee: pointeeValue, fieldExpression: fieldExpressionValue, field: fieldValue, pointerExpression: pointerExpressionValue }, finish))))))))));
}

function readHirRecordFieldBindingCaptureText<Root>(cursor: Cursor, finish: (value: HirRecordFieldBindingCapture) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "HirRecordFieldBindingCapture"), fields =>
    fieldText<NodeRef, Root>(cursor, fields, "expression", (next, done) => atomicText(next, readNodeRef, done), expressionValue =>
    fieldText<NodeRef, Root>(cursor, fields, "binding", (next, done) => atomicText(next, readNodeRef, done), bindingValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ expression: expressionValue, binding: bindingValue }, finish)))));
}

export function readHirRecordBindingCaptureText<Root>(cursor: Cursor, finish: (value: HirRecordBindingCapture) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "HirRecordBindingCapture"), fields =>
    fieldText<NodeRef, Root>(cursor, fields, "occurrence", (next, done) => atomicText(next, readNodeRef, done), occurrenceValue =>
    fieldText<CapturedFact<BindingVector>, Root>(cursor, fields, "bindings", (next, done) => readCapturedFactText(next, (next, done) => atomicText(next, readBindings, done), done), bindingsValue =>
      fieldText<CapturedFact<TyId>, Root>(cursor, fields, "source", (next, done) => readCapturedFactText(next, (next, done) => atomicText(next, readTypeId, done), done), sourceValue =>
        fieldText<NodeRef, Root>(cursor, fields, "layoutExpression", (next, done) => atomicText(next, readNodeRef, done), layoutExpressionValue =>
          fieldText<CapturedFact<SourceNodeRef>, Root>(cursor, fields, "layout", (next, done) => readCapturedFactText(next, (next, done) => atomicText(next, readSourceNodeRef, done), done), layoutValue =>
            fieldText<readonly (HirRecordFieldBindingCapture)[], Root>(cursor, fields, "fields", (next, done) => arrayText(next, readHirRecordFieldBindingCaptureText, done), fieldsValue =>
              atomicText(cursor, next => closeRecord(next, fields), () =>
                  acceptText({ occurrence: occurrenceValue, bindings: bindingsValue, source: sourceValue, layoutExpression: layoutExpressionValue, layout: layoutValue, fields: fieldsValue }, finish)))))))));
}

export function readHirAttributeText<Root>(cursor: Cursor, finish: (value: HirAttribute) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "HirAttribute"), fields =>
    fieldText<DefId, Root>(cursor, fields, "declaration", (next, done) => atomicText(next, readDefinitionId, done), declarationValue =>
    fieldText<SourceNodeRef, Root>(cursor, fields, "occurrence", (next, done) => atomicText(next, readSourceNodeRef, done), occurrenceValue =>
      fieldText<readonly (SourceNodeRef)[], Root>(cursor, fields, "arguments", (next, done) => arrayText(next, (next, done) => atomicText(next, readSourceNodeRef, done), done), argumentsValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ declaration: declarationValue, occurrence: occurrenceValue, arguments: argumentsValue }, finish))))));
}

export function readHirLexicalScopeText<Root>(cursor: Cursor, finish: (value: HirLexicalScope) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "HirLexicalScope"), fields =>
    fieldText<NodeId, Root>(cursor, fields, "node", (next, done) => atomicText(next, readNodeId, done), nodeValue =>
    fieldText<NodeId | null, Root>(cursor, fields, "parent", (next, done) => nullableText(next, (next, done) => atomicText(next, readNodeId, done), done), parentValue =>
      fieldText<readonly (HirAttribute)[], Root>(cursor, fields, "attributes", (next, done) => arrayText(next, readHirAttributeText, done), attributesValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ node: nodeValue, parent: parentValue, attributes: attributesValue }, finish))))));
}

export function readCapturedFactText<Value, Root>(cursor: Cursor, readValue: TextReader<Value>, finish: (value: CapturedFact<Value>) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["available","unavailable"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      switch (label) {
        case "available":
          return fieldText<Value, Root>(cursor, fields, "value", readValue, valueValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, value: valueValue }, finish)));
        case "unavailable":
          return fieldText<"checker-error" | "parameter-dependent" | "not-provided" | "missing-original-component" | "incomplete-association" | "unsupported-checked-structure", Root>(cursor, fields, "reason", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["checker-error","parameter-dependent","not-provided","missing-original-component","incomplete-association","unsupported-checked-structure"]), done), reasonValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, reason: reasonValue }, finish)));
      }
    }));
}

export function readHirMarkersCaptureText<Root>(cursor: Cursor, finish: (value: HirMarkersCapture) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "HirMarkersCapture"), fields =>
    fieldText<{ readonly valueType: boolean; readonly fields: CapturedFact<readonly (HirFieldMarkerCapture)[]> } | null, Root>(cursor, fields, "struct", (next, done) => nullableText(next, (<NextRoot>(next: Cursor, done: (value: { readonly valueType: boolean; readonly fields: CapturedFact<readonly (HirFieldMarkerCapture)[]> }) => TextStep<NextRoot>) => atomicText(next, cursor => openRecord(cursor, "Record"), fields => fieldText<boolean, NextRoot>(next, fields, "valueType", (next, done) => atomicText(next, readBoolean, done), valueTypeValue =>
    fieldText<CapturedFact<readonly (HirFieldMarkerCapture)[]>, NextRoot>(next, fields, "fields", (next, done) => readCapturedFactText(next, (next, done) => arrayText(next, readHirFieldMarkerCaptureText, done), done), fieldsValue =>
      atomicText(next, next => closeRecord(next, fields), () =>
          acceptText({ valueType: valueTypeValue, fields: fieldsValue }, done)))))), done), structValue =>
    fieldText<HirFieldMarkerCapture | null, Root>(cursor, fields, "field", (next, done) => nullableText(next, readHirFieldMarkerCaptureText, done), fieldValue =>
      fieldText<{ readonly typeNode: SourceNodeRef; readonly type: CapturedFact<TyId> } | null, Root>(cursor, fields, "defaultValue", (next, done) => nullableText(next, (<NextRoot>(next: Cursor, done: (value: { readonly typeNode: SourceNodeRef; readonly type: CapturedFact<TyId> }) => TextStep<NextRoot>) => atomicText(next, cursor => openRecord(cursor, "Record"), fields => fieldText<SourceNodeRef, NextRoot>(next, fields, "typeNode", (next, done) => atomicText(next, readSourceNodeRef, done), typeNodeValue =>
    fieldText<CapturedFact<TyId>, NextRoot>(next, fields, "type", (next, done) => readCapturedFactText(next, (next, done) => atomicText(next, readTypeId, done), done), typeValue =>
      atomicText(next, next => closeRecord(next, fields), () =>
          acceptText({ typeNode: typeNodeValue, type: typeValue }, done)))))), done), defaultValueValue =>
        fieldText<boolean, Root>(cursor, fields, "jsString", (next, done) => atomicText(next, readBoolean, done), jsStringValue =>
          atomicText(cursor, next => closeRecord(next, fields), () =>
              acceptText({ struct: structValue, field: fieldValue, defaultValue: defaultValueValue, jsString: jsStringValue }, finish)))))));
}

export function readHirPointerTypeCaptureText<Root>(cursor: Cursor, finish: (value: HirPointerTypeCapture) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["raw-address","typed-location","native-pointer","function-pointer"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      switch (label) {
        case "raw-address":
          return atomicText(cursor, next => closeRecord(next, fields), () =>
      acceptText({ kind: label }, finish));
        case "typed-location":
          return fieldText<HirCapturedType, Root>(cursor, fields, "pointee", readHirCapturedTypeText, pointeeValue =>
    fieldText<"readonly" | "readwrite" | "unspecified", Root>(cursor, fields, "mutability", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["readonly","readwrite","unspecified"]), done), mutabilityValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ kind: label, pointee: pointeeValue, mutability: mutabilityValue }, finish))));
        case "native-pointer":
          return fieldText<DefId, Root>(cursor, fields, "declaration", (next, done) => atomicText(next, readDefinitionId, done), declarationValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, declaration: declarationValue }, finish)));
        case "function-pointer":
          return fieldText<DefId, Root>(cursor, fields, "declaration", (next, done) => atomicText(next, readDefinitionId, done), declarationValue =>
    fieldText<readonly (HirCapturedType)[], Root>(cursor, fields, "parameters", (next, done) => arrayText(next, readHirCapturedTypeText, done), parametersValue =>
      fieldText<HirCapturedType, Root>(cursor, fields, "result", readHirCapturedTypeText, resultValue =>
        fieldText<readonly (string)[], Root>(cursor, fields, "abi", (next, done) => arrayText(next, (next, done) => atomicText(next, readString, done), done), abiValue =>
          atomicText(cursor, next => closeRecord(next, fields), () =>
              acceptText({ kind: label, declaration: declarationValue, parameters: parametersValue, result: resultValue, abi: abiValue }, finish))))));
      }
    }));
}

export function readHirPointerOperationCaptureText<Root>(cursor: Cursor, finish: (value: HirPointerOperationCapture) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "HirPointerOperationCapture"), fields =>
    fieldText<"typed-location" | "native-pointer" | "raw-address" | "raw-memory" | "keep-alive", Root>(cursor, fields, "family", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["typed-location","native-pointer","raw-address","raw-memory","keep-alive"]), done), familyValue => {
    switch (familyValue) {
      case "typed-location":
        return fieldText<"address-of" | "allocate" | "load" | "store" | "equal-pointer" | "hash-pointer" | "bind-pointer" | "project-pointer" | "view", Root>(cursor, fields, "operation", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["address-of","allocate","load","store","equal-pointer","hash-pointer","bind-pointer","project-pointer","view"]), done), operationValue => {
        switch (operationValue) {
          case "address-of":
          case "allocate":
          case "load":
          case "store":
          case "equal-pointer":
          case "hash-pointer":
          case "bind-pointer":
          case "project-pointer":
            return fieldText<string, Root>(cursor, fields, "exportName", (next, done) => atomicText(next, readString, done), exportNameValue =>
            fieldText<readonly (SourceNodeRef)[], Root>(cursor, fields, "arguments", (next, done) => arrayText(next, (next, done) => atomicText(next, readSourceNodeRef, done), done), argumentsValue =>
              fieldText<readonly (SourceNodeRef)[], Root>(cursor, fields, "typeArguments", (next, done) => arrayText(next, (next, done) => atomicText(next, readSourceNodeRef, done), done), typeArgumentsValue =>
                fieldText<"applicable" | "conditional-candidates" | "untyped" | "unvisited", Root>(cursor, fields, "selection", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["applicable","conditional-candidates","untyped","unvisited"]), done), selectionValue =>
                  fieldText<"available" | "unvisited" | "not-applicable" | "missing", Root>(cursor, fields, "pointee", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["available","unvisited","not-applicable","missing"]), done), pointeeValue =>
                    atomicText(cursor, next => closeRecord(next, fields), () =>
                        acceptText({ family: familyValue, operation: operationValue, exportName: exportNameValue, arguments: argumentsValue, typeArguments: typeArgumentsValue, selection: selectionValue, pointee: pointeeValue }, finish)))))));
          case "view":
            return fieldText<SourceNodeRef, Root>(cursor, fields, "pointer", (next, done) => atomicText(next, readSourceNodeRef, done), pointerValue =>
            fieldText<SourceNodeRef, Root>(cursor, fields, "read", (next, done) => atomicText(next, readSourceNodeRef, done), readValue =>
              fieldText<SourceNodeRef, Root>(cursor, fields, "write", (next, done) => atomicText(next, readSourceNodeRef, done), writeValue =>
                fieldText<boolean, Root>(cursor, fields, "optional", (next, done) => atomicText(next, readBoolean, done), optionalValue =>
                  atomicText(cursor, next => closeRecord(next, fields), () =>
                      acceptText({ family: familyValue, operation: operationValue, pointer: pointerValue, read: readValue, write: writeValue, optional: optionalValue }, finish))))));
        }
        });
      case "native-pointer":
        return fieldText<"load" | "store" | "offset", Root>(cursor, fields, "operation", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["load","store","offset"]), done), operationValue => {
        switch (operationValue) {
          case "load":
            return fieldText<SourceNodeRef, Root>(cursor, fields, "pointer", (next, done) => atomicText(next, readSourceNodeRef, done), pointerValue =>
            atomicText(cursor, next => closeRecord(next, fields), () =>
                acceptText({ family: familyValue, operation: operationValue, pointer: pointerValue }, finish)));
          case "store":
            return fieldText<SourceNodeRef, Root>(cursor, fields, "pointer", (next, done) => atomicText(next, readSourceNodeRef, done), pointerValue =>
            fieldText<SourceNodeRef, Root>(cursor, fields, "value", (next, done) => atomicText(next, readSourceNodeRef, done), valueValue =>
              atomicText(cursor, next => closeRecord(next, fields), () =>
                  acceptText({ family: familyValue, operation: operationValue, pointer: pointerValue, value: valueValue }, finish))));
          case "offset":
            return fieldText<SourceNodeRef, Root>(cursor, fields, "pointer", (next, done) => atomicText(next, readSourceNodeRef, done), pointerValue =>
            fieldText<SourceNodeRef, Root>(cursor, fields, "offset", (next, done) => atomicText(next, readSourceNodeRef, done), offsetValue =>
              atomicText(cursor, next => closeRecord(next, fields), () =>
                  acceptText({ family: familyValue, operation: operationValue, pointer: pointerValue, offset: offsetValue }, finish))));
        }
        });
      case "raw-address":
        return fieldText<"bind-raw-pointer" | "equal-raw-pointer" | "hash-raw-pointer", Root>(cursor, fields, "operation", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["bind-raw-pointer","equal-raw-pointer","hash-raw-pointer"]), done), operationValue => {
        switch (operationValue) {
          case "bind-raw-pointer":
            return fieldText<SourceNodeRef, Root>(cursor, fields, "identity", (next, done) => atomicText(next, readSourceNodeRef, done), identityValue =>
            atomicText(cursor, next => closeRecord(next, fields), () =>
                acceptText({ family: familyValue, operation: operationValue, identity: identityValue }, finish)));
          case "equal-raw-pointer":
            return fieldText<SourceNodeRef, Root>(cursor, fields, "left", (next, done) => atomicText(next, readSourceNodeRef, done), leftValue =>
            fieldText<SourceNodeRef, Root>(cursor, fields, "right", (next, done) => atomicText(next, readSourceNodeRef, done), rightValue =>
              atomicText(cursor, next => closeRecord(next, fields), () =>
                  acceptText({ family: familyValue, operation: operationValue, left: leftValue, right: rightValue }, finish))));
          case "hash-raw-pointer":
            return fieldText<SourceNodeRef, Root>(cursor, fields, "pointer", (next, done) => atomicText(next, readSourceNodeRef, done), pointerValue =>
            atomicText(cursor, next => closeRecord(next, fields), () =>
                acceptText({ family: familyValue, operation: operationValue, pointer: pointerValue }, finish)));
        }
        });
      case "raw-memory":
        return fieldText<"to-raw" | "reinterpret" | "byte-offset" | "raw-to-address-integer" | "address-integer-to-raw", Root>(cursor, fields, "operation", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["to-raw","reinterpret","byte-offset","raw-to-address-integer","address-integer-to-raw"]), done), operationValue => {
        switch (operationValue) {
          case "to-raw":
            return fieldText<SourceNodeRef, Root>(cursor, fields, "pointer", (next, done) => atomicText(next, readSourceNodeRef, done), pointerValue =>
            fieldText<SourceNodeRef, Root>(cursor, fields, "layout", (next, done) => atomicText(next, readSourceNodeRef, done), layoutValue =>
              atomicText(cursor, next => closeRecord(next, fields), () =>
                  acceptText({ family: familyValue, operation: operationValue, pointer: pointerValue, layout: layoutValue }, finish))));
          case "reinterpret":
            return fieldText<SourceNodeRef, Root>(cursor, fields, "raw", (next, done) => atomicText(next, readSourceNodeRef, done), rawValue =>
            fieldText<SourceNodeRef, Root>(cursor, fields, "layout", (next, done) => atomicText(next, readSourceNodeRef, done), layoutValue =>
              atomicText(cursor, next => closeRecord(next, fields), () =>
                  acceptText({ family: familyValue, operation: operationValue, raw: rawValue, layout: layoutValue }, finish))));
          case "byte-offset":
            return fieldText<SourceNodeRef, Root>(cursor, fields, "raw", (next, done) => atomicText(next, readSourceNodeRef, done), rawValue =>
            fieldText<SourceNodeRef, Root>(cursor, fields, "offset", (next, done) => atomicText(next, readSourceNodeRef, done), offsetValue =>
              fieldText<HirIntegerOperandCapture, Root>(cursor, fields, "integer", readHirIntegerOperandCaptureText, integerValue =>
                fieldText<SourceNodeRef, Root>(cursor, fields, "dataLayout", (next, done) => atomicText(next, readSourceNodeRef, done), dataLayoutValue =>
                  atomicText(cursor, next => closeRecord(next, fields), () =>
                      acceptText({ family: familyValue, operation: operationValue, raw: rawValue, offset: offsetValue, integer: integerValue, dataLayout: dataLayoutValue }, finish))))));
          case "raw-to-address-integer":
            return fieldText<SourceNodeRef, Root>(cursor, fields, "raw", (next, done) => atomicText(next, readSourceNodeRef, done), rawValue =>
            fieldText<HirAddressIntegerCapture, Root>(cursor, fields, "integer", readHirAddressIntegerCaptureText, integerValue =>
              fieldText<SourceNodeRef, Root>(cursor, fields, "dataLayout", (next, done) => atomicText(next, readSourceNodeRef, done), dataLayoutValue =>
                atomicText(cursor, next => closeRecord(next, fields), () =>
                    acceptText({ family: familyValue, operation: operationValue, raw: rawValue, integer: integerValue, dataLayout: dataLayoutValue }, finish)))));
          case "address-integer-to-raw":
            return fieldText<SourceNodeRef, Root>(cursor, fields, "address", (next, done) => atomicText(next, readSourceNodeRef, done), addressValue =>
            fieldText<HirAddressIntegerCapture, Root>(cursor, fields, "integer", readHirAddressIntegerCaptureText, integerValue =>
              fieldText<SourceNodeRef, Root>(cursor, fields, "dataLayout", (next, done) => atomicText(next, readSourceNodeRef, done), dataLayoutValue =>
                atomicText(cursor, next => closeRecord(next, fields), () =>
                    acceptText({ family: familyValue, operation: operationValue, address: addressValue, integer: integerValue, dataLayout: dataLayoutValue }, finish)))));
        }
        });
      case "keep-alive":
        return fieldText<"keep-alive", Root>(cursor, fields, "operation", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["keep-alive"]), done), operationValue =>
        fieldText<SourceNodeRef, Root>(cursor, fields, "value", (next, done) => atomicText(next, readSourceNodeRef, done), valueValue =>
          atomicText(cursor, next => closeRecord(next, fields), () =>
              acceptText({ family: familyValue, operation: operationValue, value: valueValue }, finish))));
    }
    }));
}

export function readHirAttributeCaptureText<Root>(cursor: Cursor, finish: (value: HirAttributeCapture) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["builder-state","application"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      switch (label) {
        case "builder-state":
          return fieldText<SourceNodeRef, Root>(cursor, fields, "occurrence", (next, done) => atomicText(next, readSourceNodeRef, done), occurrenceValue =>
    fieldText<SourceNodeRef, Root>(cursor, fields, "applicationTarget", (next, done) => atomicText(next, readSourceNodeRef, done), applicationTargetValue =>
      fieldText<{ readonly selectedDeclaration: SourceNodeRef | null; readonly declarations: readonly (SourceNodeRef)[] } | null, Root>(cursor, fields, "selectedMember", (next, done) => nullableText(next, (<NextRoot>(next: Cursor, done: (value: { readonly selectedDeclaration: SourceNodeRef | null; readonly declarations: readonly (SourceNodeRef)[] }) => TextStep<NextRoot>) => atomicText(next, cursor => openRecord(cursor, "Record"), fields => fieldText<SourceNodeRef | null, NextRoot>(next, fields, "selectedDeclaration", (next, done) => nullableText(next, (next, done) => atomicText(next, readSourceNodeRef, done), done), selectedDeclarationValue =>
    fieldText<readonly (SourceNodeRef)[], NextRoot>(next, fields, "declarations", (next, done) => arrayText(next, (next, done) => atomicText(next, readSourceNodeRef, done), done), declarationsValue =>
      atomicText(next, next => closeRecord(next, fields), () =>
          acceptText({ selectedDeclaration: selectedDeclarationValue, declarations: declarationsValue }, done)))))), done), selectedMemberValue =>
        fieldText<"property" | "method" | null, Root>(cursor, fields, "applicationMemberKind", (next, done) => nullableText(next, (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["property","method"]), done), done), applicationMemberKindValue =>
          fieldText<"declaration" | "constructor" | null, Root>(cursor, fields, "applicationPlacement", (next, done) => nullableText(next, (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["declaration","constructor"]), done), done), applicationPlacementValue =>
            fieldText<string | null, Root>(cursor, fields, "applicationParameterName", (next, done) => nullableText(next, (next, done) => atomicText(next, readString, done), done), applicationParameterNameValue =>
              fieldText<string | null, Root>(cursor, fields, "applicationTargetSpecifier", (next, done) => nullableText(next, (next, done) => atomicText(next, readString, done), done), applicationTargetSpecifierValue =>
                atomicText(cursor, next => closeRecord(next, fields), () =>
                    acceptText({ kind: label, occurrence: occurrenceValue, applicationTarget: applicationTargetValue, selectedMember: selectedMemberValue, applicationMemberKind: applicationMemberKindValue, applicationPlacement: applicationPlacementValue, applicationParameterName: applicationParameterNameValue, applicationTargetSpecifier: applicationTargetSpecifierValue }, finish)))))))));
        case "application":
          return fieldText<SourceNodeRef, Root>(cursor, fields, "occurrence", (next, done) => atomicText(next, readSourceNodeRef, done), occurrenceValue =>
    fieldText<SourceNodeRef, Root>(cursor, fields, "applicationTarget", (next, done) => atomicText(next, readSourceNodeRef, done), applicationTargetValue =>
      fieldText<{ readonly selectedDeclaration: SourceNodeRef | null; readonly declarations: readonly (SourceNodeRef)[] } | null, Root>(cursor, fields, "selectedMember", (next, done) => nullableText(next, (<NextRoot>(next: Cursor, done: (value: { readonly selectedDeclaration: SourceNodeRef | null; readonly declarations: readonly (SourceNodeRef)[] }) => TextStep<NextRoot>) => atomicText(next, cursor => openRecord(cursor, "Record"), fields => fieldText<SourceNodeRef | null, NextRoot>(next, fields, "selectedDeclaration", (next, done) => nullableText(next, (next, done) => atomicText(next, readSourceNodeRef, done), done), selectedDeclarationValue =>
    fieldText<readonly (SourceNodeRef)[], NextRoot>(next, fields, "declarations", (next, done) => arrayText(next, (next, done) => atomicText(next, readSourceNodeRef, done), done), declarationsValue =>
      atomicText(next, next => closeRecord(next, fields), () =>
          acceptText({ selectedDeclaration: selectedDeclarationValue, declarations: declarationsValue }, done)))))), done), selectedMemberValue =>
        fieldText<"property" | "method" | null, Root>(cursor, fields, "applicationMemberKind", (next, done) => nullableText(next, (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["property","method"]), done), done), applicationMemberKindValue =>
          fieldText<"declaration" | "constructor" | null, Root>(cursor, fields, "applicationPlacement", (next, done) => nullableText(next, (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["declaration","constructor"]), done), done), applicationPlacementValue =>
            fieldText<string | null, Root>(cursor, fields, "applicationParameterName", (next, done) => nullableText(next, (next, done) => atomicText(next, readString, done), done), applicationParameterNameValue =>
              fieldText<string | null, Root>(cursor, fields, "applicationTargetSpecifier", (next, done) => nullableText(next, (next, done) => atomicText(next, readString, done), done), applicationTargetSpecifierValue =>
                fieldText<SourceNodeRef, Root>(cursor, fields, "invocation", (next, done) => atomicText(next, readSourceNodeRef, done), invocationValue =>
                  atomicText(cursor, next => closeRecord(next, fields), () =>
                      acceptText({ kind: label, occurrence: occurrenceValue, applicationTarget: applicationTargetValue, selectedMember: selectedMemberValue, applicationMemberKind: applicationMemberKindValue, applicationPlacement: applicationPlacementValue, applicationParameterName: applicationParameterNameValue, applicationTargetSpecifier: applicationTargetSpecifierValue, invocation: invocationValue }, finish))))))))));
      }
    }));
}

export function readHirSafetyCaptureText<Root>(cursor: Cursor, finish: (value: HirSafetyCapture) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "HirSafetyCapture"), fields =>
    fieldText<SourceNodeRef, Root>(cursor, fields, "occurrence", (next, done) => atomicText(next, readSourceNodeRef, done), occurrenceValue =>
    fieldText<DefId, Root>(cursor, fields, "provider", (next, done) => atomicText(next, readDefinitionId, done), providerValue =>
      fieldText<"unsafe-context" | "safety", Root>(cursor, fields, "family", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["unsafe-context","safety"]), done), familyValue => {
        switch (familyValue) {
          case "unsafe-context":
            return fieldText<"expression" | "remaining-block", Root>(cursor, fields, "operation", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["expression","remaining-block"]), done), operationValue => {
            switch (operationValue) {
              case "expression":
                return fieldText<SourceNodeRef, Root>(cursor, fields, "expression", (next, done) => atomicText(next, readSourceNodeRef, done), expressionValue =>
                atomicText(cursor, next => closeRecord(next, fields), () =>
                    acceptText({ occurrence: occurrenceValue, provider: providerValue, family: familyValue, operation: operationValue, expression: expressionValue }, finish)));
              case "remaining-block":
                return fieldText<boolean, Root>(cursor, fields, "firstDirectStatement", (next, done) => atomicText(next, readBoolean, done), firstDirectStatementValue =>
                atomicText(cursor, next => closeRecord(next, fields), () =>
                    acceptText({ occurrence: occurrenceValue, provider: providerValue, family: familyValue, operation: operationValue, firstDirectStatement: firstDirectStatementValue }, finish)));
            }
            });
          case "safety":
            return fieldText<"root" | "select-member" | "placement" | "apply", Root>(cursor, fields, "operation", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["root","select-member","placement","apply"]), done), operationValue => {
            switch (operationValue) {
              case "root":
                return fieldText<"type" | "value", Root>(cursor, fields, "form", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["type","value"]), done), formValue =>
                fieldText<SourceNodeRef | null, Root>(cursor, fields, "target", (next, done) => nullableText(next, (next, done) => atomicText(next, readSourceNodeRef, done), done), targetValue =>
                  atomicText(cursor, next => closeRecord(next, fields), () =>
                      acceptText({ occurrence: occurrenceValue, provider: providerValue, family: familyValue, operation: operationValue, form: formValue, target: targetValue }, finish))));
              case "select-member":
                return fieldText<SourceNodeRef | null, Root>(cursor, fields, "predecessor", (next, done) => nullableText(next, (next, done) => atomicText(next, readSourceNodeRef, done), done), predecessorValue =>
                fieldText<"indexer" | "method" | "property", Root>(cursor, fields, "memberKind", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["indexer","method","property"]), done), memberKindValue =>
                  fieldText<HirSafetySelectionCapture, Root>(cursor, fields, "selection", readHirSafetySelectionCaptureText, selectionValue =>
                    atomicText(cursor, next => closeRecord(next, fields), () =>
                        acceptText({ occurrence: occurrenceValue, provider: providerValue, family: familyValue, operation: operationValue, predecessor: predecessorValue, memberKind: memberKindValue, selection: selectionValue }, finish)))));
              case "placement":
                return fieldText<SourceNodeRef | null, Root>(cursor, fields, "predecessor", (next, done) => nullableText(next, (next, done) => atomicText(next, readSourceNodeRef, done), done), predecessorValue =>
                fieldText<"declaration" | "constructor" | "getter" | "setter", Root>(cursor, fields, "placement", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["declaration","constructor","getter","setter"]), done), placementValue =>
                  atomicText(cursor, next => closeRecord(next, fields), () =>
                      acceptText({ occurrence: occurrenceValue, provider: providerValue, family: familyValue, operation: operationValue, predecessor: predecessorValue, placement: placementValue }, finish))));
              case "apply":
                return fieldText<SourceNodeRef | null, Root>(cursor, fields, "predecessor", (next, done) => nullableText(next, (next, done) => atomicText(next, readSourceNodeRef, done), done), predecessorValue =>
                fieldText<"requires-unsafe" | "safe", Root>(cursor, fields, "contract", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["requires-unsafe","safe"]), done), contractValue =>
                  atomicText(cursor, next => closeRecord(next, fields), () =>
                      acceptText({ occurrence: occurrenceValue, provider: providerValue, family: familyValue, operation: operationValue, predecessor: predecessorValue, contract: contractValue }, finish))));
            }
            });
        }
        }))));
}

export function readHirArgumentPassingCaptureText<Root>(cursor: Cursor, finish: (value: HirArgumentPassingCapture) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "HirArgumentPassingCapture"), fields =>
    fieldText<"declaration" | "argument", Root>(cursor, fields, "role", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["declaration","argument"]), done), roleValue => {
    switch (roleValue) {
      case "declaration":
        return fieldText<PassingMode, Root>(cursor, fields, "mode", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["by-value","byref-readonly","byref-readwrite","byref-writeonly-must-init","borrow-shared","borrow-mut","move"]), done), modeValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ role: roleValue, mode: modeValue }, finish)));
      case "argument":
        return fieldText<PassingMode, Root>(cursor, fields, "mode", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["by-value","byref-readonly","byref-readwrite","byref-writeonly-must-init","borrow-shared","borrow-mut","move"]), done), modeValue =>
        fieldText<SourceNodeRef, Root>(cursor, fields, "storageExpression", (next, done) => atomicText(next, readSourceNodeRef, done), storageExpressionValue =>
          atomicText(cursor, next => closeRecord(next, fields), () =>
              acceptText({ role: roleValue, mode: modeValue, storageExpression: storageExpressionValue }, finish))));
    }
    }));
}

export function readDeclarationTargetText<Root>(cursor: Cursor, finish: (value: DeclarationTarget) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["local","definition"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      switch (label) {
        case "local":
          return fieldText<LocalRef, Root>(cursor, fields, "local", (next, done) => atomicText(next, readLocalRef, done), localValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, local: localValue }, finish)));
        case "definition":
          return fieldText<DefId, Root>(cursor, fields, "definition", (next, done) => atomicText(next, readDefinitionId, done), definitionValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, definition: definitionValue }, finish)));
      }
    }));
}

export function readImportTargetText<Root>(cursor: Cursor, finish: (value: ImportTarget) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "ImportTarget"), fields =>
    fieldText<"project" | "library", Root>(cursor, fields, "target", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["project","library"]), done), targetValue => {
    switch (targetValue) {
      case "project":
        return fieldText<ModuleId, Root>(cursor, fields, "module", (next, done) => atomicText(next, readModuleId, done), moduleValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ target: targetValue, module: moduleValue }, finish)));
      case "library":
        return fieldText<LibraryModuleIdentity, Root>(cursor, fields, "module", (next, done) => atomicText(next, readLibraryModuleIdentity, done), moduleValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ target: targetValue, module: moduleValue }, finish)));
    }
    }));
}

export function readHirFieldMarkerCaptureText<Root>(cursor: Cursor, finish: (value: HirFieldMarkerCapture) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "HirFieldMarkerCapture"), fields =>
    fieldText<string, Root>(cursor, fields, "name", (next, done) => atomicText(next, readString, done), nameValue =>
    fieldText<SourceNodeRef, Root>(cursor, fields, "typeNode", (next, done) => atomicText(next, readSourceNodeRef, done), typeNodeValue =>
      fieldText<CapturedFact<TyId>, Root>(cursor, fields, "type", (next, done) => readCapturedFactText(next, (next, done) => atomicText(next, readTypeId, done), done), typeValue =>
        fieldText<boolean, Root>(cursor, fields, "readonly", (next, done) => atomicText(next, readBoolean, done), readonlyValue =>
          atomicText(cursor, next => closeRecord(next, fields), () =>
              acceptText({ name: nameValue, typeNode: typeNodeValue, type: typeValue, readonly: readonlyValue }, finish)))))));
}

export function readHirCapturedTypeText<Root>(cursor: Cursor, finish: (value: HirCapturedType) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "HirCapturedType"), fields =>
    fieldText<CapturedFact<TyId>, Root>(cursor, fields, "type", (next, done) => readCapturedFactText(next, (next, done) => atomicText(next, readTypeId, done), done), typeValue =>
    fieldText<TypeComponent, Root>(cursor, fields, "component", readTypeComponentText, componentValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ type: typeValue, component: componentValue }, finish)))));
}

export function readHirIntegerOperandCaptureText<Root>(cursor: Cursor, finish: (value: HirIntegerOperandCapture) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "HirIntegerOperandCapture"), fields =>
    fieldText<"number" | "bigint", Root>(cursor, fields, "runtimeBase", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["number","bigint"]), done), runtimeBaseValue =>
    fieldText<"signed" | "unsigned", Root>(cursor, fields, "signedness", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["signed","unsigned"]), done), signednessValue =>
      fieldText<8 | 16 | 32 | 64 | 128, Root>(cursor, fields, "width", (next, done) => atomicText(next, cursor => readNumberChoice(cursor, [8,16,32,64,128]), done), widthValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ runtimeBase: runtimeBaseValue, signedness: signednessValue, width: widthValue }, finish))))));
}

export function readHirAddressIntegerCaptureText<Root>(cursor: Cursor, finish: (value: HirAddressIntegerCapture) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "HirAddressIntegerCapture"), fields =>
    fieldText<32 | 64, Root>(cursor, fields, "width", (next, done) => atomicText(next, cursor => readNumberChoice(cursor, [32,64]), done), widthValue => {
    switch (widthValue) {
      case 32:
        return fieldText<"number", Root>(cursor, fields, "runtimeBase", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["number"]), done), runtimeBaseValue =>
        fieldText<"unsigned", Root>(cursor, fields, "signedness", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["unsigned"]), done), signednessValue =>
          atomicText(cursor, next => closeRecord(next, fields), () =>
              acceptText({ width: widthValue, runtimeBase: runtimeBaseValue, signedness: signednessValue }, finish))));
      case 64:
        return fieldText<"bigint", Root>(cursor, fields, "runtimeBase", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["bigint"]), done), runtimeBaseValue =>
        fieldText<"unsigned", Root>(cursor, fields, "signedness", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["unsigned"]), done), signednessValue =>
          atomicText(cursor, next => closeRecord(next, fields), () =>
              acceptText({ width: widthValue, runtimeBase: runtimeBaseValue, signedness: signednessValue }, finish))));
    }
    }));
}

export function readHirSafetySelectionCaptureText<Root>(cursor: Cursor, finish: (value: HirSafetySelectionCapture) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["selected","unavailable"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      switch (label) {
        case "selected":
          return fieldText<SourceNodeRef, Root>(cursor, fields, "expression", (next, done) => atomicText(next, readSourceNodeRef, done), expressionValue =>
    fieldText<SourceNodeRef | null, Root>(cursor, fields, "declaration", (next, done) => nullableText(next, (next, done) => atomicText(next, readSourceNodeRef, done), done), declarationValue =>
      fieldText<readonly (SourceNodeRef)[], Root>(cursor, fields, "declarations", (next, done) => arrayText(next, (next, done) => atomicText(next, readSourceNodeRef, done), done), declarationsValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ kind: label, expression: expressionValue, declaration: declarationValue, declarations: declarationsValue }, finish)))));
        case "unavailable":
          return fieldText<"function-shape" | "receiver" | "member-evidence", Root>(cursor, fields, "reason", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["function-shape","receiver","member-evidence"]), done), reasonValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, reason: reasonValue }, finish)));
      }
    }));
}
