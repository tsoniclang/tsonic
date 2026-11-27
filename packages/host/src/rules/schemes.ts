import type { ErrorValue, Result } from "../diag/contract.js";
import type { GroupId, NodeRef, TyId } from "../ids/contract.js";
import type {
  AtomicContribution, ContributionKey, ContributionOutcome, FlowContributionScheme, InferenceValue,
  ArrayExtentConstraint, IndexContributionScheme, IndexDecision, IndexInput, MemberContributionScheme, MemberDecision, MemberInput, MemberRuleAnswer,
  NarrowedRefinement, OperationDecision, OperatorContributionScheme, RuleTable, VariableBound,
} from "../ir-infer/contract.js";
import type { CategoryEvidence, SourceObjectField, TypeEvidence } from "../ir-types/contract.js";
import { compareMemberKeys, internType, isNativeIntegerPrimitive, memberTypeRequestData, nativeArrayExtentOf, nativeCarrierHoldingOf, optionalValueDomainOf, readType } from "../ir-types/index.js";
import type { RulesDeps } from "./contract.js";
import { decideEmbedding } from "./embed.js";
import { at as where, callerDefect, notDecidedYet } from "./frontier.js";
import { decideOperator } from "./operators.js";
import { mergeErrors, validateValue } from "./errors.js";
import { MemberSuspension } from "./member-pause.js";
import type { MemberDestination, MemberOwner, MemberStep } from "./member-pause.js";

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

export function decideIndex(deps: RulesDeps, input: IndexInput): IndexDecision {
  const selected = selectIndex(deps, input);
  if (selectedIndexResult(selected) !== input.result)
    return notDecidedYet("an indexed view other than its selected array storage", input.context.origin);
  return selected;
}

function selectedIndexResult(index: IndexDecision): TyId {
  const result = index.read ?? index.write;
  return result ?? callerDefect("a selected native index must reach its element storage", null);
}

function selectIndex(deps: RulesDeps, input: Omit<IndexInput, "result">): IndexDecision {
  const receiver = readType(deps.types, input.receiver.type);
  if (receiver.kind !== "array" && receiver.kind !== "fixed-array")
    return notDecidedYet("the selected indexing law of a non-array receiver", input.context.origin);
  const key = readType(deps.types, input.key.type);
  if (key.kind !== "primitive" || !isNativeIntegerPrimitive(key.primitive))
    return notDecidedYet("an array index without a selected native integer", input.context.origin);
  if (input.access !== "read" && receiver.kind === "array" && receiver.readonly)
    return notDecidedYet("an indexed view other than its selected array storage", input.context.origin);
  const holding = nativeCarrierHoldingOf(deps.selectedNativeFacts.carrierHolding, receiver.kind);
  if (holding === null) return notDecidedYet("an index without its actual selected receiver holding", input.context.origin);
  return { carrier: receiver.kind, holding, receiver: input.receiver.type, key: input.key.type,
    read: input.access === "write" ? null : receiver.element, write: input.access === "read" ? null : receiver.element,
    failure: receiver.kind === "array" ? deps.selectedNativeFacts.arrayIndexFailure : deps.selectedNativeFacts.fixedArrayIndexFailure,
    writeCheck: input.access === "read" ? null : deps.selectedNativeFacts.destinationCheck };
}

