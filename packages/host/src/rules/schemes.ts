import type { Result } from "../diag/contract.js";
import type { GroupId, NodeRef, TyId } from "../ids/contract.js";
import type {
  AtomicContribution, ConstraintScheme, ContributionKey, FlowConstraint, InferenceValue, MemberConstraint, OperatorConstraint, VariableBound,
} from "../ir-infer/contract.js";
import type { CategoryEvidence, TypeEvidence } from "../ir-types/contract.js";
import { internType, readType } from "../ir-types/index.js";
import type { RulesDeps } from "./contract.js";
import { decideEmbedding } from "./embed.js";
import { at as where, callerDefect, notDecidedYet } from "./frontier.js";
import { decideOperator } from "./operators.js";
import { mergeErrors, validateValue } from "./errors.js";

export function variableOf(deps: RulesDeps, type: TyId, occurrence: NodeRef, group: GroupId | null): number | null {
  const term = readType(deps.types, type);
  if (term.kind !== "open") return null;
  if (group !== null && term.group !== group)
    return callerDefect(`an open type of group ${term.group} in a constraint of group ${group} at ${where(occurrence)}`, null);
  return term.variable;
}

function positions(deps: RulesDeps, evidence: readonly InferenceValue[], types: readonly TyId[], occurrence: NodeRef): readonly InferenceValue[] {
  if (evidence.length !== types.length)
    return callerDefect(`${evidence.length} evidence entries for the ${types.length} type positions of the constraint at ${where(occurrence)}`, null);
  const position = types.findIndex((type, index) => evidence[index]?.value.type !== type);
  if (position >= 0)
    return callerDefect(`the evidence of type position ${position} is not the constraint's type there, at ${where(occurrence)}`, null);
  for (const value of evidence) validateValue(deps, value);
  return evidence;
}

function ok<Value>(value: Value): Result<Value> {
  return { kind: "ok", value, diagnostics: [] };
}

function one(key: ContributionKey, reads: readonly number[], bounds: readonly number[], reference: AtomicContribution["constraint"]): Result<readonly AtomicContribution[]> {
  return ok([{ key, reads, bounds, constraint: reference }]);
}

function resultCategory(operands: readonly TypeEvidence[]): CategoryEvidence {
  const first = operands[0]?.category;
  if (first === undefined || first.kind !== "known") return { kind: "dynamic" };
  const category = first.category;
  return operands.every(operand => operand.category.kind === "known" && operand.category.category === category) ? first : { kind: "dynamic" };
}

function resultEvidence(deps: RulesDeps, type: TyId, occurrence: NodeRef, operands: readonly TypeEvidence[]): TypeEvidence {
  const selected = readType(deps.types, type);
  const category: CategoryEvidence = selected.kind === "primitive" && selected.primitive === "bool"
    ? { kind: "known", category: "boolean" } : resultCategory(operands);
  return {
    type, component: { kind: "body", value: occurrence }, category,
    numeric: { producer: occurrence, kind: "operation", category, authored: null },
    sum: null, nominal: null, pointer: null,
  };
}

function bound(key: ContributionKey, variable: number, kind: VariableBound["kind"], value: InferenceValue): VariableBound {
  return { contribution: key, variable, kind, value: value.value, error: value.error };
}

export function operatorScheme(deps: RulesDeps): ConstraintScheme<OperatorConstraint> {
  return {
    enumerate: input => {
      const value = input.constraint;
      const reads = new Set<number>();
      for (const operand of value.operands) {
        const variable = variableOf(deps, operand, value.occurrence, input.group);
        if (variable !== null) reads.add(variable);
      }
      const result = variableOf(deps, value.result, value.occurrence, input.group);
      return one({ node: value.occurrence, candidate: null, role: { kind: "operator" } }, [...reads].sort((left, right) => left - right),
        result === null ? [] : [result], input.reference);
    },
    evaluate: input => {
      const value = input.constraint;
      const final = new Map(input.reads.map(variable => [variable.variable, variable]));
      const operands = positions(deps, input.evidence, [...value.operands, value.result], value.occurrence).slice(0, value.operands.length).map(evidence => {
        const variable = variableOf(deps, evidence.value.type, value.occurrence, null);
        if (variable === null) return evidence;
        const resolved = final.get(variable);
        if (resolved === undefined) return callerDefect("an operator requires the actual final value of every declared variable read", null);
        return { value: { ...resolved.value, component: evidence.value.component }, error: resolved.error };
      });
      const variable = variableOf(deps, value.result, value.occurrence, null);
      const error = mergeErrors(operands);
      if (error !== null) return ok({
        bounds: variable === null ? [] : [bound(input.contribution.key, variable, "producer",
          { value: { type: internType(deps.types, { kind: "error" }), component: { kind: "body", value: value.occurrence },
            category: { kind: "dynamic" }, numeric: null, sum: null, nominal: null, pointer: null }, error })],
        decision: { kind: "error", error }, selectedCandidate: null,
      });
      const operation = decideOperator(deps, value.operator, operands.map(operand => operand.value), value.occurrence, null);
      if (variable === null && value.result !== operation.result)
        return notDecidedYet(`an operator ${value.operator} whose result type is not the decided one, at ${where(value.occurrence)}`, null);
      const key = input.contribution.key;
      return ok({
        bounds: variable === null ? [] : [bound(key, variable, "producer",
          { value: resultEvidence(deps, operation.result, value.occurrence, operands.map(operand => operand.value)), error: null })],
        decision: { kind: "op", operation },
        selectedCandidate: null,
      });
    },
  };
}

