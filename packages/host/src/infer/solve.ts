import type { Cause, Diagnostic, ErrorValue, Result, UnitAnswerPosition, UnitRequest } from "../diag/contract.js";
import type {
  AtomicContribution, Constraint, ConstraintDecision, ConstraintSet, ContributionOutcome, FinalVariable, InferenceGroup,
  InferenceValue, InferredPartType, RecordedCheck, SolvedConstraint, VariableBound,
} from "../ir-infer/contract.js";
import type { GroupConstraints, GroupSolution, InferDeps, InferPaused, InferStep, ResumeSolveGroup, SolveGroup, SolveRequest } from "./contract.js";
import { requirePresent, resourceLimitDiagnostic, throwInvariant } from "../diag/index.js";
import { compareContributionKeys, inferredPartKey, inferredPartsOf } from "../ir-infer/index.js";
import { internType } from "../ir-types/index.js";
import { encodeKey } from "../ids/index.js";
import { callerDefect, notInferredYet, validateInferenceLimits } from "./frontier.js";
import { ownSignatureRequest } from "./own-signature.js";

const PORT = "SolveGroup";
const RESUME = "ResumeSolveGroup";

export const solveGroup: SolveGroup = (deps, group, constraints, unit) => {
  validateInferenceLimits(PORT, deps.limits, deps.graph);
  if (unit.key !== group.id) return callerDefect(PORT, "the actual owning inference unit must name this exact group");
  if (constraints.constraints.length !== group.bodies.length)
    return callerDefect(PORT, `${constraints.constraints.length} constraint systems for the ${group.bodies.length} bodies of group ${group.id}`);
  for (const [position, set] of constraints.constraints.entries()) {
    if (set.group !== group.id) return callerDefect(PORT, `the constraint system of ${set.body} belongs to group ${set.group}, not ${group.id}`);
    if (set.body !== group.bodies[position]) return callerDefect(PORT, `constraint system ${position} is of ${set.body}, not of ${String(group.bodies[position])}`);
  }
  if (group.bodies.length === 0) return callerDefect(PORT, "a solve requires a nonempty group");
  return solve(deps, group, constraints, unit);
};

export const resumeSolveGroup: ResumeSolveGroup = (deps, paused, answers) => {
  validateInferenceLimits(RESUME, deps.limits, deps.graph);
  if (answers.length !== paused.requests.length) return callerDefect(RESUME, `${answers.length} answers for ${paused.requests.length} requests`);
  const bodies = answers.map((answer, index) => {
    const request = present(paused.requests[index], "the actual signature request");
    if (request.kind !== answer.kind) return callerDefect(RESUME, "the signature answer must retain its actual request arm");
    return { body: present(paused.group.bodies[index], "the actual signature's body"), signature: answer.value.id,
    completion: answer.value.result, yielded: null, sent: null };
  });
  return { kind: "done", value: { kind: "ok", value: { solution: { group: paused.group.id, variables: paused.variables,
    constraints: paused.solved, checks: paused.checks, bodies }, contributions: paused.contributions,
    positions: paused.positions }, diagnostics: [] } };
};

type Reached =
  | { readonly kind: "op"; readonly constraint: Extract<Constraint, { readonly kind: "op" }>; readonly evidence: readonly InferenceValue[] }
  | { readonly kind: "flow"; readonly constraint: Extract<Constraint, { readonly kind: "flow" }>; readonly evidence: readonly InferenceValue[] };

interface FiledBound {
  readonly bound: VariableBound;
  readonly flow: { readonly set: ConstraintSet; readonly index: number } | null;
}

interface Enumerated {
  readonly contribution: AtomicContribution;
  readonly index: number;
  readonly reached: Reached;
  readonly set: ConstraintSet;
}

type Step = InferStep<GroupSolution, SolveRequest, InferPaused>;

