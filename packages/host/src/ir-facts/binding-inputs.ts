import type { DefId, NodeId } from "../ids/contract.js";
import type { ArtifactBindings, BindingVector } from "../ir-types/contract.js";
import type { MemberSelection, ResolvedCallee } from "../ir-tir/contract.js";
import type { BodyFacts, BodyObservations, FactsSite, FactsVerificationContext, MetadataRecord,
  ObservationVerificationContext, RelationalArena, RelationalOwner, Summary } from "./contract.js";
import type { SummaryPosition } from "./initialization-data.js";
import { summaryBindings, summaryDefinition } from "./summary-key.js";
import { ownerSite } from "./verify-relations.js";

export interface FactBindingInput {
  readonly vector: BindingVector;
  readonly definition: DefId | null;
  readonly site: FactsSite;
}

export type BindingVisit = FactBindingInput | null;

function* appendArtifactBindings(artifact: ArtifactBindings, definition: DefId, site: FactsSite): Generator<BindingVisit, void> {
  yield null;
  if (artifact.kind === "instantiated") yield { vector: artifact.bindings, definition, site };
}

function* appendOwnerBindings(owner: RelationalOwner, site: FactsSite, context: FactsVerificationContext): Generator<BindingVisit, void> {
  yield null;
  if (owner.kind === "summary") {
    const definition = summaryDefinition(owner.key, context);
    if (definition !== null) yield* appendArtifactBindings(summaryBindings(owner.key), definition, site);
  } else yield* appendArtifactBindings(owner.execution.instance.bindings, context.tirBody(owner.execution.instance).owner, site);
}

function* appendCalleeBindings(callee: ResolvedCallee, site: FactsSite, context: FactsVerificationContext): Generator<BindingVisit, void> {
  yield null;
  yield { vector: callee.decision.bindings, definition: callee.decision.advertised.declaration, site };
  yield { vector: callee.decision.implementationBindings, definition: callee.decision.api.declaration, site };
  if (callee.activation !== null && callee.activation.bindings.kind === "instantiated")
    yield* appendArtifactBindings(callee.activation.bindings, context.tirBody(callee.activation).owner, site);
}

function* appendMemberBindings(member: MemberSelection, site: FactsSite, context: FactsVerificationContext): Generator<BindingVisit, void> {
  yield null;
  yield { vector: member.decision.bindings, definition: member.decision.primary, site };
  if (member.getter !== null) yield* appendCalleeBindings(member.getter, site, context);
  if (member.setter !== null) yield* appendCalleeBindings(member.setter, site, context);
}

function* appendArenaBindings(arena: RelationalArena, owner: RelationalOwner,
  context: FactsVerificationContext): Generator<BindingVisit, void> {
  yield null;
  const definition = owner.kind === "summary" ? summaryDefinition(owner.key, context) : context.bodyOwner(owner.execution.instance.body);
  for (const cell of arena.cells) {
    yield null;
    if (cell === undefined) continue;
    const site: FactsSite = { kind: "cell", owner, cell: cell.id };
    const role = cell.role;
    const stable = role.kind === "created" ? role.anchor : role;
    if (stable.kind === "static") yield* appendArtifactBindings(stable.declaration.bindings, stable.declaration.definition, site);
    if (role.kind === "created" && role.slot.kind === "field")
      yield { vector: role.slot.member.bindings, definition: role.slot.member.primary, site };
    if (cell.occurrence.kind !== "declared") yield* appendArtifactBindings(cell.occurrence.execution.instance.bindings,
      context.tirBody(cell.occurrence.execution.instance).owner, site);
    for (const marker of cell.lifetimes) {
      yield null;
      yield* appendArtifactBindings(marker.execution.instance.bindings, context.tirBody(marker.execution.instance).owner, site);
    }
  }
  for (const path of arena.projections) {
    yield null;
    if (path.projection.kind === "field" || path.projection.kind === "method-value")
      yield* appendMemberBindings(path.projection.member, { kind: "projection", owner, projection: path.id }, context);
  }
  for (const bound of arena.boundProducers) {
    yield null;
    const producer = arena.producers[bound.producer];
    const actual = producer === undefined ? null : producer.kind === "shared" ? producer.definition
      : producer.kind === "call-result" ? producer.callee.kind === "direct" ? producer.callee.definition : null
        : producer.kind === "allocation" && producer.at.kind === "declared" ? null : definition;
    yield { vector: bound.bindings, definition: actual, site: { kind: "bound-producer", owner, producer: bound.id } };
  }
  for (const boundary of arena.boundaries) {
    yield null;
    yield { vector: boundary.bindings, definition, site: { kind: "boundary", owner, boundary: boundary.id } };
  }
}

