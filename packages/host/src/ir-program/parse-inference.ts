import type { DefId, BodyId, TyId, SigId, LocalRef, NodeRef, Origin } from "../ids/contract.js";
import type { Diagnostic } from "../diag/contract.js";
import type { NativePrimitive, BindingVector, LiteralValue, MemberKey, MemberOrigin, PassingMode, TypeComponent, TypeEvidence } from "../ir-types/contract.js";
import type { HirCallableEndpoint, HirUnaryOperator, HirBinaryOperator, HirCoreCapture } from "../ir-hir/contract.js";
import type { AccessLocation, LogicalCapture, CheckFailure, CheckRequirement, ClosureCaptureEvidence, ClosureDecision, ClosureInput, FailureKind, HandleActivation, OperationExecution, ReceiverAccess, FlowRole, AccessRole, ProtocolKind, RuleContext, EmbedInput, DomainFitInput, MemoryEquivalentInput, MemberInput, IndexInput, LiteralConstructionPart, LiteralConstructionInput, CandidateArgument, CandidateEndpoint, CandidateInput, OperatorInput, LiteralFitInput, ProtocolInput, RefinementInput, LibraryInput, CoreInput, ConversionKind, CorrespondenceStep, EmbeddingProof, EmbeddingDecision, MemberDecision, ParameterMapping, CompletionEndpoint, ApplicationDecision, ConstructionPartDecision, ProtocolStepDecision, ProtocolStepOperation, OperationIdentity, OperationDecision, DeferredInvocation, DeferredDecision, RuleOutcome, RefinementDecision } from "../ir-infer/contract.js";
import type { Cursor, RecordFields, TextStep, TextReader } from "./parse-values.js";
import { delimiter, readNumber, choice, readBoolean, readStringChoice, readSignatureId, openRecord, closeRecord, readDefinitionId, readBodyId, readTypeId, acceptText, atomicText, fieldText, nullableText, arrayText } from "./parse-values.js";
import { readTypeEvidenceText, readTypeComponentText, readMemberKeyText, readMemberOriginText, readLiteralValueText, readBindings } from "./parse-types.js";
import { readLocalRef, readNodeRef, readDiagnostic, readOrigin } from "./parse-diagnostics.js";
import { readHirCallableEndpointText, readHirCoreCaptureText } from "./parse-core.js";

export function readDeferredDecisionText<Root>(cursor: Cursor, finish: (value: DeferredDecision) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "DeferredDecision"), fields =>
    fieldText<DeferredInvocation, Root>(cursor, fields, "invocation", readDeferredInvocationText, invocationValue =>
    fieldText<TyId, Root>(cursor, fields, "result", (next, done) => atomicText(next, readTypeId, done), resultValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ invocation: invocationValue, result: resultValue }, finish)))));
}

export function readEmbeddingDecisionText<Root>(cursor: Cursor, finish: (value: EmbeddingDecision) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["identity","conversion","refused"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      switch (label) {
        case "identity":
          return atomicText(cursor, next => closeRecord(next, fields), () =>
      acceptText({ kind: label }, finish));
        case "conversion":
          return fieldText<ConversionKind, Root>(cursor, fields, "conversion", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["numeric","literal-fit","absence","union-injection","shape","callable","readonly"]), done), conversionValue =>
    fieldText<EmbeddingProof, Root>(cursor, fields, "proof", readEmbeddingProofText, proofValue =>
      fieldText<CheckRequirement, Root>(cursor, fields, "check", readCheckRequirementText, checkValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ kind: label, conversion: conversionValue, proof: proofValue, check: checkValue }, finish)))));
        case "refused":
          return fieldText<"incompatible-domain" | "lossy-numeric" | "missing-correspondence" | "passing-mode" | "rigid-parameter", Root>(cursor, fields, "reason", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["incompatible-domain","lossy-numeric","missing-correspondence","passing-mode","rigid-parameter"]), done), reasonValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, reason: reasonValue }, finish)));
      }
    }));
}

export function readMemberDecisionText<Root>(cursor: Cursor, finish: (value: MemberDecision) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "MemberDecision"), fields =>
    fieldText<MemberKey, Root>(cursor, fields, "key", readMemberKeyText, keyValue =>
    fieldText<readonly (MemberOrigin)[], Root>(cursor, fields, "origins", (next, done) => arrayText(next, readMemberOriginText, done), originsValue =>
      fieldText<readonly (DefId)[], Root>(cursor, fields, "selectedDeclarations", (next, done) => arrayText(next, (next, done) => atomicText(next, readDefinitionId, done), done), selectedDeclarationsValue =>
        fieldText<DefId | null, Root>(cursor, fields, "primary", (next, done) => nullableText(next, (next, done) => atomicText(next, readDefinitionId, done), done), primaryValue =>
          fieldText<TyId | null, Root>(cursor, fields, "read", (next, done) => nullableText(next, (next, done) => atomicText(next, readTypeId, done), done), readValue =>
            fieldText<TyId | null, Root>(cursor, fields, "write", (next, done) => nullableText(next, (next, done) => atomicText(next, readTypeId, done), done), writeValue =>
              fieldText<HirCallableEndpoint | null, Root>(cursor, fields, "getter", (next, done) => nullableText(next, readHirCallableEndpointText, done), getterValue =>
                fieldText<HirCallableEndpoint | null, Root>(cursor, fields, "setter", (next, done) => nullableText(next, readHirCallableEndpointText, done), setterValue =>
                  fieldText<BindingVector, Root>(cursor, fields, "bindings", (next, done) => atomicText(next, readBindings, done), bindingsValue =>
                    fieldText<AccessLocation, Root>(cursor, fields, "location", readAccessLocationText, locationValue =>
                      atomicText(cursor, next => closeRecord(next, fields), () =>
                          acceptText({ key: keyValue, origins: originsValue, selectedDeclarations: selectedDeclarationsValue, primary: primaryValue, read: readValue, write: writeValue, getter: getterValue, setter: setterValue, bindings: bindingsValue, location: locationValue }, finish)))))))))))));
}

