import type { AccessLocation, BodyCaptureRow, CaptureRow, CaptureSource, CheckRequirement, ClosureDecision, ClosureInput, OperationExecution, DeferredDecision, EmbeddingDecision, MemberDecision, ApplicationDecision, ConstructionPartDecision, OperationDecision, RefinementDecision, DeferredInvocation, EmbeddingProof, ParameterMapping, CompletionEndpoint, OperationIdentity, RuleOutcome, EmbedInput, DomainFitInput, MemoryEquivalentInput, MemberInput, IndexInput, LiteralConstructionInput, CandidateInput, OperatorInput, LiteralFitInput, ProtocolInput, RefinementInput, LibraryInput, CoreInput, CorrespondenceStep, ProtocolStepDecision, RuleContext, LiteralConstructionPart, CandidateArgument, CandidateEndpoint, ProtocolStepOperation } from "../ir-infer/contract.js";
import type { TextWork } from "./text-values.js";
import { token, text, numeric, numericIdentity, identity, field, record, sequence, deferred, boolean, textNodeRef, textLocalRef, textOrigin, textDiagnostic } from "./text-values.js";
import { textMemberKey, textMemberOrigin, textBindingVector, textTypeComponent, textTypeEvidence, textLiteralValue } from "./text-types.js";
import { textHirCallableEndpoint, textHirCoreCapture } from "./text-core.js";

export function textDeferredDecision(value: DeferredDecision): TextWork {
  return deferred(value, () => {
    return record("DeferredDecision", [
      field("invocation", textDeferredInvocation(value.invocation)),
      field("result", numericIdentity("t", value.result)),
    ]);
  });
}

export function textEmbeddingDecision(value: EmbeddingDecision): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "identity":
        return record(value.kind, []);
      case "conversion":
        return record(value.kind, [
      field("conversion", text(value.conversion)),
      field("proof", textEmbeddingProof(value.proof)),
      field("check", textCheckRequirement(value.check)),
    ]);
      case "refused":
        return record(value.kind, [
      field("reason", text(value.reason)),
    ]);
    }
  });
}

export function textCheckRequirement(value: CheckRequirement): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "none":
        return record(value.kind, []);
      case "required":
        return record(value.kind, [
      field("failure", text(value.failure)),
    ]);
    }
  });
}

export function textAccessLocation(value: AccessLocation): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "data":
        return record(value.kind, [
      field("check", textCheckRequirement(value.check)),
      field("receiver", text(value.receiver)),
    ]);
      case "accessor":
        return record(value.kind, []);
    }
  });
}

export function textOperationExecution(value: OperationExecution): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "pure":
        return record(value.kind, []);
      case "invocation":
        return record(value.kind, [
      field("writesStorage", boolean(value.writesStorage)),
      field("failure", text(value.failure)),
    ]);
    }
  });
}

export function textMemberDecision(value: MemberDecision): TextWork {
  return deferred(value, () => {
    return record("MemberDecision", [
      field("key", textMemberKey(value.key)),
      field("origins", sequence(value.origins, entry0 => textMemberOrigin(entry0))),
      field("selectedDeclarations", sequence(value.selectedDeclarations, entry0 => identity("def", entry0))),
      field("primary", (value.primary === null ? token("null") : identity("def", value.primary))),
      field("read", (value.read === null ? token("null") : numericIdentity("t", value.read))),
      field("write", (value.write === null ? token("null") : numericIdentity("t", value.write))),
      field("getter", (value.getter === null ? token("null") : textHirCallableEndpoint(value.getter))),
      field("setter", (value.setter === null ? token("null") : textHirCallableEndpoint(value.setter))),
      field("bindings", textBindingVector(value.bindings)),
      field("location", textAccessLocation(value.location)),
    ]);
  });
}

export function textApplicationDecision(value: ApplicationDecision): TextWork {
  return deferred(value, () => {
    return record("ApplicationDecision", [
      field("candidate", numeric(value.candidate)),
      field("advertised", textHirCallableEndpoint(value.advertised)),
      field("api", textHirCallableEndpoint(value.api)),
      field("bindings", textBindingVector(value.bindings)),
      field("implementationBindings", textBindingVector(value.implementationBindings)),
      field("parameters", sequence(value.parameters, entry0 => textParameterMapping(entry0))),
      field("completion", textCompletionEndpoint(value.completion)),
      field("result", numericIdentity("t", value.result)),
      field("activation", (value.activation === null ? token("null") : text(value.activation))),
    ]);
  });
}

