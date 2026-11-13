import type * as Hir from "./contract.js";
import type * as Ids from "../ids/contract.js";
import type * as Types from "../ir-types/contract.js";
import type * as Diag from "../diag/contract.js";
import type { HirDataField, HirDataWork, HirRecordWork } from "./walk.js";
import { hirArrayData as arrayData, hirFieldData as fieldData, hirIdentityData as identityData,
  hirNullableData as nullableData, hirRecordData as recordData, hirScalarData as scalarData,
  hirBodyIdData as bodyData, hirCandidateIdData as candidateIdData, hirDefIdData as definitionData,
  hirLocalIdData as localIdData, hirNodeIdData as nodeIdData, hirNodeRefData as nodeRefData,
  hirSourceRefData as sourceRefData, hirLocalRefData as localRefData, hirOriginData as originData,
  hirSigIdData as signatureData, hirTyIdData as typeData } from "./walk.js";
import { hirSyntaxData } from "./text-syntax.js";

function capturedData<Value>(value: Hir.CapturedFact<Value>, read: (value: Value) => HirDataWork): HirDataWork {
  switch (value.kind) {
    case "available": return recordData(value.kind, value, () => [fieldData("value", read(value.value))]);
    case "unavailable": return recordData(value.kind, value, () => [fieldData("reason", scalarData(value.reason))]);
  }
}

function parameterIdentityData(value: Types.TypeParameterIdentity): HirDataWork {
  return recordData("TypeParameterIdentity", value, () => [fieldData("owner", definitionData(value.owner)), fieldData("index", scalarData(value.index))]);
}

function parameterData(value: Types.TypeParameter): HirDataWork {
  return recordData("TypeParameter", value, () => [fieldData("identity", parameterIdentityData(value.identity)),
    fieldData("declaration", definitionData(value.declaration)), fieldData("constraint", nullableData(value.constraint, typeData)),
    fieldData("default", nullableData(value.default, typeData))]);
}

function typeBindingData(value: Types.TypeBinding): HirDataWork {
  switch (value.kind) {
    case "bound": return recordData(value.kind, value, () => [fieldData("parameter", parameterIdentityData(value.parameter)), fieldData("type", typeData(value.type))]);
    case "rigid": return recordData(value.kind, value, () => [fieldData("parameter", parameterIdentityData(value.parameter))]);
  }
}

function selfBindingData(value: Types.SelfBinding): HirDataWork {
  switch (value.kind) {
    case "bound": return recordData(value.kind, value, () => [fieldData("owner", definitionData(value.owner)), fieldData("type", typeData(value.type))]);
    case "rigid": return recordData(value.kind, value, () => [fieldData("owner", definitionData(value.owner))]);
  }
}

function bindingsData(value: Types.BindingVector): HirDataWork {
  return recordData("BindingVector", value, () => [fieldData("classBindings", arrayData(value.classBindings, typeBindingData)),
    fieldData("methodBindings", arrayData(value.methodBindings, typeBindingData)), fieldData("capturedBindings", arrayData(value.capturedBindings, typeBindingData)),
    fieldData("selfBindings", arrayData(value.selfBindings, selfBindingData))]);
}

function rationalData(value: Types.ExactRational): HirDataWork {
  return recordData("ExactRational", value, () => [fieldData("numerator", scalarData(value.numerator)),
    fieldData("denominator", scalarData(value.denominator)), fieldData("negativeZero", scalarData(value.negativeZero))]);
}

function literalTypeData(value: Types.LiteralTypeValue): HirDataWork {
  switch (value.kind) {
    case "number": return recordData(value.kind, value, () => [fieldData("value", rationalData(value.value))]);
    case "bigint": case "string": case "boolean": return recordData(value.kind, value, () => [fieldData("value", scalarData(value.value))]);
    case "absence": return recordData(value.kind, value, () => []);
    case "unique-symbol": return recordData(value.kind, value, () => [fieldData("declaration", definitionData(value.declaration))]);
  }
}

function literalData(value: Types.LiteralValue): HirDataWork {
  switch (value.kind) {
    case "number": return recordData(value.kind, value, () => [fieldData("token", scalarData(value.token)), fieldData("value", rationalData(value.value))]);
    case "bigint": return recordData(value.kind, value, () => [fieldData("token", scalarData(value.token)), fieldData("value", scalarData(value.value))]);
    case "string": case "boolean": case "absence": case "unique-symbol": return literalTypeData(value);
  }
}

function memberKeyData(value: Types.MemberKey): HirDataWork {
  switch (value.kind) {
    case "text": return recordData(value.kind, value, () => [fieldData("value", scalarData(value.value))], { kind: "MemberKey", value });
    case "number": return recordData(value.kind, value, () => [fieldData("value", rationalData(value.value))], { kind: "MemberKey", value });
    case "symbol": return recordData(value.kind, value, () => [fieldData("declaration", definitionData(value.declaration))], { kind: "MemberKey", value });
  }
}

function memberOriginData(value: Types.MemberOrigin): HirDataWork {
  switch (value.kind) {
    case "declared": return recordData(value.kind, value, () => [fieldData("declaration", definitionData(value.declaration))]);
    case "class-prototype": return recordData(value.kind, value, () => [fieldData("owner", definitionData(value.owner))]);
    case "mapped": return recordData(value.kind, value, () => [fieldData("owner", sourceRefData(value.owner)), fieldData("key", memberKeyData(value.key))]);
  }
}

function constructionData(value: Types.ConstructionDefinition): HirDataWork {
  return recordData("ConstructionDefinition", value, () => [fieldData("occurrence", nodeRefData(value.occurrence)), fieldData("captures", arrayData(value.captures, localRefData))]);
}

function sumFamilyData(value: Types.SumFamily): HirDataWork {
  return recordData("SumFamily", value, () => [fieldData("origin", scalarData(value.origin)), fieldData("component", componentData(value.component)),
    fieldData("parameters", arrayData(value.parameters, parameterIdentityData)), fieldData("roles", arrayData(value.roles, sumRoleData))]);
}

function sumRoleData(value: Types.SumArmRole): HirDataWork {
  return recordData("SumArmRole", value, () => [fieldData("authoredIndex", scalarData(value.authoredIndex)),
    fieldData("component", sourceRefData(value.component)), fieldData("member", typeData(value.member))]);
}

function componentData(value: Types.TypeComponent): HirDataWork {
  return recordData("TypeComponent", value, () => [fieldData("root", sourceRefData(value.root)), fieldData("path", arrayData(value.path, selectorData))]);
}

function selectorData(value: Types.ComponentSelector): HirDataWork {
  switch (value.kind) {
    case "class-value": case "optional-value": case "array-element": case "intersection-result": case "projection-source": case "awaited":
      return recordData(value.kind, value, () => []);
    case "construction-argument": return recordData(value.kind, value, () => [fieldData("definition", constructionData(value.definition)), fieldData("index", scalarData(value.index))]);
    case "tuple-element": case "union-member": case "argument-place": case "parameter-place": case "intersection-member":
      return recordData(value.kind, value, () => [fieldData("index", scalarData(value.index))]);
    case "argument-tail": case "parameter-tail": return recordData(value.kind, value, () => [fieldData("start", scalarData(value.start))]);
    case "member": return recordData(value.kind, value, () => [fieldData("origin", memberOriginData(value.origin))]);
    case "index-key": case "index-value": return recordData(value.kind, value, () => [fieldData("declaration", definitionData(value.declaration))]);
    case "parameter": return recordData(value.kind, value, () => [fieldData("signature", signatureData(value.signature)), fieldData("index", scalarData(value.index))]);
    case "receiver": case "result": return recordData(value.kind, value, () => [fieldData("signature", signatureData(value.signature))]);
    case "signature-tail": return recordData(value.kind, value, () => [fieldData("signature", signatureData(value.signature)),
      fieldData("start", scalarData(value.start)), fieldData("readonly", scalarData(value.readonly))]);
    case "tuple-slice": return recordData(value.kind, value, () => [fieldData("start", scalarData(value.start)),
      fieldData("endCount", scalarData(value.endCount)), fieldData("readonly", scalarData(value.readonly))]);
    case "type-argument": return recordData(value.kind, value, () => [fieldData("declaration", definitionData(value.declaration)), fieldData("index", scalarData(value.index))]);
    case "sum-arm": return recordData(value.kind, value, () => [fieldData("family", sumFamilyData(value.family)), fieldData("index", scalarData(value.index))]);
  }
}