export function readCheckRequirementText<Root>(cursor: Cursor, finish: (value: CheckRequirement) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["none","required"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      switch (label) {
        case "none":
          return atomicText(cursor, next => closeRecord(next, fields), () =>
      acceptText({ kind: label }, finish));
        case "required":
          return fieldText<CheckFailure, Root>(cursor, fields, "failure", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["unwind","abort"]), done), failureValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, failure: failureValue }, finish)));
      }
    }));
}

export function readAccessLocationText<Root>(cursor: Cursor, finish: (value: AccessLocation) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["data","accessor"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      switch (label) {
        case "data":
          return fieldText<CheckRequirement, Root>(cursor, fields, "check", readCheckRequirementText, checkValue =>
    fieldText<ReceiverAccess, Root>(cursor, fields, "receiver", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["in-place","by-reference"]), done), receiverValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ kind: label, check: checkValue, receiver: receiverValue }, finish))));
        case "accessor":
          return atomicText(cursor, next => closeRecord(next, fields), () =>
      acceptText({ kind: label }, finish));
      }
    }));
}

export function readOperationExecutionText<Root>(cursor: Cursor, finish: (value: OperationExecution) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["pure","invocation"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      switch (label) {
        case "pure":
          return atomicText(cursor, next => closeRecord(next, fields), () =>
      acceptText({ kind: label }, finish));
        case "invocation":
          return fieldText<boolean, Root>(cursor, fields, "writesStorage", (next, done) => atomicText(next, readBoolean, done), writesStorageValue =>
    fieldText<FailureKind, Root>(cursor, fields, "failure", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["none","unwind","abort"]), done), failureValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ kind: label, writesStorage: writesStorageValue, failure: failureValue }, finish))));
      }
    }));
}

export function readApplicationDecisionText<Root>(cursor: Cursor, finish: (value: ApplicationDecision) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "ApplicationDecision"), fields =>
    fieldText<number, Root>(cursor, fields, "candidate", (next, done) => atomicText(next, readNumber, done), candidateValue =>
    fieldText<HirCallableEndpoint, Root>(cursor, fields, "advertised", readHirCallableEndpointText, advertisedValue =>
      fieldText<HirCallableEndpoint, Root>(cursor, fields, "api", readHirCallableEndpointText, apiValue =>
        fieldText<BindingVector, Root>(cursor, fields, "bindings", (next, done) => atomicText(next, readBindings, done), bindingsValue =>
          fieldText<BindingVector, Root>(cursor, fields, "implementationBindings", (next, done) => atomicText(next, readBindings, done), implementationBindingsValue =>
            fieldText<readonly (ParameterMapping)[], Root>(cursor, fields, "parameters", (next, done) => arrayText(next, readParameterMappingText, done), parametersValue =>
              fieldText<CompletionEndpoint, Root>(cursor, fields, "completion", readCompletionEndpointText, completionValue =>
                fieldText<TyId, Root>(cursor, fields, "result", (next, done) => atomicText(next, readTypeId, done), resultValue =>
                  fieldText<HandleActivation | null, Root>(cursor, fields, "activation", (next, done) => nullableText(next, (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["at-creation","when-first-driven"]), done), done), activationValue =>
                    atomicText(cursor, next => closeRecord(next, fields), () =>
                        acceptText({ candidate: candidateValue, advertised: advertisedValue, api: apiValue, bindings: bindingsValue, implementationBindings: implementationBindingsValue, parameters: parametersValue, completion: completionValue, result: resultValue, activation: activationValue }, finish))))))))))));
}

export function readConstructionPartDecisionText<Root>(cursor: Cursor, finish: (value: ConstructionPartDecision) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "ConstructionPartDecision"), fields =>
    fieldText<number, Root>(cursor, fields, "part", (next, done) => atomicText(next, readNumber, done), partValue =>
    fieldText<NodeRef, Root>(cursor, fields, "source", (next, done) => atomicText(next, readNodeRef, done), sourceValue =>
      fieldText<TypeComponent, Root>(cursor, fields, "destination", readTypeComponentText, destinationValue =>
        fieldText<MemberDecision | null, Root>(cursor, fields, "member", (next, done) => nullableText(next, readMemberDecisionText, done), memberValue =>
          fieldText<EmbeddingDecision, Root>(cursor, fields, "embedding", readEmbeddingDecisionText, embeddingValue =>
            atomicText(cursor, next => closeRecord(next, fields), () =>
                acceptText({ part: partValue, source: sourceValue, destination: destinationValue, member: memberValue, embedding: embeddingValue }, finish))))))));
}

export function readOperationDecisionWith<Identity extends OperationIdentity, Root>(
  cursor: Cursor, readIdentity: TextReader<Identity>, finish: (value: OperationDecision & { readonly operation: Identity }) => TextStep<Root>,
): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["selected"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      return fieldText<Identity, Root>(cursor, fields, "operation", readIdentity, operationValue =>
    fieldText<readonly (TyId)[], Root>(cursor, fields, "operands", (next, done) => arrayText(next, (next, done) => atomicText(next, readTypeId, done), done), operandsValue =>
      fieldText<TyId, Root>(cursor, fields, "result", (next, done) => atomicText(next, readTypeId, done), resultValue =>
        fieldText<OperationExecution, Root>(cursor, fields, "execution", readOperationExecutionText, executionValue =>
          atomicText(cursor, next => closeRecord(next, fields), () =>
              acceptText({ kind: label, operation: operationValue, operands: operandsValue, result: resultValue, execution: executionValue }, finish))))));
    }));
}