export function memberScheme(deps: RulesDeps): ConstraintScheme<MemberConstraint> {
  return {
    enumerate: input => {
      const { constraint, group, reference } = input;
      if (constraint.access !== "read") return notDecidedYet("a member write contribution", null);
      const receiver = variableOf(deps, constraint.receiver, constraint.occurrence, group);
      const result = variableOf(deps, constraint.result, constraint.occurrence, group);
      return one({ node: constraint.occurrence, candidate: null, role: { kind: "member" } },
        receiver === null ? [] : [receiver], result === null ? [] : [result], reference);
    },
    evaluate: input => {
      const { constraint } = input;
      const [receiver] = positions(deps, input.evidence, [constraint.receiver, constraint.result], constraint.occurrence);
      if (receiver === undefined) return callerDefect("a member read requires its actual receiver evidence", null);
      const variable = variableOf(deps, receiver.value.type, constraint.occurrence, null);
      const selected = variable === null ? receiver : input.reads.find(value => value.variable === variable);
      if (selected === undefined) return callerDefect("a member read requires the actual value of its receiver variable", null);
      validateValue(deps, selected);
      if (selected.error === null)
        return notDecidedYet("the selected member's declared inventory, type and native receiver representation", null);
      const result = variableOf(deps, constraint.result, constraint.occurrence, null);
      const value: InferenceValue = { error: selected.error,
        value: { type: selected.value.type, component: { kind: "body", value: constraint.occurrence },
          category: { kind: "dynamic" }, numeric: null, sum: null, nominal: null, pointer: null } };
      return ok({ bounds: result === null ? [] : [bound(input.contribution.key, result, "producer", value)],
        decision: { kind: "error", error: selected.error }, selectedCandidate: null });
    },
  };
}

export function flowScheme(deps: RulesDeps): ConstraintScheme<FlowConstraint> {
  return {
    enumerate: input => {
      const value = input.constraint;
      const from = variableOf(deps, value.from, value.occurrence, input.group);
      const to = variableOf(deps, value.to, value.occurrence, input.group);
      if (from !== null && to !== null) return one({ node: value.occurrence, candidate: null, role: { kind: "flow" } },
        [from], from === to ? [] : [to], input.reference);
      const bounds = from !== null ? [from] : to !== null ? [to] : [];
      return one({ node: value.occurrence, candidate: null, role: { kind: "flow" } }, [], bounds, input.reference);
    },
    evaluate: input => {
      const value = input.constraint;
      const [fromEvidence, toEvidence] = positions(deps, input.evidence, [value.from, value.to], value.occurrence);
      const from = variableOf(deps, value.from, value.occurrence, null);
      const to = variableOf(deps, value.to, value.occurrence, null);
      const key = input.contribution.key;
      if (from !== null && to !== null) {
        const resolved = input.reads.find(variable => variable.variable === from);
        if (resolved === undefined) return callerDefect("an open-to-open flow requires its actual final source read", null);
        if (from === to) return ok({ bounds: [], decision: resolved.error === null
          ? { kind: "flow", embedding: { kind: "identity" } } : { kind: "error", error: resolved.error }, selectedCandidate: null });
        return ok({ bounds: [bound(key, to, "producer", resolved)], decision: null, selectedCandidate: null });
      }
      if (from !== null && toEvidence !== undefined)
        return ok({ bounds: [bound(key, from, "demand", toEvidence)], decision: null, selectedCandidate: null });
      if (to !== null && fromEvidence !== undefined)
        return ok({ bounds: [bound(key, to, "producer", fromEvidence)], decision: null, selectedCandidate: null });
      const error = mergeErrors(input.evidence);
      if (error !== null) return ok({ bounds: [], decision: { kind: "error", error }, selectedCandidate: null });
      if (fromEvidence === undefined || toEvidence === undefined)
        return callerDefect("a closed flow requires its actual source and destination evidence", null);
      const embedding = decideEmbedding(deps, fromEvidence.value, toEvidence.value, value.role, value.occurrence, null);
      return ok({ bounds: [], decision: { kind: "flow", embedding }, selectedCandidate: null });
    },
  };
}
