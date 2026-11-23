import type { ConstantCycleMember, DeclarationCycleMember, DeclarationCycleTarget, DeclaredSignaturePause, DeclsDeps,
  TypeProductionPause, TypeProductionStep } from "../decls/contract.js";
import type { DataflowStop } from "../dataflow/contract.js";
import { chargeResultEntries, chargeWork, createAccount } from "../dataflow/index.js";
import type { Diagnostic, Result, UnitErrorRead, UnitRef, UnitRequest } from "../diag/contract.js";
import { resourceLimitDiagnostic, throwInvariant } from "../diag/index.js";
import { encodeKey } from "../ids/index.js";
import type { DefId, GroupId, Origin, SourceNodeRef, TyId } from "../ids/contract.js";
import type { CheckedTypingCut, CheckedTypingCuts } from "../ir-hir/contract.js";
import type { ConstraintsAnswer, ConstraintsPaused, ConstraintsRequest, GroupConstraints, GroupSolution, InferDeps,
  InferPaused, InferStep, SolveAnswer, SolveRequest } from "../infer/contract.js";
import type { InferenceGroup, InferredPartRequest, InferredPartType, MemberRuleAnswer, MemberRuleNeed,
  PlacedSignature, TypeProductionAnswer, TypeProductionNeed } from "../ir-infer/contract.js";
import { inferredPartKey } from "../ir-infer/index.js";
import type { InstantiationLimits } from "../ir-program/contract.js";
import type { BindingScope, MemberInventory, MemberTypeRequest, MemberTypes, Signature, SignatureRequest, TypeEvidence,
  TypeProductionRequest } from "../ir-types/contract.js";
import { signatureRequestData, typeProductionRequestData, verifyBindings, viewTypes } from "../ir-types/index.js";
import type { ClassifyCycle, ClosedCycle, CycleOutcome, Database, Query, QueryLimits } from "../query/contract.js";
import { createDatabase } from "../query/index.js";
import type { DeclaredSignatureErrorData } from "../decls/contract.js";
import type { CheckedSourceViews } from "./checked-inputs.js";
import type { Pause, Route } from "./driver.js";
import { abandonAtReport, defineQuery, factRoute, nestedRoute, projectionRoute } from "./driver.js";
import type { CompletedPlacement, InferencePublication, InferenceViews } from "./inference-step.js";
import { completeInference, projectInferredPart } from "./inference-step.js";
import { pipelineWiring } from "./wiring.js";
import type { MemberRuleContinuation } from "../rules/contract.js";
import type { FormDiagnosticSite } from "../validate/contract.js";

export interface SourceSemanticInputs {
  readonly declarations: DeclsDeps;
  readonly instantiation: Pick<InstantiationLimits, "maximumWork" | "maximumCreatedRecords">;
}

export interface SourceSemanticReady {
  readonly inference: InferDeps<MemberRuleContinuation>;
  readonly groups: readonly InferenceGroup[];
  readonly sources: CheckedSourceViews;
  readonly forms: FormDiagnosticQuery;
  readonly groupForms: (group: InferenceGroup) => Iterable<FormPrerequisite>;
  readonly projectForms: ReadonlyMap<FormDiagnosticSite, CheckedTypingCut>;
  readonly bindingScopeOf: (definition: DefId) => BindingScope;
  readonly verification: (group: InferenceGroup, constraints: GroupConstraints, result: GroupSolution) => InferenceViews;
}

interface FormPrerequisite {
  readonly kind: "forms-prerequisite";
  readonly site: FormDiagnosticSite;
  readonly source: SourceNodeRef;
}

interface FormPrerequisiteAnswer {
  readonly kind: "forms-prerequisite";
  readonly site: FormDiagnosticSite;
  readonly cut: CheckedTypingCut;
}

