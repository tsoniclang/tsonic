import type { UnitErrorRead, UnitRef, UnitRequest } from "../diag/contract.js";
import { throwInvariant } from "../diag/index.js";
import type { BodyId, NodeId, SourceNodeRef } from "../ids/contract.js";
import type { HirBody } from "../ir-hir/contract.js";
import type { GroupConstraints, GroupSolution, PlacementAnswer, PlacementPaused } from "../infer/contract.js";
import type { InferenceGroup, InferenceVariable, InferredPartRequest, InferredPartType, InferVerificationInput, PlacedSignature } from "../ir-infer/contract.js";
import { inferredPartKey, verifyInference } from "../ir-infer/index.js";
import type { MemberInventory } from "../ir-types/contract.js";

export interface InferencePublication extends Omit<GroupSolution, "memberInventories"> {
  readonly group: InferenceGroup;
  readonly constraints: GroupConstraints;
  readonly signatureVariables: ReadonlyMap<string, Extract<InferenceVariable, { readonly kind: "signature" }>>;
  readonly memberInventories: ReadonlyMap<BodyId, ReadonlyMap<NodeId, MemberInventory>>;
  readonly placed: ReadonlyMap<BodyId, PlacedSignature>;
}

export type InferenceViews = Pick<InferVerificationInput,
  "types" | "bindingScopes" | "declarationOf" | "nominalOf" | "nodeExists" | "localExists">;

export interface CompletedPlacement {
  readonly requests: PlacementPaused["requests"];
  readonly answers: readonly PlacementAnswer[];
}

function fail(message: string): never {
  return throwInvariant({ owner: "pipeline", query: null, origin: null, message });
}

function sameSignatureOwner(expected: SourceNodeRef | null, actual: SourceNodeRef | null): boolean {
  if (expected === null || actual === null) return expected === actual;
  return expected.value.node === actual.value.node && (expected.kind === "body"
    ? actual.kind === "body" && expected.value.body === actual.value.body
    : actual.kind === "item" && expected.value.owner === actual.value.owner);
}

function verifyPlacement(request: PlacementPaused["requests"][number], answer: PlacementAnswer, body: HirBody,
  views: InferenceViews): PlacedSignature {
  const ready = request.kind === "declaredSignatureOf" && answer.kind === "declaredSignatureOf"
    ? { request: request.request, signature: answer.value }
    : request.kind === "placeSignature" && answer.kind === "placeSignature" ? answer.value : null;
  if (ready === null || views.types.signatures[ready.signature.id] !== ready.signature)
    return fail("An inference placement answer must be the actual placed signature of its unique body.");
  if (request.kind === "placeSignature") {
    const placement = request.placement;
    if (placement.kind === "endpoint") {
      if (ready.request !== placement.request) return fail("An endpoint placement must retain its exact requested endpoint.");
    } else {
      if (placement.instance.body !== body.body) return fail("A placement must retain its actual checked body.");
      if (placement.kind === "execution-body") {
        const owner = ready.signature.owner;
        if (ready.request !== null || ready.signature.declaration !== null || owner?.kind !== "body"
          || owner.value.body !== body.body || owner.value.node !== body.root.id)
          return fail("An execution-only placement must retain its own signature without an endpoint request.");
        return ready;
      }
      if (ready.request?.bindings !== placement.instance.bindings)
        return fail("A callable placement must retain its actual complete bindings.");
    }
  }
  const endpoint = ready.request;
  if (endpoint === null || endpoint.definition !== body.owner || ready.signature.declaration !== body.owner)
    return fail("An endpoint placement must retain the signature and request of its actual checked declaration.");
  const declaration = views.declarationOf(endpoint.definition);
  if (declaration !== null) {
    let ordinal = 0;
    for (const candidate of declaration.endpoints) {
      if (candidate.role !== endpoint.endpoint || ordinal++ !== endpoint.ordinal) continue;
      const checked = views.types.signatures[candidate.signature];
      if (candidate.declaration === endpoint.definition && candidate.body === body.body && checked !== undefined
        && checked.declaration === endpoint.definition && checked.kind === ready.signature.kind) {
        if (!sameSignatureOwner(checked.owner, ready.signature.owner))
          return fail("A placed signature must retain its actual checked signature owner occurrence.");
        return ready;
      }
      break;
    }
  }
  return fail("A placement request must name its actual checked endpoint role, ordinal and body.");
}

