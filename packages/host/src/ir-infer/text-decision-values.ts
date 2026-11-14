import type { CheckFailure, HandleActivation, ReceiverAccess } from "../ir-types/contract.js";
import type { AccessLocation, ApplicationDecision, CheckRequirement, CompletionEndpoint, CorrespondenceStep, DischargeObligationProof, DischargeProof, EmbeddingDecision, EmbeddingProof, FailureKind, MemberDecision, ParameterMapping, RefinementDecision } from "./contract.js";
import type { CaptureValuesSchemas } from "./text-capture-values.js";
import type { ConstraintsSchemas } from "./text-constraints.js";
import { arraySchema, enumSchema, nullableSchema, recordSchema, unionSchema } from "./text-data.js";
import type { DataSchemas } from "./text-data.js";
import type { EvidenceSchemas } from "./text-evidence.js";
import type { BodyId, TyId } from "../ids/contract.js";
import type { RecordSchema } from "./text-data.js";
import type { Schema } from "./text-data.js";

export interface IdentityEmbeddingRecord {
  readonly kind: "identity";

}

export interface ConversionEmbeddingRecord {
  readonly kind: "conversion";
  readonly conversion: "numeric" | "literal-fit" | "absence" | "union-injection" | "shape" | "callable" | "readonly";
  readonly proof: EmbeddingProof;
  readonly check: CheckRequirement;
}

export interface NoCheckRecord {
  readonly kind: "none";

}

export interface RequiredCheckRecord {
  readonly kind: "required";
  readonly failure: CheckFailure;
}

export interface DataLocationRecord {
  readonly kind: "data";
  readonly check: CheckRequirement;
  readonly receiver: ReceiverAccess;
}

export interface AccessorLocationRecord {
  readonly kind: "accessor";

}

export interface RefusedEmbeddingRecord {
  readonly kind: "refused";
  readonly reason: "incompatible-domain" | "lossy-numeric" | "missing-correspondence" | "passing-mode" | "rigid-parameter";
}

export interface ArgumentMappingRecord {
  readonly kind: "argument";
  readonly parameter: number;
  readonly argument: number;
  readonly component: number | null;
  readonly passing: "by-value" | "byref-readonly" | "byref-readwrite" | "byref-writeonly-must-init" | "borrow-shared" | "borrow-mut" | "move";
}

export interface DefaultMappingRecord {
  readonly kind: "default";
  readonly parameter: number;
  readonly initializer: BodyId;
}

export interface OmittedMappingRecord {
  readonly kind: "omitted";
  readonly parameter: number;
  readonly type: TyId;
}

export interface RestMappingRecord {
  readonly kind: "rest";
  readonly parameter: number;
  readonly arguments: readonly (number)[];
  readonly passing: "by-value" | "byref-readonly" | "byref-readwrite" | "byref-writeonly-must-init" | "borrow-shared" | "borrow-mut" | "move";
}

export interface IdentityRefinementRecord {
  readonly kind: "identity";
  readonly type: TyId;
}

export interface NarrowedRefinementRecord {
  readonly kind: "narrowed";
  readonly source: TyId;
  readonly result: TyId;
  readonly proof: EmbeddingProof;
  readonly failure: CheckFailure;
}

