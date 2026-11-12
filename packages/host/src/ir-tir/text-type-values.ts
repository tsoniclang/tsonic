import { lazyReader, literalReader, nullableReader, sequenceReader } from "./text-construction.js";
import { unionRecord } from "./text-layouts.js";
import type { TirRecordCodec } from "./text-layouts.js";
import type {
  TypedPhase
} from "./contract.js";
import type {
  ArtifactBindings, BindingVector, BodyInstance, CategoryEvidence, ComponentSelector, ConstructionDefinition, ExactRational, LiteralValue, MemberKey, MemberOrigin, NumericEvidence, PointerEvidence, SelfBinding, SumArmRole, SumEvidence, SumFamily, TypeBinding, TypeComponent, TypeEvidence, TypeParameter, TypeParameterIdentity
} from "../ir-types/contract.js";
import type {
  Derivation, ItemNodeRef, LibraryModuleIdentity, LocalRef, NodeRef, Origin, SourceNodeRef
} from "../ids/contract.js";
import type {
  CheckJsDirective, CommentDirective, CommentRange, DeclarationTarget, HirAttribute, HirCallableEndpoint, HirLexicalScope, ImportTarget, ModifierList, Pragma, PragmaArgument, PragmaArguments, TextRange
} from "../ir-hir/contract.js";
import type {
  Diagnostic, DiagnosticCode, DiagnosticFix, DiagnosticSite, MessageArgument, RelatedDiagnostic, TextEdit
} from "../diag/contract.js";
import type { TirTextKernel, TirTypedRecordWork } from "./text-layouts.js";
import { scalarWork, referenceWork, syntaxReference, nullableWork, sequenceWork } from "./text-layouts.js";

export interface TypeValuesTextModel {
  readonly work_DeclarationTarget_local: TirRecordCodec<DeclarationTarget & { readonly kind: "local" }>;
  readonly work_DeclarationTarget_definition: TirRecordCodec<DeclarationTarget & { readonly kind: "definition" }>;
  readonly work_ArtifactBindings_parametric: TirRecordCodec<ArtifactBindings & { readonly kind: "parametric" }>;
  readonly work_ArtifactBindings_instantiated: TirRecordCodec<ArtifactBindings & { readonly kind: "instantiated" }>;
  readonly work_BindingVector: TirRecordCodec<BindingVector>;
  readonly work_TypeBinding_bound: TirRecordCodec<TypeBinding & { readonly kind: "bound" }>;
  readonly work_TypeBinding_rigid: TirRecordCodec<TypeBinding & { readonly kind: "rigid" }>;
  readonly work_SelfBinding_bound: TirRecordCodec<SelfBinding & { readonly kind: "bound" }>;
  readonly work_SelfBinding_rigid: TirRecordCodec<SelfBinding & { readonly kind: "rigid" }>;
  readonly work_TypeParameterIdentity: TirRecordCodec<TypeParameterIdentity>;
  readonly work_TypeParameter: TirRecordCodec<TypeParameter>;
  readonly work_BodyInstance: TirRecordCodec<BodyInstance>;
  readonly work_ExactRational: TirRecordCodec<ExactRational>;
  readonly work_NodeRef: TirRecordCodec<NodeRef>;
  readonly work_ItemNodeRef: TirRecordCodec<ItemNodeRef>;
  readonly work_SourceNodeRef_body: TirRecordCodec<SourceNodeRef & { readonly kind: "body" }>;
  readonly work_SourceNodeRef_item: TirRecordCodec<SourceNodeRef & { readonly kind: "item" }>;
  readonly work_LocalRef: TirRecordCodec<LocalRef>;
  readonly work_Origin: TirRecordCodec<Origin>;
  readonly work_Derivation_lowering: TirRecordCodec<Derivation & { readonly kind: "lowering" }>;
  readonly work_Derivation_expansion: TirRecordCodec<Derivation & { readonly kind: "expansion" }>;
  readonly work_HirLexicalScope: TirRecordCodec<HirLexicalScope>;
  readonly work_HirAttribute: TirRecordCodec<HirAttribute>;
  readonly work_HirCallableEndpoint: TirRecordCodec<HirCallableEndpoint>;
  readonly work_ImportTarget_target_project: TirRecordCodec<ImportTarget & { readonly target: "project" }>;
  readonly work_ImportTarget_target_library: TirRecordCodec<ImportTarget & { readonly target: "library" }>;
  readonly work_LibraryModuleIdentity: TirRecordCodec<LibraryModuleIdentity>;
  readonly work_MemberKey_text: TirRecordCodec<MemberKey & { readonly kind: "text" }>;
  readonly work_MemberKey_number: TirRecordCodec<MemberKey & { readonly kind: "number" }>;
  readonly work_MemberKey_symbol: TirRecordCodec<MemberKey & { readonly kind: "symbol" }>;
  readonly work_MemberOrigin_declared: TirRecordCodec<MemberOrigin & { readonly kind: "declared" }>;
  readonly work_MemberOrigin_class_prototype: TirRecordCodec<MemberOrigin & { readonly kind: "class-prototype" }>;
  readonly work_MemberOrigin_mapped: TirRecordCodec<MemberOrigin & { readonly kind: "mapped" }>;
  readonly work_TypeComponent: TirRecordCodec<TypeComponent>;
  readonly work_ComponentSelector_class_value: TirRecordCodec<ComponentSelector & { readonly kind: "class-value" }>;
  readonly work_ComponentSelector_construction_argument: TirRecordCodec<ComponentSelector & { readonly kind: "construction-argument" }>;
  readonly work_ComponentSelector_optional_value: TirRecordCodec<ComponentSelector & { readonly kind: "optional-value" }>;
  readonly work_ComponentSelector_array_element: TirRecordCodec<ComponentSelector & { readonly kind: "array-element" }>;
  readonly work_ComponentSelector_tuple_element: TirRecordCodec<ComponentSelector & { readonly kind: "tuple-element" }>;
  readonly work_ComponentSelector_union_member: TirRecordCodec<ComponentSelector & { readonly kind: "union-member" | "argument-place" | "parameter-place" }>;
  readonly work_ComponentSelector_argument_place: TirRecordCodec<ComponentSelector & { readonly kind: "union-member" | "argument-place" | "parameter-place" }>;
  readonly work_ComponentSelector_parameter_place: TirRecordCodec<ComponentSelector & { readonly kind: "union-member" | "argument-place" | "parameter-place" }>;
  readonly work_ComponentSelector_intersection_member: TirRecordCodec<ComponentSelector & { readonly kind: "intersection-member" }>;
  readonly work_ComponentSelector_intersection_result: TirRecordCodec<ComponentSelector & { readonly kind: "intersection-result" }>;
  readonly work_ComponentSelector_argument_tail: TirRecordCodec<ComponentSelector & { readonly kind: "argument-tail" | "parameter-tail" }>;
  readonly work_ComponentSelector_parameter_tail: TirRecordCodec<ComponentSelector & { readonly kind: "argument-tail" | "parameter-tail" }>;
  readonly work_ComponentSelector_member: TirRecordCodec<ComponentSelector & { readonly kind: "member" }>;
  readonly work_ComponentSelector_index_key: TirRecordCodec<ComponentSelector & { readonly kind: "index-key" | "index-value" }>;
  readonly work_ComponentSelector_index_value: TirRecordCodec<ComponentSelector & { readonly kind: "index-key" | "index-value" }>;
  readonly work_ComponentSelector_projection_source: TirRecordCodec<ComponentSelector & { readonly kind: "projection-source" }>;
  readonly work_ComponentSelector_parameter: TirRecordCodec<ComponentSelector & { readonly kind: "parameter" }>;
  readonly work_ComponentSelector_receiver: TirRecordCodec<ComponentSelector & { readonly kind: "receiver" }>;
  readonly work_ComponentSelector_signature_tail: TirRecordCodec<ComponentSelector & { readonly kind: "signature-tail" }>;
  readonly work_ComponentSelector_tuple_slice: TirRecordCodec<ComponentSelector & { readonly kind: "tuple-slice" }>;
  readonly work_ComponentSelector_result: TirRecordCodec<ComponentSelector & { readonly kind: "result" }>;
  readonly work_ComponentSelector_type_argument: TirRecordCodec<ComponentSelector & { readonly kind: "type-argument" }>;
  readonly work_ComponentSelector_sum_arm: TirRecordCodec<ComponentSelector & { readonly kind: "sum-arm" }>;
  readonly work_ComponentSelector_awaited: TirRecordCodec<ComponentSelector & { readonly kind: "awaited" }>;
  readonly work_ConstructionDefinition: TirRecordCodec<ConstructionDefinition>;
  readonly work_SumFamily: TirRecordCodec<SumFamily>;
  readonly work_SumArmRole: TirRecordCodec<SumArmRole>;
  readonly work_TypeEvidence: TirRecordCodec<TypeEvidence>;
  readonly work_CategoryEvidence_known: TirRecordCodec<CategoryEvidence & { readonly kind: "known" }>;
  readonly work_CategoryEvidence_parameter: TirRecordCodec<CategoryEvidence & { readonly kind: "parameter" }>;
  readonly work_CategoryEvidence_choice: TirRecordCodec<CategoryEvidence & { readonly kind: "choice" }>;
  readonly work_CategoryEvidence_dynamic: TirRecordCodec<CategoryEvidence & { readonly kind: "dynamic" }>;
  readonly work_NumericEvidence: TirRecordCodec<NumericEvidence>;
  readonly work_SumEvidence: TirRecordCodec<SumEvidence>;
  readonly work_PointerEvidence_raw_address: TirRecordCodec<PointerEvidence & { readonly kind: "raw-address" }>;
  readonly work_PointerEvidence_typed_location: TirRecordCodec<PointerEvidence & { readonly kind: "typed-location" }>;
  readonly work_PointerEvidence_native_pointer: TirRecordCodec<PointerEvidence & { readonly kind: "native-pointer" }>;
  readonly work_PointerEvidence_function_pointer: TirRecordCodec<PointerEvidence & { readonly kind: "function-pointer" }>;
  readonly work_LiteralValue_number: TirRecordCodec<LiteralValue & { readonly kind: "number" }>;
  readonly work_LiteralValue_bigint: TirRecordCodec<LiteralValue & { readonly kind: "bigint" }>;
  readonly work_LiteralValue_string: TirRecordCodec<LiteralValue & { readonly kind: "string" }>;
  readonly work_LiteralValue_boolean: TirRecordCodec<LiteralValue & { readonly kind: "boolean" }>;
  readonly work_LiteralValue_absence: TirRecordCodec<LiteralValue & { readonly kind: "absence" }>;
  readonly work_LiteralValue_unique_symbol: TirRecordCodec<LiteralValue & { readonly kind: "unique-symbol" }>;
  readonly work_Diagnostic: TirRecordCodec<Diagnostic>;
  readonly work_DiagnosticCode_host: TirRecordCodec<DiagnosticCode & { readonly kind: "host" }>;
  readonly work_DiagnosticCode_checker: TirRecordCodec<DiagnosticCode & { readonly kind: "checker" }>;
  readonly work_DiagnosticCode_extension: TirRecordCodec<DiagnosticCode & { readonly kind: "extension" }>;
  readonly work_DiagnosticSite_source: TirRecordCodec<DiagnosticSite & { readonly kind: "source" }>;
  readonly work_DiagnosticSite_file: TirRecordCodec<DiagnosticSite & { readonly kind: "file" }>;
  readonly work_DiagnosticSite_none: TirRecordCodec<DiagnosticSite & { readonly kind: "none" }>;
  readonly work_MessageArgument_text: TirRecordCodec<MessageArgument & { readonly kind: "text" }>;
  readonly work_MessageArgument_integer: TirRecordCodec<MessageArgument & { readonly kind: "integer" }>;
  readonly work_MessageArgument_number: TirRecordCodec<MessageArgument & { readonly kind: "number" }>;
  readonly work_MessageArgument_origin: TirRecordCodec<MessageArgument & { readonly kind: "origin" }>;
  readonly work_RelatedDiagnostic: TirRecordCodec<RelatedDiagnostic>;
  readonly work_DiagnosticFix: TirRecordCodec<DiagnosticFix>;
  readonly work_TextEdit: TirRecordCodec<TextEdit>;
  readonly work_ModifierList: TirRecordCodec<ModifierList<TypedPhase>>;
  readonly work_TextRange: TirRecordCodec<TextRange>;
  readonly work_CommentDirective: TirRecordCodec<CommentDirective>;
  readonly work_CommentRange: TirRecordCodec<CommentRange>;
  readonly work_PragmaArgument: TirRecordCodec<PragmaArgument>;
  readonly work_Pragma: TirRecordCodec<Pragma>;
  readonly work_PragmaArguments: TirRecordCodec<PragmaArguments>;
  readonly work_CheckJsDirective: TirRecordCodec<CheckJsDirective>;
  readonly work_DeclarationTarget: TirRecordCodec<DeclarationTarget>;
  readonly work_ArtifactBindings: TirRecordCodec<ArtifactBindings>;
  readonly work_TypeBinding: TirRecordCodec<TypeBinding>;
  readonly work_SelfBinding: TirRecordCodec<SelfBinding>;
  readonly work_SourceNodeRef: TirRecordCodec<SourceNodeRef>;
  readonly work_Derivation: TirRecordCodec<Derivation>;
  readonly work_ImportTarget: TirRecordCodec<ImportTarget>;
  readonly work_MemberKey: TirRecordCodec<MemberKey>;
  readonly work_MemberOrigin: TirRecordCodec<MemberOrigin>;
  readonly work_ComponentSelector: TirRecordCodec<ComponentSelector>;
  readonly work_CategoryEvidence: TirRecordCodec<CategoryEvidence>;
  readonly work_PointerEvidence: TirRecordCodec<PointerEvidence>;
  readonly work_LiteralValue: TirRecordCodec<LiteralValue>;
  readonly work_DiagnosticCode: TirRecordCodec<DiagnosticCode>;
  readonly work_DiagnosticSite: TirRecordCodec<DiagnosticSite>;
  readonly work_MessageArgument: TirRecordCodec<MessageArgument>;
}