function diagnosticCodeData(value: Diag.DiagnosticCode): HirDataWork {
  switch (value.kind) {
    case "host": return recordData(value.kind, value, () => [fieldData("name", scalarData(value.name)), fieldData("rendered", scalarData(value.rendered))]);
    case "checker": return recordData(value.kind, value, () => [fieldData("number", scalarData(value.number)), fieldData("rendered", scalarData(value.rendered))]);
    case "extension": return recordData(value.kind, value, () => [fieldData("number", scalarData(value.number)),
      fieldData("extensionCode", scalarData(value.extensionCode)), fieldData("rendered", scalarData(value.rendered))]);
  }
}

function diagnosticSiteData(value: Diag.DiagnosticSite): HirDataWork {
  switch (value.kind) {
    case "source": return recordData(value.kind, value, () => [fieldData("origin", originData(value.origin))]);
    case "file": return recordData(value.kind, value, () => [fieldData("path", scalarData(value.path))]);
    case "none": return recordData(value.kind, value, () => []);
  }
}

function messageArgumentData(value: Diag.MessageArgument): HirDataWork {
  switch (value.kind) {
    case "text": case "integer": case "number": return recordData(value.kind, value, () => [fieldData("value", scalarData(value.value))]);
    case "origin": return recordData(value.kind, value, () => [fieldData("value", originData(value.value))]);
  }
}

function relatedDiagnosticData(value: Diag.RelatedDiagnostic): HirDataWork {
  return recordData("RelatedDiagnostic", value, () => [fieldData("site", diagnosticSiteData(value.site)), fieldData("code", diagnosticCodeData(value.code)), fieldData("message", scalarData(value.message))]);
}

function editData(value: Diag.TextEdit): HirDataWork {
  return recordData("TextEdit", value, () => [fieldData("origin", originData(value.origin)), fieldData("replacement", scalarData(value.replacement))]);
}

function fixData(value: Diag.DiagnosticFix): HirDataWork {
  return recordData("DiagnosticFix", value, () => [fieldData("description", scalarData(value.description)), fieldData("edits", arrayData(value.edits, editData))]);
}

function diagnosticData(value: Diag.Diagnostic): HirDataWork {
  return recordData("Diagnostic", value, () => [fieldData("code", diagnosticCodeData(value.code)), fieldData("severity", scalarData(value.severity)),
    fieldData("site", diagnosticSiteData(value.site)), fieldData("source", scalarData(value.source)), fieldData("evidence", arrayData(value.evidence, scalarData)),
    fieldData("message", scalarData(value.message)), fieldData("arguments", arrayData(value.arguments, messageArgumentData)),
    fieldData("related", arrayData(value.related, relatedDiagnosticData)), fieldData("fix", nullableData(value.fix, fixData))]);
}

function libraryIdentityData(value: Ids.LibraryModuleIdentity): HirDataWork {
  return recordData("LibraryModuleIdentity", value, () => [fieldData("providerId", scalarData(value.providerId)),
    fieldData("providerVersion", scalarData(value.providerVersion)), fieldData("packageName", scalarData(value.packageName)),
    fieldData("moduleSpecifier", scalarData(value.moduleSpecifier)), fieldData("providerModuleId", scalarData(value.providerModuleId))]);
}

function importTargetData(value: Hir.ImportTarget): HirDataWork {
  switch (value.target) {
    case "project": return recordData("ImportTarget", value, () => [fieldData("target", scalarData(value.target)), fieldData("module", identityData("mod", value.module))]);
    case "library": return recordData("ImportTarget", value, () => [fieldData("target", scalarData(value.target)), fieldData("module", libraryIdentityData(value.module))]);
  }
}

function resolutionData(value: Hir.HirResolution): HirDataWork {
  switch (value.kind) {
    case "local": return recordData(value.kind, value, () => [fieldData("local", localRefData(value.local))], { kind: "HirResolution", value });
    case "definition": return recordData(value.kind, value, () => [fieldData("definition", definitionData(value.definition)),
      fieldData("aliases", arrayData(value.aliases, definitionData))], { kind: "HirResolution", value });
    case "module": return recordData(value.kind, value, () => [fieldData("target", importTargetData(value.target))], { kind: "HirResolution", value });
    case "unresolved": return recordData(value.kind, value, () => [fieldData("checkerDiagnostic", scalarData(value.checkerDiagnostic))], { kind: "HirResolution", value });
  }
}

function viewsData(value: Hir.HirCheckerViews): HirDataWork {
  return recordData("HirCheckerViews", value, () => [fieldData("read", capturedData(value.read, typeData)),
    fieldData("declared", capturedData(value.declared, slot => nullableData(slot, typeData))),
    fieldData("contextual", capturedData(value.contextual, slot => nullableData(slot, typeData)))]);
}

function attributeData(value: Hir.HirAttribute): HirDataWork {
  return recordData("HirAttribute", value, () => [fieldData("declaration", definitionData(value.declaration)),
    fieldData("occurrence", sourceRefData(value.occurrence)), fieldData("arguments", arrayData(value.arguments, sourceRefData))]);
}

function argumentData(value: Hir.HirArgument): HirDataWork {
  switch (value.kind) {
    case "value": return recordData(value.kind, value, () => [fieldData("expression", nodeIdData(value.expression))]);
    case "spread": return recordData(value.kind, value, () => [fieldData("expression", nodeIdData(value.expression)),
      fieldData("tuple", capturedData(value.tuple, tuple => nullableData(tuple, values => arrayData(values, typeData))))]);
  }
}

function contributionData(value: Hir.HirInferenceContribution): HirDataWork {
  return recordData("HirInferenceContribution", value, () => [fieldData("parameter", parameterIdentityData(value.parameter)),
    fieldData("role", scalarData(value.role)), fieldData("source", sourceRefData(value.source)),
    fieldData("component", componentData(value.component)), fieldData("type", capturedData(value.type, typeData))]);
}

function endpointData(value: Hir.HirCallableEndpoint): HirDataWork {
  return recordData("HirCallableEndpoint", value, () => [fieldData("declaration", definitionData(value.declaration)),
    fieldData("role", scalarData(value.role)), fieldData("signature", signatureData(value.signature)), fieldData("body", nullableData(value.body, bodyData))]);
}

function candidateData(value: Hir.HirCandidate): HirDataWork {
  return recordData("HirCandidate", value, () => [fieldData("ordinal", scalarData(value.ordinal)), fieldData("declaration", definitionData(value.declaration)),
    fieldData("appliedSignature", capturedData(value.appliedSignature, signatureData)), fieldData("bindings", capturedData(value.bindings, bindingsData)),
    fieldData("conditionalFailure", capturedData(value.conditionalFailure, failure => nullableData(failure, diagnosticData))),
    fieldData("contributions", arrayData(value.contributions, contributionData))]);
}

function applicationData(value: Hir.HirApplication): HirDataWork {
  return recordData(value.kind, value, () => [fieldData("receiver", nullableData(value.receiver, nodeIdData)),
    fieldData("arguments", arrayData(value.arguments, argumentData)), fieldData("typeArguments", arrayData(value.typeArguments, typeData)),
    fieldData("candidates", capturedData(value.candidates, candidateIdData)),
    fieldData("resolvedSignature", capturedData(value.resolvedSignature, slot => nullableData(slot, signatureData)))]);
}

function candidateListData(value: Hir.HirCandidateList): HirDataWork {
  return recordData("HirCandidateList", value, () => [fieldData("id", candidateIdData(value.id)), fieldData("candidates", arrayData(value.candidates, candidateData))]);
}