export function indexScheme(deps: RulesDeps): IndexContributionScheme {
  return {
    enumerate: ({ constraint, group, reference }) => {
      const reads = new Set<number>();
      for (const type of [constraint.receiver, constraint.key]) {
        const variable = variableOf(deps, type, constraint.occurrence, group);
        if (variable !== null) reads.add(variable);
      }
      const result = variableOf(deps, constraint.result, constraint.occurrence, group);
      return one({ node: constraint.occurrence, candidate: null, role: { kind: "index" } },
        [...reads].sort((left, right) => left - right), result === null ? [] : [result], reference);
    },
    evaluate: ({ constraint, evidence, reads, origin, contribution }) => {
      const operands = positions(deps, evidence, [constraint.receiver, constraint.key, constraint.result], constraint.occurrence);
      const resolve = (value: InferenceValue | undefined): InferenceValue => {
        if (value === undefined) return callerDefect("an index requires both actual operand positions", origin);
        const variable = variableOf(deps, value.value.type, constraint.occurrence, null);
        if (variable === null) return value;
        const final = reads.find(read => read.variable === variable);
        if (final === undefined) return callerDefect("an index requires the final value of each declared read", origin);
        validateValue(deps, final);
        return { value: { ...final.value, component: value.value.component }, error: final.error };
      };
      const receiver = resolve(operands[0]);
      const key = resolve(operands[1]);
      const variable = variableOf(deps, constraint.result, constraint.occurrence, null);
      const error = mergeErrors([receiver, key]);
      if (error !== null) return ok(selectionError(internType(deps.types, { kind: "error" }), error,
        constraint.occurrence, contribution.key, variable));
      const input = { context: { occurrence: contribution.key.node, bindings: constraint.bindings, origin },
        receiver: receiver.value, key: key.value, access: constraint.access };
      const index = variable === null ? decideIndex(deps, { ...input, result: constraint.result }) : selectIndex(deps, input);
      return ok({ bounds: variable === null ? [] : [bound(contribution.key, variable, "producer", {
        value: resultEvidence(deps, selectedIndexResult(index), constraint.occurrence, []), error: null,
      })], decision: { kind: "index", index }, selectedCandidate: null });
    },
  };
}

function selectArrayExtent(deps: RulesDeps, constraint: ArrayExtentConstraint, operands: readonly TypeEvidence[]): OperationDecision {
  const selected = operands[0];
  if (operands.length !== 1 || selected === undefined) return callerDefect("an array extent requires its actual sole receiver", null);
  const receiver = readType(deps.types, selected.type);
  if (receiver.kind !== "array" && receiver.kind !== "fixed-array")
    return notDecidedYet("an extent without its actual native array receiver", null);
  const result = nativeArrayExtentOf(deps.selectedNativeFacts.arrayExtents, receiver.kind);
  const holding = nativeCarrierHoldingOf(deps.selectedNativeFacts.carrierHolding, receiver.kind);
  if (result === null || holding === null) return notDecidedYet("the actual selected native array extent and holding laws", null);
  return { kind: "selected", operation: { kind: "array-extent", declaration: constraint.declaration, holding },
    operands: [selected.type], result: internType(deps.types, { kind: "primitive", primitive: result }), execution: { kind: "pure" } };
}

export function operatorScheme(deps: RulesDeps): OperatorContributionScheme {
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
      const evidence = operands.map(operand => operand.value);
      const operation = value.operator === "array-extent" ? selectArrayExtent(deps, value, evidence)
        : decideOperator(deps, value.operator, evidence, value.occurrence, null, input.reference);
      if (variable === null && value.result !== operation.result)
        return notDecidedYet(`an operator ${value.operator} whose result type is not the decided one, at ${where(value.occurrence)}`, null);
      const key = input.contribution.key;
      return ok({
        bounds: variable === null ? [] : [bound(key, variable, "producer",
          { value: resultEvidence(deps, operation.result, value.occurrence, evidence), error: null })],
        decision: { kind: "op", operation },
        selectedCandidate: null,
      });
    },
  };
}