export function readRefinementDecisionText<Root>(cursor: Cursor, finish: (value: RefinementDecision) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["identity","narrowed"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      switch (label) {
        case "identity":
          return fieldText<TyId, Root>(cursor, fields, "type", (next, done) => atomicText(next, readTypeId, done), typeValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, type: typeValue }, finish)));
        case "narrowed":
          return fieldText<TyId, Root>(cursor, fields, "source", (next, done) => atomicText(next, readTypeId, done), sourceValue =>
    fieldText<TyId, Root>(cursor, fields, "result", (next, done) => atomicText(next, readTypeId, done), resultValue =>
      fieldText<EmbeddingProof, Root>(cursor, fields, "proof", readEmbeddingProofText, proofValue =>
        fieldText<CheckFailure, Root>(cursor, fields, "failure", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["unwind","abort"]), done), failureValue =>
          atomicText(cursor, next => closeRecord(next, fields), () =>
              acceptText({ kind: label, source: sourceValue, result: resultValue, proof: proofValue, failure: failureValue }, finish))))));
      }
    }));
}

export function readDeferredInvocationText<Root>(cursor: Cursor, finish: (value: DeferredInvocation) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "DeferredInvocation"), fields =>
    fieldText<"embed" | "domain-fit" | "memory-equivalent" | "member" | "index" | "construct-literal" | "candidate" | "operator" | "literal-fit" | "protocol" | "refinement" | "library" | "core" | "closure", Root>(cursor, fields, "rule", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["embed","domain-fit","memory-equivalent","member","index","construct-literal","candidate","operator","literal-fit","protocol","refinement","library","core","closure"]), done), ruleValue => {
    switch (ruleValue) {
      case "embed":
        return fieldText<EmbedInput, Root>(cursor, fields, "input", readEmbedInputText, inputValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ rule: ruleValue, input: inputValue }, finish)));
      case "domain-fit":
        return fieldText<DomainFitInput, Root>(cursor, fields, "input", readDomainFitInputText, inputValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ rule: ruleValue, input: inputValue }, finish)));
      case "memory-equivalent":
        return fieldText<MemoryEquivalentInput, Root>(cursor, fields, "input", readMemoryEquivalentInputText, inputValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ rule: ruleValue, input: inputValue }, finish)));
      case "member":
        return fieldText<MemberInput, Root>(cursor, fields, "input", readMemberInputText, inputValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ rule: ruleValue, input: inputValue }, finish)));
      case "index":
        return fieldText<IndexInput, Root>(cursor, fields, "input", readIndexInputText, inputValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ rule: ruleValue, input: inputValue }, finish)));
      case "construct-literal":
        return fieldText<LiteralConstructionInput, Root>(cursor, fields, "input", readLiteralConstructionInputText, inputValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ rule: ruleValue, input: inputValue }, finish)));
      case "candidate":
        return fieldText<CandidateInput, Root>(cursor, fields, "input", readCandidateInputText, inputValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ rule: ruleValue, input: inputValue }, finish)));
      case "operator":
        return fieldText<OperatorInput, Root>(cursor, fields, "input", readOperatorInputText, inputValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ rule: ruleValue, input: inputValue }, finish)));
      case "literal-fit":
        return fieldText<LiteralFitInput, Root>(cursor, fields, "input", readLiteralFitInputText, inputValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ rule: ruleValue, input: inputValue }, finish)));
      case "protocol":
        return fieldText<ProtocolInput, Root>(cursor, fields, "input", readProtocolInputText, inputValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ rule: ruleValue, input: inputValue }, finish)));
      case "refinement":
        return fieldText<RefinementInput, Root>(cursor, fields, "input", readRefinementInputText, inputValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ rule: ruleValue, input: inputValue }, finish)));
      case "library":
        return fieldText<LibraryInput, Root>(cursor, fields, "input", readLibraryInputText, inputValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ rule: ruleValue, input: inputValue }, finish)));
      case "core":
        return fieldText<CoreInput, Root>(cursor, fields, "input", readCoreInputText, inputValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ rule: ruleValue, input: inputValue }, finish)));
      case "closure":
        return fieldText<ClosureInput, Root>(cursor, fields, "input", readClosureInputText, inputValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ rule: ruleValue, input: inputValue }, finish)));
    }
    }));
}

export function readEmbeddingProofText<Root>(cursor: Cursor, finish: (value: EmbeddingProof) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "EmbeddingProof"), fields =>
    fieldText<readonly (CorrespondenceStep)[], Root>(cursor, fields, "steps", (next, done) => arrayText(next, readCorrespondenceStepText, done), stepsValue =>
    fieldText<number, Root>(cursor, fields, "conclusion", (next, done) => atomicText(next, readNumber, done), conclusionValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ steps: stepsValue, conclusion: conclusionValue }, finish)))));
}

export function readParameterMappingText<Root>(cursor: Cursor, finish: (value: ParameterMapping) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["argument","default","omitted","rest"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      switch (label) {
        case "argument":
          return fieldText<number, Root>(cursor, fields, "parameter", (next, done) => atomicText(next, readNumber, done), parameterValue =>
    fieldText<number, Root>(cursor, fields, "argument", (next, done) => atomicText(next, readNumber, done), argumentValue =>
      fieldText<number | null, Root>(cursor, fields, "component", (next, done) => nullableText(next, (next, done) => atomicText(next, readNumber, done), done), componentValue =>
        fieldText<PassingMode, Root>(cursor, fields, "passing", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["by-value","byref-readonly","byref-readwrite","byref-writeonly-must-init","borrow-shared","borrow-mut","move"]), done), passingValue =>
          atomicText(cursor, next => closeRecord(next, fields), () =>
              acceptText({ kind: label, parameter: parameterValue, argument: argumentValue, component: componentValue, passing: passingValue }, finish))))));
        case "default":
          return fieldText<number, Root>(cursor, fields, "parameter", (next, done) => atomicText(next, readNumber, done), parameterValue =>
    fieldText<BodyId, Root>(cursor, fields, "initializer", (next, done) => atomicText(next, readBodyId, done), initializerValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ kind: label, parameter: parameterValue, initializer: initializerValue }, finish))));
        case "omitted":
          return fieldText<number, Root>(cursor, fields, "parameter", (next, done) => atomicText(next, readNumber, done), parameterValue =>
    fieldText<TyId, Root>(cursor, fields, "type", (next, done) => atomicText(next, readTypeId, done), typeValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ kind: label, parameter: parameterValue, type: typeValue }, finish))));
        case "rest":
          return fieldText<number, Root>(cursor, fields, "parameter", (next, done) => atomicText(next, readNumber, done), parameterValue =>
    fieldText<readonly (number)[], Root>(cursor, fields, "arguments", (next, done) => arrayText(next, (next, done) => atomicText(next, readNumber, done), done), argumentsValue =>
      fieldText<PassingMode, Root>(cursor, fields, "passing", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["by-value","byref-readonly","byref-readwrite","byref-writeonly-must-init","borrow-shared","borrow-mut","move"]), done), passingValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ kind: label, parameter: parameterValue, arguments: argumentsValue, passing: passingValue }, finish)))));
      }
    }));
}