export function completeInference(group: InferenceGroup, constraints: GroupConstraints, result: GroupSolution,
  views: InferenceViews, placements: CompletedPlacement, bodyOf: (body: BodyId) => HirBody): InferencePublication {
  if (placements.answers.length !== group.bodies.length || placements.requests.length !== group.bodies.length)
    return fail("Inference verification needs the actual placement request and answer of every group body.");
  const placed = new Map<BodyId, PlacedSignature>();
  for (const [position, body] of group.bodies.entries()) {
    const request = placements.requests[position];
    const answer = placements.answers[position];
    if (request === undefined || answer === undefined || placed.has(body))
      return fail("An inference placement requires its actual matched request and answer once.");
    const checked = bodyOf(body);
    if (checked.body !== body) return fail("An inference placement must retain its checked body identity.");
    placed.set(body, verifyPlacement(request, answer, checked, views));
  }
  const violations = verifyInference({ ...views, group, constraints: constraints.constraints, ...result,
    placedSignatureOf: body => placed.get(body)?.signature.id ?? null });
  if (violations.length !== 0) return fail(`The completed inference group violates ${violations[0]?.rule}.`);
  const signatureVariables = new Map<string, Extract<InferenceVariable, { readonly kind: "signature" }>>();
  let count = 0;
  for (const system of constraints.constraints) for (const variable of system.variables) {
    const final = result.solution.variables[count];
    if (!Object.is(variable.id, count) || !Object.is(final?.variable, count))
      return fail("An inference publication must retain the actual dense finalized variable inventory.");
    if (variable.kind === "signature") signatureVariables.set(inferredPartKey(variable.signature), variable);
    count += 1;
  }
  const declared = new Set<number>();
  let results = 0;
  for (const { position, error } of result.positions) {
    if (position.kind === "result") results += 1;
    else if (position.kind === "inference-variable") {
      const variable = position.variable;
      if (position.group !== group.id || !Number.isSafeInteger(variable) || variable < 0 || Object.is(variable, -0)
        || variable >= count || declared.has(variable)) return fail("A finalized-variable answer position must retain its exact group and dense variable identity once.");
      if (result.solution.variables[variable]?.error !== error)
        return fail("A finalized-variable position must retain the actual semantic finalization error object.");
      declared.add(variable);
    }
  }
  if (declared.size !== count || results !== 1)
    return fail("An inference publication needs every actual finalized-variable position and one result.");
  const { memberInventories: ready, ...typing } = result;
  const memberInventories = new Map<BodyId, Map<NodeId, MemberInventory>>();
  for (const { occurrence, inventory } of ready) {
    let body = memberInventories.get(occurrence.body);
    if (body === undefined) { body = new Map(); memberInventories.set(occurrence.body, body); }
    if (body.has(occurrence.node)) return fail("A member occurrence has two selected inventories.");
    body.set(occurrence.node, inventory);
  }
  return { group, constraints, ...typing, placed, signatureVariables, memberInventories };
}

export function projectInferredPart(unit: UnitRequest, publication: InferencePublication, request: InferredPartRequest,
  errorOf: (unit: UnitRef) => UnitErrorRead): InferredPartType {
  if (unit.key !== publication.group.id)
    return fail("An inferred-part projection must name its actual completed solution group key.");
  const variable = publication.signatureVariables.get(inferredPartKey(request.part));
  if (variable === undefined || !Number.isSafeInteger(variable.id) || variable.id < 0 || Object.is(variable.id, -0))
    return fail("An inferred-part projection needs its actual owned signature variable.");
  const final = publication.solution.variables[variable.id];
  if (final === undefined || final.variable !== variable.id)
    return fail("An inferred-part projection needs its actual dense finalized variable.");
  const origin: UnitRef = { request: unit, position: { kind: "inference-variable", group: publication.group.id, variable: variable.id } };
  const read = errorOf(origin);
  if (read.kind !== "completed") return fail("An inferred-part projection requires its verified completed variable position, not unknown or missing evidence.");
  if (read.error !== final.error) return fail("An inferred-part projection must retain the original finalized error object.");
  return { part: request.part, type: final.value.type, error: read.error, origin };
}
