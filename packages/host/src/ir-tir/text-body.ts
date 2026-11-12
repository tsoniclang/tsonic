import { lazyReader, literalReader, nullableReader, sequenceReader } from "./text-construction.js";
import { unionRecord } from "./text-layouts.js";
import type { TirRecordCodec } from "./text-layouts.js";
import type {
  ConversionDecision, MemberSelection, ModuleBindingTarget, ResolvedCallee, TargetAccess, TirApplication, TirArgument, TirBody, TirDemand, TirLocal, TirParam, TirProtocol, TirProtocolStep, TirResolution, TirRestPart, TirSelection, TypedCallable, TypedClosure, TypedOperation, TypedPhase, TypedSourceFile, TypedStaticBlock
} from "./contract.js";
import type {
  ArtifactBindings, BindingVector, BodyInstance, TypeEvidence
} from "../ir-types/contract.js";
import type {
  LocalRef, Origin, SourceNodeRef
} from "../ids/contract.js";
import type {
  ArrowFunction, Block, CheckJsDirective, ClassStaticBlockDeclaration, CommentDirective, ConstructorDeclaration, FunctionDeclaration, FunctionExpression, GetAccessorDeclaration, HirLexicalScope, ImportTarget, MethodDeclaration, ModifierList, NodeList, ParameterDeclaration, Pragma, SetAccessorDeclaration, SourceFile, Statement, TextRange, TypeParameterDeclaration
} from "../ir-hir/contract.js";
import type {
  ApplicationDecision, DeferredDecision, EmbeddingDecision, MemberDecision, RefinementDecision, RuleOutcome
} from "../ir-infer/contract.js";
import type { TirTextKernel, TirTypedRecordWork } from "./text-layouts.js";
import { scalarWork, referenceWork, syntaxReference, nullableWork, sequenceWork, withBindingOwner } from "./text-layouts.js";

export interface BodyTextReads {
  readonly work_ApplicationDecision: TirRecordCodec<ApplicationDecision>;
  readonly work_ArtifactBindings: TirRecordCodec<ArtifactBindings>;
  readonly work_BindingVector: TirRecordCodec<BindingVector>;
  readonly work_BodyInstance: TirRecordCodec<BodyInstance>;
  readonly work_CheckJsDirective: TirRecordCodec<CheckJsDirective>;
  readonly work_CommentDirective: TirRecordCodec<CommentDirective>;
  readonly work_DeferredDecision: TirRecordCodec<DeferredDecision>;
  readonly work_EmbeddingDecision: TirRecordCodec<EmbeddingDecision>;
  readonly work_HirLexicalScope: TirRecordCodec<HirLexicalScope>;
  readonly work_ImportTarget: TirRecordCodec<ImportTarget>;
  readonly work_L_ParameterDeclaration_: TirRecordCodec<NodeList<ParameterDeclaration<TypedPhase>>>;
  readonly work_L_Statement_: TirRecordCodec<NodeList<Statement<TypedPhase>>>;
  readonly work_L_TypeParameterDeclaration_: TirRecordCodec<NodeList<TypeParameterDeclaration<TypedPhase>>>;
  readonly work_LocalRef: TirRecordCodec<LocalRef>;
  readonly work_MemberDecision: TirRecordCodec<MemberDecision>;
  readonly work_ModifierList: TirRecordCodec<ModifierList<TypedPhase>>;
  readonly work_Origin: TirRecordCodec<Origin>;
  readonly work_Pragma: TirRecordCodec<Pragma>;
  readonly work_RefinementDecision: TirRecordCodec<RefinementDecision>;
  readonly work_SourceNodeRef: TirRecordCodec<SourceNodeRef>;
  readonly work_TextRange: TirRecordCodec<TextRange>;
  readonly work_TypeEvidence: TirRecordCodec<TypeEvidence>;
  readonly work_TypedCallable: TirRecordCodec<TypedCallable>;
  readonly work_TypedClosure: TirRecordCodec<TypedClosure>;
  readonly work_TypedOperation: TirRecordCodec<TypedOperation>;
  readonly work_TypedSourceFile: TirRecordCodec<TypedSourceFile>;
  readonly work_TypedStaticBlock: TirRecordCodec<TypedStaticBlock>;
}

export interface BodyTextModel {
  readonly work_TirBody: TirRecordCodec<TirBody>;
  readonly work_TirParam: TirRecordCodec<TirParam>;
  readonly work_TirLocal: TirRecordCodec<TirLocal>;
  readonly work_TirResolution_local: TirRecordCodec<TirResolution & { readonly kind: "local" }>;
  readonly work_TirResolution_definition: TirRecordCodec<TirResolution & { readonly kind: "definition" }>;
  readonly work_TirResolution_module: TirRecordCodec<TirResolution & { readonly kind: "module" }>;
  readonly work_TirResolution_error: TirRecordCodec<TirResolution & { readonly kind: "error" }>;
  readonly work_ResolvedCallee: TirRecordCodec<ResolvedCallee>;
  readonly work_MemberSelection: TirRecordCodec<MemberSelection>;
  readonly work_TirArgument_provided: TirRecordCodec<TirArgument & { readonly kind: "provided" }>;
  readonly work_TirArgument_omitted: TirRecordCodec<TirArgument & { readonly kind: "omitted" }>;
  readonly work_TirArgument_rest: TirRecordCodec<TirArgument & { readonly kind: "rest" }>;
  readonly work_OmissionValue_absence: TirRecordCodec<(TirArgument & { readonly kind: "omitted" })["value"] & { readonly kind: "absence" }>;
  readonly work_OmissionValue_initializer: TirRecordCodec<(TirArgument & { readonly kind: "omitted" })["value"] & { readonly kind: "initializer" }>;
  readonly work_OmissionValue_empty_rest: TirRecordCodec<(TirArgument & { readonly kind: "omitted" })["value"] & { readonly kind: "empty-rest" }>;
  readonly work_TirRestPart_value: TirRecordCodec<TirRestPart & { readonly kind: "value" }>;
  readonly work_TirRestPart_spread: TirRecordCodec<TirRestPart & { readonly kind: "spread" }>;
  readonly work_TirApplication: TirRecordCodec<TirApplication>;
  readonly work_TirProtocolStep: TirRecordCodec<TirProtocolStep>;
  readonly work_TirProtocol: TirRecordCodec<TirProtocol>;
  readonly work_TirSelection_conditional: TirRecordCodec<TirSelection & { readonly kind: "conditional" }>;
  readonly work_TirSelection_and: TirRecordCodec<TirSelection & { readonly kind: "and" | "or" | "coalesce" }>;
  readonly work_TirSelection_or: TirRecordCodec<TirSelection & { readonly kind: "and" | "or" | "coalesce" }>;
  readonly work_TirSelection_coalesce: TirRecordCodec<TirSelection & { readonly kind: "and" | "or" | "coalesce" }>;
  readonly work_TirDemand_always: TirRecordCodec<TirDemand & { readonly kind: "always" }>;
  readonly work_TirDemand_selected: TirRecordCodec<TirDemand & { readonly kind: "selected" }>;
  readonly work_TirDemand_never: TirRecordCodec<TirDemand & { readonly kind: "never" }>;
  readonly work_ConversionDecision_identity: TirRecordCodec<ConversionDecision & { readonly kind: "identity" }>;
  readonly work_ConversionDecision_convert: TirRecordCodec<ConversionDecision & { readonly kind: "convert" }>;
  readonly work_ConversionDecision_deferred: TirRecordCodec<ConversionDecision & { readonly kind: "deferred" }>;
  readonly work_TargetAccess_write: TirRecordCodec<TargetAccess & { readonly kind: "write" }>;
  readonly work_TargetAccess_read_write: TirRecordCodec<TargetAccess & { readonly kind: "read-write" }>;
  readonly work_ModuleBindingTarget_definition: TirRecordCodec<ModuleBindingTarget & { readonly kind: "definition" }>;
  readonly work_ModuleBindingTarget_module: TirRecordCodec<ModuleBindingTarget & { readonly kind: "module" }>;
  readonly work_Block: (value: Block<TypedPhase>) => TirTypedRecordWork;
  readonly work_FunctionDeclaration: (value: FunctionDeclaration<TypedPhase>) => TirTypedRecordWork;
  readonly work_ConstructorDeclaration: (value: ConstructorDeclaration<TypedPhase>) => TirTypedRecordWork;
  readonly work_GetAccessorDeclaration: (value: GetAccessorDeclaration<TypedPhase>) => TirTypedRecordWork;
  readonly work_SetAccessorDeclaration: (value: SetAccessorDeclaration<TypedPhase>) => TirTypedRecordWork;
  readonly work_MethodDeclaration: (value: MethodDeclaration<TypedPhase>) => TirTypedRecordWork;
  readonly work_ClassStaticBlockDeclaration: (value: ClassStaticBlockDeclaration<TypedPhase>) => TirTypedRecordWork;
  readonly work_ArrowFunction: (value: ArrowFunction<TypedPhase>) => TirTypedRecordWork;
  readonly work_FunctionExpression: (value: FunctionExpression<TypedPhase>) => TirTypedRecordWork;
  readonly work_SourceFile: (value: SourceFile<TypedPhase>) => TirTypedRecordWork;
  readonly work_TirResolution: TirRecordCodec<TirResolution>;
  readonly work_TirArgument: TirRecordCodec<TirArgument>;
  readonly work_OmissionValue: TirRecordCodec<(TirArgument & { readonly kind: "omitted" })["value"]>;
  readonly work_TirRestPart: TirRecordCodec<TirRestPart>;
  readonly work_TirSelection: TirRecordCodec<TirSelection>;
  readonly work_TirDemand: TirRecordCodec<TirDemand>;
  readonly work_ConversionDecision: TirRecordCodec<ConversionDecision>;
  readonly work_TargetAccess: TirRecordCodec<TargetAccess>;
  readonly work_ModuleBindingTarget: TirRecordCodec<ModuleBindingTarget>;
  readonly work_O_TypedOperation__decided: TirRecordCodec<RuleOutcome<TypedOperation> & { readonly kind: "decided" }>;
  readonly work_O_TypedOperation__deferred: TirRecordCodec<RuleOutcome<TypedOperation> & { readonly kind: "deferred" }>;
  readonly work_O_TypedOperation_: TirRecordCodec<RuleOutcome<TypedOperation>>;
  readonly work_O_MemberSelection__decided: TirRecordCodec<RuleOutcome<MemberSelection> & { readonly kind: "decided" }>;
  readonly work_O_MemberSelection__deferred: TirRecordCodec<RuleOutcome<MemberSelection> & { readonly kind: "deferred" }>;
  readonly work_O_MemberSelection_: TirRecordCodec<RuleOutcome<MemberSelection>>;
  readonly work_O_TirApplication__decided: TirRecordCodec<RuleOutcome<TirApplication> & { readonly kind: "decided" }>;
  readonly work_O_TirApplication__deferred: TirRecordCodec<RuleOutcome<TirApplication> & { readonly kind: "deferred" }>;
  readonly work_O_TirApplication_: TirRecordCodec<RuleOutcome<TirApplication>>;
  readonly work_O_TirProtocol__decided: TirRecordCodec<RuleOutcome<TirProtocol> & { readonly kind: "decided" }>;
  readonly work_O_TirProtocol__deferred: TirRecordCodec<RuleOutcome<TirProtocol> & { readonly kind: "deferred" }>;
  readonly work_O_TirProtocol_: TirRecordCodec<RuleOutcome<TirProtocol>>;
  readonly work_O_ApplicationDecision__decided: TirRecordCodec<RuleOutcome<ApplicationDecision> & { readonly kind: "decided" }>;
  readonly work_O_ApplicationDecision__deferred: TirRecordCodec<RuleOutcome<ApplicationDecision> & { readonly kind: "deferred" }>;
  readonly work_O_ApplicationDecision_: TirRecordCodec<RuleOutcome<ApplicationDecision>>;
}

