import type { ModuleId, NodeId, NodeRef, SourceNodeRef } from "../ids/contract.js";
import type { HirFieldBindingCapture, HirMemoryFieldCapture, HirMemoryLayoutCapture, HirNode, HirObservationCapture, HirRecordBindingCapture,
  HirSite, HirStoragePlace } from "./contract.js";
import type { HirBindingRequest, HirSourceNode } from "./verify-bindings.js";
import type { HirChoiceShape, HirField, HirInventory, HirNodeEntry, HirRecordShape, HirReport, HirSchema, HirShape } from "./verify-syntax.js";
import { hirCoreData } from "./text-data.js";
import { hirArray, hirChoice, hirDiscriminant, hirNumericIdentity, hirStringIdentity, hirLiteral, hirNullable, hirRecord, hirVariant,
  createSyntaxSchema, hirRecordChoices, walkHirData } from "./verify-syntax.js";

function captured(value: HirShape): HirChoiceShape {
  return hirChoice(hirVariant("available", [["value", value]]),
    hirVariant("unavailable", [["reason", hirLiteral("checker-error", "parameter-dependent", "not-provided")]]));
}

function variants(name: string, field: string, arms: readonly (readonly [string | number, readonly HirField[]])[],
  common: readonly HirField[] = []): HirChoiceShape {
  return hirChoice(...arms.map(([value, fields]) => hirRecord(field === "kind" ? String(value) : name,
    [...common, hirDiscriminant(field, value), ...fields])));
}