export function readCompletionEndpointText<Root>(cursor: Cursor, finish: (value: CompletionEndpoint) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "CompletionEndpoint"), fields =>
    fieldText<SigId, Root>(cursor, fields, "signature", (next, done) => atomicText(next, readSignatureId, done), signatureValue =>
    fieldText<TyId, Root>(cursor, fields, "completion", (next, done) => atomicText(next, readTypeId, done), completionValue =>
      fieldText<TyId | null, Root>(cursor, fields, "yielded", (next, done) => nullableText(next, (next, done) => atomicText(next, readTypeId, done), done), yieldedValue =>
        fieldText<TyId | null, Root>(cursor, fields, "sent", (next, done) => nullableText(next, (next, done) => atomicText(next, readTypeId, done), done), sentValue =>
          atomicText(cursor, next => closeRecord(next, fields), () =>
              acceptText({ signature: signatureValue, completion: completionValue, yielded: yieldedValue, sent: sentValue }, finish)))))));
}

function conversionIdentityFields<Root>(
  cursor: Cursor, fields: RecordFields, finish: (value: OperationIdentity & { readonly kind: "conversion" }) => TextStep<Root>,
): TextStep<Root> {
  return fieldText<TyId, Root>(cursor, fields, "from", (next, done) => atomicText(next, readTypeId, done), fromValue =>
    fieldText<TyId, Root>(cursor, fields, "to", (next, done) => atomicText(next, readTypeId, done), toValue =>
      fieldText<EmbeddingDecision, Root>(cursor, fields, "embedding", readEmbeddingDecisionText, embeddingValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ kind: "conversion", from: fromValue, to: toValue, embedding: embeddingValue }, finish)))));
}

function backedIdentityFields<Root>(
  cursor: Cursor, fields: RecordFields, label: "library" | "core",
  finish: (value: OperationIdentity & { readonly kind: "library" | "core" }) => TextStep<Root>,
): TextStep<Root> {
  return fieldText<DefId, Root>(cursor, fields, "declaration", (next, done) => atomicText(next, readDefinitionId, done), declarationValue =>
    fieldText<BindingVector, Root>(cursor, fields, "bindings", (next, done) => atomicText(next, readBindings, done), bindingsValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ kind: label, declaration: declarationValue, bindings: bindingsValue }, finish))));
}

export function readConversionIdentityText<Root>(
  cursor: Cursor, finish: (value: OperationIdentity & { readonly kind: "conversion" }) => TextStep<Root>,
): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["conversion"]), () =>
    atomicText(cursor, next => delimiter(next, "("), () => conversionIdentityFields(cursor, { given: new Set<string>() }, finish)));
}

export function readBackedIdentityText<Root>(
  cursor: Cursor, finish: (value: OperationIdentity & { readonly kind: "library" | "core" }) => TextStep<Root>,
): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["library", "core"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => backedIdentityFields(cursor, { given: new Set<string>() }, label, finish)));
}