export function textConstructionPartDecision(value: ConstructionPartDecision): TextWork {
  return deferred(value, () => {
    return record("ConstructionPartDecision", [
      field("part", numeric(value.part)),
      field("source", textNodeRef(value.source)),
      field("destination", textTypeComponent(value.destination)),
      field("member", (value.member === null ? token("null") : textMemberDecision(value.member))),
      field("embedding", textEmbeddingDecision(value.embedding)),
    ]);
  });
}

export function textOperationDecision(value: OperationDecision): TextWork {
  return deferred(value, () => {
    return record(value.kind, [
      field("operation", textOperationIdentity(value.operation)),
      field("operands", sequence(value.operands, entry0 => numericIdentity("t", entry0))),
      field("result", numericIdentity("t", value.result)),
      field("execution", textOperationExecution(value.execution)),
    ]);
  });
}

export function textRefinementDecision(value: RefinementDecision): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "identity":
        return record(value.kind, [
      field("type", numericIdentity("t", value.type)),
    ]);
      case "narrowed":
        return record(value.kind, [
      field("source", numericIdentity("t", value.source)),
      field("result", numericIdentity("t", value.result)),
      field("proof", textEmbeddingProof(value.proof)),
      field("failure", text(value.failure)),
    ]);
    }
  });
}

export function textDeferredInvocation(value: DeferredInvocation): TextWork {
  return deferred(value, () => {
    switch (value.rule) {
      case "embed":
        return record("DeferredInvocation", [
      field("rule", text(value.rule)),
      field("input", textEmbedInput(value.input)),
    ]);
      case "domain-fit":
        return record("DeferredInvocation", [
      field("rule", text(value.rule)),
      field("input", textDomainFitInput(value.input)),
    ]);
      case "memory-equivalent":
        return record("DeferredInvocation", [
      field("rule", text(value.rule)),
      field("input", textMemoryEquivalentInput(value.input)),
    ]);
      case "member":
        return record("DeferredInvocation", [
      field("rule", text(value.rule)),
      field("input", textMemberInput(value.input)),
    ]);
      case "index":
        return record("DeferredInvocation", [
      field("rule", text(value.rule)),
      field("input", textIndexInput(value.input)),
    ]);
      case "construct-literal":
        return record("DeferredInvocation", [
      field("rule", text(value.rule)),
      field("input", textLiteralConstructionInput(value.input)),
    ]);
      case "candidate":
        return record("DeferredInvocation", [
      field("rule", text(value.rule)),
      field("input", textCandidateInput(value.input)),
    ]);
      case "operator":
        return record("DeferredInvocation", [
      field("rule", text(value.rule)),
      field("input", textOperatorInput(value.input)),
    ]);
      case "literal-fit":
        return record("DeferredInvocation", [
      field("rule", text(value.rule)),
      field("input", textLiteralFitInput(value.input)),
    ]);
      case "protocol":
        return record("DeferredInvocation", [
      field("rule", text(value.rule)),
      field("input", textProtocolInput(value.input)),
    ]);
      case "refinement":
        return record("DeferredInvocation", [
      field("rule", text(value.rule)),
      field("input", textRefinementInput(value.input)),
    ]);
      case "library":
        return record("DeferredInvocation", [
      field("rule", text(value.rule)),
      field("input", textLibraryInput(value.input)),
    ]);
      case "core":
        return record("DeferredInvocation", [
      field("rule", text(value.rule)),
      field("input", textCoreInput(value.input)),
    ]);
      case "closure":
        return record("DeferredInvocation", [
      field("rule", text(value.rule)),
      field("input", textClosureInput(value.input)),
    ]);
    }
  });
}

export function textEmbeddingProof(value: EmbeddingProof): TextWork {
  return deferred(value, () => {
    return record("EmbeddingProof", [
      field("steps", sequence(value.steps, entry0 => textCorrespondenceStep(entry0))),
      field("conclusion", numeric(value.conclusion)),
    ]);
  });
}

export function textParameterMapping(value: ParameterMapping): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "argument":
        return record(value.kind, [
      field("parameter", numeric(value.parameter)),
      field("argument", numeric(value.argument)),
      field("component", (value.component === null ? token("null") : numeric(value.component))),
      field("passing", text(value.passing)),
    ]);
      case "default":
        return record(value.kind, [
      field("parameter", numeric(value.parameter)),
      field("initializer", identity("body", value.initializer)),
    ]);
      case "omitted":
        return record(value.kind, [
      field("parameter", numeric(value.parameter)),
      field("type", numericIdentity("t", value.type)),
    ]);
      case "rest":
        return record(value.kind, [
      field("parameter", numeric(value.parameter)),
      field("arguments", sequence(value.arguments, entry0 => numeric(entry0))),
      field("passing", text(value.passing)),
    ]);
    }
  });
}