export function createHirSchema(): HirSchema {
  const range: readonly HirField[] = ([["pos", "number"], ["end", "number"]]);
  const parameterIdentity: HirShape = "TypeParameterIdentity";
  const origin: HirShape = "Origin";
  const sourceReference: HirShape = "SourceNodeRef";
  const core: readonly HirField[] = ([["core", "HirCoreCapture"]]);
  const checkedValue: readonly HirField[] = ([
    ["views", "HirCheckerViews"], ["place", captured(hirNullable("HirStoragePlace"))],
    ["memory", captured(hirNullable(hirChoice("HirMemoryLayoutCapture", "HirMemoryFieldCapture")))],
    ["observation", captured(hirNullable("HirObservationCapture"))],
  ]);
  const declarationFacts: readonly HirField[] = ([
    ...core, ["parent", hirNullable("DefId")], ["attributes", hirArray("HirAttribute")],
    ["memory", captured(hirNullable(hirChoice("HirMemoryLayoutCapture", "HirMemoryFieldCapture")))],
  ]);
  const declaration: readonly HirField[] = ([...declarationFacts, ["definition", "DefId"]]);
  const classMetadata: readonly HirField[] = ([
    ...declaration, ["parameters", hirArray("TypeParameterData")], ["heritage", hirArray("HirHeritage")], ["members", hirArray("DefId")],
  ]);
  const pointerArguments: readonly HirField[] = ([
    ["exportName", "string"], ["arguments", hirArray(sourceReference)], ["typeArguments", hirArray(sourceReference)],
    ["selection", hirLiteral("applicable", "conditional-candidates", "untyped", "unvisited")],
    ["pointee", hirLiteral("available", "unvisited", "not-applicable", "missing")],
  ]);
  const layoutCommon: readonly HirField[] = ([
    ["occurrence", sourceReference], ["bindings", captured("BindingVector")],
  ]);
  const syntaxRange: HirRecordShape = hirRecord("TextRange", range);
  const commentKinds: readonly string[] = (["SingleLineCommentTrivia", "MultiLineCommentTrivia"]);
  const commentFields: readonly HirField[] = ([...range, ["hasTrailingNewLine", "boolean"]]);

  return ({
    ...createSyntaxSchema(),
    ModuleId: hirStringIdentity("mod"),
    DefId: hirStringIdentity("def"), BodyId: hirStringIdentity("body"),
    ExpansionId: hirStringIdentity("exp"), NodeId: hirNumericIdentity("n"),
    LocalId: hirNumericIdentity("l"), TyId: hirNumericIdentity("t"),
    SigId: hirNumericIdentity("sig"), CandidateListId: hirNumericIdentity("cand"),
    HostDiagnosticCode: ({ kind: "host-code" }),
    TextRange: syntaxRange,
    Origin: hirRecord("Origin", [["module", "ModuleId"], ["start", "number"], ["length", "number"],
      ["derived", hirArray(hirChoice(hirVariant("lowering", [["pass", hirLiteral("front", "decls", "infer", "elaborate",
        "validate", "lower-mir", "evaluate", "metadata", "liveness", "initialization", "refinements", "origins", "suspension",
        "errorStorage", "pointerBacking", "summaries", "pipeline")]]), hirVariant("expansion", [["expansion", "ExpansionId"]])))]]),
    NodeRef: hirRecord("NodeRef", [["body", "BodyId"], ["node", "NodeId"]]),
    ItemNodeRef: hirRecord("ItemNodeRef", [["owner", "DefId"], ["node", "NodeId"]]),
    SourceNodeRef: hirChoice(hirVariant("body", [["value", "NodeRef"]]), hirVariant("item", [["value", "ItemNodeRef"]])),
    LocalRef: hirRecord("LocalRef", [["body", "BodyId"], ["local", "LocalId"]]),
    LibraryModuleIdentity: hirRecord("LibraryModuleIdentity", [["providerId", "string"], ["providerVersion", "string"],
      ["packageName", hirNullable("string")], ["moduleSpecifier", "string"], ["providerModuleId", "string"]]),
    TypeParameterIdentity: hirRecord("TypeParameterIdentity", [["owner", "DefId"], ["index", "number"]]),
    TypeParameterData: hirRecord("TypeParameter", [["identity", parameterIdentity], ["declaration", "DefId"],
      ["constraint", hirNullable("TyId")], ["default", hirNullable("TyId")]]),
    TypeBinding: hirChoice(hirVariant("bound", [["parameter", parameterIdentity], ["type", "TyId"]]),
      hirVariant("rigid", [["parameter", parameterIdentity]])),
    SelfBinding: hirChoice(hirVariant("bound", [["owner", "DefId"], ["type", "TyId"]]), hirVariant("rigid", [["owner", "DefId"]])),
    BindingVector: hirRecord("BindingVector", [["classBindings", hirArray("TypeBinding")], ["methodBindings", hirArray("TypeBinding")],
      ["capturedBindings", hirArray("TypeBinding")], ["selfBindings", hirArray("SelfBinding")]]),
    ExactRational: hirRecord("ExactRational", [["numerator", "bigint"], ["denominator", "bigint"], ["negativeZero", "boolean"]]),
    LiteralValue: hirChoice(hirVariant("number", [["token", "string"], ["value", "ExactRational"]]),
      hirVariant("bigint", [["token", "string"], ["value", "bigint"]]), "NonNumericLiteralValue"),
    LiteralTypeValue: hirChoice(hirVariant("number", [["value", "ExactRational"]]), hirVariant("bigint", [["value", "bigint"]]), "NonNumericLiteralValue"),
    NonNumericLiteralValue: hirChoice(hirVariant("string", [["value", "string"]]), hirVariant("boolean", [["value", "boolean"]]),
      hirVariant("absence", []), hirVariant("unique-symbol", [["declaration", "DefId"]])),
    MemberKey: hirChoice(hirVariant("text", [["value", "string"]]), hirVariant("number", [["value", "ExactRational"]]),
      hirVariant("symbol", [["declaration", "DefId"]])),
    MemberOrigin: hirChoice(hirVariant("declared", [["declaration", "DefId"]]), hirVariant("class-prototype", [["owner", "DefId"]]),
      hirVariant("mapped", [["owner", sourceReference], ["key", "MemberKey"]])),
    PassingMode: hirLiteral("by-value", "byref-readonly", "byref-readwrite", "byref-writeonly-must-init", "borrow-shared", "borrow-mut", "move"),
    ConstructionDefinition: hirRecord("ConstructionDefinition", [["occurrence", "NodeRef"], ["captures", hirArray("LocalRef")]]),
    SumFamily: hirRecord("SumFamily", [["origin", hirLiteral("authored", "inferred")], ["component", "TypeComponent"],
      ["parameters", hirArray(parameterIdentity)], ["roles", hirArray("SumArmRole")]]),
    SumArmRole: hirRecord("SumArmRole", [["authoredIndex", "number"], ["component", sourceReference], ["member", "TyId"]]),
    ComponentSelector: variants("ComponentSelector", "kind", [
      ["class-value", []], ["construction-argument", [["definition", "ConstructionDefinition"], ["index", "number"]]],
      ["optional-value", []], ["array-element", []], ["tuple-element", [["index", "number"]]],
      ["union-member", [["index", "number"]]], ["argument-place", [["index", "number"]]], ["parameter-place", [["index", "number"]]],
      ["intersection-member", [["index", "number"]]], ["intersection-result", []],
      ["argument-tail", [["start", "number"]]], ["parameter-tail", [["start", "number"]]],
      ["member", [["origin", "MemberOrigin"]]], ["index-key", [["declaration", "DefId"]]], ["index-value", [["declaration", "DefId"]]],
      ["projection-source", []], ["parameter", [["signature", "SigId"], ["index", "number"]]], ["receiver", [["signature", "SigId"]]],
      ["signature-tail", [["signature", "SigId"], ["start", "number"], ["readonly", "boolean"]]],
      ["tuple-slice", [["start", "number"], ["endCount", "number"], ["readonly", "boolean"]]],
      ["result", [["signature", "SigId"]]], ["type-argument", [["declaration", "DefId"], ["index", "number"]]],
      ["sum-arm", [["family", "SumFamily"], ["index", "number"]]], ["awaited", []],
    ]),
    TypeComponent: hirRecord("TypeComponent", [["root", sourceReference], ["path", hirArray("ComponentSelector")]]),
    DiagnosticCode: hirChoice(hirVariant("host", [["name", "HostDiagnosticCode"], ["rendered", "string"]]),
      hirVariant("checker", [["number", "number"], ["rendered", "string"]]),
      hirVariant("extension", [["number", "number"], ["extensionCode", "string"], ["rendered", "string"]])),
    DiagnosticSite: hirChoice(hirVariant("source", [["origin", origin]]), hirVariant("file", [["path", "string"]]), hirVariant("none", [])),
    MessageArgument: hirChoice(hirVariant("text", [["value", "string"]]), hirVariant("integer", [["value", "bigint"]]),
      hirVariant("number", [["value", "number"]]), hirVariant("origin", [["value", origin]])),
    RelatedDiagnostic: hirRecord("RelatedDiagnostic", [["site", "DiagnosticSite"], ["code", "DiagnosticCode"], ["message", "string"]]),
    TextEdit: hirRecord("TextEdit", [["origin", origin], ["replacement", "string"]]),
    DiagnosticFix: hirRecord("DiagnosticFix", [["description", "string"], ["edits", hirArray("TextEdit")]]),
    Diagnostic: hirRecord("Diagnostic", [["code", "DiagnosticCode"], ["severity", hirLiteral("error", "warning", "suggestion")],
      ["site", "DiagnosticSite"], ["source", hirNullable("string")], ["evidence", hirArray("string")], ["message", "string"],
      ["arguments", hirArray("MessageArgument")], ["related", hirArray("RelatedDiagnostic")], ["fix", hirNullable("DiagnosticFix")]]),
    CommentDirective: variants("CommentDirective", "kind", [["Unknown", []], ["ExpectError", []], ["Ignore", []]], [["loc", syntaxRange]]),
    CommentRange: variants("CommentRange", "kind", commentKinds.map(kind => [kind, [["hasTrailingNewLine", "boolean"]]]), range),
    PragmaArgument: hirRecord("PragmaArgument", [...range, ["name", "string"], ["value", "string"]]),
    PragmaArguments: ({ kind: "dictionary", label: "PragmaArguments", element: "PragmaArgument" }),
    Pragma: variants("Pragma", "kind", commentKinds.map(kind => [kind, [...commentFields.slice(2), ["name", "string"], ["args", "PragmaArguments"]]]), range),
    CheckJsDirective: hirRecord("CheckJsDirective", [["enabled", "boolean"], ["range", "CommentRange"]]),
    HirCheckerViews: hirRecord("HirCheckerViews", [["read", captured("TyId")], ["declared", captured(hirNullable("TyId"))], ["contextual", captured(hirNullable("TyId"))]]),
    ImportTarget: variants("ImportTarget", "target", [["project", [["module", "ModuleId"]]], ["library", [["module", "LibraryModuleIdentity"]]]]),
    HirResolution: hirChoice(hirVariant("local", [["local", "LocalRef"]]),
      hirVariant("definition", [["definition", "DefId"], ["aliases", hirArray("DefId")]]), hirVariant("module", [["target", "ImportTarget"]]),
      hirVariant("unresolved", [["checkerDiagnostic", hirNullable("number")]])),
    HirAttribute: hirRecord("HirAttribute", [["declaration", "DefId"], ["occurrence", sourceReference], ["arguments", hirArray(sourceReference)]]),
    HirArgument: hirChoice(hirVariant("value", [["expression", "NodeId"]]), hirVariant("spread", [["expression", "NodeId"], ["tuple", captured(hirNullable(hirArray("TyId")))]])),
    HirInferenceContribution: hirRecord("HirInferenceContribution", [["parameter", parameterIdentity],
      ["role", hirLiteral("argument", "receiver", "context", "result", "type-argument")], ["source", sourceReference],
      ["component", "TypeComponent"], ["type", captured("TyId")]]),
    HirCallableEndpoint: hirRecord("HirCallableEndpoint", [["declaration", "DefId"], ["role", hirLiteral("advertised", "api-signature", "api-body")], ["signature", "SigId"], ["body", hirNullable("BodyId")]]),
    HirCandidate: hirRecord("HirCandidate", [["ordinal", "number"], ["declaration", "DefId"], ["appliedSignature", captured("SigId")],
      ["bindings", captured("BindingVector")], ["conditionalFailure", captured(hirNullable("Diagnostic"))], ["contributions", hirArray("HirInferenceContribution")]]),
    HirApplication: variants("HirApplication", "kind", ["call", "construct", "accessor-get", "accessor-set"].map(kind => [kind, [
      ["receiver", hirNullable("NodeId")], ["arguments", hirArray("HirArgument")], ["typeArguments", hirArray("TyId")],
      ["candidates", captured("CandidateListId")], ["resolvedSignature", captured(hirNullable("SigId"))],
    ]])),
    HirCandidateList: hirRecord("HirCandidateList", [["id", "CandidateListId"], ["candidates", hirArray("HirCandidate")]]),
    HirProtocolFact: variants("HirProtocolFact", "kind", [
      ...["iterate", "spread"].map<readonly [string, readonly HirField[]]>(kind => [kind, [["asynchronous", "boolean"],
        ["subject", "NodeId"], ["iterator", "TyId"], ["element", "TyId"], ["completion", "TyId"], ["sent", "TyId"],
        ["next", "SigId"], ["finish", hirNullable("SigId")], ["fail", hirNullable("SigId")]]]),
      ["await", [["subject", "NodeId"], ["completion", "TyId"]]],
      ...["yield", "delegate"].map<readonly [string, readonly HirField[]]>(kind => [kind, [["subject", hirNullable("NodeId")],
        ["yielded", "TyId"], ["sent", "TyId"], ["completion", "TyId"]]]),
      ["dispose", [["subject", "NodeId"], ["asynchronous", "boolean"], ["signature", "SigId"]]],
    ]),
    HirStoragePlace: hirRecord("HirStoragePlace", [["base", hirChoice(hirVariant("root", [["resolution", "HirResolution"]]),
      hirVariant("place", [["node", "NodeId"]]))], ["step", hirNullable(hirChoice(hirVariant("member", [["key", "MemberKey"],
        ["origins", hirArray("MemberOrigin")]]), hirVariant("index", [["expression", "NodeId"]]), hirVariant("deref", [])))],
      ["read", captured("TyId")], ["write", captured(hirNullable("TyId"))]]),
    HirMemoryGeometryCapture: hirRecord("HirMemoryGeometryCapture", [["source", captured("TyId")],
      ["dataLayoutExpression", hirNullable(sourceReference)], ["dataLayout", captured("DefId")],
      ["byteSizeExpression", hirNullable(sourceReference)], ["byteSize", captured("bigint")],
      ["byteAlignmentExpression", hirNullable(sourceReference)], ["byteAlignment", captured("bigint")],
      ["strideExpression", hirNullable(sourceReference)], ["stride", captured("bigint")]]),
    HirMemoryLayoutCapture: variants("HirMemoryLayoutCapture", "kind", [
      ["data-layout", [["declaration", captured("DefId")], ["fingerprint", captured("string")],
        ["byteOrder", captured(hirLiteral("little", "big"))], ["addressWidth", captured(hirLiteral(32, 64))]]],
      ["value", [["geometry", "HirMemoryGeometryCapture"], ["fieldsExpression", hirNullable(sourceReference)], ["fields", captured(hirArray(sourceReference))]]],
      ["array", [["geometry", "HirMemoryGeometryCapture"], ["extentExpression", hirNullable(sourceReference)], ["length", captured("bigint")],
        ["runtimeBase", captured(hirLiteral("number", "bigint"))], ["elementExpression", hirNullable(sourceReference)], ["element", captured(sourceReference)]]],
    ], layoutCommon),
    HirMemoryFieldCapture: hirVariant("field", [["occurrence", sourceReference], ["bindings", captured("BindingVector")],
      ["source", captured("TyId")], ["selector", sourceReference], ["selection", captured(sourceReference)], ["key", captured("MemberKey")],
      ["origins", captured(hirArray("MemberOrigin"))], ["selectedDeclarations", captured(hirArray("DefId"))], ["primary", captured(hirNullable("DefId"))],
      ["value", captured("TyId")], ["fieldLayoutExpression", hirNullable(sourceReference)], ["fieldLayout", captured(sourceReference)],
      ["byteOffsetExpression", hirNullable(sourceReference)], ["byteOffset", captured("bigint")],
      ["byteAlignmentExpression", hirNullable(sourceReference)], ["byteAlignment", captured("bigint")]]),
    HirObservationCapture: hirRecord("HirObservationCapture", [["occurrence", "NodeRef"], ["operation", hirLiteral("size", "alignment", "stride", "field-offset")],
      ["bindings", captured("BindingVector")], ["operand", "NodeRef"], ["layout", captured(sourceReference)], ["selector", hirNullable(sourceReference)],
      ["field", captured(hirNullable(sourceReference))], ["result", captured("TyId")], ["value", captured("bigint")]]),
    HirCapturedType: hirRecord("HirCapturedType", [["type", captured("TyId")], ["component", "TypeComponent"]]),
    HirFieldMarkerCapture: hirRecord("HirFieldMarkerCapture", [["name", "string"], ["typeNode", sourceReference], ["type", captured("TyId")], ["readonly", "boolean"]]),
    HirMarkersCapture: hirRecord("HirMarkersCapture", [["struct", hirNullable(hirRecord("Record", [["valueType", "boolean"], ["fields", captured(hirArray("HirFieldMarkerCapture"))]]))],
      ["field", hirNullable("HirFieldMarkerCapture")], ["defaultValue", hirNullable(hirRecord("Record", [["typeNode", sourceReference], ["type", captured("TyId")]]))], ["jsString", "boolean"]]),
    HirPointerTypeCapture: hirChoice(hirVariant("raw-address", []), hirVariant("typed-location", [["pointee", "HirCapturedType"],
      ["mutability", hirLiteral("readonly", "readwrite", "unspecified")]]), hirVariant("native-pointer", [["declaration", "DefId"]]),
      hirVariant("function-pointer", [["declaration", "DefId"], ["parameters", hirArray("HirCapturedType")], ["result", "HirCapturedType"], ["abi", hirArray("string")]])),
    HirIntegerOperandCapture: hirRecord("HirIntegerOperandCapture", [["runtimeBase", hirLiteral("number", "bigint")],
      ["signedness", hirLiteral("signed", "unsigned")], ["width", hirLiteral(8, 16, 32, 64, 128)]]),
    HirAddressIntegerCapture: variants("HirAddressIntegerCapture", "width", [
      [32, [["runtimeBase", hirLiteral("number")], ["signedness", hirLiteral("unsigned")]]],
      [64, [["runtimeBase", hirLiteral("bigint")], ["signedness", hirLiteral("unsigned")]]],
    ]),
    HirPointerOperationCapture: hirChoice(
      ...["address-of", "allocate", "load", "store", "equal-pointer", "hash-pointer", "bind-pointer", "project-pointer"].map(operation =>
        hirRecord("HirPointerOperationCapture", [hirDiscriminant("family", "typed-location"), hirDiscriminant("operation", operation), ...pointerArguments])),
      hirRecord("HirPointerOperationCapture", [hirDiscriminant("family", "typed-location"), hirDiscriminant("operation", "view"),
        ["pointer", sourceReference], ["read", sourceReference], ["write", sourceReference], ["optional", "boolean"]]),
      variants("HirPointerOperationCapture", "operation", [["load", [["pointer", sourceReference]]],
        ["store", [["pointer", sourceReference], ["value", sourceReference]]], ["offset", [["pointer", sourceReference], ["offset", sourceReference]]]],
        [hirDiscriminant("family", "native-pointer")]),
      hirRecord("HirPointerOperationCapture", [hirDiscriminant("family", "raw-address"), hirDiscriminant("operation", "bind-raw-pointer"), ["identity", sourceReference]]),
      hirRecord("HirPointerOperationCapture", [hirDiscriminant("family", "raw-address"), hirDiscriminant("operation", "equal-raw-pointer"), ["left", sourceReference], ["right", sourceReference]]),
      hirRecord("HirPointerOperationCapture", [hirDiscriminant("family", "raw-address"), hirDiscriminant("operation", "hash-raw-pointer"), ["pointer", sourceReference]]),
      hirRecord("HirPointerOperationCapture", [hirDiscriminant("family", "raw-memory"), hirDiscriminant("operation", "to-raw"), ["pointer", sourceReference], ["layout", sourceReference]]),
      hirRecord("HirPointerOperationCapture", [hirDiscriminant("family", "raw-memory"), hirDiscriminant("operation", "reinterpret"), ["raw", sourceReference], ["layout", sourceReference]]),
      hirRecord("HirPointerOperationCapture", [hirDiscriminant("family", "raw-memory"), hirDiscriminant("operation", "byte-offset"), ["raw", sourceReference],
        ["offset", sourceReference], ["integer", "HirIntegerOperandCapture"], ["dataLayout", sourceReference]]),
      hirRecord("HirPointerOperationCapture", [hirDiscriminant("family", "raw-memory"), hirDiscriminant("operation", "raw-to-address-integer"), ["raw", sourceReference],
        ["integer", "HirAddressIntegerCapture"], ["dataLayout", sourceReference]]),
      hirRecord("HirPointerOperationCapture", [hirDiscriminant("family", "raw-memory"), hirDiscriminant("operation", "address-integer-to-raw"), ["address", sourceReference],
        ["integer", "HirAddressIntegerCapture"], ["dataLayout", sourceReference]]),
      hirRecord("HirPointerOperationCapture", [hirDiscriminant("family", "keep-alive"), hirDiscriminant("operation", "keep-alive"), ["value", sourceReference]])),
    HirFieldBindingCapture: hirRecord("HirFieldBindingCapture", [["occurrence", "NodeRef"], ["bindings", captured("BindingVector")],
      ["owner", captured("TyId")], ["pointee", captured("TyId")], ["fieldExpression", "NodeRef"], ["field", captured(sourceReference)],
      ["pointerExpression", "NodeRef"]]),
    HirRecordFieldBindingCapture: hirRecord("HirRecordFieldBindingCapture", [["expression", "NodeRef"], ["binding", "NodeRef"]]),
    HirRecordBindingCapture: hirRecord("HirRecordBindingCapture", [["occurrence", "NodeRef"], ["bindings", captured("BindingVector")],
      ["source", captured("TyId")], ["layoutExpression", "NodeRef"], ["layout", captured(sourceReference)],
      ["fields", hirArray("HirRecordFieldBindingCapture")]]),
    HirAttributeCapture: variants("HirAttributeCapture", "kind", [["builder-state", []], ["application", [["invocation", sourceReference]]]], [
      ["occurrence", sourceReference], ["applicationTarget", sourceReference], ["selectedMember", hirNullable(hirRecord("Record", [
        ["selectedDeclaration", hirNullable(sourceReference)], ["declarations", hirArray(sourceReference)]]))],
      ["applicationMemberKind", hirNullable(hirLiteral("property", "method"))], ["applicationPlacement", hirNullable(hirLiteral("declaration", "constructor"))],
      ["applicationParameterName", hirNullable("string")], ["applicationTargetSpecifier", hirNullable("string")],
    ]),
    HirSafetySelectionCapture: hirChoice(hirVariant("selected", [["expression", sourceReference], ["declaration", hirNullable(sourceReference)], ["declarations", hirArray(sourceReference)]]),
      hirVariant("unavailable", [["reason", hirLiteral("function-shape", "receiver", "member-evidence")]])),
    HirSafetyCapture: hirChoice(
      hirRecord("HirSafetyCapture", [["occurrence", sourceReference], ["provider", "DefId"], hirDiscriminant("family", "unsafe-context"), hirDiscriminant("operation", "expression"), ["expression", sourceReference]]),
      hirRecord("HirSafetyCapture", [["occurrence", sourceReference], ["provider", "DefId"], hirDiscriminant("family", "unsafe-context"), hirDiscriminant("operation", "remaining-block"), ["firstDirectStatement", "boolean"]]),
      variants("HirSafetyCapture", "operation", [
        ["root", [["form", hirLiteral("type", "value")], ["target", hirNullable(sourceReference)]]],
        ["select-member", [["predecessor", hirNullable(sourceReference)], ["memberKind", hirLiteral("indexer", "method", "property")], ["selection", "HirSafetySelectionCapture"]]],
        ["placement", [["predecessor", hirNullable(sourceReference)], ["placement", hirLiteral("declaration", "constructor", "getter", "setter")]]],
        ["apply", [["predecessor", hirNullable(sourceReference)], ["contract", hirLiteral("requires-unsafe", "safe")]]],
      ], [["occurrence", sourceReference], ["provider", "DefId"], hirDiscriminant("family", "safety")])),
    HirArgumentPassingCapture: variants("HirArgumentPassingCapture", "role", [["declaration", [["mode", "PassingMode"]]],
      ["argument", [["mode", "PassingMode"], ["storageExpression", sourceReference]]]]),
    HirCoreCapture: hirRecord("HirCoreCapture", [["provider", captured(hirNullable("DefId"))], ["markers", captured("HirMarkersCapture")],
      ["pointerType", captured(hirNullable("HirPointerTypeCapture"))], ["pointerOperation", captured(hirNullable("HirPointerOperationCapture"))],
      ["fieldBinding", captured(hirNullable("HirFieldBindingCapture"))], ["recordBinding", captured(hirNullable("HirRecordBindingCapture"))],
      ["attribute", captured(hirNullable("HirAttributeCapture"))], ["safety", captured(hirNullable("HirSafetyCapture"))],
      ["argumentPassing", captured(hirNullable("HirArgumentPassingCapture"))], ["flowState", captured(hirNullable(hirLiteral("moved", "borrowed-shared", "borrowed-mut")))]]),
    CheckedValue: hirRecord("CheckedValue", checkedValue),
    CheckedExpression: hirRecord("CheckedExpression", [...checkedValue, ...core]),
    CheckedLiteral: variants("CheckedLiteral", "role", [
      ["value", [["value", "CheckedValue"], ["literal", "LiteralValue"]]],
      ["property-name", [["key", captured("MemberKey")], ["origins", captured(hirArray("MemberOrigin"))]]],
      ["declaration-name", [["declaration", "DeclarationTarget"]]],
      ["type-literal", [["type", captured("TyId")], ["literal", "LiteralTypeValue"]]],
      ["module-specifier", [["target", captured("ImportTarget")]]], ["export-name", [["definition", captured("DefId")]]],
      ["attribute-value", [["literal", "LiteralValue"]]],
    ], core),
    CheckedName: variants("CheckedName", "role", [
      ["value", [["value", "CheckedValue"], ["resolution", "HirResolution"]]],
      ["assignment-target", [["resolution", "HirResolution"], ["views", "HirCheckerViews"], ["place", captured("HirStoragePlace")], ["access", hirLiteral("write", "read-write")]]],
      ["declaration-name", [["declaration", "DeclarationTarget"]]],
      ["property-name", [["key", captured("MemberKey")], ["origins", captured(hirArray("MemberOrigin"))]]],
      ["type-name", [["resolution", "HirResolution"]]], ["label", [["target", hirNullable("NodeRef")]]],
      ["private-name", [["declaration", "DefId"]]], ["shorthand-value", [["value", "CheckedValue"], ["resolution", "HirResolution"], ["key", captured("MemberKey")]]],
    ], core),
    CheckedBinary: variants("CheckedBinary", "role", [["arithmetic", [["value", "CheckedValue"]]], ["comparison", [["value", "CheckedValue"]]],
      ["short-circuit", [["value", "CheckedValue"]]], ["sequence", [["value", "CheckedValue"]]],
      ["assignment", [["value", "CheckedValue"], ["target", captured("HirStoragePlace")]]]], core),
    CheckedUnary: variants("CheckedUnary", "role", [["value", [["value", "CheckedValue"]]],
      ["update", [["value", "CheckedValue"], ["target", captured("HirStoragePlace")]]],
      ["type-literal", [["type", captured("TyId")], ["literal", "LiteralTypeValue"]]]], core),
    CheckedKeyword: variants("CheckedKeyword", "role", [["value", [["value", "CheckedValue"]]],
      ["type-literal", [["type", captured("TyId")], ["literal", "LiteralTypeValue"]]]], core),
    CheckedInstantiation: variants("CheckedInstantiation", "role", [["value", [["value", "CheckedValue"]]],
      ["heritage", [["type", captured("TyId")], ["definition", captured("DefId")]]]], core),
    CheckedAggregate: variants("CheckedAggregate", "role", [["value", [["value", "CheckedValue"]]], ["assignment-pattern", [["views", "HirCheckerViews"]]]], core),
    CheckedApplication: hirRecord("CheckedApplication", [...checkedValue, ...core, ["application", captured("HirApplication")]]),
    CheckedMember: variants("CheckedMember", "role", [["value", [["value", "CheckedValue"], ["origins", captured(hirArray("MemberOrigin"))], ["accessor", captured(hirNullable("HirApplication"))]]],
      ["assignment-target", [["views", "HirCheckerViews"], ["place", captured("HirStoragePlace")], ["access", hirLiteral("write", "read-write")],
        ["origins", captured(hirArray("MemberOrigin"))], ["accessor", captured(hirNullable("HirApplication"))]]]], core),
    CheckedProtocol: hirRecord("CheckedProtocol", [...checkedValue, ...core, ["protocol", captured("HirProtocolFact")]]),
    CheckedClosure: hirRecord("CheckedClosure", [...checkedValue, ...core, ["body", "BodyId"], ["captures", hirArray("LocalRef")]]),
    CheckedType: hirRecord("CheckedType", [...core, ["type", captured("TyId")], ["referencedDefinitions", hirArray("DefId")]]),
    DeclarationTarget: hirChoice(hirVariant("local", [["local", "LocalRef"]]), hirVariant("definition", [["definition", "DefId"]])),
    CheckedCallable: hirRecord("CheckedCallable", [...declaration, ["parameters", hirArray("TypeParameterData")], ["signatures", hirArray("HirCallableEndpoint")], ["body", hirNullable("BodyId")]]),
    CheckedClass: hirRecord("CheckedClass", classMetadata),
    CheckedClassExpression: hirRecord("CheckedClassExpression", [...checkedValue, ...core, ...declarationFacts.filter(([field]) => field !== "core" && field !== "memory"),
      ["definition", "DefId"], ["parameters", hirArray("TypeParameterData")], ["heritage", hirArray("HirHeritage")], ["members", hirArray("DefId")]]),
    HirHeritage: hirRecord("HirHeritage", [["role", hirLiteral("extends", "implements")], ["type", "TyId"]]),
    CheckedTypeAlias: hirRecord("CheckedTypeAlias", [...declaration, ["parameters", hirArray("TypeParameterData")], ["type", captured("TyId")]]),
    CheckedVariable: hirRecord("CheckedVariable", [...declarationFacts, ["declaration", "DeclarationTarget"], ["declaredType", captured(hirNullable("TyId"))], ["initializer", hirNullable("BodyId")]]),
    CheckedEnum: hirRecord("CheckedEnum", [...declaration, ["members", hirArray("DefId")]]),
    CheckedNamespace: hirRecord("CheckedNamespace", [...declaration, ["members", hirArray("DefId")]]),
    HirImportBinding: hirRecord("HirImportBinding", [["local", "DefId"], ["imported", captured("DefId")]]),
    CheckedImport: hirRecord("CheckedImport", [...declaration, ["target", captured("ImportTarget")], ["bindings", hirArray("HirImportBinding")]]),
    HirExportBinding: hirRecord("HirExportBinding", [["name", "string"], ["definition", captured("DefId")]]),
    CheckedExport: hirRecord("CheckedExport", [...declaration, ["exports", hirArray("HirExportBinding")], ["target", captured(hirNullable("ImportTarget"))]]),
    CheckedStaticBlock: hirRecord("CheckedStaticBlock", [...declaration, ["body", "BodyId"]]),
    CheckedProperty: hirRecord("CheckedProperty", [...core, ["key", captured("MemberKey")], ["origins", captured(hirArray("MemberOrigin"))]]),
    CheckedBinding: hirRecord("CheckedBinding", [...core, ["declaration", hirNullable("DeclarationTarget")], ["declaredType", captured(hirNullable("TyId"))]]),
    CheckedBindingList: hirRecord("CheckedBindingList", [...core, ["disposal", hirArray(captured("HirProtocolFact"))]]),
    CheckedIteration: hirRecord("CheckedIteration", [...core, ["protocol", captured(hirNullable("HirProtocolFact"))]]),
    CheckedModule: hirRecord("CheckedModule", [...declaration, ["body", "BodyId"]]),
    CheckedTypeParameter: hirRecord("CheckedTypeParameter", [...declaration, ["parameter", "TypeParameterData"]]),
    HirLocal: hirRecord("HirLocal", [["id", "LocalId"], ["declaration", sourceReference], ["name", "string"],
      ["role", hirLiteral("parameter", "binding", "capture", "catch")], ["checkerSlot", captured("TyId")], ["capturedFrom", hirNullable("LocalRef")], ["mutable", "boolean"]]),
    HirParam: hirRecord("HirParam", [["local", "LocalId"], ["declaration", "DefId"], ["role", hirLiteral("required", "optional", "default", "rest", "this")],
      ["passing", "PassingMode"], ["initializer", hirNullable("BodyId")]]),
    HirLexicalScope: hirRecord("HirLexicalScope", [["node", "NodeId"], ["parent", hirNullable("NodeId")], ["attributes", hirArray("HirAttribute")]]),
    HirBody: hirRecord("HirBody", [["body", "BodyId"], ["owner", "DefId"], ["params", hirArray("HirParam")], ["locals", hirArray("HirLocal")],
      ["root", "BodyRoot"], ["captures", hirArray("LocalRef")], ["scopes", hirArray("HirLexicalScope")], ["asynchronous", "boolean"],
      ["generator", "boolean"], ["candidateLists", hirArray("HirCandidateList")], ["nestedBodies", hirArray("BodyId")]]),
    HirDeclarationEntry: hirRecord("HirDeclarationEntry", [["definition", "DefId"], ["node", "NodeId"]]),
    HirUnaryOperator: hirLiteral("+", "-", "!", "~", "typeof", "void", "delete"),
    HirBinaryOperator: hirLiteral("+", "-", "*", "/", "%", "**", "&", "|", "^", "<<", ">>", ">>>", "<", "<=", ">", ">=", "==", "!=", "===", "!==", "in", "instanceof"),
    ProofObligation: hirChoice(hirVariant("write-fit", [["ordinal", "number"], ["occurrence", "NodeRef"], ["value", "NodeRef"], ["destination", sourceReference], ["destinationType", "TyId"]]),
      hirVariant("operator", [["ordinal", "number"], ["occurrence", "NodeRef"], ["operator", hirChoice("HirUnaryOperator", "HirBinaryOperator")], ["operands", hirArray("NodeRef")]]),
      hirVariant("index", [["ordinal", "number"], ["occurrence", "NodeRef"], ["receiver", "NodeRef"], ["key", "NodeRef"]])),
    HirDiagnosticRoot: hirRecord("HirDiagnosticRoot", [["diagnostic", "number"], ["owner", sourceReference], ["obligations", hirArray("ProofObligation")]]),
    HirModule: hirRecord("HirModule", [["module", "ModuleId"], ["tree", "SourceFile"], ["items", hirArray("HirDeclarationEntry")],
      ["bodies", hirArray("HirBody")], ["checkerDiagnostics", hirArray("Diagnostic")], ["obligations", hirArray("HirDiagnosticRoot")]]),
  });
}

