import type { DefId, BodyId, NodeId, LocalId, TyId, SigId, SourceNodeRef, LocalRef } from "../ids/contract.js";
import type { BindingVector, ArtifactBindings, BodyInstance, PassingMode, TypeEvidence } from "../ir-types/contract.js";
import type { BodyRoot, ImportTarget, HirLexicalScope } from "../ir-hir/contract.js";
import type { BodyCaptureRow, FlowRole, EmbeddingDecision, MemberDecision, ApplicationDecision, OperationDecision, OperationIdentity, DeferredDecision, RefinementDecision } from "../ir-infer/contract.js";
import type { BackedConversionIdentity, ConversionIdentity, TypedOperationOf, TypedOperation, TirResolution, ResolvedCallee, MemberSelection, TirArgument, TirRestPart, TirApplication, TirProtocolStep, TirProtocol, TirSelection, TirDemand, ConversionDecision, TypedValue, TargetAccess, TypedPhase, TirLocal, TirParam, TirBody } from "../ir-tir/contract.js";
import type { Cursor, RecordFields, TextReader, TextStep } from "./parse-values.js";
import type { SyntaxValue, SyntaxReadPorts } from "./parse-syntax-values.js";
import { delimiter, readString, readNumber, choice, readBoolean, readStringChoice, readSignatureId, openRecord, closeRecord, readDefinitionId, readBodyId, readTypeId, readNodeId, readLocalId, acceptText, atomicText, fieldText, nullableText, arrayText } from "./parse-values.js";
import { readTypeEvidenceText, readBindings, readArtifactBindings, readInstance } from "./parse-types.js";
import { readSourceNodeRef, readLocalRef } from "./parse-diagnostics.js";
import { readHirLexicalScopeText, readImportTargetText } from "./parse-core.js";
import { readBodyCaptureRowText, readDeferredDecisionText, readEmbeddingDecisionText, readMemberDecisionText, readApplicationDecisionText, readBackedIdentityText, readConversionIdentityText, readOperationDecisionWith, readOperationIdentityText, readRefinementDecisionText } from "./parse-inference.js";
import { resolveSyntaxValue, finishSyntaxRecord, readSyntaxReference } from "./parse-syntax-values.js";

export function readConversionDecisionText<Root>(cursor: Cursor, finish: (value: ConversionDecision) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["identity","convert","backed-convert","deferred"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      switch (label) {
        case "identity":
          return atomicText(cursor, next => closeRecord(next, fields), () =>
      acceptText({ kind: label }, finish));
        case "convert":
          return fieldText<FlowRole, Root>(cursor, fields, "role", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["initialization","assignment","argument","return","receiver","yield","member-write"]), done), roleValue =>
    fieldText<TypedOperationOf<ConversionIdentity>, Root>(cursor, fields, "operation",
      (next, done) => readTypedOperationWith(next, readConversionIdentityText, done), operationValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ kind: label, role: roleValue, operation: operationValue }, finish))));
        case "backed-convert":
          return fieldText<FlowRole, Root>(cursor, fields, "role", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["initialization","assignment","argument","return","receiver","yield","member-write"]), done), roleValue =>
    fieldText<EmbeddingDecision, Root>(cursor, fields, "embedding", readEmbeddingDecisionText, embeddingValue =>
      fieldText<TypedOperationOf<BackedConversionIdentity>, Root>(cursor, fields, "operation",
        (next, done) => readTypedOperationWith(next, readBackedIdentityText, done), operationValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ kind: label, role: roleValue, embedding: embeddingValue, operation: operationValue }, finish)))));
        case "deferred":
          return fieldText<DeferredDecision, Root>(cursor, fields, "deferred", readDeferredDecisionText, deferredValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, deferred: deferredValue }, finish)));
      }
    }));
}