type InferenceRequest = ConstraintsRequest | SolveRequest | FormPrerequisite;
type InferenceAnswer = ConstraintsAnswer | SolveAnswer | FormPrerequisiteAnswer;
type InferencePause =
  | { readonly kind: "prerequisites"; readonly group: InferenceGroup; readonly next: Iterator<FormPrerequisite>;
      readonly pending: FormPrerequisite; readonly completed: Map<FormDiagnosticSite, CheckedTypingCut> }
  | { readonly kind: "constraints"; readonly unit: UnitRequest; readonly group: InferenceGroup; readonly state: ConstraintsPaused;
      readonly inference: InferDeps<MemberRuleContinuation> }
  | { readonly kind: "solve"; readonly unit: UnitRequest; readonly group: InferenceGroup;
      readonly constraints: GroupConstraints; readonly state: InferPaused<MemberRuleContinuation>; readonly inference: InferDeps<MemberRuleContinuation> };

type SemanticWorkWitness = { readonly target: DeclarationCycleTarget | MemberRuleNeed | TypeProductionNeed; readonly source: SourceNodeRef } & (
  | { readonly kind: "declared-signature"; readonly state: DeclaredSignaturePause; readonly ready: readonly InferredPartType[] }
  | { readonly kind: "inference"; readonly state: InferencePause; readonly ready: readonly InferenceAnswer[] }
  | { readonly kind: "type-production"; readonly state: TypeProductionPause; readonly ready: readonly (MemberRuleAnswer | TypeProductionAnswer)[] }
);
export type SourceSemanticWitness = SemanticWorkWitness | { readonly kind: "forms-prerequisite";
  readonly source: SourceNodeRef; readonly site: FormDiagnosticSite }
  | { readonly kind: "constant-demand"; readonly origin: Origin };

type FormDiagnosticQuery = Query<SourceSemanticInputs, FormDiagnosticSite, CheckedTypingCut, SourceSemanticWitness, DeclaredSignatureErrorData>;

export function formDiagnosticsQuery(base: SourceSemanticInputs, owns: (site: FormDiagnosticSite) => boolean): FormDiagnosticQuery {
  const deps = { owns };
  return { name: "formDiagnostics", keyData: site => [site.module, site.report.id], answerPolicy: { kind: "refusal-only" },
    compute: (context, site) => {
      if (context.inputs !== base) return fail("Forms requires its actual immutable Query base.");
      return pipelineWiring.validate.formDiagnostics(deps, site, { query: context.fact.query, key: context.fact.key });
    } };
}

export function completedFormCut(site: FormDiagnosticSite, cut: CheckedTypingCut, errorOf: (unit: UnitRef) => UnitErrorRead): CheckedTypingCut {
  const { position } = cut.report;
  if (cut.module !== site.module || cut.node !== site.cut || position.kind !== "module-node"
    || position.module !== site.module || position.node !== site.report.id)
    return fail("A Forms cut requires its actual checked syntax in the qualified module.");
  const completed = errorOf(cut.report);
  if (completed.kind !== "completed" || completed.error !== cut.error)
    return fail("Forms must retain its exact completed checked error position in this module.");
  return cut;
}

export interface SourceSemanticQueries {
  readonly declaredSignatureOf: Query<SourceSemanticInputs, SignatureRequest, Signature, SourceSemanticWitness, DeclaredSignatureErrorData>;
  readonly membersOf: Query<SourceSemanticInputs, TyId, MemberInventory, SourceSemanticWitness, DeclaredSignatureErrorData>;
  readonly memberTypeOf: Query<SourceSemanticInputs, MemberTypeRequest, MemberTypes, SourceSemanticWitness, DeclaredSignatureErrorData>;
  readonly produceType: Query<SourceSemanticInputs, TypeProductionRequest, TypeEvidence, SourceSemanticWitness, DeclaredSignatureErrorData>;
  readonly solutionOf: Query<SourceSemanticInputs, GroupId, ScopedInferencePublication, SourceSemanticWitness, DeclaredSignatureErrorData>;
}

export interface ScopedInferencePublication extends InferencePublication {
  readonly checkedCuts: CheckedTypingCuts;
}

type SolutionStep = Pause<ScopedInferencePublication, InferenceRequest, InferencePause>;

interface SemanticRegistrations {
  readonly queries: SourceSemanticQueries;
  readonly productionRefusalOf: () => Extract<Result<never>, { readonly kind: "refused" }> | null;
}