export interface HirCaptureReaders {
  readonly nodeOf: (reference: SourceNodeRef) => HirSourceNode | null;
}

interface PlaceEntry {
  readonly owner: PlaceVertex;
  readonly place: HirStoragePlace;
  receiverViolation: boolean;
}

interface PlaceVertex {
  readonly entry: HirNodeEntry;
  readonly targets: Map<HirNode, PlaceVertex>;
  readonly places: PlaceEntry[];
}

interface PlaceVisit {
  readonly vertex: PlaceVertex;
  readonly leaving: boolean;
  readonly next: PlaceVisit | null;
}

export function verifyHirPlaces(inventory: HirInventory, report: HirReport): void {
  const entries: PlaceEntry[] = [];
  const byNode = new Map<HirNode, HirStoragePlace[]>();
  const add = (node: HirNode, place: HirStoragePlace): void => {
    const previous = byNode.get(node);
    if (previous === undefined) byNode.set(node, [place]);
    else previous.push(place);
  };
  for (const node of inventory.nodes) {
    const metadata = node.tsonic;
    if (metadata === null) continue;
    const value = "value" in metadata ? metadata.value : metadata;
    const place = "place" in value ? value.place : null;
    if (place !== null && place.kind === "available" && place.value !== null) add(node, place.value);
    if (node.kind === "BinaryExpression" && node.tsonic.role === "assignment" && node.tsonic.target.kind === "available")
      add(node.left, node.tsonic.target.value);
    if ((node.kind === "PrefixUnaryExpression" || node.kind === "PostfixUnaryExpression") &&
      node.tsonic.role === "update" && node.tsonic.target.kind === "available") add(node.operand, node.tsonic.target.value);
  }
  const known = new Map<HirNode, PlaceVertex>();
  for (const entry of inventory.entries) {
    const places = byNode.get(entry.node);
    if (places === undefined) continue;
    const owner: PlaceVertex = { entry, targets: new Map(), places: [] };
    known.set(entry.node, owner);
    for (const place of places) {
      const value: PlaceEntry = { owner, place, receiverViolation: false };
      entries.push(value);
      owner.places.push(value);
    }
  }
  for (const receiver of inventory.receivers) for (const entry of known.get(receiver.access.node)?.places ?? []) {
    if (entry.place.base.kind === "root") continue;
    const target = inventory.entriesById.get(entry.place.base.node);
    if (target === undefined || target.ordinal < receiver.expression.ordinal || target.ordinal >= receiver.expression.end)
      entry.receiverViolation = true;
  }
  for (const entry of entries) {
    const node = entry.owner.entry.node;
    const site: HirSite = { kind: "node", node: entry.owner.entry.source };
    if (entry.place.base.kind === "root") {
      if (node.kind === "PropertyAccessExpression" || node.kind === "ElementAccessExpression")
        report("place-access-base-in-receiver", site, "access base place must lie inside its actual receiver subtree");
      continue;
    }
    const target = inventory.nodesById.get(entry.place.base.node);
    const targetPlace = target === undefined ? undefined : known.get(target);
    const owner = entry.owner.entry.body;
    if (targetPlace === undefined || owner === null || targetPlace.entry.body !== owner) {
      report("place-base-acyclic", site, "place base must name an actual place in the same body and end at a root");
    } else {
      entry.owner.targets.set(targetPlace.entry.node, targetPlace);
    }
    if (entry.receiverViolation)
      report("place-access-base-in-receiver", site, "access base place must lie inside its actual receiver subtree");
  }
  const colors = new Map<HirNode, "active" | "complete">();
  for (const root of known.values()) {
    if (colors.has(root.entry.node)) continue;
    let pending: PlaceVisit | null = { vertex: root, leaving: false, next: null };
    while (pending !== null) {
      const frame: PlaceVisit = pending;
      pending = frame.next;
      if (frame.leaving) { colors.set(frame.vertex.entry.node, "complete"); continue; }
      const previous = colors.get(frame.vertex.entry.node);
      if (previous === "complete") continue;
      if (previous === "active") {
        report("place-base-acyclic", { kind: "node", node: frame.vertex.entry.source }, "place base chain must not revisit a place");
        continue;
      }
      colors.set(frame.vertex.entry.node, "active");
      pending = { vertex: frame.vertex, leaving: true, next: pending };
      for (const vertex of frame.vertex.targets.values()) pending = { vertex, leaving: false, next: pending };
    }
  }
}