export function readTirDemandText<Root>(cursor: Cursor, finish: (value: TirDemand) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["always","selected","never"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      switch (label) {
        case "always":
          return atomicText(cursor, next => closeRecord(next, fields), () =>
      acceptText({ kind: label }, finish));
        case "selected":
          return fieldText<NodeId, Root>(cursor, fields, "control", (next, done) => atomicText(next, readNodeId, done), controlValue =>
    fieldText<"true" | "false" | "present" | "absent", Root>(cursor, fields, "when", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["true","false","present","absent"]), done), whenValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ kind: label, control: controlValue, when: whenValue }, finish))));
        case "never":
          return fieldText<NodeId, Root>(cursor, fields, "control", (next, done) => atomicText(next, readNodeId, done), controlValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, control: controlValue }, finish)));
      }
    }));
}

export function readTirResolutionText<Root>(cursor: Cursor, finish: (value: TirResolution) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["local","definition","module","error"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      switch (label) {
        case "local":
          return fieldText<LocalRef, Root>(cursor, fields, "local", (next, done) => atomicText(next, readLocalRef, done), localValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, local: localValue }, finish)));
        case "definition":
          return fieldText<DefId, Root>(cursor, fields, "definition", (next, done) => atomicText(next, readDefinitionId, done), definitionValue =>
    fieldText<readonly (DefId)[], Root>(cursor, fields, "aliases", (next, done) => arrayText(next, (next, done) => atomicText(next, readDefinitionId, done), done), aliasesValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ kind: label, definition: definitionValue, aliases: aliasesValue }, finish))));
        case "module":
          return fieldText<ImportTarget, Root>(cursor, fields, "target", readImportTargetText, targetValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, target: targetValue }, finish)));
        case "error":
          return fieldText<number, Root>(cursor, fields, "diagnostic", (next, done) => atomicText(next, readNumber, done), diagnosticValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, diagnostic: diagnosticValue }, finish)));
      }
    }));
}

export function readTargetAccessText<Root>(cursor: Cursor, finish: (value: TargetAccess) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["write","read-write"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      switch (label) {
        case "write":
          return fieldText<TyId, Root>(cursor, fields, "storage", (next, done) => atomicText(next, readTypeId, done), storageValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, storage: storageValue }, finish)));
        case "read-write":
          return fieldText<TyId, Root>(cursor, fields, "storage", (next, done) => atomicText(next, readTypeId, done), storageValue =>
    fieldText<TyId, Root>(cursor, fields, "read", (next, done) => atomicText(next, readTypeId, done), readValue =>
      fieldText<RefinementDecision | null, Root>(cursor, fields, "narrowing", (next, done) => nullableText(next, readRefinementDecisionText, done), narrowingValue =>
        fieldText<number | null, Root>(cursor, fields, "evidenceIndex", (next, done) => nullableText(next, (next, done) => atomicText(next, readNumber, done), done), evidenceIndexValue =>
          atomicText(cursor, next => closeRecord(next, fields), () =>
              acceptText({ kind: label, storage: storageValue, read: readValue, narrowing: narrowingValue, evidenceIndex: evidenceIndexValue }, finish))))));
      }
    }));
}

export function readTirApplicationText<Root>(cursor: Cursor, finish: (value: TirApplication) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TirApplication"), fields =>
    fieldText<ResolvedCallee, Root>(cursor, fields, "callee", readResolvedCalleeText, calleeValue =>
    fieldText<NodeId | null, Root>(cursor, fields, "receiver", (next, done) => nullableText(next, (next, done) => atomicText(next, readNodeId, done), done), receiverValue =>
      fieldText<readonly (TirArgument)[], Root>(cursor, fields, "arguments", (next, done) => arrayText(next, readTirArgumentText, done), argumentsValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ callee: calleeValue, receiver: receiverValue, arguments: argumentsValue }, finish))))));
}

