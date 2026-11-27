import type { Cause, Diagnostic, ErrorValue, Result, UnitAnswerPosition, UnitRequest } from "../diag/contract.js";
import type { TyId } from "../ids/contract.js";
import type {
  AtomicContribution, Constraint, ConstraintDecision, ConstraintSet, ContributionOutcome, DefaultConstraint, FinalVariable, InferenceGroup,
  BodyTyping, CaptureRow, InferenceValue, InferenceVariable, InferredPartType, MemberRuleCompletion, MemberRuleStep, QualifiedOperatorField, SolvedConstraint,
} from "../ir-infer/contract.js";
import type { GroupConstraints, GroupSolution, InferDeps, InferPaused, InferStep,
  PlacementPaused, ResumeSolveGroup, SelectionConstraintContext, SolveAnswer, SolveGroup, SolveRequest } from "./contract.js";
import { requirePresent, resourceLimitDiagnostic, throwInvariant } from "../diag/index.js";
import { compareContributionKeys, inferredPartKey, inferredPartsOf } from "../ir-infer/index.js";
import { admitTypePublicationStep, internType, readType, refuseTypeConstruction } from "../ir-types/index.js";
import { checkedSourceBindingFieldOf } from "../ir-hir/index.js";
import type { BodyInstance, MemberInventory } from "../ir-types/contract.js";
import { encodeKey } from "../ids/index.js";
import { callerDefect, notInferredYet, validateInferenceLimits } from "./frontier.js";
import { bindingDefaultOf, checkedVoidCompletion, isLayoutOperand, layoutOperandCompletion, ownSignatureRequest } from "./own-signature.js";
import { bodyCaptureModes } from "./captures.js";
import { issueMemberSolve, takeMemberSolve } from "./member-pause.js";
import type { Enumerated, Reached, SolveFrame, StorageDependencies } from "./member-pause.js";
import { planStorageDependencies, retireStorageVertex, updateStorageWait } from "./storage-dependencies.js";

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
  if (paused.kind === "member") return resumeMember(deps, paused, answers);
  if (answers.length !== paused.requests.length) return callerDefect(RESUME, `${answers.length} answers for ${paused.requests.length} requests`);
  if (paused.captures.length !== paused.group.bodies.length)
    return callerDefect(RESUME, "the retained capture rows must belong to every actual group body");
  const bodies: BodyTyping[] = [];
  for (const [index, answer] of answers.entries()) {
    const request = present(paused.requests[index], "the actual signature request");
    if (answer.kind === "membersOf" || answer.kind === "memberTypeOf" || request.kind !== answer.kind)
      return callerDefect(RESUME, "the signature answer must retain its actual request arm");
    const body = present(paused.group.bodies[index], "the actual signature's body");
    const captures = present(paused.captures[index], "the actual retained Rules capture rows");
    const signature = answer.kind === "placeSignature" ? answer.value.signature : answer.value;
    bodies.push({ body, captures, signature: signature.id,
      completion: signature.result, yielded: null, sent: null });
  }
  return { kind: "done", value: { kind: "ok", value: { solution: { group: paused.group.id, variables: paused.variables,
    constraints: paused.solved, checks: paused.checks, bodies }, contributions: paused.contributions,
    positions: paused.positions, memberInventories: paused.memberInventories }, diagnostics: [] } };
};

type Frame<State> = SolveFrame<InferDeps<State>, GroupConstraints>;
type Step<State> = InferStep<GroupSolution, SolveRequest, InferPaused<State>>;
type MemberStep<State> = MemberRuleStep<MemberRuleCompletion, State>;