type MemoryCapture = HirMemoryLayoutCapture | HirMemoryFieldCapture;

interface CaptureEntry {
  readonly value: MemoryCapture;
  readonly site: HirSite;
}

interface MemoryVertex {
  readonly ordinal: number;
  readonly site: HirSite;
  readonly targets: Map<number, MemoryVertex>;
  kind: MemoryCapture["kind"] | null;
}

interface MemoryVisit {
  readonly node: MemoryVertex;
  readonly leaving: boolean;
  readonly next: MemoryVisit | null;
}

function sameNode(left: SourceNodeRef, right: SourceNodeRef, readers: HirCaptureReaders): boolean {
  const first = readers.nodeOf(left);
  const second = readers.nodeOf(right);
  if (first === null || second === null) return false;
  if (first.kind === "local") return second.kind === "local" && first.node === second.node;
  return second.kind === "foreign" && first.module === second.module && first.ordinal === second.ordinal;
}

function memoryAt(node: HirNode): MemoryCapture | null {
  const metadata = node.tsonic;
  if (metadata === null) return null;
  const value = "value" in metadata ? metadata.value : metadata;
  if (!("memory" in value)) return null;
  return value.memory.kind === "available" ? value.memory.value : null;
}

function memoryEdges(capture: MemoryCapture): readonly SourceNodeRef[] {
  switch (capture.kind) {
    case "data-layout": return [];
    case "value": return capture.fields.kind === "available" ? capture.fields.value : [];
    case "array": return capture.element.kind === "available" ? [capture.element.value] : [];
    case "field": return capture.fieldLayout.kind === "available" ? [capture.fieldLayout.value] : [];
  }
}

