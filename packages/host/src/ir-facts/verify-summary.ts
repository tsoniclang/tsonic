import type { Violation } from "../diag/contract.js";
import { encodeKey } from "../ids/index.js";
import type { EffectPaths, EscapeTarget, FactsSite, RelationalOwner, SummaryRule, VerifySummary } from "./contract.js";
import { escapeData, nodeOwnedBy, relationalUsage, validIndex, verifyFactBindings, verifyRelationalArena } from "./verify-relations.js";

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
  if (capturedCount === null || !Number.isSafeInteger(capturedCount) || capturedCount < 0 || Object.is(capturedCount, -0) || summary.captures.length !== capturedCount) {
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
  for (const producer of summary.arena.producers) {
    if (producer.kind === "parameter" && (signature === undefined || !validIndex(producer.index, signature.parameters.length)) ||
      producer.kind === "capture" && (capturedCount === null || !validIndex(producer.index, capturedCount)) || producer.kind === "receiver" && !receiver) {
      report("summary-finite", "A summary producer retains its actual formal, receiver or captured-location slot.");
    }
  }
  if (signature !== undefined && summary.parameters.length !== signature.parameters.length + (receiver ? 1 : 0)) {
    report("parameters-total", "Summary effects contain the actual receiver and every declared parameter exactly once.");
  }
  for (const [index, effect] of summary.parameters.entries()) {
    const position = index - (receiver ? 1 : 0);
    if (receiver && index === 0 ? effect.slot.kind !== "receiver"
      : effect.slot.kind !== "parameter" || effect.slot.index !== position) {
      report("parameters-order", "Parameter effects retain receiver-first and declaration parameter order.");
    }
    checkPaths(effect.reads); checkPaths(effect.writes);
  }
  for (const [index, effect] of summary.captures.entries()) {
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
    if (target.kind === "callback" || target.kind === "suspension") {
      if (target.at.kind === "node") {
        if (!context.nodeExists({ kind: "body", value: target.at.node })) report("relational-site-resolves", "A retention target retains its actual source occurrence.");
        if (!nodeOwnedBy(owner, target.at.node)) report("cross-owner-qualified", "A retention target retains its actual summary declaration owner.");
      } else {
        if (!context.libraryExportExists(target.at.identity)) report("relational-site-resolves", "A retention target retains its actual library export.");
        const count = context.declaredSiteCount(target.at.identity);
        if (count === null || !validIndex(target.at.site, count)) report("declared-site-ordinal", "A retention target retains its actual declared allocation ordinal.");
      }
    }
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
  const callbackArities = new Map<number, number | null>();
  for (const callback of summary.callbacks) {
    if (callback.parameterIndex <= previousCallback) report("callbacks-order", "Callback entries retain distinct declaration parameter order.");
    previousCallback = callback.parameterIndex;
    const parameter = signature?.parameters[callback.parameterIndex];
    if (signature === undefined || !validIndex(callback.parameterIndex, signature.parameters.length) || parameter === undefined) {
      report("callback-parameter-resolves", "A callback names an actual parameter of the summary signature.");
    }
    if (parameter !== undefined && !callbackArities.has(parameter.type)) {
      const type = context.types.terms[parameter.type];
      let count: number | null = null;
      if (type?.kind === "callable" || type?.kind === "shape") {
        for (const id of type.calls) {
          const call = context.types.signatures[id];
          if (call === undefined || call.id !== id) { count = null; break; }
          if (count === null || call.parameters.length < count) count = call.parameters.length;
        }
      }
      callbackArities.set(parameter.type, count);
    }
    const count = parameter === undefined ? null : callbackArities.get(parameter.type) ?? null;
    for (const input of callback.inputs) {
      if (count === null || !validIndex(input.parameterIndex, count) ||
        input.kind === "argument-element" && (signature === undefined || !validIndex(input.sourceParameterIndex, signature.parameters.length)) ||
        input.kind !== "argument-element" && !receiver) {
        report("callback-input-resolves", "Callback input channels retain their actual callback formal and receiver or source parameter.");
      }
    }
    const rejection = callback.rejection;
    if (rejection !== null && (count === null || !validIndex(rejection, count))) {
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
  const usage = relationalUsage(summary.arena);
  if (usage.records > limits.maximumRelationalRecordsPerBody || usage.references > limits.maximumRelationalReferencesPerBody ||
    usage.depth > limits.maximumProjectionDepth || usage.alternatives > limits.maximumOriginAlternatives) {
    report("summary-finite", "The published summary arena respects the actual producer's finite record, reference, path and alternative limits.");
  }
  return Object.freeze(violations);
};
