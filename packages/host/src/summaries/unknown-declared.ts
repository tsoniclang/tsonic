import { boundProducerId, openBoundaryId, originsId, producerId, valueContextId } from "../ids/index.js";
import type { DataflowAccount, DataflowResult, DataflowStop } from "../dataflow/contract.js";
import { chargeResultEntries, chargeWork } from "../dataflow/index.js";
import type { BoundProducer, CallbackExchange, EffectPaths, OpenBoundary, Origins, ParameterEffect, Producer, RelationalOwner, SummaryRetention, Summary, ValueArgument } from "../ir-facts/contract.js";
import type { InitializationPoint } from "../ir-facts/contract.js";
import type { DeclaredSummaryDeps, DeclaredSummaryInput } from "./contract.js";
import { declaredScopeBindings } from "./declared-work.js";

export function unknownDeclaredSummary(account: DataflowAccount, deps: DeclaredSummaryDeps,
  input: DeclaredSummaryInput & { readonly kind: "unknown" }): DataflowResult<Summary> {
  const setup = chargeWork(account, 4) ?? chargeResultEntries(account, 20);
  if (setup !== null) return setup;
  const bindings = declaredScopeBindings(account, input.execution.request, input.scope);
  if ("kind" in bindings) return bindings;
  const context = valueContextId(0);
  const producers: Producer[] = [{ id: producerId(0), kind: "shared", definition: input.execution.request.definition, path: null }];
  const boundProducers: BoundProducer[] = [{ id: boundProducerId(0), producer: producerId(0), bindings, context }];
  const boundary = openBoundaryId(0);
  const boundaries: OpenBoundary[] = [{ id: boundary, kind: "opaque-invocation",
    at: { kind: "node", node: deps.source }, subject: producerId(0), owner: null, bindings, context,
    detail: "No declared guarantee supplies knowledge beyond ordinary invocation." }];
  const origins: Origins[] = [{ id: originsId(0), kind: "open", producers: [], includesAbsence: true, boundaries: [boundary] }];
  const parameters: ParameterEffect[] = [];
  const retention: SummaryRetention[] = [];
  const argumentsOrigins: ValueArgument[] = [];
  const formals = new Map<string, ReturnType<typeof boundProducerId>>();
  let receiver = null;
  const formal = (kind: "receiver" | "parameter", index: number): ReturnType<typeof originsId> | DataflowStop => {
    const stop = chargeWork(account, 1) ?? chargeResultEntries(account, 20);
    if (stop !== null) return stop;
    const id = producerId(producers.length);
    const bound = boundProducerId(boundProducers.length);
    producers.push(kind === "receiver" ? { id, kind, path: null } : { id, kind, index, path: null });
    boundProducers.push({ id: bound, producer: id, bindings, context });
    formals.set(kind === "receiver" ? kind : `parameter:${index}`, bound);
    const origin = originsId(origins.length);
    origins.push({ id: origin, kind: "complete", producers: [bound], includesAbsence: false });
    const effects: EffectPaths = { kind: "open", paths: [], boundaries: [boundary] };
    parameters.push({ slot: kind === "receiver" ? { kind } : { kind, index }, reads: effects, writes: effects });
    retention.push({ source: bound, at: { kind: "declared", execution: input.execution, source: deps.source }, into: { kind: "external", boundary } });
    return origin;
  };
  if (deps.signature.receiver !== null) {
    const row = formal("receiver", 0);
    if (typeof row !== "number") return row;
    receiver = row;
  }
  for (let index = 0; index < deps.parameters.length; index += 1) {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const mapping = deps.parameters[index];
    if (mapping === undefined) throw new TypeError("The admitted declared parameter inventory is dense");
    if (mapping.kind === "argument" || mapping.kind === "rest") {
      const origin = formal("parameter", mapping.parameter);
      if (typeof origin !== "number") return origin;
      const keep = chargeResultEntries(account, 2);
      if (keep !== null) return keep;
      argumentsOrigins.push({ kind: "provided", origins: origin });
      continue;
    }
    const keep = chargeResultEntries(account, 10);
    if (keep !== null) return keep;
    const effects: EffectPaths = { kind: "complete", paths: [] };
    producers.push({ id: producerId(producers.length), kind: "parameter", index: mapping.parameter, path: null });
    parameters.push({ slot: { kind: "parameter", index: mapping.parameter }, reads: effects, writes: effects });
    argumentsOrigins.push({ kind: "omitted" });
  }
  const callbacks: CallbackExchange[] = [];
  const seen = new Set<string>();
  const owner: RelationalOwner = { kind: "summary", key: { kind: "declared", execution: input.execution } };
  const points: InitializationPoint[] = [];
  for (let index = 0; index < deps.callables.length; index += 1) {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const callable = deps.callables[index];
    if (callable === undefined) throw new TypeError("The checked given-callable inventory is dense");
    if (callable.slot.kind === "parameter" && argumentsOrigins[callable.slot.index]?.kind === "omitted") continue;
    const key = callable.slot.kind === "receiver" ? "receiver" : `parameter:${callable.slot.index}`;
    const subject = formals.get(key);
    if (subject === undefined || seen.has(key) || callable.signatures.length === 0)
      throw new TypeError("Ordinary invocation retains the actual distinct checked given-callable inventory");
    const keep = chargeResultEntries(account, 8);
    if (keep !== null) return keep;
    seen.add(key);
    const reference = { owner, producer: subject };
    callbacks.push({ kind: "unknown", subject: reference, boundary: { owner, boundary },
      signatures: callable.signatures, constraint: null, invocationOnly: false });
    points.push({ kind: "before", at: { kind: "declared", execution: input.execution, source: deps.source }, subject: reference });
  }
  const completion = chargeWork(account, points.length + 2) ?? chargeResultEntries(account, 34 + 2 * points.length);
  if (completion !== null) return completion;
  points.push({ kind: "return" }, { kind: "unwind" });
  return { kind: "complete", value: { key: { kind: "declared", execution: input.execution }, signature: deps.signature.id,
    arena: { cells: [], projections: [], producers, boundProducers, origins, boundaries,
      contexts: [{ id: context, receiver, arguments: argumentsOrigins, captures: [] }] },
    parameters, captures: [], result: originsId(0), thrown: originsId(0), writes: [], retention,
    callbacks, resultCells: [], backing: [], suspends: input.suspends, bindingDependent: input.bindingDependent,
    concurrentWrites: [], contentsOnReturn: [], contentsOnUnwind: [], returns: true, unwinds: true,
    initialization: { cells: [], events: [], conditions: [{ alternatives: [] }, { alternatives: [[]] }],
      points, rows: points.map((_point, point) => ({ point, cell: null, condition: 0 })) } } };
}