function solve<State>(deps: InferDeps<State>, group: InferenceGroup, generated: GroupConstraints, unit: UnitRequest): Step<State> {
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
  let defaults: Map<number, DefaultConstraint> | null = null;
  let selectionPosition = 0;
  let hasStorageEquality = false;
  for (const set of sets) {
    let offset = 0;
    for (const [index, constraint] of set.constraints.entries()) {
      if (constraint.kind === "default") {
        const variable = owned[constraint.variable];
        if (variable === undefined || !Object.is(variable.id, constraint.variable)
          || variable.occurrence.body !== set.body || constraint.occurrence.body !== set.body
          || variable.occurrence.node !== constraint.occurrence.node || defaults?.has(variable.id))
          return callerDefect(PORT, "a default must name its unique actual variable and occurrence");
        if (owned.length + (defaults?.size ?? 0) >= deps.graph.maximumWork)
          return refused(...diagnostics, limitDiagnostic(group, "inference dependency work", deps.graph.maximumWork));
        (defaults ??= new Map()).set(variable.id, constraint);
      }
      const source = constraint.kind === "member" || constraint.kind === "index" || constraint.kind === "call" || constraint.kind === "construct-literal"
        ? generated.selectionContexts[selectionPosition++] : undefined;
      const reached = reach(constraint, set.evidence, offset, source);
      hasStorageEquality ||= reached.kind === "eq";
      offset += reached.evidence.length;
      const listed = enumerate(deps, group, set, reached, index, owned, limits.maximumAtomicContributionsPerGroup - enumerated.length);
      if (listed.kind === "refused") return refused(...listed.diagnostics);
      diagnostics.push(...listed.diagnostics);
      for (const contribution of listed.value) {
        if (enumerated.length + 1 > limits.maximumAtomicContributionsPerGroup)
          return refused(limitDiagnostic(group, "atomic contributions per group", limits.maximumAtomicContributionsPerGroup));
        enumerated.push({ contribution, index, reached, set });
      }
    }
  }
  if (selectionPosition !== generated.selectionContexts.length)
    return callerDefect(PORT, "the checked selection origins must name only the actual selection constraints");
  enumerated.sort((left, right) => compareContributionKeys(left.contribution.key, right.contribution.key));

  let work = owned.length + enumerated.length + (defaults?.size ?? 0);
  if (work > deps.graph.maximumWork)
    return refused(...diagnostics, limitDiagnostic(group, "inference dependency work", deps.graph.maximumWork));
  let storage: StorageDependencies | null = null;
  if (hasStorageEquality) {
    const oriented = planStorageDependencies(enumerated, owned.length, work, deps.graph);
    if (oriented.kind !== "complete") return refused(...diagnostics, limitDiagnostic(group,
      oriented.kind === "resource-limit" && oriented.dimension === "result-entries" ? "inference dependency result entries" : "inference dependency work",
      oriented.kind === "resource-limit" && oriented.dimension === "result-entries" ? deps.graph.maximumResultEntries : deps.graph.maximumWork));
    ({ storage, work } = oriented.value);
  }
  const frame: Frame<State> = { deps, group, generated, unit, owned, defaults, enumerated, storage, diagnostics, positions, work, completed: 0,
    bounds: owned.map(() => []), decisions: new Map(), sourceErrors: new Map(), remainingBounds: owned.map(() => 0),
    readers: owned.map(() => []), remainingReads: [], contributionBounds: [], ready: [],
    variables: owned.map(() => undefined), checks: [], memberInventories: [] };
  const { readers, remainingReads, remainingBounds, ready, contributionBounds } = frame;
  for (const [index, item] of enumerated.entries()) {
    const contribution = item.contribution;
    if (index > 0 && compareContributionKeys(present(enumerated[index - 1], "a preceding contribution").contribution.key, contribution.key) === 0)
      return ruleDefect("a group's atomic contributions have duplicate qualified identities");
    if (!take(frame, contribution.reads.length + contribution.bounds.length)) return exhausted(frame);
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
      if (storage?.conditional.has(index) !== true)
        remainingBounds[variable] = present(remainingBounds[variable], "a contribution's actual bounded variable") + 1;
    }
    remainingReads.push(contribution.reads.length);
    contributionBounds.push(seenBounds);
    if (contribution.reads.length === 0) ready.push({ kind: "contribution", index });
  }
  for (const variable of owned) if (remainingBounds[variable.id] === 0) ready.push({ kind: "variable", index: variable.id });
  return continueSolve(frame, 0);
}

function take<State>(frame: Frame<State>, count: number): boolean {
  if (count > frame.deps.graph.maximumWork - frame.work) return false;
  frame.work += count;
  return true;
}

function exhausted<State>(frame: Frame<State>): Step<State> {
  return refused(...frame.diagnostics, limitDiagnostic(frame.group, "inference dependency work", frame.deps.graph.maximumWork));
}