export function textCompletionEndpoint(value: CompletionEndpoint): TextWork {
  return deferred(value, () => {
    return record("CompletionEndpoint", [
      field("signature", numericIdentity("sig", value.signature)),
      field("completion", numericIdentity("t", value.completion)),
      field("yielded", (value.yielded === null ? token("null") : numericIdentity("t", value.yielded))),
      field("sent", (value.sent === null ? token("null") : numericIdentity("t", value.sent))),
    ]);
  });
}

export function textOperationIdentity(value: OperationIdentity): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "native-operator":
        return record(value.kind, [
      field("operator", text(value.operator)),
      field("carrier", text(value.carrier)),
    ]);
      case "bigint-operator":
        return record(value.kind, [
      field("operator", text(value.operator)),
    ]);
      case "string-operator":
        return record(value.kind, [
      field("operator", text(value.operator)),
    ]);
      case "boolean-operator":
        return record(value.kind, [
      field("operator", text(value.operator)),
    ]);
      case "absence-test":
        return record(value.kind, [
      field("negated", boolean(value.negated)),
    ]);
      case "object-construction":
      case "array-construction":
        return record(value.kind, [
      field("parts", sequence(value.parts, entry0 => textConstructionPartDecision(entry0))),
    ]);
      case "protocol":
        return record(value.kind, [
      field("protocol", text(value.protocol)),
      field("asynchronous", boolean(value.asynchronous)),
      field("steps", sequence(value.steps, entry0 => textProtocolStepDecision(entry0))),
      field("value", numericIdentity("t", value.value)),
      field("completion", numericIdentity("t", value.completion)),
      field("yielded", (value.yielded === null ? token("null") : numericIdentity("t", value.yielded))),
      field("sent", (value.sent === null ? token("null") : numericIdentity("t", value.sent))),
      field("thrown", numericIdentity("t", value.thrown)),
    ]);
      case "conversion":
        return record(value.kind, [
      field("from", numericIdentity("t", value.from)),
      field("to", numericIdentity("t", value.to)),
      field("embedding", textEmbeddingDecision(value.embedding)),
    ]);
      case "library":
      case "core":
        return record(value.kind, [
      field("declaration", identity("def", value.declaration)),
      field("bindings", textBindingVector(value.bindings)),
    ]);
      case "pointer-address":
      case "pointer-read":
      case "pointer-write":
      case "pointer-offset":
        return record(value.kind, []);
      case "type-query":
      case "discard":
        return record(value.kind, []);
    }
  });
}

export function textRuleOutcome<Value>(value: RuleOutcome<Value>, projectValue: (value: Value) => TextWork): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "decided":
        return record(value.kind, [
      field("decision", projectValue(value.decision)),
    ]);
      case "deferred":
        return record(value.kind, [
      field("deferred", textDeferredDecision(value.deferred)),
    ]);
    }
  });
}

export function textEmbedInput(value: EmbedInput): TextWork {
  return deferred(value, () => {
    return record("EmbedInput", [
      field("context", textRuleContext(value.context)),
      field("from", textTypeEvidence(value.from)),
      field("to", textTypeEvidence(value.to)),
      field("role", text(value.role)),
    ]);
  });
}

export function textDomainFitInput(value: DomainFitInput): TextWork {
  return deferred(value, () => {
    return record("DomainFitInput", [
      field("context", textRuleContext(value.context)),
      field("value", textTypeEvidence(value.value)),
      field("domain", textTypeEvidence(value.domain)),
    ]);
  });
}

export function textMemoryEquivalentInput(value: MemoryEquivalentInput): TextWork {
  return deferred(value, () => {
    return record("MemoryEquivalentInput", [
      field("context", textRuleContext(value.context)),
      field("left", textTypeEvidence(value.left)),
      field("right", textTypeEvidence(value.right)),
    ]);
  });
}

export function textMemberInput(value: MemberInput): TextWork {
  return deferred(value, () => {
    return record("MemberInput", [
      field("context", textRuleContext(value.context)),
      field("receiver", textTypeEvidence(value.receiver)),
      field("key", textMemberKey(value.key)),
      field("access", text(value.access)),
      field("origins", sequence(value.origins, entry0 => textMemberOrigin(entry0))),
    ]);
  });
}