export const createBodyText = (kernel: TirTextKernel, read: BodyTextReads): BodyTextModel => {
  const { defineRecord, defineSyntaxRecord, syntaxReads, bodyReader, booleanReader, definitionReader, localReader, nodeReader, nullReader, numberReader, signatureReader, stringReader, typeReader } = kernel;
  const work_TirBody: TirRecordCodec<TirBody> = defineRecord<TirBody>("TirBody", "TirBody", null, "TirBody", null, null, fields => fields
    .field("body", "body", value => scalarWork("body", value.body), bodyReader)
    .field("owner", "def", value => referenceWork("def", value.owner), definitionReader)
    .field("bindings", "ArtifactBindings", value => withBindingOwner(read.work_ArtifactBindings.write(value.bindings), value.owner), lazyReader(() => read.work_ArtifactBindings.reader))
    .field("lexicalBindings", "BindingVector", value => withBindingOwner(read.work_BindingVector.write(value.lexicalBindings), value.owner), lazyReader(() => read.work_BindingVector.reader))
    .field("dependence", "Dependence", value => scalarWork("Dependence", value.dependence), literalReader<(TirBody)["dependence"]>("Dependence", ["parametric","binding-dependent"]))
    .field("signature", "sig", value => referenceWork("sig", value.signature), signatureReader)
    .field("completion", "t", value => referenceWork("t", value.completion), typeReader)
    .field("yielded", "?t", value => nullableWork(value.yielded, actual => referenceWork("t", actual)), nullableReader(typeReader))
    .field("sent", "?t", value => nullableWork(value.sent, actual => referenceWork("t", actual)), nullableReader(typeReader))
    .field("params", "[TirParam]", value => sequenceWork("[TirParam]", value.params, actual => work_TirParam.write(actual)), sequenceReader("[TirParam]", lazyReader(() => work_TirParam.reader)))
    .field("locals", "[TirLocal]", value => sequenceWork("[TirLocal]", value.locals, actual => work_TirLocal.write(actual)), sequenceReader("[TirLocal]", lazyReader(() => work_TirLocal.reader)))
    .field("root", "$BodyRoot", value => syntaxReference("$BodyRoot", value.root), syntaxReads.BodyRoot)
    .field("nestedBodies", "[body]", value => sequenceWork("[body]", value.nestedBodies, actual => scalarWork("body", actual)), sequenceReader("[body]", bodyReader))
    .field("captures", "[LocalRef]", value => sequenceWork("[LocalRef]", value.captures, actual => read.work_LocalRef.write(actual)), sequenceReader("[LocalRef]", lazyReader(() => read.work_LocalRef.reader)))
    .field("scopes", "[HirLexicalScope]", value => sequenceWork("[HirLexicalScope]", value.scopes, actual => read.work_HirLexicalScope.write(actual)), sequenceReader("[HirLexicalScope]", lazyReader(() => read.work_HirLexicalScope.reader)))
    .field("evidence", "[TypeEvidence]", value => sequenceWork("[TypeEvidence]", value.evidence, actual => read.work_TypeEvidence.write(actual)), sequenceReader("[TypeEvidence]", lazyReader(() => read.work_TypeEvidence.reader)))
    .field("asynchronous", "boolean", value => scalarWork("boolean", value.asynchronous), booleanReader)
    .field("generator", "boolean", value => scalarWork("boolean", value.generator), booleanReader)
    .finish((field_body, field_owner, field_bindings, field_lexicalBindings, field_dependence, field_signature, field_completion, field_yielded, field_sent, field_params, field_locals, field_root, field_nestedBodies, field_captures, field_scopes, field_evidence, field_asynchronous, field_generator) => ({
      body: field_body, owner: field_owner, bindings: field_bindings, lexicalBindings: field_lexicalBindings,
      dependence: field_dependence, signature: field_signature, completion: field_completion, yielded: field_yielded, sent: field_sent,
      params: field_params, locals: field_locals, root: field_root, nestedBodies: field_nestedBodies, captures: field_captures,
      scopes: field_scopes, evidence: field_evidence, asynchronous: field_asynchronous, generator: field_generator,
    })));
  const work_TirParam: TirRecordCodec<TirParam> = defineRecord<TirParam>("TirParam", "TirParam", null, "TirParam", null, null, fields => fields
    .field("local", "l", value => referenceWork("l", value.local), localReader)
    .field("declaration", "def", value => referenceWork("def", value.declaration), definitionReader)
    .field("role", "ParameterRole", value => scalarWork("ParameterRole", value.role), literalReader<(TirParam)["role"]>("ParameterRole", ["required","optional","default","rest","this"]))
    .field("passing", "PassingMode", value => scalarWork("PassingMode", value.passing), literalReader<(TirParam)["passing"]>("PassingMode", ["by-value","byref-readonly","byref-readwrite","byref-writeonly-must-init","borrow-shared","borrow-mut","move"]))
    .field("initializer", "?body", value => nullableWork(value.initializer, actual => scalarWork("body", actual)), nullableReader(bodyReader))
    .field("storage", "t", value => referenceWork("t", value.storage), typeReader)
    .finish((field_local, field_declaration, field_role, field_passing, field_initializer, field_storage) => ({
      local: field_local, declaration: field_declaration, role: field_role, passing: field_passing, initializer: field_initializer,
      storage: field_storage,
    })));
  const work_TirLocal: TirRecordCodec<TirLocal> = defineRecord<TirLocal>("TirLocal", "TirLocal", null, "TirLocal", null, null, fields => fields
    .field("id", "l", value => referenceWork("l", value.id), localReader)
    .field("declaration", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.declaration), lazyReader(() => read.work_SourceNodeRef.reader))
    .field("name", "string", value => scalarWork("string", value.name), stringReader)
    .field("role", "LocalRole", value => scalarWork("LocalRole", value.role), literalReader<(TirLocal)["role"]>("LocalRole", ["parameter","binding","capture","catch"]))
    .field("capturedFrom", "?LocalRef", value => nullableWork(value.capturedFrom, actual => read.work_LocalRef.write(actual)), nullableReader(lazyReader(() => read.work_LocalRef.reader)))
    .field("mutable", "boolean", value => scalarWork("boolean", value.mutable), booleanReader)
    .field("storage", "t", value => referenceWork("t", value.storage), typeReader)
    .finish((field_id, field_declaration, field_name, field_role, field_capturedFrom, field_mutable, field_storage) => ({
      id: field_id, declaration: field_declaration, name: field_name, role: field_role, capturedFrom: field_capturedFrom,
      mutable: field_mutable, storage: field_storage,
    })));
  const work_TirResolution_local: TirRecordCodec<TirResolution & { readonly kind: "local" }> = defineRecord<TirResolution & { readonly kind: "local" }>("TirResolution#local", "TirResolution", { field: "kind", value: "local" }, "local", null, null, fields => fields
    .field("local", "LocalRef", value => read.work_LocalRef.write(value.local), lazyReader(() => read.work_LocalRef.reader))
    .finish((field_local) => ({ kind: "local", local: field_local })));
  const work_TirResolution_definition: TirRecordCodec<TirResolution & { readonly kind: "definition" }> = defineRecord<TirResolution & { readonly kind: "definition" }>("TirResolution#definition", "TirResolution", { field: "kind", value: "definition" }, "definition", null, null, fields => fields
    .field("definition", "def", value => referenceWork("def", value.definition), definitionReader)
    .field("aliases", "[def]", value => sequenceWork("[def]", value.aliases, actual => referenceWork("def", actual)), sequenceReader("[def]", definitionReader))
    .finish((field_definition, field_aliases) => ({ kind: "definition", definition: field_definition, aliases: field_aliases })));
  const work_TirResolution_module: TirRecordCodec<TirResolution & { readonly kind: "module" }> = defineRecord<TirResolution & { readonly kind: "module" }>("TirResolution#module", "TirResolution", { field: "kind", value: "module" }, "module", null, null, fields => fields
    .field("target", "ImportTarget", value => read.work_ImportTarget.write(value.target), lazyReader(() => read.work_ImportTarget.reader))
    .finish((field_target) => ({ kind: "module", target: field_target })));
  const work_TirResolution_error: TirRecordCodec<TirResolution & { readonly kind: "error" }> = defineRecord<TirResolution & { readonly kind: "error" }>("TirResolution#error", "TirResolution", { field: "kind", value: "error" }, "error", null, null, fields => fields
    .field("diagnostic", "number", value => scalarWork("number", value.diagnostic), numberReader)
    .finish((field_diagnostic) => ({ kind: "error", diagnostic: field_diagnostic })));
  const work_ResolvedCallee: TirRecordCodec<ResolvedCallee> = defineRecord<ResolvedCallee>("ResolvedCallee", "ResolvedCallee", null, "ResolvedCallee", null, null, fields => fields
    .field("decision", "ApplicationDecision", value => read.work_ApplicationDecision.write(value.decision), lazyReader(() => read.work_ApplicationDecision.reader))
    .field("activation", "?BodyInstance", value => nullableWork(value.activation, actual => read.work_BodyInstance.write(actual)), nullableReader(lazyReader(() => read.work_BodyInstance.reader)))
    .field("captures", "[LocalRef]", value => sequenceWork("[LocalRef]", value.captures, actual => read.work_LocalRef.write(actual)), sequenceReader("[LocalRef]", lazyReader(() => read.work_LocalRef.reader)))
    .finish((field_decision, field_activation, field_captures) => ({ decision: field_decision, activation: field_activation, captures: field_captures })));
  const work_MemberSelection: TirRecordCodec<MemberSelection> = defineRecord<MemberSelection>("MemberSelection", "MemberSelection", null, "MemberSelection", null, value => ({ kind: "member-selection", value }), fields => fields
    .field("decision", "MemberDecision", value => read.work_MemberDecision.write(value.decision), lazyReader(() => read.work_MemberDecision.reader))
    .field("getter", "?ResolvedCallee", value => nullableWork(value.getter, actual => work_ResolvedCallee.write(actual)), nullableReader(lazyReader(() => work_ResolvedCallee.reader)))
    .field("setter", "?ResolvedCallee", value => nullableWork(value.setter, actual => work_ResolvedCallee.write(actual)), nullableReader(lazyReader(() => work_ResolvedCallee.reader)))
    .finish((field_decision, field_getter, field_setter) => ({ decision: field_decision, getter: field_getter, setter: field_setter })));
  const work_TirArgument_provided: TirRecordCodec<TirArgument & { readonly kind: "provided" }> = defineRecord<TirArgument & { readonly kind: "provided" }>("TirArgument#provided", "TirArgument", { field: "kind", value: "provided" }, "provided", null, null, fields => fields
    .field("parameter", "number", value => scalarWork("number", value.parameter), numberReader)
    .field("expression", "n", value => referenceWork("n", value.expression), nodeReader)
    .finish((field_parameter, field_expression) => ({ kind: "provided", parameter: field_parameter, expression: field_expression })));
  const work_TirArgument_omitted: TirRecordCodec<TirArgument & { readonly kind: "omitted" }> = defineRecord<TirArgument & { readonly kind: "omitted" }>("TirArgument#omitted", "TirArgument", { field: "kind", value: "omitted" }, "omitted", null, null, fields => fields
    .field("parameter", "number", value => scalarWork("number", value.parameter), numberReader)
    .field("value", "OmissionValue", value => work_OmissionValue.write(value.value), lazyReader(() => work_OmissionValue.reader))
    .finish((field_parameter, field_value) => ({ kind: "omitted", parameter: field_parameter, value: field_value })));
  const work_TirArgument_rest: TirRecordCodec<TirArgument & { readonly kind: "rest" }> = defineRecord<TirArgument & { readonly kind: "rest" }>("TirArgument#rest", "TirArgument", { field: "kind", value: "rest" }, "rest", null, null, fields => fields
    .field("parameter", "number", value => scalarWork("number", value.parameter), numberReader)
    .field("parts", "[TirRestPart]", value => sequenceWork("[TirRestPart]", value.parts, actual => work_TirRestPart.write(actual)), sequenceReader("[TirRestPart]", lazyReader(() => work_TirRestPart.reader)))
    .finish((field_parameter, field_parts) => ({ kind: "rest", parameter: field_parameter, parts: field_parts })));
  const work_OmissionValue_absence: TirRecordCodec<(TirArgument & { readonly kind: "omitted" })["value"] & { readonly kind: "absence" }> = defineRecord<(TirArgument & { readonly kind: "omitted" })["value"] & { readonly kind: "absence" }>("OmissionValue#absence", "OmissionValue", { field: "kind", value: "absence" }, "absence", null, null, fields => fields
    .finish(() => ({ kind: "absence" })));
  const work_OmissionValue_initializer: TirRecordCodec<(TirArgument & { readonly kind: "omitted" })["value"] & { readonly kind: "initializer" }> = defineRecord<(TirArgument & { readonly kind: "omitted" })["value"] & { readonly kind: "initializer" }>("OmissionValue#initializer", "OmissionValue", { field: "kind", value: "initializer" }, "initializer", null, null, fields => fields
    .field("instance", "BodyInstance", value => read.work_BodyInstance.write(value.instance), lazyReader(() => read.work_BodyInstance.reader))
    .finish((field_instance) => ({ kind: "initializer", instance: field_instance })));
  const work_OmissionValue_empty_rest: TirRecordCodec<(TirArgument & { readonly kind: "omitted" })["value"] & { readonly kind: "empty-rest" }> = defineRecord<(TirArgument & { readonly kind: "omitted" })["value"] & { readonly kind: "empty-rest" }>("OmissionValue#empty-rest", "OmissionValue", { field: "kind", value: "empty-rest" }, "empty-rest", null, null, fields => fields
    .finish(() => ({ kind: "empty-rest" })));
  const work_TirRestPart_value: TirRecordCodec<TirRestPart & { readonly kind: "value" }> = defineRecord<TirRestPart & { readonly kind: "value" }>("TirRestPart#value", "TirRestPart", { field: "kind", value: "value" }, "value", null, null, fields => fields
    .field("expression", "n", value => referenceWork("n", value.expression), nodeReader)
    .finish((field_expression) => ({ kind: "value", expression: field_expression })));
  const work_TirRestPart_spread: TirRecordCodec<TirRestPart & { readonly kind: "spread" }> = defineRecord<TirRestPart & { readonly kind: "spread" }>("TirRestPart#spread", "TirRestPart", { field: "kind", value: "spread" }, "spread", null, null, fields => fields
    .field("expression", "n", value => referenceWork("n", value.expression), nodeReader)
    .field("tuple", "?[t]", value => nullableWork(value.tuple, actual => sequenceWork("[t]", actual, actual => referenceWork("t", actual))), nullableReader(sequenceReader("[t]", typeReader)))
    .finish((field_expression, field_tuple) => ({ kind: "spread", expression: field_expression, tuple: field_tuple })));
  const work_TirApplication: TirRecordCodec<TirApplication> = defineRecord<TirApplication>("TirApplication", "TirApplication", null, "TirApplication", null, null, fields => fields
    .field("callee", "ResolvedCallee", value => work_ResolvedCallee.write(value.callee), lazyReader(() => work_ResolvedCallee.reader))
    .field("receiver", "?n", value => nullableWork(value.receiver, actual => referenceWork("n", actual)), nullableReader(nodeReader))
    .field("arguments", "[TirArgument]", value => sequenceWork("[TirArgument]", value.arguments, actual => work_TirArgument.write(actual)), sequenceReader("[TirArgument]", lazyReader(() => work_TirArgument.reader)))
    .finish((field_callee, field_receiver, field_arguments) => ({ callee: field_callee, receiver: field_receiver, arguments: field_arguments })));
  const work_TirProtocolStep: TirRecordCodec<TirProtocolStep> = defineRecord<TirProtocolStep>("TirProtocolStep", "TirProtocolStep", null, "TirProtocolStep", null, null, fields => fields
    .field("role", "ProtocolStepRole", value => scalarWork("ProtocolStepRole", value.role), literalReader<(TirProtocolStep)["role"]>("ProtocolStepRole", ["acquire","next","done","value","finish","fail","await","dispose","completion"]))
    .field("operation", "TypedOperation", value => read.work_TypedOperation.write(value.operation), lazyReader(() => read.work_TypedOperation.reader))
    .field("callee", "?ResolvedCallee", value => nullableWork(value.callee, actual => work_ResolvedCallee.write(actual)), nullableReader(lazyReader(() => work_ResolvedCallee.reader)))
    .finish((field_role, field_operation, field_callee) => ({ role: field_role, operation: field_operation, callee: field_callee })));
  const work_TirProtocol: TirRecordCodec<TirProtocol> = defineRecord<TirProtocol>("TirProtocol", "TirProtocol", null, "TirProtocol", null, null, fields => fields
    .field("kind", "TirProtocolKind", value => scalarWork("TirProtocolKind", value.kind), literalReader<(TirProtocol)["kind"]>("TirProtocolKind", ["iterate","spread","await","yield","delegate","dispose"]))
    .field("asynchronous", "boolean", value => scalarWork("boolean", value.asynchronous), booleanReader)
    .field("steps", "[TirProtocolStep]", value => sequenceWork("[TirProtocolStep]", value.steps, actual => work_TirProtocolStep.write(actual)), sequenceReader("[TirProtocolStep]", lazyReader(() => work_TirProtocolStep.reader)))
    .field("value", "t", value => referenceWork("t", value.value), typeReader)
    .field("completion", "t", value => referenceWork("t", value.completion), typeReader)
    .field("sent", "?t", value => nullableWork(value.sent, actual => referenceWork("t", actual)), nullableReader(typeReader))
    .field("thrown", "t", value => referenceWork("t", value.thrown), typeReader)
    .finish((field_kind, field_asynchronous, field_steps, field_value, field_completion, field_sent, field_thrown) => ({
      kind: field_kind, asynchronous: field_asynchronous, steps: field_steps, value: field_value, completion: field_completion,
      sent: field_sent, thrown: field_thrown,
    })));
  const work_TirSelection_conditional: TirRecordCodec<TirSelection & { readonly kind: "conditional" }> = defineRecord<TirSelection & { readonly kind: "conditional" }>("TirSelection#conditional", "TirSelection", { field: "kind", value: "conditional" }, "conditional", null, null, fields => fields
    .field("control", "n", value => referenceWork("n", value.control), nodeReader)
    .field("whenTrue", "n", value => referenceWork("n", value.whenTrue), nodeReader)
    .field("whenFalse", "n", value => referenceWork("n", value.whenFalse), nodeReader)
    .field("disposition", "ConditionalDisposition", value => scalarWork("ConditionalDisposition", value.disposition), literalReader<(TirSelection & { readonly kind: "conditional" })["disposition"]>("ConditionalDisposition", ["true","false","dynamic"]))
    .finish((field_control, field_whenTrue, field_whenFalse, field_disposition) => ({ kind: "conditional", control: field_control, whenTrue: field_whenTrue, whenFalse: field_whenFalse, disposition: field_disposition })));
  const work_TirSelection_and: TirRecordCodec<TirSelection & { readonly kind: "and" | "or" | "coalesce" }> = defineRecord<TirSelection & { readonly kind: "and" | "or" | "coalesce" }>("TirSelection#and", "TirSelection", { field: "kind", value: "and" }, "and", null, null, fields => fields
    .field("control", "n", value => referenceWork("n", value.control), nodeReader)
    .field("right", "n", value => referenceWork("n", value.right), nodeReader)
    .field("disposition", "LogicalDisposition", value => scalarWork("LogicalDisposition", value.disposition), literalReader<(TirSelection & { readonly kind: "and" | "or" | "coalesce" })["disposition"]>("LogicalDisposition", ["left","right","dynamic"]))
    .finish((field_control, field_right, field_disposition) => ({ kind: "and", control: field_control, right: field_right, disposition: field_disposition })));
  const work_TirSelection_or: TirRecordCodec<TirSelection & { readonly kind: "and" | "or" | "coalesce" }> = defineRecord<TirSelection & { readonly kind: "and" | "or" | "coalesce" }>("TirSelection#or", "TirSelection", { field: "kind", value: "or" }, "or", null, null, fields => fields
    .field("control", "n", value => referenceWork("n", value.control), nodeReader)
    .field("right", "n", value => referenceWork("n", value.right), nodeReader)
    .field("disposition", "LogicalDisposition", value => scalarWork("LogicalDisposition", value.disposition), literalReader<(TirSelection & { readonly kind: "and" | "or" | "coalesce" })["disposition"]>("LogicalDisposition", ["left","right","dynamic"]))
    .finish((field_control, field_right, field_disposition) => ({ kind: "or", control: field_control, right: field_right, disposition: field_disposition })));
  const work_TirSelection_coalesce: TirRecordCodec<TirSelection & { readonly kind: "and" | "or" | "coalesce" }> = defineRecord<TirSelection & { readonly kind: "and" | "or" | "coalesce" }>("TirSelection#coalesce", "TirSelection", { field: "kind", value: "coalesce" }, "coalesce", null, null, fields => fields
    .field("control", "n", value => referenceWork("n", value.control), nodeReader)
    .field("right", "n", value => referenceWork("n", value.right), nodeReader)
    .field("disposition", "LogicalDisposition", value => scalarWork("LogicalDisposition", value.disposition), literalReader<(TirSelection & { readonly kind: "and" | "or" | "coalesce" })["disposition"]>("LogicalDisposition", ["left","right","dynamic"]))
    .finish((field_control, field_right, field_disposition) => ({ kind: "coalesce", control: field_control, right: field_right, disposition: field_disposition })));
  const work_TirDemand_always: TirRecordCodec<TirDemand & { readonly kind: "always" }> = defineRecord<TirDemand & { readonly kind: "always" }>("TirDemand#always", "TirDemand", { field: "kind", value: "always" }, "always", null, null, fields => fields
    .finish(() => ({ kind: "always" })));
  const work_TirDemand_selected: TirRecordCodec<TirDemand & { readonly kind: "selected" }> = defineRecord<TirDemand & { readonly kind: "selected" }>("TirDemand#selected", "TirDemand", { field: "kind", value: "selected" }, "selected", null, null, fields => fields
    .field("control", "n", value => referenceWork("n", value.control), nodeReader)
    .field("when", "DemandCondition", value => scalarWork("DemandCondition", value.when), literalReader<(TirDemand & { readonly kind: "selected" })["when"]>("DemandCondition", ["true","false","present","absent"]))
    .finish((field_control, field_when) => ({ kind: "selected", control: field_control, when: field_when })));
  const work_TirDemand_never: TirRecordCodec<TirDemand & { readonly kind: "never" }> = defineRecord<TirDemand & { readonly kind: "never" }>("TirDemand#never", "TirDemand", { field: "kind", value: "never" }, "never", null, null, fields => fields
    .field("control", "n", value => referenceWork("n", value.control), nodeReader)
    .finish((field_control) => ({ kind: "never", control: field_control })));
  const work_ConversionDecision_identity: TirRecordCodec<ConversionDecision & { readonly kind: "identity" }> = defineRecord<ConversionDecision & { readonly kind: "identity" }>("ConversionDecision#identity", "ConversionDecision", { field: "kind", value: "identity" }, "identity", null, null, fields => fields
    .finish(() => ({ kind: "identity" })));
  const work_ConversionDecision_convert: TirRecordCodec<ConversionDecision & { readonly kind: "convert" }> = defineRecord<ConversionDecision & { readonly kind: "convert" }>("ConversionDecision#convert", "ConversionDecision", { field: "kind", value: "convert" }, "convert", null, null, fields => fields
    .field("role", "FlowRole", value => scalarWork("FlowRole", value.role), literalReader<(ConversionDecision & { readonly kind: "convert" })["role"]>("FlowRole", ["initialization","assignment","argument","return","receiver","yield","member-write"]))
    .field("embedding", "EmbeddingDecision", value => read.work_EmbeddingDecision.write(value.embedding), lazyReader(() => read.work_EmbeddingDecision.reader))
    .field("operation", "TypedOperation", value => read.work_TypedOperation.write(value.operation), lazyReader(() => read.work_TypedOperation.reader))
    .finish((field_role, field_embedding, field_operation) => ({ kind: "convert", role: field_role, embedding: field_embedding, operation: field_operation })));
  const work_ConversionDecision_deferred: TirRecordCodec<ConversionDecision & { readonly kind: "deferred" }> = defineRecord<ConversionDecision & { readonly kind: "deferred" }>("ConversionDecision#deferred", "ConversionDecision", { field: "kind", value: "deferred" }, "deferred", null, null, fields => fields
    .field("deferred", "DeferredDecision", value => read.work_DeferredDecision.write(value.deferred), lazyReader(() => read.work_DeferredDecision.reader))
    .finish((field_deferred) => ({ kind: "deferred", deferred: field_deferred })));
  const work_TargetAccess_write: TirRecordCodec<TargetAccess & { readonly kind: "write" }> = defineRecord<TargetAccess & { readonly kind: "write" }>("TargetAccess#write", "TargetAccess", { field: "kind", value: "write" }, "write", null, null, fields => fields
    .field("storage", "t", value => referenceWork("t", value.storage), typeReader)
    .finish((field_storage) => ({ kind: "write", storage: field_storage })));
  const work_TargetAccess_read_write: TirRecordCodec<TargetAccess & { readonly kind: "read-write" }> = defineRecord<TargetAccess & { readonly kind: "read-write" }>("TargetAccess#read-write", "TargetAccess", { field: "kind", value: "read-write" }, "read-write", null, null, fields => fields
    .field("storage", "t", value => referenceWork("t", value.storage), typeReader)
    .field("read", "t", value => referenceWork("t", value.read), typeReader)
    .field("narrowing", "?RefinementDecision", value => nullableWork(value.narrowing, actual => read.work_RefinementDecision.write(actual)), nullableReader(lazyReader(() => read.work_RefinementDecision.reader)))
    .field("evidenceIndex", "?number", value => nullableWork(value.evidenceIndex, actual => scalarWork("number", actual)), nullableReader(numberReader))
    .finish((field_storage, field_read, field_narrowing, field_evidenceIndex) => ({ kind: "read-write", storage: field_storage, read: field_read, narrowing: field_narrowing, evidenceIndex: field_evidenceIndex })));
  const work_ModuleBindingTarget_definition: TirRecordCodec<ModuleBindingTarget & { readonly kind: "definition" }> = defineRecord<ModuleBindingTarget & { readonly kind: "definition" }>("ModuleBindingTarget#definition", "ModuleBindingTarget", { field: "kind", value: "definition" }, "definition", null, null, fields => fields
    .field("definition", "def", value => referenceWork("def", value.definition), definitionReader)
    .finish((field_definition) => ({ kind: "definition", definition: field_definition })));
  const work_ModuleBindingTarget_module: TirRecordCodec<ModuleBindingTarget & { readonly kind: "module" }> = defineRecord<ModuleBindingTarget & { readonly kind: "module" }>("ModuleBindingTarget#module", "ModuleBindingTarget", { field: "kind", value: "module" }, "module", null, null, fields => fields
    .field("target", "ImportTarget", value => read.work_ImportTarget.write(value.target), lazyReader(() => read.work_ImportTarget.reader))
    .finish((field_target) => ({ kind: "module", target: field_target })));
  const work_Block: (value: Block<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<Block<TypedPhase>>("Block", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'Block", literalReader<(Block<TypedPhase>)["kind"]>("'Block", ["Block"]))
    .field("statements", "L<Statement>", value => read.work_L_Statement_.write(value.statements), lazyReader(() => read.work_L_Statement_.reader))
    .field("multiLine", "boolean", value => scalarWork("boolean", value.multiLine), booleanReader)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_statements, field_multiLine, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, statements: field_statements, multiLine: field_multiLine, tsonic: field_tsonic }), (kind,
      make) => ({ kind, value: make(kind),
    })));
  const work_FunctionDeclaration: (value: FunctionDeclaration<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<FunctionDeclaration<TypedPhase>>("FunctionDeclaration", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'FunctionDeclaration", literalReader<(FunctionDeclaration<TypedPhase>)["kind"]>("'FunctionDeclaration", ["FunctionDeclaration"]))
    .field("modifiers", "?ModifierList", value => nullableWork(value.modifiers, actual => read.work_ModifierList.write(actual)), nullableReader(lazyReader(() => read.work_ModifierList.reader)))
    .field("typeParameters", "?L<TypeParameterDeclaration>", value => nullableWork(value.typeParameters, actual => read.work_L_TypeParameterDeclaration_.write(actual)), nullableReader(lazyReader(() => read.work_L_TypeParameterDeclaration_.reader)))
    .field("parameters", "L<ParameterDeclaration>", value => read.work_L_ParameterDeclaration_.write(value.parameters), lazyReader(() => read.work_L_ParameterDeclaration_.reader))
    .field("type", "?$TypeNode", value => nullableWork(value.type, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("fullSignature", "?$TypeNode", value => nullableWork(value.fullSignature, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("asteriskToken", "?$AsteriskToken", value => nullableWork(value.asteriskToken, actual => syntaxReference("$AsteriskToken", actual)), nullableReader(syntaxReads.AsteriskToken))
    .field("body", "?$BlockOrExpression", value => nullableWork(value.body, actual => syntaxReference("$BlockOrExpression", actual)), nullableReader(syntaxReads.BlockOrExpression))
    .field("name", "?$Identifier", value => nullableWork(value.name, actual => syntaxReference("$Identifier", actual)), nullableReader(syntaxReads.Identifier))
    .field("tsonic", "TypedCallable", value => read.work_TypedCallable.write(value.tsonic), lazyReader(() => read.work_TypedCallable.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_typeParameters, field_parameters, field_type, field_fullSignature, field_asteriskToken, field_body, field_name, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, modifiers: field_modifiers, typeParameters: field_typeParameters, parameters: field_parameters,
      type: field_type, fullSignature: field_fullSignature, asteriskToken: field_asteriskToken, body: field_body, name: field_name,
      tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_ConstructorDeclaration: (value: ConstructorDeclaration<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ConstructorDeclaration<TypedPhase>>("ConstructorDeclaration", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'Constructor", literalReader<(ConstructorDeclaration<TypedPhase>)["kind"]>("'Constructor", ["Constructor"]))
    .field("modifiers", "?ModifierList", value => nullableWork(value.modifiers, actual => read.work_ModifierList.write(actual)), nullableReader(lazyReader(() => read.work_ModifierList.reader)))
    .field("typeParameters", "?L<TypeParameterDeclaration>", value => nullableWork(value.typeParameters, actual => read.work_L_TypeParameterDeclaration_.write(actual)), nullableReader(lazyReader(() => read.work_L_TypeParameterDeclaration_.reader)))
    .field("parameters", "L<ParameterDeclaration>", value => read.work_L_ParameterDeclaration_.write(value.parameters), lazyReader(() => read.work_L_ParameterDeclaration_.reader))
    .field("type", "?$TypeNode", value => nullableWork(value.type, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("fullSignature", "?$TypeNode", value => nullableWork(value.fullSignature, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("asteriskToken", "?$AsteriskToken", value => nullableWork(value.asteriskToken, actual => syntaxReference("$AsteriskToken", actual)), nullableReader(syntaxReads.AsteriskToken))
    .field("body", "?$BlockOrExpression", value => nullableWork(value.body, actual => syntaxReference("$BlockOrExpression", actual)), nullableReader(syntaxReads.BlockOrExpression))
    .field("tsonic", "TypedCallable", value => read.work_TypedCallable.write(value.tsonic), lazyReader(() => read.work_TypedCallable.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_typeParameters, field_parameters, field_type, field_fullSignature, field_asteriskToken, field_body, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, modifiers: field_modifiers, typeParameters: field_typeParameters, parameters: field_parameters,
      type: field_type, fullSignature: field_fullSignature, asteriskToken: field_asteriskToken, body: field_body,
      tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_GetAccessorDeclaration: (value: GetAccessorDeclaration<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<GetAccessorDeclaration<TypedPhase>>("GetAccessorDeclaration", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'GetAccessor", literalReader<(GetAccessorDeclaration<TypedPhase>)["kind"]>("'GetAccessor", ["GetAccessor"]))
    .field("modifiers", "?ModifierList", value => nullableWork(value.modifiers, actual => read.work_ModifierList.write(actual)), nullableReader(lazyReader(() => read.work_ModifierList.reader)))
    .field("name", "$PropertyName", value => syntaxReference("$PropertyName", value.name), syntaxReads.PropertyName)
    .field("postfixToken", "?$PostfixToken", value => nullableWork(value.postfixToken, actual => syntaxReference("$PostfixToken", actual)), nullableReader(syntaxReads.PostfixToken))
    .field("typeParameters", "?L<TypeParameterDeclaration>", value => nullableWork(value.typeParameters, actual => read.work_L_TypeParameterDeclaration_.write(actual)), nullableReader(lazyReader(() => read.work_L_TypeParameterDeclaration_.reader)))
    .field("parameters", "L<ParameterDeclaration>", value => read.work_L_ParameterDeclaration_.write(value.parameters), lazyReader(() => read.work_L_ParameterDeclaration_.reader))
    .field("type", "?$TypeNode", value => nullableWork(value.type, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("fullSignature", "?$TypeNode", value => nullableWork(value.fullSignature, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("asteriskToken", "?$AsteriskToken", value => nullableWork(value.asteriskToken, actual => syntaxReference("$AsteriskToken", actual)), nullableReader(syntaxReads.AsteriskToken))
    .field("body", "?$BlockOrExpression", value => nullableWork(value.body, actual => syntaxReference("$BlockOrExpression", actual)), nullableReader(syntaxReads.BlockOrExpression))
    .field("tsonic", "TypedCallable", value => read.work_TypedCallable.write(value.tsonic), lazyReader(() => read.work_TypedCallable.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_name, field_postfixToken, field_typeParameters, field_parameters, field_type, field_fullSignature, field_asteriskToken, field_body, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, modifiers: field_modifiers, name: field_name, postfixToken: field_postfixToken,
      typeParameters: field_typeParameters, parameters: field_parameters, type: field_type, fullSignature: field_fullSignature,
      asteriskToken: field_asteriskToken, body: field_body, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_SetAccessorDeclaration: (value: SetAccessorDeclaration<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<SetAccessorDeclaration<TypedPhase>>("SetAccessorDeclaration", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'SetAccessor", literalReader<(SetAccessorDeclaration<TypedPhase>)["kind"]>("'SetAccessor", ["SetAccessor"]))
    .field("modifiers", "?ModifierList", value => nullableWork(value.modifiers, actual => read.work_ModifierList.write(actual)), nullableReader(lazyReader(() => read.work_ModifierList.reader)))
    .field("name", "$PropertyName", value => syntaxReference("$PropertyName", value.name), syntaxReads.PropertyName)
    .field("postfixToken", "?$PostfixToken", value => nullableWork(value.postfixToken, actual => syntaxReference("$PostfixToken", actual)), nullableReader(syntaxReads.PostfixToken))
    .field("typeParameters", "?L<TypeParameterDeclaration>", value => nullableWork(value.typeParameters, actual => read.work_L_TypeParameterDeclaration_.write(actual)), nullableReader(lazyReader(() => read.work_L_TypeParameterDeclaration_.reader)))
    .field("parameters", "L<ParameterDeclaration>", value => read.work_L_ParameterDeclaration_.write(value.parameters), lazyReader(() => read.work_L_ParameterDeclaration_.reader))
    .field("type", "?$TypeNode", value => nullableWork(value.type, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("fullSignature", "?$TypeNode", value => nullableWork(value.fullSignature, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("asteriskToken", "?$AsteriskToken", value => nullableWork(value.asteriskToken, actual => syntaxReference("$AsteriskToken", actual)), nullableReader(syntaxReads.AsteriskToken))
    .field("body", "?$BlockOrExpression", value => nullableWork(value.body, actual => syntaxReference("$BlockOrExpression", actual)), nullableReader(syntaxReads.BlockOrExpression))
    .field("tsonic", "TypedCallable", value => read.work_TypedCallable.write(value.tsonic), lazyReader(() => read.work_TypedCallable.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_name, field_postfixToken, field_typeParameters, field_parameters, field_type, field_fullSignature, field_asteriskToken, field_body, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, modifiers: field_modifiers, name: field_name, postfixToken: field_postfixToken,
      typeParameters: field_typeParameters, parameters: field_parameters, type: field_type, fullSignature: field_fullSignature,
      asteriskToken: field_asteriskToken, body: field_body, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_MethodDeclaration: (value: MethodDeclaration<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<MethodDeclaration<TypedPhase>>("MethodDeclaration", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'MethodDeclaration", literalReader<(MethodDeclaration<TypedPhase>)["kind"]>("'MethodDeclaration", ["MethodDeclaration"]))
    .field("modifiers", "?ModifierList", value => nullableWork(value.modifiers, actual => read.work_ModifierList.write(actual)), nullableReader(lazyReader(() => read.work_ModifierList.reader)))
    .field("name", "$PropertyName", value => syntaxReference("$PropertyName", value.name), syntaxReads.PropertyName)
    .field("postfixToken", "?$PostfixToken", value => nullableWork(value.postfixToken, actual => syntaxReference("$PostfixToken", actual)), nullableReader(syntaxReads.PostfixToken))
    .field("typeParameters", "?L<TypeParameterDeclaration>", value => nullableWork(value.typeParameters, actual => read.work_L_TypeParameterDeclaration_.write(actual)), nullableReader(lazyReader(() => read.work_L_TypeParameterDeclaration_.reader)))
    .field("parameters", "L<ParameterDeclaration>", value => read.work_L_ParameterDeclaration_.write(value.parameters), lazyReader(() => read.work_L_ParameterDeclaration_.reader))
    .field("type", "?$TypeNode", value => nullableWork(value.type, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("fullSignature", "?$TypeNode", value => nullableWork(value.fullSignature, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("asteriskToken", "?$AsteriskToken", value => nullableWork(value.asteriskToken, actual => syntaxReference("$AsteriskToken", actual)), nullableReader(syntaxReads.AsteriskToken))
    .field("body", "?$BlockOrExpression", value => nullableWork(value.body, actual => syntaxReference("$BlockOrExpression", actual)), nullableReader(syntaxReads.BlockOrExpression))
    .field("tsonic", "TypedCallable", value => read.work_TypedCallable.write(value.tsonic), lazyReader(() => read.work_TypedCallable.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_name, field_postfixToken, field_typeParameters, field_parameters, field_type, field_fullSignature, field_asteriskToken, field_body, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, modifiers: field_modifiers, name: field_name, postfixToken: field_postfixToken,
      typeParameters: field_typeParameters, parameters: field_parameters, type: field_type, fullSignature: field_fullSignature,
      asteriskToken: field_asteriskToken, body: field_body, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_ClassStaticBlockDeclaration: (value: ClassStaticBlockDeclaration<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ClassStaticBlockDeclaration<TypedPhase>>("ClassStaticBlockDeclaration", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ClassStaticBlockDeclaration", literalReader<(ClassStaticBlockDeclaration<TypedPhase>)["kind"]>("'ClassStaticBlockDeclaration", ["ClassStaticBlockDeclaration"]))
    .field("modifiers", "?ModifierList", value => nullableWork(value.modifiers, actual => read.work_ModifierList.write(actual)), nullableReader(lazyReader(() => read.work_ModifierList.reader)))
    .field("body", "$Block", value => syntaxReference("$Block", value.body), syntaxReads.Block)
    .field("tsonic", "TypedStaticBlock", value => read.work_TypedStaticBlock.write(value.tsonic), lazyReader(() => read.work_TypedStaticBlock.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_body, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, modifiers: field_modifiers, body: field_body, tsonic: field_tsonic }), (kind, make) => ({ kind,
      value: make(kind),
    })));
  const work_ArrowFunction: (value: ArrowFunction<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ArrowFunction<TypedPhase>>("ArrowFunction", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ArrowFunction", literalReader<(ArrowFunction<TypedPhase>)["kind"]>("'ArrowFunction", ["ArrowFunction"]))
    .field("modifiers", "?ModifierList", value => nullableWork(value.modifiers, actual => read.work_ModifierList.write(actual)), nullableReader(lazyReader(() => read.work_ModifierList.reader)))
    .field("typeParameters", "?L<TypeParameterDeclaration>", value => nullableWork(value.typeParameters, actual => read.work_L_TypeParameterDeclaration_.write(actual)), nullableReader(lazyReader(() => read.work_L_TypeParameterDeclaration_.reader)))
    .field("parameters", "L<ParameterDeclaration>", value => read.work_L_ParameterDeclaration_.write(value.parameters), lazyReader(() => read.work_L_ParameterDeclaration_.reader))
    .field("type", "?$TypeNode", value => nullableWork(value.type, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("fullSignature", "?$TypeNode", value => nullableWork(value.fullSignature, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("asteriskToken", "?$AsteriskToken", value => nullableWork(value.asteriskToken, actual => syntaxReference("$AsteriskToken", actual)), nullableReader(syntaxReads.AsteriskToken))
    .field("body", "?$BlockOrExpression", value => nullableWork(value.body, actual => syntaxReference("$BlockOrExpression", actual)), nullableReader(syntaxReads.BlockOrExpression))
    .field("equalsGreaterThanToken", "$EqualsGreaterThanToken", value => syntaxReference("$EqualsGreaterThanToken", value.equalsGreaterThanToken), syntaxReads.EqualsGreaterThanToken)
    .field("tsonic", "TypedClosure", value => read.work_TypedClosure.write(value.tsonic), lazyReader(() => read.work_TypedClosure.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_typeParameters, field_parameters, field_type, field_fullSignature, field_asteriskToken, field_body, field_equalsGreaterThanToken, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, modifiers: field_modifiers, typeParameters: field_typeParameters, parameters: field_parameters,
      type: field_type, fullSignature: field_fullSignature, asteriskToken: field_asteriskToken, body: field_body,
      equalsGreaterThanToken: field_equalsGreaterThanToken, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_FunctionExpression: (value: FunctionExpression<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<FunctionExpression<TypedPhase>>("FunctionExpression", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'FunctionExpression", literalReader<(FunctionExpression<TypedPhase>)["kind"]>("'FunctionExpression", ["FunctionExpression"]))
    .field("modifiers", "?ModifierList", value => nullableWork(value.modifiers, actual => read.work_ModifierList.write(actual)), nullableReader(lazyReader(() => read.work_ModifierList.reader)))
    .field("typeParameters", "?L<TypeParameterDeclaration>", value => nullableWork(value.typeParameters, actual => read.work_L_TypeParameterDeclaration_.write(actual)), nullableReader(lazyReader(() => read.work_L_TypeParameterDeclaration_.reader)))
    .field("parameters", "L<ParameterDeclaration>", value => read.work_L_ParameterDeclaration_.write(value.parameters), lazyReader(() => read.work_L_ParameterDeclaration_.reader))
    .field("type", "?$TypeNode", value => nullableWork(value.type, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("fullSignature", "?$TypeNode", value => nullableWork(value.fullSignature, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("asteriskToken", "?$AsteriskToken", value => nullableWork(value.asteriskToken, actual => syntaxReference("$AsteriskToken", actual)), nullableReader(syntaxReads.AsteriskToken))
    .field("body", "?$BlockOrExpression", value => nullableWork(value.body, actual => syntaxReference("$BlockOrExpression", actual)), nullableReader(syntaxReads.BlockOrExpression))
    .field("name", "?$Identifier", value => nullableWork(value.name, actual => syntaxReference("$Identifier", actual)), nullableReader(syntaxReads.Identifier))
    .field("tsonic", "TypedClosure", value => read.work_TypedClosure.write(value.tsonic), lazyReader(() => read.work_TypedClosure.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_typeParameters, field_parameters, field_type, field_fullSignature, field_asteriskToken, field_body, field_name, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, modifiers: field_modifiers, typeParameters: field_typeParameters, parameters: field_parameters,
      type: field_type, fullSignature: field_fullSignature, asteriskToken: field_asteriskToken, body: field_body, name: field_name,
      tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_SourceFile: (value: SourceFile<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<SourceFile<TypedPhase>>("SourceFile", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'SourceFile", literalReader<(SourceFile<TypedPhase>)["kind"]>("'SourceFile", ["SourceFile"]))
    .field("statements", "L<Statement>", value => read.work_L_Statement_.write(value.statements), lazyReader(() => read.work_L_Statement_.reader))
    .field("endOfFileToken", "$EndOfFile", value => syntaxReference("$EndOfFile", value.endOfFileToken), syntaxReads.EndOfFile)
    .field("languageVariant", "LanguageVariant", value => scalarWork("LanguageVariant", value.languageVariant), literalReader<(SourceFile<TypedPhase>)["languageVariant"]>("LanguageVariant", ["Standard","JSX"]))
    .field("scriptKind", "ScriptKind", value => scalarWork("ScriptKind", value.scriptKind), literalReader<(SourceFile<TypedPhase>)["scriptKind"]>("ScriptKind", ["Unknown","JS","JSX","TS","TSX","External","JSON","Deferred"]))
    .field("commentDirectives", "[CommentDirective]", value => sequenceWork("[CommentDirective]", value.commentDirectives, actual => read.work_CommentDirective.write(actual)), sequenceReader("[CommentDirective]", lazyReader(() => read.work_CommentDirective.reader)))
    .field("pragmas", "[Pragma]", value => sequenceWork("[Pragma]", value.pragmas, actual => read.work_Pragma.write(actual)), sequenceReader("[Pragma]", lazyReader(() => read.work_Pragma.reader)))
    .field("checkJsDirective", "?CheckJsDirective", value => nullableWork(value.checkJsDirective, actual => read.work_CheckJsDirective.write(actual)), nullableReader(lazyReader(() => read.work_CheckJsDirective.reader)))
    .field("tsonic", "TypedSourceFile", value => read.work_TypedSourceFile.write(value.tsonic), lazyReader(() => read.work_TypedSourceFile.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_statements, field_endOfFileToken, field_languageVariant, field_scriptKind, field_commentDirectives, field_pragmas, field_checkJsDirective, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, statements: field_statements, endOfFileToken: field_endOfFileToken,
      languageVariant: field_languageVariant, scriptKind: field_scriptKind, commentDirectives: field_commentDirectives,
      pragmas: field_pragmas, checkJsDirective: field_checkJsDirective, tsonic: field_tsonic }), (kind, make) => ({ kind,
      value: make(kind),
    })));
  const work_TirResolution: TirRecordCodec<TirResolution> = unionRecord<TirResolution>("TirResolution", (value: TirResolution): TirTypedRecordWork => {
    switch (value.kind) {
      case "local": return work_TirResolution_local.write(value);
      case "definition": return work_TirResolution_definition.write(value);
      case "module": return work_TirResolution_module.write(value);
      case "error": return work_TirResolution_error.write(value);
    }
  }, () => [work_TirResolution_local.reader, work_TirResolution_definition.reader, work_TirResolution_module.reader, work_TirResolution_error.reader]);
  const work_TirArgument: TirRecordCodec<TirArgument> = unionRecord<TirArgument>("TirArgument", (value: TirArgument): TirTypedRecordWork => {
    switch (value.kind) {
      case "provided": return work_TirArgument_provided.write(value);
      case "omitted": return work_TirArgument_omitted.write(value);
      case "rest": return work_TirArgument_rest.write(value);
    }
  }, () => [work_TirArgument_provided.reader, work_TirArgument_omitted.reader, work_TirArgument_rest.reader]);
  const work_OmissionValue: TirRecordCodec<(TirArgument & { readonly kind: "omitted" })["value"]> = unionRecord<(TirArgument & { readonly kind: "omitted" })["value"]>("OmissionValue", (value: (TirArgument & { readonly kind: "omitted" })["value"]): TirTypedRecordWork => {
    switch (value.kind) {
      case "absence": return work_OmissionValue_absence.write(value);
      case "initializer": return work_OmissionValue_initializer.write(value);
      case "empty-rest": return work_OmissionValue_empty_rest.write(value);
    }
  }, () => [work_OmissionValue_absence.reader, work_OmissionValue_initializer.reader, work_OmissionValue_empty_rest.reader]);
  const work_TirRestPart: TirRecordCodec<TirRestPart> = unionRecord<TirRestPart>("TirRestPart", (value: TirRestPart): TirTypedRecordWork => {
    switch (value.kind) {
      case "value": return work_TirRestPart_value.write(value);
      case "spread": return work_TirRestPart_spread.write(value);
    }
  }, () => [work_TirRestPart_value.reader, work_TirRestPart_spread.reader]);
  const work_TirSelection: TirRecordCodec<TirSelection> = unionRecord<TirSelection>("TirSelection", (value: TirSelection): TirTypedRecordWork => {
    switch (value.kind) {
      case "conditional": return work_TirSelection_conditional.write(value);
      case "and": return work_TirSelection_and.write(value);
      case "or": return work_TirSelection_or.write(value);
      case "coalesce": return work_TirSelection_coalesce.write(value);
    }
  }, () => [work_TirSelection_conditional.reader, work_TirSelection_and.reader, work_TirSelection_or.reader, work_TirSelection_coalesce.reader]);
  const work_TirDemand: TirRecordCodec<TirDemand> = unionRecord<TirDemand>("TirDemand", (value: TirDemand): TirTypedRecordWork => {
    switch (value.kind) {
      case "always": return work_TirDemand_always.write(value);
      case "selected": return work_TirDemand_selected.write(value);
      case "never": return work_TirDemand_never.write(value);
    }
  }, () => [work_TirDemand_always.reader, work_TirDemand_selected.reader, work_TirDemand_never.reader]);
  const work_ConversionDecision: TirRecordCodec<ConversionDecision> = unionRecord<ConversionDecision>("ConversionDecision", (value: ConversionDecision): TirTypedRecordWork => {
    switch (value.kind) {
      case "identity": return work_ConversionDecision_identity.write(value);
      case "convert": return work_ConversionDecision_convert.write(value);
      case "deferred": return work_ConversionDecision_deferred.write(value);
    }
  }, () => [work_ConversionDecision_identity.reader, work_ConversionDecision_convert.reader, work_ConversionDecision_deferred.reader]);
  const work_TargetAccess: TirRecordCodec<TargetAccess> = unionRecord<TargetAccess>("TargetAccess", (value: TargetAccess): TirTypedRecordWork => {
    switch (value.kind) {
      case "write": return work_TargetAccess_write.write(value);
      case "read-write": return work_TargetAccess_read_write.write(value);
    }
  }, () => [work_TargetAccess_write.reader, work_TargetAccess_read_write.reader]);
  const work_ModuleBindingTarget: TirRecordCodec<ModuleBindingTarget> = unionRecord<ModuleBindingTarget>("ModuleBindingTarget", (value: ModuleBindingTarget): TirTypedRecordWork => {
    switch (value.kind) {
      case "definition": return work_ModuleBindingTarget_definition.write(value);
      case "module": return work_ModuleBindingTarget_module.write(value);
    }
  }, () => [work_ModuleBindingTarget_definition.reader, work_ModuleBindingTarget_module.reader]);
  const work_O_TypedOperation__decided: TirRecordCodec<RuleOutcome<TypedOperation> & { readonly kind: "decided" }> = defineRecord<RuleOutcome<TypedOperation> & { readonly kind: "decided" }>("O<TypedOperation>#decided", "O<TypedOperation>", { field: "kind", value: "decided" }, "decided", null, null, fields => fields
    .field("decision", "TypedOperation", value => read.work_TypedOperation.write(value.decision), lazyReader(() => read.work_TypedOperation.reader))
    .finish((field_decision) => ({ kind: "decided", decision: field_decision })));
  const work_O_TypedOperation__deferred: TirRecordCodec<RuleOutcome<TypedOperation> & { readonly kind: "deferred" }> = defineRecord<RuleOutcome<TypedOperation> & { readonly kind: "deferred" }>("O<TypedOperation>#deferred", "O<TypedOperation>", { field: "kind", value: "deferred" }, "deferred", null, null, fields => fields
    .field("deferred", "DeferredDecision", value => read.work_DeferredDecision.write(value.deferred), lazyReader(() => read.work_DeferredDecision.reader))
    .finish((field_deferred) => ({ kind: "deferred", deferred: field_deferred })));
  const work_O_TypedOperation_: TirRecordCodec<RuleOutcome<TypedOperation>> = unionRecord<RuleOutcome<TypedOperation>>("O<TypedOperation>", (value: RuleOutcome<TypedOperation>): TirTypedRecordWork => {
    switch (value.kind) {
      case "decided": return work_O_TypedOperation__decided.write(value);
      case "deferred": return work_O_TypedOperation__deferred.write(value);
    }
  }, () => [work_O_TypedOperation__decided.reader, work_O_TypedOperation__deferred.reader]);
  const work_O_MemberSelection__decided: TirRecordCodec<RuleOutcome<MemberSelection> & { readonly kind: "decided" }> = defineRecord<RuleOutcome<MemberSelection> & { readonly kind: "decided" }>("O<MemberSelection>#decided", "O<MemberSelection>", { field: "kind", value: "decided" }, "decided", null, null, fields => fields
    .field("decision", "MemberSelection", value => work_MemberSelection.write(value.decision), lazyReader(() => work_MemberSelection.reader))
    .finish((field_decision) => ({ kind: "decided", decision: field_decision })));
  const work_O_MemberSelection__deferred: TirRecordCodec<RuleOutcome<MemberSelection> & { readonly kind: "deferred" }> = defineRecord<RuleOutcome<MemberSelection> & { readonly kind: "deferred" }>("O<MemberSelection>#deferred", "O<MemberSelection>", { field: "kind", value: "deferred" }, "deferred", null, null, fields => fields
    .field("deferred", "DeferredDecision", value => read.work_DeferredDecision.write(value.deferred), lazyReader(() => read.work_DeferredDecision.reader))
    .finish((field_deferred) => ({ kind: "deferred", deferred: field_deferred })));
  const work_O_MemberSelection_: TirRecordCodec<RuleOutcome<MemberSelection>> = unionRecord<RuleOutcome<MemberSelection>>("O<MemberSelection>", (value: RuleOutcome<MemberSelection>): TirTypedRecordWork => {
    switch (value.kind) {
      case "decided": return work_O_MemberSelection__decided.write(value);
      case "deferred": return work_O_MemberSelection__deferred.write(value);
    }
  }, () => [work_O_MemberSelection__decided.reader, work_O_MemberSelection__deferred.reader]);
  const work_O_TirApplication__decided: TirRecordCodec<RuleOutcome<TirApplication> & { readonly kind: "decided" }> = defineRecord<RuleOutcome<TirApplication> & { readonly kind: "decided" }>("O<TirApplication>#decided", "O<TirApplication>", { field: "kind", value: "decided" }, "decided", null, null, fields => fields
    .field("decision", "TirApplication", value => work_TirApplication.write(value.decision), lazyReader(() => work_TirApplication.reader))
    .finish((field_decision) => ({ kind: "decided", decision: field_decision })));
  const work_O_TirApplication__deferred: TirRecordCodec<RuleOutcome<TirApplication> & { readonly kind: "deferred" }> = defineRecord<RuleOutcome<TirApplication> & { readonly kind: "deferred" }>("O<TirApplication>#deferred", "O<TirApplication>", { field: "kind", value: "deferred" }, "deferred", null, null, fields => fields
    .field("deferred", "DeferredDecision", value => read.work_DeferredDecision.write(value.deferred), lazyReader(() => read.work_DeferredDecision.reader))
    .finish((field_deferred) => ({ kind: "deferred", deferred: field_deferred })));
  const work_O_TirApplication_: TirRecordCodec<RuleOutcome<TirApplication>> = unionRecord<RuleOutcome<TirApplication>>("O<TirApplication>", (value: RuleOutcome<TirApplication>): TirTypedRecordWork => {
    switch (value.kind) {
      case "decided": return work_O_TirApplication__decided.write(value);
      case "deferred": return work_O_TirApplication__deferred.write(value);
    }
  }, () => [work_O_TirApplication__decided.reader, work_O_TirApplication__deferred.reader]);
  const work_O_TirProtocol__decided: TirRecordCodec<RuleOutcome<TirProtocol> & { readonly kind: "decided" }> = defineRecord<RuleOutcome<TirProtocol> & { readonly kind: "decided" }>("O<TirProtocol>#decided", "O<TirProtocol>", { field: "kind", value: "decided" }, "decided", null, null, fields => fields
    .field("decision", "TirProtocol", value => work_TirProtocol.write(value.decision), lazyReader(() => work_TirProtocol.reader))
    .finish((field_decision) => ({ kind: "decided", decision: field_decision })));
  const work_O_TirProtocol__deferred: TirRecordCodec<RuleOutcome<TirProtocol> & { readonly kind: "deferred" }> = defineRecord<RuleOutcome<TirProtocol> & { readonly kind: "deferred" }>("O<TirProtocol>#deferred", "O<TirProtocol>", { field: "kind", value: "deferred" }, "deferred", null, null, fields => fields
    .field("deferred", "DeferredDecision", value => read.work_DeferredDecision.write(value.deferred), lazyReader(() => read.work_DeferredDecision.reader))
    .finish((field_deferred) => ({ kind: "deferred", deferred: field_deferred })));
  const work_O_TirProtocol_: TirRecordCodec<RuleOutcome<TirProtocol>> = unionRecord<RuleOutcome<TirProtocol>>("O<TirProtocol>", (value: RuleOutcome<TirProtocol>): TirTypedRecordWork => {
    switch (value.kind) {
      case "decided": return work_O_TirProtocol__decided.write(value);
      case "deferred": return work_O_TirProtocol__deferred.write(value);
    }
  }, () => [work_O_TirProtocol__decided.reader, work_O_TirProtocol__deferred.reader]);
  const work_O_ApplicationDecision__decided: TirRecordCodec<RuleOutcome<ApplicationDecision> & { readonly kind: "decided" }> = defineRecord<RuleOutcome<ApplicationDecision> & { readonly kind: "decided" }>("O<ApplicationDecision>#decided", "O<ApplicationDecision>", { field: "kind", value: "decided" }, "decided", null, null, fields => fields
    .field("decision", "ApplicationDecision", value => read.work_ApplicationDecision.write(value.decision), lazyReader(() => read.work_ApplicationDecision.reader))
    .finish((field_decision) => ({ kind: "decided", decision: field_decision })));
  const work_O_ApplicationDecision__deferred: TirRecordCodec<RuleOutcome<ApplicationDecision> & { readonly kind: "deferred" }> = defineRecord<RuleOutcome<ApplicationDecision> & { readonly kind: "deferred" }>("O<ApplicationDecision>#deferred", "O<ApplicationDecision>", { field: "kind", value: "deferred" }, "deferred", null, null, fields => fields
    .field("deferred", "DeferredDecision", value => read.work_DeferredDecision.write(value.deferred), lazyReader(() => read.work_DeferredDecision.reader))
    .finish((field_deferred) => ({ kind: "deferred", deferred: field_deferred })));
  const work_O_ApplicationDecision_: TirRecordCodec<RuleOutcome<ApplicationDecision>> = unionRecord<RuleOutcome<ApplicationDecision>>("O<ApplicationDecision>", (value: RuleOutcome<ApplicationDecision>): TirTypedRecordWork => {
    switch (value.kind) {
      case "decided": return work_O_ApplicationDecision__decided.write(value);
      case "deferred": return work_O_ApplicationDecision__deferred.write(value);
    }
  }, () => [work_O_ApplicationDecision__decided.reader, work_O_ApplicationDecision__deferred.reader]);
  return { work_TirBody, work_TirParam, work_TirLocal, work_TirResolution_local, work_TirResolution_definition, work_TirResolution_module, work_TirResolution_error, work_ResolvedCallee, work_MemberSelection, work_TirArgument_provided, work_TirArgument_omitted, work_TirArgument_rest, work_OmissionValue_absence, work_OmissionValue_initializer, work_OmissionValue_empty_rest, work_TirRestPart_value, work_TirRestPart_spread, work_TirApplication, work_TirProtocolStep, work_TirProtocol, work_TirSelection_conditional, work_TirSelection_and, work_TirSelection_or, work_TirSelection_coalesce, work_TirDemand_always, work_TirDemand_selected, work_TirDemand_never, work_ConversionDecision_identity, work_ConversionDecision_convert, work_ConversionDecision_deferred, work_TargetAccess_write, work_TargetAccess_read_write, work_ModuleBindingTarget_definition, work_ModuleBindingTarget_module, work_Block, work_FunctionDeclaration, work_ConstructorDeclaration, work_GetAccessorDeclaration, work_SetAccessorDeclaration, work_MethodDeclaration, work_ClassStaticBlockDeclaration, work_ArrowFunction, work_FunctionExpression, work_SourceFile, work_TirResolution, work_TirArgument, work_OmissionValue, work_TirRestPart, work_TirSelection, work_TirDemand, work_ConversionDecision, work_TargetAccess, work_ModuleBindingTarget, work_O_TypedOperation__decided, work_O_TypedOperation__deferred, work_O_TypedOperation_, work_O_MemberSelection__decided, work_O_MemberSelection__deferred, work_O_MemberSelection_, work_O_TirApplication__decided, work_O_TirApplication__deferred, work_O_TirApplication_, work_O_TirProtocol__decided, work_O_TirProtocol__deferred, work_O_TirProtocol_, work_O_ApplicationDecision__decided, work_O_ApplicationDecision__deferred, work_O_ApplicationDecision_ };
};