export const createTypeValuesText = (kernel: TirTextKernel): TypeValuesTextModel => {
  const { defineRecord, dynamicRecord, syntaxReads, bigintReader, bodyReader, booleanReader, definitionReader, diagnosticCodeReader, expansionReader, localReader, moduleReader, nodeReader, numberReader, signatureReader, stringReader, typeReader } = kernel;
  const work_DeclarationTarget_local: TirRecordCodec<DeclarationTarget & { readonly kind: "local" }> = defineRecord<DeclarationTarget & { readonly kind: "local" }>("DeclarationTarget#local", "DeclarationTarget", { field: "kind", value: "local" }, "local", null, null, fields => fields
    .field("local", "LocalRef", value => work_LocalRef(value.local), lazyReader(() => work_LocalRef.reader))
    .finish((field_local) => ({ kind: "local", local: field_local })));
  const work_DeclarationTarget_definition: TirRecordCodec<DeclarationTarget & { readonly kind: "definition" }> = defineRecord<DeclarationTarget & { readonly kind: "definition" }>("DeclarationTarget#definition", "DeclarationTarget", { field: "kind", value: "definition" }, "definition", null, null, fields => fields
    .field("definition", "def", value => referenceWork("def", value.definition), definitionReader)
    .finish((field_definition) => ({ kind: "definition", definition: field_definition })));
  const work_ArtifactBindings_parametric: TirRecordCodec<ArtifactBindings & { readonly kind: "parametric" }> = defineRecord<ArtifactBindings & { readonly kind: "parametric" }>("ArtifactBindings#parametric", "ArtifactBindings", { field: "kind", value: "parametric" }, "parametric", null, null, fields => fields
    .finish(() => ({ kind: "parametric" })));
  const work_ArtifactBindings_instantiated: TirRecordCodec<ArtifactBindings & { readonly kind: "instantiated" }> = defineRecord<ArtifactBindings & { readonly kind: "instantiated" }>("ArtifactBindings#instantiated", "ArtifactBindings", { field: "kind", value: "instantiated" }, "instantiated", null, null, fields => fields
    .field("bindings", "BindingVector", value => work_BindingVector(value.bindings), lazyReader(() => work_BindingVector.reader))
    .finish((field_bindings) => ({ kind: "instantiated", bindings: field_bindings })));
  const work_BindingVector: TirRecordCodec<BindingVector> = defineRecord<BindingVector>("BindingVector", "BindingVector", null, "BindingVector", null, value => ({ kind: "binding", value }), fields => fields
    .field("classBindings", "[TypeBinding]", value => sequenceWork("[TypeBinding]", value.classBindings, actual => work_TypeBinding(actual)), sequenceReader("[TypeBinding]", lazyReader(() => work_TypeBinding.reader)))
    .field("methodBindings", "[TypeBinding]", value => sequenceWork("[TypeBinding]", value.methodBindings, actual => work_TypeBinding(actual)), sequenceReader("[TypeBinding]", lazyReader(() => work_TypeBinding.reader)))
    .field("capturedBindings", "[TypeBinding]", value => sequenceWork("[TypeBinding]", value.capturedBindings, actual => work_TypeBinding(actual)), sequenceReader("[TypeBinding]", lazyReader(() => work_TypeBinding.reader)))
    .field("selfBindings", "[SelfBinding]", value => sequenceWork("[SelfBinding]", value.selfBindings, actual => work_SelfBinding(actual)), sequenceReader("[SelfBinding]", lazyReader(() => work_SelfBinding.reader)))
    .finish((field_classBindings, field_methodBindings, field_capturedBindings, field_selfBindings) => ({
      classBindings: field_classBindings, methodBindings: field_methodBindings, capturedBindings: field_capturedBindings,
      selfBindings: field_selfBindings,
    })));
  const work_TypeBinding_bound: TirRecordCodec<TypeBinding & { readonly kind: "bound" }> = defineRecord<TypeBinding & { readonly kind: "bound" }>("TypeBinding#bound", "TypeBinding", { field: "kind", value: "bound" }, "bound", null, null, fields => fields
    .field("parameter", "TypeParameterIdentity", value => work_TypeParameterIdentity(value.parameter), lazyReader(() => work_TypeParameterIdentity.reader))
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .finish((field_parameter, field_type) => ({ kind: "bound", parameter: field_parameter, type: field_type })));
  const work_TypeBinding_rigid: TirRecordCodec<TypeBinding & { readonly kind: "rigid" }> = defineRecord<TypeBinding & { readonly kind: "rigid" }>("TypeBinding#rigid", "TypeBinding", { field: "kind", value: "rigid" }, "rigid", null, null, fields => fields
    .field("parameter", "TypeParameterIdentity", value => work_TypeParameterIdentity(value.parameter), lazyReader(() => work_TypeParameterIdentity.reader))
    .finish((field_parameter) => ({ kind: "rigid", parameter: field_parameter })));
  const work_SelfBinding_bound: TirRecordCodec<SelfBinding & { readonly kind: "bound" }> = defineRecord<SelfBinding & { readonly kind: "bound" }>("SelfBinding#bound", "SelfBinding", { field: "kind", value: "bound" }, "bound", null, null, fields => fields
    .field("owner", "def", value => referenceWork("def", value.owner), definitionReader)
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .finish((field_owner, field_type) => ({ kind: "bound", owner: field_owner, type: field_type })));
  const work_SelfBinding_rigid: TirRecordCodec<SelfBinding & { readonly kind: "rigid" }> = defineRecord<SelfBinding & { readonly kind: "rigid" }>("SelfBinding#rigid", "SelfBinding", { field: "kind", value: "rigid" }, "rigid", null, null, fields => fields
    .field("owner", "def", value => referenceWork("def", value.owner), definitionReader)
    .finish((field_owner) => ({ kind: "rigid", owner: field_owner })));
  const work_TypeParameterIdentity: TirRecordCodec<TypeParameterIdentity> = defineRecord<TypeParameterIdentity>("TypeParameterIdentity", "TypeParameterIdentity", null, "TypeParameterIdentity", null, null, fields => fields
    .field("owner", "def", value => referenceWork("def", value.owner), definitionReader)
    .field("index", "number", value => scalarWork("number", value.index), numberReader)
    .finish((field_owner, field_index) => ({ owner: field_owner, index: field_index })));
  const work_TypeParameter: TirRecordCodec<TypeParameter> = defineRecord<TypeParameter>("TypeParameter", "TypeParameter", null, "TypeParameter", null, null, fields => fields
    .field("identity", "TypeParameterIdentity", value => work_TypeParameterIdentity(value.identity), lazyReader(() => work_TypeParameterIdentity.reader))
    .field("declaration", "def", value => referenceWork("def", value.declaration), definitionReader)
    .field("constraint", "?t", value => nullableWork(value.constraint, actual => referenceWork("t", actual)), nullableReader(typeReader))
    .field("default", "?t", value => nullableWork(value.default, actual => referenceWork("t", actual)), nullableReader(typeReader))
    .finish((field_identity, field_declaration, field_constraint, field_default) => ({ identity: field_identity, declaration: field_declaration, constraint: field_constraint, default: field_default })));
  const work_BodyInstance: TirRecordCodec<BodyInstance> = defineRecord<BodyInstance>("BodyInstance", "BodyInstance", null, "BodyInstance", null, null, fields => fields
    .field("body", "body", value => scalarWork("body", value.body), bodyReader)
    .field("bindings", "ArtifactBindings", value => work_ArtifactBindings(value.bindings), lazyReader(() => work_ArtifactBindings.reader))
    .finish((field_body, field_bindings) => ({ body: field_body, bindings: field_bindings })));
  const work_ExactRational: TirRecordCodec<ExactRational> = defineRecord<ExactRational>("ExactRational", "ExactRational", null, "ExactRational", null, null, fields => fields
    .field("numerator", "bigint", value => scalarWork("bigint", value.numerator), bigintReader)
    .field("denominator", "bigint", value => scalarWork("bigint", value.denominator), bigintReader)
    .field("negativeZero", "boolean", value => scalarWork("boolean", value.negativeZero), booleanReader)
    .finish((field_numerator, field_denominator, field_negativeZero) => ({ numerator: field_numerator, denominator: field_denominator, negativeZero: field_negativeZero })));
  const work_NodeRef: TirRecordCodec<NodeRef> = defineRecord<NodeRef>("NodeRef", "NodeRef", null, "NodeRef", null, value => ({ kind: "node-reference", value }), fields => fields
    .field("body", "body", value => scalarWork("body", value.body), bodyReader)
    .field("node", "n", value => referenceWork("n", value.node), nodeReader)
    .finish((field_body, field_node) => ({ body: field_body, node: field_node })));
  const work_ItemNodeRef: TirRecordCodec<ItemNodeRef> = defineRecord<ItemNodeRef>("ItemNodeRef", "ItemNodeRef", null, "ItemNodeRef", null, null, fields => fields
    .field("owner", "def", value => referenceWork("def", value.owner), definitionReader)
    .field("node", "n", value => referenceWork("n", value.node), nodeReader)
    .finish((field_owner, field_node) => ({ owner: field_owner, node: field_node })));
  const work_SourceNodeRef_body: TirRecordCodec<SourceNodeRef & { readonly kind: "body" }> = defineRecord<SourceNodeRef & { readonly kind: "body" }>("SourceNodeRef#body", "SourceNodeRef", { field: "kind", value: "body" }, "body", null, value => ({ kind: "source-reference", value }), fields => fields
    .field("value", "NodeRef", value => work_NodeRef(value.value), lazyReader(() => work_NodeRef.reader))
    .finish((field_value) => ({ kind: "body", value: field_value })));
  const work_SourceNodeRef_item: TirRecordCodec<SourceNodeRef & { readonly kind: "item" }> = defineRecord<SourceNodeRef & { readonly kind: "item" }>("SourceNodeRef#item", "SourceNodeRef", { field: "kind", value: "item" }, "item", null, value => ({ kind: "source-reference", value }), fields => fields
    .field("value", "ItemNodeRef", value => work_ItemNodeRef(value.value), lazyReader(() => work_ItemNodeRef.reader))
    .finish((field_value) => ({ kind: "item", value: field_value })));
  const work_LocalRef: TirRecordCodec<LocalRef> = defineRecord<LocalRef>("LocalRef", "LocalRef", null, "LocalRef", null, value => ({ kind: "local-reference", value }), fields => fields
    .field("body", "body", value => scalarWork("body", value.body), bodyReader)
    .field("local", "l", value => referenceWork("l", value.local), localReader)
    .finish((field_body, field_local) => ({ body: field_body, local: field_local })));
  const work_Origin: TirRecordCodec<Origin> = defineRecord<Origin>("Origin", "Origin", null, "Origin", null, null, fields => fields
    .field("module", "mod", value => scalarWork("mod", value.module), moduleReader)
    .field("start", "number", value => scalarWork("number", value.start), numberReader)
    .field("length", "number", value => scalarWork("number", value.length), numberReader)
    .field("derived", "[Derivation]", value => sequenceWork("[Derivation]", value.derived, actual => work_Derivation(actual)), sequenceReader("[Derivation]", lazyReader(() => work_Derivation.reader)))
    .finish((field_module, field_start, field_length, field_derived) => ({ module: field_module, start: field_start, length: field_length, derived: field_derived })));
  const work_Derivation_lowering: TirRecordCodec<Derivation & { readonly kind: "lowering" }> = defineRecord<Derivation & { readonly kind: "lowering" }>("Derivation#lowering", "Derivation", { field: "kind", value: "lowering" }, "lowering", null, null, fields => fields
    .field("pass", "PassName", value => scalarWork("PassName", value.pass), literalReader<(Derivation & { readonly kind: "lowering" })["pass"]>("PassName", ["front","decls","infer","elaborate","validate","lower-mir","evaluate","metadata","liveness","initialization","refinements","origins","suspension","errorStorage","pointerBacking","summaries","pipeline"]))
    .finish((field_pass) => ({ kind: "lowering", pass: field_pass })));
  const work_Derivation_expansion: TirRecordCodec<Derivation & { readonly kind: "expansion" }> = defineRecord<Derivation & { readonly kind: "expansion" }>("Derivation#expansion", "Derivation", { field: "kind", value: "expansion" }, "expansion", null, null, fields => fields
    .field("expansion", "exp", value => scalarWork("exp", value.expansion), expansionReader)
    .finish((field_expansion) => ({ kind: "expansion", expansion: field_expansion })));
  const work_HirLexicalScope: TirRecordCodec<HirLexicalScope> = defineRecord<HirLexicalScope>("HirLexicalScope", "HirLexicalScope", null, "HirLexicalScope", null, null, fields => fields
    .field("node", "n", value => referenceWork("n", value.node), nodeReader)
    .field("parent", "?n", value => nullableWork(value.parent, actual => referenceWork("n", actual)), nullableReader(nodeReader))
    .field("attributes", "[HirAttribute]", value => sequenceWork("[HirAttribute]", value.attributes, actual => work_HirAttribute(actual)), sequenceReader("[HirAttribute]", lazyReader(() => work_HirAttribute.reader)))
    .finish((field_node, field_parent, field_attributes) => ({ node: field_node, parent: field_parent, attributes: field_attributes })));
  const work_HirAttribute: TirRecordCodec<HirAttribute> = defineRecord<HirAttribute>("HirAttribute", "HirAttribute", null, "HirAttribute", null, null, fields => fields
    .field("declaration", "def", value => referenceWork("def", value.declaration), definitionReader)
    .field("occurrence", "SourceNodeRef", value => work_SourceNodeRef(value.occurrence), lazyReader(() => work_SourceNodeRef.reader))
    .field("arguments", "[SourceNodeRef]", value => sequenceWork("[SourceNodeRef]", value.arguments, actual => work_SourceNodeRef(actual)), sequenceReader("[SourceNodeRef]", lazyReader(() => work_SourceNodeRef.reader)))
    .finish((field_declaration, field_occurrence, field_arguments) => ({ declaration: field_declaration, occurrence: field_occurrence, arguments: field_arguments })));
  const work_HirCallableEndpoint: TirRecordCodec<HirCallableEndpoint> = defineRecord<HirCallableEndpoint>("HirCallableEndpoint", "HirCallableEndpoint", null, "HirCallableEndpoint", null, null, fields => fields
    .field("declaration", "def", value => referenceWork("def", value.declaration), definitionReader)
    .field("role", "EndpointRole", value => scalarWork("EndpointRole", value.role), literalReader<(HirCallableEndpoint)["role"]>("EndpointRole", ["advertised","api-signature","api-body"]))
    .field("signature", "sig", value => referenceWork("sig", value.signature), signatureReader)
    .field("body", "?body", value => nullableWork(value.body, actual => scalarWork("body", actual)), nullableReader(bodyReader))
    .finish((field_declaration, field_role, field_signature, field_body) => ({ declaration: field_declaration, role: field_role, signature: field_signature, body: field_body })));
  const work_ImportTarget_target_project: TirRecordCodec<ImportTarget & { readonly target: "project" }> = defineRecord<ImportTarget & { readonly target: "project" }>("ImportTarget@target=project", "ImportTarget", { field: "target", value: "project" }, "ImportTarget", null, null, fields => fields
    .field("target", "'project", value => scalarWork("'project", value.target), literalReader<(ImportTarget & { readonly target: "project" })["target"]>("'project", ["project"]))
    .field("module", "mod", value => scalarWork("mod", value.module), moduleReader)
    .finish((field_target, field_module) => ({ target: field_target, module: field_module })));
  const work_ImportTarget_target_library: TirRecordCodec<ImportTarget & { readonly target: "library" }> = defineRecord<ImportTarget & { readonly target: "library" }>("ImportTarget@target=library", "ImportTarget", { field: "target", value: "library" }, "ImportTarget", null, null, fields => fields
    .field("target", "'library", value => scalarWork("'library", value.target), literalReader<(ImportTarget & { readonly target: "library" })["target"]>("'library", ["library"]))
    .field("module", "LibraryModuleIdentity", value => work_LibraryModuleIdentity(value.module), lazyReader(() => work_LibraryModuleIdentity.reader))
    .finish((field_target, field_module) => ({ target: field_target, module: field_module })));
  const work_LibraryModuleIdentity: TirRecordCodec<LibraryModuleIdentity> = defineRecord<LibraryModuleIdentity>("LibraryModuleIdentity", "LibraryModuleIdentity", null, "LibraryModuleIdentity", null, null, fields => fields
    .field("providerId", "string", value => scalarWork("string", value.providerId), stringReader)
    .field("providerVersion", "string", value => scalarWork("string", value.providerVersion), stringReader)
    .field("packageName", "?string", value => nullableWork(value.packageName, actual => scalarWork("string", actual)), nullableReader(stringReader))
    .field("moduleSpecifier", "string", value => scalarWork("string", value.moduleSpecifier), stringReader)
    .field("providerModuleId", "string", value => scalarWork("string", value.providerModuleId), stringReader)
    .finish((field_providerId, field_providerVersion, field_packageName, field_moduleSpecifier, field_providerModuleId) => ({
      providerId: field_providerId, providerVersion: field_providerVersion, packageName: field_packageName,
      moduleSpecifier: field_moduleSpecifier, providerModuleId: field_providerModuleId,
    })));
  const work_MemberKey_text: TirRecordCodec<MemberKey & { readonly kind: "text" }> = defineRecord<MemberKey & { readonly kind: "text" }>("MemberKey#text", "MemberKey", { field: "kind", value: "text" }, "text", null, null, fields => fields
    .field("value", "string", value => scalarWork("string", value.value), stringReader)
    .finish((field_value) => ({ kind: "text", value: field_value })));
  const work_MemberKey_number: TirRecordCodec<MemberKey & { readonly kind: "number" }> = defineRecord<MemberKey & { readonly kind: "number" }>("MemberKey#number", "MemberKey", { field: "kind", value: "number" }, "number", null, null, fields => fields
    .field("value", "ExactRational", value => work_ExactRational(value.value), lazyReader(() => work_ExactRational.reader))
    .finish((field_value) => ({ kind: "number", value: field_value })));
  const work_MemberKey_symbol: TirRecordCodec<MemberKey & { readonly kind: "symbol" }> = defineRecord<MemberKey & { readonly kind: "symbol" }>("MemberKey#symbol", "MemberKey", { field: "kind", value: "symbol" }, "symbol", null, null, fields => fields
    .field("declaration", "def", value => referenceWork("def", value.declaration), definitionReader)
    .finish((field_declaration) => ({ kind: "symbol", declaration: field_declaration })));
  const work_MemberOrigin_declared: TirRecordCodec<MemberOrigin & { readonly kind: "declared" }> = defineRecord<MemberOrigin & { readonly kind: "declared" }>("MemberOrigin#declared", "MemberOrigin", { field: "kind", value: "declared" }, "declared", null, null, fields => fields
    .field("declaration", "def", value => referenceWork("def", value.declaration), definitionReader)
    .finish((field_declaration) => ({ kind: "declared", declaration: field_declaration })));
  const work_MemberOrigin_class_prototype: TirRecordCodec<MemberOrigin & { readonly kind: "class-prototype" }> = defineRecord<MemberOrigin & { readonly kind: "class-prototype" }>("MemberOrigin#class-prototype", "MemberOrigin", { field: "kind", value: "class-prototype" }, "class-prototype", null, null, fields => fields
    .field("owner", "def", value => referenceWork("def", value.owner), definitionReader)
    .finish((field_owner) => ({ kind: "class-prototype", owner: field_owner })));
  const work_MemberOrigin_mapped: TirRecordCodec<MemberOrigin & { readonly kind: "mapped" }> = defineRecord<MemberOrigin & { readonly kind: "mapped" }>("MemberOrigin#mapped", "MemberOrigin", { field: "kind", value: "mapped" }, "mapped", null, null, fields => fields
    .field("owner", "SourceNodeRef", value => work_SourceNodeRef(value.owner), lazyReader(() => work_SourceNodeRef.reader))
    .field("key", "MemberKey", value => work_MemberKey(value.key), lazyReader(() => work_MemberKey.reader))
    .finish((field_owner, field_key) => ({ kind: "mapped", owner: field_owner, key: field_key })));
  const work_TypeComponent: TirRecordCodec<TypeComponent> = defineRecord<TypeComponent>("TypeComponent", "TypeComponent", null, "TypeComponent", null, null, fields => fields
    .field("root", "SourceNodeRef", value => work_SourceNodeRef(value.root), lazyReader(() => work_SourceNodeRef.reader))
    .field("path", "[ComponentSelector]", value => sequenceWork("[ComponentSelector]", value.path, actual => work_ComponentSelector(actual)), sequenceReader("[ComponentSelector]", lazyReader(() => work_ComponentSelector.reader)))
    .finish((field_root, field_path) => ({ root: field_root, path: field_path })));
  const work_ComponentSelector_class_value: TirRecordCodec<ComponentSelector & { readonly kind: "class-value" }> = defineRecord<ComponentSelector & { readonly kind: "class-value" }>("ComponentSelector#class-value", "ComponentSelector", { field: "kind", value: "class-value" }, "class-value", null, null, fields => fields
    .finish(() => ({ kind: "class-value" })));
  const work_ComponentSelector_construction_argument: TirRecordCodec<ComponentSelector & { readonly kind: "construction-argument" }> = defineRecord<ComponentSelector & { readonly kind: "construction-argument" }>("ComponentSelector#construction-argument", "ComponentSelector", { field: "kind", value: "construction-argument" }, "construction-argument", null, null, fields => fields
    .field("definition", "ConstructionDefinition", value => work_ConstructionDefinition(value.definition), lazyReader(() => work_ConstructionDefinition.reader))
    .field("index", "number", value => scalarWork("number", value.index), numberReader)
    .finish((field_definition, field_index) => ({ kind: "construction-argument", definition: field_definition, index: field_index })));
  const work_ComponentSelector_optional_value: TirRecordCodec<ComponentSelector & { readonly kind: "optional-value" }> = defineRecord<ComponentSelector & { readonly kind: "optional-value" }>("ComponentSelector#optional-value", "ComponentSelector", { field: "kind", value: "optional-value" }, "optional-value", null, null, fields => fields
    .finish(() => ({ kind: "optional-value" })));
  const work_ComponentSelector_array_element: TirRecordCodec<ComponentSelector & { readonly kind: "array-element" }> = defineRecord<ComponentSelector & { readonly kind: "array-element" }>("ComponentSelector#array-element", "ComponentSelector", { field: "kind", value: "array-element" }, "array-element", null, null, fields => fields
    .finish(() => ({ kind: "array-element" })));
  const work_ComponentSelector_tuple_element: TirRecordCodec<ComponentSelector & { readonly kind: "tuple-element" }> = defineRecord<ComponentSelector & { readonly kind: "tuple-element" }>("ComponentSelector#tuple-element", "ComponentSelector", { field: "kind", value: "tuple-element" }, "tuple-element", null, null, fields => fields
    .field("index", "number", value => scalarWork("number", value.index), numberReader)
    .finish((field_index) => ({ kind: "tuple-element", index: field_index })));
  const work_ComponentSelector_union_member: TirRecordCodec<ComponentSelector & { readonly kind: "union-member" | "argument-place" | "parameter-place" }> = defineRecord<ComponentSelector & { readonly kind: "union-member" | "argument-place" | "parameter-place" }>("ComponentSelector#union-member", "ComponentSelector", { field: "kind", value: "union-member" }, "union-member", null, null, fields => fields
    .field("index", "number", value => scalarWork("number", value.index), numberReader)
    .finish((field_index) => ({ kind: "union-member", index: field_index })));
  const work_ComponentSelector_argument_place: TirRecordCodec<ComponentSelector & { readonly kind: "union-member" | "argument-place" | "parameter-place" }> = defineRecord<ComponentSelector & { readonly kind: "union-member" | "argument-place" | "parameter-place" }>("ComponentSelector#argument-place", "ComponentSelector", { field: "kind", value: "argument-place" }, "argument-place", null, null, fields => fields
    .field("index", "number", value => scalarWork("number", value.index), numberReader)
    .finish((field_index) => ({ kind: "argument-place", index: field_index })));
  const work_ComponentSelector_parameter_place: TirRecordCodec<ComponentSelector & { readonly kind: "union-member" | "argument-place" | "parameter-place" }> = defineRecord<ComponentSelector & { readonly kind: "union-member" | "argument-place" | "parameter-place" }>("ComponentSelector#parameter-place", "ComponentSelector", { field: "kind", value: "parameter-place" }, "parameter-place", null, null, fields => fields
    .field("index", "number", value => scalarWork("number", value.index), numberReader)
    .finish((field_index) => ({ kind: "parameter-place", index: field_index })));
  const work_ComponentSelector_intersection_member: TirRecordCodec<ComponentSelector & { readonly kind: "intersection-member" }> = defineRecord<ComponentSelector & { readonly kind: "intersection-member" }>("ComponentSelector#intersection-member", "ComponentSelector", { field: "kind", value: "intersection-member" }, "intersection-member", null, null, fields => fields
    .field("index", "number", value => scalarWork("number", value.index), numberReader)
    .finish((field_index) => ({ kind: "intersection-member", index: field_index })));
  const work_ComponentSelector_intersection_result: TirRecordCodec<ComponentSelector & { readonly kind: "intersection-result" }> = defineRecord<ComponentSelector & { readonly kind: "intersection-result" }>("ComponentSelector#intersection-result", "ComponentSelector", { field: "kind", value: "intersection-result" }, "intersection-result", null, null, fields => fields
    .finish(() => ({ kind: "intersection-result" })));
  const work_ComponentSelector_argument_tail: TirRecordCodec<ComponentSelector & { readonly kind: "argument-tail" | "parameter-tail" }> = defineRecord<ComponentSelector & { readonly kind: "argument-tail" | "parameter-tail" }>("ComponentSelector#argument-tail", "ComponentSelector", { field: "kind", value: "argument-tail" }, "argument-tail", null, null, fields => fields
    .field("start", "number", value => scalarWork("number", value.start), numberReader)
    .finish((field_start) => ({ kind: "argument-tail", start: field_start })));
  const work_ComponentSelector_parameter_tail: TirRecordCodec<ComponentSelector & { readonly kind: "argument-tail" | "parameter-tail" }> = defineRecord<ComponentSelector & { readonly kind: "argument-tail" | "parameter-tail" }>("ComponentSelector#parameter-tail", "ComponentSelector", { field: "kind", value: "parameter-tail" }, "parameter-tail", null, null, fields => fields
    .field("start", "number", value => scalarWork("number", value.start), numberReader)
    .finish((field_start) => ({ kind: "parameter-tail", start: field_start })));
  const work_ComponentSelector_member: TirRecordCodec<ComponentSelector & { readonly kind: "member" }> = defineRecord<ComponentSelector & { readonly kind: "member" }>("ComponentSelector#member", "ComponentSelector", { field: "kind", value: "member" }, "member", null, null, fields => fields
    .field("origin", "MemberOrigin", value => work_MemberOrigin(value.origin), lazyReader(() => work_MemberOrigin.reader))
    .finish((field_origin) => ({ kind: "member", origin: field_origin })));
  const work_ComponentSelector_index_key: TirRecordCodec<ComponentSelector & { readonly kind: "index-key" | "index-value" }> = defineRecord<ComponentSelector & { readonly kind: "index-key" | "index-value" }>("ComponentSelector#index-key", "ComponentSelector", { field: "kind", value: "index-key" }, "index-key", null, null, fields => fields
    .field("declaration", "def", value => referenceWork("def", value.declaration), definitionReader)
    .finish((field_declaration) => ({ kind: "index-key", declaration: field_declaration })));
  const work_ComponentSelector_index_value: TirRecordCodec<ComponentSelector & { readonly kind: "index-key" | "index-value" }> = defineRecord<ComponentSelector & { readonly kind: "index-key" | "index-value" }>("ComponentSelector#index-value", "ComponentSelector", { field: "kind", value: "index-value" }, "index-value", null, null, fields => fields
    .field("declaration", "def", value => referenceWork("def", value.declaration), definitionReader)
    .finish((field_declaration) => ({ kind: "index-value", declaration: field_declaration })));
  const work_ComponentSelector_projection_source: TirRecordCodec<ComponentSelector & { readonly kind: "projection-source" }> = defineRecord<ComponentSelector & { readonly kind: "projection-source" }>("ComponentSelector#projection-source", "ComponentSelector", { field: "kind", value: "projection-source" }, "projection-source", null, null, fields => fields
    .finish(() => ({ kind: "projection-source" })));
  const work_ComponentSelector_parameter: TirRecordCodec<ComponentSelector & { readonly kind: "parameter" }> = defineRecord<ComponentSelector & { readonly kind: "parameter" }>("ComponentSelector#parameter", "ComponentSelector", { field: "kind", value: "parameter" }, "parameter", null, null, fields => fields
    .field("signature", "sig", value => referenceWork("sig", value.signature), signatureReader)
    .field("index", "number", value => scalarWork("number", value.index), numberReader)
    .finish((field_signature, field_index) => ({ kind: "parameter", signature: field_signature, index: field_index })));
  const work_ComponentSelector_receiver: TirRecordCodec<ComponentSelector & { readonly kind: "receiver" }> = defineRecord<ComponentSelector & { readonly kind: "receiver" }>("ComponentSelector#receiver", "ComponentSelector", { field: "kind", value: "receiver" }, "receiver", null, null, fields => fields
    .field("signature", "sig", value => referenceWork("sig", value.signature), signatureReader)
    .finish((field_signature) => ({ kind: "receiver", signature: field_signature })));
  const work_ComponentSelector_signature_tail: TirRecordCodec<ComponentSelector & { readonly kind: "signature-tail" }> = defineRecord<ComponentSelector & { readonly kind: "signature-tail" }>("ComponentSelector#signature-tail", "ComponentSelector", { field: "kind", value: "signature-tail" }, "signature-tail", null, null, fields => fields
    .field("signature", "sig", value => referenceWork("sig", value.signature), signatureReader)
    .field("start", "number", value => scalarWork("number", value.start), numberReader)
    .field("readonly", "boolean", value => scalarWork("boolean", value.readonly), booleanReader)
    .finish((field_signature, field_start, field_readonly) => ({ kind: "signature-tail", signature: field_signature, start: field_start, readonly: field_readonly })));
  const work_ComponentSelector_tuple_slice: TirRecordCodec<ComponentSelector & { readonly kind: "tuple-slice" }> = defineRecord<ComponentSelector & { readonly kind: "tuple-slice" }>("ComponentSelector#tuple-slice", "ComponentSelector", { field: "kind", value: "tuple-slice" }, "tuple-slice", null, null, fields => fields
    .field("start", "number", value => scalarWork("number", value.start), numberReader)
    .field("endCount", "number", value => scalarWork("number", value.endCount), numberReader)
    .field("readonly", "boolean", value => scalarWork("boolean", value.readonly), booleanReader)
    .finish((field_start, field_endCount, field_readonly) => ({ kind: "tuple-slice", start: field_start, endCount: field_endCount, readonly: field_readonly })));
  const work_ComponentSelector_result: TirRecordCodec<ComponentSelector & { readonly kind: "result" }> = defineRecord<ComponentSelector & { readonly kind: "result" }>("ComponentSelector#result", "ComponentSelector", { field: "kind", value: "result" }, "result", null, null, fields => fields
    .field("signature", "sig", value => referenceWork("sig", value.signature), signatureReader)
    .finish((field_signature) => ({ kind: "result", signature: field_signature })));
  const work_ComponentSelector_type_argument: TirRecordCodec<ComponentSelector & { readonly kind: "type-argument" }> = defineRecord<ComponentSelector & { readonly kind: "type-argument" }>("ComponentSelector#type-argument", "ComponentSelector", { field: "kind", value: "type-argument" }, "type-argument", null, null, fields => fields
    .field("declaration", "def", value => referenceWork("def", value.declaration), definitionReader)
    .field("index", "number", value => scalarWork("number", value.index), numberReader)
    .finish((field_declaration, field_index) => ({ kind: "type-argument", declaration: field_declaration, index: field_index })));
  const work_ComponentSelector_sum_arm: TirRecordCodec<ComponentSelector & { readonly kind: "sum-arm" }> = defineRecord<ComponentSelector & { readonly kind: "sum-arm" }>("ComponentSelector#sum-arm", "ComponentSelector", { field: "kind", value: "sum-arm" }, "sum-arm", null, null, fields => fields
    .field("family", "SumFamily", value => work_SumFamily(value.family), lazyReader(() => work_SumFamily.reader))
    .field("index", "number", value => scalarWork("number", value.index), numberReader)
    .finish((field_family, field_index) => ({ kind: "sum-arm", family: field_family, index: field_index })));
  const work_ComponentSelector_awaited: TirRecordCodec<ComponentSelector & { readonly kind: "awaited" }> = defineRecord<ComponentSelector & { readonly kind: "awaited" }>("ComponentSelector#awaited", "ComponentSelector", { field: "kind", value: "awaited" }, "awaited", null, null, fields => fields
    .finish(() => ({ kind: "awaited" })));
  const work_ConstructionDefinition: TirRecordCodec<ConstructionDefinition> = defineRecord<ConstructionDefinition>("ConstructionDefinition", "ConstructionDefinition", null, "ConstructionDefinition", null, null, fields => fields
    .field("occurrence", "NodeRef", value => work_NodeRef(value.occurrence), lazyReader(() => work_NodeRef.reader))
    .field("captures", "[LocalRef]", value => sequenceWork("[LocalRef]", value.captures, actual => work_LocalRef(actual)), sequenceReader("[LocalRef]", lazyReader(() => work_LocalRef.reader)))
    .finish((field_occurrence, field_captures) => ({ occurrence: field_occurrence, captures: field_captures })));
  const work_SumFamily: TirRecordCodec<SumFamily> = defineRecord<SumFamily>("SumFamily", "SumFamily", null, "SumFamily", null, null, fields => fields
    .field("origin", "SumOrigin", value => scalarWork("SumOrigin", value.origin), literalReader<(SumFamily)["origin"]>("SumOrigin", ["authored","inferred"]))
    .field("component", "TypeComponent", value => work_TypeComponent(value.component), lazyReader(() => work_TypeComponent.reader))
    .field("parameters", "[TypeParameterIdentity]", value => sequenceWork("[TypeParameterIdentity]", value.parameters, actual => work_TypeParameterIdentity(actual)), sequenceReader("[TypeParameterIdentity]", lazyReader(() => work_TypeParameterIdentity.reader)))
    .field("roles", "[SumArmRole]", value => sequenceWork("[SumArmRole]", value.roles, actual => work_SumArmRole(actual)), sequenceReader("[SumArmRole]", lazyReader(() => work_SumArmRole.reader)))
    .finish((field_origin, field_component, field_parameters, field_roles) => ({ origin: field_origin, component: field_component, parameters: field_parameters, roles: field_roles })));
  const work_SumArmRole: TirRecordCodec<SumArmRole> = defineRecord<SumArmRole>("SumArmRole", "SumArmRole", null, "SumArmRole", null, null, fields => fields
    .field("authoredIndex", "number", value => scalarWork("number", value.authoredIndex), numberReader)
    .field("component", "SourceNodeRef", value => work_SourceNodeRef(value.component), lazyReader(() => work_SourceNodeRef.reader))
    .field("member", "t", value => referenceWork("t", value.member), typeReader)
    .finish((field_authoredIndex, field_component, field_member) => ({ authoredIndex: field_authoredIndex, component: field_component, member: field_member })));
  const work_TypeEvidence: TirRecordCodec<TypeEvidence> = defineRecord<TypeEvidence>("TypeEvidence", "TypeEvidence", null, "TypeEvidence", null, value => ({ kind: "evidence", value }), fields => fields
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("component", "SourceNodeRef", value => work_SourceNodeRef(value.component), lazyReader(() => work_SourceNodeRef.reader))
    .field("category", "CategoryEvidence", value => work_CategoryEvidence(value.category), lazyReader(() => work_CategoryEvidence.reader))
    .field("numeric", "?NumericEvidence", value => nullableWork(value.numeric, actual => work_NumericEvidence(actual)), nullableReader(lazyReader(() => work_NumericEvidence.reader)))
    .field("sum", "?SumEvidence", value => nullableWork(value.sum, actual => work_SumEvidence(actual)), nullableReader(lazyReader(() => work_SumEvidence.reader)))
    .field("nominal", "?def", value => nullableWork(value.nominal, actual => referenceWork("def", actual)), nullableReader(definitionReader))
    .field("pointer", "?PointerEvidence", value => nullableWork(value.pointer, actual => work_PointerEvidence(actual)), nullableReader(lazyReader(() => work_PointerEvidence.reader)))
    .finish((field_type, field_component, field_category, field_numeric, field_sum, field_nominal, field_pointer) => ({
      type: field_type, component: field_component, category: field_category, numeric: field_numeric, sum: field_sum,
      nominal: field_nominal, pointer: field_pointer,
    })));
  const work_CategoryEvidence_known: TirRecordCodec<CategoryEvidence & { readonly kind: "known" }> = defineRecord<CategoryEvidence & { readonly kind: "known" }>("CategoryEvidence#known", "CategoryEvidence", { field: "kind", value: "known" }, "known", null, null, fields => fields
    .field("category", "SourceCategory", value => scalarWork("SourceCategory", value.category), literalReader<(CategoryEvidence & { readonly kind: "known" })["category"]>("SourceCategory", ["number","bigint","boolean","string","symbol","absence","object","callable"]))
    .finish((field_category) => ({ kind: "known", category: field_category })));
  const work_CategoryEvidence_parameter: TirRecordCodec<CategoryEvidence & { readonly kind: "parameter" }> = defineRecord<CategoryEvidence & { readonly kind: "parameter" }>("CategoryEvidence#parameter", "CategoryEvidence", { field: "kind", value: "parameter" }, "parameter", null, null, fields => fields
    .field("declaration", "def", value => referenceWork("def", value.declaration), definitionReader)
    .finish((field_declaration) => ({ kind: "parameter", declaration: field_declaration })));
  const work_CategoryEvidence_choice: TirRecordCodec<CategoryEvidence & { readonly kind: "choice" }> = defineRecord<CategoryEvidence & { readonly kind: "choice" }>("CategoryEvidence#choice", "CategoryEvidence", { field: "kind", value: "choice" }, "choice", null, null, fields => fields
    .field("alternatives", "[CategoryEvidence]", value => sequenceWork("[CategoryEvidence]", value.alternatives, actual => work_CategoryEvidence(actual)), sequenceReader("[CategoryEvidence]", lazyReader(() => work_CategoryEvidence.reader)))
    .finish((field_alternatives) => ({ kind: "choice", alternatives: field_alternatives })));
  const work_CategoryEvidence_dynamic: TirRecordCodec<CategoryEvidence & { readonly kind: "dynamic" }> = defineRecord<CategoryEvidence & { readonly kind: "dynamic" }>("CategoryEvidence#dynamic", "CategoryEvidence", { field: "kind", value: "dynamic" }, "dynamic", null, null, fields => fields
    .finish(() => ({ kind: "dynamic" })));
  const work_NumericEvidence: TirRecordCodec<NumericEvidence> = defineRecord<NumericEvidence>("NumericEvidence", "NumericEvidence", null, "NumericEvidence", null, null, fields => fields
    .field("producer", "NodeRef", value => work_NodeRef(value.producer), lazyReader(() => work_NodeRef.reader))
    .field("kind", "NumericEvidenceKind", value => scalarWork("NumericEvidenceKind", value.kind), literalReader<(NumericEvidence)["kind"]>("NumericEvidenceKind", ["literal","declared","operation","application"]))
    .field("category", "CategoryEvidence", value => work_CategoryEvidence(value.category), lazyReader(() => work_CategoryEvidence.reader))
    .field("authored", "?LiteralValue", value => nullableWork(value.authored, actual => work_LiteralValue(actual)), nullableReader(lazyReader(() => work_LiteralValue.reader)))
    .finish((field_producer, field_kind, field_category, field_authored) => ({ producer: field_producer, kind: field_kind, category: field_category, authored: field_authored })));
  const work_SumEvidence: TirRecordCodec<SumEvidence> = defineRecord<SumEvidence>("SumEvidence", "SumEvidence", null, "SumEvidence", null, null, fields => fields
    .field("kind", "SumOrigin", value => scalarWork("SumOrigin", value.kind), literalReader<(SumEvidence)["kind"]>("SumOrigin", ["authored","inferred"]))
    .field("component", "SourceNodeRef", value => work_SourceNodeRef(value.component), lazyReader(() => work_SourceNodeRef.reader))
    .field("bindings", "BindingVector", value => work_BindingVector(value.bindings), lazyReader(() => work_BindingVector.reader))
    .field("arms", "[SumArmRole]", value => sequenceWork("[SumArmRole]", value.arms, actual => work_SumArmRole(actual)), sequenceReader("[SumArmRole]", lazyReader(() => work_SumArmRole.reader)))
    .finish((field_kind, field_component, field_bindings, field_arms) => ({ kind: field_kind, component: field_component, bindings: field_bindings, arms: field_arms })));
  const work_PointerEvidence_raw_address: TirRecordCodec<PointerEvidence & { readonly kind: "raw-address" }> = defineRecord<PointerEvidence & { readonly kind: "raw-address" }>("PointerEvidence#raw-address", "PointerEvidence", { field: "kind", value: "raw-address" }, "raw-address", null, null, fields => fields
    .finish(() => ({ kind: "raw-address" })));
  const work_PointerEvidence_typed_location: TirRecordCodec<PointerEvidence & { readonly kind: "typed-location" }> = defineRecord<PointerEvidence & { readonly kind: "typed-location" }>("PointerEvidence#typed-location", "PointerEvidence", { field: "kind", value: "typed-location" }, "typed-location", null, null, fields => fields
    .field("pointee", "t", value => referenceWork("t", value.pointee), typeReader)
    .field("mutability", "Mutability", value => scalarWork("Mutability", value.mutability), literalReader<(PointerEvidence & { readonly kind: "typed-location" })["mutability"]>("Mutability", ["readonly","readwrite","unspecified"]))
    .finish((field_pointee, field_mutability) => ({ kind: "typed-location", pointee: field_pointee, mutability: field_mutability })));
  const work_PointerEvidence_native_pointer: TirRecordCodec<PointerEvidence & { readonly kind: "native-pointer" }> = defineRecord<PointerEvidence & { readonly kind: "native-pointer" }>("PointerEvidence#native-pointer", "PointerEvidence", { field: "kind", value: "native-pointer" }, "native-pointer", null, null, fields => fields
    .field("declaration", "def", value => referenceWork("def", value.declaration), definitionReader)
    .finish((field_declaration) => ({ kind: "native-pointer", declaration: field_declaration })));
  const work_PointerEvidence_function_pointer: TirRecordCodec<PointerEvidence & { readonly kind: "function-pointer" }> = defineRecord<PointerEvidence & { readonly kind: "function-pointer" }>("PointerEvidence#function-pointer", "PointerEvidence", { field: "kind", value: "function-pointer" }, "function-pointer", null, null, fields => fields
    .field("declaration", "def", value => referenceWork("def", value.declaration), definitionReader)
    .field("parameters", "[t]", value => sequenceWork("[t]", value.parameters, actual => referenceWork("t", actual)), sequenceReader("[t]", typeReader))
    .field("result", "t", value => referenceWork("t", value.result), typeReader)
    .field("abi", "[string]", value => sequenceWork("[string]", value.abi, actual => scalarWork("string", actual)), sequenceReader("[string]", stringReader))
    .finish((field_declaration, field_parameters, field_result, field_abi) => ({ kind: "function-pointer", declaration: field_declaration, parameters: field_parameters, result: field_result, abi: field_abi })));
  const work_LiteralValue_number: TirRecordCodec<LiteralValue & { readonly kind: "number" }> = defineRecord<LiteralValue & { readonly kind: "number" }>("LiteralValue#number", "LiteralValue", { field: "kind", value: "number" }, "number", null, null, fields => fields
    .field("token", "string", value => scalarWork("string", value.token), stringReader)
    .field("value", "ExactRational", value => work_ExactRational(value.value), lazyReader(() => work_ExactRational.reader))
    .finish((field_token, field_value) => ({ kind: "number", token: field_token, value: field_value })));
  const work_LiteralValue_bigint: TirRecordCodec<LiteralValue & { readonly kind: "bigint" }> = defineRecord<LiteralValue & { readonly kind: "bigint" }>("LiteralValue#bigint", "LiteralValue", { field: "kind", value: "bigint" }, "bigint", null, null, fields => fields
    .field("token", "string", value => scalarWork("string", value.token), stringReader)
    .field("value", "bigint", value => scalarWork("bigint", value.value), bigintReader)
    .finish((field_token, field_value) => ({ kind: "bigint", token: field_token, value: field_value })));
  const work_LiteralValue_string: TirRecordCodec<LiteralValue & { readonly kind: "string" }> = defineRecord<LiteralValue & { readonly kind: "string" }>("LiteralValue#string", "LiteralValue", { field: "kind", value: "string" }, "string", null, null, fields => fields
    .field("value", "string", value => scalarWork("string", value.value), stringReader)
    .finish((field_value) => ({ kind: "string", value: field_value })));
  const work_LiteralValue_boolean: TirRecordCodec<LiteralValue & { readonly kind: "boolean" }> = defineRecord<LiteralValue & { readonly kind: "boolean" }>("LiteralValue#boolean", "LiteralValue", { field: "kind", value: "boolean" }, "boolean", null, null, fields => fields
    .field("value", "boolean", value => scalarWork("boolean", value.value), booleanReader)
    .finish((field_value) => ({ kind: "boolean", value: field_value })));
  const work_LiteralValue_absence: TirRecordCodec<LiteralValue & { readonly kind: "absence" }> = defineRecord<LiteralValue & { readonly kind: "absence" }>("LiteralValue#absence", "LiteralValue", { field: "kind", value: "absence" }, "absence", null, null, fields => fields
    .finish(() => ({ kind: "absence" })));
  const work_LiteralValue_unique_symbol: TirRecordCodec<LiteralValue & { readonly kind: "unique-symbol" }> = defineRecord<LiteralValue & { readonly kind: "unique-symbol" }>("LiteralValue#unique-symbol", "LiteralValue", { field: "kind", value: "unique-symbol" }, "unique-symbol", null, null, fields => fields
    .field("declaration", "def", value => referenceWork("def", value.declaration), definitionReader)
    .finish((field_declaration) => ({ kind: "unique-symbol", declaration: field_declaration })));
  const work_Diagnostic: TirRecordCodec<Diagnostic> = defineRecord<Diagnostic>("Diagnostic", "Diagnostic", null, "Diagnostic", null, null, fields => fields
    .field("code", "DiagnosticCode", value => work_DiagnosticCode(value.code), lazyReader(() => work_DiagnosticCode.reader))
    .field("severity", "Severity", value => scalarWork("Severity", value.severity), literalReader<(Diagnostic)["severity"]>("Severity", ["error","warning","suggestion"]))
    .field("site", "DiagnosticSite", value => work_DiagnosticSite(value.site), lazyReader(() => work_DiagnosticSite.reader))
    .field("source", "?string", value => nullableWork(value.source, actual => scalarWork("string", actual)), nullableReader(stringReader))
    .field("evidence", "[string]", value => sequenceWork("[string]", value.evidence, actual => scalarWork("string", actual)), sequenceReader("[string]", stringReader))
    .field("message", "string", value => scalarWork("string", value.message), stringReader)
    .field("arguments", "[MessageArgument]", value => sequenceWork("[MessageArgument]", value.arguments, actual => work_MessageArgument(actual)), sequenceReader("[MessageArgument]", lazyReader(() => work_MessageArgument.reader)))
    .field("related", "[RelatedDiagnostic]", value => sequenceWork("[RelatedDiagnostic]", value.related, actual => work_RelatedDiagnostic(actual)), sequenceReader("[RelatedDiagnostic]", lazyReader(() => work_RelatedDiagnostic.reader)))
    .field("fix", "?DiagnosticFix", value => nullableWork(value.fix, actual => work_DiagnosticFix(actual)), nullableReader(lazyReader(() => work_DiagnosticFix.reader)))
    .finish((field_code, field_severity, field_site, field_source, field_evidence, field_message, field_arguments, field_related, field_fix) => ({
      code: field_code, severity: field_severity, site: field_site, source: field_source, evidence: field_evidence,
      message: field_message, arguments: field_arguments, related: field_related, fix: field_fix,
    })));
  const work_DiagnosticCode_host: TirRecordCodec<DiagnosticCode & { readonly kind: "host" }> = defineRecord<DiagnosticCode & { readonly kind: "host" }>("DiagnosticCode#host", "DiagnosticCode", { field: "kind", value: "host" }, "host", null, null, fields => fields
    .field("name", "HostDiagnosticCode", value => scalarWork("HostDiagnosticCode", value.name), diagnosticCodeReader)
    .field("rendered", "string", value => scalarWork("string", value.rendered), stringReader)
    .finish((field_name, field_rendered) => ({ kind: "host", name: field_name, rendered: field_rendered })));
  const work_DiagnosticCode_checker: TirRecordCodec<DiagnosticCode & { readonly kind: "checker" }> = defineRecord<DiagnosticCode & { readonly kind: "checker" }>("DiagnosticCode#checker", "DiagnosticCode", { field: "kind", value: "checker" }, "checker", null, null, fields => fields
    .field("number", "number", value => scalarWork("number", value.number), numberReader)
    .field("rendered", "string", value => scalarWork("string", value.rendered), stringReader)
    .finish((field_number, field_rendered) => ({ kind: "checker", number: field_number, rendered: field_rendered })));
  const work_DiagnosticCode_extension: TirRecordCodec<DiagnosticCode & { readonly kind: "extension" }> = defineRecord<DiagnosticCode & { readonly kind: "extension" }>("DiagnosticCode#extension", "DiagnosticCode", { field: "kind", value: "extension" }, "extension", null, null, fields => fields
    .field("number", "number", value => scalarWork("number", value.number), numberReader)
    .field("extensionCode", "string", value => scalarWork("string", value.extensionCode), stringReader)
    .field("rendered", "string", value => scalarWork("string", value.rendered), stringReader)
    .finish((field_number, field_extensionCode, field_rendered) => ({ kind: "extension", number: field_number, extensionCode: field_extensionCode, rendered: field_rendered })));
  const work_DiagnosticSite_source: TirRecordCodec<DiagnosticSite & { readonly kind: "source" }> = defineRecord<DiagnosticSite & { readonly kind: "source" }>("DiagnosticSite#source", "DiagnosticSite", { field: "kind", value: "source" }, "source", null, null, fields => fields
    .field("origin", "Origin", value => work_Origin(value.origin), lazyReader(() => work_Origin.reader))
    .finish((field_origin) => ({ kind: "source", origin: field_origin })));
  const work_DiagnosticSite_file: TirRecordCodec<DiagnosticSite & { readonly kind: "file" }> = defineRecord<DiagnosticSite & { readonly kind: "file" }>("DiagnosticSite#file", "DiagnosticSite", { field: "kind", value: "file" }, "file", null, null, fields => fields
    .field("path", "string", value => scalarWork("string", value.path), stringReader)
    .finish((field_path) => ({ kind: "file", path: field_path })));
  const work_DiagnosticSite_none: TirRecordCodec<DiagnosticSite & { readonly kind: "none" }> = defineRecord<DiagnosticSite & { readonly kind: "none" }>("DiagnosticSite#none", "DiagnosticSite", { field: "kind", value: "none" }, "none", null, null, fields => fields
    .finish(() => ({ kind: "none" })));
  const work_MessageArgument_text: TirRecordCodec<MessageArgument & { readonly kind: "text" }> = defineRecord<MessageArgument & { readonly kind: "text" }>("MessageArgument#text", "MessageArgument", { field: "kind", value: "text" }, "text", null, null, fields => fields
    .field("value", "string", value => scalarWork("string", value.value), stringReader)
    .finish((field_value) => ({ kind: "text", value: field_value })));
  const work_MessageArgument_integer: TirRecordCodec<MessageArgument & { readonly kind: "integer" }> = defineRecord<MessageArgument & { readonly kind: "integer" }>("MessageArgument#integer", "MessageArgument", { field: "kind", value: "integer" }, "integer", null, null, fields => fields
    .field("value", "bigint", value => scalarWork("bigint", value.value), bigintReader)
    .finish((field_value) => ({ kind: "integer", value: field_value })));
  const work_MessageArgument_number: TirRecordCodec<MessageArgument & { readonly kind: "number" }> = defineRecord<MessageArgument & { readonly kind: "number" }>("MessageArgument#number", "MessageArgument", { field: "kind", value: "number" }, "number", null, null, fields => fields
    .field("value", "number", value => scalarWork("number", value.value), numberReader)
    .finish((field_value) => ({ kind: "number", value: field_value })));
  const work_MessageArgument_origin: TirRecordCodec<MessageArgument & { readonly kind: "origin" }> = defineRecord<MessageArgument & { readonly kind: "origin" }>("MessageArgument#origin", "MessageArgument", { field: "kind", value: "origin" }, "origin", null, null, fields => fields
    .field("value", "Origin", value => work_Origin(value.value), lazyReader(() => work_Origin.reader))
    .finish((field_value) => ({ kind: "origin", value: field_value })));
  const work_RelatedDiagnostic: TirRecordCodec<RelatedDiagnostic> = defineRecord<RelatedDiagnostic>("RelatedDiagnostic", "RelatedDiagnostic", null, "RelatedDiagnostic", null, null, fields => fields
    .field("site", "DiagnosticSite", value => work_DiagnosticSite(value.site), lazyReader(() => work_DiagnosticSite.reader))
    .field("code", "DiagnosticCode", value => work_DiagnosticCode(value.code), lazyReader(() => work_DiagnosticCode.reader))
    .field("message", "string", value => scalarWork("string", value.message), stringReader)
    .finish((field_site, field_code, field_message) => ({ site: field_site, code: field_code, message: field_message })));
  const work_DiagnosticFix: TirRecordCodec<DiagnosticFix> = defineRecord<DiagnosticFix>("DiagnosticFix", "DiagnosticFix", null, "DiagnosticFix", null, null, fields => fields
    .field("description", "string", value => scalarWork("string", value.description), stringReader)
    .field("edits", "[TextEdit]", value => sequenceWork("[TextEdit]", value.edits, actual => work_TextEdit(actual)), sequenceReader("[TextEdit]", lazyReader(() => work_TextEdit.reader)))
    .finish((field_description, field_edits) => ({ description: field_description, edits: field_edits })));
  const work_TextEdit: TirRecordCodec<TextEdit> = defineRecord<TextEdit>("TextEdit", "TextEdit", null, "TextEdit", null, null, fields => fields
    .field("origin", "Origin", value => work_Origin(value.origin), lazyReader(() => work_Origin.reader))
    .field("replacement", "string", value => scalarWork("string", value.replacement), stringReader)
    .finish((field_origin, field_replacement) => ({ origin: field_origin, replacement: field_replacement })));
  const work_ModifierList: TirRecordCodec<ModifierList<TypedPhase>> = defineRecord<ModifierList<TypedPhase>>("ModifierList", "ModifierList", null, "ModifierList", null, null, fields => fields
    .field("loc", "TextRange", value => work_TextRange(value.loc), lazyReader(() => work_TextRange.reader))
    .field("nodes", "[$ModifierLike]", value => sequenceWork("[$ModifierLike]", value.nodes, actual => syntaxReference("$ModifierLike", actual)), sequenceReader("[$ModifierLike]", syntaxReads.ModifierLike))
    .finish((field_loc, field_nodes) => ({ loc: field_loc, nodes: field_nodes })));
  const work_TextRange: TirRecordCodec<TextRange> = defineRecord<TextRange>("TextRange", "TextRange", null, "TextRange", null, null, fields => fields
    .field("pos", "number", value => scalarWork("number", value.pos), numberReader)
    .field("end", "number", value => scalarWork("number", value.end), numberReader)
    .finish((field_pos, field_end) => ({ pos: field_pos, end: field_end })));
  const work_CommentDirective: TirRecordCodec<CommentDirective> = defineRecord<CommentDirective>("CommentDirective", "CommentDirective", null, "CommentDirective", null, null, fields => fields
    .field("loc", "TextRange", value => work_TextRange(value.loc), lazyReader(() => work_TextRange.reader))
    .field("kind", "CommentDirectiveKind", value => scalarWork("CommentDirectiveKind", value.kind), literalReader<(CommentDirective)["kind"]>("CommentDirectiveKind", ["Unknown","ExpectError","Ignore"]))
    .finish((field_loc, field_kind) => ({ loc: field_loc, kind: field_kind })));
  const work_CommentRange: TirRecordCodec<CommentRange> = defineRecord<CommentRange>("CommentRange", "CommentRange", null, "CommentRange", null, null, fields => fields
    .field("pos", "number", value => scalarWork("number", value.pos), numberReader)
    .field("end", "number", value => scalarWork("number", value.end), numberReader)
    .field("kind", "CommentKind", value => scalarWork("CommentKind", value.kind), literalReader<(CommentRange)["kind"]>("CommentKind", ["SingleLineCommentTrivia","MultiLineCommentTrivia"]))
    .field("hasTrailingNewLine", "boolean", value => scalarWork("boolean", value.hasTrailingNewLine), booleanReader)
    .finish((field_pos, field_end, field_kind, field_hasTrailingNewLine) => ({ pos: field_pos, end: field_end, kind: field_kind, hasTrailingNewLine: field_hasTrailingNewLine })));
  const work_PragmaArgument: TirRecordCodec<PragmaArgument> = defineRecord<PragmaArgument>("PragmaArgument", "PragmaArgument", null, "PragmaArgument", null, null, fields => fields
    .field("pos", "number", value => scalarWork("number", value.pos), numberReader)
    .field("end", "number", value => scalarWork("number", value.end), numberReader)
    .field("name", "string", value => scalarWork("string", value.name), stringReader)
    .field("value", "string", value => scalarWork("string", value.value), stringReader)
    .finish((field_pos, field_end, field_name, field_value) => ({ pos: field_pos, end: field_end, name: field_name, value: field_value })));
  const work_Pragma: TirRecordCodec<Pragma> = defineRecord<Pragma>("Pragma", "Pragma", null, "Pragma", null, null, fields => fields
    .field("pos", "number", value => scalarWork("number", value.pos), numberReader)
    .field("end", "number", value => scalarWork("number", value.end), numberReader)
    .field("kind", "CommentKind", value => scalarWork("CommentKind", value.kind), literalReader<(Pragma)["kind"]>("CommentKind", ["SingleLineCommentTrivia","MultiLineCommentTrivia"]))
    .field("hasTrailingNewLine", "boolean", value => scalarWork("boolean", value.hasTrailingNewLine), booleanReader)
    .field("name", "string", value => scalarWork("string", value.name), stringReader)
    .field("args", "PragmaArguments", value => work_PragmaArguments(value.args), lazyReader(() => work_PragmaArguments.reader))
    .finish((field_pos, field_end, field_kind, field_hasTrailingNewLine, field_name, field_args) => ({
      pos: field_pos, end: field_end, kind: field_kind, hasTrailingNewLine: field_hasTrailingNewLine, name: field_name,
      args: field_args,
    })));
  const work_PragmaArguments = dynamicRecord<PragmaArgument>("PragmaArguments", "PragmaArgument", value => work_PragmaArgument(value), work_PragmaArgument.reader);
  const work_CheckJsDirective: TirRecordCodec<CheckJsDirective> = defineRecord<CheckJsDirective>("CheckJsDirective", "CheckJsDirective", null, "CheckJsDirective", null, null, fields => fields
    .field("enabled", "boolean", value => scalarWork("boolean", value.enabled), booleanReader)
    .field("range", "CommentRange", value => work_CommentRange(value.range), lazyReader(() => work_CommentRange.reader))
    .finish((field_enabled, field_range) => ({ enabled: field_enabled, range: field_range })));
  const work_DeclarationTarget: TirRecordCodec<DeclarationTarget> = unionRecord<DeclarationTarget>("DeclarationTarget", (value: DeclarationTarget): TirTypedRecordWork => {
    switch (value.kind) {
      case "local": return work_DeclarationTarget_local(value);
      case "definition": return work_DeclarationTarget_definition(value);
    }
  }, () => [work_DeclarationTarget_local.reader, work_DeclarationTarget_definition.reader]);
  const work_ArtifactBindings: TirRecordCodec<ArtifactBindings> = unionRecord<ArtifactBindings>("ArtifactBindings", (value: ArtifactBindings): TirTypedRecordWork => {
    switch (value.kind) {
      case "parametric": return work_ArtifactBindings_parametric(value);
      case "instantiated": return work_ArtifactBindings_instantiated(value);
    }
  }, () => [work_ArtifactBindings_parametric.reader, work_ArtifactBindings_instantiated.reader]);
  const work_TypeBinding: TirRecordCodec<TypeBinding> = unionRecord<TypeBinding>("TypeBinding", (value: TypeBinding): TirTypedRecordWork => {
    switch (value.kind) {
      case "bound": return work_TypeBinding_bound(value);
      case "rigid": return work_TypeBinding_rigid(value);
    }
  }, () => [work_TypeBinding_bound.reader, work_TypeBinding_rigid.reader]);
  const work_SelfBinding: TirRecordCodec<SelfBinding> = unionRecord<SelfBinding>("SelfBinding", (value: SelfBinding): TirTypedRecordWork => {
    switch (value.kind) {
      case "bound": return work_SelfBinding_bound(value);
      case "rigid": return work_SelfBinding_rigid(value);
    }
  }, () => [work_SelfBinding_bound.reader, work_SelfBinding_rigid.reader]);
  const work_SourceNodeRef: TirRecordCodec<SourceNodeRef> = unionRecord<SourceNodeRef>("SourceNodeRef", (value: SourceNodeRef): TirTypedRecordWork => {
    switch (value.kind) {
      case "body": return work_SourceNodeRef_body(value);
      case "item": return work_SourceNodeRef_item(value);
    }
  }, () => [work_SourceNodeRef_body.reader, work_SourceNodeRef_item.reader]);
  const work_Derivation: TirRecordCodec<Derivation> = unionRecord<Derivation>("Derivation", (value: Derivation): TirTypedRecordWork => {
    switch (value.kind) {
      case "lowering": return work_Derivation_lowering(value);
      case "expansion": return work_Derivation_expansion(value);
    }
  }, () => [work_Derivation_lowering.reader, work_Derivation_expansion.reader]);
  const work_ImportTarget: TirRecordCodec<ImportTarget> = unionRecord<ImportTarget>("ImportTarget", (value: ImportTarget): TirTypedRecordWork => {
    switch (value.target) {
      case "project": return work_ImportTarget_target_project(value);
      case "library": return work_ImportTarget_target_library(value);
    }
  }, () => [work_ImportTarget_target_project.reader, work_ImportTarget_target_library.reader]);
  const work_MemberKey: TirRecordCodec<MemberKey> = unionRecord<MemberKey>("MemberKey", (value: MemberKey): TirTypedRecordWork => {
    switch (value.kind) {
      case "text": return work_MemberKey_text(value);
      case "number": return work_MemberKey_number(value);
      case "symbol": return work_MemberKey_symbol(value);
    }
  }, () => [work_MemberKey_text.reader, work_MemberKey_number.reader, work_MemberKey_symbol.reader]);
  const work_MemberOrigin: TirRecordCodec<MemberOrigin> = unionRecord<MemberOrigin>("MemberOrigin", (value: MemberOrigin): TirTypedRecordWork => {
    switch (value.kind) {
      case "declared": return work_MemberOrigin_declared(value);
      case "class-prototype": return work_MemberOrigin_class_prototype(value);
      case "mapped": return work_MemberOrigin_mapped(value);
    }
  }, () => [work_MemberOrigin_declared.reader, work_MemberOrigin_class_prototype.reader, work_MemberOrigin_mapped.reader]);
  const work_ComponentSelector: TirRecordCodec<ComponentSelector> = unionRecord<ComponentSelector>("ComponentSelector", (value: ComponentSelector): TirTypedRecordWork => {
    switch (value.kind) {
      case "class-value": return work_ComponentSelector_class_value(value);
      case "construction-argument": return work_ComponentSelector_construction_argument(value);
      case "optional-value": return work_ComponentSelector_optional_value(value);
      case "array-element": return work_ComponentSelector_array_element(value);
      case "tuple-element": return work_ComponentSelector_tuple_element(value);
      case "union-member": return work_ComponentSelector_union_member(value);
      case "argument-place": return work_ComponentSelector_argument_place(value);
      case "parameter-place": return work_ComponentSelector_parameter_place(value);
      case "intersection-member": return work_ComponentSelector_intersection_member(value);
      case "intersection-result": return work_ComponentSelector_intersection_result(value);
      case "argument-tail": return work_ComponentSelector_argument_tail(value);
      case "parameter-tail": return work_ComponentSelector_parameter_tail(value);
      case "member": return work_ComponentSelector_member(value);
      case "index-key": return work_ComponentSelector_index_key(value);
      case "index-value": return work_ComponentSelector_index_value(value);
      case "projection-source": return work_ComponentSelector_projection_source(value);
      case "parameter": return work_ComponentSelector_parameter(value);
      case "receiver": return work_ComponentSelector_receiver(value);
      case "signature-tail": return work_ComponentSelector_signature_tail(value);
      case "tuple-slice": return work_ComponentSelector_tuple_slice(value);
      case "result": return work_ComponentSelector_result(value);
      case "type-argument": return work_ComponentSelector_type_argument(value);
      case "sum-arm": return work_ComponentSelector_sum_arm(value);
      case "awaited": return work_ComponentSelector_awaited(value);
    }
  }, () => [work_ComponentSelector_class_value.reader, work_ComponentSelector_construction_argument.reader, work_ComponentSelector_optional_value.reader, work_ComponentSelector_array_element.reader, work_ComponentSelector_tuple_element.reader, work_ComponentSelector_union_member.reader, work_ComponentSelector_argument_place.reader, work_ComponentSelector_parameter_place.reader, work_ComponentSelector_intersection_member.reader, work_ComponentSelector_intersection_result.reader, work_ComponentSelector_argument_tail.reader, work_ComponentSelector_parameter_tail.reader, work_ComponentSelector_member.reader, work_ComponentSelector_index_key.reader, work_ComponentSelector_index_value.reader, work_ComponentSelector_projection_source.reader, work_ComponentSelector_parameter.reader, work_ComponentSelector_receiver.reader, work_ComponentSelector_signature_tail.reader, work_ComponentSelector_tuple_slice.reader, work_ComponentSelector_result.reader, work_ComponentSelector_type_argument.reader, work_ComponentSelector_sum_arm.reader, work_ComponentSelector_awaited.reader]);
  const work_CategoryEvidence: TirRecordCodec<CategoryEvidence> = unionRecord<CategoryEvidence>("CategoryEvidence", (value: CategoryEvidence): TirTypedRecordWork => {
    switch (value.kind) {
      case "known": return work_CategoryEvidence_known(value);
      case "parameter": return work_CategoryEvidence_parameter(value);
      case "choice": return work_CategoryEvidence_choice(value);
      case "dynamic": return work_CategoryEvidence_dynamic(value);
    }
  }, () => [work_CategoryEvidence_known.reader, work_CategoryEvidence_parameter.reader, work_CategoryEvidence_choice.reader, work_CategoryEvidence_dynamic.reader]);
  const work_PointerEvidence: TirRecordCodec<PointerEvidence> = unionRecord<PointerEvidence>("PointerEvidence", (value: PointerEvidence): TirTypedRecordWork => {
    switch (value.kind) {
      case "raw-address": return work_PointerEvidence_raw_address(value);
      case "typed-location": return work_PointerEvidence_typed_location(value);
      case "native-pointer": return work_PointerEvidence_native_pointer(value);
      case "function-pointer": return work_PointerEvidence_function_pointer(value);
    }
  }, () => [work_PointerEvidence_raw_address.reader, work_PointerEvidence_typed_location.reader, work_PointerEvidence_native_pointer.reader, work_PointerEvidence_function_pointer.reader]);
  const work_LiteralValue: TirRecordCodec<LiteralValue> = unionRecord<LiteralValue>("LiteralValue", (value: LiteralValue): TirTypedRecordWork => {
    switch (value.kind) {
      case "number": return work_LiteralValue_number(value);
      case "bigint": return work_LiteralValue_bigint(value);
      case "string": return work_LiteralValue_string(value);
      case "boolean": return work_LiteralValue_boolean(value);
      case "absence": return work_LiteralValue_absence(value);
      case "unique-symbol": return work_LiteralValue_unique_symbol(value);
    }
  }, () => [work_LiteralValue_number.reader, work_LiteralValue_bigint.reader, work_LiteralValue_string.reader, work_LiteralValue_boolean.reader, work_LiteralValue_absence.reader, work_LiteralValue_unique_symbol.reader]);
  const work_DiagnosticCode: TirRecordCodec<DiagnosticCode> = unionRecord<DiagnosticCode>("DiagnosticCode", (value: DiagnosticCode): TirTypedRecordWork => {
    switch (value.kind) {
      case "host": return work_DiagnosticCode_host(value);
      case "checker": return work_DiagnosticCode_checker(value);
      case "extension": return work_DiagnosticCode_extension(value);
    }
  }, () => [work_DiagnosticCode_host.reader, work_DiagnosticCode_checker.reader, work_DiagnosticCode_extension.reader]);
  const work_DiagnosticSite: TirRecordCodec<DiagnosticSite> = unionRecord<DiagnosticSite>("DiagnosticSite", (value: DiagnosticSite): TirTypedRecordWork => {
    switch (value.kind) {
      case "source": return work_DiagnosticSite_source(value);
      case "file": return work_DiagnosticSite_file(value);
      case "none": return work_DiagnosticSite_none(value);
    }
  }, () => [work_DiagnosticSite_source.reader, work_DiagnosticSite_file.reader, work_DiagnosticSite_none.reader]);
  const work_MessageArgument: TirRecordCodec<MessageArgument> = unionRecord<MessageArgument>("MessageArgument", (value: MessageArgument): TirTypedRecordWork => {
    switch (value.kind) {
      case "text": return work_MessageArgument_text(value);
      case "integer": return work_MessageArgument_integer(value);
      case "number": return work_MessageArgument_number(value);
      case "origin": return work_MessageArgument_origin(value);
    }
  }, () => [work_MessageArgument_text.reader, work_MessageArgument_integer.reader, work_MessageArgument_number.reader, work_MessageArgument_origin.reader]);
  return { work_DeclarationTarget_local, work_DeclarationTarget_definition, work_ArtifactBindings_parametric, work_ArtifactBindings_instantiated, work_BindingVector, work_TypeBinding_bound, work_TypeBinding_rigid, work_SelfBinding_bound, work_SelfBinding_rigid, work_TypeParameterIdentity, work_TypeParameter, work_BodyInstance, work_ExactRational, work_NodeRef, work_ItemNodeRef, work_SourceNodeRef_body, work_SourceNodeRef_item, work_LocalRef, work_Origin, work_Derivation_lowering, work_Derivation_expansion, work_HirLexicalScope, work_HirAttribute, work_HirCallableEndpoint, work_ImportTarget_target_project, work_ImportTarget_target_library, work_LibraryModuleIdentity, work_MemberKey_text, work_MemberKey_number, work_MemberKey_symbol, work_MemberOrigin_declared, work_MemberOrigin_class_prototype, work_MemberOrigin_mapped, work_TypeComponent, work_ComponentSelector_class_value, work_ComponentSelector_construction_argument, work_ComponentSelector_optional_value, work_ComponentSelector_array_element, work_ComponentSelector_tuple_element, work_ComponentSelector_union_member, work_ComponentSelector_argument_place, work_ComponentSelector_parameter_place, work_ComponentSelector_intersection_member, work_ComponentSelector_intersection_result, work_ComponentSelector_argument_tail, work_ComponentSelector_parameter_tail, work_ComponentSelector_member, work_ComponentSelector_index_key, work_ComponentSelector_index_value, work_ComponentSelector_projection_source, work_ComponentSelector_parameter, work_ComponentSelector_receiver, work_ComponentSelector_signature_tail, work_ComponentSelector_tuple_slice, work_ComponentSelector_result, work_ComponentSelector_type_argument, work_ComponentSelector_sum_arm, work_ComponentSelector_awaited, work_ConstructionDefinition, work_SumFamily, work_SumArmRole, work_TypeEvidence, work_CategoryEvidence_known, work_CategoryEvidence_parameter, work_CategoryEvidence_choice, work_CategoryEvidence_dynamic, work_NumericEvidence, work_SumEvidence, work_PointerEvidence_raw_address, work_PointerEvidence_typed_location, work_PointerEvidence_native_pointer, work_PointerEvidence_function_pointer, work_LiteralValue_number, work_LiteralValue_bigint, work_LiteralValue_string, work_LiteralValue_boolean, work_LiteralValue_absence, work_LiteralValue_unique_symbol, work_Diagnostic, work_DiagnosticCode_host, work_DiagnosticCode_checker, work_DiagnosticCode_extension, work_DiagnosticSite_source, work_DiagnosticSite_file, work_DiagnosticSite_none, work_MessageArgument_text, work_MessageArgument_integer, work_MessageArgument_number, work_MessageArgument_origin, work_RelatedDiagnostic, work_DiagnosticFix, work_TextEdit, work_ModifierList, work_TextRange, work_CommentDirective, work_CommentRange, work_PragmaArgument, work_Pragma, work_PragmaArguments, work_CheckJsDirective, work_DeclarationTarget, work_ArtifactBindings, work_TypeBinding, work_SelfBinding, work_SourceNodeRef, work_Derivation, work_ImportTarget, work_MemberKey, work_MemberOrigin, work_ComponentSelector, work_CategoryEvidence, work_PointerEvidence, work_LiteralValue, work_DiagnosticCode, work_DiagnosticSite, work_MessageArgument };
};