export function readOperationIdentityText<Root>(cursor: Cursor, finish: (value: OperationIdentity) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["native-operator","bigint-operator","string-operator","boolean-operator","absence-test","object-construction","array-construction","protocol","conversion","library","core","pointer-address","pointer-read","pointer-write","pointer-offset","type-query","discard"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      switch (label) {
        case "native-operator":
          return fieldText<HirUnaryOperator | HirBinaryOperator, Root>(cursor, fields, "operator", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["+","-","!","~","typeof","void","delete","+","-","*","/","%","**","&","|","^","<<",">>",">>>","<","<=",">",">=","==","!=","===","!==","in","instanceof"]), done), operatorValue =>
    fieldText<NativePrimitive, Root>(cursor, fields, "carrier", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["bool","char","int8","uint8","int16","uint16","int32","uint32","int64","uint64","int128","uint128","native-int","native-uint","float16","float32","float64","decimal"]), done), carrierValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ kind: label, operator: operatorValue, carrier: carrierValue }, finish))));
        case "bigint-operator":
          return fieldText<HirUnaryOperator | HirBinaryOperator, Root>(cursor, fields, "operator", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["+","-","!","~","typeof","void","delete","+","-","*","/","%","**","&","|","^","<<",">>",">>>","<","<=",">",">=","==","!=","===","!==","in","instanceof"]), done), operatorValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, operator: operatorValue }, finish)));
        case "string-operator":
          return fieldText<"+" | "==" | "!=" | "===" | "!==" | "<" | "<=" | ">" | ">=", Root>(cursor, fields, "operator", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["+","==","!=","===","!==","<","<=",">",">="]), done), operatorValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, operator: operatorValue }, finish)));
        case "boolean-operator":
          return fieldText<"!" | "&&" | "||" | "==" | "!=" | "===" | "!==", Root>(cursor, fields, "operator", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["!","&&","||","==","!=","===","!=="]), done), operatorValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, operator: operatorValue }, finish)));
        case "absence-test":
          return fieldText<boolean, Root>(cursor, fields, "negated", (next, done) => atomicText(next, readBoolean, done), negatedValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, negated: negatedValue }, finish)));
        case "object-construction":
        case "array-construction":
          return fieldText<readonly (ConstructionPartDecision)[], Root>(cursor, fields, "parts", (next, done) => arrayText(next, readConstructionPartDecisionText, done), partsValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, parts: partsValue }, finish)));
        case "protocol":
          return fieldText<ProtocolKind, Root>(cursor, fields, "protocol", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["iterate","await","yield","delegate","dispose","spread","argument-passing","pointer"]), done), protocolValue =>
    fieldText<boolean, Root>(cursor, fields, "asynchronous", (next, done) => atomicText(next, readBoolean, done), asynchronousValue =>
      fieldText<readonly (ProtocolStepDecision)[], Root>(cursor, fields, "steps", (next, done) => arrayText(next, readProtocolStepDecisionText, done), stepsValue =>
        fieldText<TyId, Root>(cursor, fields, "value", (next, done) => atomicText(next, readTypeId, done), valueValue =>
          fieldText<TyId, Root>(cursor, fields, "completion", (next, done) => atomicText(next, readTypeId, done), completionValue =>
            fieldText<TyId | null, Root>(cursor, fields, "yielded", (next, done) => nullableText(next, (next, done) => atomicText(next, readTypeId, done), done), yieldedValue =>
              fieldText<TyId | null, Root>(cursor, fields, "sent", (next, done) => nullableText(next, (next, done) => atomicText(next, readTypeId, done), done), sentValue =>
                fieldText<TyId, Root>(cursor, fields, "thrown", (next, done) => atomicText(next, readTypeId, done), thrownValue =>
                  atomicText(cursor, next => closeRecord(next, fields), () =>
                      acceptText({ kind: label, protocol: protocolValue, asynchronous: asynchronousValue, steps: stepsValue, value: valueValue, completion: completionValue, yielded: yieldedValue, sent: sentValue, thrown: thrownValue }, finish))))))))));
        case "conversion": return conversionIdentityFields(cursor, fields, finish);
        case "library":
        case "core": return backedIdentityFields(cursor, fields, label, finish);
        case "pointer-address":
        case "pointer-read":
        case "pointer-write":
        case "pointer-offset":
        case "type-query":
        case "discard":
          return atomicText(cursor, next => closeRecord(next, fields), () =>
      acceptText({ kind: label }, finish));
      }
    }));
}

export function readRuleOutcomeText<Value, Root>(cursor: Cursor, readValue: TextReader<Value>, finish: (value: RuleOutcome<Value>) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["decided","deferred"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      switch (label) {
        case "decided":
          return fieldText<Value, Root>(cursor, fields, "decision", readValue, decisionValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, decision: decisionValue }, finish)));
        case "deferred":
          return fieldText<DeferredDecision, Root>(cursor, fields, "deferred", readDeferredDecisionText, deferredValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, deferred: deferredValue }, finish)));
      }
    }));
}

export function readEmbedInputText<Root>(cursor: Cursor, finish: (value: EmbedInput) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "EmbedInput"), fields =>
    fieldText<RuleContext, Root>(cursor, fields, "context", readRuleContextText, contextValue =>
    fieldText<TypeEvidence, Root>(cursor, fields, "from", readTypeEvidenceText, fromValue =>
      fieldText<TypeEvidence, Root>(cursor, fields, "to", readTypeEvidenceText, toValue =>
        fieldText<FlowRole, Root>(cursor, fields, "role", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["initialization","assignment","argument","return","receiver","yield","member-write"]), done), roleValue =>
          atomicText(cursor, next => closeRecord(next, fields), () =>
              acceptText({ context: contextValue, from: fromValue, to: toValue, role: roleValue }, finish)))))));
}

export function readDomainFitInputText<Root>(cursor: Cursor, finish: (value: DomainFitInput) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "DomainFitInput"), fields =>
    fieldText<RuleContext, Root>(cursor, fields, "context", readRuleContextText, contextValue =>
    fieldText<TypeEvidence, Root>(cursor, fields, "value", readTypeEvidenceText, valueValue =>
      fieldText<TypeEvidence, Root>(cursor, fields, "domain", readTypeEvidenceText, domainValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ context: contextValue, value: valueValue, domain: domainValue }, finish))))));
}

export function readMemoryEquivalentInputText<Root>(cursor: Cursor, finish: (value: MemoryEquivalentInput) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "MemoryEquivalentInput"), fields =>
    fieldText<RuleContext, Root>(cursor, fields, "context", readRuleContextText, contextValue =>
    fieldText<TypeEvidence, Root>(cursor, fields, "left", readTypeEvidenceText, leftValue =>
      fieldText<TypeEvidence, Root>(cursor, fields, "right", readTypeEvidenceText, rightValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ context: contextValue, left: leftValue, right: rightValue }, finish))))));
}

export function readMemberInputText<Root>(cursor: Cursor, finish: (value: MemberInput) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "MemberInput"), fields =>
    fieldText<RuleContext, Root>(cursor, fields, "context", readRuleContextText, contextValue =>
    fieldText<TypeEvidence, Root>(cursor, fields, "receiver", readTypeEvidenceText, receiverValue =>
      fieldText<MemberKey, Root>(cursor, fields, "key", readMemberKeyText, keyValue =>
        fieldText<AccessRole, Root>(cursor, fields, "access", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["read","write","call"]), done), accessValue =>
          fieldText<readonly (MemberOrigin)[], Root>(cursor, fields, "origins", (next, done) => arrayText(next, readMemberOriginText, done), originsValue =>
            atomicText(cursor, next => closeRecord(next, fields), () =>
                acceptText({ context: contextValue, receiver: receiverValue, key: keyValue, access: accessValue, origins: originsValue }, finish))))))));
}