export function textIndexInput(value: IndexInput): TextWork {
  return deferred(value, () => {
    return record("IndexInput", [
      field("context", textRuleContext(value.context)),
      field("receiver", textTypeEvidence(value.receiver)),
      field("key", textTypeEvidence(value.key)),
      field("access", text(value.access)),
    ]);
  });
}

export function textLiteralConstructionInput(value: LiteralConstructionInput): TextWork {
  return deferred(value, () => {
    return record("LiteralConstructionInput", [
      field("context", textRuleContext(value.context)),
      field("construction", text(value.construction)),
      field("parts", sequence(value.parts, entry0 => textLiteralConstructionPart(entry0))),
      field("destination", (value.destination === null ? token("null") : textTypeEvidence(value.destination))),
    ]);
  });
}

export function textCandidateInput(value: CandidateInput): TextWork {
  return deferred(value, () => {
    return record(value.kind, [
      field("context", textRuleContext(value.context)),
      field("callee", textTypeEvidence(value.callee)),
      field("receiver", (value.receiver === null ? token("null") : textTypeEvidence(value.receiver))),
      field("typeArguments", sequence(value.typeArguments, entry0 => textTypeEvidence(entry0))),
      field("arguments", sequence(value.arguments, entry0 => textCandidateArgument(entry0))),
      field("candidates", sequence(value.candidates, entry0 => textCandidateEndpoint(entry0))),
    ]);
  });
}

export function textOperatorInput(value: OperatorInput): TextWork {
  return deferred(value, () => {
    return record("OperatorInput", [
      field("context", textRuleContext(value.context)),
      field("operator", text(value.operator)),
      field("operands", sequence(value.operands, entry0 => textTypeEvidence(entry0))),
      field("permissionScope", (value.permissionScope === null ? token("null") : textNodeRef(value.permissionScope))),
    ]);
  });
}

export function textLiteralFitInput(value: LiteralFitInput): TextWork {
  return deferred(value, () => {
    return record("LiteralFitInput", [
      field("context", textRuleContext(value.context)),
      field("literal", textLiteralValue(value.literal)),
      field("destination", textTypeEvidence(value.destination)),
    ]);
  });
}

export function textProtocolInput(value: ProtocolInput): TextWork {
  return deferred(value, () => {
    return record(value.kind, [
      field("context", textRuleContext(value.context)),
      field("asynchronous", boolean(value.asynchronous)),
      field("subject", (value.subject === null ? token("null") : textTypeEvidence(value.subject))),
      field("operands", sequence(value.operands, entry0 => textTypeEvidence(entry0))),
      field("completion", (value.completion === null ? token("null") : textTypeEvidence(value.completion))),
      field("yielded", (value.yielded === null ? token("null") : textTypeEvidence(value.yielded))),
      field("sent", (value.sent === null ? token("null") : textTypeEvidence(value.sent))),
      field("thrown", textTypeEvidence(value.thrown)),
    ]);
  });
}

export function textRefinementInput(value: RefinementInput): TextWork {
  return deferred(value, () => {
    return record("RefinementInput", [
      field("context", textRuleContext(value.context)),
      field("source", textTypeEvidence(value.source)),
      field("checked", textTypeEvidence(value.checked)),
    ]);
  });
}

export function textLibraryInput(value: LibraryInput): TextWork {
  return deferred(value, () => {
    return record("LibraryInput", [
      field("context", textRuleContext(value.context)),
      field("declaration", identity("def", value.declaration)),
      field("receiver", (value.receiver === null ? token("null") : textTypeEvidence(value.receiver))),
      field("arguments", sequence(value.arguments, entry0 => textTypeEvidence(entry0))),
      field("result", textTypeEvidence(value.result)),
    ]);
  });
}

export function textCoreInput(value: CoreInput): TextWork {
  return deferred(value, () => {
    return record("CoreInput", [
      field("context", textRuleContext(value.context)),
      field("captured", textHirCoreCapture(value.captured)),
      field("declaration", identity("def", value.declaration)),
      field("operands", sequence(value.operands, entry0 => textTypeEvidence(entry0))),
      field("result", textTypeEvidence(value.result)),
      field("permissionScope", (value.permissionScope === null ? token("null") : textNodeRef(value.permissionScope))),
    ]);
  });
}

export function textClosureInput(value: ClosureInput): TextWork {
  return deferred(value, () => {
    return record("ClosureInput", [
      field("context", textRuleContext(value.context)),
      field("callable", textTypeEvidence(value.callable)),
      field("captures", sequence(value.captures, entry0 => record("ClosureCaptureEvidence", [
        field("local", textLocalRef(entry0.local)),
        field("value", textTypeEvidence(entry0.value)),
        field("reassignable", boolean(entry0.reassignable)),
        field("incoming", textCaptureSource(entry0.incoming)),
      ]))),
    ]);
  });
}

