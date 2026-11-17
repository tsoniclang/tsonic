import { summaryDefinition, summaryPositionKey } from "./summary-key.js";
import type { DataflowStop } from "../dataflow/contract.js";
import { chargeResultEntries, chargeWork } from "../dataflow/index.js";
import { admitOwnerIdentity, recordFinding } from "./verification.js";
import { escapeTargetKey } from "./escape-key.js";
import { summaryPositionExists } from "./verify-position.js";
import { verifyInitialization } from "./verify-initialization.js";
import type { Violation } from "../diag/contract.js";
import type { Signature } from "../ir-types/contract.js";
import type { EffectPaths, FactsSite, RelationalOwner, SummaryRule, VerifySummary } from "./contract.js";
import { compareNumbers, nodeOwnedBy, ownerKey, relationalUsage, validIndex, verifyRelationalArena } from "./verify-relations.js";
import { summaryBindingInputs } from "./binding-inputs.js";
import { verifyFactBindings } from "./verify-bindings.js";
import { verifyCells } from "./verify-cells.js";
import { acceptsProvided } from "./execution-entry.js";

interface CallbackFormals {
  readonly signatures: readonly Signature[];
  readonly byId: ReadonlyMap<number, Signature>;
  readonly slots: Map<number, boolean>;
}

