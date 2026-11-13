import { lazyReader, literalReader, nullableReader, sequenceReader } from "./text-construction.js";
import { unionRecord } from "./text-layouts.js";
import type { TirRecordCodec } from "./text-layouts.js";
import type {
  BindingVector, LiteralValue, MemberKey, MemberOrigin, TypeComponent, TypeEvidence
} from "../ir-types/contract.js";
import type {
  NodeRef, Origin
} from "../ids/contract.js";
import type {
  HirCallableEndpoint, HirCoreCapture
} from "../ir-hir/contract.js";
import type {
  CandidateArgument, CandidateEndpoint, CandidateInput, ClosureInput, ConstructionPartDecision, CoreInput, CorrespondenceStep, DeferredDecision, DeferredInvocation, DomainFitInput, EmbedInput, EmbeddingDecision, IndexInput, LibraryInput, LiteralConstructionInput, LiteralConstructionPart, LiteralFitInput, MemberInput, MemoryEquivalentInput, OperationIdentity, OperatorInput, ProtocolInput, ProtocolStepDecision, RefinementInput, RuleContext
} from "../ir-infer/contract.js";
import type {
  Diagnostic
} from "../diag/contract.js";
import type { TirTextKernel, TirTypedRecordWork } from "./text-layouts.js";
import { scalarWork, referenceWork, nullableWork, sequenceWork, withBindingOwner } from "./text-layouts.js";

export interface RuleInputsTextReads {
  readonly work_BindingVector: TirRecordCodec<BindingVector>;
  readonly work_ConstructionPartDecision: TirRecordCodec<ConstructionPartDecision>;
  readonly work_Diagnostic: TirRecordCodec<Diagnostic>;
  readonly work_EmbeddingDecision: TirRecordCodec<EmbeddingDecision>;
  readonly work_HirCallableEndpoint: TirRecordCodec<HirCallableEndpoint>;
  readonly work_HirCoreCapture: TirRecordCodec<HirCoreCapture>;
  readonly work_LiteralConstructionPart: TirRecordCodec<LiteralConstructionPart>;
  readonly work_LiteralValue: TirRecordCodec<LiteralValue>;
  readonly work_MemberKey: TirRecordCodec<MemberKey>;
  readonly work_MemberOrigin: TirRecordCodec<MemberOrigin>;
  readonly work_NodeRef: TirRecordCodec<NodeRef>;
  readonly work_Origin: TirRecordCodec<Origin>;
  readonly work_ProtocolStepDecision: TirRecordCodec<ProtocolStepDecision>;
  readonly work_TypeComponent: TirRecordCodec<TypeComponent>;
  readonly work_TypeEvidence: TirRecordCodec<TypeEvidence>;
}

export interface RuleInputsTextModel {
  readonly work_OperationIdentity_native_operator: TirRecordCodec<OperationIdentity & { readonly kind: "native-operator" }>;
  readonly work_OperationIdentity_bigint_operator: TirRecordCodec<OperationIdentity & { readonly kind: "bigint-operator" }>;
  readonly work_OperationIdentity_string_operator: TirRecordCodec<OperationIdentity & { readonly kind: "string-operator" }>;
  readonly work_OperationIdentity_boolean_operator: TirRecordCodec<OperationIdentity & { readonly kind: "boolean-operator" }>;
  readonly work_OperationIdentity_absence_test: TirRecordCodec<OperationIdentity & { readonly kind: "absence-test" }>;
  readonly work_OperationIdentity_object_construction: TirRecordCodec<OperationIdentity & { readonly kind: "object-construction" | "array-construction" }>;
  readonly work_OperationIdentity_array_construction: TirRecordCodec<OperationIdentity & { readonly kind: "object-construction" | "array-construction" }>;
  readonly work_OperationIdentity_protocol: TirRecordCodec<OperationIdentity & { readonly kind: "protocol" }>;
  readonly work_OperationIdentity_conversion: TirRecordCodec<OperationIdentity & { readonly kind: "conversion" }>;
  readonly work_OperationIdentity_library: TirRecordCodec<OperationIdentity & { readonly kind: "library" | "core" }>;
  readonly work_OperationIdentity_core: TirRecordCodec<OperationIdentity & { readonly kind: "library" | "core" }>;
  readonly work_OperationIdentity_pointer_address: TirRecordCodec<OperationIdentity & { readonly kind: "pointer-address" | "pointer-read" | "pointer-write" | "pointer-offset" }>;
  readonly work_OperationIdentity_pointer_read: TirRecordCodec<OperationIdentity & { readonly kind: "pointer-address" | "pointer-read" | "pointer-write" | "pointer-offset" }>;
  readonly work_OperationIdentity_pointer_write: TirRecordCodec<OperationIdentity & { readonly kind: "pointer-address" | "pointer-read" | "pointer-write" | "pointer-offset" }>;
  readonly work_OperationIdentity_pointer_offset: TirRecordCodec<OperationIdentity & { readonly kind: "pointer-address" | "pointer-read" | "pointer-write" | "pointer-offset" }>;
  readonly work_OperationIdentity_type_query: TirRecordCodec<OperationIdentity & { readonly kind: "type-query" | "discard" }>;
  readonly work_OperationIdentity_discard: TirRecordCodec<OperationIdentity & { readonly kind: "type-query" | "discard" }>;
  readonly work_CorrespondenceStep: TirRecordCodec<CorrespondenceStep>;
  readonly work_DeferredDecision: TirRecordCodec<DeferredDecision>;
  readonly work_DeferredInvocation_rule_embed: TirRecordCodec<DeferredInvocation & { readonly rule: "embed" }>;
  readonly work_DeferredInvocation_rule_domain_fit: TirRecordCodec<DeferredInvocation & { readonly rule: "domain-fit" }>;
  readonly work_DeferredInvocation_rule_memory_equivalent: TirRecordCodec<DeferredInvocation & { readonly rule: "memory-equivalent" }>;
  readonly work_DeferredInvocation_rule_member: TirRecordCodec<DeferredInvocation & { readonly rule: "member" }>;
  readonly work_DeferredInvocation_rule_index: TirRecordCodec<DeferredInvocation & { readonly rule: "index" }>;
  readonly work_DeferredInvocation_rule_construct_literal: TirRecordCodec<DeferredInvocation & { readonly rule: "construct-literal" }>;
  readonly work_DeferredInvocation_rule_candidate: TirRecordCodec<DeferredInvocation & { readonly rule: "candidate" }>;
  readonly work_DeferredInvocation_rule_operator: TirRecordCodec<DeferredInvocation & { readonly rule: "operator" }>;
  readonly work_DeferredInvocation_rule_literal_fit: TirRecordCodec<DeferredInvocation & { readonly rule: "literal-fit" }>;
  readonly work_DeferredInvocation_rule_protocol: TirRecordCodec<DeferredInvocation & { readonly rule: "protocol" }>;
  readonly work_DeferredInvocation_rule_refinement: TirRecordCodec<DeferredInvocation & { readonly rule: "refinement" }>;
  readonly work_DeferredInvocation_rule_library: TirRecordCodec<DeferredInvocation & { readonly rule: "library" }>;
  readonly work_DeferredInvocation_rule_core: TirRecordCodec<DeferredInvocation & { readonly rule: "core" }>;
  readonly work_RuleContext: TirRecordCodec<RuleContext>;
  readonly work_EmbedInput: TirRecordCodec<EmbedInput>;
  readonly work_DomainFitInput: TirRecordCodec<DomainFitInput>;
  readonly work_MemoryEquivalentInput: TirRecordCodec<MemoryEquivalentInput>;
  readonly work_MemberInput: TirRecordCodec<MemberInput>;
  readonly work_IndexInput: TirRecordCodec<IndexInput>;
  readonly work_LiteralConstructionInput: TirRecordCodec<LiteralConstructionInput>;
  readonly work_CandidateInput: TirRecordCodec<CandidateInput>;
  readonly work_CandidateArgument: TirRecordCodec<CandidateArgument>;
  readonly work_CandidateEndpoint: TirRecordCodec<CandidateEndpoint>;
  readonly work_OperatorInput: TirRecordCodec<OperatorInput>;
  readonly work_LiteralFitInput: TirRecordCodec<LiteralFitInput>;
  readonly work_ProtocolInput: TirRecordCodec<ProtocolInput>;
  readonly work_RefinementInput: TirRecordCodec<RefinementInput>;
  readonly work_LibraryInput: TirRecordCodec<LibraryInput>;
  readonly work_CoreInput: TirRecordCodec<CoreInput>;
  readonly work_ClosureInput: TirRecordCodec<ClosureInput>;
  readonly work_DeferredInvocation_rule_closure: TirRecordCodec<DeferredInvocation & { readonly rule: "closure" }>;
  readonly work_OperationIdentity: TirRecordCodec<OperationIdentity>;
  readonly work_DeferredInvocation: TirRecordCodec<DeferredInvocation>;
}