export function textCaptureSource(value: CaptureSource): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "binding":
        return record(value.kind, []);
      case "parameter":
        return record(value.kind, [
      field("passing", text(value.passing)),
    ]);
      case "capture":
        return record(value.kind, [
      field("capture", text(value.capture)),
    ]);
    }
  });
}

export function textCaptureRow(value: CaptureRow): TextWork {
  return deferred(value, () => {
    return record("CaptureRow", [
      field("local", textLocalRef(value.local)),
      field("capture", text(value.capture)),
    ]);
  });
}

export function textBodyCaptureRow(value: BodyCaptureRow): TextWork {
  return deferred(value, () => {
    return record("CaptureRow", [
      field("local", textLocalRef(value.local)),
      field("capture", value.capture === null ? token("null") : text(value.capture)),
    ]);
  });
}

export function textClosureDecision(value: ClosureDecision): TextWork {
  return deferred(value, () => {
    return record("ClosureDecision", [
      field("carrier", numericIdentity("t", value.carrier)),
      field("captures", sequence(value.captures, textCaptureRow)),
      field("execution", textOperationExecution(value.execution)),
    ]);
  });
}

export function textCorrespondenceStep(value: CorrespondenceStep): TextWork {
  return deferred(value, () => {
    return record("CorrespondenceStep", [
      field("from", textTypeComponent(value.from)),
      field("to", textTypeComponent(value.to)),
      field("rule", text(value.rule)),
      field("premises", sequence(value.premises, entry0 => numeric(entry0))),
    ]);
  });
}

export function textProtocolStepDecision(value: ProtocolStepDecision): TextWork {
  return deferred(value, () => {
    return record("ProtocolStepDecision", [
      field("role", text(value.role)),
      field("operation", textProtocolStepOperation(value.operation)),
      field("operands", sequence(value.operands, entry0 => numericIdentity("t", entry0))),
      field("result", numericIdentity("t", value.result)),
    ]);
  });
}

export function textRuleContext(value: RuleContext): TextWork {
  return deferred(value, () => {
    return record("RuleContext", [
      field("occurrence", textNodeRef(value.occurrence)),
      field("origin", textOrigin(value.origin)),
      field("bindings", textBindingVector(value.bindings)),
    ]);
  });
}

export function textLiteralConstructionPart(value: LiteralConstructionPart): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "element":
        return record(value.kind, [
      field("occurrence", textNodeRef(value.occurrence)),
      field("value", textTypeEvidence(value.value)),
    ]);
      case "property":
        return record(value.kind, [
      field("occurrence", textNodeRef(value.occurrence)),
      field("key", textMemberKey(value.key)),
      field("value", textTypeEvidence(value.value)),
    ]);
      case "spread":
        return record(value.kind, [
      field("occurrence", textNodeRef(value.occurrence)),
      field("value", textTypeEvidence(value.value)),
    ]);
    }
  });
}

export function textCandidateArgument(value: CandidateArgument): TextWork {
  return deferred(value, () => {
    return record(value.kind, [
      field("occurrence", textNodeRef(value.occurrence)),
      field("value", textTypeEvidence(value.value)),
      field("tuple", (value.tuple === null ? token("null") : sequence(value.tuple, entry0 => textTypeEvidence(entry0)))),
    ]);
  });
}

export function textCandidateEndpoint(value: CandidateEndpoint): TextWork {
  return deferred(value, () => {
    return record("CandidateEndpoint", [
      field("ordinal", numeric(value.ordinal)),
      field("declaration", identity("def", value.declaration)),
      field("advertised", textHirCallableEndpoint(value.advertised)),
      field("api", textHirCallableEndpoint(value.api)),
      field("bindings", textBindingVector(value.bindings)),
      field("conditionalFailure", (value.conditionalFailure === null ? token("null") : textDiagnostic(value.conditionalFailure))),
    ]);
  });
}

export function textProtocolStepOperation(value: ProtocolStepOperation): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "call":
        return record(value.kind, [
      field("application", textApplicationDecision(value.application)),
    ]);
      case "core":
        return record(value.kind, [
      field("declaration", identity("def", value.declaration)),
      field("bindings", textBindingVector(value.bindings)),
    ]);
      case "completion":
        return record(value.kind, []);
    }
  });
}