function protocolData(value: Hir.HirProtocolFact): HirDataWork {
  switch (value.kind) {
    case "iterate": case "spread": return recordData(value.kind, value, () => [fieldData("asynchronous", scalarData(value.asynchronous)),
      fieldData("subject", nodeIdData(value.subject)), fieldData("iterator", typeData(value.iterator)), fieldData("element", typeData(value.element)),
      fieldData("completion", typeData(value.completion)), fieldData("sent", typeData(value.sent)), fieldData("next", signatureData(value.next)),
      fieldData("finish", nullableData(value.finish, signatureData)), fieldData("fail", nullableData(value.fail, signatureData))]);
    case "await": return recordData(value.kind, value, () => [fieldData("subject", nodeIdData(value.subject)), fieldData("completion", typeData(value.completion))]);
    case "yield": case "delegate": return recordData(value.kind, value, () => [fieldData("subject", nullableData(value.subject, nodeIdData)),
      fieldData("yielded", typeData(value.yielded)), fieldData("sent", typeData(value.sent)), fieldData("completion", typeData(value.completion))]);
    case "dispose": return recordData(value.kind, value, () => [fieldData("subject", nodeIdData(value.subject)),
      fieldData("asynchronous", scalarData(value.asynchronous)), fieldData("signature", signatureData(value.signature))]);
  }
}

function placeBaseData(value: Hir.HirStoragePlace["base"]): HirDataWork {
  switch (value.kind) {
    case "root": return recordData(value.kind, value, () => [fieldData("resolution", resolutionData(value.resolution))]);
    case "place": return recordData(value.kind, value, () => [fieldData("node", nodeIdData(value.node))]);
  }
}

function placeStepData(value: Hir.HirStoragePlace["step"]): HirDataWork {
  if (value === null) return scalarData(null);
  switch (value.kind) {
    case "member": return recordData(value.kind, value, () => [fieldData("key", memberKeyData(value.key)), fieldData("origins", arrayData(value.origins, memberOriginData))]);
    case "index": return recordData(value.kind, value, () => [fieldData("expression", nodeIdData(value.expression))]);
    case "deref": return recordData(value.kind, value, () => []);
  }
}

function placeData(value: Hir.HirStoragePlace): HirDataWork {
  return recordData("HirStoragePlace", value, () => [fieldData("base", placeBaseData(value.base)), fieldData("step", placeStepData(value.step)),
    fieldData("read", capturedData(value.read, typeData)), fieldData("write", capturedData(value.write, slot => nullableData(slot, typeData)))]);
}

function geometryData(value: Hir.HirMemoryGeometryCapture): HirDataWork {
  return recordData("HirMemoryGeometryCapture", value, () => [fieldData("source", capturedData(value.source, typeData)),
    fieldData("dataLayoutExpression", nullableData(value.dataLayoutExpression, sourceRefData)), fieldData("dataLayout", capturedData(value.dataLayout, definitionData)),
    fieldData("byteSizeExpression", nullableData(value.byteSizeExpression, sourceRefData)), fieldData("byteSize", capturedData(value.byteSize, scalarData)),
    fieldData("byteAlignmentExpression", nullableData(value.byteAlignmentExpression, sourceRefData)), fieldData("byteAlignment", capturedData(value.byteAlignment, scalarData)),
    fieldData("strideExpression", nullableData(value.strideExpression, sourceRefData)), fieldData("stride", capturedData(value.stride, scalarData))]);
}

function memoryFields(value: Hir.HirMemoryLayoutCapture | Hir.HirMemoryFieldCapture): readonly HirDataField[] {
  return [fieldData("occurrence", sourceRefData(value.occurrence)), fieldData("bindings", capturedData(value.bindings, bindingsData))];
}

function memoryData(value: Hir.HirMemoryLayoutCapture | Hir.HirMemoryFieldCapture): HirDataWork {
  switch (value.kind) {
    case "data-layout": return recordData(value.kind, value, () => [...memoryFields(value),
      fieldData("declaration", capturedData(value.declaration, definitionData)), fieldData("fingerprint", capturedData(value.fingerprint, scalarData)),
      fieldData("byteOrder", capturedData(value.byteOrder, scalarData)), fieldData("addressWidth", capturedData(value.addressWidth, scalarData))]);
    case "value": return recordData(value.kind, value, () => [...memoryFields(value), fieldData("geometry", geometryData(value.geometry)),
      fieldData("fieldsExpression", nullableData(value.fieldsExpression, sourceRefData)), fieldData("fields", capturedData(value.fields, refs => arrayData(refs, sourceRefData)))]);
    case "array": return recordData(value.kind, value, () => [...memoryFields(value), fieldData("geometry", geometryData(value.geometry)),
      fieldData("extentExpression", nullableData(value.extentExpression, sourceRefData)), fieldData("length", capturedData(value.length, scalarData)),
      fieldData("runtimeBase", capturedData(value.runtimeBase, scalarData)), fieldData("elementExpression", nullableData(value.elementExpression, sourceRefData)),
      fieldData("element", capturedData(value.element, sourceRefData))]);
    case "field": return recordData(value.kind, value, () => [...memoryFields(value), fieldData("source", capturedData(value.source, typeData)),
      fieldData("selector", sourceRefData(value.selector)), fieldData("selection", capturedData(value.selection, sourceRefData)),
      fieldData("key", capturedData(value.key, memberKeyData)), fieldData("origins", capturedData(value.origins, refs => arrayData(refs, memberOriginData))),
      fieldData("selectedDeclarations", capturedData(value.selectedDeclarations, refs => arrayData(refs, definitionData))),
      fieldData("primary", capturedData(value.primary, slot => nullableData(slot, definitionData))), fieldData("value", capturedData(value.value, typeData)),
      fieldData("fieldLayoutExpression", nullableData(value.fieldLayoutExpression, sourceRefData)), fieldData("fieldLayout", capturedData(value.fieldLayout, sourceRefData)),
      fieldData("byteOffsetExpression", nullableData(value.byteOffsetExpression, sourceRefData)), fieldData("byteOffset", capturedData(value.byteOffset, scalarData)),
      fieldData("byteAlignmentExpression", nullableData(value.byteAlignmentExpression, sourceRefData)), fieldData("byteAlignment", capturedData(value.byteAlignment, scalarData))]);
  }
}

function observationData(value: Hir.HirObservationCapture): HirDataWork {
  return recordData("HirObservationCapture", value, () => [fieldData("occurrence", nodeRefData(value.occurrence)), fieldData("operation", scalarData(value.operation)),
    fieldData("bindings", capturedData(value.bindings, bindingsData)), fieldData("operand", nodeRefData(value.operand)),
    fieldData("layout", capturedData(value.layout, sourceRefData)), fieldData("selector", nullableData(value.selector, sourceRefData)),
    fieldData("field", capturedData(value.field, field => nullableData(field, sourceRefData))), fieldData("result", capturedData(value.result, typeData)),
    fieldData("value", capturedData(value.value, scalarData))]);
}

function capturedTypeData(value: Hir.HirCapturedType): HirDataWork {
  return recordData("HirCapturedType", value, () => [fieldData("type", capturedData(value.type, typeData)), fieldData("component", componentData(value.component))]);
}

function fieldMarkerData(value: Hir.HirFieldMarkerCapture): HirDataWork {
  return recordData("HirFieldMarkerCapture", value, () => [fieldData("name", scalarData(value.name)),
    fieldData("typeNode", sourceRefData(value.typeNode)), fieldData("type", capturedData(value.type, typeData)), fieldData("readonly", scalarData(value.readonly))]);
}

function markersData(value: Hir.HirMarkersCapture): HirDataWork {
  return recordData("HirMarkersCapture", value, () => [
    fieldData("struct", nullableData(value.struct, record => recordData("Record", record, () => [
      fieldData("valueType", scalarData(record.valueType)), fieldData("fields", capturedData(record.fields, fields => arrayData(fields, fieldMarkerData))),
    ]))), fieldData("field", nullableData(value.field, fieldMarkerData)),
    fieldData("defaultValue", nullableData(value.defaultValue, record => recordData("Record", record, () => [
      fieldData("typeNode", sourceRefData(record.typeNode)), fieldData("type", capturedData(record.type, typeData)),
    ]))), fieldData("jsString", scalarData(value.jsString)),
  ]);
}