function verifyMemoryGraph(entries: readonly CaptureEntry[], readers: HirCaptureReaders, report: HirReport): void {
  const pendingEntries = [...entries];
  const readLocal = new Set<HirNode>();
  const readForeign = new Map<ModuleId, Set<NodeId>>();
  const localVertices = new Map<HirNode, MemoryVertex>();
  const foreignVertices = new Map<ModuleId, Map<NodeId, MemoryVertex>>();
  const vertices: MemoryVertex[] = [];
  const vertexFrom = <Key extends HirNode | NodeId>(arena: Map<Key, MemoryVertex>, key: Key, site: HirSite): MemoryVertex => {
    let vertex = arena.get(key);
    if (vertex === undefined) {
      vertex = { ordinal: vertices.length, site, targets: new Map(), kind: null };
      vertices.push(vertex);
      arena.set(key, vertex);
    }
    return vertex;
  };
  const vertexOf = (source: HirSourceNode, site: HirSite): MemoryVertex => {
    if (source.kind === "local") return vertexFrom(localVertices, source.node, site);
    const arena = foreignVertices.get(source.module) ?? new Map<NodeId, MemoryVertex>();
    foreignVertices.set(source.module, arena);
    return vertexFrom(arena, source.ordinal, site);
  };
  for (const entry of pendingEntries) {
    const owner = readers.nodeOf(entry.value.occurrence);
    if (owner === null) continue;
    const vertex = vertexOf(owner, entry.site);
    if (vertex.kind !== null && vertex.kind !== entry.value.kind)
      report("memory-capture-owner", entry.site, "one occurrence cannot own incompatible descriptor kinds");
    if (vertex.kind === null) vertex.kind = entry.value.kind;
    for (const reference of memoryEdges(entry.value)) {
      const node = readers.nodeOf(reference);
      const captured = node === null ? null : memoryAt(node.node);
      const occurrence = captured === null ? null : readers.nodeOf(captured.occurrence);
      if (captured === null || occurrence === null || (entry.value.kind === "value" ? captured.kind !== "field" :
        captured.kind !== "value" && captured.kind !== "array"))
        report("memory-capture-reference", entry.site, "layout edge must name the required captured descriptor kind");
      if (occurrence !== null && captured !== null) {
        const target = vertexOf(occurrence, { kind: "node", node: captured.occurrence });
        vertex.targets.set(target.ordinal, target);
      }
      if (node !== null && captured !== null) {
        let first: boolean;
        if (node.kind === "local") {
          first = !readLocal.has(node.node);
          readLocal.add(node.node);
        } else {
          const arena = readForeign.get(node.module) ?? new Set<NodeId>();
          first = !arena.has(node.ordinal);
          arena.add(node.ordinal);
          readForeign.set(node.module, arena);
        }
        if (first) {
          pendingEntries.push({ value: captured, site: { kind: "node", node: captured.occurrence } });
        }
      }
    }
  }
  const colors = new Map<number, "active" | "complete">();
  for (const root of vertices) {
    if (colors.has(root.ordinal)) continue;
    let pending: MemoryVisit | null = { node: root, leaving: false, next: null };
    while (pending !== null) {
      const frame: MemoryVisit = pending;
      pending = frame.next;
      if (frame.leaving) { colors.set(frame.node.ordinal, "complete"); continue; }
      const previous = colors.get(frame.node.ordinal);
      if (previous === "complete") continue;
      if (previous === "active") {
        report("memory-layout-acyclic", frame.node.site, "captured layout graph must be acyclic");
        continue;
      }
      colors.set(frame.node.ordinal, "active");
      pending = { node: frame.node, leaving: true, next: pending };
      pending = [...frame.node.targets.values()].reduceRight<MemoryVisit | null>((next, node) => ({ node, leaving: false, next }), pending);
    }
  }
}