export function readTirProtocolText<Root>(cursor: Cursor, finish: (value: TirProtocol) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["iterate","spread","await","yield","delegate","dispose"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      return fieldText<boolean, Root>(cursor, fields, "asynchronous", (next, done) => atomicText(next, readBoolean, done), asynchronousValue =>
    fieldText<readonly (TirProtocolStep)[], Root>(cursor, fields, "steps", (next, done) => arrayText(next, readTirProtocolStepText, done), stepsValue =>
      fieldText<TyId, Root>(cursor, fields, "value", (next, done) => atomicText(next, readTypeId, done), valueValue =>
        fieldText<TyId, Root>(cursor, fields, "completion", (next, done) => atomicText(next, readTypeId, done), completionValue =>
          fieldText<TyId | null, Root>(cursor, fields, "sent", (next, done) => nullableText(next, (next, done) => atomicText(next, readTypeId, done), done), sentValue =>
            fieldText<TyId, Root>(cursor, fields, "thrown", (next, done) => atomicText(next, readTypeId, done), thrownValue =>
              atomicText(cursor, next => closeRecord(next, fields), () =>
                  acceptText({ kind: label, asynchronous: asynchronousValue, steps: stepsValue, value: valueValue, completion: completionValue, sent: sentValue, thrown: thrownValue }, finish))))))));
    }));
}

export function readTypedOperationText<Root>(cursor: Cursor, finish: (value: TypedOperation) => TextStep<Root>): TextStep<Root> {
  return readTypedOperationWith(cursor, readOperationIdentityText, finish);
}

function readTypedOperationWith<Identity extends OperationIdentity, Root>(
  cursor: Cursor, readIdentity: TextReader<Identity>, finish: (value: TypedOperationOf<Identity>) => TextStep<Root>,
): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedOperation"), fields =>
    fieldText<OperationDecision & { readonly operation: Identity }, Root>(cursor, fields, "decision",
      (next, done) => readOperationDecisionWith(next, readIdentity, done), decisionValue =>
    fieldText<NodeId | null, Root>(cursor, fields, "permissionScope", (next, done) => nullableText(next, (next, done) => atomicText(next, readNodeId, done), done), permissionScopeValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ decision: decisionValue, permissionScope: permissionScopeValue }, finish)))));
}

export function readTirSelectionText<Root>(cursor: Cursor, finish: (value: TirSelection) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["conditional","and","or","coalesce"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      switch (label) {
        case "conditional":
          return fieldText<NodeId, Root>(cursor, fields, "control", (next, done) => atomicText(next, readNodeId, done), controlValue =>
    fieldText<NodeId, Root>(cursor, fields, "whenTrue", (next, done) => atomicText(next, readNodeId, done), whenTrueValue =>
      fieldText<NodeId, Root>(cursor, fields, "whenFalse", (next, done) => atomicText(next, readNodeId, done), whenFalseValue =>
        fieldText<"true" | "false" | "dynamic", Root>(cursor, fields, "disposition", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["true","false","dynamic"]), done), dispositionValue =>
          atomicText(cursor, next => closeRecord(next, fields), () =>
              acceptText({ kind: label, control: controlValue, whenTrue: whenTrueValue, whenFalse: whenFalseValue, disposition: dispositionValue }, finish))))));
        case "and":
        case "or":
        case "coalesce":
          return fieldText<NodeId, Root>(cursor, fields, "control", (next, done) => atomicText(next, readNodeId, done), controlValue =>
    fieldText<NodeId, Root>(cursor, fields, "right", (next, done) => atomicText(next, readNodeId, done), rightValue =>
      fieldText<"left" | "right" | "dynamic", Root>(cursor, fields, "disposition", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["left","right","dynamic"]), done), dispositionValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ kind: label, control: controlValue, right: rightValue, disposition: dispositionValue }, finish)))));
      }
    }));
}

export function readMemberSelectionText<Root>(cursor: Cursor, finish: (value: MemberSelection) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "MemberSelection"), fields =>
    fieldText<MemberDecision, Root>(cursor, fields, "decision", readMemberDecisionText, decisionValue =>
    fieldText<ResolvedCallee | null, Root>(cursor, fields, "getter", (next, done) => nullableText(next, readResolvedCalleeText, done), getterValue =>
      fieldText<ResolvedCallee | null, Root>(cursor, fields, "setter", (next, done) => nullableText(next, readResolvedCalleeText, done), setterValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ decision: decisionValue, getter: getterValue, setter: setterValue }, finish))))));
}