function pointerTypeData(value: Hir.HirPointerTypeCapture): HirDataWork {
  switch (value.kind) {
    case "raw-address": return recordData(value.kind, value, () => []);
    case "typed-location": return recordData(value.kind, value, () => [fieldData("pointee", capturedTypeData(value.pointee)), fieldData("mutability", scalarData(value.mutability))]);
    case "native-pointer": return recordData(value.kind, value, () => [fieldData("declaration", definitionData(value.declaration))]);
    case "function-pointer": return recordData(value.kind, value, () => [fieldData("declaration", definitionData(value.declaration)),
      fieldData("parameters", arrayData(value.parameters, capturedTypeData)), fieldData("result", capturedTypeData(value.result)), fieldData("abi", arrayData(value.abi, scalarData))]);
  }
}

function integerOperandData(value: Hir.HirIntegerOperandCapture): HirDataWork {
  return recordData("HirIntegerOperandCapture", value, () => [fieldData("runtimeBase", scalarData(value.runtimeBase)),
    fieldData("signedness", scalarData(value.signedness)), fieldData("width", scalarData(value.width))]);
}

function addressIntegerData(value: Hir.HirAddressIntegerCapture): HirDataWork {
  return recordData("HirAddressIntegerCapture", value, () => [fieldData("width", scalarData(value.width)),
    fieldData("runtimeBase", scalarData(value.runtimeBase)), fieldData("signedness", scalarData(value.signedness))]);
}

function pointerOperationFields(value: Hir.HirPointerOperationCapture): readonly HirDataField[] {
  switch (value.family) {
    case "typed-location":
      switch (value.operation) {
        case "view": return [fieldData("pointer", sourceRefData(value.pointer)), fieldData("read", sourceRefData(value.read)),
          fieldData("write", sourceRefData(value.write)), fieldData("optional", scalarData(value.optional))];
        case "address-of": case "allocate": case "load": case "store": case "equal-pointer": case "hash-pointer": case "bind-pointer": case "project-pointer":
          return [fieldData("exportName", scalarData(value.exportName)), fieldData("arguments", arrayData(value.arguments, sourceRefData)),
            fieldData("typeArguments", arrayData(value.typeArguments, sourceRefData)), fieldData("selection", scalarData(value.selection)), fieldData("pointee", scalarData(value.pointee))];
      }
    case "native-pointer":
      switch (value.operation) {
        case "load": return [fieldData("pointer", sourceRefData(value.pointer))];
        case "store": return [fieldData("pointer", sourceRefData(value.pointer)), fieldData("value", sourceRefData(value.value))];
        case "offset": return [fieldData("pointer", sourceRefData(value.pointer)), fieldData("offset", sourceRefData(value.offset))];
      }
    case "raw-address":
      switch (value.operation) {
        case "bind-raw-pointer": return [fieldData("identity", sourceRefData(value.identity))];
        case "equal-raw-pointer": return [fieldData("left", sourceRefData(value.left)), fieldData("right", sourceRefData(value.right))];
        case "hash-raw-pointer": return [fieldData("pointer", sourceRefData(value.pointer))];
      }
    case "raw-memory":
      switch (value.operation) {
        case "to-raw": return [fieldData("pointer", sourceRefData(value.pointer)), fieldData("layout", sourceRefData(value.layout))];
        case "reinterpret": return [fieldData("raw", sourceRefData(value.raw)), fieldData("layout", sourceRefData(value.layout))];
        case "byte-offset": return [fieldData("raw", sourceRefData(value.raw)), fieldData("offset", sourceRefData(value.offset)),
          fieldData("integer", integerOperandData(value.integer)), fieldData("dataLayout", sourceRefData(value.dataLayout))];
        case "raw-to-address-integer": return [fieldData("raw", sourceRefData(value.raw)), fieldData("integer", addressIntegerData(value.integer)), fieldData("dataLayout", sourceRefData(value.dataLayout))];
        case "address-integer-to-raw": return [fieldData("address", sourceRefData(value.address)), fieldData("integer", addressIntegerData(value.integer)), fieldData("dataLayout", sourceRefData(value.dataLayout))];
      }
    case "keep-alive": return [fieldData("value", sourceRefData(value.value))];
  }
}

function pointerOperationData(value: Hir.HirPointerOperationCapture): HirDataWork {
  return recordData("HirPointerOperationCapture", value, () => [fieldData("family", scalarData(value.family)),
    fieldData("operation", scalarData(value.operation)), ...pointerOperationFields(value)]);
}

function fieldBindingData(value: Hir.HirFieldBindingCapture): HirDataWork {
  return recordData("HirFieldBindingCapture", value, () => [fieldData("occurrence", nodeRefData(value.occurrence)),
    fieldData("bindings", capturedData(value.bindings, bindingsData)), fieldData("owner", capturedData(value.owner, typeData)),
    fieldData("pointee", capturedData(value.pointee, typeData)), fieldData("fieldExpression", nodeRefData(value.fieldExpression)),
    fieldData("field", capturedData(value.field, sourceRefData)), fieldData("pointerExpression", nodeRefData(value.pointerExpression))]);
}

function recordFieldBindingData(value: Hir.HirRecordFieldBindingCapture): HirDataWork {
  return recordData("HirRecordFieldBindingCapture", value, () => [fieldData("expression", nodeRefData(value.expression)),
    fieldData("binding", nodeRefData(value.binding))]);
}

function recordBindingData(value: Hir.HirRecordBindingCapture): HirDataWork {
  return recordData("HirRecordBindingCapture", value, () => [fieldData("occurrence", nodeRefData(value.occurrence)),
    fieldData("bindings", capturedData(value.bindings, bindingsData)), fieldData("source", capturedData(value.source, typeData)),
    fieldData("layoutExpression", nodeRefData(value.layoutExpression)), fieldData("layout", capturedData(value.layout, sourceRefData)),
    fieldData("fields", arrayData(value.fields, recordFieldBindingData))]);
}

function attributeCaptureData(value: Hir.HirAttributeCapture): HirDataWork {
  return recordData(value.kind, value, () => [
    fieldData("occurrence", sourceRefData(value.occurrence)), fieldData("applicationTarget", sourceRefData(value.applicationTarget)),
    fieldData("selectedMember", nullableData(value.selectedMember, record => recordData("Record", record, () => [
      fieldData("selectedDeclaration", nullableData(record.selectedDeclaration, sourceRefData)),
      fieldData("declarations", arrayData(record.declarations, sourceRefData)),
    ]))), fieldData("applicationMemberKind", scalarData(value.applicationMemberKind)), fieldData("applicationPlacement", scalarData(value.applicationPlacement)),
    fieldData("applicationParameterName", scalarData(value.applicationParameterName)), fieldData("applicationTargetSpecifier", scalarData(value.applicationTargetSpecifier)),
    ...attributeInvocationFields(value),
  ]);
}

function attributeInvocationFields(value: Hir.HirAttributeCapture): readonly HirDataField[] {
  switch (value.kind) {
    case "builder-state": return [];
    case "application": return [fieldData("invocation", sourceRefData(value.invocation))];
  }
}

function safetySelectionData(value: Hir.HirSafetySelectionCapture): HirDataWork {
  switch (value.kind) {
    case "unavailable": return recordData(value.kind, value, () => [fieldData("reason", scalarData(value.reason))]);
    case "selected": return recordData(value.kind, value, () => [fieldData("expression", sourceRefData(value.expression)),
      fieldData("declaration", nullableData(value.declaration, sourceRefData)), fieldData("declarations", arrayData(value.declarations, sourceRefData))]);
  }
}

