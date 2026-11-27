import type { ApplicationDecision, CandidateInput, CallConstraint, CallContributionScheme, ConstraintDecision, InferenceCandidateList, InferenceValue, ParameterMapping, RuleWork } from "../ir-infer/contract.js";
import { admitTypePublicationStep, hasLexicalTypeDependency, internType, isNativeBinaryFloatPrimitive, isNativeIntegerPrimitive, optionalValueDomainOf,
  readSignature, readType, refuseTypeConstruction, rigidBindings } from "../ir-types/index.js";
import type { Origin } from "../ids/contract.js";
import type { Result } from "../diag/contract.js";
import type { Signature } from "../ir-types/contract.js";
import type { CandidateEndpoint } from "../ir-infer/contract.js";
import { hostDiagnosticCode } from "../diag/index.js";
import type { RulesDeps } from "./contract.js";
import { callerDefect, notDecidedYet } from "./frontier.js";
import { mergeErrors } from "./errors.js";
import { variableOf } from "./schemes.js";
import { embeddingForm } from "./embed.js";

export function decideCandidate(deps: RulesDeps, input: CandidateInput, work: RuleWork): Result<ApplicationDecision> {
  const { origin } = input.context;
  const stopped = admitTypePublicationStep(work.typeWork, 0);
  if (stopped !== null) return refuseTypeConstruction(work.typeWork, stopped, origin, work.unit);
  return completeCandidate(deps, input, originalCandidate(deps, input, origin), origin, null, work);
}

interface PreparedCandidate {
  readonly candidate: CandidateEndpoint;
  readonly signature: Signature;
  readonly original: Signature;
}

function originalCandidate(deps: RulesDeps, input: Omit<CandidateInput, "context">, origin: Origin): PreparedCandidate {
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
  const callee = readType(deps.types, input.callee.type);
  const valueSignature = original.typeParameters.length !== 0 ? original.id : signature.id;
  if (callee.kind !== "callable" || !callee.calls.includes(valueSignature))
    return callerDefect("the callee must contain its actual callable value signature", origin);
  return { candidate, signature, original };
}

function* fixedOperands(deps: RulesDeps, input: Omit<CandidateInput, "context">, origin: Origin) {
  for (const [index, argument] of input.arguments.entries()) {
    if (argument.kind === "value") {
      if (argument.tuple !== null) return callerDefect("a value argument cannot supply a spread slot vector", origin);
      yield { index, component: null, value: argument.value };
      continue;
    }
    const selected = readType(deps.types, argument.value.type);
    if (selected.kind !== "tuple" || argument.tuple === null || selected.elements.length !== argument.tuple.length)
      return notDecidedYet("the complete selected tuple of a finite call spread", origin);
    for (const [component, value] of argument.tuple.entries()) {
      const element = selected.elements[component];
      if (element?.kind !== "required" || element.type !== value.type)
        return callerDefect("a finite call spread must retain its actual ordered required slots", origin);
      yield { index, component, value };
    }
  }
}

