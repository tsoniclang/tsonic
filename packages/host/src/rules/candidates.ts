import type { ApplicationDecision, CandidateInput, CallConstraint, CallContributionScheme, InferenceCandidateList, InferenceValue, ParameterMapping } from "../ir-infer/contract.js";
import { internType, optionalValueDomainOf, readSignature, readType } from "../ir-types/index.js";
import type { Origin } from "../ids/contract.js";
import type { Result } from "../diag/contract.js";
import { hostDiagnosticCode } from "../diag/index.js";
import type { RulesDeps } from "./contract.js";
import { callerDefect, notDecidedYet } from "./frontier.js";
import { mergeErrors } from "./errors.js";
import { variableOf } from "./schemes.js";
import { embeddingForm } from "./embed.js";

export function decideCandidate(deps: RulesDeps, input: CandidateInput): Result<ApplicationDecision> {
  return selectCandidate(deps, input, input.context.origin);
}

function selectCandidate(deps: RulesDeps, input: Omit<CandidateInput, "context">, origin: Origin,
  checkedArguments: CallConstraint["application"]["arguments"] | null = null): Result<ApplicationDecision> {
  const candidate = input.candidates[0];
  if (candidate === undefined || input.candidates.length !== 1)
    return notDecidedYet("native ordered applicability over multiple or missing candidates", origin);
  if (input.kind !== "call" || input.receiver !== null)
    return notDecidedYet("the selected argument and receiver application contributions", origin);
  if (candidate.conditionalFailure !== null)
    return notDecidedYet("the original conditional candidate failure", origin);
  const signature = readSignature(deps.types, candidate.apiSignature);
  const original = candidate.api.signature === signature.id ? signature : readSignature(deps.types, candidate.api.signature);
  if (signature.declaration !== candidate.declaration || candidate.advertised.declaration !== candidate.declaration
    || candidate.api.declaration !== candidate.declaration || original.declaration !== candidate.declaration
    || candidate.advertised.signature !== original.id || candidate.advertisedSignature !== signature.id)
    return callerDefect("a candidate must retain its actual authoritative declaration and endpoints", origin);
  if (input.typeArguments.length > original.typeParameters.length || input.typeArguments.some((argument, index) => {
    const binding = candidate.bindings.methodBindings[index];
    return binding?.kind !== "bound" || binding.parameter !== original.typeParameters[index]?.declaration || binding.type !== argument.type;
  })) return callerDefect("an authored type argument must match the original binder's actual selected binding", origin);
  if (signature.kind !== "call" || signature.receiver !== null || signature.typeParameters.length !== 0)
    return notDecidedYet("the native applicability of a receiver, formal or generic candidate", origin);
  if (input.arguments.length > signature.parameters.length)
    return notDecidedYet("the actual selected extra or rest formal transport", origin);
  const callee = readType(deps.types, input.callee.type);
  const valueSignature = original.typeParameters.length !== 0 ? original.id : signature.id;
  if (callee.kind !== "callable" || !callee.calls.includes(valueSignature))
    return callerDefect("the callee must contain its actual callable value signature", origin);
  const parameters: ParameterMapping[] = [];
  for (const [index, parameter] of signature.parameters.entries()) {
    if (parameter.kind === "rest" || parameter.passing !== "by-value")
      return notDecidedYet("the actual selected spread or non-value argument transport", origin);
    if (index >= input.arguments.length) {
      if (candidate.api.body === null || !parameter.acceptsOmission)
        return notDecidedYet("the actual selected omission capability of a fixed formal", origin);
      const declared = original.parameters[index];
      if (declared?.declaration !== parameter.declaration || declared.kind !== parameter.kind
        || declared.acceptsOmission !== parameter.acceptsOmission || declared.initializer !== parameter.initializer)
        return callerDefect("an omitted formal must retain its original declaration and initializer", origin);
      if (parameter.kind === "default" && parameter.initializer !== null) {
        parameters.push({ kind: "default", parameter: index, initializer: parameter.initializer });
        continue;
      }
      if (parameter.kind === "optional" && parameter.initializer === null) {
        const domain = optionalValueDomainOf(readType(deps.types, parameter.type), value => readType(deps.types, value));
        if (domain.kind === "optional-value") {
          parameters.push({ kind: "omitted", parameter: index, type: parameter.type });
          continue;
        }
      }
      return notDecidedYet("the selected value of an omitted fixed formal", origin);
    }
    const argument = input.arguments[index];
    if (argument === undefined) return callerDefect("a supplied argument must occupy its authored position", origin);
    if (argument.kind !== "value" || argument.tuple !== null)
      return notDecidedYet("the actual selected spread or non-value argument transport", origin);
    if (checkedArguments !== null && argument.value.type !== parameter.type) {
      const checked = checkedArguments[index];
      if (checked === undefined || readType(deps.types, checked.type).kind === "open")
        return notDecidedYet("the actual inferred argument embedding contribution", origin);
    }
    const form = embeddingForm(deps, argument.value.type, parameter.type);
    if (form === "incompatible-domain") {
      const code = hostDiagnosticCode("TSONIC_NO_APPLICABLE_NATIVE_CANDIDATE");
      return { kind: "refused", diagnostics: [{
        code: { kind: "host", name: code, rendered: code }, severity: "error", site: { kind: "source", origin },
        source: "rules", evidence: [], message: "No native call candidate accepts supplied absence for this Boolean parameter.",
        arguments: [], related: [], fix: null,
      }] };
    }
    if (form === null)
      return notDecidedYet("the actual selected argument embedding contribution", origin);
    parameters.push({ kind: "argument", parameter: index, argument: index, component: null, passing: parameter.passing });
  }
  return { kind: "ok", diagnostics: [], value: { candidate: candidate.ordinal, advertised: candidate.advertised, api: candidate.api,
    bindings: candidate.bindings, implementationBindings: candidate.bindings, parameters,
    completion: { signature: signature.id, completion: signature.result, yielded: null, sent: null },
    result: signature.result, activation: null } };
}