function solve(deps: InferDeps, group: InferenceGroup, generated: GroupConstraints, unit: UnitRequest): Step {
  const sets = generated.constraints;
  const limits = deps.limits;
  const owned = sets.flatMap(set => set.variables);
  if (owned.length > limits.maximumVariablesPerGroup)
    return refused(limitDiagnostic(group, "inference variables per group", limits.maximumVariablesPerGroup));
  for (const [index, variable] of owned.entries()) if (variable.id !== index)
    return callerDefect(PORT, "the group's variable identities must be dense in canonical body and source order");
  const diagnostics: Diagnostic[] = [];
  const positions: UnitAnswerPosition[] = [];
  const enumerated: Enumerated[] = [];
  for (const set of sets) {
    let offset = 0;
    for (const [index, constraint] of set.constraints.entries()) {
    const reached = reach(constraint, set.evidence, offset);
    offset += reached.evidence.length;
    const listed = enumerate(deps, group, set, reached, index, limits.maximumAtomicContributionsPerGroup - enumerated.length);
    if (listed.kind === "refused") return refused(...listed.diagnostics);
    diagnostics.push(...listed.diagnostics);
    for (const contribution of listed.value) {
      if (enumerated.length + 1 > limits.maximumAtomicContributionsPerGroup)
        return refused(limitDiagnostic(group, "atomic contributions per group", limits.maximumAtomicContributionsPerGroup));
      enumerated.push({ contribution, index, reached, set });
    }
    }
  }
  enumerated.sort((left, right) => compareContributionKeys(left.contribution.key, right.contribution.key));

  const bounds: FiledBound[][] = owned.map(() => []);
  const decisions = new Map<ConstraintSet["body"], Map<number, ConstraintDecision>>();
  const sourceErrors = new Map<string, { readonly node: Constraint["occurrence"]; readonly errors: ErrorValue[] }>();
  const decide = (set: ConstraintSet, index: number, decision: ConstraintDecision): boolean => {
    if (decision.kind === "error") {
      if (!take(1)) return false;
      const node = present(set.constraints[index], "the decided constraint").occurrence;
      const key = encodeKey([node.body, node.node]);
      const source = sourceErrors.get(key);
      if (source === undefined) sourceErrors.set(key, { node, errors: [decision.error] });
      else source.errors.push(decision.error);
    }
    const entries = decisions.get(set.body) ?? new Map<number, ConstraintDecision>();
    entries.set(index, decision);
    decisions.set(set.body, entries);
    return true;
  };
  let work = 0;
  const take = (count: number): boolean => {
    if (count > deps.graph.maximumWork - work) return false;
    work += count;
    return true;
  };
  const exhausted = (): Step => refused(limitDiagnostic(group, "inference dependency work", deps.graph.maximumWork));
  if (!take(owned.length + enumerated.length)) return exhausted();
  const remainingBounds = owned.map(() => 0);
  const readers: number[][] = owned.map(() => []);
  const remainingReads: number[] = [];
  const contributionBounds: ReadonlySet<number>[] = [];
  const ready: { readonly kind: "contribution" | "variable"; readonly index: number }[] = [];
  for (const [index, item] of enumerated.entries()) {
    const contribution = item.contribution;
    if (index > 0 && compareContributionKeys(present(enumerated[index - 1], "a preceding contribution").contribution.key, contribution.key) === 0)
      return ruleDefect("a group's atomic contributions have duplicate qualified identities");
    if (!take(contribution.reads.length + contribution.bounds.length)) return exhausted();
    const seenReads = new Set<number>();
    for (const variable of contribution.reads) {
      if (seenReads.has(variable)) return ruleDefect("a contribution reads a variable twice");
      seenReads.add(variable);
      present(readers[variable], "a contribution's actual read variable").push(index);
    }
    const seenBounds = new Set<number>();
    for (const variable of contribution.bounds) {
      if (seenBounds.has(variable)) return ruleDefect("a contribution bounds a variable twice");
      seenBounds.add(variable);
      remainingBounds[variable] = present(remainingBounds[variable], "a contribution's actual bounded variable") + 1;
    }
    remainingReads.push(contribution.reads.length);
    contributionBounds.push(seenBounds);
    if (contribution.reads.length === 0) ready.push({ kind: "contribution", index });
  }
  for (const variable of owned) if (remainingBounds[variable.id] === 0) ready.push({ kind: "variable", index: variable.id });
  const variables: (FinalVariable | undefined)[] = owned.map(() => undefined);
  const checks: RecordedCheck[] = [];
  let completed = 0;
  for (let position = 0; position < ready.length; position += 1) {
    const task = present(ready[position], "the next inference dependency task");
    if (!take(1)) return exhausted();
    completed += 1;
    if (task.kind === "contribution") {
    const item = present(enumerated[task.index], "the actual atomic contribution");
    const reads = item.contribution.reads.map(variable => {
      const final = present(variables[variable], "a completed variable read");
      return final.error === null ? final : { ...final, error: absorbed(unit, group.id, variable) };
    });
    const evaluated = evaluate(deps, item.set, item, reads);
    if (evaluated.kind === "refused") return refused(...evaluated.diagnostics);
    diagnostics.push(...evaluated.diagnostics);
    const outcome: ContributionOutcome = evaluated.value;
    if (outcome.selectedCandidate !== null) return notInferredYet(PORT, "a contribution that selects a candidate", null);
    const undecidedFlow = outcome.decision === null && item.reached.kind === "flow" && outcome.bounds.length === 1
      ? { set: item.set, index: item.index } : null;
    for (const bound of outcome.bounds) {
      if (!present(contributionBounds[task.index], "the contribution's bound inventory").has(bound.variable))
        return ruleDefect(`the ${item.reached.kind} scheme bounded variable ${bound.variable} outside its contribution`);
      present(bounds[bound.variable], `the bound list of variable ${bound.variable}`).push({ bound, flow: undecidedFlow });
    }
    if (outcome.decision !== null) {
      if (!decide(item.set, item.index, outcome.decision)) return exhausted();
    }
    for (const variable of item.contribution.bounds) {
      remainingBounds[variable] = present(remainingBounds[variable], "the remaining variable contributors") - 1;
      if (remainingBounds[variable] === 0) ready.push({ kind: "variable", index: variable });
    }
    } else {
    const variable = present(owned[task.index], "the actual inference variable");
    const own = present(bounds[variable.id], `the bound list of variable ${variable.id}`)
      .sort((left, right) => compareContributionKeys(left.bound.contribution, right.bound.contribution));
    const rule = deps.rules.variables[variable.kind];
    const finalized = rule.finalize({ variable, producers: own.filter(filed => filed.bound.kind === "producer").map(filed => filed.bound),
      demands: own.filter(filed => filed.bound.kind === "demand").map(filed => filed.bound), default: null, declaredConstraint: null, declaredDefault: null });
    if (finalized.kind === "refused") return refused(...finalized.diagnostics);
    diagnostics.push(...finalized.diagnostics);
    variables[variable.id] = { variable: variable.id, ...finalized.value };
    positions.push({ position: { kind: "inference-variable", group: group.id, variable: variable.id }, error: finalized.value.error });
    for (const { bound, flow } of own) {
      const checked = rule.check({ variable, final: finalized.value, bound });
      if (checked.kind === "refused") return refused(...checked.diagnostics);
      diagnostics.push(...checked.diagnostics);
      checks.push({ variable: variable.id, contribution: bound.contribution, bound, outcome: checked.value });
      if (flow !== null) {
        if (checked.value.kind === "satisfied"
          && !decide(flow.set, flow.index, { kind: "flow", embedding: checked.value.embedding })) return exhausted();
        if (checked.value.kind === "error"
          && !decide(flow.set, flow.index, { kind: "error", error: checked.value.error })) return exhausted();
      }
    }
    for (const reader of present(readers[variable.id], "the actual variable's readers")) {
      remainingReads[reader] = present(remainingReads[reader], "a reader's remaining final variables") - 1;
      if (remainingReads[reader] === 0) ready.push({ kind: "contribution", index: reader });
    }
    }
  }
  if (completed !== owned.length + enumerated.length) return notInferredYet(PORT, "a seeded or unseeded cyclic contribution component", null);
  for (const source of sourceErrors.values()) {
    const [first, ...rest] = source.errors;
    const actual = present(first, "the source operation's actual error");
    let error = actual;
    if (rest.length !== 0) {
      const length = source.errors.reduce((count, error) => count + error.causes.length, 0);
      if (!take(length)) return exhausted();
      const causes = source.errors.flatMap(error => error.causes);
      error = { kind: "error", causes: [present(causes[0], "the source operation's original cause"), ...causes.slice(1)] };
    }
    positions.push({ position: { kind: "source-node", node: { kind: "body", value: source.node } }, error });
  }
  const finalized = variables.map(variable => present(variable, "the group's final variable"));
  checks.sort((left, right) => left.variable - right.variable || compareContributionKeys(left.contribution, right.contribution));
  const solved: SolvedConstraint[] = sets.flatMap(set => [...(decisions.get(set.body) ?? [])].sort(([left], [right]) => left - right)
    .map(([index, decision]) => ({ constraint: { body: set.body, index }, decision })));
  const parts = new Map<string, InferredPartType>();
  const ownDefinitions = new Set(group.signatures.map(part => part.definition));
  const ownParts = new Set(group.signatures.map(inferredPartKey));
  for (const part of generated.outsideParts) {
    const key = inferredPartKey(part.part);
    if (parts.has(key) || ownParts.has(key)) return callerDefect(PORT, "outside-group parts must be distinct and owned by another group");
    parts.set(key, part);
  }
  const completions = new Map<ConstraintSet["body"], InferredPartType>();
  for (const variable of owned) if (variable.kind === "signature") {
    const type = present(variables[variable.id], "a finalized inferred-part variable").value.type;
    const key = inferredPartKey(variable.signature);
    if (parts.has(key)) return callerDefect(PORT, "an inferred part has more than one final variable");
    const part: InferredPartType = { part: variable.signature, type, error: present(variables[variable.id], "the finalized part").error,
      origin: { request: unit, position: { kind: "inference-variable", group: group.id, variable: variable.id } } };
    parts.set(key, part);
    if (variable.signature.part.kind === "parameter-initializer") completions.set(variable.occurrence.body, part);
  }
  const requests: SolveRequest[] = group.bodies.map(reference => {
    const body = deps.hirBody(reference);
    const owner = deps.itemOf(body.owner);
    if (body.asynchronous || body.generator) return notInferredYet(PORT, "the solved execution channels of an async or generator body", body.root.origin);
    const instance = { body: reference, bindings: { kind: "parametric" as const } };
    if (owner.kind === "SourceFile") return { kind: "placeSignature", placement: { kind: "execution-body", instance,
      completion: internType(deps.types, { kind: "intrinsic", intrinsic: "void" }), error: null } };
    if (owner.kind === "Parameter") {
      const completion = present(completions.get(reference), "the default argument's actual solved completion");
      return { kind: "placeSignature", placement: { kind: "execution-body", instance, completion: completion.type,
        error: completion.error === null ? null : { kind: "error", causes: [{ kind: "unit", unit: completion.origin }] } } };
    }
    const required = inferredPartsOf(body.owner, owner);
    const ready = required.map(part => parts.get(inferredPartKey(part)));
    if (ready.some(part => part === undefined)) {
      const request = ownSignatureRequest(deps, body, PORT, ownDefinitions);
      if (request === null) return callerDefect(PORT, "a same-group inferred part has no final value for signature placement");
      return request;
    }
    return { kind: "placeSignature", placement: { kind: "callable-body", instance,
      parts: ready.map(part => present(part, "the actual solved signature part")) } };
  });
  const [first, ...rest] = requests;
  if (first === undefined) return callerDefect(PORT, "a solve requires actual execution bodies");
  const pending: readonly [SolveRequest, ...SolveRequest[]] = [first, ...rest];
  const causes: Cause[] = positions.filter(position => position.error !== null)
    .map(position => ({ kind: "unit", unit: { request: unit, position: position.position } }));
  const [firstCause, ...restCauses] = causes;
  positions.push({ position: { kind: "result" }, error: firstCause === undefined ? null : { kind: "error", causes: [firstCause, ...restCauses] } });
  const paused: InferPaused = { unit, positions, group, constraints: generated, contributions: enumerated.map(item => item.contribution), variables: finalized,
    solved, checks, requests: pending };
  return { kind: "paused", requests: pending, paused, earned: diagnostics };
}