export interface DecisionValuesSchemas {
  readonly embeddingDecisionSchema: RecordSchema<EmbeddingDecision>;
  readonly identityEmbeddingSchema: RecordSchema<IdentityEmbeddingRecord>;
  readonly conversionEmbeddingSchema: RecordSchema<ConversionEmbeddingRecord>;
  readonly refusedEmbeddingSchema: RecordSchema<RefusedEmbeddingRecord>;
  readonly conversionKindSchema: Schema<"absence" | "callable" | "literal-fit" | "numeric" | "readonly" | "shape" | "union-injection">;
  readonly embeddingRefusalSchema: Schema<"incompatible-domain" | "lossy-numeric" | "missing-correspondence" | "passing-mode" | "rigid-parameter">;
  readonly embeddingProofSchema: RecordSchema<EmbeddingProof>;
  readonly correspondenceStepSchema: RecordSchema<CorrespondenceStep>;
  readonly correspondenceRuleSchema: Schema<"absence" | "callable" | "identity" | "literal-fit" | "numeric" | "readonly" | "shape" | "union-injection">;
  readonly memberDecisionSchema: RecordSchema<MemberDecision>;
  readonly applicationDecisionSchema: RecordSchema<ApplicationDecision>;
  readonly parameterMappingSchema: RecordSchema<ParameterMapping>;
  readonly argumentMappingSchema: RecordSchema<ArgumentMappingRecord>;
  readonly defaultMappingSchema: RecordSchema<DefaultMappingRecord>;
  readonly omittedMappingSchema: RecordSchema<OmittedMappingRecord>;
  readonly restMappingSchema: RecordSchema<RestMappingRecord>;
  readonly completionEndpointSchema: RecordSchema<CompletionEndpoint>;
  readonly refinementDecisionSchema: RecordSchema<RefinementDecision>;
  readonly identityRefinementSchema: RecordSchema<IdentityRefinementRecord>;
  readonly narrowedRefinementSchema: RecordSchema<NarrowedRefinementRecord>;
  readonly dischargeProofSchema: RecordSchema<DischargeProof>;
  readonly dischargeObligationProofSchema: RecordSchema<DischargeObligationProof>;
  readonly checkFailureSchema: Schema<CheckFailure>;
  readonly failureKindSchema: Schema<FailureKind>;
  readonly checkRequirementSchema: RecordSchema<CheckRequirement>;
  readonly noCheckSchema: RecordSchema<NoCheckRecord>;
  readonly requiredCheckSchema: RecordSchema<RequiredCheckRecord>;
  readonly accessLocationSchema: RecordSchema<AccessLocation>;
  readonly dataLocationSchema: RecordSchema<DataLocationRecord>;
  readonly accessorLocationSchema: RecordSchema<AccessorLocationRecord>;
  readonly receiverAccessSchema: Schema<ReceiverAccess>;
  readonly handleActivationSchema: Schema<HandleActivation>;
}

