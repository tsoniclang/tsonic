import type { Violation } from "../diag/contract.js";
import { encodeKey } from "../ids/index.js";
import type { Signature } from "../ir-types/contract.js";
import type { EffectPaths, EscapeTarget, FactsSite, RelationalOwner, SummaryRule, VerifySummary } from "./contract.js";
import { escapeData, validIndex, verifyFactBindings, verifyRelationalArena } from "./verify-relations.js";

const targetKey = (target: EscapeTarget): string => encodeKey(escapeData(target));

export const verifySummary: VerifySummary = (summary, context) => {
  const violations: Violation<SummaryRule, FactsSite>[] = [];
  const site: FactsSite = { kind: "summary", summary: summary.key };
  const owner: RelationalOwner = { kind: "summary", definition: summary.key.definition, bindings: summary.key.bindings };
  const report = (rule: SummaryRule, text: string, at: FactsSite = site): void => {
    violations.push({ rule, site: at, detail: [{ kind: "text", value: text }] });
  };
  if (!context.definitionExists(summary.key.definition)) {
    report("definition-resolves", "A summary must name an existing declaration in the supplied inventory.");
  }
  const signature = validIndex(summary.signature, context.types.signatures.length) ? context.types.signatures[summary.signature] : undefined;
  if (signature === undefined || signature.id !== summary.signature) {
    report("signature-resolves", "A summary must name an existing declaration-instantiated signature.");
  }
  if (signature !== undefined && signature.declaration !== null && signature.declaration !== summary.key.definition) {
    report("cross-owner-qualified", "The summary signature must retain its actual declaration owner.");
  }
  if (summary.key.bindings.kind === "instantiated") {
    for (const violation of verifyFactBindings([{ vector: summary.key.bindings.bindings, definition: summary.key.definition, site }], context)) {
      violations.push({ rule: "bindings-complete", site: violation.site, detail: violation.detail });
    }
  }
  for (const violation of verifyRelationalArena(summary.arena, owner, context)) {
    const rule: SummaryRule = violation.rule === "bindings-complete" || violation.rule === "cross-owner-qualified" ||
      violation.rule === "relational-site-resolves" || violation.rule === "declared-site-ordinal" ? violation.rule : "summary-finite";
    violations.push({ rule, site: violation.site, detail: violation.detail });
  }
  const capturedCount = context.captureCount(summary.key);
  if (capturedCount === null || !Number.isSafeInteger(capturedCount) || capturedCount < 0 || summary.captures.length !== capturedCount) {
    report("captures-total", "A summary retains every location in the actual declaration capture inventory.");
  }
  const dependent = context.bindingDependentOf(summary.key.definition);
  if (dependent === null || dependent !== summary.bindingDependent) {
    report("summary-binding-dependence", "Summary dependence equals the supplied declaration's actual binding dependence.");
  }
  const checkPaths = (paths: EffectPaths): void => {
    let previous = -1;
    for (const path of paths.paths) {
      if (!validIndex(path, summary.arena.projections.length) || path <= previous) {
        report("summary-finite", "Effect paths are distinct ordered references into the summary's own finite arena.");
      }
      previous = path;
    }
    if (paths.kind === "open") for (const boundary of paths.boundaries) {
      if (!validIndex(boundary, summary.arena.boundaries.length)) {
        report("known-negative-distinct", "An unknown effect retains its real boundary rather than pretending to be no effect.");
      }
    }
  };
  const receiver = signature?.receiver !== null && signature?.receiver !== undefined;
  if (signature !== undefined && summary.parameters.length !== signature.parameters.length + (receiver ? 1 : 0)) {
    report("parameters-total", "Summary effects contain the actual receiver and every declared parameter exactly once.");
  }
  for (let index = 0; index < summary.parameters.length; index += 1) {
    const effect = summary.parameters[index]; if (effect === undefined) continue;
    const position = index - (receiver ? 1 : 0);
    if (receiver && index === 0 ? effect.slot.kind !== "receiver"
      : effect.slot.kind !== "parameter" || effect.slot.index !== position) {
      report("parameters-order", "Parameter effects retain receiver-first and declaration parameter order.");
    }
    checkPaths(effect.reads); checkPaths(effect.writes);
  }
  for (let index = 0; index < summary.captures.length; index += 1) {
    const effect = summary.captures[index]; if (effect === undefined) continue;
    if (effect.index !== index) report("captures-order", "Capture effects retain the actual dense captured-location order.");
    checkPaths(effect.reads); checkPaths(effect.writes);
  }
  if (!validIndex(summary.result, summary.arena.origins.length)) {
    report("result-origins-resolves", "Result origins resolve in this exact summary arena.");
  }
  if (!validIndex(summary.thrown, summary.arena.origins.length)) {
    report("thrown-origins-resolves", "Thrown origins resolve in this exact summary arena.");
  }
  let previousWrite: readonly [number, number] | null = null;
  for (const write of summary.writes) {
    if (!validIndex(write.target, summary.arena.producers.length) || !validIndex(write.value, summary.arena.origins.length)) {
      report("write-origins-resolves", "A summary write retains its actual producer and value origins in this arena.");
    }
    if (previousWrite !== null && (previousWrite[0] > write.target || previousWrite[0] === write.target && previousWrite[1] >= write.value)) {
      report("writes-order", "Summary writes are distinct and ordered by target producer and value origins.");
    }
    previousWrite = [write.target, write.value];
  }
  let previousRetention: readonly [number, string] | null = null;
  for (const retention of summary.retention) {
    if (!validIndex(retention.source, summary.arena.producers.length)) {
      report("retention-source-resolves", "Every retained source is a producer in this exact summary arena.");
    }
    const target = retention.into;
    const path = target.kind === "shared" || target.kind === "parameter" || target.kind === "capture" || target.kind === "receiver" ? target.path : null;
    if (path !== null && !validIndex(path, summary.arena.projections.length) ||
      target.kind === "parameter" && (signature === undefined || !validIndex(target.index, signature.parameters.length)) ||
      target.kind === "capture" && (capturedCount === null || !validIndex(target.index, capturedCount)) ||
      target.kind === "receiver" && !receiver || target.kind === "shared" && !context.definitionExists(target.definition) ||
      target.kind === "external" && !validIndex(target.boundary, summary.arena.boundaries.length)) {
      report("cross-owner-qualified", "A retention target retains its actual declaration, formal, capture, path or boundary owner.");
    }
    const key = targetKey(target);
    if (previousRetention !== null && (previousRetention[0] > retention.source || previousRetention[0] === retention.source && previousRetention[1] >= key)) {
      report("retention-order", "Retention entries are distinct and ordered by source and complete target identity.");
    }
    previousRetention = [retention.source, key];
  }
  let previousCallback = -1;
  for (const callback of summary.callbacks) {
    if (callback.parameterIndex <= previousCallback) report("callbacks-order", "Callback entries retain distinct declaration parameter order.");
    previousCallback = callback.parameterIndex;
    const parameter = signature?.parameters[callback.parameterIndex];
    if (signature === undefined || !validIndex(callback.parameterIndex, signature.parameters.length) || parameter === undefined) {
      report("callback-parameter-resolves", "A callback names an actual parameter of the summary signature.");
    }
    const type = parameter === undefined ? undefined : context.types.terms[parameter.type];
    const calls: readonly Signature[] = type?.kind === "callable" || type?.kind === "shape"
      ? type.calls.flatMap(id => { const selected = context.types.signatures[id]; return selected === undefined ? [] : [selected]; }) : [];
    for (const input of callback.inputs) {
      if (calls.length === 0 || calls.some(call => !validIndex(input.parameterIndex, call.parameters.length)) ||
        input.kind === "argument-element" && (signature === undefined || !validIndex(input.sourceParameterIndex, signature.parameters.length)) ||
        input.kind !== "argument-element" && !receiver) {
        report("callback-input-resolves", "Callback input channels retain their actual callback formal and receiver or source parameter.");
      }
    }
    const rejection = callback.rejection;
    if (rejection !== null && (calls.length === 0 || calls.some(call => !validIndex(rejection, call.parameters.length)))) {
      report("callback-input-resolves", "A callback rejection channel names an actual callback formal.");
    }
  }
  let previousInvocationOnly = -1;
  for (const parameter of summary.invocationOnlyParameters) {
    if (parameter <= previousInvocationOnly) report("invocation-only-parameters-order", "Invocation-only parameters are distinct and ordered by declaration index.");
    if (signature === undefined || !validIndex(parameter, signature.parameters.length)) {
      report("invocation-only-parameter-resolves", "An invocation-only index names an actual declaration parameter.");
    }
    previousInvocationOnly = parameter;
  }
  const limits = context.limits;
  const rows = summary.arena.projections.length + summary.arena.producers.length + summary.arena.contexts.length +
    summary.arena.boundProducers.length + summary.arena.origins.length + summary.arena.boundaries.length;
  const depths: number[] = [];
  let references = 0;
  let exceeded = rows > limits.maximumRelationalRecordsPerBody;
  for (const path of summary.arena.projections) {
    const parent = path.parent === null ? 0 : depths[path.parent];
    const depth = parent === undefined ? 0 : parent + 1; depths.push(depth);
    if (depth > limits.maximumProjectionDepth) exceeded = true;
    if (path.parent !== null) references += 1;
  }
  for (const origins of summary.arena.origins) {
    references += origins.producers.length + (origins.kind === "open" ? origins.boundaries.length : 0);
    if (origins.producers.length > limits.maximumOriginAlternatives) exceeded = true;
  }
  for (const value of summary.arena.contexts) references += (value.receiver === null ? 0 : 1) + value.arguments.length + value.captures.length;
  references += summary.arena.boundProducers.length * 2 + summary.arena.boundaries.length * 3;
  if (exceeded || references > limits.maximumRelationalReferencesPerBody) {
    report("summary-finite", "The published summary arena respects the actual producer's finite record, reference, path and alternative limits.");
  }
  return Object.freeze(violations);
};