function reach(constraint: Constraint, evidence: readonly InferenceValue[], offset: number): Reached {
  if (constraint.kind === "op") return { kind: "op", constraint, evidence: evidence.slice(offset, offset + constraint.operands.length + 1) };
  if (constraint.kind === "flow") return { kind: "flow", constraint, evidence: evidence.slice(offset, offset + 2) };
  return notInferredYet(PORT, `a constraint of kind ${constraint.kind}`, null);
}

function absorbed(unit: UnitRequest, group: InferenceGroup["id"], variable: number): ErrorValue {
  return { kind: "error", causes: [{ kind: "unit", unit: { request: unit, position: { kind: "inference-variable", group, variable } } }] };
}

function enumerate(deps: InferDeps, group: InferenceGroup, set: ConstraintSet, reached: Reached, index: number,
  remainingContributions: number): Result<readonly AtomicContribution[]> {
  const common = { group: group.id, remainingContributions, reference: { body: set.body, index }, variables: set.variables,
    candidates: set.candidates, evidence: reached.evidence };
  switch (reached.kind) {
    case "op": return deps.rules.constraints.op.enumerate({ ...common, constraint: reached.constraint });
    case "flow": return deps.rules.constraints.flow.enumerate({ ...common, constraint: reached.constraint });
  }
}

