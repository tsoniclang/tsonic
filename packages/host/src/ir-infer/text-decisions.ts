import { createDataSchemas } from "./text-data.js";
import { createContributionsSchemas } from "./text-contributions.js";
import { createEvidenceSchemas } from "./text-evidence.js";
import { createCaptureValuesSchemas } from "./text-capture-values.js";
import { createPointersSchemas } from "./text-pointers.js";
import { createCapturesSchemas } from "./text-captures.js";
import { createConstraintsSchemas } from "./text-constraints.js";
import { createDecisionValuesSchemas } from "./text-decision-values.js";
import { createRuleInputsSchemas } from "./text-rule-inputs.js";
import { createInvocationsSchemas } from "./text-invocations.js";
import { createOperationsSchemas } from "./text-operations.js";
import type { ApplicationDecision, AtomicContribution, BodyTyping, BoundCheckOutcome, ClosureDecision, Constraint, ConstraintDecision, ConstraintSet, ContributionKey, DeferredDecision, DischargeProof, EmbeddingDecision, FinalVariable, InferenceGroup, InferenceVariable, MemberDecision, OperationDecision, RecordedCheck, RefinementDecision, RuleOutcome, Solution, SolvedConstraint, VariableBound } from "./contract.js";
import type { CaptureValuesSchemas } from "./text-capture-values.js";
import type { ConstraintsSchemas } from "./text-constraints.js";
import type { ContributionsSchemas } from "./text-contributions.js";
import { arraySchema, enumSchema, nullableSchema, recordSchema, unionSchema } from "./text-data.js";
import type { DataSchemas } from "./text-data.js";
import type { DecisionValuesSchemas } from "./text-decision-values.js";
import type { EvidenceSchemas } from "./text-evidence.js";
import type { InvocationsSchemas } from "./text-invocations.js";
import type { OperationsSchemas } from "./text-operations.js";
import type { TyId } from "../ids/contract.js";
import type { HirCandidateList } from "../ir-hir/contract.js";
import type { LiteralValue, MemberKey, MemberOrigin, TypeComponent, TypeEvidence } from "../ir-types/contract.js";
import type { RecordSchema, Staged } from "./text-data.js";
import type { Schema } from "./text-data.js";

export interface ProducerBoundRecord {
  readonly kind: "producer" | "demand";
  readonly contribution: ContributionKey;
  readonly variable: number;
  readonly value: TypeEvidence;
}

export interface DemandBoundRecord {
  readonly kind: "producer" | "demand";
  readonly contribution: ContributionKey;
  readonly variable: number;
  readonly value: TypeEvidence;
}

export interface SatisfiedCheckRecord {
  readonly kind: "satisfied";
  readonly embedding: EmbeddingDecision;
}

export interface RefusedCheckRecord {
  readonly kind: "refused";
  readonly reason: "signature-use-demand" | "conflicting-destinations" | "accumulator-widening" | "binder-constraint" | "literal-inexact";
}

export interface EqualityDecisionRecord {
  readonly kind: "eq";
  readonly equivalent: boolean;
}

export interface FlowDecisionRecord {
  readonly kind: "flow" | "literal";
  readonly embedding: EmbeddingDecision;
}

export interface LiteralDecisionRecord {
  readonly kind: "flow" | "literal";
  readonly embedding: EmbeddingDecision;
}

export interface MemberConstraintDecisionRecord {
  readonly kind: "member" | "index";
  readonly member: MemberDecision;
}

export interface IndexConstraintDecisionRecord {
  readonly kind: "member" | "index";
  readonly member: MemberDecision;
}

export interface CallDecisionRecord {
  readonly kind: "call" | "construct";
  readonly application: ApplicationDecision;
  readonly operation: RuleOutcome<OperationDecision> | null;
}

export interface ConstructDecisionRecord {
  readonly kind: "call" | "construct";
  readonly application: ApplicationDecision;
  readonly operation: RuleOutcome<OperationDecision> | null;
}

export interface OperatorConstraintDecisionRecord {
  readonly kind: "op" | "construct-literal" | "protocol";
  readonly operation: OperationDecision;
}

export interface ConstructionDecisionRecord {
  readonly kind: "op" | "construct-literal" | "protocol";
  readonly operation: OperationDecision;
}

