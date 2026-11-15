import type { DeclaredSignaturePause, DeclsInputs } from "../decls/contract.js";
import type { Diagnostic, UnitRequest } from "../diag/contract.js";
import { throwInvariant } from "../diag/index.js";
import type { GroupId, SourceNodeRef } from "../ids/contract.js";
import type { ConstraintsAnswer, ConstraintsPaused, ConstraintsRequest, GroupConstraints, GroupSolution, InferDeps,
  InferPaused, InferStep, SolveAnswer, SolveRequest } from "../infer/contract.js";
import type { InferenceGroup, InferredPartRequest, InferredPartType } from "../ir-infer/contract.js";
import { inferredPartKey } from "../ir-infer/index.js";
import type { Signature, SignatureRequest } from "../ir-types/contract.js";
import { signatureRequestData } from "../ir-types/index.js";
import type { Query } from "../query/contract.js";
import type { SemanticCycleErrorData } from "./contract.js";
import type { CheckedSourceViews } from "./checked-inputs.js";
import type { Pause, Route } from "./driver.js";
import { defineQuery, factRoute, nestedRoute, projectionRoute } from "./driver.js";
import type { InferencePublication, InferenceViews } from "./inference-step.js";
import { completeInference, projectInferredPart } from "./inference-step.js";
import { pipelineWiring } from "./wiring.js";

export interface SourceSemanticInputs {
  readonly declarations: DeclsInputs;
  readonly inference: InferDeps;
  readonly groups: readonly InferenceGroup[];
  readonly sources: CheckedSourceViews;
  readonly verification: (group: InferenceGroup, constraints: GroupConstraints) => InferenceViews;
}

type InferenceRequest = ConstraintsRequest | SolveRequest;
type InferenceAnswer = ConstraintsAnswer | SolveAnswer;
type InferencePause =
  | { readonly kind: "constraints"; readonly unit: UnitRequest; readonly group: InferenceGroup; readonly state: ConstraintsPaused }
  | { readonly kind: "solve"; readonly unit: UnitRequest; readonly group: InferenceGroup;
      readonly constraints: GroupConstraints; readonly state: InferPaused };

type SemanticTarget =
  | { readonly kind: "declared-signature"; readonly request: SignatureRequest }
  | { readonly kind: "inference-solution"; readonly group: InferenceGroup };

export type SourceSemanticWitness = { readonly target: SemanticTarget; readonly source: SourceNodeRef } & (
  | { readonly kind: "declared-signature"; readonly state: DeclaredSignaturePause; readonly ready: readonly InferredPartType[] }
  | { readonly kind: "inference"; readonly state: InferencePause; readonly ready: readonly InferenceAnswer[] }
);

export interface SourceSemanticQueries {
  readonly declaredSignatureOf: Query<SourceSemanticInputs, SignatureRequest, Signature, SourceSemanticWitness, SemanticCycleErrorData>;
  readonly solutionOf: Query<SourceSemanticInputs, GroupId, InferencePublication, SourceSemanticWitness, SemanticCycleErrorData>;
}

type SolutionStep = Pause<InferencePublication, InferenceRequest, InferencePause>;

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