function safetyFields(value: Hir.HirSafetyCapture): readonly HirDataField[] {
  switch (value.operation) {
    case "expression": return [fieldData("expression", sourceRefData(value.expression))];
    case "remaining-block": return [fieldData("firstDirectStatement", scalarData(value.firstDirectStatement))];
    case "root": return [fieldData("form", scalarData(value.form)), fieldData("target", nullableData(value.target, sourceRefData))];
    case "select-member": return [fieldData("predecessor", nullableData(value.predecessor, sourceRefData)),
      fieldData("memberKind", scalarData(value.memberKind)), fieldData("selection", safetySelectionData(value.selection))];
    case "placement": return [fieldData("predecessor", nullableData(value.predecessor, sourceRefData)), fieldData("placement", scalarData(value.placement))];
    case "apply": return [fieldData("predecessor", nullableData(value.predecessor, sourceRefData)), fieldData("contract", scalarData(value.contract))];
  }
}

function safetyData(value: Hir.HirSafetyCapture): HirDataWork {
  return recordData("HirSafetyCapture", value, () => [fieldData("occurrence", sourceRefData(value.occurrence)), fieldData("provider", definitionData(value.provider)),
    fieldData("family", scalarData(value.family)), fieldData("operation", scalarData(value.operation)), ...safetyFields(value)]);
}

function argumentPassingData(value: Hir.HirArgumentPassingCapture): HirDataWork {
  switch (value.role) {
    case "declaration": return recordData("HirArgumentPassingCapture", value, () => [fieldData("role", scalarData(value.role)), fieldData("mode", scalarData(value.mode))]);
    case "argument": return recordData("HirArgumentPassingCapture", value, () => [fieldData("role", scalarData(value.role)),
      fieldData("mode", scalarData(value.mode)), fieldData("storageExpression", sourceRefData(value.storageExpression))]);
  }
}

export function hirCoreData(value: Hir.HirCoreCapture): HirDataWork {
  return recordData("HirCoreCapture", value, () => [fieldData("provider", capturedData(value.provider, provider => nullableData(provider, definitionData))),
    fieldData("markers", capturedData(value.markers, markersData)),
    fieldData("pointerType", capturedData(value.pointerType, pointer => nullableData(pointer, pointerTypeData))),
    fieldData("pointerOperation", capturedData(value.pointerOperation, operation => nullableData(operation, pointerOperationData))),
    fieldData("fieldBinding", capturedData(value.fieldBinding, binding => nullableData(binding, fieldBindingData))),
    fieldData("recordBinding", capturedData(value.recordBinding, binding => nullableData(binding, recordBindingData))),
    fieldData("attribute", capturedData(value.attribute, attribute => nullableData(attribute, attributeCaptureData))),
    fieldData("safety", capturedData(value.safety, safety => nullableData(safety, safetyData))),
    fieldData("argumentPassing", capturedData(value.argumentPassing, passing => nullableData(passing, argumentPassingData))),
    fieldData("flowState", capturedData(value.flowState, scalarData))]);
}

function valueFields(value: Hir.CheckedValue): readonly HirDataField[] {
  return [fieldData("views", viewsData(value.views)), fieldData("place", capturedData(value.place, place => nullableData(place, placeData))),
    fieldData("memory", capturedData(value.memory, memory => nullableData(memory, memoryData))),
    fieldData("observation", capturedData(value.observation, observation => nullableData(observation, observationData)))];
}

function coreFields(value: Hir.HirCoreCarrier): readonly HirDataField[] { return [fieldData("core", hirCoreData(value.core))]; }

function valueData(value: Hir.CheckedValue): HirDataWork { return recordData("CheckedValue", value, () => valueFields(value)); }
function expressionData(value: Hir.CheckedExpression): HirDataWork { return recordData("CheckedExpression", value, () => [...valueFields(value), ...coreFields(value)]); }

function propertyFields(value: Hir.CheckedProperty): readonly HirDataField[] {
  return [fieldData("key", capturedData(value.key, memberKeyData)), fieldData("origins", capturedData(value.origins, origins => arrayData(origins, memberOriginData)))];
}

function declarationTargetData(value: Hir.DeclarationTarget): HirDataWork {
  switch (value.kind) {
    case "local": return recordData(value.kind, value, () => [fieldData("local", localRefData(value.local))]);
    case "definition": return recordData(value.kind, value, () => [fieldData("definition", definitionData(value.definition))]);
  }
}

function literalFields(value: Hir.CheckedLiteral): readonly HirDataField[] {
  switch (value.role) {
    case "value": return [fieldData("value", valueData(value.value)), fieldData("literal", literalData(value.literal))];
    case "property-name": return propertyFields(value);
    case "declaration-name": return [fieldData("declaration", declarationTargetData(value.declaration))];
    case "type-literal": return [fieldData("type", capturedData(value.type, typeData)), fieldData("literal", literalTypeData(value.literal))];
    case "module-specifier": return [fieldData("target", capturedData(value.target, importTargetData))];
    case "export-name": return [fieldData("definition", capturedData(value.definition, definitionData))];
    case "attribute-value": return [fieldData("literal", literalData(value.literal))];
  }
}

function checkedLiteralData(value: Hir.CheckedLiteral): HirDataWork {
  return recordData("CheckedLiteral", value, () => [...coreFields(value), fieldData("role", scalarData(value.role)), ...literalFields(value)]);
}

function nameFields(value: Hir.CheckedName): readonly HirDataField[] {
  switch (value.role) {
    case "value": return [fieldData("value", valueData(value.value)), fieldData("resolution", resolutionData(value.resolution))];
    case "assignment-target": return [fieldData("resolution", resolutionData(value.resolution)), fieldData("views", viewsData(value.views)),
      fieldData("place", capturedData(value.place, placeData)), fieldData("access", scalarData(value.access))];
    case "declaration-name": return [fieldData("declaration", declarationTargetData(value.declaration))];
    case "property-name": return propertyFields(value);
    case "type-name": return [fieldData("resolution", resolutionData(value.resolution))];
    case "label": return [fieldData("target", nullableData(value.target, nodeRefData))];
    case "private-name": return [fieldData("declaration", definitionData(value.declaration))];
    case "shorthand-value": return [fieldData("value", valueData(value.value)), fieldData("resolution", resolutionData(value.resolution)), fieldData("key", capturedData(value.key, memberKeyData))];
  }
}

function nameData(value: Hir.CheckedName): HirDataWork {
  return recordData("CheckedName", value, () => [...coreFields(value), fieldData("role", scalarData(value.role)), ...nameFields(value)]);
}

function binaryFields(value: Hir.CheckedBinary): readonly HirDataField[] {
  switch (value.role) {
    case "arithmetic": case "comparison": case "short-circuit": case "sequence": return [fieldData("value", valueData(value.value))];
    case "assignment": return [fieldData("value", valueData(value.value)), fieldData("target", capturedData(value.target, placeData))];
  }
}

function binaryData(value: Hir.CheckedBinary): HirDataWork {
  return recordData("CheckedBinary", value, () => [...coreFields(value), fieldData("role", scalarData(value.role)), ...binaryFields(value)]);
}

function unaryFields(value: Hir.CheckedUnary): readonly HirDataField[] {
  switch (value.role) {
    case "value": return [fieldData("value", valueData(value.value))];
    case "update": return [fieldData("value", valueData(value.value)), fieldData("target", capturedData(value.target, placeData))];
    case "type-literal": return [fieldData("type", capturedData(value.type, typeData)), fieldData("literal", literalTypeData(value.literal))];
  }
}

function unaryData(value: Hir.CheckedUnary): HirDataWork {
  return recordData("CheckedUnary", value, () => [...coreFields(value), fieldData("role", scalarData(value.role)), ...unaryFields(value)]);
}

function keywordData(value: Hir.CheckedKeyword): HirDataWork {
  switch (value.role) {
    case "value": return recordData("CheckedKeyword", value, () => [...coreFields(value), fieldData("role", scalarData(value.role)), fieldData("value", valueData(value.value))]);
    case "type-literal": return recordData("CheckedKeyword", value, () => [...coreFields(value), fieldData("role", scalarData(value.role)),
      fieldData("type", capturedData(value.type, typeData)), fieldData("literal", literalTypeData(value.literal))]);
  }
}