export function createDecisionValuesSchemas(captureValues: CaptureValuesSchemas, constraints: ConstraintsSchemas, data: DataSchemas, evidence: EvidenceSchemas): DecisionValuesSchemas {
  const { hirCallableEndpointSchema } = captureValues;
  const { ruleIdentitySchema } = constraints;
  const { bindingVectorSchema, bodySchema, defSchema, memberKeySchema, memberOriginSchema, numberSchema, passingModeSchema, sigSchema, tSchema } = data;
  const { typeComponentSchema } = evidence;
  const embeddingDecisionSchema: RecordSchema<EmbeddingDecision> = unionSchema<EmbeddingDecision>("EmbeddingDecision",
    () => [identityEmbeddingSchema, conversionEmbeddingSchema, refusedEmbeddingSchema], value => {
    switch (value.kind) {
      case "identity": return identityEmbeddingSchema.stage(value);
      case "conversion": return conversionEmbeddingSchema.stage(value);
      case "refused": return refusedEmbeddingSchema.stage(value);
    }
  });

  const identityEmbeddingSchema = recordSchema<IdentityEmbeddingRecord>("IdentityEmbedding", "identity", () => {
    return { fields: [], value: () => ({ kind: "identity" }) };
  });

  const conversionEmbeddingSchema = recordSchema<ConversionEmbeddingRecord>("ConversionEmbedding", "conversion", read => {
    const conversion = read("conversion", () => conversionKindSchema, value => value.conversion);
    const proof = read("proof", () => embeddingProofSchema, value => value.proof);
    const check = read("check", () => checkRequirementSchema, value => value.check);
    return { fields: [conversion, proof, check], value: () => ({ kind: "conversion", conversion: conversion.value(), proof: proof.value(), check: check.value() }) };
  });

  const checkFailureSchema = enumSchema<CheckFailure>("CheckFailure", ["unwind","abort"]);

  const failureKindSchema = enumSchema<FailureKind>("FailureKind", ["none","unwind","abort"]);

  const checkRequirementSchema: RecordSchema<CheckRequirement> = unionSchema<CheckRequirement>("CheckRequirement",
    () => [noCheckSchema, requiredCheckSchema], value => {
    switch (value.kind) {
      case "none": return noCheckSchema.stage(value);
      case "required": return requiredCheckSchema.stage(value);
    }
  });

  const noCheckSchema = recordSchema<NoCheckRecord>("NoCheck", "none", () => {
    return { fields: [], value: () => ({ kind: "none" }) };
  });

  const requiredCheckSchema = recordSchema<RequiredCheckRecord>("RequiredCheck", "required", read => {
    const failure = read("failure", () => checkFailureSchema, value => value.failure);
    return { fields: [failure], value: () => ({ kind: "required", failure: failure.value() }) };
  });

  const accessLocationSchema: RecordSchema<AccessLocation> = unionSchema<AccessLocation>("AccessLocation",
    () => [dataLocationSchema, accessorLocationSchema], value => {
    switch (value.kind) {
      case "data": return dataLocationSchema.stage(value);
      case "accessor": return accessorLocationSchema.stage(value);
    }
  });

  const dataLocationSchema = recordSchema<DataLocationRecord>("DataLocation", "data", read => {
    const check = read("check", () => checkRequirementSchema, value => value.check);
    const receiver = read("receiver", () => receiverAccessSchema, value => value.receiver);
    return { fields: [check, receiver], value: () => ({ kind: "data", check: check.value(), receiver: receiver.value() }) };
  });

  const accessorLocationSchema = recordSchema<AccessorLocationRecord>("AccessorLocation", "accessor", () => {
    return { fields: [], value: () => ({ kind: "accessor" }) };
  });

  const receiverAccessSchema = enumSchema<ReceiverAccess>("ReceiverAccess", ["in-place","by-reference"]);

  const handleActivationSchema = enumSchema<HandleActivation>("HandleActivation", ["at-creation","when-first-driven"]);

  const refusedEmbeddingSchema = recordSchema<RefusedEmbeddingRecord>("RefusedEmbedding", "refused", read => {
    const reason = read("reason", () => embeddingRefusalSchema, value => value.reason);
    return { fields: [reason], value: () => ({ kind: "refused", reason: reason.value() }) };
  });

  const conversionKindSchema = enumSchema("ConversionKind", ["numeric","literal-fit","absence","union-injection","shape","callable","readonly"]);

  const embeddingRefusalSchema = enumSchema("EmbeddingRefusal", ["incompatible-domain","lossy-numeric","missing-correspondence","passing-mode","rigid-parameter"]);

  const embeddingProofSchema = recordSchema<EmbeddingProof>("EmbeddingProof", "EmbeddingProof", read => {
    const steps = read("steps", () => arraySchema(correspondenceStepSchema), value => value.steps);
    const conclusion = read("conclusion", () => numberSchema, value => value.conclusion);
    return { fields: [steps, conclusion], value: () => ({ steps: steps.value(), conclusion: conclusion.value() }) };
  });

  const correspondenceStepSchema = recordSchema<CorrespondenceStep>("CorrespondenceStep", "CorrespondenceStep", read => {
    const from = read("from", () => typeComponentSchema, value => value.from);
    const to = read("to", () => typeComponentSchema, value => value.to);
    const rule = read("rule", () => correspondenceRuleSchema, value => value.rule);
    const premises = read("premises", () => arraySchema(numberSchema), value => value.premises);
    return { fields: [from, to, rule, premises], value: () => ({ from: from.value(), to: to.value(), rule: rule.value(), premises: premises.value() }) };
  });

  const correspondenceRuleSchema = enumSchema("CorrespondenceRule", ["identity","numeric","literal-fit","absence","union-injection","shape","callable","readonly"]);

  const memberDecisionSchema = recordSchema<MemberDecision>("MemberDecision", "MemberDecision", read => {
    const key = read("key", () => memberKeySchema, value => value.key);
    const origins = read("origins", () => arraySchema(memberOriginSchema), value => value.origins);
    const selectedDeclarations = read("selectedDeclarations", () => arraySchema(defSchema), value => value.selectedDeclarations);
    const primary = read("primary", () => nullableSchema(defSchema), value => value.primary);
    const readField = read("read", () => nullableSchema(tSchema), value => value.read);
    const write = read("write", () => nullableSchema(tSchema), value => value.write);
    const getter = read("getter", () => nullableSchema(hirCallableEndpointSchema), value => value.getter);
    const setter = read("setter", () => nullableSchema(hirCallableEndpointSchema), value => value.setter);
    const bindings = read("bindings", () => bindingVectorSchema, value => value.bindings);
    const location = read("location", () => accessLocationSchema, value => value.location);
    return { fields: [key, origins, selectedDeclarations, primary, readField, write, getter, setter, bindings, location], value: () => ({ key: key.value(), origins: origins.value(), selectedDeclarations: selectedDeclarations.value(), primary: primary.value(), read: readField.value(), write: write.value(), getter: getter.value(), setter: setter.value(), bindings: bindings.value(), location: location.value() }) };
  });

  const applicationDecisionSchema = recordSchema<ApplicationDecision>("ApplicationDecision", "ApplicationDecision", read => {
    const candidate = read("candidate", () => numberSchema, value => value.candidate);
    const advertised = read("advertised", () => hirCallableEndpointSchema, value => value.advertised);
    const api = read("api", () => hirCallableEndpointSchema, value => value.api);
    const bindings = read("bindings", () => bindingVectorSchema, value => value.bindings);
    const implementationBindings = read("implementationBindings", () => bindingVectorSchema, value => value.implementationBindings);
    const parameters = read("parameters", () => arraySchema(parameterMappingSchema), value => value.parameters);
    const completion = read("completion", () => completionEndpointSchema, value => value.completion);
    const result = read("result", () => tSchema, value => value.result);
    const activation = read("activation", () => nullableSchema(handleActivationSchema), value => value.activation);
    return { fields: [candidate, advertised, api, bindings, implementationBindings, parameters, completion, result, activation], value: () => ({ candidate: candidate.value(), advertised: advertised.value(), api: api.value(), bindings: bindings.value(), implementationBindings: implementationBindings.value(), parameters: parameters.value(), completion: completion.value(), result: result.value(), activation: activation.value() }) };
  });

  const parameterMappingSchema: RecordSchema<ParameterMapping> = unionSchema<ParameterMapping>("ParameterMapping",
    () => [argumentMappingSchema, defaultMappingSchema, omittedMappingSchema, restMappingSchema], value => {
    switch (value.kind) {
      case "argument": return argumentMappingSchema.stage(value);
      case "default": return defaultMappingSchema.stage(value);
      case "omitted": return omittedMappingSchema.stage(value);
      case "rest": return restMappingSchema.stage(value);
    }
  });

  const argumentMappingSchema = recordSchema<ArgumentMappingRecord>("ArgumentMapping", "argument", read => {
    const parameter = read("parameter", () => numberSchema, value => value.parameter);
    const argument = read("argument", () => numberSchema, value => value.argument);
    const component = read("component", () => nullableSchema(numberSchema), value => value.component);
    const passing = read("passing", () => passingModeSchema, value => value.passing);
    return { fields: [parameter, argument, component, passing], value: () => ({ kind: "argument", parameter: parameter.value(), argument: argument.value(), component: component.value(), passing: passing.value() }) };
  });

  const defaultMappingSchema = recordSchema<DefaultMappingRecord>("DefaultMapping", "default", read => {
    const parameter = read("parameter", () => numberSchema, value => value.parameter);
    const initializer = read("initializer", () => bodySchema, value => value.initializer);
    return { fields: [parameter, initializer], value: () => ({ kind: "default", parameter: parameter.value(), initializer: initializer.value() }) };
  });

  const omittedMappingSchema = recordSchema<OmittedMappingRecord>("OmittedMapping", "omitted", read => {
    const parameter = read("parameter", () => numberSchema, value => value.parameter);
    const type = read("type", () => tSchema, value => value.type);
    return { fields: [parameter, type], value: () => ({ kind: "omitted", parameter: parameter.value(), type: type.value() }) };
  });

  const restMappingSchema = recordSchema<RestMappingRecord>("RestMapping", "rest", read => {
    const parameter = read("parameter", () => numberSchema, value => value.parameter);
    const argumentsField = read("arguments", () => arraySchema(numberSchema), value => value.arguments);
    const passing = read("passing", () => passingModeSchema, value => value.passing);
    return { fields: [parameter, argumentsField, passing], value: () => ({ kind: "rest", parameter: parameter.value(), arguments: argumentsField.value(), passing: passing.value() }) };
  });

  const completionEndpointSchema = recordSchema<CompletionEndpoint>("CompletionEndpoint", "CompletionEndpoint", read => {
    const signature = read("signature", () => sigSchema, value => value.signature);
    const completion = read("completion", () => tSchema, value => value.completion);
    const yielded = read("yielded", () => nullableSchema(tSchema), value => value.yielded);
    const sent = read("sent", () => nullableSchema(tSchema), value => value.sent);
    return { fields: [signature, completion, yielded, sent], value: () => ({ signature: signature.value(), completion: completion.value(), yielded: yielded.value(), sent: sent.value() }) };
  });

  const refinementDecisionSchema: RecordSchema<RefinementDecision> = unionSchema<RefinementDecision>("RefinementDecision",
    () => [identityRefinementSchema, narrowedRefinementSchema], value => {
    switch (value.kind) {
      case "identity": return identityRefinementSchema.stage(value);
      case "narrowed": return narrowedRefinementSchema.stage(value);
    }
  });

  const identityRefinementSchema = recordSchema<IdentityRefinementRecord>("IdentityRefinement", "identity", read => {
    const type = read("type", () => tSchema, value => value.type);
    return { fields: [type], value: () => ({ kind: "identity", type: type.value() }) };
  });

  const narrowedRefinementSchema = recordSchema<NarrowedRefinementRecord>("NarrowedRefinement", "narrowed", read => {
    const source = read("source", () => tSchema, value => value.source);
    const result = read("result", () => tSchema, value => value.result);
    const proof = read("proof", () => embeddingProofSchema, value => value.proof);
    const failure = read("failure", () => checkFailureSchema, value => value.failure);
    return { fields: [source, result, proof, failure], value: () => ({ kind: "narrowed", source: source.value(), result: result.value(), proof: proof.value(), failure: failure.value() }) };
  });

  const dischargeProofSchema = recordSchema<DischargeProof>("DischargeProof", "DischargeProof", read => {
    const checkerDiagnostic = read("checkerDiagnostic", () => numberSchema, value => value.checkerDiagnostic);
    const obligations = read("obligations", () => arraySchema(dischargeObligationProofSchema), value => value.obligations);
    return { fields: [checkerDiagnostic, obligations], value: () => ({ checkerDiagnostic: checkerDiagnostic.value(), obligations: obligations.value() }) };
  });

  const dischargeObligationProofSchema = recordSchema<DischargeObligationProof>("DischargeObligationProof", "DischargeObligationProof", read => {
    const ordinal = read("ordinal", () => numberSchema, value => value.ordinal);
    const rule = read("rule", () => ruleIdentitySchema, value => value.rule);
    const evidence = read("evidence", () => embeddingProofSchema, value => value.evidence);
    return { fields: [ordinal, rule, evidence], value: () => ({ ordinal: ordinal.value(), rule: rule.value(), evidence: evidence.value() }) };
  });
  return { embeddingDecisionSchema, identityEmbeddingSchema, conversionEmbeddingSchema, refusedEmbeddingSchema, conversionKindSchema, embeddingRefusalSchema, embeddingProofSchema, correspondenceStepSchema, correspondenceRuleSchema, memberDecisionSchema, applicationDecisionSchema, parameterMappingSchema, argumentMappingSchema, defaultMappingSchema, omittedMappingSchema, restMappingSchema, completionEndpointSchema, refinementDecisionSchema, identityRefinementSchema, narrowedRefinementSchema, dischargeProofSchema, dischargeObligationProofSchema, checkFailureSchema, failureKindSchema, checkRequirementSchema, noCheckSchema, requiredCheckSchema, accessLocationSchema, dataLocationSchema, accessorLocationSchema, receiverAccessSchema, handleActivationSchema };
}