export function createSourceSemanticDatabase(inputs: SourceSemanticInputs, limits: QueryLimits): {
  readonly bind: (ready: SourceSemanticReady) => SemanticRegistrations;
  readonly database: Database<SourceSemanticInputs, SourceSemanticWitness, DeclaredSignatureErrorData>;
} {
  let classifier: ClassifyCycle<SourceSemanticWitness, DeclaredSignatureErrorData> | null = null;
  const database = createDatabase<SourceSemanticInputs, SourceSemanticWitness, DeclaredSignatureErrorData>(inputs, limits, cycle =>
    classifier === null ? fail("A semantic cycle requires the actual bound source partition.") : classifier(cycle), "off");
  const bind = (ready: SourceSemanticReady): SemanticRegistrations => {
    if (classifier !== null) return fail("The checked Query base binds its actual source partition once.");
    const registered = createSourceSemanticQueries(inputs, ready);
    classifier = cycle => classifySourceCycle(inputs.declarations, ready.sources, registered.queries, cycle);
    return registered;
  };
  return { bind, database };
}

function classifySourceCycle(declarations: DeclsDeps, sources: CheckedSourceViews, queries: SourceSemanticQueries,
  cycle: ClosedCycle<SourceSemanticWitness>): readonly CycleOutcome<DeclaredSignatureErrorData>[] {
    const first = cycle.members[0];
    if (first.witness.kind === "constant-demand") {
      const constant = (member: typeof first): ConstantCycleMember => {
        if (member.witness.kind !== "constant-demand" || member.answerPolicy !== "refusal-only"
          || member.fact.query !== "enumOf" && member.fact.query !== "evaluateConstant")
          return fail("An execution-time constant cycle requires its actual completed-source value demands.");
        return { answerPolicy: member.answerPolicy, origin: member.witness.origin,
          unit: { query: member.fact.query, key: member.fact.key } };
      };
      return pipelineWiring.decls.classifyCycle(declarations, [constant(first), ...cycle.members.slice(1).map(constant)]);
    }
    const members = cycle.members.map((member, index): DeclarationCycleMember => {
      const previous = cycle.members[(index + cycle.members.length - 1) % cycle.members.length];
      if (previous === undefined) return fail("A closed cycle retains its actual incoming typed demand.");
      if (previous.witness.kind === "forms-prerequisite" || member.witness.kind === "forms-prerequisite"
        || previous.witness.kind === "constant-demand" || member.witness.kind === "constant-demand")
        return fail("A done-only Forms prerequisite or later constant demand cannot form a checked-type cycle.");
      const target = previous.witness.target;
      if (target.kind === "membersOf" || target.kind === "memberTypeOf" || target.kind === "produceType")
        return fail("The finite indexed producer and its ready declaration member dependencies cannot form a cycle.");
      const query = target.kind === "declared-signature" ? queries.declaredSignatureOf.name : queries.solutionOf.name;
      const key = target.kind === "declared-signature" ? signatureRequestData(target.request) : target.group.id;
      if (member.fact.query !== query || member.fact.encodedKey !== encodeKey(key))
        return fail("The incoming semantic target must project to this same original registered fact identity.");
      const witness = member.witness;
      if (sources.nodeOf(witness.source) === null)
        return fail("A semantic cycle witness requires its actual checked source occurrence.");
      return { unit: { query: member.fact.query, key: member.fact.key }, target, answerPolicy: member.answerPolicy,
        producer: witness.kind === "declared-signature" ? witness : witness.kind === "inference"
          ? { kind: "inference-solution", group: witness.state.group }
          : fail("Finite indexed production has no recursive dependency path.") };
    });
    const detector = members[0];
    if (detector === undefined) return fail("A closed cycle cannot be empty.");
    return pipelineWiring.decls.classifyCycle(declarations, [detector, ...members.slice(1)]);
}

function fail(message: string): never {
  return throwInvariant({ owner: "pipeline", query: null, origin: null, message });
}

function earned<Value, Request, State>(step: Pause<Value, Request, State>, diagnostics: readonly Diagnostic[]): Pause<Value, Request, State> {
  if (diagnostics.length === 0) return step;
  if (step.kind === "paused") return { ...step, earned: [...diagnostics, ...step.earned] };
  const all = [...diagnostics, ...step.value.diagnostics];
  if (step.value.kind === "ok") return { kind: "done", value: { ...step.value, diagnostics: all } };
  const first = all[0];
  if (first === undefined) return fail("An abandoned semantic producer must retain its refusing diagnostic.");
  return { kind: "done", value: { kind: "refused", diagnostics: [first, ...all.slice(1)] } };
}