function instantiationData(value: Hir.CheckedInstantiation): HirDataWork {
  switch (value.role) {
    case "value": return recordData("CheckedInstantiation", value, () => [...coreFields(value), fieldData("role", scalarData(value.role)), fieldData("value", valueData(value.value))]);
    case "heritage": return recordData("CheckedInstantiation", value, () => [...coreFields(value), fieldData("role", scalarData(value.role)),
      fieldData("type", capturedData(value.type, typeData)), fieldData("definition", capturedData(value.definition, definitionData))]);
  }
}

function aggregateData(value: Hir.CheckedAggregate): HirDataWork {
  switch (value.role) {
    case "value": return recordData("CheckedAggregate", value, () => [...coreFields(value), fieldData("role", scalarData(value.role)), fieldData("value", valueData(value.value))]);
    case "assignment-pattern": return recordData("CheckedAggregate", value, () => [...coreFields(value), fieldData("role", scalarData(value.role)), fieldData("views", viewsData(value.views))]);
  }
}

function applicationNodeData(value: Hir.CheckedApplication): HirDataWork {
  return recordData("CheckedApplication", value, () => [...valueFields(value), ...coreFields(value), fieldData("application", capturedData(value.application, applicationData))]);
}

function memberFields(value: Hir.CheckedMember): readonly HirDataField[] {
  switch (value.role) {
    case "value": return [fieldData("value", valueData(value.value))];
    case "assignment-target": return [fieldData("views", viewsData(value.views)), fieldData("place", capturedData(value.place, placeData)), fieldData("access", scalarData(value.access))];
  }
}

function memberData(value: Hir.CheckedMember): HirDataWork {
  return recordData("CheckedMember", value, () => [...coreFields(value), fieldData("role", scalarData(value.role)), ...memberFields(value),
    fieldData("origins", capturedData(value.origins, origins => arrayData(origins, memberOriginData))),
    fieldData("accessor", capturedData(value.accessor, accessor => nullableData(accessor, applicationData)))]);
}

function protocolNodeData(value: Hir.CheckedProtocol): HirDataWork {
  return recordData("CheckedProtocol", value, () => [...valueFields(value), ...coreFields(value), fieldData("protocol", capturedData(value.protocol, protocolData))]);
}

function closureData(value: Hir.CheckedClosure): HirDataWork {
  return recordData("CheckedClosure", value, () => [...valueFields(value), ...coreFields(value), fieldData("body", bodyData(value.body)), fieldData("captures", arrayData(value.captures, localRefData))]);
}

function checkedTypeData(value: Hir.CheckedType): HirDataWork {
  return recordData("CheckedType", value, () => [...coreFields(value), fieldData("type", capturedData(value.type, typeData)), fieldData("referencedDefinitions", arrayData(value.referencedDefinitions, definitionData))]);
}

function declarationOwnerFields(value: Hir.CheckedDeclarationFacts): readonly HirDataField[] {
  return [fieldData("parent", nullableData(value.parent, definitionData)), fieldData("attributes", arrayData(value.attributes, attributeData))];
}

function declarationFactsFields(value: Hir.CheckedDeclarationFacts): readonly HirDataField[] {
  return [...coreFields(value), ...declarationOwnerFields(value), fieldData("memory", capturedData(value.memory, memory => nullableData(memory, memoryData)))];
}

function declarationFields(value: Hir.CheckedDeclaration): readonly HirDataField[] {
  return [...declarationFactsFields(value), fieldData("definition", definitionData(value.definition))];
}

function callableData(value: Hir.CheckedCallable): HirDataWork {
  return recordData("CheckedCallable", value, () => [...declarationFields(value), fieldData("parameters", arrayData(value.parameters, parameterData)),
    fieldData("signatures", arrayData(value.signatures, endpointData)), fieldData("body", nullableData(value.body, bodyData))]);
}

function heritageData(value: Hir.HirHeritage): HirDataWork {
  return recordData("HirHeritage", value, () => [fieldData("role", scalarData(value.role)), fieldData("type", typeData(value.type))]);
}

function classFields(value: Hir.CheckedClass): readonly HirDataField[] {
  return [fieldData("parameters", arrayData(value.parameters, parameterData)), fieldData("heritage", arrayData(value.heritage, heritageData)), fieldData("members", arrayData(value.members, definitionData))];
}

function classData(value: Hir.CheckedClass): HirDataWork { return recordData("CheckedClass", value, () => [...declarationFields(value), ...classFields(value)]); }
function classExpressionData(value: Hir.CheckedClassExpression): HirDataWork {
  return recordData("CheckedClassExpression", value, () => [...valueFields(value), ...coreFields(value), ...declarationOwnerFields(value),
    fieldData("definition", definitionData(value.definition)), ...classFields(value)]);
}

function typeAliasData(value: Hir.CheckedTypeAlias): HirDataWork {
  return recordData("CheckedTypeAlias", value, () => [...declarationFields(value), fieldData("parameters", arrayData(value.parameters, parameterData)), fieldData("type", capturedData(value.type, typeData))]);
}

function variableData(value: Hir.CheckedVariable): HirDataWork {
  return recordData("CheckedVariable", value, () => [...declarationFactsFields(value), fieldData("declaration", declarationTargetData(value.declaration)),
    fieldData("declaredType", capturedData(value.declaredType, slot => nullableData(slot, typeData))), fieldData("initializer", nullableData(value.initializer, bodyData))]);
}

function enumData(value: Hir.CheckedEnum): HirDataWork { return recordData("CheckedEnum", value, () => [...declarationFields(value), fieldData("members", arrayData(value.members, definitionData))]); }
function namespaceData(value: Hir.CheckedNamespace): HirDataWork { return recordData("CheckedNamespace", value, () => [...declarationFields(value), fieldData("members", arrayData(value.members, definitionData))]); }

function importBindingData(value: Hir.HirImportBinding): HirDataWork {
  return recordData("HirImportBinding", value, () => [fieldData("local", definitionData(value.local)), fieldData("imported", capturedData(value.imported, definitionData))]);
}

function importData(value: Hir.CheckedImport): HirDataWork {
  return recordData("CheckedImport", value, () => [...declarationFields(value), fieldData("target", capturedData(value.target, importTargetData)), fieldData("bindings", arrayData(value.bindings, importBindingData))]);
}

function exportBindingData(value: Hir.HirExportBinding): HirDataWork {
  return recordData("HirExportBinding", value, () => [fieldData("name", scalarData(value.name)), fieldData("definition", capturedData(value.definition, definitionData))]);
}

function exportData(value: Hir.CheckedExport): HirDataWork {
  return recordData("CheckedExport", value, () => [...declarationFields(value), fieldData("exports", arrayData(value.exports, exportBindingData)),
    fieldData("target", capturedData(value.target, target => nullableData(target, importTargetData)))]);
}

function staticBlockData(value: Hir.CheckedStaticBlock): HirDataWork { return recordData("CheckedStaticBlock", value, () => [...declarationFields(value), fieldData("body", bodyData(value.body))]); }
function propertyData(value: Hir.CheckedProperty): HirDataWork { return recordData("CheckedProperty", value, () => [...coreFields(value), ...propertyFields(value)]); }
function bindingData(value: Hir.CheckedBinding): HirDataWork {
  return recordData("CheckedBinding", value, () => [...coreFields(value), fieldData("declaration", nullableData(value.declaration, declarationTargetData)),
    fieldData("declaredType", capturedData(value.declaredType, slot => nullableData(slot, typeData)))]);
}
function bindingListData(value: Hir.CheckedBindingList): HirDataWork {
  return recordData("CheckedBindingList", value, () => [...coreFields(value), fieldData("disposal", arrayData(value.disposal, fact => capturedData(fact, protocolData)))]);
}
function iterationData(value: Hir.CheckedIteration): HirDataWork {
  return recordData("CheckedIteration", value, () => [...coreFields(value), fieldData("protocol", capturedData(value.protocol, fact => nullableData(fact, protocolData)))]);
}
function moduleMetadataData(value: Hir.CheckedModule): HirDataWork { return recordData("CheckedModule", value, () => [...declarationFields(value), fieldData("body", bodyData(value.body))]); }
function typeParameterData(value: Hir.CheckedTypeParameter): HirDataWork { return recordData("CheckedTypeParameter", value, () => [...declarationFields(value), fieldData("parameter", parameterData(value.parameter))]); }