export function* factBindingInputs(facts: BodyFacts, context: FactsVerificationContext): Generator<BindingVisit, void> {
  yield null;
  const owner: RelationalOwner = { kind: "body", execution: facts.execution };
  yield* appendArtifactBindings(facts.execution.instance.bindings, context.tirBody(facts.execution.instance).owner, ownerSite(owner));
  yield* appendArenaBindings(facts.arena, owner, context);
  const site = (node: NodeId): FactsSite => ({ kind: "node", at: { kind: "body", value: { body: facts.execution.instance.body, node } } });
  for (const invocation of facts.origins.invocations) {
    yield null;
    for (const alternative of invocation.alternatives) {
      yield null;
      const at = site(invocation.node);
      yield* appendCalleeBindings(alternative.resolution, at, context);
      for (const argument of alternative.arguments) {
        yield null;
        yield* appendOwnerBindings(argument.formal.owner, at, context);
      }
      yield* appendOwnerBindings({ kind: "summary", key: alternative.summary }, at, context);
    }
  }
  for (const callback of facts.origins.callbacks) {
    yield null;
    yield* appendOwnerBindings(callback.argument.formal.owner, site(callback.node), context);
  }
  for (const activation of facts.origins.activations) {
    yield null;
    if (activation.activation.bindings.kind === "instantiated") yield { vector: activation.activation.bindings.bindings,
      definition: context.bodyOwner(activation.activation.body), site: site(activation.node) };
    if (activation.entry !== null) yield* appendOwnerBindings(activation.entry.formal.owner, site(activation.node), context);
  }
  for (const construction of facts.origins.constructions) {
    yield null;
    if (construction.body !== null && construction.body.bindings.kind === "instantiated")
      yield* appendArtifactBindings(construction.body.bindings, context.tirBody(construction.body).owner, site(construction.node));
  }
  for (const raw of facts.rawLocations) {
    yield null;
    const at = site(raw.node); yield* appendArtifactBindings(raw.layout.metadata.bindings, raw.layout.metadata.definition, at);
    yield { vector: raw.bindings, definition: raw.layout.metadata.definition, site: at };
  }
  for (const field of facts.fieldBindings) {
    yield null;
    const at = site(field.node); yield* appendArtifactBindings(field.field.metadata.bindings, field.field.metadata.definition, at);
    yield { vector: field.bindings, definition: field.field.metadata.definition, site: at };
  }
  for (const record of facts.recordBindings) {
    yield null;
    const at = site(record.node); yield* appendArtifactBindings(record.layout.metadata.bindings, record.layout.metadata.definition, at);
    yield { vector: record.bindings, definition: record.layout.metadata.definition, site: at };
  }
  for (const array of facts.closedArrays) {
    yield null;
    if (array.kind === "closed") for (const member of array.elements) {
      yield null;
      yield* appendMemberBindings(member, site(array.node), context);
    }
  }
}

function* positionBindingInputs(at: SummaryPosition, root: FactsSite, context: FactsVerificationContext): Generator<BindingVisit, void> {
  yield* appendOwnerBindings(at.kind === "body" ? { kind: "body", execution: at.execution }
    : { kind: "summary", key: { kind: "declared", execution: at.execution } }, root, context);
}

export function* summaryBindingInputs(summary: Summary, context: FactsVerificationContext): Generator<BindingVisit, void> {
  yield null;
  const owner: RelationalOwner = { kind: "summary", key: summary.key };
  yield* appendOwnerBindings(owner, ownerSite(owner), context);
  yield* appendArenaBindings(summary.arena, owner, context);
  const root = ownerSite(owner);
  for (const row of summary.retention) {
    yield null;
    yield* positionBindingInputs(row.at, root, context);
  }
  for (const event of summary.initialization.events) {
    yield null;
    yield* appendOwnerBindings(event.subject.owner, root, context);
  }
  for (const point of summary.initialization.points) {
    yield null;
    if (point.kind === "need" || point.kind === "before") yield* positionBindingInputs(point.at, root, context);
    if (point.kind === "before") yield* appendOwnerBindings(point.subject.owner, root, context);
    if (point.kind === "completed") yield* appendOwnerBindings(point.handle.owner, root, context);
    if (point.kind === "need") for (const via of point.witness.via) {
      yield null;
      yield* appendOwnerBindings({ kind: "summary", key: via.key }, root, context);
    }
  }
  for (const callback of summary.callbacks) {
    yield null;
    yield* appendOwnerBindings(callback.subject.owner, root, context);
    if (callback.kind === "unknown") yield* appendOwnerBindings(callback.boundary.owner, root, context);
    else {
      yield* positionBindingInputs(callback.at, root, context);
      if (callback.handle !== null) yield* appendOwnerBindings(callback.handle.owner, root, context);
    }
  }
  for (const backing of summary.backing) {
    yield null;
    yield* positionBindingInputs(backing.at, root, context);
    if (backing.use.kind === "argument") yield* appendOwnerBindings({ kind: "summary", key: backing.use.callee }, root, context);
  }
}

export function* observationBindingInputs(value: BodyObservations, context: ObservationVerificationContext): Generator<BindingVisit, void> {
  yield null;
  const root: FactsSite = { kind: "body", instance: value.instance };
  const definition = context.bodyOwner(value.instance.body);
  if (definition !== null) yield* appendArtifactBindings(value.instance.bindings, definition, root);
  for (const row of value.rows) {
    yield null;
    const site: FactsSite = { kind: "node", at: { kind: "body", value: { body: value.instance.body, node: row.node } } };
    yield* appendArtifactBindings(row.layout.metadata.bindings, row.layout.metadata.definition, site);
    if (row.field !== null) yield* appendArtifactBindings(row.field.metadata.bindings, row.field.metadata.definition, site);
    yield { vector: row.bindings, definition: null, site };
  }
}

export function* metadataBindingInputs(metadata: MetadataRecord): Generator<BindingVisit, void> {
  yield null;
  const site: FactsSite = { kind: "metadata", metadata: metadata.key };
  yield* appendArtifactBindings(metadata.key.bindings, metadata.key.definition, site);
  if (metadata.kind !== "data-layout") for (const field of metadata.fields) {
    yield null;
    yield { vector: field.member.bindings, definition: field.member.primary, site };
  }
}
