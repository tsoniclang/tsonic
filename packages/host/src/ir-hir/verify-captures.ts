import type { SourceNodeRef } from "../ids/contract.js";
import type { HirMemoryFieldCapture, HirMemoryLayoutCapture, HirNode, HirObservationCapture, HirSite, HirStoragePlace } from "./contract.js";
import type { HirBindingRequest } from "./verify-bindings.js";
import type { HirField, HirInventory, HirReport, HirSchema, HirShape } from "./verify-syntax.js";
import { hirArray, hirChoice, hirIdentity, hirLiteral, hirNullable, hirRecord, hirVariant,
  createSyntaxSchema, resolveHirShape, walkHirData, checkHirShape } from "./verify-syntax.js";

function captured(value: HirShape): HirShape {
  return hirChoice(hirVariant("available", [["value", value]]),
    hirVariant("unavailable", [["reason", hirLiteral("checker-error", "parameter-dependent", "not-provided")]]));
}

function variants(name: string, field: string, arms: readonly (readonly [string | number, readonly HirField[]])[],
  common: readonly HirField[] = []): HirShape {
  return hirChoice(...arms.map(([value, fields]) => hirRecord(field === "kind" ? String(value) : name,
    [...common, [field, hirLiteral(value)], ...fields])));
}

export function createHirSchema(): HirSchema {
  const range: readonly HirField[] = Object.freeze([["pos", "number"], ["end", "number"]]);
  const parameterIdentity: HirShape = "TypeParameterIdentity";
  const origin: HirShape = "Origin";
  const sourceReference: HirShape = "SourceNodeRef";
  const core: readonly HirField[] = Object.freeze([["core", "HirCoreCapture"]]);
  const checkedValue: readonly HirField[] = Object.freeze([
    ["views", "HirCheckerViews"], ["place", captured(hirNullable("HirStoragePlace"))],
    ["memory", captured(hirNullable(hirChoice("HirMemoryLayoutCapture", "HirMemoryFieldCapture")))],
    ["observation", captured(hirNullable("HirObservationCapture"))],
  ]);
  const declarationFacts: readonly HirField[] = Object.freeze([
    ...core, ["parent", hirNullable("DefId")], ["attributes", hirArray("HirAttribute")],
    ["memory", captured(hirNullable(hirChoice("HirMemoryLayoutCapture", "HirMemoryFieldCapture")))],
  ]);
  const declaration: readonly HirField[] = Object.freeze([...declarationFacts, ["definition", "DefId"]]);
  const classMetadata: readonly HirField[] = Object.freeze([
    ...declaration, ["parameters", hirArray("TypeParameterData")], ["heritage", hirArray("HirHeritage")], ["members", hirArray("DefId")],
  ]);
  const pointerArguments: readonly HirField[] = Object.freeze([
    ["exportName", "string"], ["arguments", hirArray(sourceReference)], ["typeArguments", hirArray(sourceReference)],
    ["selection", hirLiteral("applicable", "conditional-candidates", "untyped", "unvisited")],
    ["pointee", hirLiteral("available", "unvisited", "not-applicable", "missing")],
  ]);
  const layoutCommon: readonly HirField[] = Object.freeze([
    ["occurrence", sourceReference], ["bindings", captured("BindingVector")],
  ]);
  const syntaxRange: HirShape = hirRecord("TextRange", range);
  const commentKinds: readonly string[] = Object.freeze(["SingleLineCommentTrivia", "MultiLineCommentTrivia"]);
  const commentFields: readonly HirField[] = Object.freeze([...range, ["hasTrailingNewLine", "boolean"]]);

  return Object.freeze({
    ...createSyntaxSchema(),
    PackageId: hirIdentity("pkg", "string"), ModuleId: hirIdentity("mod", "string"),
    DefId: hirIdentity("def", "string"), BodyId: hirIdentity("body", "string"),
    GroupId: hirIdentity("group", "string"), ComponentId: hirIdentity("component", "string"),
    ExpansionId: hirIdentity("exp", "string"), NodeId: hirIdentity("n", "number"),
    LocalId: hirIdentity("l", "number"), TyId: hirIdentity("t", "number"),
    SigId: hirIdentity("sig", "number"), CandidateListId: hirIdentity("cand", "number"),
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
    DiagnosticCode: hirChoice(hirVariant("host", [["name", "string"], ["rendered", "string"]]),
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
    PragmaArguments: Object.freeze({ kind: "dictionary", label: "PragmaArguments", element: "PragmaArgument" }),
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
        hirRecord("HirPointerOperationCapture", [["family", hirLiteral("typed-location")], ["operation", hirLiteral(operation)], ...pointerArguments])),
      hirRecord("HirPointerOperationCapture", [["family", hirLiteral("typed-location")], ["operation", hirLiteral("view")],
        ["pointer", sourceReference], ["read", sourceReference], ["write", sourceReference], ["optional", "boolean"]]),
      variants("HirPointerOperationCapture", "operation", [["load", [["pointer", sourceReference]]],
        ["store", [["pointer", sourceReference], ["value", sourceReference]]], ["offset", [["pointer", sourceReference], ["offset", sourceReference]]]],
        [["family", hirLiteral("native-pointer")]]),
      hirRecord("HirPointerOperationCapture", [["family", hirLiteral("raw-address")], ["operation", hirLiteral("bind-raw-pointer")], ["identity", sourceReference]]),
      hirRecord("HirPointerOperationCapture", [["family", hirLiteral("raw-address")], ["operation", hirLiteral("equal-raw-pointer")], ["left", sourceReference], ["right", sourceReference]]),
      hirRecord("HirPointerOperationCapture", [["family", hirLiteral("raw-address")], ["operation", hirLiteral("hash-raw-pointer")], ["pointer", sourceReference]]),
      hirRecord("HirPointerOperationCapture", [["family", hirLiteral("raw-memory")], ["operation", hirLiteral("to-raw")], ["pointer", sourceReference], ["layout", sourceReference]]),
      hirRecord("HirPointerOperationCapture", [["family", hirLiteral("raw-memory")], ["operation", hirLiteral("reinterpret")], ["raw", sourceReference], ["layout", sourceReference]]),
      hirRecord("HirPointerOperationCapture", [["family", hirLiteral("raw-memory")], ["operation", hirLiteral("byte-offset")], ["raw", sourceReference],
        ["offset", sourceReference], ["integer", "HirIntegerOperandCapture"], ["dataLayout", sourceReference]]),
      hirRecord("HirPointerOperationCapture", [["family", hirLiteral("raw-memory")], ["operation", hirLiteral("raw-to-address-integer")], ["raw", sourceReference],
        ["integer", "HirAddressIntegerCapture"], ["dataLayout", sourceReference]]),
      hirRecord("HirPointerOperationCapture", [["family", hirLiteral("raw-memory")], ["operation", hirLiteral("address-integer-to-raw")], ["address", sourceReference],
        ["integer", "HirAddressIntegerCapture"], ["dataLayout", sourceReference]]),
      hirRecord("HirPointerOperationCapture", [["family", hirLiteral("keep-alive")], ["operation", hirLiteral("keep-alive")], ["value", sourceReference]])),
    HirAttributeCapture: variants("HirAttributeCapture", "kind", [["builder-state", []], ["application", [["invocation", sourceReference]]]], [
      ["occurrence", sourceReference], ["applicationTarget", sourceReference], ["selectedMember", hirNullable(hirRecord("Record", [
        ["selectedDeclaration", hirNullable(sourceReference)], ["declarations", hirArray(sourceReference)]]))],
      ["applicationMemberKind", hirNullable(hirLiteral("property", "method"))], ["applicationPlacement", hirNullable(hirLiteral("declaration", "constructor"))],
      ["applicationParameterName", hirNullable("string")], ["applicationTargetSpecifier", hirNullable("string")],
    ]),
    HirSafetySelectionCapture: hirChoice(hirVariant("selected", [["expression", sourceReference], ["declaration", hirNullable(sourceReference)], ["declarations", hirArray(sourceReference)]]),
      hirVariant("unavailable", [["reason", hirLiteral("function-shape", "receiver", "member-evidence")]])),
    HirSafetyCapture: hirChoice(
      hirRecord("HirSafetyCapture", [["occurrence", sourceReference], ["provider", "DefId"], ["family", hirLiteral("unsafe-context")], ["operation", hirLiteral("expression")], ["expression", sourceReference]]),
      hirRecord("HirSafetyCapture", [["occurrence", sourceReference], ["provider", "DefId"], ["family", hirLiteral("unsafe-context")], ["operation", hirLiteral("remaining-block")], ["firstDirectStatement", "boolean"]]),
      variants("HirSafetyCapture", "operation", [
        ["root", [["form", hirLiteral("type", "value")], ["target", hirNullable(sourceReference)]]],
        ["select-member", [["predecessor", hirNullable(sourceReference)], ["memberKind", hirLiteral("indexer", "method", "property")], ["selection", "HirSafetySelectionCapture"]]],
        ["placement", [["predecessor", hirNullable(sourceReference)], ["placement", hirLiteral("declaration", "constructor", "getter", "setter")]]],
        ["apply", [["predecessor", hirNullable(sourceReference)], ["contract", hirLiteral("requires-unsafe", "safe")]]],
      ], [["occurrence", sourceReference], ["provider", "DefId"], ["family", hirLiteral("safety")]])),
    HirArgumentPassingCapture: variants("HirArgumentPassingCapture", "role", [["declaration", [["mode", "PassingMode"]]],
      ["argument", [["mode", "PassingMode"], ["storageExpression", sourceReference]]]]),
    HirCoreCapture: hirRecord("HirCoreCapture", [["provider", captured(hirNullable("DefId"))], ["markers", captured("HirMarkersCapture")],
      ["pointerType", captured(hirNullable("HirPointerTypeCapture"))], ["pointerOperation", captured(hirNullable("HirPointerOperationCapture"))],
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
    CheckedClassExpression: hirRecord("CheckedClassExpression", [...checkedValue, ...core, ...declarationFacts.filter(([field]) => field !== "core"),
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
  readonly nodeOf: (reference: SourceNodeRef) => HirNode | null;
  readonly nodeExists: (reference: SourceNodeRef) => boolean;
  readonly referenceOf: (node: HirNode) => SourceNodeRef;
}

interface PlaceEntry {
  readonly node: HirNode;
  readonly place: HirStoragePlace;
}

interface PlaceVisit {
  readonly node: HirNode;
  readonly leaving: boolean;
  readonly next: PlaceVisit | null;
}

export function verifyHirPlaces(inventory: HirInventory, readers: HirCaptureReaders, report: HirReport): void {
  const entries: PlaceEntry[] = [];
  const known = new Set<HirNode>();
  const add = (node: HirNode, place: HirStoragePlace): void => { entries.push({ node, place }); known.add(node); };
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
  const edges = new Map<HirNode, Set<HirNode>>();
  for (const entry of entries) {
    if (entry.place.base.kind === "root") continue;
    const site: HirSite = { kind: "node", node: readers.referenceOf(entry.node) };
    const target = inventory.nodesById.get(entry.place.base.node);
    const owner = inventory.owners.get(entry.node);
    if (target === undefined || !known.has(target) || owner === undefined || inventory.owners.get(target) !== owner) {
      report("place-base-acyclic", site, "place base must name an actual place in the same body and end at a root");
    } else {
      const previous = edges.get(entry.node);
      if (previous === undefined) edges.set(entry.node, new Set([target]));
      else previous.add(target);
    }
    if (entry.node.kind === "PropertyAccessExpression" || entry.node.kind === "ElementAccessExpression") {
      const start = inventory.starts.get(entry.node.expression);
      const end = inventory.ends.get(entry.node.expression);
      const position = target === undefined ? undefined : inventory.starts.get(target);
      if (start === undefined || end === undefined || position === undefined || position < start || position >= end)
        report("place-access-base-in-receiver", site, "access base place must lie inside its actual receiver subtree");
    }
  }
  const colors = new Map<HirNode, "active" | "complete">();
  for (const root of known) {
    if (colors.has(root)) continue;
    let pending: PlaceVisit | null = { node: root, leaving: false, next: null };
    while (pending !== null) {
      const frame = pending;
      pending = frame.next;
      if (frame.leaving) { colors.set(frame.node, "complete"); continue; }
      const previous = colors.get(frame.node);
      if (previous === "complete") continue;
      if (previous === "active") {
        report("place-base-acyclic", { kind: "node", node: readers.referenceOf(frame.node) }, "place base chain must not revisit a place");
        continue;
      }
      colors.set(frame.node, "active");
      pending = { node: frame.node, leaving: true, next: pending };
      for (const node of edges.get(frame.node) ?? []) pending = { node, leaving: false, next: pending };
    }
  }
}

type MemoryCapture = HirMemoryLayoutCapture | HirMemoryFieldCapture;

interface CaptureEntry {
  readonly value: MemoryCapture;
  readonly site: HirSite;
}

interface MemoryVisit {
  readonly entry: CaptureEntry;
  readonly leaving: boolean;
  readonly next: MemoryVisit | null;
}

function sourceReferenceValue(value: unknown, hirSchema: HirSchema): value is SourceNodeRef {
  return checkHirShape(value, "SourceNodeRef", hirSchema);
}

function sameNode(left: SourceNodeRef, right: SourceNodeRef, readers: HirCaptureReaders): boolean {
  const first = readers.nodeOf(left);
  const second = readers.nodeOf(right);
  if (first !== null && second !== null) return first === second;
  return left.kind === right.kind && Object.is(left.value.node, right.value.node) &&
    (left.kind === "body" && right.kind === "body" ? left.value.body === right.value.body :
      left.kind === "item" && right.kind === "item" && left.value.owner === right.value.owner);
}

function memoryEdges(capture: MemoryCapture): readonly SourceNodeRef[] {
  switch (capture.kind) {
    case "data-layout": return [];
    case "value": return capture.fields.kind === "available" ? capture.fields.value : [];
    case "array": return capture.element.kind === "available" ? [capture.element.value] : [];
    case "field": return capture.fieldLayout.kind === "available" ? [capture.fieldLayout.value] : [];
  }
}

function verifyMemoryGraph(entries: readonly CaptureEntry[], captures: ReadonlyMap<HirNode, CaptureEntry>,
  readers: HirCaptureReaders, report: HirReport): void {
  const colors = new Map<CaptureEntry, "active" | "complete">();
  for (const root of entries) {
    if (colors.has(root)) continue;
    let pending: MemoryVisit | null = { entry: root, leaving: false, next: null };
    while (pending !== null) {
      const frame = pending;
      pending = frame.next;
      if (frame.leaving) { colors.set(frame.entry, "complete"); continue; }
      const previous = colors.get(frame.entry);
      if (previous === "complete") continue;
      if (previous === "active") {
        report("memory-layout-acyclic", frame.entry.site, "captured layout graph must be acyclic");
        continue;
      }
      colors.set(frame.entry, "active");
      pending = { entry: frame.entry, leaving: true, next: pending };
      const edges = memoryEdges(frame.entry.value);
      for (let ordinal = edges.length - 1; ordinal >= 0; ordinal -= 1) {
        const reference = edges[ordinal];
        if (reference === undefined) continue;
        const node = readers.nodeOf(reference);
        const child = node === null ? undefined : captures.get(node);
        if (!readers.nodeExists(reference) || (node !== null && child === undefined) ||
          (child !== undefined && (frame.entry.value.kind === "value" ? child.value.kind !== "field" :
            child.value.kind !== "value" && child.value.kind !== "array"))) {
          report("memory-capture-reference", frame.entry.site, "layout edge must name the required captured descriptor kind");
        }
        if (child !== undefined) pending = { entry: child, leaving: false, next: pending };
      }
    }
  }
}

function verifyObservation(observation: HirObservationCapture, node: HirNode, captures: ReadonlyMap<HirNode, CaptureEntry>,
  site: HirSite, readers: HirCaptureReaders, report: HirReport): void {
  const occurrence: SourceNodeRef = { kind: "body", value: observation.occurrence };
  if (!sameNode(occurrence, readers.referenceOf(node), readers) || !readers.nodeExists(occurrence))
    report("observation-capture-owner", site, "observation must retain its exact owning occurrence");
  if (observation.operation === "field-offset") {
    if (observation.selector === null || observation.field.kind === "available" && observation.field.value === null)
      report("observation-capture-owner", site, "field-offset observation requires its selector and selected field");
  } else if (observation.selector !== null || observation.field.kind === "available" && observation.field.value !== null)
    report("observation-capture-owner", site, "non-field observation cannot carry a field selection");
  if (observation.layout.kind === "available") {
    const layout = readers.nodeOf(observation.layout.value);
    const captured = layout === null ? undefined : captures.get(layout);
    if (!readers.nodeExists(observation.layout.value) || layout !== null && captured === undefined || captured !== undefined &&
      captured.value.kind !== "value" && captured.value.kind !== "array")
      report("memory-capture-reference", site, "observation layout must name a value or array descriptor");
  }
  if (observation.field.kind === "available" && observation.field.value !== null) {
    const field = readers.nodeOf(observation.field.value);
    const captured = field === null ? undefined : captures.get(field);
    if (!readers.nodeExists(observation.field.value) || field !== null && captured === undefined || captured !== undefined && captured.value.kind !== "field")
      report("memory-capture-reference", site, "observation field must name a field descriptor");
  }
}

export function verifyHirCaptures(nodes: readonly HirNode[], readers: HirCaptureReaders, report: HirReport,
  hirSchema: HirSchema, bindings: HirBindingRequest[]): void {
  const entries: CaptureEntry[] = [];
  const captures = new Map<HirNode, CaptureEntry>();
  const seen = new Set<MemoryCapture>();
  const observations: { readonly value: HirObservationCapture; readonly node: HirNode; readonly site: HirSite }[] = [];
  for (const node of nodes) {
    const metadata = node.tsonic;
    if (metadata === null) continue;
    const site: HirSite = { kind: "node", node: readers.referenceOf(node) };
    const value = "value" in metadata ? metadata.value : metadata;
    const memory = "memory" in value ? value.memory : null;
    if (memory !== null && memory.kind === "available" && memory.value !== null && !seen.has(memory.value)) {
      const capture = memory.value;
      seen.add(capture);
      const entry: CaptureEntry = { value: capture, site };
      entries.push(entry);
      if (capture.bindings.kind === "available")
        bindings.push({ kind: "occurrence", occurrence: capture.occurrence, vector: capture.bindings.value, site });
      const occurrence = readers.nodeOf(capture.occurrence);
      if (occurrence === null || !readers.nodeExists(capture.occurrence))
        report("memory-capture-owner", site, "capture occurrence must exist in this module");
      else {
        const previous = captures.get(occurrence);
        if (previous !== undefined && previous.value.kind !== capture.kind)
          report("memory-capture-owner", site, "one occurrence cannot own incompatible descriptor kinds");
        else if (previous === undefined) captures.set(occurrence, entry);
      }
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
    if (!("core" in metadata)) continue;
    const coreCapture = metadata.core;
    walkHirData({ value: coreCapture, shape: "HirCoreCapture", node, body: null, site }, hirSchema, data => {
      if (data.shape === "SourceNodeRef" && sourceReferenceValue(data.value, hirSchema) && !readers.nodeExists(data.value))
        report("core-capture-reference", site, "Core capture reference must retain an existing qualified source node");
    });
    if (coreCapture.markers.kind === "available") {
      const markers = coreCapture.markers.value;
      const references: SourceNodeRef[] = [];
      if (markers.struct !== null && markers.struct.fields.kind === "available")
        for (const field of markers.struct.fields.value) references.push(field.typeNode);
      if (markers.field !== null) references.push(markers.field.typeNode);
      if (markers.defaultValue !== null) references.push(markers.defaultValue.typeNode);
      for (const reference of references) {
        const target = readers.nodeOf(reference);
        if (target !== null && resolveHirShape("TypeNode", target, hirSchema) === null)
          report("core-capture-kind", site, "marker type reference must point to a type syntax node");
      }
    }
    if (coreCapture.argumentPassing.kind === "available" && coreCapture.argumentPassing.value !== null &&
      coreCapture.argumentPassing.value.role === "declaration" && node.kind !== "Parameter")
      report("core-capture-kind", site, "declaration passing mode belongs to a parameter declaration");
    if (coreCapture.attribute.kind === "available" && coreCapture.attribute.value !== null) {
      const attribute = coreCapture.attribute.value;
      const occurrence = readers.nodeOf(attribute.occurrence);
      if (occurrence !== null && occurrence.kind !== "CallExpression")
        report("core-capture-kind", site, "attribute capture occurrence must name its invocation");
      if (attribute.selectedMember !== null && attribute.selectedMember.selectedDeclaration !== null &&
        !attribute.selectedMember.declarations.some(reference => sameNode(reference, attribute.selectedMember?.selectedDeclaration ?? reference, readers)))
        report("core-capture-reference", site, "attribute selected declaration must belong to its declaration group");
    }
  }
  verifyMemoryGraph(entries, captures, readers, report);
  for (const observation of observations) verifyObservation(observation.value, observation.node, captures, observation.site, readers, report);
}