export function readResolvedCalleeText<Root>(cursor: Cursor, finish: (value: ResolvedCallee) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "ResolvedCallee"), fields =>
    fieldText<ApplicationDecision, Root>(cursor, fields, "decision", readApplicationDecisionText, decisionValue =>
    fieldText<BodyInstance | null, Root>(cursor, fields, "activation", (next, done) => nullableText(next, (next, done) => atomicText(next, readInstance, done), done), activationValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ decision: decisionValue, activation: activationValue }, finish)))));
}

export function readTirArgumentText<Root>(cursor: Cursor, finish: (value: TirArgument) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["provided","omitted","rest"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      switch (label) {
        case "provided":
          return fieldText<number, Root>(cursor, fields, "parameter", (next, done) => atomicText(next, readNumber, done), parameterValue =>
    fieldText<NodeId, Root>(cursor, fields, "expression", (next, done) => atomicText(next, readNodeId, done), expressionValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ kind: label, parameter: parameterValue, expression: expressionValue }, finish))));
        case "omitted":
          return fieldText<number, Root>(cursor, fields, "parameter", (next, done) => atomicText(next, readNumber, done), parameterValue =>
    fieldText<{ readonly kind: "absence" } | { readonly kind: "initializer"; readonly instance: BodyInstance } | { readonly kind: "empty-rest" }, Root>(cursor, fields, "value", (<NextRoot>(next: Cursor, done: (value: { readonly kind: "absence" } | { readonly kind: "initializer"; readonly instance: BodyInstance } | { readonly kind: "empty-rest" }) => TextStep<NextRoot>) => atomicText(next, cursor => choice(cursor, ["absence","initializer","empty-rest"]), label => atomicText(next, cursor => delimiter(cursor, "("), () => { const fields: RecordFields = { given: new Set<string>() }; switch(label) {
case "absence":
case "empty-rest":
return atomicText(next, next => closeRecord(next, fields), () =>
      acceptText({ kind: label }, done));
case "initializer":
return fieldText<BodyInstance, NextRoot>(next, fields, "instance", (next, done) => atomicText(next, readInstance, done), instanceValue =>
    atomicText(next, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, instance: instanceValue }, done)));
} }))), valueValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ kind: label, parameter: parameterValue, value: valueValue }, finish))));
        case "rest":
          return fieldText<number, Root>(cursor, fields, "parameter", (next, done) => atomicText(next, readNumber, done), parameterValue =>
    fieldText<readonly (TirRestPart)[], Root>(cursor, fields, "parts", (next, done) => arrayText(next, readTirRestPartText, done), partsValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ kind: label, parameter: parameterValue, parts: partsValue }, finish))));
      }
    }));
}

export function readTirProtocolStepText<Root>(cursor: Cursor, finish: (value: TirProtocolStep) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TirProtocolStep"), fields =>
    fieldText<"acquire" | "next" | "done" | "value" | "finish" | "fail" | "await" | "dispose" | "completion", Root>(cursor, fields, "role", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["acquire","next","done","value","finish","fail","await","dispose","completion"]), done), roleValue =>
    fieldText<TypedOperation, Root>(cursor, fields, "operation", readTypedOperationText, operationValue =>
      fieldText<ResolvedCallee | null, Root>(cursor, fields, "callee", (next, done) => nullableText(next, readResolvedCalleeText, done), calleeValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ role: roleValue, operation: operationValue, callee: calleeValue }, finish))))));
}

export function readTirRestPartText<Root>(cursor: Cursor, finish: (value: TirRestPart) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["value","spread"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      switch (label) {
        case "value":
          return fieldText<NodeId, Root>(cursor, fields, "expression", (next, done) => atomicText(next, readNodeId, done), expressionValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, expression: expressionValue }, finish)));
        case "spread":
          return fieldText<NodeId, Root>(cursor, fields, "expression", (next, done) => atomicText(next, readNodeId, done), expressionValue =>
    fieldText<readonly (TyId)[] | null, Root>(cursor, fields, "tuple", (next, done) => nullableText(next, (next, done) => arrayText(next, (next, done) => atomicText(next, readTypeId, done), done), done), tupleValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ kind: label, expression: expressionValue, tuple: tupleValue }, finish))));
      }
    }));
}