export function createSourceSemanticQueries(base: SourceSemanticInputs, ready: SourceSemanticReady): SemanticRegistrations {
  const inputs = { ...base, ...ready };
  const productionAccount = createAccount({ maximumWork: inputs.instantiation.maximumWork,
    maximumResultEntries: inputs.instantiation.maximumCreatedRecords });
  let productionRefusal: Extract<Result<never>, { readonly kind: "refused" }> | null = null;
  const productionStopped = (stop: DataflowStop, unit: UnitRequest, origin: Origin): TypeProductionStep => ({
    kind: "done", value: productionRefusal ??= stop.kind === "refused" ? stop : { kind: "refused", diagnostics: [resourceLimitDiagnostic({
      owner: "pipeline", limit: `type production ${stop.dimension}`, maximum: stop.maximum, site: { kind: "source", origin },
      unit: { request: unit, position: { kind: "result" } } })] },
  });
  const groups = new Map<GroupId, InferenceGroup>();
  const bodies = new Map<InferenceGroup["bodies"][number], InferenceGroup>();
  const owners = new Map<string, InferenceGroup>();
  for (const group of inputs.groups) {
    if (groups.has(group.id) || group.bodies.length === 0) return fail("The ready inference partition must contain each nonempty group once.");
    groups.set(group.id, group);
    for (const body of group.bodies) {
      if (bodies.has(body)) return fail("A checked execution must belong to exactly one ready inference group.");
      bodies.set(body, group);
    }
    for (const part of group.signatures) {
      const key = inferredPartKey(part);
      if (owners.has(key)) return fail("An inferred signature part must have exactly one actual partition owner.");
      owners.set(key, group);
    }
  }
  const groupOf = (key: GroupId): InferenceGroup => groups.get(key)
    ?? fail("The requested solution group is absent from the ready checked partition.");
  const ownerOf = (request: InferredPartRequest): InferenceGroup => owners.get(inferredPartKey(request.part))
    ?? fail("The requested inferred part has no actual ready partition owner.");
  const sameInputs = (actual: SourceSemanticInputs): void => {
    if (actual !== base) fail("Semantic query registrations belong to their actual immutable run inputs.");
  };
  const unitOf = (group: InferenceGroup): UnitRequest => ({ query: solutionOf.name, key: group.id });
  const declarationSource = (request: SignatureRequest): SourceNodeRef => inputs.sources.declarationSourceOf(request.definition)
    ?? fail("A declared-signature demand needs its actual ready checked declaration source.");
  const inferenceSource = (request: InferenceRequest, paused: InferencePause, ready: readonly InferenceAnswer[]): SourceNodeRef => {
    if (paused.kind === "prerequisites") return fail("A Forms prerequisite does not use the protected inference witness.");
    if (paused.state.requests[ready.length] !== request)
      return fail("A semantic witness must describe its actual unresolved request and borrowed ordered ready prefix.");
    if (request.kind === "produceType") return request.request.component.root;
    if (paused.kind === "solve" && paused.state.kind === "member") {
      const source: SourceNodeRef = { kind: "body", value: paused.state.occurrence };
      if (inputs.sources.nodeOf(source) === null) return fail("A member demand requires its actual checked occurrence.");
      return source;
    }
    const reference = paused.kind === "constraints" ? paused.state.requestBodies[ready.length] : paused.group.bodies[ready.length];
    const body = reference === undefined ? undefined : inputs.sources.bodies.get(reference);
    if (body === undefined || body !== inputs.inference.hirBody(body.body))
      return fail("An inference demand needs its actual requesting checked execution, not an arbitrary group member.");
    return { kind: "body", value: { body: body.body, node: body.root.id } };
  };

  function finishSolve(group: InferenceGroup, constraints: GroupConstraints, unit: UnitRequest, inference: InferDeps<MemberRuleContinuation>,
    step: InferStep<GroupSolution, SolveRequest, InferPaused<MemberRuleContinuation>>,
    placements: CompletedPlacement | null = null): SolutionStep {
    if (step.kind === "paused") return { ...step, paused: { kind: "solve", unit, group, constraints, state: step.paused, inference } };
    if (step.value.kind === "refused") return { kind: "done", value: step.value };
    if (placements === null) return fail("A completed inference group requires its actual Decls placement answers.");
    const publication = completeInference(group, constraints, step.value.value,
      inputs.verification(group, constraints, step.value.value), placements, inputs.inference.hirBody);
    return { kind: "done", value: { kind: "ok", value: { ...publication, checkedCuts: inference.cuts }, positions: publication.positions,
      diagnostics: step.value.diagnostics, emissions: [] } };
  }

  function finishConstraints(group: InferenceGroup, unit: UnitRequest, inference: InferDeps<MemberRuleContinuation>,
    step: InferStep<GroupConstraints, ConstraintsRequest, ConstraintsPaused>): SolutionStep {
    if (step.kind === "paused") return { ...step, paused: { kind: "constraints", unit, group, state: step.paused, inference } };
    if (step.value.kind === "refused") return { kind: "done", value: step.value };
    const constraints = step.value.value;
    return earned(finishSolve(group, constraints, unit, inference,
      pipelineWiring.infer.solveGroup(inference, group, constraints, unit)), step.value.diagnostics);
  }

  function prepareGroup(group: InferenceGroup, next: Iterator<FormPrerequisite>, completed: Map<FormDiagnosticSite, CheckedTypingCut>): SolutionStep {
    for (let requested = next.next(); !requested.done; requested = next.next()) {
      const pending = requested.value;
      if (inputs.projectForms.has(pending.site) || completed.has(pending.site)) continue;
      if (inputs.sources.nodeOf(pending.source) === null) return fail("Group Forms require the actual checked source role.");
      return { kind: "paused", requests: [pending], paused: { kind: "prerequisites", group, next, pending, completed }, earned: [] };
    }
    const inference = completed.size === 0 ? inputs.inference
      : { ...inputs.inference, cuts: inputs.sources.bindForms(site => inputs.projectForms.get(site) ?? completed.get(site)) };
    return finishConstraints(group, unitOf(group), inference, pipelineWiring.infer.constraintsOf(inference, group));
  }

  function resumeInference(paused: InferencePause, answers: readonly InferenceAnswer[]): SolutionStep {
    if (paused.kind === "prerequisites") {
      const answer = answers[0];
      if (answers.length !== 1 || answer === undefined || "part" in answer || answer.kind !== "forms-prerequisite"
        || answer.site !== paused.pending.site) return fail("Group Forms may complete only its exact next detector.");
      paused.completed.set(answer.site, answer.cut);
      return prepareGroup(paused.group, paused.next, paused.completed);
    }
    const current = paused.inference;
    if (paused.kind === "constraints") {
      const actual = answers.map(answer => !("part" in answer) &&
        (answer.kind === "placeSignature" || answer.kind === "membersOf" || answer.kind === "memberTypeOf" || answer.kind === "forms-prerequisite")
        ? fail("Constraint generation cannot consume a solving answer.") : answer);
      return finishConstraints(paused.group, paused.unit, current,
        pipelineWiring.infer.resumeConstraintsOf(current, paused.state, actual));
    }
    if (paused.state.kind === "placement") {
      const placements = answers.map(answer => "part" in answer || (answer.kind !== "placeSignature" && answer.kind !== "declaredSignatureOf")
        ? fail("A body signature placement requires an actual signature answer.") : answer);
      return finishSolve(paused.group, paused.constraints, paused.unit, current,
        pipelineWiring.infer.resumeSolveGroup(current, paused.state, placements), { requests: paused.state.requests, answers: placements });
    }
    const actual = answers.map(answer => "part" in answer || (answer.kind !== "membersOf" && answer.kind !== "memberTypeOf")
      ? fail("A member continuation requires its actual member answer.") : answer);
    return finishSolve(paused.group, paused.constraints, paused.unit, current,
      pipelineWiring.infer.resumeSolveGroup(current, paused.state, actual));
  }

  const formCutRoute = (site: FormDiagnosticSite, source: SourceNodeRef): Route<SourceSemanticInputs, never, SourceSemanticWitness, DeclaredSignatureErrorData> => {
    if (inputs.sources.nodeOf(source) === null) return fail("A Forms prerequisite needs its actual checked requesting role.");
    return abandonAtReport(inputs.forms, site, { kind: "forms-prerequisite", source, site },
      (cut, errorOf) => completedFormCut(site, cut, errorOf).report);
  };
  const formDeclarationRoute = (site: FormDiagnosticSite, definition: DefId): Route<SourceSemanticInputs, never, SourceSemanticWitness, DeclaredSignatureErrorData> => {
    const source = inputs.sources.declarationSourceOf(definition);
    return source === null ? fail("A protected declaration needs its actual checked occurrence.") : formCutRoute(site, source);
  };
  const partRoute = (request: InferredPartRequest): Route<SourceSemanticInputs, InferredPartType, SourceSemanticWitness, DeclaredSignatureErrorData> => {
    const { definition, part } = request.part;
    const site = inputs.sources.formOfDeclaration(definition)
      ?? (part.kind === "parameter-initializer" ? inputs.sources.formOfInitializer(definition, part.index) : null);
    if (site !== null) return formDeclarationRoute(site, definition);
    const group = ownerOf(request);
    return projectionRoute(solutionOf, group.id,
      (publication, errorOf) => projectInferredPart(unitOf(group), publication, request, errorOf));
  };

  const declaredSignatureOf: SourceSemanticQueries["declaredSignatureOf"] = defineQuery<SourceSemanticInputs, SignatureRequest, Signature,
    InferredPartRequest, InferredPartType, DeclaredSignaturePause, SourceSemanticWitness, DeclaredSignatureErrorData>({
    name: "declaredSignatureOf", keyData: signatureRequestData,
    producer: {
      start: (actual, request) => {
        sameInputs(actual);
        return pipelineWiring.decls.declaredSignatureOf(inputs.declarations, request, inputs.sources.cuts);
      },
      resume: (state, answers) => pipelineWiring.decls.resumeDeclaredSignatureOf(inputs.declarations, state, answers),
    },
    route: partRoute,
    witness: (request, state, ready) => ({ kind: "declared-signature", state, ready, source: declarationSource(state.request),
      target: { kind: "inference-solution", group: ownerOf(request) } }),
    answerPolicy: { kind: "typed-error", construct: (request, cause, data) => pipelineWiring.decls.errorSignature(inputs.declarations, request, cause, data) },
  });

  const membersOf: SourceSemanticQueries["membersOf"] = defineQuery<SourceSemanticInputs, TyId, MemberInventory,
    never, never, never, SourceSemanticWitness, DeclaredSignatureErrorData>({
    name: "membersOf", keyData: receiver => receiver,
    producer: { start: (actual, receiver) => { sameInputs(actual); return pipelineWiring.decls.membersOf(inputs.declarations, receiver); },
      resume: () => fail("A ready inventory is not a paused declaration answer.") },
    route: () => fail("A member inventory does not depend on typed answers."),
    witness: () => fail("A member inventory has no unresolved dependency witness."),
    answerPolicy: { kind: "refusal-only" },
  });

  const memberTypeOf: SourceSemanticQueries["memberTypeOf"] = defineQuery<SourceSemanticInputs, MemberTypeRequest, MemberTypes,
    never, never, never, SourceSemanticWitness, DeclaredSignatureErrorData>({
    name: "memberTypeOf", keyData: request => [request.receiver, request.member],
    producer: { start: (actual, request) => {
      sameInputs(actual);
      const step = pipelineWiring.decls.memberTypeOf(inputs.declarations, request);
      return step.kind === "done" ? step : fail("The ready declared member type does not request an inferred part.");
    }, resume: () => fail("A ready declared member type is not a paused answer.") },
    route: () => fail("A ready declared member type has no dependency."),
    witness: () => fail("A ready declared member type has no unresolved dependency witness."),
    answerPolicy: { kind: "refusal-only" },
  });

  const inventoryRoute = (receiver: TyId) => factRoute(membersOf, receiver, (value, errorOf): Extract<MemberRuleAnswer, { readonly kind: "membersOf" }> => {
    const read = errorOf({ request: { query: membersOf.name, key: membersOf.keyData(receiver) }, position: { kind: "result" } });
    if (read.kind !== "completed" || read.error !== null || value.receiver !== receiver)
      return fail("A member inventory requires its actual ready receiver answer.");
    return { kind: "membersOf", value };
  });
  const memberRoute = (request: MemberTypeRequest) => factRoute(memberTypeOf, request, (value, errorOf): Extract<MemberRuleAnswer, { readonly kind: "memberTypeOf" }> => {
    const origin: UnitRef = { request: { query: memberTypeOf.name, key: memberTypeOf.keyData(request) }, position: { kind: "result" } };
    const read = errorOf(origin);
    if (read.kind !== "completed") return fail("A member type requires its actual completed result position.");
    return { kind: "memberTypeOf", request, value, origin, error: read.error };
  });
  function typeRoute(request: TypeProductionRequest): Route<SourceSemanticInputs, TypeProductionAnswer, SourceSemanticWitness, DeclaredSignatureErrorData> {
    const root = request.component.root;
    const node = inputs.sources.nodeOf(root);
    const site = node === null ? null : inputs.sources.formOfSyntax(node);
    if (site !== null) return formCutRoute(site, root);
    return factRoute(produceType, request, (value, errorOf) => {
      const expected = request.component.root;
      const actual = value.component;
      if (actual.value.node !== expected.value.node
        || (actual.kind === "item" ? expected.kind !== "item" || actual.value.owner !== expected.value.owner
          : expected.kind !== "body" || actual.value.body !== expected.value.body))
        return fail("A produced type must retain its actual qualified component.");
      const origin: UnitRef = { request: { query: produceType.name, key: produceType.keyData(request) }, position: { kind: "result" } };
      const read = errorOf(origin);
      if (read.kind !== "completed") return fail("A produced type requires its actual completed result position.");
      return { kind: "produceType", value, origin, error: read.error };
    });
  }
  const produceType: SourceSemanticQueries["produceType"] = defineQuery<
    SourceSemanticInputs, TypeProductionRequest, TypeEvidence, MemberRuleNeed | TypeProductionNeed, MemberRuleAnswer | TypeProductionAnswer,
    TypeProductionPause, SourceSemanticWitness, DeclaredSignatureErrorData>({
    name: "produceType", keyData: typeProductionRequestData,
    producer: {
      start: (actual, request) => {
        sameInputs(actual);
        const root = request.component.root;
        const operator = inputs.sources.nodeOf(root);
        const owner = root.kind === "item" ? root.value.owner : inputs.sources.bodies.get(root.value.body)?.owner;
        if (operator === null || owner === undefined || request.component.path.length !== 0)
          return fail("Type production needs its actual checked defining operand component.");
        const unit = { query: "produceType", key: typeProductionRequestData(request) };
        const scope = inputs.bindingScopeOf(owner);
        const bindings = verifyBindings([{ vector: request.bindings, scope }], viewTypes(inputs.declarations.types).terms.length,
          (work, scratchEntries) => chargeWork(productionAccount, work + scratchEntries));
        if (bindings.kind === "resource-stop") return productionStopped(bindings.stop, unit, operator.origin);
        if (bindings.violations.length !== 0) return fail("Type production needs its actual complete checked binding scope.");
        const stop = chargeResultEntries(productionAccount, 1);
        if (stop !== null) return productionStopped(stop, unit, operator.origin);
        return pipelineWiring.decls.produceType(inputs.declarations, request, operator, unit, pipelineWiring.rules.matchTypePattern);
      },
      resume: (state, answers) => pipelineWiring.decls.resumeProduceType(inputs.declarations, state, answers),
    },
    route: request => request.kind === "membersOf" ? inventoryRoute(request.receiver)
      : request.kind === "memberTypeOf" ? memberRoute(request.request) : typeRoute(request.request),
    witness: (target, state, ready) => ({ kind: "type-production", state, ready, source: state.root, target }),
    answerPolicy: { kind: "refusal-only" },
  });

  const solutionOf: SourceSemanticQueries["solutionOf"] = defineQuery<SourceSemanticInputs, GroupId, ScopedInferencePublication,
    InferenceRequest, InferenceAnswer, InferencePause, SourceSemanticWitness, DeclaredSignatureErrorData>({
    name: "solutionOf", keyData: key => key,
    producer: {
      start: (actual, key) => {
        sameInputs(actual);
        const group = groupOf(key);
        return prepareGroup(group, inputs.groupForms(group)[Symbol.iterator](), new Map());
      },
      resume: resumeInference,
    },
    route: request => {
      if (request.kind === "forms-prerequisite") return factRoute(inputs.forms, request.site, (cut, errorOf): FormPrerequisiteAnswer =>
        ({ kind: "forms-prerequisite", site: request.site, cut: completedFormCut(request.site, cut, errorOf) }));
      if (request.kind === "form-cut") {
        const site = inputs.sources.formOfDeclaration(request.definition);
        if (site === null) return fail("A denied demand must retain its exact qualified Forms site.");
        return formCutRoute(site, { kind: "body", value: request.at });
      }
      if (request.kind === "declaredSignatureOf") {
        const site = inputs.sources.formOfDeclaration(request.request.definition);
        if (site !== null) return formDeclarationRoute(site, request.request.definition);
        return factRoute(declaredSignatureOf, request.request, value => ({ kind: "declaredSignatureOf", value }));
      }
      if (request.kind === "inferred-part") return partRoute(request);
      if (request.kind === "produceType") return typeRoute(request.request);
      if (request.kind === "membersOf") return inventoryRoute(request.receiver);
      if (request.kind === "memberTypeOf") return memberRoute(request.request);
      const placement = request.placement;
      const site = placement.kind === "endpoint" ? inputs.sources.formOfDeclaration(placement.request.definition)
        : inputs.sources.formOfBody(placement.instance.body);
      if (site !== null) {
        if (placement.kind === "endpoint") return formDeclarationRoute(site, placement.request.definition);
        const body = inputs.sources.bodies.get(placement.instance.body);
        if (body === undefined) return fail("A protected placement needs its actual checked body.");
        return formCutRoute(site, { kind: "body", value: { body: body.body, node: body.root.id } });
      }
      const owningGroup = placement.kind === "endpoint" ? undefined : bodies.get(placement.instance.body);
      if (owningGroup === undefined) return fail("An unmemoised signature placement needs its actual producing inference group.");
      const unit = unitOf(owningGroup);
      return nestedRoute<SourceSemanticInputs, PlacedSignature, InferredPartRequest, InferredPartType, never, InferenceAnswer,
        SourceSemanticWitness, DeclaredSignatureErrorData>({
        start: actual => { sameInputs(actual); return pipelineWiring.decls.placeSignature(inputs.declarations, placement, unit, inputs.sources.cuts); },
        resume: () => fail("A ready local signature placement must not request a completed signature dependency."),
        route: () => fail("A ready local signature placement has no pending fact route."),
        witness: () => fail("A ready local signature placement has no unresolved dependency witness."),
        answer: value => ({ kind: "placeSignature", value }),
      });
    },
    witness: (request, state, ready) => {
      if (request.kind === "forms-prerequisite") return { kind: "forms-prerequisite", source: request.source, site: request.site };
      const source = inferenceSource(request, state, ready);
      if (request.kind === "declaredSignatureOf") return { kind: "inference", state, ready, source,
        target: { kind: "declared-signature", request: request.request } };
      if (request.kind === "inferred-part") return { kind: "inference", state, ready, source,
        target: { kind: "inference-solution", group: ownerOf(request) } };
      if (request.kind === "membersOf" || request.kind === "memberTypeOf" || request.kind === "produceType")
        return { kind: "inference", state, ready, source, target: request };
      return fail("Only an actual unresolved registered fact demand can carry a semantic cycle witness.");
    },
    answerPolicy: { kind: "refusal-only" },
  });
  return { queries: { declaredSignatureOf, membersOf, memberTypeOf, produceType, solutionOf }, productionRefusalOf: () => productionRefusal };
}