function evaluate(deps: InferDeps, set: ConstraintSet, item: Enumerated, reads: readonly FinalVariable[]): Result<ContributionOutcome> {
  const common = { contribution: item.contribution, candidates: set.candidates, evidence: item.reached.evidence, reads };
  switch (item.reached.kind) {
    case "op": return deps.rules.constraints.op.evaluate({ ...common, constraint: item.reached.constraint });
    case "flow": return deps.rules.constraints.flow.evaluate({ ...common, constraint: item.reached.constraint });
  }
}

function refused(...diagnostics: Diagnostic[]): Step {
  const [first, ...rest] = diagnostics;
  return { kind: "done", value: { kind: "refused", diagnostics: [present(first, "the refusal's diagnostic"), ...rest] } };
}

function limitDiagnostic(group: InferenceGroup, limit: string, maximum: number): Diagnostic {
  return resourceLimitDiagnostic({ owner: "infer", limit, maximum, site: { kind: "none" },
    unit: { request: { query: "solutionOf", key: group.id }, position: { kind: "result" } } });
}

function ruleDefect(message: string): never {
  return throwInvariant({ owner: "infer", query: null, origin: null, message: `${PORT}: ${message}` });
}

function present<Value>(value: Value | undefined, what: string): Value {
  return requirePresent(value, { owner: "infer", query: null, origin: null, message: `${PORT}: ${what} is missing` });
}