export function narrowOptionalRead(deps: RulesDeps, occurrence: NodeRef, source: TyId, checked: TyId, field: SourceObjectField | null): NarrowedRefinement | null {
  if (source === checked) return null;
  const presence = field?.presence;
  if (presence?.storage !== source || presence.present !== checked) {
    const domain = optionalValueDomainOf(readType(deps.types, source), type => readType(deps.types, type));
    if (domain.kind !== "optional-value" || domain.present !== checked) return null;
  }
  const root = { kind: "body", value: occurrence } satisfies TypeEvidence["component"];
  return { kind: "narrowed", source, result: checked, failure: deps.selectedNativeFacts.absentAccessFailure,
    proof: { steps: [{ from: { root, path: [{ kind: "optional-value" }] }, to: { root, path: [] },
      rule: "identity", premises: [] }], conclusion: 0 } };
}

function resumeMember(deps: RulesDeps, owner: MemberOwner, paused: MemberSuspension, answers: readonly MemberRuleAnswer[]): MemberStep {
  const { phase, origin, destination } = MemberSuspension.consume(owner, paused);
  const answer = answers[0];
  if (phase.kind === "inventory") {
    if (answers.length !== 1 || answer?.kind !== "membersOf" || answer.value.receiver !== phase.receiver)
      return callerDefect("a member read must resume with its actual receiver inventory", origin);
    const inventory = answer.value;
    if (inventory.completeness.kind !== "complete")
      return notDecidedYet("a read through an open member inventory", origin);
    let lower = 0;
    let upper = inventory.members.length;
    while (lower < upper) {
      const middle = lower + Math.floor((upper - lower) / 2);
      const member = inventory.members[middle];
      if (member === undefined) return callerDefect("a receiver inventory must retain every canonical member", origin);
      const comparison = compareMemberKeys(member.key, phase.key);
      if (comparison < 0) lower = middle + 1;
      else if (comparison > 0) upper = middle;
      else {
        if (member.kind !== "property") return notDecidedYet("an accessor or method member access", origin);
        if (phase.access !== "write" && !member.readOrigins.some(actual => actual.kind === "declared" && actual.declaration === phase.declaration))
          return callerDefect("a member read must retain its original readable declaration", origin);
        if (phase.access !== "read" && !member.writeOrigins.some(actual => actual.kind === "declared" && actual.declaration === phase.declaration))
          return callerDefect("a member write must retain its original writable declaration", origin);
        return MemberSuspension.pause(owner, { kind: "type", request: { receiver: inventory.receiver, member: middle, access: phase.access },
          inventory: member, storage: phase.storage, bindings: phase.bindings }, destination, origin);
      }
    }
    return callerDefect("the original member key is missing from its complete receiver inventory", origin);
  }
  const { access, receiver, member } = phase.request;
  if (answers.length !== 1 || answer?.kind !== "memberTypeOf" || answer.request.receiver !== receiver
    || answer.request.member !== member || answer.request.access !== access || answer.value.access !== access)
    return callerDefect("a member read must resume with its actual selected member type", origin);
  const key = answer.origin.request.key;
  const expected = memberTypeRequestData(phase.request);
  if (answer.origin.position.kind !== "result" || answer.origin.request.query !== "memberTypeOf" || !Array.isArray(key)
    || key.length !== expected.length || expected.some((part, index) => key[index] !== part))
    return callerDefect("a member type requires its actual completed result position", origin);
  const read = answer.value.access === "write" ? null : answer.value.read;
  const write = answer.value.access === "read" ? null : answer.value.write;
  if (access !== "write" && read === null)
    return callerDefect("a selected readable member requires its actual read type", origin);
  if (access !== "read" && write === null)
    return callerDefect("a selected writable member requires its actual write type", origin);
  const selected = access === "write" ? write : read;
  if (selected === null || (readType(deps.types, selected).kind === "error") !== (answer.error !== null))
    return callerDefect("a member access must retain the cause of its own actual type answer", origin);
  if (answer.error !== null)
    return finishMember(deps, destination, { kind: "error", causes: [{ kind: "unit", unit: answer.origin }] });
  const storage = phase.storage;
  if (storage === null || phase.inventory.optional && (access !== "read" || readType(deps.types, selected).kind !== "optional"))
    return notDecidedYet("the actual selected native receiver representation of this member access", origin);
  const decision: MemberDecision = { key: phase.inventory.key, origins: phase.inventory.origins,
    selectedDeclarations: [storage.field], primary: storage.field, bindings: phase.bindings,
    read, write, getter: null, setter: null,
    location: { kind: "data", receiver: "by-reference", check: { kind: "none" } } };
  if (destination.kind === "member") return { kind: "done", value: ok({ kind: "member", value: { kind: "decided", decision } }) };
  const variable = variableOf(deps, destination.result, destination.occurrence, null);
  const refinement = access === "read" && destination.checkedRead !== null
    ? narrowOptionalRead(deps, destination.occurrence, selected, destination.checkedRead, storage) : null;
  const value = resultEvidence(deps, refinement === null ? selected : refinement.result, destination.occurrence, []);
  return { kind: "done", value: ok({ kind: "contribution", value: {
    bounds: variable === null ? [] : [bound(destination.key, variable, "producer", { value, error: null })],
    decision: { kind: "member", member: decision, refinement }, selectedCandidate: null,
  } }) };
}