function verifyObservation(observation: HirObservationCapture, node: HirNode, site: HirSite, readers: HirCaptureReaders, report: HirReport): void {
  const occurrence: SourceNodeRef = { kind: "body", value: observation.occurrence };
  if (readers.nodeOf(occurrence)?.node !== node)
    report("observation-capture-owner", site, "observation must retain its exact owning occurrence");
  if (observation.operation === "field-offset") {
    if (observation.selector === null || observation.field.kind === "available" && observation.field.value === null)
      report("observation-capture-owner", site, "field-offset observation requires its selector and selected field");
  } else if (observation.selector !== null || observation.field.kind === "available" && observation.field.value !== null)
    report("observation-capture-owner", site, "non-field observation cannot carry a field selection");
  if (observation.layout.kind === "available") {
    const layout = readers.nodeOf(observation.layout.value);
    const captured = layout === null ? null : memoryAt(layout.node);
    if (captured === null || captured.kind !== "value" && captured.kind !== "array")
      report("memory-capture-reference", site, "observation layout must name a value or array descriptor");
  }
  if (observation.field.kind === "available" && observation.field.value !== null) {
    const field = readers.nodeOf(observation.field.value);
    const captured = field === null ? null : memoryAt(field.node);
    if (captured === null || captured.kind !== "field")
      report("memory-capture-reference", site, "observation field must name a field descriptor");
  }
}