export function hirCheckedData(node: Hir.HirNode): HirDataWork {
  switch (node.kind) {
    case "Identifier": case "PrivateIdentifier": case "QualifiedName":
      return nameData(node.tsonic);
    case "ComputedPropertyName": case "PropertyAssignment": case "ShorthandPropertyAssignment": case "ImportAttribute":
      return propertyData(node.tsonic);
    case "Decorator": case "EmptyStatement": case "IfStatement": case "DoStatement":
    case "WhileStatement": case "ForStatement": case "BreakStatement": case "ContinueStatement":
    case "ReturnStatement": case "WithStatement": case "SwitchStatement": case "CaseBlock":
    case "CaseClause": case "DefaultClause": case "ThrowStatement": case "TryStatement":
    case "CatchClause": case "DebuggerStatement": case "LabeledStatement": case "ExpressionStatement":
    case "Block": case "VariableStatement": case "MissingDeclaration": case "HeritageClause":
    case "ModuleBlock": case "NotEmittedStatement": case "NotEmittedTypeElement": case "ExternalModuleReference":
    case "NamedImports": case "NamedExports": case "SemicolonClassElement": case "TemplateSpan":
    case "SpreadAssignment": case "ImportAttributes": case "TemplateHead": case "TemplateMiddle":
    case "TemplateTail": case "JsxAttribute": case "JsxSpreadAttribute": case "JsxClosingElement":
    case "SyntaxList": case "JSDoc": case "JSDocTypeTag": case "JSDocUnknownTag":
    case "JSDocTemplateTag": case "JSDocReturnTag": case "JSDocPublicTag": case "JSDocPrivateTag":
    case "JSDocProtectedTag": case "JSDocReadonlyTag": case "JSDocOverrideTag": case "JSDocDeprecatedTag":
    case "JSDocSeeTag": case "JSDocImplementsTag": case "JSDocAugmentsTag": case "JSDocSatisfiesTag":
    case "JSDocThrowsTag": case "JSDocThisTag": case "JSDocImportTag": case "JSDocCallbackTag":
    case "JSDocOverloadTag": case "JSDocTypedefTag": case "JSDocText": case "JSDocLink":
    case "JSDocLinkPlain": case "JSDocLinkCode": case "JSDocParameterTag": case "JSDocPropertyTag":
    case "Unknown": case "EndOfFile": case "SingleLineCommentTrivia": case "MultiLineCommentTrivia":
    case "NewLineTrivia": case "WhitespaceTrivia": case "ConflictMarkerTrivia": case "NonTextFileMarkerTrivia":
    case "JsxTextAllWhiteSpaces": case "OpenBraceToken": case "CloseBraceToken": case "OpenParenToken":
    case "CloseParenToken": case "OpenBracketToken": case "CloseBracketToken": case "DotToken":
    case "DotDotDotToken": case "SemicolonToken": case "CommaToken": case "QuestionDotToken":
    case "LessThanToken": case "LessThanSlashToken": case "GreaterThanToken": case "LessThanEqualsToken":
    case "GreaterThanEqualsToken": case "EqualsEqualsToken": case "ExclamationEqualsToken": case "EqualsEqualsEqualsToken":
    case "ExclamationEqualsEqualsToken": case "EqualsGreaterThanToken": case "PlusToken": case "MinusToken":
    case "AsteriskToken": case "AsteriskAsteriskToken": case "SlashToken": case "PercentToken":
    case "PlusPlusToken": case "MinusMinusToken": case "LessThanLessThanToken": case "GreaterThanGreaterThanToken":
    case "GreaterThanGreaterThanGreaterThanToken": case "AmpersandToken": case "BarToken": case "CaretToken":
    case "ExclamationToken": case "TildeToken": case "AmpersandAmpersandToken": case "BarBarToken":
    case "QuestionToken": case "ColonToken": case "AtToken": case "QuestionQuestionToken":
    case "BacktickToken": case "HashToken": case "EqualsToken": case "PlusEqualsToken":
    case "MinusEqualsToken": case "AsteriskEqualsToken": case "AsteriskAsteriskEqualsToken": case "SlashEqualsToken":
    case "PercentEqualsToken": case "LessThanLessThanEqualsToken": case "GreaterThanGreaterThanEqualsToken": case "GreaterThanGreaterThanGreaterThanEqualsToken":
    case "AmpersandEqualsToken": case "BarEqualsToken": case "BarBarEqualsToken": case "AmpersandAmpersandEqualsToken":
    case "QuestionQuestionEqualsToken": case "CaretEqualsToken": case "JSDocCommentTextToken": case "BreakKeyword":
    case "CaseKeyword": case "CatchKeyword": case "ClassKeyword": case "ConstKeyword":
    case "ContinueKeyword": case "DebuggerKeyword": case "DefaultKeyword": case "DeleteKeyword":
    case "DoKeyword": case "ElseKeyword": case "EnumKeyword": case "ExportKeyword":
    case "ExtendsKeyword": case "FinallyKeyword": case "ForKeyword": case "FunctionKeyword":
    case "IfKeyword": case "InKeyword": case "InstanceOfKeyword": case "NewKeyword":
    case "ReturnKeyword": case "SwitchKeyword": case "ThrowKeyword": case "TryKeyword":
    case "TypeOfKeyword": case "VarKeyword": case "WhileKeyword": case "WithKeyword":
    case "ImplementsKeyword": case "InterfaceKeyword": case "LetKeyword": case "PackageKeyword":
    case "PrivateKeyword": case "ProtectedKeyword": case "PublicKeyword": case "StaticKeyword":
    case "YieldKeyword": case "AbstractKeyword": case "AccessorKeyword": case "AsKeyword":
    case "AssertsKeyword": case "AssertKeyword": case "AsyncKeyword": case "AwaitKeyword":
    case "ConstructorKeyword": case "DeclareKeyword": case "GetKeyword": case "ImmediateKeyword":
    case "InferKeyword": case "IsKeyword": case "KeyOfKeyword": case "ModuleKeyword":
    case "NamespaceKeyword": case "OutKeyword": case "ReadonlyKeyword": case "RequireKeyword":
    case "SatisfiesKeyword": case "SetKeyword": case "TypeKeyword": case "UniqueKeyword":
    case "UsingKeyword": case "FromKeyword": case "GlobalKeyword": case "OverrideKeyword":
    case "OfKeyword": case "DeferKeyword":
      return scalarData(node.tsonic);
    case "ForInStatement": case "ForOfStatement":
      return iterationData(node.tsonic);
    case "VariableDeclaration": case "Parameter": case "EnumMember": case "PropertySignature":
    case "PropertyDeclaration":
      return variableData(node.tsonic);
    case "VariableDeclarationList":
      return bindingListData(node.tsonic);
    case "ObjectBindingPattern": case "ArrayBindingPattern": case "BindingElement":
      return bindingData(node.tsonic);
    case "FunctionDeclaration": case "CallSignature": case "ConstructSignature": case "Constructor":
    case "GetAccessor": case "SetAccessor": case "IndexSignature": case "MethodSignature":
    case "MethodDeclaration":
      return callableData(node.tsonic);
    case "ClassDeclaration": case "InterfaceDeclaration":
      return classData(node.tsonic);
    case "ClassExpression":
      return classExpressionData(node.tsonic);
    case "TypeAliasDeclaration": case "JSTypeAliasDeclaration":
      return typeAliasData(node.tsonic);
    case "EnumDeclaration":
      return enumData(node.tsonic);
    case "ImportDeclaration": case "JSImportDeclaration": case "NamespaceImport": case "ImportEqualsDeclaration":
    case "ImportClause": case "ImportSpecifier":
      return importData(node.tsonic);
    case "ExportAssignment": case "NamespaceExportDeclaration": case "NamespaceExport": case "ExportSpecifier":
    case "ExportDeclaration":
      return exportData(node.tsonic);
    case "ClassStaticBlockDeclaration":
      return staticBlockData(node.tsonic);
    case "OmittedExpression": case "RegularExpressionLiteral": case "AsExpression": case "SatisfiesExpression":
    case "ConditionalExpression": case "MetaProperty": case "NonNullExpression": case "TemplateExpression":
    case "ParenthesizedExpression": case "DeleteExpression": case "TypeOfExpression": case "VoidExpression":
    case "TypeAssertionExpression": case "PartiallyEmittedExpression": case "JsxElement": case "JsxAttributes":
    case "JsxNamespacedName": case "JsxOpeningElement": case "JsxSelfClosingElement": case "JsxFragment":
    case "JsxOpeningFragment": case "JsxClosingFragment": case "JsxExpression": case "JsxText":
    case "SyntheticReferenceExpression":
      return expressionData(node.tsonic);
    case "StringLiteral": case "NumericLiteral": case "BigIntLiteral": case "NoSubstitutionTemplateLiteral":
      return checkedLiteralData(node.tsonic);
    case "BinaryExpression":
      return binaryData(node.tsonic);
    case "PrefixUnaryExpression": case "PostfixUnaryExpression":
      return unaryData(node.tsonic);
    case "YieldExpression": case "SpreadElement": case "AwaitExpression":
      return protocolNodeData(node.tsonic);
    case "ArrowFunction": case "FunctionExpression":
      return closureData(node.tsonic);
    case "PropertyAccessExpression": case "ElementAccessExpression":
      return memberData(node.tsonic);
    case "CallExpression": case "NewExpression": case "TaggedTemplateExpression":
      return applicationNodeData(node.tsonic);
    case "ArrayLiteralExpression": case "ObjectLiteralExpression":
      return aggregateData(node.tsonic);
    case "UnionType": case "IntersectionType": case "ConditionalType": case "TypeOperator":
    case "InferType": case "ArrayType": case "IndexedAccessType": case "TypeReference":
    case "LiteralType": case "ThisType": case "TypePredicate": case "TypeQuery":
    case "MappedType": case "TypeLiteral": case "TupleType": case "NamedTupleMember":
    case "OptionalType": case "RestType": case "ParenthesizedType": case "FunctionType":
    case "ConstructorType": case "TemplateLiteralType": case "TemplateLiteralTypeSpan": case "JSDocTypeExpression":
    case "JSDocNonNullableType": case "JSDocNullableType": case "JSDocAllType": case "JSDocVariadicType":
    case "JSDocOptionalType": case "JSDocSignature": case "JSDocNameReference": case "ImportType":
    case "JSDocTypeLiteral": case "AnyKeyword": case "BigIntKeyword": case "BooleanKeyword":
    case "IntrinsicKeyword": case "NeverKeyword": case "NumberKeyword": case "ObjectKeyword":
    case "StringKeyword": case "SymbolKeyword": case "UndefinedKeyword": case "UnknownKeyword":
    case "VoidKeyword":
      return checkedTypeData(node.tsonic);
    case "ExpressionWithTypeArguments":
      return instantiationData(node.tsonic);
    case "SourceFile":
      return moduleMetadataData(node.tsonic);
    case "ModuleDeclaration":
      return namespaceData(node.tsonic);
    case "TypeParameter":
      return typeParameterData(node.tsonic);
    case "NullKeyword": case "TrueKeyword": case "FalseKeyword": case "ThisKeyword":
    case "SuperKeyword": case "ImportKeyword":
      return keywordData(node.tsonic);
  }
}

