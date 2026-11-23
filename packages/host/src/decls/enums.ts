import type { Diagnostic, UnitResult } from "../diag/contract.js";
import { hostDiagnosticCode, throwInvariant } from "../diag/index.js";
import type { Origin } from "../ids/contract.js";
import type { ConstValue } from "../ir-types/contract.js";
import { nativeCarrierOf, nativeIntegerGeometryOf } from "../ir-types/index.js";
import type { EnumOf, EnumOfDeps, EnumValueRequest, EnumValueStep, ResumeEnumOf } from "./contract.js";

function fail(message: string): never {
  return throwInvariant({ owner: "decls", query: null, origin: null, message });
}

function done(value: UnitResult<ConstValue>): EnumValueStep {
  return { kind: "done", value };
}

function value(result: ConstValue): EnumValueStep {
  return done({ kind: "ok", value: result, diagnostics: [], positions: [{ position: { kind: "result" }, error: null }], emissions: [] });
}

function invalid(origin: Origin, message: string): EnumValueStep {
  const name = hostDiagnosticCode("TSONIC_CONSTANT_EVALUATION_FAILED");
  const diagnostic: Diagnostic = { code: { kind: "host", name, rendered: name }, severity: "error", site: { kind: "source", origin },
    source: "decls", evidence: [], message, arguments: [], related: [], fix: null };
  return done({ kind: "refused", diagnostics: [diagnostic] });
}

export const enumOf: EnumOf = (deps, input) => {
  const admitted = deps.admit(1, 0);
  if (admitted !== null) return done(admitted);
  const { module, declaration, ordinal, reference } = input;
  const member = declaration.members.nodes[ordinal];
  if (module.nodes[declaration.id] !== declaration || member === undefined || module.nodes[member.id] !== member
    || member.parent !== declaration.id || member.tsonic.parent !== declaration.tsonic.definition
    || member.tsonic.declaration.kind !== "definition" || member.tsonic.declaration.definition !== reference.member
    || declaration.tsonic.members[ordinal] !== reference.member) return fail("An enum constant requires its actual qualified checked member.");
  const body = member.tsonic.initializer;
  if (body !== null || ordinal !== 0) {
    const stop = deps.admit(1, 3);
    if (stop !== null) return done(stop);
    if (body !== null) {
      if (member.initializer === null) return fail("An enum initializer names its actual authored expression.");
      const selected: EnumValueRequest = { kind: "evaluate", instance: { body, bindings: reference.bindings } };
      return { kind: "paused", requests: [selected], paused: { selected, origin: member.origin }, earned: [] };
    }
    const previous = declaration.tsonic.members[ordinal - 1];
    if (previous === undefined) return fail("An implicit enum member requires the actual preceding declaration.");
    const selected: EnumValueRequest = { kind: "predecessor", reference: { context: "enum-member", member: previous, bindings: reference.bindings } };
    return { kind: "paused", requests: [selected], paused: { selected, origin: member.origin }, earned: [] };
  }
  const stop = deps.admit(1, 2);
  return stop === null ? value({ kind: "number", type: deps.integerType, value: { numerator: 0n, denominator: 1n, negativeZero: false } }) : done(stop);
};

function successor(deps: EnumOfDeps, previous: ConstValue, origin: Origin): EnumValueStep {
  let stopped = deps.admit(1, 0);
  if (stopped !== null) return done(stopped);
  if (previous.kind !== "number" || previous.value.denominator !== 1n)
    return invalid(origin, "An implicit enum member requires a completed integral predecessor.");
  const take = (work: number): boolean => { stopped ??= deps.admit(work, 0); return stopped === null; };
  const selected = nativeCarrierOf(deps.types, previous.type, type => take(1) ? deps.types.terms[type] : null);
  if (stopped !== null) return done(stopped);
  if (selected.kind !== "primitive") return invalid(origin, "An implicit enum member requires a selected native integer carrier.");
  const geometry = nativeIntegerGeometryOf(selected.primitive, deps.nativeFacts, work => take(work));
  if (stopped !== null) return done(stopped);
  if (geometry.kind !== "integer") return invalid(origin, "An implicit enum member requires a selected native integer carrier.");
  const compare = deps.admit(geometry.bits, 0);
  if (compare !== null) return done(compare);
  if (previous.value.numerator >= geometry.maximum)
    return invalid(origin, "The implicit enum successor does not fit its selected native integer carrier.");
  const arithmetic = deps.admit(geometry.bits, 2);
  return arithmetic === null ? value({ ...previous, value: { numerator: previous.value.numerator + 1n, denominator: 1n, negativeZero: false } })
    : done(arithmetic);
}

export const resumeEnumOf: ResumeEnumOf = (deps, paused, answers) => {
  const answer = answers[0];
  if (answers.length !== 1 || answer === undefined) return fail("An enum member resumes from its single requested value.");
  if (answer.kind === "not-constant") return invalid(answer.origin, "An enum initializer must complete as a constant.");
  const { result } = answer;
  if (result.kind === "error") return done({ kind: "ok", value: result, diagnostics: [],
    positions: [{ position: { kind: "result" }, error: { kind: "error", causes: [{ kind: "unit", unit: answer.unit }] } }], emissions: [] });
  if (paused.selected.kind === "predecessor") return successor(deps, result, paused.origin);
  if (result.kind !== "number" && result.kind !== "floating" && result.kind !== "string")
    return invalid(paused.origin, "An enum initializer must produce a numeric or text value.");
  return value(result);
};