export function readIndexInputText<Root>(cursor: Cursor, finish: (value: IndexInput) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "IndexInput"), fields =>
    fieldText<RuleContext, Root>(cursor, fields, "context", readRuleContextText, contextValue =>
    fieldText<TypeEvidence, Root>(cursor, fields, "receiver", readTypeEvidenceText, receiverValue =>
      fieldText<TypeEvidence, Root>(cursor, fields, "key", readTypeEvidenceText, keyValue =>
        fieldText<AccessRole, Root>(cursor, fields, "access", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["read","write","call"]), done), accessValue =>
          atomicText(cursor, next => closeRecord(next, fields), () =>
              acceptText({ context: contextValue, receiver: receiverValue, key: keyValue, access: accessValue }, finish)))))));
}

export function readLiteralConstructionInputText<Root>(cursor: Cursor, finish: (value: LiteralConstructionInput) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "LiteralConstructionInput"), fields =>
    fieldText<RuleContext, Root>(cursor, fields, "context", readRuleContextText, contextValue =>
    fieldText<"object" | "array", Root>(cursor, fields, "construction", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["object","array"]), done), constructionValue =>
      fieldText<readonly (LiteralConstructionPart)[], Root>(cursor, fields, "parts", (next, done) => arrayText(next, readLiteralConstructionPartText, done), partsValue =>
        fieldText<TypeEvidence | null, Root>(cursor, fields, "destination", (next, done) => nullableText(next, readTypeEvidenceText, done), destinationValue =>
          atomicText(cursor, next => closeRecord(next, fields), () =>
              acceptText({ context: contextValue, construction: constructionValue, parts: partsValue, destination: destinationValue }, finish)))))));
}

export function readCandidateInputText<Root>(cursor: Cursor, finish: (value: CandidateInput) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["call","construct","accessor-get","accessor-set"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      return fieldText<RuleContext, Root>(cursor, fields, "context", readRuleContextText, contextValue =>
    fieldText<TypeEvidence, Root>(cursor, fields, "callee", readTypeEvidenceText, calleeValue =>
      fieldText<TypeEvidence | null, Root>(cursor, fields, "receiver", (next, done) => nullableText(next, readTypeEvidenceText, done), receiverValue =>
        fieldText<readonly (TypeEvidence)[], Root>(cursor, fields, "typeArguments", (next, done) => arrayText(next, readTypeEvidenceText, done), typeArgumentsValue =>
          fieldText<readonly (CandidateArgument)[], Root>(cursor, fields, "arguments", (next, done) => arrayText(next, readCandidateArgumentText, done), argumentsValue =>
            fieldText<readonly (CandidateEndpoint)[], Root>(cursor, fields, "candidates", (next, done) => arrayText(next, readCandidateEndpointText, done), candidatesValue =>
              atomicText(cursor, next => closeRecord(next, fields), () =>
                  acceptText({ kind: label, context: contextValue, callee: calleeValue, receiver: receiverValue, typeArguments: typeArgumentsValue, arguments: argumentsValue, candidates: candidatesValue }, finish))))))));
    }));
}

export function readOperatorInputText<Root>(cursor: Cursor, finish: (value: OperatorInput) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "OperatorInput"), fields =>
    fieldText<RuleContext, Root>(cursor, fields, "context", readRuleContextText, contextValue =>
    fieldText<HirUnaryOperator | HirBinaryOperator, Root>(cursor, fields, "operator", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["+","-","!","~","typeof","void","delete","+","-","*","/","%","**","&","|","^","<<",">>",">>>","<","<=",">",">=","==","!=","===","!==","in","instanceof"]), done), operatorValue =>
      fieldText<readonly (TypeEvidence)[], Root>(cursor, fields, "operands", (next, done) => arrayText(next, readTypeEvidenceText, done), operandsValue =>
        fieldText<NodeRef | null, Root>(cursor, fields, "permissionScope", (next, done) => nullableText(next, (next, done) => atomicText(next, readNodeRef, done), done), permissionScopeValue =>
          atomicText(cursor, next => closeRecord(next, fields), () =>
              acceptText({ context: contextValue, operator: operatorValue, operands: operandsValue, permissionScope: permissionScopeValue }, finish)))))));
}

export function readLiteralFitInputText<Root>(cursor: Cursor, finish: (value: LiteralFitInput) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "LiteralFitInput"), fields =>
    fieldText<RuleContext, Root>(cursor, fields, "context", readRuleContextText, contextValue =>
    fieldText<LiteralValue, Root>(cursor, fields, "literal", readLiteralValueText, literalValue =>
      fieldText<TypeEvidence, Root>(cursor, fields, "destination", readTypeEvidenceText, destinationValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ context: contextValue, literal: literalValue, destination: destinationValue }, finish))))));
}

export function readProtocolInputText<Root>(cursor: Cursor, finish: (value: ProtocolInput) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["iterate","await","yield","delegate","dispose","spread","argument-passing","pointer"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      return fieldText<RuleContext, Root>(cursor, fields, "context", readRuleContextText, contextValue =>
    fieldText<boolean, Root>(cursor, fields, "asynchronous", (next, done) => atomicText(next, readBoolean, done), asynchronousValue =>
      fieldText<TypeEvidence | null, Root>(cursor, fields, "subject", (next, done) => nullableText(next, readTypeEvidenceText, done), subjectValue =>
        fieldText<readonly (TypeEvidence)[], Root>(cursor, fields, "operands", (next, done) => arrayText(next, readTypeEvidenceText, done), operandsValue =>
          fieldText<TypeEvidence | null, Root>(cursor, fields, "completion", (next, done) => nullableText(next, readTypeEvidenceText, done), completionValue =>
            fieldText<TypeEvidence | null, Root>(cursor, fields, "yielded", (next, done) => nullableText(next, readTypeEvidenceText, done), yieldedValue =>
              fieldText<TypeEvidence | null, Root>(cursor, fields, "sent", (next, done) => nullableText(next, readTypeEvidenceText, done), sentValue =>
                fieldText<TypeEvidence, Root>(cursor, fields, "thrown", readTypeEvidenceText, thrownValue =>
                  atomicText(cursor, next => closeRecord(next, fields), () =>
                      acceptText({ kind: label, context: contextValue, asynchronous: asynchronousValue, subject: subjectValue, operands: operandsValue, completion: completionValue, yielded: yieldedValue, sent: sentValue, thrown: thrownValue }, finish))))))))));
    }));
}

