import { lazyReader, literalReader, nullableReader, sequenceReader } from "./text-construction.js";
import { unionRecord } from "./text-layouts.js";
import type { TirRecordCodec } from "./text-layouts.js";
import type {
  BindingVector, MemberKey, MemberOrigin, TypeComponent, TypeEvidence
} from "../ir-types/contract.js";
import type {
  NodeRef
} from "../ids/contract.js";
import type {
  HirCallableEndpoint
} from "../ir-hir/contract.js";
import type {
  AccessLocation, ApplicationDecision, LogicalCapture, CheckRequirement, ClosureDecision, CompletionEndpoint, ConstructionPartDecision, OperationExecution, CorrespondenceStep, EmbeddingDecision, EmbeddingProof, LiteralConstructionPart, MemberDecision, OperationDecision, OperationIdentity, ParameterMapping, ProtocolStepDecision, ProtocolStepOperation, RefinementDecision
} from "../ir-infer/contract.js";
import type { TirTextKernel, TirTypedRecordWork } from "./text-layouts.js";
import { scalarWork, referenceWork, nullableWork, sequenceWork, withBindingOwner } from "./text-layouts.js";

export interface RuleDecisionsTextReads {
  readonly work_BindingVector: TirRecordCodec<BindingVector>;
  readonly work_CorrespondenceStep: TirRecordCodec<CorrespondenceStep>;
  readonly work_HirCallableEndpoint: TirRecordCodec<HirCallableEndpoint>;
  readonly work_MemberKey: TirRecordCodec<MemberKey>;
  readonly work_MemberOrigin: TirRecordCodec<MemberOrigin>;
  readonly work_NodeRef: TirRecordCodec<NodeRef>;
  readonly work_OperationIdentity: TirRecordCodec<OperationIdentity>;
  readonly work_TypeComponent: TirRecordCodec<TypeComponent>;
  readonly work_TypeEvidence: TirRecordCodec<TypeEvidence>;
}

export interface RuleDecisionsTextModel {
  readonly work_ClosureDecision: TirRecordCodec<ClosureDecision>;
  readonly work_OperationDecision: TirRecordCodec<OperationDecision>;
  readonly work_ConstructionPartDecision: TirRecordCodec<ConstructionPartDecision>;
  readonly work_ProtocolStepDecision: TirRecordCodec<ProtocolStepDecision>;
  readonly work_ProtocolStepOperation_call: TirRecordCodec<ProtocolStepOperation & { readonly kind: "call" }>;
  readonly work_ProtocolStepOperation_core: TirRecordCodec<ProtocolStepOperation & { readonly kind: "core" }>;
  readonly work_ProtocolStepOperation_completion: TirRecordCodec<ProtocolStepOperation & { readonly kind: "completion" }>;
  readonly work_EmbeddingDecision_identity: TirRecordCodec<EmbeddingDecision & { readonly kind: "identity" }>;
  readonly work_EmbeddingDecision_conversion: TirRecordCodec<EmbeddingDecision & { readonly kind: "conversion" }>;
  readonly work_EmbeddingDecision_refused: TirRecordCodec<EmbeddingDecision & { readonly kind: "refused" }>;
  readonly work_EmbeddingProof: TirRecordCodec<EmbeddingProof>;
  readonly work_RefinementDecision_identity: TirRecordCodec<RefinementDecision & { readonly kind: "identity" }>;
  readonly work_RefinementDecision_narrowed: TirRecordCodec<RefinementDecision & { readonly kind: "narrowed" }>;
  readonly work_MemberDecision: TirRecordCodec<MemberDecision>;
  readonly work_ApplicationDecision: TirRecordCodec<ApplicationDecision>;
  readonly work_ParameterMapping_argument: TirRecordCodec<ParameterMapping & { readonly kind: "argument" }>;
  readonly work_ParameterMapping_default: TirRecordCodec<ParameterMapping & { readonly kind: "default" }>;
  readonly work_ParameterMapping_omitted: TirRecordCodec<ParameterMapping & { readonly kind: "omitted" }>;
  readonly work_ParameterMapping_rest: TirRecordCodec<ParameterMapping & { readonly kind: "rest" }>;
  readonly work_CompletionEndpoint: TirRecordCodec<CompletionEndpoint>;
  readonly work_LiteralConstructionPart_element: TirRecordCodec<LiteralConstructionPart & { readonly kind: "element" }>;
  readonly work_LiteralConstructionPart_property: TirRecordCodec<LiteralConstructionPart & { readonly kind: "property" }>;
  readonly work_LiteralConstructionPart_spread: TirRecordCodec<LiteralConstructionPart & { readonly kind: "spread" }>;
  readonly work_ProtocolStepOperation: TirRecordCodec<ProtocolStepOperation>;
  readonly work_EmbeddingDecision: TirRecordCodec<EmbeddingDecision>;
  readonly work_RefinementDecision: TirRecordCodec<RefinementDecision>;
  readonly work_ParameterMapping: TirRecordCodec<ParameterMapping>;
  readonly work_LiteralConstructionPart: TirRecordCodec<LiteralConstructionPart>;
}