export interface ProtocolDecisionRecord {
  readonly kind: "op" | "construct-literal" | "protocol";
  readonly operation: OperationDecision;
}

export interface RefinementConstraintDecisionRecord {
  readonly kind: "refine";
  readonly refinement: RefinementDecision;
}

export interface DischargeDecisionRecord {
  readonly kind: "discharge";
  readonly proof: DischargeProof;
}

export interface DefaultDecisionRecord {
  readonly kind: "default";
  readonly type: TyId;
}

export interface ClosureConstraintDecisionRecord {
  readonly kind: "closure";
  readonly closure: ClosureDecision;
}

export interface DeferredConstraintDecisionRecord {
  readonly kind: "deferred";
  readonly deferred: DeferredDecision;
}

export type TextRoot =
  | { readonly kind: "ConstraintSet"; readonly value: ConstraintSet }
  | { readonly kind: "AtomicContribution"; readonly value: AtomicContribution }
  | { readonly kind: "InferenceGroup"; readonly value: InferenceGroup }
  | { readonly kind: "Solution"; readonly value: Solution }
  | { readonly kind: "MemberKey"; readonly value: MemberKey }
  | { readonly kind: "MemberOrigin"; readonly value: MemberOrigin }
  | { readonly kind: "LiteralValue"; readonly value: LiteralValue }
  | { readonly kind: "InferenceVariable"; readonly value: InferenceVariable }
  | { readonly kind: "HirCandidateList"; readonly value: HirCandidateList }
  | { readonly kind: "TypeEvidence"; readonly value: TypeEvidence }
  | { readonly kind: "Constraint"; readonly value: Constraint }
  | { readonly kind: "FinalVariable"; readonly value: FinalVariable }
  | { readonly kind: "SolvedConstraint"; readonly value: SolvedConstraint }
  | { readonly kind: "RecordedCheck"; readonly value: RecordedCheck }
  | { readonly kind: "BodyTyping"; readonly value: BodyTyping }
  | { readonly kind: "TypeComponent"; readonly value: TypeComponent };

export interface DecisionsSchemas {
  readonly solutionSchema: RecordSchema<Solution>;
  readonly finalVariableSchema: RecordSchema<FinalVariable>;
  readonly solvedConstraintSchema: RecordSchema<SolvedConstraint>;
  readonly recordedCheckSchema: RecordSchema<RecordedCheck>;
  readonly variableBoundSchema: RecordSchema<VariableBound>;
  readonly producerBoundSchema: RecordSchema<ProducerBoundRecord>;
  readonly demandBoundSchema: RecordSchema<DemandBoundRecord>;
  readonly boundCheckOutcomeSchema: RecordSchema<BoundCheckOutcome>;
  readonly satisfiedCheckSchema: RecordSchema<SatisfiedCheckRecord>;
  readonly refusedCheckSchema: RecordSchema<RefusedCheckRecord>;
  readonly boundRefusalSchema: Schema<"accumulator-widening" | "binder-constraint" | "conflicting-destinations" | "literal-inexact" | "signature-use-demand">;
  readonly bodyTypingSchema: RecordSchema<BodyTyping>;
  readonly constraintDecisionSchema: RecordSchema<ConstraintDecision>;
  readonly equalityDecisionSchema: RecordSchema<EqualityDecisionRecord>;
  readonly flowDecisionSchema: RecordSchema<FlowDecisionRecord>;
  readonly literalDecisionSchema: RecordSchema<LiteralDecisionRecord>;
  readonly memberConstraintDecisionSchema: RecordSchema<MemberConstraintDecisionRecord>;
  readonly indexConstraintDecisionSchema: RecordSchema<IndexConstraintDecisionRecord>;
  readonly callDecisionSchema: RecordSchema<CallDecisionRecord>;
  readonly constructDecisionSchema: RecordSchema<ConstructDecisionRecord>;
  readonly operatorConstraintDecisionSchema: RecordSchema<OperatorConstraintDecisionRecord>;
  readonly constructionDecisionSchema: RecordSchema<ConstructionDecisionRecord>;
  readonly protocolDecisionSchema: RecordSchema<ProtocolDecisionRecord>;
  readonly refinementConstraintDecisionSchema: RecordSchema<RefinementConstraintDecisionRecord>;
  readonly dischargeDecisionSchema: RecordSchema<DischargeDecisionRecord>;
  readonly defaultDecisionSchema: RecordSchema<DefaultDecisionRecord>;
  readonly closureConstraintDecisionSchema: RecordSchema<ClosureConstraintDecisionRecord>;
  readonly deferredConstraintDecisionSchema: RecordSchema<DeferredConstraintDecisionRecord>;
  readonly constraintSetSchema: RecordSchema<ConstraintSet>;
  readonly inferenceGroupSchema: RecordSchema<InferenceGroup>;
  readonly atomicContributionSchema: RecordSchema<AtomicContribution>;
  readonly stageRoot: (input: TextRoot) => Staged;
}