export const verifySummary: VerifySummary = (summary, context, resources) => {
  const { account } = resources;
  const initial = chargeWork(account, 1) ?? chargeResultEntries(account, 3);
  if (initial !== null) return initial;
  const violations: Violation<SummaryRule, FactsSite>[] = [];
  const site: FactsSite = { kind: "summary", summary: summary.key };
  const owner: RelationalOwner = { kind: "summary", key: summary.key };
  const report = (rule: SummaryRule, text: string, at: FactsSite = site): DataflowStop | null =>
    recordFinding(account, violations, "last", rule, at, text);
  const identity = admitOwnerIdentity(owner, account);
  if (identity !== null) return identity;
  const definition = summaryDefinition(summary.key, context);
  if (definition === null || !context.definitionExists(definition)) {
    { const stop = report("definition-resolves", "A summary must name an existing declaration in the supplied inventory."); if (stop !== null) return stop; }
  }
  const signature = validIndex(summary.signature, context.types.signatures.length) ? context.types.signatures[summary.signature] : undefined;
  if (signature === undefined || !Object.is(signature.id, summary.signature)) {
    { const stop = report("signature-resolves", "A summary must name an existing declaration-instantiated signature."); if (stop !== null) return stop; }
  }
  if (signature !== undefined && signature.declaration !== null && signature.declaration !== definition) {
    { const stop = report("cross-owner-qualified", "The summary signature must retain its actual declaration owner."); if (stop !== null) return stop; }
  }
  const expectedSignature = summary.key.kind === "declared" ? context.signatureIdOf(summary.key.execution.request)
    : definition === null ? null : context.tirBody(summary.key.execution.instance).signature;
  if (signature !== undefined && (expectedSignature === null || !Object.is(expectedSignature, summary.signature))) {
    { const stop = report("signature-resolves", "The summary retains the signature of its exact selected execution request."); if (stop !== null) return stop; }
  }
  if (signature !== undefined) {
    const entry = acceptsProvided(signature, summary.key.execution.provided, account);
    if (entry.kind !== "complete") return entry;
    if (entry.value === false) {
      { const stop = report("summary-entry-exact", "The selected provided count is an admissible fixed-argument entry of this exact signature."); if (stop !== null) return stop; }
    }
  }
  const arena = verifyRelationalArena(summary.arena, owner, context, account);
  if (arena.kind !== "complete") return arena;
  const cells = verifyCells(summary.arena, owner, context, account);
  if (cells.kind !== "complete") return cells;
  for (const findings of [arena.violations, cells.violations]) for (const violation of findings) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    const rule: SummaryRule = violation.rule === "cross-owner-qualified" ||
      violation.rule === "relational-site-resolves" || violation.rule === "declared-site-ordinal" ? violation.rule : "summary-finite";
    const output = chargeResultEntries(account, 1);
    if (output !== null) return output;
    violations.push({ rule, site: violation.site, detail: violation.detail });
  }
  const capturedCount = context.captureCount(summary.key);
  if (capturedCount === null || !Number.isSafeInteger(capturedCount) || capturedCount < 0 || Object.is(capturedCount, -0) || summary.captures.length !== capturedCount) {
    { const stop = report("captures-total", "A summary retains every location in the actual declaration capture inventory."); if (stop !== null) return stop; }
  }
  const dependent = definition === null ? null : context.bindingDependentOf(definition);
  if (dependent === null || dependent !== summary.bindingDependent) {
    { const stop = report("summary-binding-dependence", "Summary dependence equals the supplied declaration's actual binding dependence."); if (stop !== null) return stop; }
  }
  const checkPaths = (paths: EffectPaths): DataflowStop | null => {
    let previous: number | null = null;
    for (const path of paths.paths) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
      if (!validIndex(path, summary.arena.projections.length) || !Object.is(summary.arena.projections[path]?.id, path) ||
        previous !== null && compareNumbers(previous, path) >= 0) {
        { const stop = report("summary-finite", "Effect paths are distinct ordered references into the summary's own finite arena."); if (stop !== null) return stop; }
      }
      previous = path;
    }
    if (paths.kind === "open") for (const boundary of paths.boundaries) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
      if (!validIndex(boundary, summary.arena.boundaries.length) || !Object.is(summary.arena.boundaries[boundary]?.id, boundary)) {
        { const stop = report("known-negative-distinct", "An unknown effect retains its real boundary rather than pretending to be no effect."); if (stop !== null) return stop; }
      }
    }
    return null;
  };
  const receiver = signature?.receiver !== null && signature?.receiver !== undefined;
  const formalExists = (index: number): boolean => signature !== undefined &&
    validIndex(index, signature.parameters.length) && signature.parameters[index] !== undefined;
  for (const producer of summary.arena.producers) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    if (producer.kind === "parameter" && !formalExists(producer.index) ||
      producer.kind === "capture" && (capturedCount === null || !validIndex(producer.index, capturedCount)) || producer.kind === "receiver" && !receiver) {
      { const stop = report("summary-finite", "A summary producer retains its actual formal, receiver or captured-location slot."); if (stop !== null) return stop; }
    }
  }
  if (signature !== undefined && summary.parameters.length !== signature.parameters.length + (receiver ? 1 : 0)) {
    { const stop = report("parameters-total", "Summary effects contain the actual receiver and every declared parameter exactly once."); if (stop !== null) return stop; }
  }
  for (const [index, effect] of summary.parameters.entries()) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    const position = index - (receiver ? 1 : 0);
    if (receiver && index === 0 ? effect.slot.kind !== "receiver"
      : effect.slot.kind !== "parameter" || effect.slot.index !== position || Object.is(effect.slot.index, -0)) {
      { const stop = report("parameters-order", "Parameter effects retain receiver-first and declaration parameter order."); if (stop !== null) return stop; }
    }
    const paths = checkPaths(effect.reads) ?? checkPaths(effect.writes);
    if (paths !== null) return paths;
  }
  for (const [index, effect] of summary.captures.entries()) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    if (effect.index !== index || !validIndex(effect.index, summary.captures.length)) { const stop = report("captures-order", "Capture effects retain the actual dense captured-location order."); if (stop !== null) return stop; }
    const paths = checkPaths(effect.reads) ?? checkPaths(effect.writes);
    if (paths !== null) return paths;
  }
  if (!validIndex(summary.result, summary.arena.origins.length) || !Object.is(summary.arena.origins[summary.result]?.id, summary.result)) {
    { const stop = report("result-origins-resolves", "Result origins resolve in this exact summary arena."); if (stop !== null) return stop; }
  }
  if (!validIndex(summary.thrown, summary.arena.origins.length) || !Object.is(summary.arena.origins[summary.thrown]?.id, summary.thrown)) {
    { const stop = report("thrown-origins-resolves", "Thrown origins resolve in this exact summary arena."); if (stop !== null) return stop; }
  }
  let previousWrite: readonly [number, number] | null = null;
  for (const write of summary.writes) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    if (!validIndex(write.target, summary.arena.cells.length) || !Object.is(summary.arena.cells[write.target]?.id, write.target) ||
      !validIndex(write.value, summary.arena.origins.length) || !Object.is(summary.arena.origins[write.value]?.id, write.value)) {
      { const stop = report("write-origins-resolves", "A summary write retains its actual logical cell and value origins in this arena."); if (stop !== null) return stop; }
    }
    if (previousWrite !== null && (compareNumbers(previousWrite[0], write.target) || compareNumbers(previousWrite[1], write.value)) >= 0) {
      { const stop = report("writes-order", "Summary writes are distinct and ordered by target cell and value origins."); if (stop !== null) return stop; }
    }
    previousWrite = [write.target, write.value];
  }
  let previousRetention: readonly [number, string, string] | null = null;
  for (const retention of summary.retention) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    if (!validIndex(retention.source, summary.arena.boundProducers.length) || !Object.is(summary.arena.boundProducers[retention.source]?.id, retention.source)) {
      { const stop = report("retention-source-resolves", "Every retained source is an actual bound value subject in this exact summary arena."); if (stop !== null) return stop; }
    }
    const target = retention.into;
    if (target.kind === "callback" || target.kind === "suspension") {
      if (target.at.kind === "node") {
        if (!context.nodeExists(target.at.node)) { const stop = report("relational-site-resolves", "A retention target retains its actual source occurrence."); if (stop !== null) return stop; }
        if (!nodeOwnedBy(owner, target.at.node, context)) { const stop = report("cross-owner-qualified", "A retention target retains its actual summary declaration owner."); if (stop !== null) return stop; }
      } else {
        if (!context.libraryExportExists(target.at.identity)) { const stop = report("relational-site-resolves", "A retention target retains its actual library export."); if (stop !== null) return stop; }
        const count = context.declaredSiteCount(target.at.identity);
        if (count === null || !validIndex(target.at.site, count)) { const stop = report("declared-site-ordinal", "A retention target retains its actual declared allocation ordinal."); if (stop !== null) return stop; }
      }
    }
    const path = target.kind === "shared" || target.kind === "parameter" || target.kind === "capture" || target.kind === "receiver" ? target.path : null;
    if (path !== null && (!validIndex(path, summary.arena.projections.length) || !Object.is(summary.arena.projections[path]?.id, path)) ||
      target.kind === "parameter" && !formalExists(target.index) ||
      target.kind === "capture" && (capturedCount === null || !validIndex(target.index, capturedCount)) ||
      target.kind === "receiver" && !receiver || target.kind === "shared" && !context.definitionExists(target.definition) ||
      target.kind === "external" && (!validIndex(target.boundary, summary.arena.boundaries.length) || !Object.is(summary.arena.boundaries[target.boundary]?.id, target.boundary))) {
      { const stop = report("cross-owner-qualified", "A retention target retains its actual declaration, formal, capture, path or boundary owner."); if (stop !== null) return stop; }
    }
    const position = summaryPositionExists(retention.at, summary.key, context, account);
    if (position.kind !== "complete") return position;
    if (!position.value) { const stop = report("relational-site-resolves", "Retention retains the actual selected execution position."); if (stop !== null) return stop; }
    const identity = escapeTargetKey(target, account);
    if (identity.kind !== "complete") return identity;
    const key = identity.value;
    const point = summaryPositionKey(retention.at);
    if (previousRetention !== null && (compareNumbers(previousRetention[0], retention.source) > 0 ||
      compareNumbers(previousRetention[0], retention.source) === 0 && (previousRetention[1] > point
        || previousRetention[1] === point && previousRetention[2] >= key))) {
      { const stop = report("retention-order", "Retention entries are distinct and ordered by bound source, exact execution position and complete target identity."); if (stop !== null) return stop; }
    }
    previousRetention = [retention.source, point, key];
  }
  const callbackFormals = new Map<number, CallbackFormals | null>();
  for (const callback of summary.callbacks) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    const reference = callback.subject;
    const identity = admitOwnerIdentity(reference.owner, account);
    if (identity !== null) return identity;
    const bound = validIndex(reference.producer, summary.arena.boundProducers.length)
      ? summary.arena.boundProducers[reference.producer] : undefined;
    const producer = bound === undefined ? undefined : summary.arena.producers[bound.producer];
    if (ownerKey(reference.owner) !== ownerKey(owner) || bound === undefined || producer === undefined
      || producer.kind !== "parameter" && producer.kind !== "receiver" && producer.kind !== "capture"
        && producer.kind !== "shared" && producer.kind !== "cell-content") {
      { const stop = report("callback-parameter-resolves", "A callback retains its actual arena-qualified given-value subject."); if (stop !== null) return stop; }
      continue;
    }
    let formals = callbackFormals.get(reference.producer);
    if (formals === undefined) {
      const signatures = context.callbackSignaturesOf(summary.key, reference.producer);
      let calls: Signature[] | null = null;
      const seen = new Set<number>();
      if (signatures !== null && signatures.length !== 0) {
        calls = [];
        for (const id of signatures) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
          const call = validIndex(id, context.types.signatures.length) ? context.types.signatures[id] : undefined;
          if (call === undefined || !Object.is(call.id, id) || seen.has(id)) { calls = null; break; }
          const growth = chargeResultEntries(account, 2);
          if (growth !== null) return growth;
          seen.add(id);
          calls.push(call);
        }
      }
      formals = null;
      if (calls !== null) {
        const growth = chargeResultEntries(account, 1);
        if (growth !== null) return growth;
        const byId = new Map<number, Signature>();
        for (const call of calls) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
          const stop = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
          if (stop !== null) return stop;
          byId.set(call.id, call);
        }
        formals = { signatures: calls, byId, slots: new Map<number, boolean>() };
      }
      const growth = chargeResultEntries(account, 1);
      if (growth !== null) return growth;
      callbackFormals.set(reference.producer, formals);
    }
    if (formals === null) {
      { const stop = report("callback-parameter-resolves", "A callback retains its actual checked callable-signature inventory."); if (stop !== null) return stop; }
      continue;
    }
    if (callback.kind === "known") {
      const signature = formals.byId.get(callback.signature);
      const value = validIndex(callback.context, summary.arena.contexts.length) ? summary.arena.contexts[callback.context] : undefined;
      if (signature === undefined || value === undefined || !Object.is(value.id, callback.context)) {
        { const stop = report("callback-input-resolves", "An actual callback application retains its selected signature and complete environment."); if (stop !== null) return stop; }
      } else {
        let fixed = 0;
        let minimum = 0;
        for (const parameter of signature.parameters) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
          if (parameter.kind === "rest") continue;
          fixed += 1;
          if (!parameter.acceptsOmission) minimum = fixed;
        }
        if (!Number.isSafeInteger(callback.provided) || Object.is(callback.provided, -0)
          || callback.provided < minimum || callback.provided > fixed
          || value.arguments.length !== signature.parameters.length
          || (value.receiver === null) !== (signature.receiver === null)) {
          { const stop = report("callback-input-resolves", "A callback retains its actual provided entry, receiver and parameter transport."); if (stop !== null) return stop; }
        }
      }
      for (const value of [callback.result, callback.thrown]) if (!validIndex(value, summary.arena.origins.length))
        { const stop = report("callback-input-resolves", "Callback result and thrown values remain in the actual source arena."); if (stop !== null) return stop; }
      if (callback.handle !== null) {
        const identity = admitOwnerIdentity(callback.handle.owner, account);
        if (identity !== null) return identity;
      }
      const position = summaryPositionExists(callback.at, summary.key, context, account);
      if (position.kind !== "complete") return position;
      if (!position.value) { const stop = report("relational-site-resolves", "A known callback retains its actual selected execution position."); if (stop !== null) return stop; }
      if (callback.handle !== null && (ownerKey(callback.handle.owner) !== ownerKey(owner)
        || !validIndex(callback.handle.producer, summary.arena.boundProducers.length)))
        { const stop = report("cross-owner-qualified", "A callback handle retains its actual qualified value subject."); if (stop !== null) return stop; }
      for (const row of callback.shared) {
        const step = chargeWork(account, 1);
        if (step !== null) return step;
        if (!validIndex(row.target, summary.arena.cells.length) || !validIndex(row.value, summary.arena.origins.length)) {
          const stop = report("write-origins-resolves", "Callback shared exchanges retain actual cells and value origins.");
          if (stop !== null) return stop;
        }
      }
      continue;
    }
    const boundaryIdentity = admitOwnerIdentity(callback.boundary.owner, account);
    if (boundaryIdentity !== null) return boundaryIdentity;
    if (ownerKey(callback.boundary.owner) !== ownerKey(owner)
      || !validIndex(callback.boundary.boundary, summary.arena.boundaries.length))
      { const stop = report("known-negative-distinct", "An ordinary unknown exchange retains its real qualified boundary."); if (stop !== null) return stop; }
    let sameSignatures = callback.signatures.length === formals.signatures.length;
    for (let index = 0; index < callback.signatures.length; index += 1) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
      const stop = chargeWork(account, 1);
      if (stop !== null) return stop;
      if (!Object.is(callback.signatures[index], formals.signatures[index]?.id)) sameSignatures = false;
    }
    if (!sameSignatures)
      { const stop = report("callback-parameter-resolves", "Unknown exchanges retain the complete actual callable-signature inventory."); if (stop !== null) return stop; }
    const constraint = callback.constraint;
    if (constraint === null) continue;
    if (producer.kind !== "parameter" || !Object.is(producer.index, constraint.parameterIndex))
      { const stop = report("callback-parameter-resolves", "An admitted callback constraint retains its actual original parameter subject."); if (stop !== null) return stop; }
    const callbackFormalExists = (index: number): { readonly kind: "complete"; readonly value: boolean } | DataflowStop => {
      const start = chargeWork(account, 1);
      if (start !== null) return start;
      if (Object.is(index, -0)) return { kind: "complete", value: false };
      const cached = formals.slots.get(index);
      if (cached !== undefined) return { kind: "complete", value: cached };
      let exists = true;
      for (const call of formals.signatures) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
        const stop = chargeWork(account, 1);
        if (stop !== null) return stop;
        if (!validIndex(index, call.parameters.length) || call.parameters[index] === undefined) exists = false;
      }
      const growth = chargeResultEntries(account, 1);
      if (growth !== null) return growth;
      formals.slots.set(index, exists);
      return { kind: "complete", value: exists };
    };
    for (const input of constraint.inputs) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
      const exists = callbackFormalExists(input.parameterIndex);
      if (exists.kind !== "complete") return exists;
      if (!exists.value || input.kind === "argument-element" && !formalExists(input.sourceParameterIndex)
        || input.kind !== "argument-element" && !receiver)
        { const stop = report("callback-input-resolves", "Admitted callback input constraints retain their actual source and destination formals."); if (stop !== null) return stop; }
    }
    if (constraint.rejection !== null) {
      const exists = callbackFormalExists(constraint.rejection);
      if (exists.kind !== "complete") return exists;
      if (!exists.value) { const stop = report("callback-input-resolves", "An admitted rejection channel names an actual callback formal."); if (stop !== null) return stop; }
    }
  }
  for (const writes of [summary.concurrentWrites, summary.contentsOnReturn, summary.contentsOnUnwind]) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    let previous: readonly [number, number] | null = null;
    for (const row of writes) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
      if (!validIndex(row.target, summary.arena.cells.length) || !validIndex(row.value, summary.arena.origins.length))
        { const stop = report("write-origins-resolves", "Every history and exit-content relation uses this same actual arena."); if (stop !== null) return stop; }
      if (previous !== null && (compareNumbers(previous[0], row.target) || compareNumbers(previous[1], row.value)) >= 0)
        { const stop = report("writes-order", "Each history and exit-content vector has one deterministic cell/value order."); if (stop !== null) return stop; }
      previous = [row.target, row.value];
    }
  }
  for (const row of summary.resultCells) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    if (!validIndex(row.value, summary.arena.origins.length) || !validIndex(row.cell, summary.arena.cells.length)
      || row.path !== null && !validIndex(row.path, summary.arena.projections.length)) {
      const stop = report("cross-owner-qualified", "A result-cell relation retains its actual value, cell and physical path.");
      if (stop !== null) return stop;
    }
  }
  for (const row of summary.backing) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    if (!validIndex(row.pointer, summary.arena.origins.length) || !validIndex(row.cell, summary.arena.cells.length))
      { const stop = report("cross-owner-qualified", "Backing obligations retain actual pointer origins and the same logical-cell domain."); if (stop !== null) return stop; }
    const position = summaryPositionExists(row.at, summary.key, context, account);
    if (position.kind !== "complete") return position;
    if (!position.value) { const stop = report("relational-site-resolves", "Backing retains its actual selected execution position."); if (stop !== null) return stop; }
    if (!context.nodeExists({ kind: "body", value: row.operation.at }))
      { const stop = report("relational-site-resolves", "A backing obligation retains the original selected operation occurrence."); if (stop !== null) return stop; }
  }
  const limits = context.limits;
  const measured = relationalUsage(summary.arena, account);
  if (measured.kind !== "complete") return measured;
  const usage = measured.value;
  if (usage.records > limits.maximumRelationalRecordsPerBody || usage.references > limits.maximumRelationalReferencesPerBody ||
    usage.depth > limits.maximumProjectionDepth || usage.alternatives > limits.maximumOriginAlternatives) {
    { const stop = report("summary-finite", "The published summary arena respects the actual producer's finite record, reference, path and alternative limits."); if (stop !== null) return stop; }
  }
  const bindings = verifyFactBindings(summaryBindingInputs(summary, context), { kind: "summary", summary: summary.key }, site, context, account);
  if (bindings.kind !== "complete") return bindings;
  for (const violation of bindings.violations) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    violations.push({ rule: violation.rule === "bindings-complete" ? "bindings-complete" : "summary-finite", site: violation.site, detail: violation.detail });
  }
  const initialization = verifyInitialization(summary, context, resources);
  if (initialization.kind !== "complete") return initialization;
  for (const violation of initialization.violations) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    const stop = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (stop !== null) return stop;
    violations.push(violation);
  }
  return { kind: "complete", violations };
};