function verifyBindingOwner(occurrence: NodeRef, expressions: readonly NodeRef[], node: HirNode, site: HirSite,
  readers: HirCaptureReaders, report: HirReport): void {
  if (readers.nodeOf({ kind: "body", value: occurrence })?.node !== node)
    report("binding-capture-owner", site, "binding capture must retain its exact owning occurrence");
  for (const expression of expressions) if (expression.body !== occurrence.body)
    report("cross-owner-qualified", site, "binding capture expressions must belong to the body of their occurrence");
}

function verifyFieldBinding(binding: HirFieldBindingCapture, node: HirNode, site: HirSite, readers: HirCaptureReaders, report: HirReport): void {
  verifyBindingOwner(binding.occurrence, [binding.fieldExpression, binding.pointerExpression], node, site, readers, report);
  if (binding.field.kind === "available") {
    const field = readers.nodeOf(binding.field.value);
    const captured = field === null ? null : memoryAt(field.node);
    if (captured === null || captured.kind !== "field")
      report("memory-capture-reference", site, "field binding must name a field descriptor");
  }
}

function verifyRecordBinding(binding: HirRecordBindingCapture, node: HirNode, site: HirSite, readers: HirCaptureReaders, report: HirReport): void {
  verifyBindingOwner(binding.occurrence, [binding.layoutExpression, ...binding.fields.flatMap(entry => [entry.expression, entry.binding])],
    node, site, readers, report);
  if (binding.layout.kind === "available") {
    const layout = readers.nodeOf(binding.layout.value);
    const captured = layout === null ? null : memoryAt(layout.node);
    if (captured === null || captured.kind !== "value" && captured.kind !== "array")
      report("memory-capture-reference", site, "record binding layout must name a value or array descriptor");
  }
  for (const entry of binding.fields) {
    const child = readers.nodeOf({ kind: "body", value: entry.binding });
    const metadata = child === null ? null : child.node.tsonic;
    const selected = metadata === null ? null : metadata.core.fieldBinding;
    if (selected === null || selected.kind !== "available" || selected.value === null)
      report("core-capture-reference", site, "record binding field must name a field-binding occurrence");
  }
}