function decide<State>(frame: Frame<State>, set: ConstraintSet, index: number, decision: ConstraintDecision): boolean {
  const { sourceErrors, decisions } = frame;
  if (decision.kind === "error") {
    if (!take(frame, 1)) return false;
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
}

function finishContribution<State>(frame: Frame<State>, index: number, item: Enumerated, evaluated: Result<ContributionOutcome>,
  inventory: MemberInventory | null): Step<State> | null {
  const { diagnostics, contributionBounds, bounds, memberInventories, remainingBounds, ready } = frame;
  if (evaluated.kind === "refused") return refused(...diagnostics, ...evaluated.diagnostics);
  diagnostics.push(...evaluated.diagnostics);
  const outcome: ContributionOutcome = evaluated.value;
  const application = item.reached.kind === "call" ? item.reached.constraint.application : null;
  if (outcome.selectedCandidate !== null && (item.reached.kind !== "call" || outcome.decision?.kind !== "call"
    || outcome.decision.application.candidate !== outcome.selectedCandidate
    || !item.set.candidates.some(list => list.id === application?.candidates
      && list.candidates.some(candidate => candidate.ordinal === outcome.selectedCandidate))))
    return ruleDefect("a selected candidate must retain its actual call constraint, decision and captured candidate identity");
  const undecidedFlow = outcome.decision === null && item.reached.kind === "flow" && outcome.bounds.length === 1
    ? { set: item.set, index: item.index } : null;
  for (const bound of outcome.bounds) {
    if (!present(contributionBounds[index], "the contribution's bound inventory").has(bound.variable))
      return ruleDefect(`the ${item.reached.kind} scheme bounded variable ${bound.variable} outside its contribution`);
    present(bounds[bound.variable], `the bound list of variable ${bound.variable}`).push({ bound, flow: undecidedFlow });
  }
  if (outcome.decision !== null) {
    if (outcome.decision.kind === "member") {
      if (inventory === null || item.reached.kind !== "member")
        return ruleDefect("a selected member must retain its completed receiver inventory");
      if (!take(frame, 1)) return exhausted(frame);
      memberInventories.push({ occurrence: item.reached.constraint.occurrence, inventory });
    }
    if (!decide(frame, item.set, item.index, outcome.decision)) return exhausted(frame);
  }
  for (const variable of item.contribution.bounds) {
    if (frame.storage?.conditional.has(index) === true) {
      if (outcome.bounds.length !== 0 && remainingBounds[variable] === 0 && updateStorageWait(frame.storage, variable, false))
        ready.push({ kind: "variable", index: variable });
      continue;
    }
    remainingBounds[variable] = present(remainingBounds[variable], "the remaining variable contributors") - 1;
    if (remainingBounds[variable] === 0) ready.push({ kind: "variable", index: variable });
  }
  return frame.storage !== null && !retireStorageVertex(frame.storage, frame.owned.length + index, work => take(frame, work))
    ? exhausted(frame) : null;
}

function finishVariable<State>(frame: Frame<State>, index: number): Step<State> | null {
  const { owned, bounds, deps, diagnostics, variables, positions, checks, group, readers, remainingReads, ready } = frame;
  const variable = present(owned[index], "the actual inference variable");
  const own = present(bounds[variable.id], `the bound list of variable ${variable.id}`)
    .sort((left, right) => compareContributionKeys(left.bound.contribution, right.bound.contribution));
  const rule = deps.rules.variables[variable.kind];
  const fallback = frame.defaults?.get(variable.id) ?? null;
  let inferredTypeBound: Parameters<typeof rule.finalize>[0]["inferredTypeBound"] = null;
  if (fallback?.rule === "signature-producers") {
    const body = deps.hirBody(variable.occurrence.body);
    if (variable.kind !== "signature" || variable.signature.part.kind !== "return" || body.owner !== variable.signature.definition
      || body.root.id !== variable.occurrence.node || body.body !== variable.occurrence.body)
      return callerDefect(PORT, "a no-value default must name its actual checked function result");
    const type = checkedVoidCompletion(deps, body);
    if (type === null || type !== fallback.type)
      return callerDefect(PORT, "a no-value default must retain its actual checked void bound");
    inferredTypeBound = { kind: "available", value: type };
  } else if (variable.kind === "signature" && variable.signature.part.kind === "variable") {
    const declaration = deps.itemOf(variable.signature.definition);
    if (declaration.kind !== "VariableDeclaration" || !("initializer" in declaration.tsonic) || declaration.type !== null
      || declaration.initializer?.id !== variable.occurrence.node || declaration.tsonic.initializer !== variable.occurrence.body
      || declaration.tsonic.inferredTypeBound === null)
      return callerDefect(PORT, "an inferred variable requires the bound at its actual checked initializer");
    const bound = declaration.tsonic.inferredTypeBound;
    inferredTypeBound = bound.kind === "unavailable" ? bound
      : { kind: "available", value: typeof bound.value === "number" ? bound.value : bound.value.type };
  }
  const finalized = rule.finalize({ variable, producers: own.filter(filed => filed.bound.kind === "producer").map(filed => filed.bound),
    demands: own.filter(filed => filed.bound.kind === "demand").map(filed => filed.bound), inferredTypeBound,
    default: fallback, declaredConstraint: null, declaredDefault: null });
  if (finalized.kind === "refused") return refused(...finalized.diagnostics);
  diagnostics.push(...finalized.diagnostics);
  variables[variable.id] = { variable: variable.id, ...finalized.value };
  positions.push({ position: { kind: "inference-variable", group: group.id, variable: variable.id }, error: finalized.value.error });
  for (const { bound, flow } of own) {
    const source = present(deps.checkedNodeOf({ kind: "body", value: bound.contribution.node }) ?? undefined, "the actual bound source");
    const checked = rule.check({ origin: source.origin, variable, final: finalized.value, bound }, { typeWork: deps.typeWork, unit: frame.unit });
    if (checked.kind === "refused") return refused(...checked.diagnostics);
    diagnostics.push(...checked.diagnostics);
    checks.push({ variable: variable.id, contribution: bound.contribution, bound, outcome: checked.value });
    if (flow !== null) {
      if (checked.value.kind === "satisfied"
        && !decide(frame, flow.set, flow.index, { kind: "flow", embedding: checked.value.embedding })) return exhausted(frame);
      if (checked.value.kind === "error"
        && !decide(frame, flow.set, flow.index, { kind: "error", error: checked.value.error })) return exhausted(frame);
    }
  }
  for (const reader of present(readers[variable.id], "the actual variable's readers")) {
    remainingReads[reader] = present(remainingReads[reader], "a reader's remaining final variables") - 1;
    if (remainingReads[reader] === 0) ready.push({ kind: "contribution", index: reader });
  }
  return null;
}

function pauseMember<State>(frame: Frame<State>, step: Extract<MemberStep<State>, { readonly kind: "paused" }>,
  position: number, index: number, item: Enumerated, inventory: MemberInventory | null): Step<State> {
  const earned = [...frame.diagnostics, ...step.earned];
  frame.diagnostics = [];
  const pending = { position, index, requests: step.requests, rule: step.paused, inventory };
  return { kind: "paused", earned, requests: step.requests,
    paused: issueMemberSolve(frame, pending, item.reached.constraint.occurrence) };
}

function resumeMember<State>(deps: InferDeps<State>, paused: Extract<InferPaused<State>, { readonly kind: "member" }>,
  answers: readonly SolveAnswer[]): Step<State> {
  const { frame, pending } = takeMemberSolve(deps, paused);
  if (answers.length !== pending.requests.length)
    return callerDefect(RESUME, `${answers.length} answers for ${pending.requests.length} requests`);
  const actual = answers.map(answer => answer.kind === "membersOf" || answer.kind === "memberTypeOf" ? answer
    : callerDefect(RESUME, "a member contribution requires its actual member answers"));
  const next = deps.rules.resumeMember(pending.rule, actual);
  const held = actual.find(answer => answer.kind === "membersOf")?.value ?? pending.inventory;
  const item = present(frame.enumerated[pending.index], "the paused atomic contribution");
  if (next.kind === "paused") return pauseMember(frame, next, pending.position, pending.index, item, held);
  return finishContribution(frame, pending.index, item, contributionOf(next.value), held) ?? continueSolve(frame, pending.position + 1);
}

function continueSolve<State>(frame: Frame<State>, start: number): Step<State> {
  const { ready, enumerated, variables, unit, group, storage } = frame;
  for (let position = start; position < ready.length || (storage?.defaultable.size ?? 0) !== 0; position += 1) {
    if (position === ready.length && storage !== null) {
      for (const component of storage.defaultable) {
        const waiting = present(storage.waiting.get(component), "the actual waiting storage literals");
        if (!take(frame, 1 + waiting.size)) return exhausted(frame);
        for (const index of waiting) ready.push({ kind: "storage-default", index });
        waiting.clear();
      }
      storage.defaultable.clear();
    }
    const task = present(ready[position], "the next inference dependency task");
    if (!take(frame, 1)) return exhausted(frame);
    if (task.kind === "variable" && storage?.targets.has(task.index) === true
      && present(frame.bounds[task.index], "the potential storage carrier's actual bounds").length === 0) {
      updateStorageWait(storage, task.index, true);
      continue;
    }
    frame.completed += 1;
    if (task.kind !== "contribution") {
      const stop = finishVariable(frame, task.index);
      if (stop !== null) return stop;
      if (storage !== null && !retireStorageVertex(storage, task.index, work => take(frame, work))) return exhausted(frame);
      continue;
    }
    let item = present(enumerated[task.index], "the actual atomic contribution");
    const target = storage?.conditional.get(task.index);
    if (target !== undefined && variables[target] !== undefined) {
      if (!take(frame, 1)) return exhausted(frame);
      const source = item.contribution.reads[0];
      if (storage?.reserve(source === target ? 4 : 5) !== true)
        return refused(...frame.diagnostics, limitDiagnostic(group, "inference dependency result entries", frame.deps.graph.maximumResultEntries));
      const reads = source === undefined || source === target ? [target] : source < target ? [source, target] : [target, source];
      item = { ...item, contribution: { ...item.contribution, reads, bounds: [] } };
      enumerated[task.index] = item;
    }
    const reads = item.contribution.reads.map(variable => {
      const final = present(variables[variable], "a completed variable read");
      return final.error === null ? final : { ...final, error: absorbed(unit, group.id, variable) };
    });
    const evaluated = evaluate(frame, item, reads);
    if (evaluated.kind === "paused") return pauseMember(frame, evaluated, position, task.index, item, null);
    const result = evaluated.kind === "done" ? contributionOf(evaluated.value) : evaluated;
    const stop = finishContribution(frame, task.index, item, result, null);
    if (stop !== null) return stop;
  }
  return finishSolve(frame);
}

function finishSolve<State>(frame: Frame<State>): Step<State> {
  const { deps, group, generated, unit, owned, enumerated, positions, sourceErrors, decisions, variables, checks, diagnostics, memberInventories } = frame;
  const sets = generated.constraints;
  if (frame.completed !== owned.length + enumerated.length) return notInferredYet(PORT, "a seeded or unseeded cyclic contribution component", null);
  for (const source of sourceErrors.values()) {
    const [first, ...rest] = source.errors;
    const actual = present(first, "the source operation's actual error");
    let error = actual;
    if (rest.length !== 0) {
      const length = source.errors.reduce((count, error) => count + error.causes.length, 0);
      if (!take(frame, length)) return exhausted(frame);
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
  const completions = new Map<ConstraintSet["body"], { readonly type: TyId; readonly error: ErrorValue | null }>();
  for (const variable of owned) if (variable.kind === "signature") {
    const type = present(variables[variable.id], "a finalized inferred-part variable").value.type;
    const key = inferredPartKey(variable.signature);
    if (parts.has(key)) return callerDefect(PORT, "an inferred part has more than one final variable");
    const part: InferredPartType = { part: variable.signature, type, error: present(variables[variable.id], "the finalized part").error,
      origin: { request: unit, position: { kind: "inference-variable", group: group.id, variable: variable.id } } };
    parts.set(key, part);
    if (variable.signature.part.kind === "parameter-initializer" || variable.signature.part.kind === "variable"
      || variable.signature.part.kind === "field" || variable.signature.part.kind === "enum-member-value") completions.set(variable.occurrence.body,
      { type: part.type, error: part.error === null ? null : { kind: "error", causes: [{ kind: "unit", unit: part.origin }] } });
  }
  const captures: (readonly CaptureRow[])[] = [];
  for (const reference of group.bodies) {
    const selected = bodyCaptureModes(deps, deps.hirBody(reference), count => take(frame, count));
    if (selected === null) return exhausted(frame);
    if (selected.kind === "refused") return { kind: "done", value: selected };
    diagnostics.push(...selected.diagnostics);
    captures.push(selected.value);
  }
  const requests: PlacementPaused["requests"][number][] = group.bodies.map((reference, position) => {
    const body = deps.hirBody(reference);
    const owner = deps.itemOf(body.owner);
    if (body.asynchronous || body.generator) return notInferredYet(PORT, "the solved execution channels of an async or generator body", body.root.origin);
    const instance: BodyInstance = { body: reference, bindings: { kind: "parametric" } };
    const layout = isLayoutOperand(body);
    if (owner.kind === "SourceFile" && !layout) return { kind: "placeSignature", placement: { kind: "execution-body", instance,
      completion: internType(deps.types, { kind: "intrinsic", intrinsic: "void" }), error: null } };
    const initializer = (owner.kind === "Parameter" || owner.kind === "VariableDeclaration" ||
      owner.kind === "PropertyDeclaration" || owner.kind === "EnumMember") && "initializer" in owner.tsonic ? owner.tsonic : null;
    const binding = bindingDefaultOf(body, owner);
    if (layout || initializer !== null || binding !== null) {
      let completion = completions.get(reference);
      if (completion === undefined) {
        if (!layout && owner.kind === "EnumMember")
          return callerDefect(PORT, "an authored enum initializer retains its solved inferred result");
        const set = present(sets[position], "the actual initializer constraint system");
        const index = set.constraints.findIndex(constraint => constraint.kind === "flow" && constraint.role === "initialization"
          && constraint.occurrence.body === reference && constraint.occurrence.node === body.root.id);
        const constraint = set.constraints[index];
        const decision = decisions.get(reference)?.get(index);
        if (constraint?.kind !== "flow" || decision === undefined || decision.kind !== "flow" && decision.kind !== "error")
          return callerDefect(PORT, "the annotated initializer requires its actual completed initialization flow");
        const declared = binding?.declaredType ?? (initializer?.initializer === reference ? initializer.declaredType : null);
        const target = layout ? layoutOperandCompletion(deps.types, body.root, constraint.from) :
          declared?.kind === "available" ? declared.value : null;
        if (target === null || constraint.to !== target)
          return callerDefect(PORT, layout ? "a layout operand completion requires its actual solved operand flow"
            : "an annotated initializer completion requires its actual checked declaration type");
        if (decision.kind === "flow" && decision.embedding.kind === "refused")
          return notInferredYet(PORT, "the actual incompatible initializer diagnostic", body.root.origin);
        if (decision.kind === "flow") {
          const term = layout ? readType(deps.types, target) : null;
          if (term?.kind === "open" && term.group !== group.id)
            return callerDefect(PORT, "a layout operand completion must retain its own finalized result variable");
          const type = term?.kind === "open" ? present(finalized[term.variable], "the solved layout operand").value.type : target;
          completion = { type, error: null };
        } else completion = { type: internType(deps.types, { kind: "error" }), error: { kind: "error", causes: [{ kind: "unit",
            unit: { request: unit, position: { kind: "source-node", node: { kind: "body", value: constraint.occurrence } } } }] } };
      }
      return { kind: "placeSignature", placement: { kind: "execution-body", instance, completion: completion.type,
        error: completion.error } };
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
  const pending: PlacementPaused["requests"] = [first, ...rest];
  const causes: Cause[] = positions.filter(position => position.error !== null)
    .map(position => ({ kind: "unit", unit: { request: unit, position: position.position } }));
  const [firstCause, ...restCauses] = causes;
  positions.push({ position: { kind: "result" }, error: firstCause === undefined ? null : { kind: "error", causes: [firstCause, ...restCauses] } });
  const paused: PlacementPaused = { kind: "placement", unit, positions, group, constraints: generated,
    contributions: enumerated.map(item => item.contribution), variables: finalized, solved, checks, captures, requests: pending, memberInventories };
  return { kind: "paused", requests: pending, paused, earned: diagnostics };
}

function reach(constraint: Constraint, evidence: readonly InferenceValue[], offset: number, source: SelectionConstraintContext | undefined): Reached {
  if (constraint.kind === "member" || constraint.kind === "index" || constraint.kind === "call" || constraint.kind === "construct-literal") {
    if (source?.occurrence.body !== constraint.occurrence.body || source.occurrence.node !== constraint.occurrence.node)
      return callerDefect(PORT, "a selection constraint requires its actual checked occurrence origin in constraint order");
    if (constraint.kind === "member" && source.kind === "member")
      return { kind: "member", constraint, origin: source.origin, evidence: evidence.slice(offset, offset + 2) };
    if (constraint.kind === "index" && source.kind === "index")
      return { kind: "index", constraint, origin: source.origin, evidence: evidence.slice(offset, offset + 3) };
    if (constraint.kind === "call" && source.kind === "call")
      return { kind: "call", constraint, origin: source.origin, scope: source.scope, evidence: evidence.slice(offset,
        offset + 2 + (constraint.application.receiver === null ? 0 : 1) + constraint.application.typeArguments.length
        + constraint.application.arguments.reduce((length, argument) => length + 1 + (argument.tuple?.length ?? 0), 0)) };
    if (constraint.kind === "construct-literal" && source.kind === "construction")
      return { kind: "construct-literal", constraint, origin: source.origin, bindings: source.bindings,
        evidence: evidence.slice(offset, offset + constraint.parts.length + (constraint.destination === null ? 1 : 2)) };
    return callerDefect(PORT, "a selection context must have the same role as its constraint");
  }
  if (constraint.kind === "op") return { kind: "op", constraint, evidence: evidence.slice(offset, offset + constraint.operands.length + 1) };
  if (constraint.kind === "eq") return { kind: "eq", constraint, evidence: evidence.slice(offset, offset + 2) };
  if (constraint.kind === "flow") return { kind: "flow", constraint, evidence: evidence.slice(offset, offset + 2) };
  if (constraint.kind === "literal") return { kind: "literal", constraint, evidence: evidence.slice(offset, offset + 1) };
  if (constraint.kind === "default") return { kind: "default", constraint, evidence: [] };
  return notInferredYet(PORT, `a constraint of kind ${constraint.kind}`, null);
}

function absorbed(unit: UnitRequest, group: InferenceGroup["id"], variable: number): ErrorValue {
  return { kind: "error", causes: [{ kind: "unit", unit: { request: unit, position: { kind: "inference-variable", group, variable } } }] };
}

function enumerate<State>(deps: InferDeps<State>, group: InferenceGroup, set: ConstraintSet, reached: Reached, index: number,
  variables: readonly InferenceVariable[], remainingContributions: number): Result<readonly AtomicContribution[]> {
  const common = { group: group.id, remainingContributions, reference: { body: set.body, index }, variables,
    candidates: set.candidates, evidence: reached.evidence };
  switch (reached.kind) {
    case "member": return remainingContributions === 0
      ? { kind: "refused", diagnostics: [limitDiagnostic(group, "atomic contributions per group", deps.limits.maximumAtomicContributionsPerGroup)] }
      : deps.rules.constraints.member.enumerate({ ...common, constraint: reached.constraint });
    case "construct-literal": return remainingContributions === 0
      ? { kind: "refused", diagnostics: [limitDiagnostic(group, "atomic contributions per group", deps.limits.maximumAtomicContributionsPerGroup)] }
      : deps.rules.constraints.constructLiteral.enumerate({ ...common, constraint: reached.constraint });
    case "index": return deps.rules.constraints.index.enumerate({ ...common, constraint: reached.constraint });
    case "op": return deps.rules.constraints.op.enumerate({ ...common, constraint: reached.constraint });
    case "eq": return deps.rules.constraints.eq.enumerate({ ...common, constraint: reached.constraint });
    case "flow": return deps.rules.constraints.flow.enumerate({ ...common, constraint: reached.constraint });
    case "literal": return deps.rules.constraints.literal.enumerate({ ...common, constraint: reached.constraint });
    case "call": return deps.rules.constraints.call.enumerate({ ...common, constraint: reached.constraint });
    case "default": return deps.rules.constraints.default.enumerate({ ...common, constraint: reached.constraint });
  }
}

function evaluate<State>(frame: Frame<State>, item: Enumerated,
  reads: readonly FinalVariable[]): MemberStep<State> | Result<ContributionOutcome> {
  const { deps, unit } = frame;
  const common = { contribution: item.contribution, candidates: item.set.candidates, evidence: item.reached.evidence, reads };
  const resolved = (type: TyId) => {
    const term = readType(deps.types, type);
    const final = term.kind === "open" ? reads.find(variable => variable.variable === term.variable) : undefined;
    return final === undefined ? term : readType(deps.types, final.value.type);
  };
  switch (item.reached.kind) {
    case "member": {
      const { constraint, origin } = item.reached;
      const node = deps.checkedNodeOf({ kind: "body", value: constraint.occurrence });
      const admit = (work: number, records: number): boolean => admitTypePublicationStep(deps.typeWork, work, records) === null;
      const original = constraint.origins.length === 1 ? constraint.origins[0] : undefined;
      const storage = node?.kind === "PropertyAccessExpression"
        ? deps.sourceFields(item.set.body)?.(node) ?? null
        : node?.kind === "BindingElement" && original?.kind === "declared" && constraint.access === "read"
          ? checkedSourceBindingFieldOf(deps.hirBody(item.set.body), node, constraint.key, original.declaration, deps.checkedNodeOf, deps.itemOf,
            type => readType(deps.types, type), admit)
          : null;
      const stop = admitTypePublicationStep(deps.typeWork, 0);
      if (stop !== null) return refuseTypeConstruction(deps.typeWork, stop, origin, unit);
      let checkedRead: TyId | null = null;
      if (storage !== null && constraint.access === "read" && node?.kind === "PropertyAccessExpression" && node.tsonic.role === "value") {
        const stopped = admitTypePublicationStep(deps.typeWork);
        if (stopped !== null) return refuseTypeConstruction(deps.typeWork, stopped, origin, unit);
        const read = node.tsonic.value.views.read;
        if (read.kind === "available") checkedRead = read.value;
      }
      return deps.rules.constraints.member.evaluate({ ...common, constraint, origin, storage, checkedRead });
    }
    case "index": return deps.rules.constraints.index.evaluate({ ...common, constraint: item.reached.constraint, origin: item.reached.origin });
    case "eq": return deps.rules.constraints.eq.evaluate({ ...common, constraint: item.reached.constraint });
    case "op": {
      const { constraint } = item.reached;
      const { operator } = constraint;
      const [first, second] = constraint.operands;
      let reference: QualifiedOperatorField | null = null;
      if ((operator === "==" || operator === "!=" || operator === "===" || operator === "!==") && first !== undefined && second !== undefined) {
        const left = resolved(first);
        const right = resolved(second);
        const operand = left.kind === "optional" && right.kind === "intrinsic" && right.intrinsic === "absence" ? 0
          : right.kind === "optional" && left.kind === "intrinsic" && left.intrinsic === "absence" ? 1 : null;
        const optional = operand === 0 ? left : operand === 1 ? right : null;
        if (operand !== null && optional?.kind === "optional" && readType(deps.types, optional.value).kind === "shape") {
          const node = deps.checkedNodeOf({ kind: "body", value: constraint.occurrence });
          const before = admitTypePublicationStep(deps.typeWork);
          if (node?.kind === "BinaryExpression" && node.tsonic.role === "comparison") {
            if (before !== null) return refuseTypeConstruction(deps.typeWork, before, node.origin, unit);
            const reached = operand === 0 ? node.left : node.right;
            const selected = item.reached.evidence[operand]?.value.component;
            if (selected?.kind !== "body" || selected.value.body !== item.set.body || selected.value.node !== reached.id)
              return callerDefect(PORT, "a comparison must retain its actual authored operand");
            let field = reached;
            while (field.kind === "ParenthesizedExpression") {
              const cut = admitTypePublicationStep(deps.typeWork);
              if (cut !== null) return refuseTypeConstruction(deps.typeWork, cut, node.origin, unit);
              field = field.expression;
            }
            if (field.kind === "PropertyAccessExpression" && field.tsonic.role === "value") {
              const proof = deps.sourceFields(item.set.body)?.(field);
              const stop = admitTypePublicationStep(deps.typeWork, 0);
              if (stop !== null) return refuseTypeConstruction(deps.typeWork, stop, node.origin, unit);
              if (proof?.presence != null) reference = { operand, field: proof };
            }
          }
        }
      }
      return deps.rules.constraints.op.evaluate({ ...common, constraint, reference });
    }
    case "flow": case "literal": {
      const reached = item.reached;
      const source = present(deps.checkedNodeOf({ kind: "body", value: reached.constraint.occurrence }) ?? undefined, "the actual selected operand source");
      const input = { ...common, origin: source.origin };
      const work = { typeWork: deps.typeWork, unit };
      if (reached.kind === "literal") return deps.rules.constraints.literal.evaluate({ ...input, constraint: reached.constraint }, work);
      const constraint = reached.constraint;
      const destination = reached.evidence[1]?.value.component;
      let optionalField = null;
      if ((constraint.role === "assignment" || constraint.role === "member-write") && destination?.kind === "body"
        && destination.value.body === item.set.body) {
        const stopped = admitTypePublicationStep(deps.typeWork, 0);
        if (stopped !== null) return refuseTypeConstruction(deps.typeWork, stopped, source.origin, unit);
        const incoming = resolved(constraint.from);
        if (incoming.kind === "intrinsic" && incoming.intrinsic === "absence" && resolved(constraint.to).kind === "optional") {
          const before = admitTypePublicationStep(deps.typeWork);
          if (before !== null) return refuseTypeConstruction(deps.typeWork, before, source.origin, unit);
          const target = deps.checkedNodeOf(destination);
          if (target?.kind === "PropertyAccessExpression" && target.tsonic.role === "assignment-target") {
            const field = deps.sourceFields(item.set.body)?.(target);
            if (field?.presence != null) optionalField = field;
          }
          const stop = admitTypePublicationStep(deps.typeWork, 0);
          if (stop !== null) return refuseTypeConstruction(deps.typeWork, stop, source.origin, unit);
        }
      }
      return deps.rules.constraints.flow.evaluate({ ...input, constraint, optionalField }, work);
    }
    case "call": return deps.rules.constraints.call.evaluate({ ...common, constraint: item.reached.constraint, origin: item.reached.origin,
      scope: item.reached.scope, typeWork: deps.typeWork, unit });
    case "construct-literal": return deps.rules.constraints.constructLiteral.evaluate({ ...common, constraint: item.reached.constraint,
      origin: item.reached.origin, bindings: item.reached.bindings, typeWork: deps.typeWork, unit });
    case "default": return deps.rules.constraints.default.evaluate({ ...common, constraint: item.reached.constraint });
  }
}

function contributionOf(result: Result<MemberRuleCompletion>): Result<ContributionOutcome> {
  if (result.kind === "refused") return result;
  if (result.value.kind !== "contribution") return ruleDefect("A paused inference contribution must complete as that contribution.");
  return { ...result, value: result.value.value };
}

function refused(...diagnostics: Diagnostic[]): Extract<Step<never>, { readonly kind: "done" }> {
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