export function readTypedValueText<Root>(cursor: Cursor, finish: (value: TypedValue) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedValue"), fields =>
    fieldText<TyId, Root>(cursor, fields, "type", (next, done) => atomicText(next, readTypeId, done), typeValue =>
    fieldText<TyId, Root>(cursor, fields, "convertedType", (next, done) => atomicText(next, readTypeId, done), convertedTypeValue =>
      fieldText<ConversionDecision, Root>(cursor, fields, "conversion", readConversionDecisionText, conversionValue =>
        fieldText<RefinementDecision | null, Root>(cursor, fields, "narrowing", (next, done) => nullableText(next, readRefinementDecisionText, done), narrowingValue =>
          fieldText<number | null, Root>(cursor, fields, "evidenceIndex", (next, done) => nullableText(next, (next, done) => atomicText(next, readNumber, done), done), evidenceIndexValue =>
            fieldText<TirDemand, Root>(cursor, fields, "demand", readTirDemandText, demandValue =>
              atomicText(cursor, next => closeRecord(next, fields), () =>
                  acceptText({ type: typeValue, convertedType: convertedTypeValue, conversion: conversionValue, narrowing: narrowingValue, evidenceIndex: evidenceIndexValue, demand: demandValue }, finish)))))))));
}

export function readTirParamText<Root>(cursor: Cursor, finish: (value: TirParam) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TirParam"), fields =>
    fieldText<LocalId, Root>(cursor, fields, "local", (next, done) => atomicText(next, readLocalId, done), localValue =>
    fieldText<DefId, Root>(cursor, fields, "declaration", (next, done) => atomicText(next, readDefinitionId, done), declarationValue =>
      fieldText<"required" | "optional" | "default" | "rest" | "this", Root>(cursor, fields, "role", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["required","optional","default","rest","this"]), done), roleValue =>
        fieldText<PassingMode, Root>(cursor, fields, "passing", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["by-value","byref-readonly","byref-readwrite","byref-writeonly-must-init","borrow-shared","borrow-mut","move"]), done), passingValue =>
          fieldText<BodyId | null, Root>(cursor, fields, "initializer", (next, done) => nullableText(next, (next, done) => atomicText(next, readBodyId, done), done), initializerValue =>
            fieldText<TyId, Root>(cursor, fields, "storage", (next, done) => atomicText(next, readTypeId, done), storageValue =>
              atomicText(cursor, next => closeRecord(next, fields), () =>
                  acceptText({ local: localValue, declaration: declarationValue, role: roleValue, passing: passingValue, initializer: initializerValue, storage: storageValue }, finish)))))))));
}

export function readTirLocalText<Root>(cursor: Cursor, finish: (value: TirLocal) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TirLocal"), fields =>
    fieldText<LocalId, Root>(cursor, fields, "id", (next, done) => atomicText(next, readLocalId, done), idValue =>
    fieldText<SourceNodeRef, Root>(cursor, fields, "declaration", (next, done) => atomicText(next, readSourceNodeRef, done), declarationValue =>
      fieldText<string, Root>(cursor, fields, "name", (next, done) => atomicText(next, readString, done), nameValue =>
        fieldText<"parameter" | "binding" | "capture" | "catch", Root>(cursor, fields, "role", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["parameter","binding","capture","catch"]), done), roleValue =>
          fieldText<LocalRef | null, Root>(cursor, fields, "capturedFrom", (next, done) => nullableText(next, (next, done) => atomicText(next, readLocalRef, done), done), capturedFromValue =>
            fieldText<boolean, Root>(cursor, fields, "mutable", (next, done) => atomicText(next, readBoolean, done), mutableValue =>
              fieldText<TyId, Root>(cursor, fields, "storage", (next, done) => atomicText(next, readTypeId, done), storageValue =>
                atomicText(cursor, next => closeRecord(next, fields), () =>
                    acceptText({ id: idValue, declaration: declarationValue, name: nameValue, role: roleValue, capturedFrom: capturedFromValue, mutable: mutableValue, storage: storageValue }, finish))))))))));
}