export function verifyHirCaptures(nodes: readonly HirNodeEntry[], readers: HirCaptureReaders, report: HirReport,
  hirSchema: HirSchema, bindings: HirBindingRequest[]): void {
  const entries: CaptureEntry[] = [];
  const observations: { readonly value: HirObservationCapture; readonly node: HirNode; readonly site: HirSite }[] = [];
  for (const entry of nodes) {
    const node = entry.node;
    const metadata = node.tsonic;
    if (metadata === null) continue;
    const site: HirSite = { kind: "node", node: entry.source };
    const value = "value" in metadata ? metadata.value : metadata;
    const memory = "memory" in value ? value.memory : null;
    if (memory !== null && memory.kind === "available" && memory.value !== null) {
      const capture = memory.value;
      const entry: CaptureEntry = { value: capture, site };
      entries.push(entry);
      if (capture.bindings.kind === "available")
        bindings.push({ kind: "occurrence", occurrence: capture.occurrence, vector: capture.bindings.value, site });
      const occurrence = readers.nodeOf(capture.occurrence);
      if (occurrence === null)
        report("memory-capture-owner", site, "capture occurrence must exist in the canonical checked-node inventory");
      if (capture.kind === "field" && capture.primary.kind === "available" && capture.primary.value !== null &&
        capture.selectedDeclarations.kind === "available" && !capture.selectedDeclarations.value.includes(capture.primary.value))
        report("memory-capture-reference", site, "primary field declaration must belong to its selected declaration group");
    }
    const observation = "observation" in value ? value.observation : null;
    if (observation !== null && observation.kind === "available" && observation.value !== null) {
      observations.push({ value: observation.value, node, site });
      if (observation.value.bindings.kind === "available") bindings.push({ kind: "occurrence",
        occurrence: { kind: "body", value: observation.value.occurrence }, vector: observation.value.bindings.value, site });
    }
    const coreCapture = metadata.core;
    walkHirData({ work: hirCoreData(coreCapture), node, body: null, site }, data => {
      if (data.reference.kind === "SourceNodeRef" && readers.nodeOf(data.reference.value) === null)
        report("core-capture-reference", site, "Core capture reference must retain an existing qualified source node");
    });
    for (const binding of [coreCapture.fieldBinding, coreCapture.recordBinding]) {
      if (binding.kind === "available" && binding.value !== null && binding.value.bindings.kind === "available")
        bindings.push({ kind: "occurrence", occurrence: { kind: "body", value: binding.value.occurrence }, vector: binding.value.bindings.value, site });
    }
    if (coreCapture.fieldBinding.kind === "available" && coreCapture.fieldBinding.value !== null)
      verifyFieldBinding(coreCapture.fieldBinding.value, node, site, readers, report);
    if (coreCapture.recordBinding.kind === "available" && coreCapture.recordBinding.value !== null)
      verifyRecordBinding(coreCapture.recordBinding.value, node, site, readers, report);
    if (coreCapture.markers.kind === "available") {
      const markers = coreCapture.markers.value;
      const references: SourceNodeRef[] = [];
      if (markers.struct !== null && markers.struct.fields.kind === "available")
        for (const field of markers.struct.fields.value) references.push(field.typeNode);
      if (markers.field !== null) references.push(markers.field.typeNode);
      if (markers.defaultValue !== null) references.push(markers.defaultValue.typeNode);
      for (const reference of references) {
        const target = readers.nodeOf(reference);
        if (target !== null && hirRecordChoices("TypeNode", target.node.kind, hirSchema).length === 0)
          report("core-capture-kind", site, "marker type reference must point to a type syntax node");
      }
    }
    if (coreCapture.argumentPassing.kind === "available" && coreCapture.argumentPassing.value !== null &&
      coreCapture.argumentPassing.value.role === "declaration" && node.kind !== "Parameter")
      report("core-capture-kind", site, "declaration passing mode belongs to a parameter declaration");
    if (coreCapture.attribute.kind === "available" && coreCapture.attribute.value !== null) {
      const attribute = coreCapture.attribute.value;
      const occurrence = readers.nodeOf(attribute.occurrence);
      if (occurrence !== null && occurrence.node.kind !== "CallExpression")
        report("core-capture-kind", site, "attribute capture occurrence must name its invocation");
      const selected = attribute.selectedMember;
      if (selected !== null) {
        const declaration = selected.selectedDeclaration;
        if (declaration !== null && !selected.declarations.some(reference => sameNode(reference, declaration, readers)))
          report("core-capture-reference", site, "attribute selected declaration must belong to its declaration group");
      }
    }
  }
  verifyMemoryGraph(entries, readers, report);
  for (const observation of observations) verifyObservation(observation.value, observation.node, observation.site, readers, report);
}