export const createRuleInputsText = (kernel: TirTextKernel, read: RuleInputsTextReads): RuleInputsTextModel => {
  const { defineRecord, booleanReader, definitionReader, numberReader, typeReader } = kernel;
  const work_OperationIdentity_native_operator: TirRecordCodec<OperationIdentity & { readonly kind: "native-operator" }> = defineRecord<OperationIdentity & { readonly kind: "native-operator" }>("OperationIdentity#native-operator", "OperationIdentity", { field: "kind", value: "native-operator" }, "native-operator", null, null, fields => fields
    .field("operator", "Operator", value => scalarWork("Operator", value.operator), literalReader<(OperationIdentity & { readonly kind: "native-operator" })["operator"]>("Operator", ["+","-","!","~","typeof","void","delete","*","/","%","**","&","|","^","<<",">>",">>>","<","<=",">",">=","==","!=","===","!==","in","instanceof"]))
    .field("carrier", "NativePrimitive", value => scalarWork("NativePrimitive", value.carrier), literalReader<(OperationIdentity & { readonly kind: "native-operator" })["carrier"]>("NativePrimitive", ["bool","char","int8","uint8","int16","uint16","int32","uint32","int64","uint64","int128","uint128","native-int","native-uint","float16","float32","float64","decimal"]))
    .finish((field_operator, field_carrier) => ({ kind: "native-operator", operator: field_operator, carrier: field_carrier })));
  const work_OperationIdentity_bigint_operator: TirRecordCodec<OperationIdentity & { readonly kind: "bigint-operator" }> = defineRecord<OperationIdentity & { readonly kind: "bigint-operator" }>("OperationIdentity#bigint-operator", "OperationIdentity", { field: "kind", value: "bigint-operator" }, "bigint-operator", null, null, fields => fields
    .field("operator", "Operator", value => scalarWork("Operator", value.operator), literalReader<(OperationIdentity & { readonly kind: "bigint-operator" })["operator"]>("Operator", ["+","-","!","~","typeof","void","delete","*","/","%","**","&","|","^","<<",">>",">>>","<","<=",">",">=","==","!=","===","!==","in","instanceof"]))
    .finish((field_operator) => ({ kind: "bigint-operator", operator: field_operator })));
  const work_OperationIdentity_string_operator: TirRecordCodec<OperationIdentity & { readonly kind: "string-operator" }> = defineRecord<OperationIdentity & { readonly kind: "string-operator" }>("OperationIdentity#string-operator", "OperationIdentity", { field: "kind", value: "string-operator" }, "string-operator", null, null, fields => fields
    .field("operator", "StringOperator", value => scalarWork("StringOperator", value.operator), literalReader<(OperationIdentity & { readonly kind: "string-operator" })["operator"]>("StringOperator", ["+","==","!=","===","!==","<","<=",">",">="]))
    .finish((field_operator) => ({ kind: "string-operator", operator: field_operator })));
  const work_OperationIdentity_boolean_operator: TirRecordCodec<OperationIdentity & { readonly kind: "boolean-operator" }> = defineRecord<OperationIdentity & { readonly kind: "boolean-operator" }>("OperationIdentity#boolean-operator", "OperationIdentity", { field: "kind", value: "boolean-operator" }, "boolean-operator", null, null, fields => fields
    .field("operator", "BooleanOperator", value => scalarWork("BooleanOperator", value.operator), literalReader<(OperationIdentity & { readonly kind: "boolean-operator" })["operator"]>("BooleanOperator", ["!","&&","||","==","!=","===","!=="]))
    .finish((field_operator) => ({ kind: "boolean-operator", operator: field_operator })));
  const work_OperationIdentity_absence_test: TirRecordCodec<OperationIdentity & { readonly kind: "absence-test" }> = defineRecord<OperationIdentity & { readonly kind: "absence-test" }>("OperationIdentity#absence-test", "OperationIdentity", { field: "kind", value: "absence-test" }, "absence-test", null, null, fields => fields
    .field("negated", "boolean", value => scalarWork("boolean", value.negated), booleanReader)
    .finish((field_negated) => ({ kind: "absence-test", negated: field_negated })));
  const work_OperationIdentity_object_construction: TirRecordCodec<OperationIdentity & { readonly kind: "object-construction" | "array-construction" }> = defineRecord<OperationIdentity & { readonly kind: "object-construction" | "array-construction" }>("OperationIdentity#object-construction", "OperationIdentity", { field: "kind", value: "object-construction" }, "object-construction", null, null, fields => fields
    .field("parts", "[ConstructionPartDecision]", value => sequenceWork("[ConstructionPartDecision]", value.parts, actual => read.work_ConstructionPartDecision.write(actual)), sequenceReader("[ConstructionPartDecision]", lazyReader(() => read.work_ConstructionPartDecision.reader)))
    .finish((field_parts) => ({ kind: "object-construction", parts: field_parts })));
  const work_OperationIdentity_array_construction: TirRecordCodec<OperationIdentity & { readonly kind: "object-construction" | "array-construction" }> = defineRecord<OperationIdentity & { readonly kind: "object-construction" | "array-construction" }>("OperationIdentity#array-construction", "OperationIdentity", { field: "kind", value: "array-construction" }, "array-construction", null, null, fields => fields
    .field("parts", "[ConstructionPartDecision]", value => sequenceWork("[ConstructionPartDecision]", value.parts, actual => read.work_ConstructionPartDecision.write(actual)), sequenceReader("[ConstructionPartDecision]", lazyReader(() => read.work_ConstructionPartDecision.reader)))
    .finish((field_parts) => ({ kind: "array-construction", parts: field_parts })));
  const work_OperationIdentity_protocol: TirRecordCodec<OperationIdentity & { readonly kind: "protocol" }> = defineRecord<OperationIdentity & { readonly kind: "protocol" }>("OperationIdentity#protocol", "OperationIdentity", { field: "kind", value: "protocol" }, "protocol", null, null, fields => fields
    .field("protocol", "ProtocolKind", value => scalarWork("ProtocolKind", value.protocol), literalReader<(OperationIdentity & { readonly kind: "protocol" })["protocol"]>("ProtocolKind", ["iterate","await","yield","delegate","dispose","spread","argument-passing","pointer"]))
    .field("asynchronous", "boolean", value => scalarWork("boolean", value.asynchronous), booleanReader)
    .field("steps", "[ProtocolStepDecision]", value => sequenceWork("[ProtocolStepDecision]", value.steps, actual => read.work_ProtocolStepDecision.write(actual)), sequenceReader("[ProtocolStepDecision]", lazyReader(() => read.work_ProtocolStepDecision.reader)))
    .field("value", "t", value => referenceWork("t", value.value), typeReader)
    .field("completion", "t", value => referenceWork("t", value.completion), typeReader)
    .field("yielded", "?t", value => nullableWork(value.yielded, actual => referenceWork("t", actual)), nullableReader(typeReader))
    .field("sent", "?t", value => nullableWork(value.sent, actual => referenceWork("t", actual)), nullableReader(typeReader))
    .field("thrown", "t", value => referenceWork("t", value.thrown), typeReader)
    .finish((field_protocol, field_asynchronous, field_steps, field_value, field_completion, field_yielded, field_sent, field_thrown) => ({
      kind: "protocol", protocol: field_protocol, asynchronous: field_asynchronous, steps: field_steps, value: field_value,
      completion: field_completion, yielded: field_yielded, sent: field_sent, thrown: field_thrown,
    })));
  const work_OperationIdentity_conversion: TirRecordCodec<OperationIdentity & { readonly kind: "conversion" }> = defineRecord<OperationIdentity & { readonly kind: "conversion" }>("OperationIdentity#conversion", "OperationIdentity", { field: "kind", value: "conversion" }, "conversion", null, null, fields => fields
    .field("from", "t", value => referenceWork("t", value.from), typeReader)
    .field("to", "t", value => referenceWork("t", value.to), typeReader)
    .field("embedding", "EmbeddingDecision", value => read.work_EmbeddingDecision.write(value.embedding), lazyReader(() => read.work_EmbeddingDecision.reader))
    .finish((field_from, field_to, field_embedding) => ({ kind: "conversion", from: field_from, to: field_to, embedding: field_embedding })));
  const work_OperationIdentity_library: TirRecordCodec<OperationIdentity & { readonly kind: "library" | "core" }> = defineRecord<OperationIdentity & { readonly kind: "library" | "core" }>("OperationIdentity#library", "OperationIdentity", { field: "kind", value: "library" }, "library", null, null, fields => fields
    .field("declaration", "def", value => referenceWork("def", value.declaration), definitionReader)
    .field("bindings", "BindingVector", value => withBindingOwner(read.work_BindingVector.write(value.bindings), value.declaration), lazyReader(() => read.work_BindingVector.reader))
    .finish((field_declaration, field_bindings) => ({ kind: "library", declaration: field_declaration, bindings: field_bindings })));
  const work_OperationIdentity_core: TirRecordCodec<OperationIdentity & { readonly kind: "library" | "core" }> = defineRecord<OperationIdentity & { readonly kind: "library" | "core" }>("OperationIdentity#core", "OperationIdentity", { field: "kind", value: "core" }, "core", null, null, fields => fields
    .field("declaration", "def", value => referenceWork("def", value.declaration), definitionReader)
    .field("bindings", "BindingVector", value => withBindingOwner(read.work_BindingVector.write(value.bindings), value.declaration), lazyReader(() => read.work_BindingVector.reader))
    .finish((field_declaration, field_bindings) => ({ kind: "core", declaration: field_declaration, bindings: field_bindings })));
  const work_OperationIdentity_pointer_address: TirRecordCodec<OperationIdentity & { readonly kind: "pointer-address" | "pointer-read" | "pointer-write" | "pointer-offset" }> = defineRecord<OperationIdentity & { readonly kind: "pointer-address" | "pointer-read" | "pointer-write" | "pointer-offset" }>("OperationIdentity#pointer-address", "OperationIdentity", { field: "kind", value: "pointer-address" }, "pointer-address", null, null, fields => fields
    .finish(() => ({ kind: "pointer-address" })));
  const work_OperationIdentity_pointer_read: TirRecordCodec<OperationIdentity & { readonly kind: "pointer-address" | "pointer-read" | "pointer-write" | "pointer-offset" }> = defineRecord<OperationIdentity & { readonly kind: "pointer-address" | "pointer-read" | "pointer-write" | "pointer-offset" }>("OperationIdentity#pointer-read", "OperationIdentity", { field: "kind", value: "pointer-read" }, "pointer-read", null, null, fields => fields
    .finish(() => ({ kind: "pointer-read" })));
  const work_OperationIdentity_pointer_write: TirRecordCodec<OperationIdentity & { readonly kind: "pointer-address" | "pointer-read" | "pointer-write" | "pointer-offset" }> = defineRecord<OperationIdentity & { readonly kind: "pointer-address" | "pointer-read" | "pointer-write" | "pointer-offset" }>("OperationIdentity#pointer-write", "OperationIdentity", { field: "kind", value: "pointer-write" }, "pointer-write", null, null, fields => fields
    .finish(() => ({ kind: "pointer-write" })));
  const work_OperationIdentity_pointer_offset: TirRecordCodec<OperationIdentity & { readonly kind: "pointer-address" | "pointer-read" | "pointer-write" | "pointer-offset" }> = defineRecord<OperationIdentity & { readonly kind: "pointer-address" | "pointer-read" | "pointer-write" | "pointer-offset" }>("OperationIdentity#pointer-offset", "OperationIdentity", { field: "kind", value: "pointer-offset" }, "pointer-offset", null, null, fields => fields
    .finish(() => ({ kind: "pointer-offset" })));
  const work_OperationIdentity_type_query: TirRecordCodec<OperationIdentity & { readonly kind: "type-query" | "discard" }> = defineRecord<OperationIdentity & { readonly kind: "type-query" | "discard" }>("OperationIdentity#type-query", "OperationIdentity", { field: "kind", value: "type-query" }, "type-query", null, null, fields => fields
    .finish(() => ({ kind: "type-query" })));
  const work_OperationIdentity_discard: TirRecordCodec<OperationIdentity & { readonly kind: "type-query" | "discard" }> = defineRecord<OperationIdentity & { readonly kind: "type-query" | "discard" }>("OperationIdentity#discard", "OperationIdentity", { field: "kind", value: "discard" }, "discard", null, null, fields => fields
    .finish(() => ({ kind: "discard" })));
  const work_CorrespondenceStep: TirRecordCodec<CorrespondenceStep> = defineRecord<CorrespondenceStep>("CorrespondenceStep", "CorrespondenceStep", null, "CorrespondenceStep", null, null, fields => fields
    .field("from", "TypeComponent", value => read.work_TypeComponent.write(value.from), lazyReader(() => read.work_TypeComponent.reader))
    .field("to", "TypeComponent", value => read.work_TypeComponent.write(value.to), lazyReader(() => read.work_TypeComponent.reader))
    .field("rule", "CorrespondenceRule", value => scalarWork("CorrespondenceRule", value.rule), literalReader<(CorrespondenceStep)["rule"]>("CorrespondenceRule", ["identity","numeric","literal-fit","absence","union-injection","shape","callable","readonly"]))
    .field("premises", "[number]", value => sequenceWork("[number]", value.premises, actual => scalarWork("number", actual)), sequenceReader("[number]", numberReader))
    .finish((field_from, field_to, field_rule, field_premises) => ({ from: field_from, to: field_to, rule: field_rule, premises: field_premises })));
  const work_DeferredDecision: TirRecordCodec<DeferredDecision> = defineRecord<DeferredDecision>("DeferredDecision", "DeferredDecision", null, "DeferredDecision", null, null, fields => fields
    .field("invocation", "DeferredInvocation", value => work_DeferredInvocation.write(value.invocation), lazyReader(() => work_DeferredInvocation.reader))
    .field("result", "t", value => referenceWork("t", value.result), typeReader)
    .finish((field_invocation, field_result) => ({ invocation: field_invocation, result: field_result })));
  const work_DeferredInvocation_rule_embed: TirRecordCodec<DeferredInvocation & { readonly rule: "embed" }> = defineRecord<DeferredInvocation & { readonly rule: "embed" }>("DeferredInvocation@rule=embed", "DeferredInvocation", { field: "rule", value: "embed" }, "DeferredInvocation", null, null, fields => fields
    .field("rule", "'embed", value => scalarWork("'embed", value.rule), literalReader<(DeferredInvocation & { readonly rule: "embed" })["rule"]>("'embed", ["embed"]))
    .field("input", "EmbedInput", value => work_EmbedInput.write(value.input), lazyReader(() => work_EmbedInput.reader))
    .finish((field_rule, field_input) => ({ rule: field_rule, input: field_input })));
  const work_DeferredInvocation_rule_domain_fit: TirRecordCodec<DeferredInvocation & { readonly rule: "domain-fit" }> = defineRecord<DeferredInvocation & { readonly rule: "domain-fit" }>("DeferredInvocation@rule=domain-fit", "DeferredInvocation", { field: "rule", value: "domain-fit" }, "DeferredInvocation", null, null, fields => fields
    .field("rule", "'domain-fit", value => scalarWork("'domain-fit", value.rule), literalReader<(DeferredInvocation & { readonly rule: "domain-fit" })["rule"]>("'domain-fit", ["domain-fit"]))
    .field("input", "DomainFitInput", value => work_DomainFitInput.write(value.input), lazyReader(() => work_DomainFitInput.reader))
    .finish((field_rule, field_input) => ({ rule: field_rule, input: field_input })));
  const work_DeferredInvocation_rule_memory_equivalent: TirRecordCodec<DeferredInvocation & { readonly rule: "memory-equivalent" }> = defineRecord<DeferredInvocation & { readonly rule: "memory-equivalent" }>("DeferredInvocation@rule=memory-equivalent", "DeferredInvocation", { field: "rule", value: "memory-equivalent" }, "DeferredInvocation", null, null, fields => fields
    .field("rule", "'memory-equivalent", value => scalarWork("'memory-equivalent", value.rule), literalReader<(DeferredInvocation & { readonly rule: "memory-equivalent" })["rule"]>("'memory-equivalent", ["memory-equivalent"]))
    .field("input", "MemoryEquivalentInput", value => work_MemoryEquivalentInput.write(value.input), lazyReader(() => work_MemoryEquivalentInput.reader))
    .finish((field_rule, field_input) => ({ rule: field_rule, input: field_input })));
  const work_DeferredInvocation_rule_member: TirRecordCodec<DeferredInvocation & { readonly rule: "member" }> = defineRecord<DeferredInvocation & { readonly rule: "member" }>("DeferredInvocation@rule=member", "DeferredInvocation", { field: "rule", value: "member" }, "DeferredInvocation", null, null, fields => fields
    .field("rule", "'member", value => scalarWork("'member", value.rule), literalReader<(DeferredInvocation & { readonly rule: "member" })["rule"]>("'member", ["member"]))
    .field("input", "MemberInput", value => work_MemberInput.write(value.input), lazyReader(() => work_MemberInput.reader))
    .finish((field_rule, field_input) => ({ rule: field_rule, input: field_input })));
  const work_DeferredInvocation_rule_index: TirRecordCodec<DeferredInvocation & { readonly rule: "index" }> = defineRecord<DeferredInvocation & { readonly rule: "index" }>("DeferredInvocation@rule=index", "DeferredInvocation", { field: "rule", value: "index" }, "DeferredInvocation", null, null, fields => fields
    .field("rule", "'index", value => scalarWork("'index", value.rule), literalReader<(DeferredInvocation & { readonly rule: "index" })["rule"]>("'index", ["index"]))
    .field("input", "IndexInput", value => work_IndexInput.write(value.input), lazyReader(() => work_IndexInput.reader))
    .finish((field_rule, field_input) => ({ rule: field_rule, input: field_input })));
  const work_DeferredInvocation_rule_construct_literal: TirRecordCodec<DeferredInvocation & { readonly rule: "construct-literal" }> = defineRecord<DeferredInvocation & { readonly rule: "construct-literal" }>("DeferredInvocation@rule=construct-literal", "DeferredInvocation", { field: "rule", value: "construct-literal" }, "DeferredInvocation", null, null, fields => fields
    .field("rule", "'construct-literal", value => scalarWork("'construct-literal", value.rule), literalReader<(DeferredInvocation & { readonly rule: "construct-literal" })["rule"]>("'construct-literal", ["construct-literal"]))
    .field("input", "LiteralConstructionInput", value => work_LiteralConstructionInput.write(value.input), lazyReader(() => work_LiteralConstructionInput.reader))
    .finish((field_rule, field_input) => ({ rule: field_rule, input: field_input })));
  const work_DeferredInvocation_rule_candidate: TirRecordCodec<DeferredInvocation & { readonly rule: "candidate" }> = defineRecord<DeferredInvocation & { readonly rule: "candidate" }>("DeferredInvocation@rule=candidate", "DeferredInvocation", { field: "rule", value: "candidate" }, "DeferredInvocation", null, null, fields => fields
    .field("rule", "'candidate", value => scalarWork("'candidate", value.rule), literalReader<(DeferredInvocation & { readonly rule: "candidate" })["rule"]>("'candidate", ["candidate"]))
    .field("input", "CandidateInput", value => work_CandidateInput.write(value.input), lazyReader(() => work_CandidateInput.reader))
    .finish((field_rule, field_input) => ({ rule: field_rule, input: field_input })));
  const work_DeferredInvocation_rule_operator: TirRecordCodec<DeferredInvocation & { readonly rule: "operator" }> = defineRecord<DeferredInvocation & { readonly rule: "operator" }>("DeferredInvocation@rule=operator", "DeferredInvocation", { field: "rule", value: "operator" }, "DeferredInvocation", null, null, fields => fields
    .field("rule", "'operator", value => scalarWork("'operator", value.rule), literalReader<(DeferredInvocation & { readonly rule: "operator" })["rule"]>("'operator", ["operator"]))
    .field("input", "OperatorInput", value => work_OperatorInput.write(value.input), lazyReader(() => work_OperatorInput.reader))
    .finish((field_rule, field_input) => ({ rule: field_rule, input: field_input })));
  const work_DeferredInvocation_rule_literal_fit: TirRecordCodec<DeferredInvocation & { readonly rule: "literal-fit" }> = defineRecord<DeferredInvocation & { readonly rule: "literal-fit" }>("DeferredInvocation@rule=literal-fit", "DeferredInvocation", { field: "rule", value: "literal-fit" }, "DeferredInvocation", null, null, fields => fields
    .field("rule", "'literal-fit", value => scalarWork("'literal-fit", value.rule), literalReader<(DeferredInvocation & { readonly rule: "literal-fit" })["rule"]>("'literal-fit", ["literal-fit"]))
    .field("input", "LiteralFitInput", value => work_LiteralFitInput.write(value.input), lazyReader(() => work_LiteralFitInput.reader))
    .finish((field_rule, field_input) => ({ rule: field_rule, input: field_input })));
  const work_DeferredInvocation_rule_protocol: TirRecordCodec<DeferredInvocation & { readonly rule: "protocol" }> = defineRecord<DeferredInvocation & { readonly rule: "protocol" }>("DeferredInvocation@rule=protocol", "DeferredInvocation", { field: "rule", value: "protocol" }, "DeferredInvocation", null, null, fields => fields
    .field("rule", "'protocol", value => scalarWork("'protocol", value.rule), literalReader<(DeferredInvocation & { readonly rule: "protocol" })["rule"]>("'protocol", ["protocol"]))
    .field("input", "ProtocolInput", value => work_ProtocolInput.write(value.input), lazyReader(() => work_ProtocolInput.reader))
    .finish((field_rule, field_input) => ({ rule: field_rule, input: field_input })));
  const work_DeferredInvocation_rule_refinement: TirRecordCodec<DeferredInvocation & { readonly rule: "refinement" }> = defineRecord<DeferredInvocation & { readonly rule: "refinement" }>("DeferredInvocation@rule=refinement", "DeferredInvocation", { field: "rule", value: "refinement" }, "DeferredInvocation", null, null, fields => fields
    .field("rule", "'refinement", value => scalarWork("'refinement", value.rule), literalReader<(DeferredInvocation & { readonly rule: "refinement" })["rule"]>("'refinement", ["refinement"]))
    .field("input", "RefinementInput", value => work_RefinementInput.write(value.input), lazyReader(() => work_RefinementInput.reader))
    .finish((field_rule, field_input) => ({ rule: field_rule, input: field_input })));
  const work_DeferredInvocation_rule_library: TirRecordCodec<DeferredInvocation & { readonly rule: "library" }> = defineRecord<DeferredInvocation & { readonly rule: "library" }>("DeferredInvocation@rule=library", "DeferredInvocation", { field: "rule", value: "library" }, "DeferredInvocation", null, null, fields => fields
    .field("rule", "'library", value => scalarWork("'library", value.rule), literalReader<(DeferredInvocation & { readonly rule: "library" })["rule"]>("'library", ["library"]))
    .field("input", "LibraryInput", value => work_LibraryInput.write(value.input), lazyReader(() => work_LibraryInput.reader))
    .finish((field_rule, field_input) => ({ rule: field_rule, input: field_input })));
  const work_DeferredInvocation_rule_core: TirRecordCodec<DeferredInvocation & { readonly rule: "core" }> = defineRecord<DeferredInvocation & { readonly rule: "core" }>("DeferredInvocation@rule=core", "DeferredInvocation", { field: "rule", value: "core" }, "DeferredInvocation", null, null, fields => fields
    .field("rule", "'core", value => scalarWork("'core", value.rule), literalReader<(DeferredInvocation & { readonly rule: "core" })["rule"]>("'core", ["core"]))
    .field("input", "CoreInput", value => work_CoreInput.write(value.input), lazyReader(() => work_CoreInput.reader))
    .finish((field_rule, field_input) => ({ rule: field_rule, input: field_input })));
  const work_RuleContext: TirRecordCodec<RuleContext> = defineRecord<RuleContext>("RuleContext", "RuleContext", null, "RuleContext", null, null, fields => fields
    .field("occurrence", "NodeRef", value => read.work_NodeRef.write(value.occurrence), lazyReader(() => read.work_NodeRef.reader))
    .field("origin", "Origin", value => read.work_Origin.write(value.origin), lazyReader(() => read.work_Origin.reader))
    .field("bindings", "BindingVector", value => read.work_BindingVector.write(value.bindings), lazyReader(() => read.work_BindingVector.reader))
    .finish((field_occurrence, field_origin, field_bindings) => ({ occurrence: field_occurrence, origin: field_origin, bindings: field_bindings })));
  const work_EmbedInput: TirRecordCodec<EmbedInput> = defineRecord<EmbedInput>("EmbedInput", "EmbedInput", null, "EmbedInput", null, null, fields => fields
    .field("context", "RuleContext", value => work_RuleContext.write(value.context), lazyReader(() => work_RuleContext.reader))
    .field("from", "TypeEvidence", value => read.work_TypeEvidence.write(value.from), lazyReader(() => read.work_TypeEvidence.reader))
    .field("to", "TypeEvidence", value => read.work_TypeEvidence.write(value.to), lazyReader(() => read.work_TypeEvidence.reader))
    .field("role", "FlowRole", value => scalarWork("FlowRole", value.role), literalReader<(EmbedInput)["role"]>("FlowRole", ["initialization","assignment","argument","return","receiver","yield","member-write"]))
    .finish((field_context, field_from, field_to, field_role) => ({ context: field_context, from: field_from, to: field_to, role: field_role })));
  const work_DomainFitInput: TirRecordCodec<DomainFitInput> = defineRecord<DomainFitInput>("DomainFitInput", "DomainFitInput", null, "DomainFitInput", null, null, fields => fields
    .field("context", "RuleContext", value => work_RuleContext.write(value.context), lazyReader(() => work_RuleContext.reader))
    .field("value", "TypeEvidence", value => read.work_TypeEvidence.write(value.value), lazyReader(() => read.work_TypeEvidence.reader))
    .field("domain", "TypeEvidence", value => read.work_TypeEvidence.write(value.domain), lazyReader(() => read.work_TypeEvidence.reader))
    .finish((field_context, field_value, field_domain) => ({ context: field_context, value: field_value, domain: field_domain })));
  const work_MemoryEquivalentInput: TirRecordCodec<MemoryEquivalentInput> = defineRecord<MemoryEquivalentInput>("MemoryEquivalentInput", "MemoryEquivalentInput", null, "MemoryEquivalentInput", null, null, fields => fields
    .field("context", "RuleContext", value => work_RuleContext.write(value.context), lazyReader(() => work_RuleContext.reader))
    .field("left", "TypeEvidence", value => read.work_TypeEvidence.write(value.left), lazyReader(() => read.work_TypeEvidence.reader))
    .field("right", "TypeEvidence", value => read.work_TypeEvidence.write(value.right), lazyReader(() => read.work_TypeEvidence.reader))
    .finish((field_context, field_left, field_right) => ({ context: field_context, left: field_left, right: field_right })));
  const work_MemberInput: TirRecordCodec<MemberInput> = defineRecord<MemberInput>("MemberInput", "MemberInput", null, "MemberInput", null, null, fields => fields
    .field("context", "RuleContext", value => work_RuleContext.write(value.context), lazyReader(() => work_RuleContext.reader))
    .field("receiver", "TypeEvidence", value => read.work_TypeEvidence.write(value.receiver), lazyReader(() => read.work_TypeEvidence.reader))
    .field("key", "MemberKey", value => read.work_MemberKey.write(value.key), lazyReader(() => read.work_MemberKey.reader))
    .field("access", "AccessRole", value => scalarWork("AccessRole", value.access), literalReader<(MemberInput)["access"]>("AccessRole", ["read","write","call"]))
    .field("origins", "[MemberOrigin]", value => sequenceWork("[MemberOrigin]", value.origins, actual => read.work_MemberOrigin.write(actual)), sequenceReader("[MemberOrigin]", lazyReader(() => read.work_MemberOrigin.reader)))
    .finish((field_context, field_receiver, field_key, field_access, field_origins) => ({ context: field_context, receiver: field_receiver, key: field_key, access: field_access, origins: field_origins })));
  const work_IndexInput: TirRecordCodec<IndexInput> = defineRecord<IndexInput>("IndexInput", "IndexInput", null, "IndexInput", null, null, fields => fields
    .field("context", "RuleContext", value => work_RuleContext.write(value.context), lazyReader(() => work_RuleContext.reader))
    .field("receiver", "TypeEvidence", value => read.work_TypeEvidence.write(value.receiver), lazyReader(() => read.work_TypeEvidence.reader))
    .field("key", "TypeEvidence", value => read.work_TypeEvidence.write(value.key), lazyReader(() => read.work_TypeEvidence.reader))
    .field("access", "AccessRole", value => scalarWork("AccessRole", value.access), literalReader<(IndexInput)["access"]>("AccessRole", ["read","write","call"]))
    .finish((field_context, field_receiver, field_key, field_access) => ({ context: field_context, receiver: field_receiver, key: field_key, access: field_access })));
  const work_LiteralConstructionInput: TirRecordCodec<LiteralConstructionInput> = defineRecord<LiteralConstructionInput>("LiteralConstructionInput", "LiteralConstructionInput", null, "LiteralConstructionInput", null, null, fields => fields
    .field("context", "RuleContext", value => work_RuleContext.write(value.context), lazyReader(() => work_RuleContext.reader))
    .field("construction", "ConstructionKind", value => scalarWork("ConstructionKind", value.construction), literalReader<(LiteralConstructionInput)["construction"]>("ConstructionKind", ["object","array"]))
    .field("parts", "[LiteralConstructionPart]", value => sequenceWork("[LiteralConstructionPart]", value.parts, actual => read.work_LiteralConstructionPart.write(actual)), sequenceReader("[LiteralConstructionPart]", lazyReader(() => read.work_LiteralConstructionPart.reader)))
    .field("destination", "?TypeEvidence", value => nullableWork(value.destination, actual => read.work_TypeEvidence.write(actual)), nullableReader(lazyReader(() => read.work_TypeEvidence.reader)))
    .finish((field_context, field_construction, field_parts, field_destination) => ({ context: field_context, construction: field_construction, parts: field_parts, destination: field_destination })));
  const work_CandidateInput: TirRecordCodec<CandidateInput> = defineRecord<CandidateInput>("CandidateInput", "CandidateInput", null, "CandidateInput", null, null, fields => fields
    .field("context", "RuleContext", value => work_RuleContext.write(value.context), lazyReader(() => work_RuleContext.reader))
    .field("kind", "ApplicationKind", value => scalarWork("ApplicationKind", value.kind), literalReader<(CandidateInput)["kind"]>("ApplicationKind", ["call","construct","accessor-get","accessor-set"]))
    .field("callee", "TypeEvidence", value => read.work_TypeEvidence.write(value.callee), lazyReader(() => read.work_TypeEvidence.reader))
    .field("receiver", "?TypeEvidence", value => nullableWork(value.receiver, actual => read.work_TypeEvidence.write(actual)), nullableReader(lazyReader(() => read.work_TypeEvidence.reader)))
    .field("typeArguments", "[TypeEvidence]", value => sequenceWork("[TypeEvidence]", value.typeArguments, actual => read.work_TypeEvidence.write(actual)), sequenceReader("[TypeEvidence]", lazyReader(() => read.work_TypeEvidence.reader)))
    .field("arguments", "[CandidateArgument]", value => sequenceWork("[CandidateArgument]", value.arguments, actual => work_CandidateArgument.write(actual)), sequenceReader("[CandidateArgument]", lazyReader(() => work_CandidateArgument.reader)))
    .field("candidates", "[CandidateEndpoint]", value => sequenceWork("[CandidateEndpoint]", value.candidates, actual => work_CandidateEndpoint.write(actual)), sequenceReader("[CandidateEndpoint]", lazyReader(() => work_CandidateEndpoint.reader)))
    .finish((field_context, field_kind, field_callee, field_receiver, field_typeArguments, field_arguments, field_candidates) => ({
      context: field_context, kind: field_kind, callee: field_callee, receiver: field_receiver, typeArguments: field_typeArguments,
      arguments: field_arguments, candidates: field_candidates,
    })));
  const work_CandidateArgument: TirRecordCodec<CandidateArgument> = defineRecord<CandidateArgument>("CandidateArgument", "CandidateArgument", null, "CandidateArgument", null, null, fields => fields
    .field("occurrence", "NodeRef", value => read.work_NodeRef.write(value.occurrence), lazyReader(() => read.work_NodeRef.reader))
    .field("kind", "ArgumentKind", value => scalarWork("ArgumentKind", value.kind), literalReader<(CandidateArgument)["kind"]>("ArgumentKind", ["value","spread"]))
    .field("value", "TypeEvidence", value => read.work_TypeEvidence.write(value.value), lazyReader(() => read.work_TypeEvidence.reader))
    .field("tuple", "?[TypeEvidence]", value => nullableWork(value.tuple, actual => sequenceWork("[TypeEvidence]", actual, actual => read.work_TypeEvidence.write(actual))), nullableReader(sequenceReader("[TypeEvidence]", lazyReader(() => read.work_TypeEvidence.reader))))
    .finish((field_occurrence, field_kind, field_value, field_tuple) => ({ occurrence: field_occurrence, kind: field_kind, value: field_value, tuple: field_tuple })));
  const work_CandidateEndpoint: TirRecordCodec<CandidateEndpoint> = defineRecord<CandidateEndpoint>("CandidateEndpoint", "CandidateEndpoint", null, "CandidateEndpoint", null, null, fields => fields
    .field("ordinal", "number", value => scalarWork("number", value.ordinal), numberReader)
    .field("declaration", "def", value => referenceWork("def", value.declaration), definitionReader)
    .field("advertised", "HirCallableEndpoint", value => read.work_HirCallableEndpoint.write(value.advertised), lazyReader(() => read.work_HirCallableEndpoint.reader))
    .field("api", "HirCallableEndpoint", value => read.work_HirCallableEndpoint.write(value.api), lazyReader(() => read.work_HirCallableEndpoint.reader))
    .field("bindings", "BindingVector", value => withBindingOwner(read.work_BindingVector.write(value.bindings), value.advertised.declaration), lazyReader(() => read.work_BindingVector.reader))
    .field("conditionalFailure", "?Diagnostic", value => nullableWork(value.conditionalFailure, actual => read.work_Diagnostic.write(actual)), nullableReader(lazyReader(() => read.work_Diagnostic.reader)))
    .finish((field_ordinal, field_declaration, field_advertised, field_api, field_bindings, field_conditionalFailure) => ({
      ordinal: field_ordinal, declaration: field_declaration, advertised: field_advertised, api: field_api, bindings: field_bindings,
      conditionalFailure: field_conditionalFailure,
    })));
  const work_OperatorInput: TirRecordCodec<OperatorInput> = defineRecord<OperatorInput>("OperatorInput", "OperatorInput", null, "OperatorInput", null, null, fields => fields
    .field("context", "RuleContext", value => work_RuleContext.write(value.context), lazyReader(() => work_RuleContext.reader))
    .field("operator", "Operator", value => scalarWork("Operator", value.operator), literalReader<(OperatorInput)["operator"]>("Operator", ["+","-","!","~","typeof","void","delete","*","/","%","**","&","|","^","<<",">>",">>>","<","<=",">",">=","==","!=","===","!==","in","instanceof"]))
    .field("operands", "[TypeEvidence]", value => sequenceWork("[TypeEvidence]", value.operands, actual => read.work_TypeEvidence.write(actual)), sequenceReader("[TypeEvidence]", lazyReader(() => read.work_TypeEvidence.reader)))
    .field("permissionScope", "?NodeRef", value => nullableWork(value.permissionScope, actual => read.work_NodeRef.write(actual)), nullableReader(lazyReader(() => read.work_NodeRef.reader)))
    .finish((field_context, field_operator, field_operands, field_permissionScope) => ({ context: field_context, operator: field_operator, operands: field_operands, permissionScope: field_permissionScope })));
  const work_LiteralFitInput: TirRecordCodec<LiteralFitInput> = defineRecord<LiteralFitInput>("LiteralFitInput", "LiteralFitInput", null, "LiteralFitInput", null, null, fields => fields
    .field("context", "RuleContext", value => work_RuleContext.write(value.context), lazyReader(() => work_RuleContext.reader))
    .field("literal", "LiteralValue", value => read.work_LiteralValue.write(value.literal), lazyReader(() => read.work_LiteralValue.reader))
    .field("destination", "TypeEvidence", value => read.work_TypeEvidence.write(value.destination), lazyReader(() => read.work_TypeEvidence.reader))
    .finish((field_context, field_literal, field_destination) => ({ context: field_context, literal: field_literal, destination: field_destination })));
  const work_ProtocolInput: TirRecordCodec<ProtocolInput> = defineRecord<ProtocolInput>("ProtocolInput", "ProtocolInput", null, "ProtocolInput", null, null, fields => fields
    .field("context", "RuleContext", value => work_RuleContext.write(value.context), lazyReader(() => work_RuleContext.reader))
    .field("kind", "ProtocolKind", value => scalarWork("ProtocolKind", value.kind), literalReader<(ProtocolInput)["kind"]>("ProtocolKind", ["iterate","await","yield","delegate","dispose","spread","argument-passing","pointer"]))
    .field("asynchronous", "boolean", value => scalarWork("boolean", value.asynchronous), booleanReader)
    .field("subject", "?TypeEvidence", value => nullableWork(value.subject, actual => read.work_TypeEvidence.write(actual)), nullableReader(lazyReader(() => read.work_TypeEvidence.reader)))
    .field("operands", "[TypeEvidence]", value => sequenceWork("[TypeEvidence]", value.operands, actual => read.work_TypeEvidence.write(actual)), sequenceReader("[TypeEvidence]", lazyReader(() => read.work_TypeEvidence.reader)))
    .field("completion", "?TypeEvidence", value => nullableWork(value.completion, actual => read.work_TypeEvidence.write(actual)), nullableReader(lazyReader(() => read.work_TypeEvidence.reader)))
    .field("yielded", "?TypeEvidence", value => nullableWork(value.yielded, actual => read.work_TypeEvidence.write(actual)), nullableReader(lazyReader(() => read.work_TypeEvidence.reader)))
    .field("sent", "?TypeEvidence", value => nullableWork(value.sent, actual => read.work_TypeEvidence.write(actual)), nullableReader(lazyReader(() => read.work_TypeEvidence.reader)))
    .field("thrown", "TypeEvidence", value => read.work_TypeEvidence.write(value.thrown), lazyReader(() => read.work_TypeEvidence.reader))
    .finish((field_context, field_kind, field_asynchronous, field_subject, field_operands, field_completion, field_yielded, field_sent, field_thrown) => ({
      context: field_context, kind: field_kind, asynchronous: field_asynchronous, subject: field_subject, operands: field_operands,
      completion: field_completion, yielded: field_yielded, sent: field_sent, thrown: field_thrown,
    })));
  const work_DeferredInvocation_rule_closure: TirRecordCodec<DeferredInvocation & { readonly rule: "closure" }> = defineRecord<DeferredInvocation & { readonly rule: "closure" }>("DeferredInvocation@rule=closure", "DeferredInvocation", { field: "rule", value: "closure" }, "DeferredInvocation", null, null, fields => fields
    .field("rule", "'closure", value => scalarWork("'closure", value.rule), literalReader<(DeferredInvocation & { readonly rule: "closure" })["rule"]>("'closure", ["closure"]))
    .field("input", "ClosureInput", value => work_ClosureInput.write(value.input), lazyReader(() => work_ClosureInput.reader))
    .finish((field_rule, field_input) => ({ rule: field_rule, input: field_input })));
  const work_ClosureInput: TirRecordCodec<ClosureInput> = defineRecord<ClosureInput>("ClosureInput", "ClosureInput", null, "ClosureInput", null, null, fields => fields
    .field("context", "RuleContext", value => work_RuleContext.write(value.context), lazyReader(() => work_RuleContext.reader))
    .field("callable", "TypeEvidence", value => read.work_TypeEvidence.write(value.callable), lazyReader(() => read.work_TypeEvidence.reader))
    .field("captures", "[TypeEvidence]", value => sequenceWork("[TypeEvidence]", value.captures, actual => read.work_TypeEvidence.write(actual)), sequenceReader("[TypeEvidence]", lazyReader(() => read.work_TypeEvidence.reader)))
    .finish((field_context, field_callable, field_captures) => ({ context: field_context, callable: field_callable, captures: field_captures })));
  const work_RefinementInput: TirRecordCodec<RefinementInput> = defineRecord<RefinementInput>("RefinementInput", "RefinementInput", null, "RefinementInput", null, null, fields => fields
    .field("context", "RuleContext", value => work_RuleContext.write(value.context), lazyReader(() => work_RuleContext.reader))
    .field("source", "TypeEvidence", value => read.work_TypeEvidence.write(value.source), lazyReader(() => read.work_TypeEvidence.reader))
    .field("checked", "TypeEvidence", value => read.work_TypeEvidence.write(value.checked), lazyReader(() => read.work_TypeEvidence.reader))
    .finish((field_context, field_source, field_checked) => ({ context: field_context, source: field_source, checked: field_checked })));
  const work_LibraryInput: TirRecordCodec<LibraryInput> = defineRecord<LibraryInput>("LibraryInput", "LibraryInput", null, "LibraryInput", null, null, fields => fields
    .field("context", "RuleContext", value => work_RuleContext.write(value.context), lazyReader(() => work_RuleContext.reader))
    .field("declaration", "def", value => referenceWork("def", value.declaration), definitionReader)
    .field("receiver", "?TypeEvidence", value => nullableWork(value.receiver, actual => read.work_TypeEvidence.write(actual)), nullableReader(lazyReader(() => read.work_TypeEvidence.reader)))
    .field("arguments", "[TypeEvidence]", value => sequenceWork("[TypeEvidence]", value.arguments, actual => read.work_TypeEvidence.write(actual)), sequenceReader("[TypeEvidence]", lazyReader(() => read.work_TypeEvidence.reader)))
    .field("result", "TypeEvidence", value => read.work_TypeEvidence.write(value.result), lazyReader(() => read.work_TypeEvidence.reader))
    .finish((field_context, field_declaration, field_receiver, field_arguments, field_result) => ({
      context: field_context, declaration: field_declaration, receiver: field_receiver, arguments: field_arguments,
      result: field_result,
    })));
  const work_CoreInput: TirRecordCodec<CoreInput> = defineRecord<CoreInput>("CoreInput", "CoreInput", null, "CoreInput", null, null, fields => fields
    .field("context", "RuleContext", value => work_RuleContext.write(value.context), lazyReader(() => work_RuleContext.reader))
    .field("captured", "HirCoreCapture", value => read.work_HirCoreCapture.write(value.captured), lazyReader(() => read.work_HirCoreCapture.reader))
    .field("declaration", "def", value => referenceWork("def", value.declaration), definitionReader)
    .field("operands", "[TypeEvidence]", value => sequenceWork("[TypeEvidence]", value.operands, actual => read.work_TypeEvidence.write(actual)), sequenceReader("[TypeEvidence]", lazyReader(() => read.work_TypeEvidence.reader)))
    .field("result", "TypeEvidence", value => read.work_TypeEvidence.write(value.result), lazyReader(() => read.work_TypeEvidence.reader))
    .field("permissionScope", "?NodeRef", value => nullableWork(value.permissionScope, actual => read.work_NodeRef.write(actual)), nullableReader(lazyReader(() => read.work_NodeRef.reader)))
    .finish((field_context, field_captured, field_declaration, field_operands, field_result, field_permissionScope) => ({
      context: field_context, captured: field_captured, declaration: field_declaration, operands: field_operands, result: field_result,
      permissionScope: field_permissionScope,
    })));
  const work_OperationIdentity: TirRecordCodec<OperationIdentity> = unionRecord<OperationIdentity>("OperationIdentity", (value: OperationIdentity): TirTypedRecordWork => {
    switch (value.kind) {
      case "native-operator": return work_OperationIdentity_native_operator.write(value);
      case "bigint-operator": return work_OperationIdentity_bigint_operator.write(value);
      case "string-operator": return work_OperationIdentity_string_operator.write(value);
      case "boolean-operator": return work_OperationIdentity_boolean_operator.write(value);
      case "absence-test": return work_OperationIdentity_absence_test.write(value);
      case "object-construction": return work_OperationIdentity_object_construction.write(value);
      case "array-construction": return work_OperationIdentity_array_construction.write(value);
      case "protocol": return work_OperationIdentity_protocol.write(value);
      case "conversion": return work_OperationIdentity_conversion.write(value);
      case "library": return work_OperationIdentity_library.write(value);
      case "core": return work_OperationIdentity_core.write(value);
      case "pointer-address": return work_OperationIdentity_pointer_address.write(value);
      case "pointer-read": return work_OperationIdentity_pointer_read.write(value);
      case "pointer-write": return work_OperationIdentity_pointer_write.write(value);
      case "pointer-offset": return work_OperationIdentity_pointer_offset.write(value);
      case "type-query": return work_OperationIdentity_type_query.write(value);
      case "discard": return work_OperationIdentity_discard.write(value);
    }
  }, () => [work_OperationIdentity_native_operator.reader, work_OperationIdentity_bigint_operator.reader, work_OperationIdentity_string_operator.reader, work_OperationIdentity_boolean_operator.reader, work_OperationIdentity_absence_test.reader, work_OperationIdentity_object_construction.reader, work_OperationIdentity_array_construction.reader, work_OperationIdentity_protocol.reader, work_OperationIdentity_conversion.reader, work_OperationIdentity_library.reader, work_OperationIdentity_core.reader, work_OperationIdentity_pointer_address.reader, work_OperationIdentity_pointer_read.reader, work_OperationIdentity_pointer_write.reader, work_OperationIdentity_pointer_offset.reader, work_OperationIdentity_type_query.reader, work_OperationIdentity_discard.reader]);
  const work_DeferredInvocation: TirRecordCodec<DeferredInvocation> = unionRecord<DeferredInvocation>("DeferredInvocation", (value: DeferredInvocation): TirTypedRecordWork => {
    switch (value.rule) {
      case "embed": return work_DeferredInvocation_rule_embed.write(value);
      case "domain-fit": return work_DeferredInvocation_rule_domain_fit.write(value);
      case "memory-equivalent": return work_DeferredInvocation_rule_memory_equivalent.write(value);
      case "member": return work_DeferredInvocation_rule_member.write(value);
      case "index": return work_DeferredInvocation_rule_index.write(value);
      case "construct-literal": return work_DeferredInvocation_rule_construct_literal.write(value);
      case "candidate": return work_DeferredInvocation_rule_candidate.write(value);
      case "operator": return work_DeferredInvocation_rule_operator.write(value);
      case "literal-fit": return work_DeferredInvocation_rule_literal_fit.write(value);
      case "protocol": return work_DeferredInvocation_rule_protocol.write(value);
      case "refinement": return work_DeferredInvocation_rule_refinement.write(value);
      case "library": return work_DeferredInvocation_rule_library.write(value);
      case "core": return work_DeferredInvocation_rule_core.write(value);
      case "closure": return work_DeferredInvocation_rule_closure.write(value);
    }
  }, () => [work_DeferredInvocation_rule_embed.reader, work_DeferredInvocation_rule_domain_fit.reader, work_DeferredInvocation_rule_memory_equivalent.reader, work_DeferredInvocation_rule_member.reader, work_DeferredInvocation_rule_index.reader, work_DeferredInvocation_rule_construct_literal.reader, work_DeferredInvocation_rule_candidate.reader, work_DeferredInvocation_rule_operator.reader, work_DeferredInvocation_rule_literal_fit.reader, work_DeferredInvocation_rule_protocol.reader, work_DeferredInvocation_rule_refinement.reader, work_DeferredInvocation_rule_library.reader, work_DeferredInvocation_rule_core.reader, work_DeferredInvocation_rule_closure.reader]);
  return { work_ClosureInput, work_DeferredInvocation_rule_closure, work_OperationIdentity_native_operator, work_OperationIdentity_bigint_operator, work_OperationIdentity_string_operator, work_OperationIdentity_boolean_operator, work_OperationIdentity_absence_test, work_OperationIdentity_object_construction, work_OperationIdentity_array_construction, work_OperationIdentity_protocol, work_OperationIdentity_conversion, work_OperationIdentity_library, work_OperationIdentity_core, work_OperationIdentity_pointer_address, work_OperationIdentity_pointer_read, work_OperationIdentity_pointer_write, work_OperationIdentity_pointer_offset, work_OperationIdentity_type_query, work_OperationIdentity_discard, work_CorrespondenceStep, work_DeferredDecision, work_DeferredInvocation_rule_embed, work_DeferredInvocation_rule_domain_fit, work_DeferredInvocation_rule_memory_equivalent, work_DeferredInvocation_rule_member, work_DeferredInvocation_rule_index, work_DeferredInvocation_rule_construct_literal, work_DeferredInvocation_rule_candidate, work_DeferredInvocation_rule_operator, work_DeferredInvocation_rule_literal_fit, work_DeferredInvocation_rule_protocol, work_DeferredInvocation_rule_refinement, work_DeferredInvocation_rule_library, work_DeferredInvocation_rule_core, work_RuleContext, work_EmbedInput, work_DomainFitInput, work_MemoryEquivalentInput, work_MemberInput, work_IndexInput, work_LiteralConstructionInput, work_CandidateInput, work_CandidateArgument, work_CandidateEndpoint, work_OperatorInput, work_LiteralFitInput, work_ProtocolInput, work_RefinementInput, work_LibraryInput, work_CoreInput, work_OperationIdentity, work_DeferredInvocation };
};