function decideMember(deps: RulesDeps, owner: MemberOwner, input: MemberInput, storage: SourceObjectField | null,
  destination: MemberDestination): MemberStep {
  const { access, receiver, key, origins, context } = input;
  if (access === "call") return notDecidedYet("a member call decision", context.origin);
  const origin = origins[0];
  if (origins.length !== 1 || origin?.kind !== "declared")
    return notDecidedYet("a member access without one original declared member origin", context.origin);
  const term = readType(deps.types, receiver.type);
  if (term.kind === "open" || term.kind === "error")
    return callerDefect("member selection requires a finalized receiver whose original errors were handled", context.origin);
  if (storage !== null && (term.kind !== "shape" || storage.receiver !== receiver.type || storage.field !== origin.declaration
    || storage.occurrence.body !== context.occurrence.body || storage.occurrence.node !== context.occurrence.node))
    return callerDefect("a compiler-owned object access requires its exact occurrence, receiver and field", context.origin);
  return MemberSuspension.pause(owner, { kind: "inventory", receiver: receiver.type, key, declaration: origin.declaration, access,
    storage, bindings: context.bindings },
    destination, context.origin);
}

function finishMember(deps: RulesDeps, destination: MemberDestination, error: ErrorValue): MemberStep {
  if (destination.kind === "member") return { kind: "done", value: ok({ kind: "member", value: { kind: "error", error } }) };
  const { occurrence, key, result } = destination;
  return { kind: "done", value: ok({ kind: "contribution", value: selectionError(internType(deps.types, { kind: "error" }),
    error, occurrence, key, variableOf(deps, result, occurrence, null)) }) };
}

function selectionError(type: TyId, error: NonNullable<InferenceValue["error"]>, occurrence: NodeRef,
  key: ContributionKey, variable: number | null): ContributionOutcome {
  const value: InferenceValue = { error, value: { type, component: { kind: "body", value: occurrence },
    category: { kind: "dynamic" }, numeric: null, sum: null, nominal: null, pointer: null } };
  return { bounds: variable === null ? [] : [bound(key, variable, "producer", value)],
    decision: { kind: "error", error }, selectedCandidate: null };
}

export function memberRules(deps: RulesDeps): Pick<RuleTable<MemberSuspension>, "member" | "resumeMember"> & {
  readonly scheme: MemberContributionScheme<MemberSuspension>;
} {
  const owner: MemberOwner = { kind: "member-rules" };
  return { member: (input, storage) => decideMember(deps, owner, input, storage, { kind: "member" }),
    resumeMember: (paused, answers) => resumeMember(deps, owner, paused, answers), scheme: memberScheme(deps, owner) };
}