export const createRuleDecisionsText = (kernel: TirTextKernel, read: RuleDecisionsTextReads): RuleDecisionsTextModel => {
  const { defineRecord, bodyReader, booleanReader, definitionReader, numberReader, signatureReader, typeReader } = kernel;
  const work_CheckRequirement_none: TirRecordCodec<CheckRequirement & { readonly kind: "none" }> = defineRecord<CheckRequirement & { readonly kind: "none" }>("CheckRequirement#none", "CheckRequirement", { field: "kind", value: "none" }, "none", null, null, fields => fields
    .finish(() => ({ kind: "none" })));
  const work_CheckRequirement_required: TirRecordCodec<CheckRequirement & { readonly kind: "required" }> = defineRecord<CheckRequirement & { readonly kind: "required" }>("CheckRequirement#required", "CheckRequirement", { field: "kind", value: "required" }, "required", null, null, fields => fields
    .field("failure", "CheckFailure", value => scalarWork("CheckFailure", value.failure), literalReader<(CheckRequirement & { readonly kind: "required" })["failure"]>("CheckFailure", ["unwind","abort"]))
    .finish((field_failure) => ({ kind: "required", failure: field_failure })));
  const work_CheckRequirement: TirRecordCodec<CheckRequirement> = unionRecord<CheckRequirement>("CheckRequirement", (value: CheckRequirement): TirTypedRecordWork => {
    switch (value.kind) {
      case "none": return work_CheckRequirement_none.write(value);
      case "required": return work_CheckRequirement_required.write(value);
    }
  }, () => [work_CheckRequirement_none.reader, work_CheckRequirement_required.reader]);
  const work_AccessLocation_data: TirRecordCodec<AccessLocation & { readonly kind: "data" }> = defineRecord<AccessLocation & { readonly kind: "data" }>("AccessLocation#data", "AccessLocation", { field: "kind", value: "data" }, "data", null, null, fields => fields
    .field("check", "CheckRequirement", value => work_CheckRequirement.write(value.check), lazyReader(() => work_CheckRequirement.reader))
    .field("receiver", "ReceiverAccess", value => scalarWork("ReceiverAccess", value.receiver), literalReader<(AccessLocation & { readonly kind: "data" })["receiver"]>("ReceiverAccess", ["in-place","by-reference"]))
    .finish((field_check, field_receiver) => ({ kind: "data", check: field_check, receiver: field_receiver })));
  const work_AccessLocation_accessor: TirRecordCodec<AccessLocation & { readonly kind: "accessor" }> = defineRecord<AccessLocation & { readonly kind: "accessor" }>("AccessLocation#accessor", "AccessLocation", { field: "kind", value: "accessor" }, "accessor", null, null, fields => fields
    .finish(() => ({ kind: "accessor" })));
  const work_AccessLocation: TirRecordCodec<AccessLocation> = unionRecord<AccessLocation>("AccessLocation", (value: AccessLocation): TirTypedRecordWork => {
    switch (value.kind) {
      case "data": return work_AccessLocation_data.write(value);
      case "accessor": return work_AccessLocation_accessor.write(value);
    }
  }, () => [work_AccessLocation_data.reader, work_AccessLocation_accessor.reader]);
  const work_OperationExecution_pure: TirRecordCodec<OperationExecution & { readonly kind: "pure" }> = defineRecord<OperationExecution & { readonly kind: "pure" }>("OperationExecution#pure", "OperationExecution", { field: "kind", value: "pure" }, "pure", null, null, fields => fields
    .finish(() => ({ kind: "pure" })));
  const work_OperationExecution_invocation: TirRecordCodec<OperationExecution & { readonly kind: "invocation" }> = defineRecord<OperationExecution & { readonly kind: "invocation" }>("OperationExecution#invocation", "OperationExecution", { field: "kind", value: "invocation" }, "invocation", null, null, fields => fields
    .field("writesStorage", "boolean", value => scalarWork("boolean", value.writesStorage), booleanReader)
    .field("failure", "FailureKind", value => scalarWork("FailureKind", value.failure), literalReader<(OperationExecution & { readonly kind: "invocation" })["failure"]>("FailureKind", ["none","unwind","abort"]))
    .finish((field_writesStorage, field_failure) => ({ kind: "invocation", writesStorage: field_writesStorage, failure: field_failure })));
  const work_OperationExecution: TirRecordCodec<OperationExecution> = unionRecord<OperationExecution>("OperationExecution", (value: OperationExecution): TirTypedRecordWork => {
    switch (value.kind) {
      case "pure": return work_OperationExecution_pure.write(value);
      case "invocation": return work_OperationExecution_invocation.write(value);
    }
  }, () => [work_OperationExecution_pure.reader, work_OperationExecution_invocation.reader]);
  const work_OperationDecision: TirRecordCodec<OperationDecision> = defineRecord<OperationDecision>("OperationDecision", "OperationDecision", { field: "kind", value: "selected" }, "selected", null, null, fields => fields
    .field("operation", "OperationIdentity", value => read.work_OperationIdentity.write(value.operation), lazyReader(() => read.work_OperationIdentity.reader))
    .field("operands", "[t]", value => sequenceWork("[t]", value.operands, actual => referenceWork("t", actual)), sequenceReader("[t]", typeReader))
    .field("result", "t", value => referenceWork("t", value.result), typeReader)
    .field("execution", "OperationExecution", value => work_OperationExecution.write(value.execution), lazyReader(() => work_OperationExecution.reader))
    .finish((field_operation, field_operands, field_result, field_execution) => ({ kind: "selected", operation: field_operation, operands: field_operands, result: field_result, execution: field_execution })));
  const work_ConstructionPartDecision: TirRecordCodec<ConstructionPartDecision> = defineRecord<ConstructionPartDecision>("ConstructionPartDecision", "ConstructionPartDecision", null, "ConstructionPartDecision", null, value => ({ kind: "construction-part", value }), fields => fields
    .field("part", "number", value => scalarWork("number", value.part), numberReader)
    .field("source", "NodeRef", value => read.work_NodeRef.write(value.source), lazyReader(() => read.work_NodeRef.reader))
    .field("destination", "TypeComponent", value => read.work_TypeComponent.write(value.destination), lazyReader(() => read.work_TypeComponent.reader))
    .field("member", "?MemberDecision", value => nullableWork(value.member, actual => work_MemberDecision.write(actual)), nullableReader(lazyReader(() => work_MemberDecision.reader)))
    .field("embedding", "EmbeddingDecision", value => work_EmbeddingDecision.write(value.embedding), lazyReader(() => work_EmbeddingDecision.reader))
    .finish((field_part, field_source, field_destination, field_member, field_embedding) => ({ part: field_part, source: field_source, destination: field_destination, member: field_member, embedding: field_embedding })));
  const work_ProtocolStepDecision: TirRecordCodec<ProtocolStepDecision> = defineRecord<ProtocolStepDecision>("ProtocolStepDecision", "ProtocolStepDecision", null, "ProtocolStepDecision", null, null, fields => fields
    .field("role", "ProtocolStepRole", value => scalarWork("ProtocolStepRole", value.role), literalReader<(ProtocolStepDecision)["role"]>("ProtocolStepRole", ["acquire","next","done","value","finish","fail","await","dispose","completion"]))
    .field("operation", "ProtocolStepOperation", value => work_ProtocolStepOperation.write(value.operation), lazyReader(() => work_ProtocolStepOperation.reader))
    .field("operands", "[t]", value => sequenceWork("[t]", value.operands, actual => referenceWork("t", actual)), sequenceReader("[t]", typeReader))
    .field("result", "t", value => referenceWork("t", value.result), typeReader)
    .finish((field_role, field_operation, field_operands, field_result) => ({ role: field_role, operation: field_operation, operands: field_operands, result: field_result })));
  const work_ProtocolStepOperation_call: TirRecordCodec<ProtocolStepOperation & { readonly kind: "call" }> = defineRecord<ProtocolStepOperation & { readonly kind: "call" }>("ProtocolStepOperation#call", "ProtocolStepOperation", { field: "kind", value: "call" }, "call", null, null, fields => fields
    .field("application", "ApplicationDecision", value => work_ApplicationDecision.write(value.application), lazyReader(() => work_ApplicationDecision.reader))
    .finish((field_application) => ({ kind: "call", application: field_application })));
  const work_ProtocolStepOperation_core: TirRecordCodec<ProtocolStepOperation & { readonly kind: "core" }> = defineRecord<ProtocolStepOperation & { readonly kind: "core" }>("ProtocolStepOperation#core", "ProtocolStepOperation", { field: "kind", value: "core" }, "core", null, null, fields => fields
    .field("declaration", "def", value => referenceWork("def", value.declaration), definitionReader)
    .field("bindings", "BindingVector", value => withBindingOwner(read.work_BindingVector.write(value.bindings), value.declaration), lazyReader(() => read.work_BindingVector.reader))
    .finish((field_declaration, field_bindings) => ({ kind: "core", declaration: field_declaration, bindings: field_bindings })));
  const work_ProtocolStepOperation_completion: TirRecordCodec<ProtocolStepOperation & { readonly kind: "completion" }> = defineRecord<ProtocolStepOperation & { readonly kind: "completion" }>("ProtocolStepOperation#completion", "ProtocolStepOperation", { field: "kind", value: "completion" }, "completion", null, null, fields => fields
    .finish(() => ({ kind: "completion" })));
  const work_EmbeddingDecision_identity: TirRecordCodec<EmbeddingDecision & { readonly kind: "identity" }> = defineRecord<EmbeddingDecision & { readonly kind: "identity" }>("EmbeddingDecision#identity", "EmbeddingDecision", { field: "kind", value: "identity" }, "identity", null, null, fields => fields
    .finish(() => ({ kind: "identity" })));
  const work_EmbeddingDecision_conversion: TirRecordCodec<EmbeddingDecision & { readonly kind: "conversion" }> = defineRecord<EmbeddingDecision & { readonly kind: "conversion" }>("EmbeddingDecision#conversion", "EmbeddingDecision", { field: "kind", value: "conversion" }, "conversion", null, null, fields => fields
    .field("conversion", "ConversionKind", value => scalarWork("ConversionKind", value.conversion), literalReader<(EmbeddingDecision & { readonly kind: "conversion" })["conversion"]>("ConversionKind", ["numeric","literal-fit","absence","union-injection","shape","callable","readonly"]))
    .field("proof", "EmbeddingProof", value => work_EmbeddingProof.write(value.proof), lazyReader(() => work_EmbeddingProof.reader))
    .field("check", "CheckRequirement", value => work_CheckRequirement.write(value.check), lazyReader(() => work_CheckRequirement.reader))
    .finish((field_conversion, field_proof, field_check) => ({ kind: "conversion", conversion: field_conversion, proof: field_proof, check: field_check })));
  const work_EmbeddingDecision_refused: TirRecordCodec<EmbeddingDecision & { readonly kind: "refused" }> = defineRecord<EmbeddingDecision & { readonly kind: "refused" }>("EmbeddingDecision#refused", "EmbeddingDecision", { field: "kind", value: "refused" }, "refused", null, null, fields => fields
    .field("reason", "EmbeddingRefusal", value => scalarWork("EmbeddingRefusal", value.reason), literalReader<(EmbeddingDecision & { readonly kind: "refused" })["reason"]>("EmbeddingRefusal", ["incompatible-domain","lossy-numeric","missing-correspondence","passing-mode","rigid-parameter"]))
    .finish((field_reason) => ({ kind: "refused", reason: field_reason })));
  const work_EmbeddingProof: TirRecordCodec<EmbeddingProof> = defineRecord<EmbeddingProof>("EmbeddingProof", "EmbeddingProof", null, "EmbeddingProof", null, null, fields => fields
    .field("steps", "[CorrespondenceStep]", value => sequenceWork("[CorrespondenceStep]", value.steps, actual => read.work_CorrespondenceStep.write(actual)), sequenceReader("[CorrespondenceStep]", lazyReader(() => read.work_CorrespondenceStep.reader)))
    .field("conclusion", "number", value => scalarWork("number", value.conclusion), numberReader)
    .finish((field_steps, field_conclusion) => ({ steps: field_steps, conclusion: field_conclusion })));
  const work_RefinementDecision_identity: TirRecordCodec<RefinementDecision & { readonly kind: "identity" }> = defineRecord<RefinementDecision & { readonly kind: "identity" }>("RefinementDecision#identity", "RefinementDecision", { field: "kind", value: "identity" }, "identity", null, null, fields => fields
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .finish((field_type) => ({ kind: "identity", type: field_type })));
  const work_RefinementDecision_narrowed: TirRecordCodec<RefinementDecision & { readonly kind: "narrowed" }> = defineRecord<RefinementDecision & { readonly kind: "narrowed" }>("RefinementDecision#narrowed", "RefinementDecision", { field: "kind", value: "narrowed" }, "narrowed", null, null, fields => fields
    .field("source", "t", value => referenceWork("t", value.source), typeReader)
    .field("result", "t", value => referenceWork("t", value.result), typeReader)
    .field("proof", "EmbeddingProof", value => work_EmbeddingProof.write(value.proof), lazyReader(() => work_EmbeddingProof.reader))
    .field("failure", "CheckFailure", value => scalarWork("CheckFailure", value.failure), literalReader<(RefinementDecision & { readonly kind: "narrowed" })["failure"]>("CheckFailure", ["unwind","abort"]))
    .finish((field_source, field_result, field_proof, field_failure) => ({ kind: "narrowed", source: field_source, result: field_result, proof: field_proof, failure: field_failure })));
  const work_MemberDecision: TirRecordCodec<MemberDecision> = defineRecord<MemberDecision>("MemberDecision", "MemberDecision", null, "MemberDecision", null, null, fields => fields
    .field("key", "MemberKey", value => read.work_MemberKey.write(value.key), lazyReader(() => read.work_MemberKey.reader))
    .field("origins", "[MemberOrigin]", value => sequenceWork("[MemberOrigin]", value.origins, actual => read.work_MemberOrigin.write(actual)), sequenceReader("[MemberOrigin]", lazyReader(() => read.work_MemberOrigin.reader)))
    .field("selectedDeclarations", "[def]", value => sequenceWork("[def]", value.selectedDeclarations, actual => referenceWork("def", actual)), sequenceReader("[def]", definitionReader))
    .field("primary", "?def", value => nullableWork(value.primary, actual => referenceWork("def", actual)), nullableReader(definitionReader))
    .field("read", "?t", value => nullableWork(value.read, actual => referenceWork("t", actual)), nullableReader(typeReader))
    .field("write", "?t", value => nullableWork(value.write, actual => referenceWork("t", actual)), nullableReader(typeReader))
    .field("getter", "?HirCallableEndpoint", value => nullableWork(value.getter, actual => read.work_HirCallableEndpoint.write(actual)), nullableReader(lazyReader(() => read.work_HirCallableEndpoint.reader)))
    .field("setter", "?HirCallableEndpoint", value => nullableWork(value.setter, actual => read.work_HirCallableEndpoint.write(actual)), nullableReader(lazyReader(() => read.work_HirCallableEndpoint.reader)))
    .field("bindings", "BindingVector", value => withBindingOwner(read.work_BindingVector.write(value.bindings), value.primary), lazyReader(() => read.work_BindingVector.reader))
    .field("location", "AccessLocation", value => work_AccessLocation.write(value.location), lazyReader(() => work_AccessLocation.reader))
    .finish((field_key, field_origins, field_selectedDeclarations, field_primary, field_read, field_write, field_getter, field_setter, field_bindings, field_location) => ({
      key: field_key, origins: field_origins, selectedDeclarations: field_selectedDeclarations, primary: field_primary,
      read: field_read, write: field_write, getter: field_getter, setter: field_setter, bindings: field_bindings,
      location: field_location,
    })));
  const work_ApplicationDecision: TirRecordCodec<ApplicationDecision> = defineRecord<ApplicationDecision>("ApplicationDecision", "ApplicationDecision", null, "ApplicationDecision", null, null, fields => fields
    .field("candidate", "number", value => scalarWork("number", value.candidate), numberReader)
    .field("advertised", "HirCallableEndpoint", value => read.work_HirCallableEndpoint.write(value.advertised), lazyReader(() => read.work_HirCallableEndpoint.reader))
    .field("api", "HirCallableEndpoint", value => read.work_HirCallableEndpoint.write(value.api), lazyReader(() => read.work_HirCallableEndpoint.reader))
    .field("bindings", "BindingVector", value => withBindingOwner(read.work_BindingVector.write(value.bindings), value.advertised.declaration), lazyReader(() => read.work_BindingVector.reader))
    .field("implementationBindings", "BindingVector", value => withBindingOwner(read.work_BindingVector.write(value.implementationBindings), value.api.declaration), lazyReader(() => read.work_BindingVector.reader))
    .field("parameters", "[ParameterMapping]", value => sequenceWork("[ParameterMapping]", value.parameters, actual => work_ParameterMapping.write(actual)), sequenceReader("[ParameterMapping]", lazyReader(() => work_ParameterMapping.reader)))
    .field("completion", "CompletionEndpoint", value => work_CompletionEndpoint.write(value.completion), lazyReader(() => work_CompletionEndpoint.reader))
    .field("result", "t", value => referenceWork("t", value.result), typeReader)
    .field("activation", "?HandleActivation", value => nullableWork(value.activation, actual => scalarWork("HandleActivation", actual)), nullableReader(literalReader<NonNullable<(ApplicationDecision)["activation"]>>("HandleActivation", ["at-creation","when-first-driven"])))
    .finish((field_candidate, field_advertised, field_api, field_bindings, field_implementationBindings, field_parameters, field_completion, field_result, field_activation) => ({
      candidate: field_candidate, advertised: field_advertised, api: field_api, bindings: field_bindings,
      implementationBindings: field_implementationBindings, parameters: field_parameters, completion: field_completion,
      result: field_result, activation: field_activation,
    })));
  const work_ParameterMapping_argument: TirRecordCodec<ParameterMapping & { readonly kind: "argument" }> = defineRecord<ParameterMapping & { readonly kind: "argument" }>("ParameterMapping#argument", "ParameterMapping", { field: "kind", value: "argument" }, "argument", null, null, fields => fields
    .field("parameter", "number", value => scalarWork("number", value.parameter), numberReader)
    .field("argument", "number", value => scalarWork("number", value.argument), numberReader)
    .field("component", "?number", value => nullableWork(value.component, actual => scalarWork("number", actual)), nullableReader(numberReader))
    .field("passing", "PassingMode", value => scalarWork("PassingMode", value.passing), literalReader<(ParameterMapping & { readonly kind: "argument" })["passing"]>("PassingMode", ["by-value","byref-readonly","byref-readwrite","byref-writeonly-must-init","borrow-shared","borrow-mut","move"]))
    .finish((field_parameter, field_argument, field_component, field_passing) => ({ kind: "argument", parameter: field_parameter, argument: field_argument, component: field_component, passing: field_passing })));
  const work_ParameterMapping_default: TirRecordCodec<ParameterMapping & { readonly kind: "default" }> = defineRecord<ParameterMapping & { readonly kind: "default" }>("ParameterMapping#default", "ParameterMapping", { field: "kind", value: "default" }, "default", null, null, fields => fields
    .field("parameter", "number", value => scalarWork("number", value.parameter), numberReader)
    .field("initializer", "body", value => scalarWork("body", value.initializer), bodyReader)
    .finish((field_parameter, field_initializer) => ({ kind: "default", parameter: field_parameter, initializer: field_initializer })));
  const work_ParameterMapping_omitted: TirRecordCodec<ParameterMapping & { readonly kind: "omitted" }> = defineRecord<ParameterMapping & { readonly kind: "omitted" }>("ParameterMapping#omitted", "ParameterMapping", { field: "kind", value: "omitted" }, "omitted", null, null, fields => fields
    .field("parameter", "number", value => scalarWork("number", value.parameter), numberReader)
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .finish((field_parameter, field_type) => ({ kind: "omitted", parameter: field_parameter, type: field_type })));
  const work_ParameterMapping_rest: TirRecordCodec<ParameterMapping & { readonly kind: "rest" }> = defineRecord<ParameterMapping & { readonly kind: "rest" }>("ParameterMapping#rest", "ParameterMapping", { field: "kind", value: "rest" }, "rest", null, null, fields => fields
    .field("parameter", "number", value => scalarWork("number", value.parameter), numberReader)
    .field("arguments", "[number]", value => sequenceWork("[number]", value.arguments, actual => scalarWork("number", actual)), sequenceReader("[number]", numberReader))
    .field("passing", "PassingMode", value => scalarWork("PassingMode", value.passing), literalReader<(ParameterMapping & { readonly kind: "rest" })["passing"]>("PassingMode", ["by-value","byref-readonly","byref-readwrite","byref-writeonly-must-init","borrow-shared","borrow-mut","move"]))
    .finish((field_parameter, field_arguments, field_passing) => ({ kind: "rest", parameter: field_parameter, arguments: field_arguments, passing: field_passing })));
  const work_CompletionEndpoint: TirRecordCodec<CompletionEndpoint> = defineRecord<CompletionEndpoint>("CompletionEndpoint", "CompletionEndpoint", null, "CompletionEndpoint", null, null, fields => fields
    .field("signature", "sig", value => referenceWork("sig", value.signature), signatureReader)
    .field("completion", "t", value => referenceWork("t", value.completion), typeReader)
    .field("yielded", "?t", value => nullableWork(value.yielded, actual => referenceWork("t", actual)), nullableReader(typeReader))
    .field("sent", "?t", value => nullableWork(value.sent, actual => referenceWork("t", actual)), nullableReader(typeReader))
    .finish((field_signature, field_completion, field_yielded, field_sent) => ({ signature: field_signature, completion: field_completion, yielded: field_yielded, sent: field_sent })));
  const work_LiteralConstructionPart_element: TirRecordCodec<LiteralConstructionPart & { readonly kind: "element" }> = defineRecord<LiteralConstructionPart & { readonly kind: "element" }>("LiteralConstructionPart#element", "LiteralConstructionPart", { field: "kind", value: "element" }, "element", null, null, fields => fields
    .field("occurrence", "NodeRef", value => read.work_NodeRef.write(value.occurrence), lazyReader(() => read.work_NodeRef.reader))
    .field("value", "TypeEvidence", value => read.work_TypeEvidence.write(value.value), lazyReader(() => read.work_TypeEvidence.reader))
    .finish((field_occurrence, field_value) => ({ kind: "element", occurrence: field_occurrence, value: field_value })));
  const work_LiteralConstructionPart_property: TirRecordCodec<LiteralConstructionPart & { readonly kind: "property" }> = defineRecord<LiteralConstructionPart & { readonly kind: "property" }>("LiteralConstructionPart#property", "LiteralConstructionPart", { field: "kind", value: "property" }, "property", null, null, fields => fields
    .field("occurrence", "NodeRef", value => read.work_NodeRef.write(value.occurrence), lazyReader(() => read.work_NodeRef.reader))
    .field("key", "MemberKey", value => read.work_MemberKey.write(value.key), lazyReader(() => read.work_MemberKey.reader))
    .field("value", "TypeEvidence", value => read.work_TypeEvidence.write(value.value), lazyReader(() => read.work_TypeEvidence.reader))
    .finish((field_occurrence, field_key, field_value) => ({ kind: "property", occurrence: field_occurrence, key: field_key, value: field_value })));
  const work_LiteralConstructionPart_spread: TirRecordCodec<LiteralConstructionPart & { readonly kind: "spread" }> = defineRecord<LiteralConstructionPart & { readonly kind: "spread" }>("LiteralConstructionPart#spread", "LiteralConstructionPart", { field: "kind", value: "spread" }, "spread", null, null, fields => fields
    .field("occurrence", "NodeRef", value => read.work_NodeRef.write(value.occurrence), lazyReader(() => read.work_NodeRef.reader))
    .field("value", "TypeEvidence", value => read.work_TypeEvidence.write(value.value), lazyReader(() => read.work_TypeEvidence.reader))
    .finish((field_occurrence, field_value) => ({ kind: "spread", occurrence: field_occurrence, value: field_value })));
  const work_ClosureDecision: TirRecordCodec<ClosureDecision> = defineRecord<ClosureDecision>("ClosureDecision", "ClosureDecision", null, "ClosureDecision", null, null, fields => fields
    .field("carrier", "t", value => referenceWork("t", value.carrier), typeReader)
    .field("captures", "[LogicalCapture]", value => sequenceWork("[LogicalCapture]", value.captures, actual => scalarWork("LogicalCapture", actual)), sequenceReader("[LogicalCapture]", literalReader<LogicalCapture>("LogicalCapture", ["captured-value","captured-location"])))
    .field("execution", "OperationExecution", value => work_OperationExecution.write(value.execution), lazyReader(() => work_OperationExecution.reader))
    .finish((field_carrier, field_captures, field_execution) => ({ carrier: field_carrier, captures: field_captures, execution: field_execution })));
  const work_ProtocolStepOperation: TirRecordCodec<ProtocolStepOperation> = unionRecord<ProtocolStepOperation>("ProtocolStepOperation", (value: ProtocolStepOperation): TirTypedRecordWork => {
    switch (value.kind) {
      case "call": return work_ProtocolStepOperation_call.write(value);
      case "core": return work_ProtocolStepOperation_core.write(value);
      case "completion": return work_ProtocolStepOperation_completion.write(value);
    }
  }, () => [work_ProtocolStepOperation_call.reader, work_ProtocolStepOperation_core.reader, work_ProtocolStepOperation_completion.reader]);
  const work_EmbeddingDecision: TirRecordCodec<EmbeddingDecision> = unionRecord<EmbeddingDecision>("EmbeddingDecision", (value: EmbeddingDecision): TirTypedRecordWork => {
    switch (value.kind) {
      case "identity": return work_EmbeddingDecision_identity.write(value);
      case "conversion": return work_EmbeddingDecision_conversion.write(value);
      case "refused": return work_EmbeddingDecision_refused.write(value);
    }
  }, () => [work_EmbeddingDecision_identity.reader, work_EmbeddingDecision_conversion.reader, work_EmbeddingDecision_refused.reader]);
  const work_RefinementDecision: TirRecordCodec<RefinementDecision> = unionRecord<RefinementDecision>("RefinementDecision", (value: RefinementDecision): TirTypedRecordWork => {
    switch (value.kind) {
      case "identity": return work_RefinementDecision_identity.write(value);
      case "narrowed": return work_RefinementDecision_narrowed.write(value);
    }
  }, () => [work_RefinementDecision_identity.reader, work_RefinementDecision_narrowed.reader]);
  const work_ParameterMapping: TirRecordCodec<ParameterMapping> = unionRecord<ParameterMapping>("ParameterMapping", (value: ParameterMapping): TirTypedRecordWork => {
    switch (value.kind) {
      case "argument": return work_ParameterMapping_argument.write(value);
      case "default": return work_ParameterMapping_default.write(value);
      case "omitted": return work_ParameterMapping_omitted.write(value);
      case "rest": return work_ParameterMapping_rest.write(value);
    }
  }, () => [work_ParameterMapping_argument.reader, work_ParameterMapping_default.reader, work_ParameterMapping_omitted.reader, work_ParameterMapping_rest.reader]);
  const work_LiteralConstructionPart: TirRecordCodec<LiteralConstructionPart> = unionRecord<LiteralConstructionPart>("LiteralConstructionPart", (value: LiteralConstructionPart): TirTypedRecordWork => {
    switch (value.kind) {
      case "element": return work_LiteralConstructionPart_element.write(value);
      case "property": return work_LiteralConstructionPart_property.write(value);
      case "spread": return work_LiteralConstructionPart_spread.write(value);
    }
  }, () => [work_LiteralConstructionPart_element.reader, work_LiteralConstructionPart_property.reader, work_LiteralConstructionPart_spread.reader]);
  return { work_ClosureDecision, work_OperationDecision, work_ConstructionPartDecision, work_ProtocolStepDecision, work_ProtocolStepOperation_call, work_ProtocolStepOperation_core, work_ProtocolStepOperation_completion, work_EmbeddingDecision_identity, work_EmbeddingDecision_conversion, work_EmbeddingDecision_refused, work_EmbeddingProof, work_RefinementDecision_identity, work_RefinementDecision_narrowed, work_MemberDecision, work_ApplicationDecision, work_ParameterMapping_argument, work_ParameterMapping_default, work_ParameterMapping_omitted, work_ParameterMapping_rest, work_CompletionEndpoint, work_LiteralConstructionPart_element, work_LiteralConstructionPart_property, work_LiteralConstructionPart_spread, work_ProtocolStepOperation, work_EmbeddingDecision, work_RefinementDecision, work_ParameterMapping, work_LiteralConstructionPart };
};