export function readRefinementInputText<Root>(cursor: Cursor, finish: (value: RefinementInput) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "RefinementInput"), fields =>
    fieldText<RuleContext, Root>(cursor, fields, "context", readRuleContextText, contextValue =>
    fieldText<TypeEvidence, Root>(cursor, fields, "source", readTypeEvidenceText, sourceValue =>
      fieldText<TypeEvidence, Root>(cursor, fields, "checked", readTypeEvidenceText, checkedValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ context: contextValue, source: sourceValue, checked: checkedValue }, finish))))));
}

export function readLibraryInputText<Root>(cursor: Cursor, finish: (value: LibraryInput) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "LibraryInput"), fields =>
    fieldText<RuleContext, Root>(cursor, fields, "context", readRuleContextText, contextValue =>
    fieldText<DefId, Root>(cursor, fields, "declaration", (next, done) => atomicText(next, readDefinitionId, done), declarationValue =>
      fieldText<TypeEvidence | null, Root>(cursor, fields, "receiver", (next, done) => nullableText(next, readTypeEvidenceText, done), receiverValue =>
        fieldText<readonly (TypeEvidence)[], Root>(cursor, fields, "arguments", (next, done) => arrayText(next, readTypeEvidenceText, done), argumentsValue =>
          fieldText<TypeEvidence, Root>(cursor, fields, "result", readTypeEvidenceText, resultValue =>
            atomicText(cursor, next => closeRecord(next, fields), () =>
                acceptText({ context: contextValue, declaration: declarationValue, receiver: receiverValue, arguments: argumentsValue, result: resultValue }, finish))))))));
}

export function readCoreInputText<Root>(cursor: Cursor, finish: (value: CoreInput) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "CoreInput"), fields =>
    fieldText<RuleContext, Root>(cursor, fields, "context", readRuleContextText, contextValue =>
    fieldText<HirCoreCapture, Root>(cursor, fields, "captured", readHirCoreCaptureText, capturedValue =>
      fieldText<DefId, Root>(cursor, fields, "declaration", (next, done) => atomicText(next, readDefinitionId, done), declarationValue =>
        fieldText<readonly (TypeEvidence)[], Root>(cursor, fields, "operands", (next, done) => arrayText(next, readTypeEvidenceText, done), operandsValue =>
          fieldText<TypeEvidence, Root>(cursor, fields, "result", readTypeEvidenceText, resultValue =>
            fieldText<NodeRef | null, Root>(cursor, fields, "permissionScope", (next, done) => nullableText(next, (next, done) => atomicText(next, readNodeRef, done), done), permissionScopeValue =>
              atomicText(cursor, next => closeRecord(next, fields), () =>
                  acceptText({ context: contextValue, captured: capturedValue, declaration: declarationValue, operands: operandsValue, result: resultValue, permissionScope: permissionScopeValue }, finish)))))))));
}

export function readClosureInputText<Root>(cursor: Cursor, finish: (value: ClosureInput) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "ClosureInput"), fields =>
    fieldText<RuleContext, Root>(cursor, fields, "context", readRuleContextText, contextValue =>
    fieldText<TypeEvidence, Root>(cursor, fields, "callable", readTypeEvidenceText, callableValue =>
      fieldText<readonly (ClosureCaptureEvidence)[], Root>(cursor, fields, "captures", (next, done) => arrayText(next, readClosureCaptureEvidenceText, done), capturesValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ context: contextValue, callable: callableValue, captures: capturesValue }, finish))))));
}

export function readClosureCaptureEvidenceText<Root>(cursor: Cursor, finish: (value: ClosureCaptureEvidence) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "ClosureCaptureEvidence"), fields =>
    fieldText<LocalRef, Root>(cursor, fields, "local", (next, done) => atomicText(next, readLocalRef, done), localValue =>
    fieldText<TypeEvidence, Root>(cursor, fields, "value", readTypeEvidenceText, valueValue =>
      fieldText<boolean, Root>(cursor, fields, "reassignable", (next, done) => atomicText(next, readBoolean, done), reassignableValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ local: localValue, value: valueValue, reassignable: reassignableValue }, finish))))));
}

export function readClosureDecisionText<Root>(cursor: Cursor, finish: (value: ClosureDecision) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "ClosureDecision"), fields =>
    fieldText<TyId, Root>(cursor, fields, "carrier", (next, done) => atomicText(next, readTypeId, done), carrierValue =>
    fieldText<readonly (LogicalCapture)[], Root>(cursor, fields, "captures", (next, done) => arrayText(next, (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["captured-value","captured-location"]), done), done), capturesValue =>
      fieldText<OperationExecution, Root>(cursor, fields, "execution", readOperationExecutionText, executionValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ carrier: carrierValue, captures: capturesValue, execution: executionValue }, finish))))));
}

export function readCorrespondenceStepText<Root>(cursor: Cursor, finish: (value: CorrespondenceStep) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "CorrespondenceStep"), fields =>
    fieldText<TypeComponent, Root>(cursor, fields, "from", readTypeComponentText, fromValue =>
    fieldText<TypeComponent, Root>(cursor, fields, "to", readTypeComponentText, toValue =>
      fieldText<"identity" | ConversionKind, Root>(cursor, fields, "rule", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["identity","numeric","literal-fit","absence","union-injection","shape","callable","readonly"]), done), ruleValue =>
        fieldText<readonly (number)[], Root>(cursor, fields, "premises", (next, done) => arrayText(next, (next, done) => atomicText(next, readNumber, done), done), premisesValue =>
          atomicText(cursor, next => closeRecord(next, fields), () =>
              acceptText({ from: fromValue, to: toValue, rule: ruleValue, premises: premisesValue }, finish)))))));
}