function actualCandidate(lists: readonly InferenceCandidateList[], constraint: CallConstraint) {
  const list = lists.find(list => list.id === constraint.application.candidates);
  const candidate = list?.candidates[0];
  if (list === undefined || list.candidates.length !== 1 || candidate === undefined)
    return notDecidedYet("the complete ordered candidate contribution inventory", null);
  if (candidate.bindings.kind !== "available" || candidate.conditionalFailure.kind !== "available" || candidate.endpoints.kind !== "available")
    return notDecidedYet("the original candidate bindings and conditional failure", null);
  return { ordinal: candidate.ordinal, declaration: candidate.declaration, ...candidate.endpoints.value,
    bindings: candidate.bindings.value, conditionalFailure: candidate.conditionalFailure.value };
}

export function callScheme(deps: RulesDeps): CallContributionScheme {
  return {
    enumerate: input => {
      const candidate = actualCandidate(input.candidates, input.constraint);
      const application = input.constraint.application;
      if (application.receiver !== null)
        return notDecidedYet("the argument, receiver and generic contribution footprints", null);
      const reads = new Set<number>();
      const callee = variableOf(deps, application.callee, input.constraint.occurrence, input.group);
      if (callee !== null) reads.add(callee);
      for (const type of application.typeArguments) {
        const variable = variableOf(deps, type, input.constraint.occurrence, input.group);
        if (variable !== null) reads.add(variable);
      }
      for (const argument of application.arguments) {
        if (argument.kind !== "value" || argument.tuple !== null || argument.closure !== null)
          return notDecidedYet("the argument, receiver and generic contribution footprints", null);
        const variable = variableOf(deps, argument.type, input.constraint.occurrence, input.group);
        if (variable !== null) reads.add(variable);
      }
      const result = variableOf(deps, application.result, input.constraint.occurrence, input.group);
      return { kind: "ok", diagnostics: [], value: [{ key: { node: input.constraint.occurrence, candidate: candidate.ordinal,
        role: { kind: "application-result" } }, reads: [...reads].sort((left, right) => left - right),
        bounds: result === null ? [] : [result], constraint: input.reference }] };
    },
    evaluate: input => {
      const constraint = input.constraint;
      if (constraint.application.captured.provider.kind !== "available" || constraint.application.captured.provider.value !== null)
        return notDecidedYet("the actual selected native provider application law", null);
      const capturedCallee = input.evidence[0];
      const result = input.evidence[1];
      const argumentStart = 2 + constraint.application.typeArguments.length;
      if (input.evidence.length !== argumentStart + constraint.application.arguments.length || capturedCallee === undefined || result === undefined
        || capturedCallee.value.type !== constraint.application.callee || result.value.type !== constraint.application.result)
        return callerDefect("a call contribution requires its actual callee and result evidence", null);
      const finals = input.reads.length === 0 ? null : new Map(input.reads.map(value => [value.variable, value]));
      const resolved = (evidence: InferenceValue): InferenceValue => {
        const variable = variableOf(deps, evidence.value.type, constraint.occurrence, null);
        if (variable === null) return evidence;
        const final = finals?.get(variable);
        if (final === undefined) return callerDefect("a call requires the actual final value of every declared variable read", null);
        return { value: { ...final.value, component: evidence.value.component }, error: final.error };
      };
      const callee = resolved(capturedCallee);
      const candidate = actualCandidate(input.candidates, constraint);
      const typeArguments = constraint.application.typeArguments.map((type, index) => {
        const evidence = input.evidence[index + 2];
        if (evidence === undefined || evidence.value.type !== type)
          return callerDefect("a type argument requires its actual checked occurrence evidence", null);
        return resolved(evidence);
      });
      const argumentValues: InferenceValue[] = [];
      const arguments_ = constraint.application.arguments.map((argument, index) => {
        const evidence = input.evidence[index + argumentStart];
        if (evidence === undefined || evidence.value.type !== argument.type)
          return callerDefect("a call argument requires its actual selected occurrence evidence", null);
        const value = resolved(evidence);
        argumentValues.push(value);
        return { occurrence: argument.occurrence, kind: argument.kind, value: value.value, tuple: null };
      });
      const destination = variableOf(deps, constraint.application.result, constraint.occurrence, null);
      const error = mergeErrors([callee, ...typeArguments, ...argumentValues]);
      if (error !== null) {
        const evidence: InferenceValue = { value: { type: internType(deps.types, { kind: "error" }),
          component: { kind: "body", value: constraint.occurrence }, category: { kind: "dynamic" },
          numeric: null, sum: null, nominal: null, pointer: null }, error };
        return { kind: "ok", diagnostics: [], value: { bounds: destination === null ? [] : [{ contribution: input.contribution.key,
          variable: destination, kind: "producer", ...evidence }], decision: { kind: "error", error }, selectedCandidate: null } };
      }
      const selected = selectCandidate(deps, { kind: "call", callee: callee.value, receiver: null,
        typeArguments: typeArguments.map(argument => argument.value), arguments: arguments_, candidates: [candidate] },
        input.origin, constraint.application.arguments);
      if (selected.kind === "refused") return selected;
      const decision = selected.value;
      if (destination === null && constraint.application.result !== decision.result)
        return callerDefect("a closed application result must agree with the authoritative completion", null);
      const term = readType(deps.types, decision.result);
      const optional = term.kind === "optional" ? optionalValueDomainOf(term, value => readType(deps.types, value)) : null;
      const evidence: InferenceValue = { value: { type: decision.result, component: { kind: "body", value: constraint.occurrence },
        category: optional?.kind === "optional-value" ? optional.category
          : term.kind === "primitive" && term.primitive === "bool" ? { kind: "known", category: "boolean" }
          : term.kind === "primitive" && term.primitive === "float64" ? { kind: "known", category: "number" }
          : term.kind === "string" ? { kind: "known", category: "string" }
          : term.kind === "intrinsic" && term.intrinsic === "absence" ? { kind: "known", category: "absence" }
          : { kind: "dynamic" }, numeric: null, sum: null, nominal: null, pointer: null }, error: null };
      return { kind: "ok", diagnostics: [], value: { bounds: destination === null ? [] : [{ contribution: input.contribution.key,
        variable: destination, kind: "producer", ...evidence }],
        decision: { kind: "call", application: decision, operation: null }, selectedCandidate: decision.candidate } };
    },
  };
}
