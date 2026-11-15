import type { ApplicationDecision, CandidateInput, CallConstraint, ConstraintScheme, InferenceCandidateList, InferenceValue } from "../ir-infer/contract.js";
import { readSignature, readType } from "../ir-types/index.js";
import type { Origin } from "../ids/contract.js";
import type { RulesDeps } from "./contract.js";
import { callerDefect, notDecidedYet } from "./frontier.js";
import { mergeErrors } from "./errors.js";

export function decideCandidate(deps: RulesDeps, input: CandidateInput): ApplicationDecision {
  return selectCandidate(deps, input, input.context.origin);
}

function selectCandidate(deps: RulesDeps, input: Omit<CandidateInput, "context">, origin: Origin | null): ApplicationDecision {
  const candidate = input.candidates[0];
  if (candidate === undefined || input.candidates.length !== 1)
    return notDecidedYet("native ordered applicability over multiple or missing candidates", origin);
  if (input.kind !== "call" || input.receiver !== null || input.typeArguments.length !== 0)
    return notDecidedYet("the selected argument, receiver and generic application contributions", origin);
  if (candidate.conditionalFailure !== null)
    return notDecidedYet("the original conditional candidate failure", origin);
  const signature = readSignature(deps.types, candidate.api.signature);
  if (signature.declaration !== candidate.declaration || candidate.advertised.declaration !== candidate.declaration
    || candidate.api.declaration !== candidate.declaration || candidate.advertised.signature !== signature.id)
    return callerDefect("a candidate must retain its actual authoritative declaration and endpoints", origin);
  if (signature.kind !== "call" || signature.receiver !== null || signature.typeParameters.length !== 0)
    return notDecidedYet("the native applicability of a receiver, formal or generic candidate", origin);
  if (signature.parameters.length !== input.arguments.length)
    return notDecidedYet("the actual selected omitted or rest formal transport", origin);
  const parameters: ApplicationDecision["parameters"] = input.arguments.map((argument, index) => {
    const parameter = signature.parameters[index];
    if (parameter === undefined) return callerDefect("a selected fixed formal is absent from its signature", origin);
    if (argument.kind !== "value" || argument.tuple !== null || parameter.kind === "rest" || parameter.passing !== "by-value")
      return notDecidedYet("the actual selected spread or non-value argument transport", origin);
    if (argument.value.type !== parameter.type)
      return notDecidedYet("the actual selected argument embedding contribution", origin);
    return { kind: "argument", parameter: index, argument: index, component: null, passing: parameter.passing };
  });
  const callee = readType(deps.types, input.callee.type);
  if (callee.kind !== "callable" || !callee.calls.includes(signature.id))
    return callerDefect("the callee must contain the actual selected authoritative signature", origin);
  return { candidate: candidate.ordinal, advertised: candidate.advertised, api: candidate.api,
    bindings: candidate.bindings, implementationBindings: candidate.bindings, parameters,
    completion: { signature: signature.id, completion: signature.result, yielded: null, sent: null },
    result: signature.result, activation: null };
}

function actualCandidate(lists: readonly InferenceCandidateList[], constraint: CallConstraint) {
  const list = lists.find(list => list.id === constraint.application.candidates);
  const candidate = list?.candidates[0];
  if (list === undefined || list.candidates.length !== 1 || candidate === undefined)
    return notDecidedYet("the complete ordered candidate contribution inventory", null);
  if (candidate.bindings.kind !== "available" || candidate.conditionalFailure.kind !== "available" || candidate.endpoints.kind !== "available")
    return notDecidedYet("the original candidate bindings and conditional failure", null);
  return { ordinal: candidate.ordinal, declaration: candidate.declaration, advertised: candidate.endpoints.value.advertised,
    api: candidate.endpoints.value.api, bindings: candidate.bindings.value, conditionalFailure: candidate.conditionalFailure.value };
}

export function callScheme(deps: RulesDeps): ConstraintScheme<CallConstraint> {
  return {
    enumerate: input => {
      const candidate = actualCandidate(input.candidates, input.constraint);
      const application = input.constraint.application;
      if (application.receiver !== null || application.typeArguments.length !== 0
        || application.arguments.some(argument => argument.kind !== "value" || argument.tuple !== null || argument.closure !== null))
        return notDecidedYet("the argument, receiver and generic contribution footprints", null);
      const result = readType(deps.types, application.result);
      if (result.kind === "open" && result.group !== input.group)
        return callerDefect("a call result belongs to another inference group", null);
      return { kind: "ok", diagnostics: [], value: [{ key: { node: input.constraint.occurrence, candidate: candidate.ordinal,
        role: { kind: "application-result" } }, reads: [], bounds: result.kind === "open" ? [result.variable] : [], constraint: input.reference }] };
    },
    evaluate: input => {
      const constraint = input.constraint;
      if (constraint.application.captured.provider.kind !== "available" || constraint.application.captured.provider.value !== null)
        return notDecidedYet("the actual selected native provider application law", null);
      const callee = input.evidence[0];
      const result = input.evidence[1];
      if (input.evidence.length !== 2 + constraint.application.arguments.length || callee === undefined || result === undefined
        || callee.value.type !== constraint.application.callee || result.value.type !== constraint.application.result)
        return callerDefect("a call contribution requires its actual callee and result evidence", null);
      const candidate = actualCandidate(input.candidates, constraint);
      const arguments_ = constraint.application.arguments.map((argument, index) => {
        const evidence = input.evidence[index + 2];
        if (evidence === undefined || evidence.value.type !== argument.type)
          return callerDefect("a call argument requires its actual selected occurrence evidence", null);
        return { occurrence: argument.occurrence, kind: argument.kind, value: evidence.value, tuple: null };
      });
      const error = mergeErrors([callee, ...input.evidence.slice(2)]);
      if (error !== null) return { kind: "ok", diagnostics: [], value: { bounds: [], decision: { kind: "error", error }, selectedCandidate: null } };
      const decision = selectCandidate(deps, { kind: "call", callee: callee.value, receiver: null,
        typeArguments: [], arguments: arguments_, candidates: [candidate] }, null);
      const destination = readType(deps.types, constraint.application.result);
      if (destination.kind !== "open" && constraint.application.result !== decision.result)
        return callerDefect("a closed application result must agree with the authoritative completion", null);
      const term = readType(deps.types, decision.result);
      const evidence: InferenceValue = { value: { type: decision.result, component: { kind: "body", value: constraint.occurrence },
        category: term.kind === "primitive" && term.primitive === "bool" ? { kind: "known", category: "boolean" }
          : term.kind === "primitive" && term.primitive === "float64" ? { kind: "known", category: "number" }
          : term.kind === "string" ? { kind: "known", category: "string" }
          : term.kind === "intrinsic" && term.intrinsic === "absence" ? { kind: "known", category: "absence" }
          : { kind: "dynamic" }, numeric: null, sum: null, nominal: null, pointer: null }, error: null };
      return { kind: "ok", diagnostics: [], value: { bounds: destination.kind === "open" ? [{ contribution: input.contribution.key,
        variable: destination.variable, kind: "producer", ...evidence }] : [],
        decision: { kind: "call", application: decision, operation: null }, selectedCandidate: decision.candidate } };
    },
  };
}