export function hirNodeData(value: Hir.HirNode): HirRecordWork { return hirSyntaxData(value, hirCheckedData); }

function declarationEntryData(value: Hir.HirDeclarationEntry): HirDataWork {
  return recordData("HirDeclarationEntry", value, () => [fieldData("definition", definitionData(value.definition)), fieldData("node", nodeIdData(value.node))]);
}

function localData(value: Hir.HirLocal): HirDataWork {
  return recordData("HirLocal", value, () => [fieldData("id", localIdData(value.id)), fieldData("declaration", sourceRefData(value.declaration)),
    fieldData("name", scalarData(value.name)), fieldData("role", scalarData(value.role)), fieldData("checkerSlot", capturedData(value.checkerSlot, typeData)),
    fieldData("capturedFrom", nullableData(value.capturedFrom, localRefData)), fieldData("mutable", scalarData(value.mutable))]);
}

function formalData(value: Hir.HirParam): HirDataWork {
  return recordData("HirParam", value, () => [fieldData("local", localIdData(value.local)), fieldData("declaration", definitionData(value.declaration)),
    fieldData("role", scalarData(value.role)), fieldData("passing", scalarData(value.passing)), fieldData("initializer", nullableData(value.initializer, bodyData))]);
}

function lexicalScopeData(value: Hir.HirLexicalScope): HirDataWork {
  return recordData("HirLexicalScope", value, () => [fieldData("node", nodeIdData(value.node)), fieldData("parent", nullableData(value.parent, nodeIdData)),
    fieldData("attributes", arrayData(value.attributes, attributeData))]);
}

export function hirBodyData(value: Hir.HirBody): HirDataWork {
  return recordData("HirBody", value, () => [fieldData("body", bodyData(value.body)), fieldData("owner", definitionData(value.owner)),
    fieldData("params", arrayData(value.params, formalData)), fieldData("locals", arrayData(value.locals, localData)),
    fieldData("root", hirNodeData(value.root)), fieldData("captures", arrayData(value.captures, localRefData)),
    fieldData("scopes", arrayData(value.scopes, lexicalScopeData)), fieldData("asynchronous", scalarData(value.asynchronous)),
    fieldData("generator", scalarData(value.generator)), fieldData("candidateLists", arrayData(value.candidateLists, candidateListData)),
    fieldData("nestedBodies", arrayData(value.nestedBodies, bodyData))]);
}

function obligationData(value: Hir.ProofObligation): HirDataWork {
  switch (value.kind) {
    case "write-fit": return recordData(value.kind, value, () => [fieldData("ordinal", scalarData(value.ordinal)),
      fieldData("occurrence", nodeRefData(value.occurrence)), fieldData("value", nodeRefData(value.value)),
      fieldData("destination", sourceRefData(value.destination)), fieldData("destinationType", typeData(value.destinationType))]);
    case "operator": return recordData(value.kind, value, () => [fieldData("ordinal", scalarData(value.ordinal)),
      fieldData("occurrence", nodeRefData(value.occurrence)), fieldData("operator", scalarData(value.operator)), fieldData("operands", arrayData(value.operands, nodeRefData))]);
    case "index": return recordData(value.kind, value, () => [fieldData("ordinal", scalarData(value.ordinal)),
      fieldData("occurrence", nodeRefData(value.occurrence)), fieldData("receiver", nodeRefData(value.receiver)), fieldData("key", nodeRefData(value.key))]);
  }
}

function diagnosticRootData(value: Hir.HirDiagnosticRoot): HirDataWork {
  return recordData("HirDiagnosticRoot", value, () => [fieldData("diagnostic", scalarData(value.diagnostic)),
    fieldData("owner", sourceRefData(value.owner)), fieldData("obligations", arrayData(value.obligations, obligationData))]);
}

export function hirItemsData(value: readonly Hir.HirDeclarationEntry[]): HirDataWork { return arrayData(value, declarationEntryData); }
export function hirDiagnosticsData(value: readonly Diag.Diagnostic[]): HirDataWork { return arrayData(value, diagnosticData); }
export function hirObligationsData(value: readonly Hir.HirDiagnosticRoot[]): HirDataWork { return arrayData(value, diagnosticRootData); }

export function hirModuleData(value: Hir.HirModule): HirRecordWork {
  return recordData("HirModule", value, () => [fieldData("module", identityData("mod", value.module)), fieldData("tree", hirNodeData(value.tree)),
    fieldData("items", hirItemsData(value.items)), fieldData("bodies", arrayData(value.bodies, hirBodyData)),
    fieldData("checkerDiagnostics", hirDiagnosticsData(value.checkerDiagnostics)), fieldData("obligations", hirObligationsData(value.obligations))]);
}