export function readTirBodyText<Root>(cursor: Cursor, ports: SyntaxReadPorts, finish: (value: SyntaxValue<TirBody>) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TirBody"), fields =>
    fieldText<BodyId, Root>(cursor, fields, "body", (next, done) => atomicText(next, readBodyId, done), bodyValue =>
    fieldText<DefId, Root>(cursor, fields, "owner", (next, done) => atomicText(next, readDefinitionId, done), ownerValue =>
    fieldText<ArtifactBindings, Root>(cursor, fields, "bindings", (next, done) => atomicText(next, readArtifactBindings, done), bindingsValue =>
    fieldText<BindingVector, Root>(cursor, fields, "lexicalBindings", (next, done) => atomicText(next, readBindings, done), lexicalBindingsValue =>
    fieldText<"parametric" | "binding-dependent", Root>(cursor, fields, "dependence", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["parametric","binding-dependent"]), done), dependenceValue =>
    fieldText<SigId, Root>(cursor, fields, "signature", (next, done) => atomicText(next, readSignatureId, done), signatureValue =>
    fieldText<TyId, Root>(cursor, fields, "completion", (next, done) => atomicText(next, readTypeId, done), completionValue =>
    fieldText<TyId | null, Root>(cursor, fields, "yielded", (next, done) => nullableText(next, (next, done) => atomicText(next, readTypeId, done), done), yieldedValue =>
    fieldText<TyId | null, Root>(cursor, fields, "sent", (next, done) => nullableText(next, (next, done) => atomicText(next, readTypeId, done), done), sentValue =>
    fieldText<readonly (TirParam)[], Root>(cursor, fields, "params", (next, done) => arrayText(next, readTirParamText, done), paramsValue =>
    fieldText<readonly (TirLocal)[], Root>(cursor, fields, "locals", (next, done) => arrayText(next, readTirLocalText, done), localsValue =>
    fieldText<SyntaxValue<BodyRoot<TypedPhase>>, Root>(cursor, fields, "root", (next, done) => readSyntaxReference(next, ports.BodyRoot, done), rootValue =>
    fieldText<readonly (BodyId)[], Root>(cursor, fields, "nestedBodies", (next, done) => arrayText(next, (next, done) => atomicText(next, readBodyId, done), done), nestedBodiesValue =>
    fieldText<readonly (BodyCaptureRow)[], Root>(cursor, fields, "captures", (next, done) => arrayText(next, readBodyCaptureRowText, done), capturesValue =>
    fieldText<readonly (HirLexicalScope)[], Root>(cursor, fields, "scopes", (next, done) => arrayText(next, readHirLexicalScopeText, done), scopesValue =>
    fieldText<readonly (TypeEvidence)[], Root>(cursor, fields, "evidence", (next, done) => arrayText(next, readTypeEvidenceText, done), evidenceValue =>
    fieldText<boolean, Root>(cursor, fields, "asynchronous", (next, done) => atomicText(next, readBoolean, done), asynchronousValue =>
    fieldText<boolean, Root>(cursor, fields, "generator", (next, done) => atomicText(next, readBoolean, done), generatorValue =>
    finishSyntaxRecord<TirBody, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(rootValue, root => ({ body: bodyValue, owner: ownerValue, bindings: bindingsValue, lexicalBindings: lexicalBindingsValue, dependence: dependenceValue, signature: signatureValue, completion: completionValue, yielded: yieldedValue, sent: sentValue, params: paramsValue, locals: localsValue, root: root, nestedBodies: nestedBodiesValue, captures: capturesValue, scopes: scopesValue, evidence: evidenceValue, asynchronous: asynchronousValue, generator: generatorValue })),
    }, finish))))))))))))))))))));
}