function completeCandidate(deps: RulesDeps, input: Omit<CandidateInput, "context">, ready: PreparedCandidate, origin: Origin,
  checkedArguments: CallConstraint["application"]["arguments"] | null, work: RuleWork): Result<ApplicationDecision> {
  const { candidate, signature, original } = ready;
  const parameters: ParameterMapping[] = [];
  const supplied = fixedOperands(deps, input, origin);
  for (const [index, parameter] of signature.parameters.entries()) {
    if (parameter.kind === "rest" || parameter.passing !== "by-value")
      return notDecidedYet("the actual selected spread or non-value argument transport", origin);
    const next = supplied.next();
    if (next.done) {
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
    const argument = next.value;
    if (checkedArguments !== null && argument.value.type !== parameter.type) {
      const checked = checkedArguments[argument.index];
      if (checked === undefined || readType(deps.types, checked.type).kind === "open")
        return notDecidedYet("the actual inferred argument embedding contribution", origin);
    }
    const form = embeddingForm(deps, argument.value.type, parameter.type, work);
    if (form !== null && typeof form !== "string") return refuseTypeConstruction(work.typeWork, form, origin, work.unit);
    if (form === "incompatible-domain" || form === "lossy-numeric") {
      const code = hostDiagnosticCode("TSONIC_NO_APPLICABLE_NATIVE_CANDIDATE");
      return { kind: "refused", diagnostics: [{
        code: { kind: "host", name: code, rendered: code }, severity: "error", site: { kind: "source", origin },
        source: "rules", evidence: [], message: form === "incompatible-domain"
          ? "No native call candidate accepts supplied absence for this Boolean parameter."
          : "The supplied literal does not fit the selected native integer parameter.",
        arguments: [], related: [], fix: null,
      }] };
    }
    if (form === null)
      return notDecidedYet("the actual selected argument embedding contribution", origin);
    if (argument.component !== null && form !== "identity")
      return notDecidedYet("the actual embedding of a selected tuple component", origin);
    parameters.push({ kind: "argument", parameter: index, argument: argument.index, component: argument.component, passing: parameter.passing });
  }
  if (!supplied.next().done) return notDecidedYet("the actual selected extra or rest formal transport", origin);
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
        if ((argument.kind === "spread") !== (argument.tuple !== null) || argument.closure !== null)
          return notDecidedYet("the argument, receiver and generic contribution footprints", null);
        const variable = variableOf(deps, argument.type, input.constraint.occurrence, input.group);
        if (variable !== null) reads.add(variable);
        if (argument.tuple !== null) for (const type of argument.tuple) {
          const slot = variableOf(deps, type, input.constraint.occurrence, input.group);
          if (slot !== null) reads.add(slot);
        }
      }
      const result = variableOf(deps, application.result, input.constraint.occurrence, input.group);
      return { kind: "ok", diagnostics: [], value: [{ key: { node: input.constraint.occurrence, candidate: candidate.ordinal,
        role: { kind: "application-result" } }, reads: [...reads].sort((left, right) => left - right),
        bounds: result === null ? [] : [result], constraint: input.reference }] };
    },
    evaluate: input => {
      const constraint = input.constraint;
      const capturedCallee = input.evidence[0];
      const result = input.evidence[1];
      const argumentStart = 2 + constraint.application.typeArguments.length;
      const evidenceCount = argumentStart + constraint.application.arguments.reduce((count, argument) => count + 1 + (argument.tuple?.length ?? 0), 0);
      if (input.evidence.length !== evidenceCount || capturedCallee === undefined || result === undefined
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
      let evidenceIndex = argumentStart;
      const arguments_ = constraint.application.arguments.map(argument => {
        const evidence = input.evidence[evidenceIndex++];
        if (evidence === undefined || evidence.value.type !== argument.type)
          return callerDefect("a call argument requires its actual selected occurrence evidence", null);
        const value = resolved(evidence);
        argumentValues.push(value);
        const tuple = argument.tuple === null ? null : argument.tuple.map(type => {
          const slot = input.evidence[evidenceIndex++];
          const root = slot?.value.component;
          if (slot?.value.type !== type || root?.kind !== "body" || root.value.body !== argument.occurrence.body || root.value.node !== argument.occurrence.node)
            return callerDefect("a call spread requires its actual ordered slot evidence", input.origin);
          const selected = resolved(slot);
          argumentValues.push(selected);
          return selected.value;
        });
        return { occurrence: argument.occurrence, kind: argument.kind, value: value.value, tuple };
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
      const provider = constraint.application.captured.provider;
      if (provider.kind !== "available") return notDecidedYet("the actual selected native provider application law", input.origin);
      if (provider.value !== null && (candidate.declaration !== provider.value || candidate.api.body !== null))
        return callerDefect("a native application must retain its actual selected bodyless provider endpoint", input.origin);
      const operands = { kind: "call", callee: callee.value, receiver: null,
        typeArguments: typeArguments.map(argument => argument.value), arguments: arguments_, candidates: [candidate] } satisfies Omit<CandidateInput, "context">;
      const prepared = originalCandidate(deps, operands, input.origin);
      const type = prepared.signature.result;
      if (destination === null && constraint.application.result !== type)
        return callerDefect("a closed application result must agree with the authoritative completion", null);
      const term = readType(deps.types, type);
      const optional = term.kind === "optional" ? optionalValueDomainOf(term, value => readType(deps.types, value)) : null;
      const evidence: InferenceValue = { value: { type, component: { kind: "body", value: constraint.occurrence },
        category: optional?.kind === "optional-value" ? optional.category
          : term.kind === "primitive" && term.primitive === "bool" ? { kind: "known", category: "boolean" }
          : term.kind === "primitive" && (isNativeIntegerPrimitive(term.primitive) || isNativeBinaryFloatPrimitive(term.primitive))
            ? { kind: "known", category: "number" }
          : term.kind === "string" ? { kind: "known", category: "string" }
          : term.kind === "intrinsic" && term.intrinsic === "absence" ? { kind: "known", category: "absence" }
          : { kind: "dynamic" }, numeric: null, sum: null, nominal: null, pointer: null }, error: null };
      const { scope, typeWork } = input;
      let dependent = false;
      if (scope.classParameters.length + scope.methodParameters.length + scope.capturedParameters.length + scope.selfOwners.length !== 0) {
        const roots = [type, operands.callee.type, ...operands.typeArguments.map(value => value.type),
          ...operands.arguments.map(argument => argument.value.type)];
        const vector = candidate.bindings;
        for (const family of [vector.classBindings, vector.methodBindings, vector.capturedBindings, vector.selfBindings]) {
          for (let position = 0; position < family.length; position += 1) {
            const stop = admitTypePublicationStep(typeWork);
            if (stop !== null) return refuseTypeConstruction(typeWork, stop, input.origin, input.unit);
            const binding = family[position];
            if (binding === undefined) return callerDefect("a selected candidate requires complete binding rows", input.origin);
            if (binding.kind === "bound") roots.push(binding.type);
          }
        }
        const dependency = hasLexicalTypeDependency(deps.types, roots, scope, typeWork);
        if (dependency.kind !== "complete") return refuseTypeConstruction(typeWork, dependency, input.origin, input.unit);
        dependent = dependency.value;
      }
      let outcome: ConstraintDecision;
      if (dependent) outcome = { kind: "deferred", deferred: { result: type, invocation: { rule: "candidate",
        input: { ...operands, context: { occurrence: constraint.occurrence, origin: input.origin, bindings: rigidBindings(scope) } },
      } } };
      else {
        const selected = completeCandidate(deps, operands, prepared, input.origin, constraint.application.arguments, input);
        if (selected.kind === "refused") return selected;
        outcome = { kind: "call", application: selected.value, operation: null };
      }
      return { kind: "ok", diagnostics: [], value: { bounds: destination === null ? [] : [{ contribution: input.contribution.key,
        variable: destination, kind: "producer", ...evidence }],
        decision: outcome, selectedCandidate: outcome.kind === "call" ? outcome.application.candidate : null } };
    },
  };
}
