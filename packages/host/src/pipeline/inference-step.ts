import type { UnitErrorRead, UnitRef, UnitRequest } from "../diag/contract.js";
import { throwInvariant } from "../diag/index.js";
import type { GroupConstraints, GroupSolution } from "../infer/contract.js";
import type { InferenceGroup, InferenceVariable, InferredPartRequest, InferredPartType, InferVerificationInput } from "../ir-infer/contract.js";
import { inferredPartKey, verifyInference } from "../ir-infer/index.js";

export interface InferencePublication extends GroupSolution {
  readonly group: InferenceGroup;
  readonly constraints: GroupConstraints;
  readonly signatureVariables: ReadonlyMap<string, Extract<InferenceVariable, { readonly kind: "signature" }>>;
}

export type InferenceViews = Pick<InferVerificationInput,
  "types" | "bindingScopes" | "declarationOf" | "nominalOf" | "nodeExists" | "localExists">;

function fail(message: string): never {
  return throwInvariant({ owner: "pipeline", query: null, origin: null, message });
}

export function completeInference(group: InferenceGroup, constraints: GroupConstraints, result: GroupSolution,
  views: InferenceViews): InferencePublication {
  const violations = verifyInference({ ...views, group, constraints: constraints.constraints, ...result });
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
  return { group, constraints, ...result, signatureVariables };
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