export function createDecisionsSchemas(captureValues: CaptureValuesSchemas, constraints: ConstraintsSchemas, contributions: ContributionsSchemas, data: DataSchemas, decisionValues: DecisionValuesSchemas, evidence: EvidenceSchemas, invocations: InvocationsSchemas, operations: OperationsSchemas): DecisionsSchemas {
  const { hirCandidateListSchema } = captureValues;
  const { constraintSchema, constraintSetSchema, inferenceGroupSchema, inferenceVariableSchema } = constraints;
  const { atomicContributionSchema, constraintRefSchema, contributionKeySchema } = contributions;
  const { bodySchema, booleanSchema, groupSchema, literalValueSchema, memberKeySchema, memberOriginSchema, numberSchema, sigSchema, tSchema } = data;
  const { applicationDecisionSchema, dischargeProofSchema, embeddingDecisionSchema, memberDecisionSchema, refinementDecisionSchema } = decisionValues;
  const { typeComponentSchema, typeEvidenceSchema } = evidence;
  const { deferredDecisionSchema } = invocations;
  const { closureDecisionSchema, operationDecisionSchema, operationOutcomeSchema } = operations;
  const solutionSchema = recordSchema<Solution>("Solution", "Solution", read => {
    const group = read("group", () => groupSchema, value => value.group);
    const variables = read("variables", () => arraySchema(finalVariableSchema), value => value.variables);
    const constraints = read("constraints", () => arraySchema(solvedConstraintSchema), value => value.constraints);
    const checks = read("checks", () => arraySchema(recordedCheckSchema), value => value.checks);
    const bodies = read("bodies", () => arraySchema(bodyTypingSchema), value => value.bodies);
    return { fields: [group, variables, constraints, checks, bodies], value: () => ({ group: group.value(), variables: variables.value(), constraints: constraints.value(), checks: checks.value(), bodies: bodies.value() }) };
  });

  const finalVariableSchema = recordSchema<FinalVariable>("FinalVariable", "FinalVariable", read => {
    const variable = read("variable", () => numberSchema, value => value.variable);
    const value = read("value", () => typeEvidenceSchema, value => value.value);
    return { fields: [variable, value], value: () => ({ variable: variable.value(), value: value.value() }) };
  });

  const solvedConstraintSchema = recordSchema<SolvedConstraint>("SolvedConstraint", "SolvedConstraint", read => {
    const constraint = read("constraint", () => constraintRefSchema, value => value.constraint);
    const decision = read("decision", () => constraintDecisionSchema, value => value.decision);
    return { fields: [constraint, decision], value: () => ({ constraint: constraint.value(), decision: decision.value() }) };
  });

  const recordedCheckSchema = recordSchema<RecordedCheck>("RecordedCheck", "RecordedCheck", read => {
    const variable = read("variable", () => numberSchema, value => value.variable);
    const contribution = read("contribution", () => contributionKeySchema, value => value.contribution);
    const bound = read("bound", () => variableBoundSchema, value => value.bound);
    const outcome = read("outcome", () => boundCheckOutcomeSchema, value => value.outcome);
    return { fields: [variable, contribution, bound, outcome], value: () => ({ variable: variable.value(), contribution: contribution.value(), bound: bound.value(), outcome: outcome.value() }) };
  });

  const variableBoundSchema: RecordSchema<VariableBound> = unionSchema<VariableBound>("VariableBound",
    () => [producerBoundSchema, demandBoundSchema], value => {
    switch (value.kind) {
      case "producer": return producerBoundSchema.stage(value);
      case "demand": return demandBoundSchema.stage(value);
    }
  });

  const producerBoundSchema = recordSchema<ProducerBoundRecord>("ProducerBound", "producer", read => {
    const contribution = read("contribution", () => contributionKeySchema, value => value.contribution);
    const variable = read("variable", () => numberSchema, value => value.variable);
    const value = read("value", () => typeEvidenceSchema, value => value.value);
    return { fields: [contribution, variable, value], value: () => ({ kind: "producer", contribution: contribution.value(), variable: variable.value(), value: value.value() }) };
  });

  const demandBoundSchema = recordSchema<DemandBoundRecord>("DemandBound", "demand", read => {
    const contribution = read("contribution", () => contributionKeySchema, value => value.contribution);
    const variable = read("variable", () => numberSchema, value => value.variable);
    const value = read("value", () => typeEvidenceSchema, value => value.value);
    return { fields: [contribution, variable, value], value: () => ({ kind: "demand", contribution: contribution.value(), variable: variable.value(), value: value.value() }) };
  });

  const boundCheckOutcomeSchema: RecordSchema<BoundCheckOutcome> = unionSchema<BoundCheckOutcome>("BoundCheckOutcome",
    () => [satisfiedCheckSchema, refusedCheckSchema], value => {
    switch (value.kind) {
      case "satisfied": return satisfiedCheckSchema.stage(value);
      case "refused": return refusedCheckSchema.stage(value);
    }
  });

  const satisfiedCheckSchema = recordSchema<SatisfiedCheckRecord>("SatisfiedCheck", "satisfied", read => {
    const embedding = read("embedding", () => embeddingDecisionSchema, value => value.embedding);
    return { fields: [embedding], value: () => ({ kind: "satisfied", embedding: embedding.value() }) };
  });

  const refusedCheckSchema = recordSchema<RefusedCheckRecord>("RefusedCheck", "refused", read => {
    const reason = read("reason", () => boundRefusalSchema, value => value.reason);
    return { fields: [reason], value: () => ({ kind: "refused", reason: reason.value() }) };
  });

  const boundRefusalSchema = enumSchema("BoundRefusal", ["signature-use-demand","conflicting-destinations","accumulator-widening","binder-constraint","literal-inexact"]);

  const bodyTypingSchema = recordSchema<BodyTyping>("BodyTyping", "BodyTyping", read => {
    const body = read("body", () => bodySchema, value => value.body);
    const signature = read("signature", () => sigSchema, value => value.signature);
    const completion = read("completion", () => tSchema, value => value.completion);
    const yielded = read("yielded", () => nullableSchema(tSchema), value => value.yielded);
    const sent = read("sent", () => nullableSchema(tSchema), value => value.sent);
    return { fields: [body, signature, completion, yielded, sent], value: () => ({ body: body.value(), signature: signature.value(), completion: completion.value(), yielded: yielded.value(), sent: sent.value() }) };
  });

  const constraintDecisionSchema: RecordSchema<ConstraintDecision> = unionSchema<ConstraintDecision>("ConstraintDecision",
    () => [equalityDecisionSchema, flowDecisionSchema, literalDecisionSchema, memberConstraintDecisionSchema, indexConstraintDecisionSchema, callDecisionSchema, constructDecisionSchema, operatorConstraintDecisionSchema, constructionDecisionSchema, protocolDecisionSchema, refinementConstraintDecisionSchema, dischargeDecisionSchema, defaultDecisionSchema, closureConstraintDecisionSchema, deferredConstraintDecisionSchema], value => {
    switch (value.kind) {
      case "eq": return equalityDecisionSchema.stage(value);
      case "flow": return flowDecisionSchema.stage(value);
      case "literal": return literalDecisionSchema.stage(value);
      case "member": return memberConstraintDecisionSchema.stage(value);
      case "index": return indexConstraintDecisionSchema.stage(value);
      case "call": return callDecisionSchema.stage(value);
      case "construct": return constructDecisionSchema.stage(value);
      case "op": return operatorConstraintDecisionSchema.stage(value);
      case "construct-literal": return constructionDecisionSchema.stage(value);
      case "protocol": return protocolDecisionSchema.stage(value);
      case "refine": return refinementConstraintDecisionSchema.stage(value);
      case "discharge": return dischargeDecisionSchema.stage(value);
      case "default": return defaultDecisionSchema.stage(value);
      case "closure": return closureConstraintDecisionSchema.stage(value);
      case "deferred": return deferredConstraintDecisionSchema.stage(value);
    }
  });

  const equalityDecisionSchema = recordSchema<EqualityDecisionRecord>("EqualityDecision", "eq", read => {
    const equivalent = read("equivalent", () => booleanSchema, value => value.equivalent);
    return { fields: [equivalent], value: () => ({ kind: "eq", equivalent: equivalent.value() }) };
  });

  const flowDecisionSchema = recordSchema<FlowDecisionRecord>("FlowDecision", "flow", read => {
    const embedding = read("embedding", () => embeddingDecisionSchema, value => value.embedding);
    return { fields: [embedding], value: () => ({ kind: "flow", embedding: embedding.value() }) };
  });

  const literalDecisionSchema = recordSchema<LiteralDecisionRecord>("LiteralDecision", "literal", read => {
    const embedding = read("embedding", () => embeddingDecisionSchema, value => value.embedding);
    return { fields: [embedding], value: () => ({ kind: "literal", embedding: embedding.value() }) };
  });

  const memberConstraintDecisionSchema = recordSchema<MemberConstraintDecisionRecord>("MemberConstraintDecision", "member", read => {
    const member = read("member", () => memberDecisionSchema, value => value.member);
    return { fields: [member], value: () => ({ kind: "member", member: member.value() }) };
  });

  const indexConstraintDecisionSchema = recordSchema<IndexConstraintDecisionRecord>("IndexConstraintDecision", "index", read => {
    const member = read("member", () => memberDecisionSchema, value => value.member);
    return { fields: [member], value: () => ({ kind: "index", member: member.value() }) };
  });

  const callDecisionSchema = recordSchema<CallDecisionRecord>("CallDecision", "call", read => {
    const application = read("application", () => applicationDecisionSchema, value => value.application);
    const operation = read("operation", () => nullableSchema(operationOutcomeSchema), value => value.operation);
    return { fields: [application, operation], value: () => ({ kind: "call", application: application.value(), operation: operation.value() }) };
  });

  const constructDecisionSchema = recordSchema<ConstructDecisionRecord>("ConstructDecision", "construct", read => {
    const application = read("application", () => applicationDecisionSchema, value => value.application);
    const operation = read("operation", () => nullableSchema(operationOutcomeSchema), value => value.operation);
    return { fields: [application, operation], value: () => ({ kind: "construct", application: application.value(), operation: operation.value() }) };
  });

  const operatorConstraintDecisionSchema = recordSchema<OperatorConstraintDecisionRecord>("OperatorConstraintDecision", "op", read => {
    const operation = read("operation", () => operationDecisionSchema, value => value.operation);
    return { fields: [operation], value: () => ({ kind: "op", operation: operation.value() }) };
  });

  const constructionDecisionSchema = recordSchema<ConstructionDecisionRecord>("ConstructionDecision", "construct-literal", read => {
    const operation = read("operation", () => operationDecisionSchema, value => value.operation);
    return { fields: [operation], value: () => ({ kind: "construct-literal", operation: operation.value() }) };
  });

  const protocolDecisionSchema = recordSchema<ProtocolDecisionRecord>("ProtocolDecision", "protocol", read => {
    const operation = read("operation", () => operationDecisionSchema, value => value.operation);
    return { fields: [operation], value: () => ({ kind: "protocol", operation: operation.value() }) };
  });

  const refinementConstraintDecisionSchema = recordSchema<RefinementConstraintDecisionRecord>("RefinementConstraintDecision", "refine", read => {
    const refinement = read("refinement", () => refinementDecisionSchema, value => value.refinement);
    return { fields: [refinement], value: () => ({ kind: "refine", refinement: refinement.value() }) };
  });

  const dischargeDecisionSchema = recordSchema<DischargeDecisionRecord>("DischargeDecision", "discharge", read => {
    const proof = read("proof", () => dischargeProofSchema, value => value.proof);
    return { fields: [proof], value: () => ({ kind: "discharge", proof: proof.value() }) };
  });

  const defaultDecisionSchema = recordSchema<DefaultDecisionRecord>("DefaultDecision", "default", read => {
    const type = read("type", () => tSchema, value => value.type);
    return { fields: [type], value: () => ({ kind: "default", type: type.value() }) };
  });

  const closureConstraintDecisionSchema = recordSchema<ClosureConstraintDecisionRecord>("ClosureConstraintDecision", "closure", read => {
    const closure = read("closure", () => closureDecisionSchema, value => value.closure);
    return { fields: [closure], value: () => ({ kind: "closure", closure: closure.value() }) };
  });

  const deferredConstraintDecisionSchema = recordSchema<DeferredConstraintDecisionRecord>("DeferredConstraintDecision", "deferred", read => {
    const deferred = read("deferred", () => deferredDecisionSchema, value => value.deferred);
    return { fields: [deferred], value: () => ({ kind: "deferred", deferred: deferred.value() }) };
  });

  function stageRoot(input: TextRoot): Staged {
    switch (input.kind) {
      case "ConstraintSet": return constraintSetSchema.stage(input.value);
      case "AtomicContribution": return atomicContributionSchema.stage(input.value);
      case "InferenceGroup": return inferenceGroupSchema.stage(input.value);
      case "Solution": return solutionSchema.stage(input.value);
      case "MemberKey": return memberKeySchema.stage(input.value);
      case "MemberOrigin": return memberOriginSchema.stage(input.value);
      case "LiteralValue": return literalValueSchema.stage(input.value);
      case "InferenceVariable": return inferenceVariableSchema.stage(input.value);
      case "HirCandidateList": return hirCandidateListSchema.stage(input.value);
      case "TypeEvidence": return typeEvidenceSchema.stage(input.value);
      case "Constraint": return constraintSchema.stage(input.value);
      case "FinalVariable": return finalVariableSchema.stage(input.value);
      case "SolvedConstraint": return solvedConstraintSchema.stage(input.value);
      case "RecordedCheck": return recordedCheckSchema.stage(input.value);
      case "BodyTyping": return bodyTypingSchema.stage(input.value);
      case "TypeComponent": return typeComponentSchema.stage(input.value);
    }
  }
  return { closureConstraintDecisionSchema, solutionSchema, finalVariableSchema, solvedConstraintSchema, recordedCheckSchema, variableBoundSchema, producerBoundSchema, demandBoundSchema, boundCheckOutcomeSchema, satisfiedCheckSchema, refusedCheckSchema, boundRefusalSchema, bodyTypingSchema, constraintDecisionSchema, equalityDecisionSchema, flowDecisionSchema, literalDecisionSchema, memberConstraintDecisionSchema, indexConstraintDecisionSchema, callDecisionSchema, constructDecisionSchema, operatorConstraintDecisionSchema, constructionDecisionSchema, protocolDecisionSchema, refinementConstraintDecisionSchema, dischargeDecisionSchema, defaultDecisionSchema, deferredConstraintDecisionSchema, constraintSetSchema, inferenceGroupSchema, atomicContributionSchema, stageRoot };
}

export function createTextSchemas(): DecisionsSchemas {
  const data = createDataSchemas();
  const contributions = createContributionsSchemas(data);
  const evidence = createEvidenceSchemas(data);
  const captureValues = createCaptureValuesSchemas(data, evidence);
  const pointers = createPointersSchemas(captureValues, data, evidence);
  const captures = createCapturesSchemas(captureValues, data, pointers);
  const constraints = createConstraintsSchemas(captureValues, captures, contributions, data, evidence);
  const decisionValues = createDecisionValuesSchemas(captureValues, constraints, data, evidence);
  const ruleInputs = createRuleInputsSchemas(captureValues, captures, constraints, data, evidence);
  const invocations = createInvocationsSchemas(data, ruleInputs);
  const operations = createOperationsSchemas(constraints, data, decisionValues, evidence, invocations);
  return createDecisionsSchemas(captureValues, constraints, contributions, data, decisionValues, evidence, invocations, operations);
}