export function createSourceSemanticQueries(inputs: SourceSemanticInputs): SourceSemanticQueries {
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
    if (actual !== inputs) fail("Semantic query registrations belong to their actual immutable run inputs.");
  };
  const unitOf = (group: InferenceGroup): UnitRequest => ({ query: solutionOf.name, key: group.id });
  const declarationSource = (request: SignatureRequest): SourceNodeRef => inputs.sources.declarationSourceOf(request.definition)
    ?? fail("A declared-signature demand needs its actual ready checked declaration source.");
  const inferenceSource = (request: InferenceRequest, paused: InferencePause, ready: readonly InferenceAnswer[]): SourceNodeRef => {
    if (paused.state.requests[ready.length] !== request)
      return fail("A semantic witness must describe its actual unresolved request and borrowed ordered ready prefix.");
    const reference = paused.kind === "constraints" ? paused.state.requestBodies[ready.length] : paused.group.bodies[ready.length];
    const body = reference === undefined ? undefined : inputs.sources.bodies.get(reference);
    if (body === undefined || body !== inputs.inference.hirBody(body.body))
      return fail("An inference demand needs its actual requesting checked execution, not an arbitrary group member.");
    return { kind: "body", value: { body: body.body, node: body.root.id } };
  };

  function finishSolve(group: InferenceGroup, constraints: GroupConstraints, unit: UnitRequest,
    step: InferStep<GroupSolution, SolveRequest, InferPaused>): SolutionStep {
    if (step.kind === "paused") return { ...step, paused: { kind: "solve", unit, group, constraints, state: step.paused } };
    if (step.value.kind === "refused") return { kind: "done", value: step.value };
    const publication = completeInference(group, constraints, step.value.value, inputs.verification(group, constraints));
    return { kind: "done", value: { kind: "ok", value: publication, positions: publication.positions,
      diagnostics: step.value.diagnostics, emissions: [] } };
  }

  function finishConstraints(group: InferenceGroup, unit: UnitRequest,
    step: InferStep<GroupConstraints, ConstraintsRequest, ConstraintsPaused>): SolutionStep {
    if (step.kind === "paused") return { ...step, paused: { kind: "constraints", unit, group, state: step.paused } };
    if (step.value.kind === "refused") return { kind: "done", value: step.value };
    const constraints = step.value.value;
    return earned(finishSolve(group, constraints, unit,
      pipelineWiring.infer.solveGroup(inputs.inference, group, constraints, unit)), step.value.diagnostics);
  }

  function resumeInference(paused: InferencePause, answers: readonly InferenceAnswer[]): SolutionStep {
    if (paused.kind === "constraints") {
      const actual = answers.map(answer => !("part" in answer) && answer.kind === "placeSignature"
        ? fail("Constraint generation cannot consume a signature-placement answer.") : answer);
      return finishConstraints(paused.group, paused.unit,
        pipelineWiring.infer.resumeConstraintsOf(inputs.inference, paused.state, actual));
    }
    const actual = answers.map(answer => "part" in answer || answer.kind === "produceType"
      ? fail("Signature placement cannot consume a constraint-generation answer.") : answer);
    return finishSolve(paused.group, paused.constraints, paused.unit,
      pipelineWiring.infer.resumeSolveGroup(inputs.inference, paused.state, actual));
  }

  const partRoute = (request: InferredPartRequest): Route<SourceSemanticInputs, InferredPartType, SourceSemanticWitness, SemanticCycleErrorData> => {
    const group = ownerOf(request);
    return projectionRoute(solutionOf, group.id,
      (publication, errorOf) => projectInferredPart(unitOf(group), publication, request, errorOf));
  };

  const declaredSignatureOf: SourceSemanticQueries["declaredSignatureOf"] = defineQuery<SourceSemanticInputs, SignatureRequest, Signature,
    InferredPartRequest, InferredPartType, DeclaredSignaturePause, SourceSemanticWitness, SemanticCycleErrorData>({
    name: "declaredSignatureOf", keyData: signatureRequestData,
    producer: {
      start: (actual, request) => { sameInputs(actual); return pipelineWiring.decls.declaredSignatureOf(inputs.declarations, request); },
      resume: (state, answers) => pipelineWiring.decls.resumeDeclaredSignatureOf(inputs.declarations, state, answers),
    },
    route: partRoute,
    witness: (request, state, ready) => ({ kind: "declared-signature", state, ready, source: declarationSource(state.request),
      target: { kind: "inference-solution", group: ownerOf(request) } }),
    answerPolicy: { kind: "typed-error", construct: (request, cause, data) => pipelineWiring.decls.errorSignature(inputs.declarations, request, cause, data) },
  });

  const solutionOf: SourceSemanticQueries["solutionOf"] = defineQuery<SourceSemanticInputs, GroupId, InferencePublication,
    InferenceRequest, InferenceAnswer, InferencePause, SourceSemanticWitness, SemanticCycleErrorData>({
    name: "solutionOf", keyData: key => key,
    producer: {
      start: (actual, key) => {
        sameInputs(actual);
        const group = groupOf(key);
        return finishConstraints(group, unitOf(group), pipelineWiring.infer.constraintsOf(inputs.inference, group));
      },
      resume: resumeInference,
    },
    route: request => {
      if (request.kind === "declaredSignatureOf") return factRoute(declaredSignatureOf, request.request,
        value => ({ kind: "declaredSignatureOf", value }));
      if (request.kind === "inferred-part") {
        const group = ownerOf(request);
        return projectionRoute(solutionOf, group.id,
          (publication, errorOf) => projectInferredPart(unitOf(group), publication, request, errorOf));
      }
      if (request.kind === "produceType") return fail("The real type-production component is not yet registered.");
      const placement = request.placement;
      const owningGroup = placement.kind === "endpoint" ? undefined : bodies.get(placement.instance.body);
      if (owningGroup === undefined) return fail("An unmemoised signature placement needs its actual producing inference group.");
      const unit = unitOf(owningGroup);
      return nestedRoute<SourceSemanticInputs, Signature, InferredPartRequest, InferredPartType, never, InferenceAnswer,
        SourceSemanticWitness, SemanticCycleErrorData>({
        start: actual => { sameInputs(actual); return pipelineWiring.decls.placeSignature(inputs.declarations, placement, unit); },
        resume: () => fail("A ready local signature placement must not request a completed signature dependency."),
        route: () => fail("A ready local signature placement has no pending fact route."),
        witness: () => fail("A ready local signature placement has no unresolved dependency witness."),
        answer: value => ({ kind: "placeSignature", value }),
      });
    },
    witness: (request, state, ready) => {
      const source = inferenceSource(request, state, ready);
      if (request.kind === "declaredSignatureOf") return { kind: "inference", state, ready, source,
        target: { kind: "declared-signature", request: request.request } };
      if (request.kind === "inferred-part") return { kind: "inference", state, ready, source,
        target: { kind: "inference-solution", group: ownerOf(request) } };
      return fail("Only an actual unresolved registered fact demand can carry a semantic cycle witness.");
    },
    answerPolicy: { kind: "refusal-only" },
  });
  return { declaredSignatureOf, solutionOf };
}