export function readProtocolStepDecisionText<Root>(cursor: Cursor, finish: (value: ProtocolStepDecision) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "ProtocolStepDecision"), fields =>
    fieldText<"acquire" | "next" | "done" | "value" | "finish" | "fail" | "await" | "dispose" | "completion", Root>(cursor, fields, "role", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["acquire","next","done","value","finish","fail","await","dispose","completion"]), done), roleValue =>
    fieldText<ProtocolStepOperation, Root>(cursor, fields, "operation", readProtocolStepOperationText, operationValue =>
      fieldText<readonly (TyId)[], Root>(cursor, fields, "operands", (next, done) => arrayText(next, (next, done) => atomicText(next, readTypeId, done), done), operandsValue =>
        fieldText<TyId, Root>(cursor, fields, "result", (next, done) => atomicText(next, readTypeId, done), resultValue =>
          atomicText(cursor, next => closeRecord(next, fields), () =>
              acceptText({ role: roleValue, operation: operationValue, operands: operandsValue, result: resultValue }, finish)))))));
}

export function readRuleContextText<Root>(cursor: Cursor, finish: (value: RuleContext) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "RuleContext"), fields =>
    fieldText<NodeRef, Root>(cursor, fields, "occurrence", (next, done) => atomicText(next, readNodeRef, done), occurrenceValue =>
    fieldText<Origin, Root>(cursor, fields, "origin", (next, done) => atomicText(next, readOrigin, done), originValue =>
      fieldText<BindingVector, Root>(cursor, fields, "bindings", (next, done) => atomicText(next, readBindings, done), bindingsValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ occurrence: occurrenceValue, origin: originValue, bindings: bindingsValue }, finish))))));
}

export function readLiteralConstructionPartText<Root>(cursor: Cursor, finish: (value: LiteralConstructionPart) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["element","property","spread"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      switch (label) {
        case "element":
        case "spread":
          return fieldText<NodeRef, Root>(cursor, fields, "occurrence", (next, done) => atomicText(next, readNodeRef, done), occurrenceValue =>
    fieldText<TypeEvidence, Root>(cursor, fields, "value", readTypeEvidenceText, valueValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ kind: label, occurrence: occurrenceValue, value: valueValue }, finish))));
        case "property":
          return fieldText<NodeRef, Root>(cursor, fields, "occurrence", (next, done) => atomicText(next, readNodeRef, done), occurrenceValue =>
    fieldText<MemberKey, Root>(cursor, fields, "key", readMemberKeyText, keyValue =>
      fieldText<TypeEvidence, Root>(cursor, fields, "value", readTypeEvidenceText, valueValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ kind: label, occurrence: occurrenceValue, key: keyValue, value: valueValue }, finish)))));
      }
    }));
}

export function readCandidateArgumentText<Root>(cursor: Cursor, finish: (value: CandidateArgument) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["value","spread"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      return fieldText<NodeRef, Root>(cursor, fields, "occurrence", (next, done) => atomicText(next, readNodeRef, done), occurrenceValue =>
    fieldText<TypeEvidence, Root>(cursor, fields, "value", readTypeEvidenceText, valueValue =>
      fieldText<readonly (TypeEvidence)[] | null, Root>(cursor, fields, "tuple", (next, done) => nullableText(next, (next, done) => arrayText(next, readTypeEvidenceText, done), done), tupleValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ kind: label, occurrence: occurrenceValue, value: valueValue, tuple: tupleValue }, finish)))));
    }));
}

export function readCandidateEndpointText<Root>(cursor: Cursor, finish: (value: CandidateEndpoint) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "CandidateEndpoint"), fields =>
    fieldText<number, Root>(cursor, fields, "ordinal", (next, done) => atomicText(next, readNumber, done), ordinalValue =>
    fieldText<DefId, Root>(cursor, fields, "declaration", (next, done) => atomicText(next, readDefinitionId, done), declarationValue =>
      fieldText<HirCallableEndpoint, Root>(cursor, fields, "advertised", readHirCallableEndpointText, advertisedValue =>
        fieldText<HirCallableEndpoint, Root>(cursor, fields, "api", readHirCallableEndpointText, apiValue =>
          fieldText<BindingVector, Root>(cursor, fields, "bindings", (next, done) => atomicText(next, readBindings, done), bindingsValue =>
            fieldText<Diagnostic | null, Root>(cursor, fields, "conditionalFailure", (next, done) => nullableText(next, (next, done) => atomicText(next, readDiagnostic, done), done), conditionalFailureValue =>
              atomicText(cursor, next => closeRecord(next, fields), () =>
                  acceptText({ ordinal: ordinalValue, declaration: declarationValue, advertised: advertisedValue, api: apiValue, bindings: bindingsValue, conditionalFailure: conditionalFailureValue }, finish)))))))));
}

export function readProtocolStepOperationText<Root>(cursor: Cursor, finish: (value: ProtocolStepOperation) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["call","core","completion"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      switch (label) {
        case "call":
          return fieldText<ApplicationDecision, Root>(cursor, fields, "application", readApplicationDecisionText, applicationValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, application: applicationValue }, finish)));
        case "core":
          return fieldText<DefId, Root>(cursor, fields, "declaration", (next, done) => atomicText(next, readDefinitionId, done), declarationValue =>
    fieldText<BindingVector, Root>(cursor, fields, "bindings", (next, done) => atomicText(next, readBindings, done), bindingsValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ kind: label, declaration: declarationValue, bindings: bindingsValue }, finish))));
        case "completion":
          return atomicText(cursor, next => closeRecord(next, fields), () =>
      acceptText({ kind: label }, finish));
      }
    }));
}
