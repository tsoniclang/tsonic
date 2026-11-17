import { boundProducerId, openBoundaryId, originsId, producerId, valueContextId } from "../ids/index.js";
import { rigidBindings } from "../ir-types/index.js";
import type { BoundProducer, CallbackExchange, EffectPaths, OpenBoundary, Origins, ParameterEffect, Producer, RelationalOwner, SummaryRetention, Summary } from "../ir-facts/contract.js";
import type { InitializationPoint } from "../ir-facts/contract.js";
import type { DeclaredSummaryDeps, DeclaredSummaryInput } from "./contract.js";

export function unknownDeclaredSummary(deps: DeclaredSummaryDeps, input: DeclaredSummaryInput & { readonly kind: "unknown" }): Summary {
  const bindings = input.execution.request.bindings.kind === "instantiated" ? input.execution.request.bindings.bindings : rigidBindings(input.scope);
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
  const argumentsOrigins = [];
  const formals = new Map<string, ReturnType<typeof boundProducerId>>();
  let receiver = null;
  const formal = (kind: "receiver" | "parameter", index: number): ReturnType<typeof originsId> => {
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
  if (deps.signature.receiver !== null) receiver = formal("receiver", 0);
  for (let position = 0; position < deps.signature.parameters.length; position += 1) argumentsOrigins.push(formal("parameter", position));
  const callbacks: CallbackExchange[] = [];
  const seen = new Set<string>();
  const owner: RelationalOwner = { kind: "summary", key: { kind: "declared", execution: input.execution } };
  for (const callable of deps.callables) {
    const key = callable.slot.kind === "receiver" ? "receiver" : `parameter:${callable.slot.index}`;
    const subject = formals.get(key);
    if (subject === undefined || seen.has(key) || callable.signatures.length === 0)
      throw new TypeError("Ordinary invocation retains the actual distinct checked given-callable inventory");
    seen.add(key);
    callbacks.push({ kind: "unknown", subject: { owner, producer: subject }, boundary: { owner, boundary },
      signatures: callable.signatures, constraint: null, invocationOnly: false });
  }
  const points: InitializationPoint[] = callbacks.map(callback => ({ kind: "before",
    at: { kind: "declared", execution: input.execution, source: deps.source }, subject: callback.subject }));
  points.push({ kind: "return" }, { kind: "unwind" });
  return { key: { kind: "declared", execution: input.execution }, signature: deps.signature.id,
    arena: { cells: [], projections: [], producers, boundProducers, origins, boundaries,
      contexts: [{ id: context, receiver, arguments: argumentsOrigins, captures: [] }] },
    parameters, captures: [], result: originsId(0), thrown: originsId(0), writes: [], retention,
    callbacks, resultCells: [], backing: [], suspends: input.suspends, bindingDependent: input.bindingDependent,
    concurrentWrites: [], contentsOnReturn: [], contentsOnUnwind: [], returns: true, unwinds: true,
    initialization: { cells: [], events: [], conditions: [{ alternatives: [] }, { alternatives: [[]] }],
      points, rows: points.map((_point, point) => ({ point, cell: null, condition: 0 })) } };
}