function memberScheme(deps: RulesDeps, owner: MemberOwner): MemberContributionScheme<MemberSuspension> {
  return {
    enumerate: input => {
      const { constraint, group, reference } = input;
      if (constraint.access === "call") return notDecidedYet("a member call contribution", null);
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
      if (selected.error !== null) return { kind: "done", value: ok({ kind: "contribution", value:
        selectionError(selected.value.type, selected.error, constraint.occurrence, input.contribution.key,
          variableOf(deps, constraint.result, constraint.occurrence, null)) }) };
      return decideMember(deps, owner, {
        context: { occurrence: constraint.occurrence, bindings: constraint.bindings, origin: input.origin }, receiver: selected.value,
        key: constraint.key, origins: constraint.origins, access: constraint.access }, input.storage,
      { kind: "contribution", occurrence: constraint.occurrence, key: input.contribution.key, result: constraint.result,
        checkedRead: input.checkedRead });
    },
  };
}

export function flowScheme(deps: RulesDeps): FlowContributionScheme {
  return {
    enumerate: input => {
      const value = input.constraint;
      const from = variableOf(deps, value.from, value.occurrence, input.group);
      const to = variableOf(deps, value.to, value.occurrence, input.group);
      if (value.role === "assignment" || value.role === "member-write") {
        const reads = [from, to].filter((variable): variable is number => variable !== null);
        return one({ node: value.occurrence, candidate: null, role: { kind: "flow" } },
          [...new Set(reads)].sort((left, right) => left - right), [], input.reference);
      }
      if (from !== null && to === null) {
        const variable = input.variables[from];
        if (variable === undefined || variable.id !== from)
          return callerDefect("a flow requires its actual qualified source variable", null);
        if (variable.kind !== "local" || variable.local !== null)
          return one({ node: value.occurrence, candidate: null, role: { kind: "flow" } }, [], [from], input.reference);
      }
      return one({ node: value.occurrence, candidate: null, role: { kind: "flow" } },
        from === null ? [] : [from], to === null || from === to ? [] : [to], input.reference);
    },
    evaluate: (input, work) => {
      const value = input.constraint;
      const [fromEvidence, toEvidence] = positions(deps, input.evidence, [value.from, value.to], value.occurrence);
      const from = variableOf(deps, value.from, value.occurrence, null);
      const to = variableOf(deps, value.to, value.occurrence, null);
      const key = input.contribution.key;
      if (from !== null && to === null && input.contribution.bounds[0] === from && toEvidence !== undefined)
        return ok({ bounds: [bound(key, from, "demand", toEvidence)], decision: null, selectedCandidate: null });
      const source = from === null ? fromEvidence : input.reads.find(variable => variable.variable === from);
      if (source === undefined || fromEvidence === undefined || toEvidence === undefined)
        return callerDefect("a flow requires its actual finalized source and destination evidence", null);
      const write = value.role === "assignment" || value.role === "member-write";
      if (to !== null && !write) {
        if (from === to) return ok({ bounds: [], decision: source.error === null
          ? { kind: "flow", embedding: { kind: "identity" } } : { kind: "error", error: source.error }, selectedCandidate: null });
        return ok({ bounds: [bound(key, to, "producer", source)], decision: null, selectedCandidate: null });
      }
      const destination = to === null ? toEvidence : input.reads.find(variable => variable.variable === to);
      if (destination === undefined) return callerDefect("a write fit requires its actual finalized destination", null);
      validateValue(deps, destination);
      const error = mergeErrors([source, destination]);
      if (error !== null) return ok({ bounds: [], decision: { kind: "error", error }, selectedCandidate: null });
      const embedding = decideEmbedding(deps, { ...source.value, component: fromEvidence.value.component },
        { ...destination.value, component: toEvidence.value.component },
        value.role, value.occurrence, input.origin, work, input.optionalField);
      return embedding.kind === "refused" ? embedding
        : ok({ bounds: [], decision: { kind: "flow", embedding: embedding.value }, selectedCandidate: null });
    },
  };
}
