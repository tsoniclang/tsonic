import type { MessageArgument, Violation } from "../diag/contract.js";
import type { DefId, KeyData, NodeId, NodeRef } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type { HirCallableEndpoint } from "../ir-hir/contract.js";
import type { MemberSelection, ResolvedCallee } from "../ir-tir/contract.js";
import { memberSelectionKey } from "../ir-tir/index.js";
import type {
  ArtifactBindings, BindingVector, BindingVerificationInput, BodyInstance, MemberKey, MemberStorageSelection, TypeBinding,
} from "../ir-types/contract.js";
import { verifyTypes } from "../ir-types/index.js";
import type {
  BindingVerificationContext, BodyFacts, BodyObservations, EscapeTarget, FactsBindingTarget, FactsRule, FactsSite, FactsVerificationContext, MetadataRecord, MetadataVerificationContext, ObservationVerificationContext,
  RelationalArena, RelationalOwner, RelationalSite, Summary,
} from "./contract.js";

export const validIndex = (index: number, length: number): boolean =>
  Number.isSafeInteger(index) && index >= 0 && index < length && !Object.is(index, -0);

export const compareNumbers = (left: number, right: number): number => {
  if (Object.is(left, right)) return 0;
  if (Number.isNaN(left)) return 1;
  if (Number.isNaN(right)) return -1;
  if (left === right) return Object.is(left, -0) ? -1 : 1;
  return left < right ? -1 : 1;
};

export const relationalUsage = (arena: RelationalArena): {
  readonly records: number; readonly references: number; readonly depth: number; readonly alternatives: number;
} => {
  const depths: number[] = [];
  let references = 0; let depth = 0; let alternatives = 0;
  for (const path of arena.projections) {
    const parent = path.parent === null ? 0 : depths[path.parent];
    const current = parent === undefined ? 0 : parent + 1;
    depths.push(current);
    if (current > depth) depth = current;
    if (path.parent !== null) references += 1;
  }
  for (const producer of arena.producers) if (producer.path !== null) references += 1;
  for (const value of arena.contexts) references += (value.receiver === null ? 0 : 1) + value.arguments.length + value.captures.length;
  for (const origins of arena.origins) {
    if (origins.producers.length > alternatives) alternatives = origins.producers.length;
    references += origins.producers.length + (origins.kind === "open" ? origins.boundaries.length : 0);
  }
  for (const boundary of arena.boundaries) references += 2 + (boundary.owner === null ? 0 : 1);
  references += arena.boundProducers.length * 2;
  return { records: arena.projections.length + arena.producers.length + arena.contexts.length +
    arena.boundProducers.length + arena.origins.length + arena.boundaries.length, references, depth, alternatives };
};

const typeBindingData = (binding: TypeBinding): KeyData => binding.kind === "bound"
  ? [binding.kind, binding.parameter.owner, binding.parameter.index, binding.type]
  : [binding.kind, binding.parameter.owner, binding.parameter.index];

export const bindingsData = (bindings: BindingVector): KeyData => [
  bindings.classBindings.map(typeBindingData),
  bindings.methodBindings.map(typeBindingData),
  bindings.capturedBindings.map(typeBindingData),
  bindings.selfBindings.map(binding => binding.kind === "bound"
    ? [binding.kind, binding.owner, binding.type] : [binding.kind, binding.owner]),
];

export const artifactData = (bindings: ArtifactBindings): KeyData =>
  bindings.kind === "parametric" ? [bindings.kind] : [bindings.kind, bindingsData(bindings.bindings)];

export const sameBindings = (left: ArtifactBindings, right: ArtifactBindings): boolean =>
  encodeKey(artifactData(left)) === encodeKey(artifactData(right));


export const instanceKey = (instance: BodyInstance): string => encodeKey([instance.body, artifactData(instance.bindings)]);

export const ownerKey = (owner: RelationalOwner): string => owner.kind === "body"
  ? encodeKey([owner.kind, owner.instance.body, artifactData(owner.instance.bindings)])
  : encodeKey([owner.kind, owner.definition, artifactData(owner.bindings)]);

export const relationalSiteData = (site: RelationalSite): KeyData => site.kind === "node"
  ? [site.kind, site.node.body, site.node.node]
  : [site.kind, site.identity.module.providerId, site.identity.module.providerVersion, site.identity.module.packageName,
    site.identity.module.moduleSpecifier, site.identity.module.providerModuleId,
    site.identity.exportId, site.identity.memberId, site.identity.signatureId, site.site];

export const escapeData = (target: EscapeTarget): KeyData => {
  switch (target.kind) {
    case "return": case "throw": return [target.kind];
    case "receiver": return [target.kind, target.path];
    case "parameter": case "capture": return [target.kind, target.index, target.path];
    case "shared": return [target.kind, target.definition, target.path];
    case "callback": case "suspension": return [target.kind, relationalSiteData(target.at)];
    case "external": return [target.kind, target.boundary];
  }
};

export const relationalSite = (owner: RelationalOwner, at: RelationalSite): FactsSite => at.kind === "node"
  ? { kind: "node", at: { kind: "body", value: at.node } } : { kind: "declared-site", owner, identity: at.identity, site: at.site };

export const ownerSite = (owner: RelationalOwner): FactsSite => owner.kind === "body"
  ? { kind: "body", instance: owner.instance }
  : { kind: "summary", summary: { definition: owner.definition, bindings: owner.bindings } };

export const nodeOwnedBy = (owner: RelationalOwner, node: NodeRef, context: FactsVerificationContext): boolean => {
  if (owner.kind === "body") return node.body === owner.instance.body;
  return context.bodyOwner(node.body) === owner.definition;
};

export interface FactBindingInput {
  readonly vector: BindingVector;
  readonly definition: DefId | null;
  readonly site: FactsSite;
}

const appendArtifactBindings = (
  artifact: ArtifactBindings, definition: DefId, site: FactsSite, entries: FactBindingInput[],
): void => {
  if (artifact.kind === "instantiated") entries.push({ vector: artifact.bindings, definition, site });
};

const appendOwnerBindings = (
  owner: RelationalOwner, site: FactsSite, context: FactsVerificationContext, entries: FactBindingInput[],
): void => {
  if (owner.kind === "summary") appendArtifactBindings(owner.bindings, owner.definition, site, entries);
  else if (owner.instance.bindings.kind === "instantiated") {
    appendArtifactBindings(owner.instance.bindings, context.tirBody(owner.instance).owner, site, entries);
  }
};

const appendCalleeBindings = (
  callee: ResolvedCallee, site: FactsSite, context: FactsVerificationContext, entries: FactBindingInput[],
): void => {
  entries.push({ vector: callee.decision.bindings, definition: callee.decision.advertised.declaration, site });
  entries.push({ vector: callee.decision.implementationBindings, definition: callee.decision.api.declaration, site });
  if (callee.activation !== null && callee.activation.bindings.kind === "instantiated") {
    appendArtifactBindings(callee.activation.bindings, context.tirBody(callee.activation).owner, site, entries);
  }
};

const appendMemberBindings = (
  member: MemberSelection, site: FactsSite, context: FactsVerificationContext, entries: FactBindingInput[],
): void => {
  entries.push({ vector: member.decision.bindings, definition: member.decision.primary, site });
  if (member.getter !== null) appendCalleeBindings(member.getter, site, context, entries);
  if (member.setter !== null) appendCalleeBindings(member.setter, site, context, entries);
};

const appendArenaBindings = (
  arena: RelationalArena, owner: RelationalOwner, context: FactsVerificationContext, entries: FactBindingInput[],
): void => {
  const definition = owner.kind === "summary" ? owner.definition : context.tirBody(owner.instance).owner;
  for (const path of arena.projections) if (path.projection.kind === "field" || path.projection.kind === "method-value") {
    appendMemberBindings(path.projection.member, { kind: "projection", owner, projection: path.id }, context, entries);
  }
  for (const bound of arena.boundProducers) {
    const producer = arena.producers[bound.producer];
    const actual = producer === undefined ? null : producer.kind === "shared" ? producer.definition
      : producer.kind === "call-result" ? producer.callee.kind === "direct" ? producer.callee.definition : null
        : producer.kind === "allocation" && producer.at.kind === "declared" ? null : definition;
    entries.push({ vector: bound.bindings, definition: actual, site: { kind: "bound-producer", owner, producer: bound.id } });
  }
  for (const boundary of arena.boundaries) {
    entries.push({ vector: boundary.bindings, definition, site: { kind: "boundary", owner, boundary: boundary.id } });
  }
};

export const factBindingInputs = (facts: BodyFacts, context: FactsVerificationContext): readonly FactBindingInput[] => {
  const entries: FactBindingInput[] = [];
  const owner: RelationalOwner = { kind: "body", instance: facts.instance };
  appendArtifactBindings(facts.instance.bindings, context.tirBody(facts.instance).owner, ownerSite(owner), entries);
  appendArenaBindings(facts.arena, owner, context, entries);
  const site = (node: NodeId): FactsSite => ({ kind: "node", at: { kind: "body", value: { body: facts.instance.body, node } } });
  for (const invocation of facts.origins.invocations) for (const alternative of invocation.alternatives) {
    const at = site(invocation.node);
    appendCalleeBindings(alternative.resolution, at, context, entries);
    for (const argument of alternative.arguments) appendOwnerBindings(argument.formal.owner, at, context, entries);
    appendArtifactBindings(alternative.summary.bindings, alternative.summary.definition, at, entries);
  }
  for (const callback of facts.origins.callbacks) appendOwnerBindings(callback.argument.formal.owner, site(callback.node), context, entries);
  for (const activation of facts.origins.activations) {
    if (activation.activation.bindings.kind === "instantiated") entries.push({ vector: activation.activation.bindings.bindings,
      definition: context.bodyOwner(activation.activation.body), site: site(activation.node) });
    if (activation.entry !== null) appendOwnerBindings(activation.entry.formal.owner, site(activation.node), context, entries);
  }
  for (const construction of facts.origins.constructions) if (construction.body !== null && construction.body.bindings.kind === "instantiated") {
    appendArtifactBindings(construction.body.bindings, context.tirBody(construction.body).owner, site(construction.node), entries);
  }
  for (const raw of facts.rawLocations) {
    const at = site(raw.node); appendArtifactBindings(raw.layout.metadata.bindings, raw.layout.metadata.definition, at, entries);
    entries.push({ vector: raw.bindings, definition: raw.layout.metadata.definition, site: at });
  }
  for (const field of facts.fieldBindings) {
    const at = site(field.node); appendArtifactBindings(field.field.metadata.bindings, field.field.metadata.definition, at, entries);
    entries.push({ vector: field.bindings, definition: field.field.metadata.definition, site: at });
  }
  for (const record of facts.recordBindings) {
    const at = site(record.node); appendArtifactBindings(record.layout.metadata.bindings, record.layout.metadata.definition, at, entries);
    entries.push({ vector: record.bindings, definition: record.layout.metadata.definition, site: at });
  }
  for (const array of facts.closedArrays) if (array.kind === "closed") {
    for (const member of array.elements) appendMemberBindings(member, site(array.node), context, entries);
  }
  return entries;
};

export const summaryBindingInputs = (summary: Summary, context: FactsVerificationContext): readonly FactBindingInput[] => {
  const entries: FactBindingInput[] = [];
  const owner: RelationalOwner = { kind: "summary", definition: summary.key.definition, bindings: summary.key.bindings };
  appendArtifactBindings(summary.key.bindings, summary.key.definition, ownerSite(owner), entries);
  appendArenaBindings(summary.arena, owner, context, entries);
  return entries;
};

export const observationBindingInputs = (value: BodyObservations, context: ObservationVerificationContext): readonly FactBindingInput[] => {
  const entries: FactBindingInput[] = [];
  const root: FactsSite = { kind: "body", instance: value.instance };
  const definition = context.bodyOwner(value.instance.body);
  if (definition !== null) appendArtifactBindings(value.instance.bindings, definition, root, entries);
  for (const row of value.rows) {
    const site: FactsSite = { kind: "node", at: { kind: "body", value: { body: value.instance.body, node: row.node } } };
    appendArtifactBindings(row.layout.metadata.bindings, row.layout.metadata.definition, site, entries);
    if (row.field !== null) appendArtifactBindings(row.field.metadata.bindings, row.field.metadata.definition, site, entries);
    entries.push({ vector: row.bindings, definition: null, site });
  }
  return entries;
};

export const metadataBindingInputs = (metadata: MetadataRecord): readonly FactBindingInput[] => {
  const entries: FactBindingInput[] = [];
  const site: FactsSite = { kind: "metadata", metadata: metadata.key };
  appendArtifactBindings(metadata.key.bindings, metadata.key.definition, site, entries);
  if (metadata.kind !== "data-layout") for (const field of metadata.fields) {
    entries.push({ vector: field.member.bindings, definition: field.member.primary, site });
  }
  return entries;
};

export const collectStorageChecks = (
  member: MemberStorageSelection, site: FactsSite, context: MetadataVerificationContext, violations: Violation<FactsRule, FactsSite>[],
): void => {
  const report = (rule: FactsRule, text: string): void => { violations.push({ rule, site, detail: [{ kind: "text", value: text }] }); };
  const key = (value: MemberKey): void => {
    if (value.kind === "symbol" && !context.definitionExists(value.declaration)) {
      report("producer-resolves", "A selected member symbol key retains its actual declaration.");
    }
  };
  key(member.key);
  for (const origin of member.origins) {
    switch (origin.kind) {
      case "declared":
        if (!context.definitionExists(origin.declaration)) report("producer-resolves", "A selected member origin retains its actual declaration.");
        break;
      case "class-prototype":
        if (!context.definitionExists(origin.owner)) report("producer-resolves", "A selected member origin retains its actual declaration.");
        break;
      case "mapped":
        if (!context.nodeExists(origin.owner)) report("node-resolves", "A selected member origin retains its actual qualified source occurrence.");
        key(origin.key);
        break;
    }
  }
};

export const collectSelectionChecks = (
  selection: MemberSelection, site: FactsSite, context: FactsVerificationContext, violations: Violation<FactsRule, FactsSite>[],
): void => {
  const report = (rule: FactsRule, text: string): void => { violations.push({ rule, site, detail: [{ kind: "text", value: text }] }); };
  const type = (id: number | null): void => {
    if (id !== null && (!validIndex(id, context.types.terms.length) || context.types.terms[id] === undefined)) {
      report("type-resolves", "A selected member type resolves in the actual supplied type table.");
    }
  };
  const endpoint = (value: HirCallableEndpoint | null): void => {
    if (value === null) return;
    if (!context.definitionExists(value.declaration)) report("producer-resolves", "A selected member endpoint retains its actual declaration.");
    if (!validIndex(value.signature, context.types.signatures.length) || !Object.is(context.types.signatures[value.signature]?.id, value.signature)) {
      report("signature-resolves", "A selected member endpoint resolves in the actual supplied signature table.");
    }
  };
  const member = selection.decision;
  collectStorageChecks(member, site, context, violations);
  type(member.read); type(member.write); endpoint(member.getter); endpoint(member.setter);
  for (const selected of member.selectedDeclarations) if (!context.definitionExists(selected)) {
    report("producer-resolves", "A selected member retains its actual selected declaration group.");
  }
  for (const callee of [selection.getter, selection.setter]) {
    if (callee === null) continue;
    const decision = callee.decision;
    endpoint(decision.advertised); endpoint(decision.api);
    if (!validIndex(decision.completion.signature, context.types.signatures.length) ||
      !Object.is(context.types.signatures[decision.completion.signature]?.id, decision.completion.signature)) {
      report("signature-resolves", "A selected member completion retains its actual signature.");
    }
    type(decision.result); type(decision.completion.completion); type(decision.completion.yielded); type(decision.completion.sent);
    if (callee.activation !== null) for (const row of context.tirBody(callee.activation).captures) if (row === undefined || !context.localExists(row.local)) {
      report("capture-locations-exact", "A selected accessor retains its actual captured storage locations.");
    }
    for (const parameter of decision.parameters) if (parameter.kind === "omitted") type(parameter.type);
  }
};

export const verifyFactBindings = (
  entries: readonly FactBindingInput[],
  target: FactsBindingTarget,
  root: FactsSite,
  context: BindingVerificationContext,
): readonly Violation<FactsRule, FactsSite>[] => {
  const inputs: BindingVerificationInput[] = [];
  const checks: { readonly site: FactsSite; readonly first: number; readonly end: number }[] = [];
  const violations: Violation<FactsRule, FactsSite>[] = [];
  const scopes = context.bindingScopesOf(target);
  if (scopes === null) violations.push({ rule: "bindings-complete", site: root,
    detail: [{ kind: "text", value: "The complete binding-scope occurrence inventory must resolve for this exact verification root." }] });
  else if (scopes.length > entries.length) violations.push({ rule: "bindings-complete", site: root,
    detail: [{ kind: "text", value: "The canonical binding-scope inventory has no extra inline vector occurrence." }] });
  for (const [index, entry] of entries.entries()) {
    const first = inputs.length;
    const bindings = [...entry.vector.classBindings, ...entry.vector.methodBindings, ...entry.vector.capturedBindings, ...entry.vector.selfBindings];
    if (bindings.some(binding => binding.kind === "bound" &&
      (!validIndex(binding.type, context.types.terms.length) || context.types.terms[binding.type] === undefined))) {
      violations.push({ rule: "type-resolves", site: entry.site,
        detail: [{ kind: "text", value: "Every bound type resolves in the actual supplied canonical type table." }] });
    }
    if (scopes !== null) {
      const scope = scopes[index];
      if (scope === undefined) violations.push({ rule: "bindings-complete", site: entry.site,
        detail: [{ kind: "text", value: "Every inline binding-vector occurrence retains its actual canonical scope in declared field order." }] });
      else inputs.push({ vector: entry.vector, scope });
    }
    if (entry.definition !== null) {
      const scope = context.bindingScopeOf(entry.definition);
      if (scope === null) violations.push({ rule: "bindings-complete", site: entry.site,
        detail: [{ kind: "text", value: "The complete lexical binding scope must resolve in the supplied declaration inventory." }] });
      else inputs.push({ vector: entry.vector, scope });
    }
    checks.push({ site: entry.site, first, end: inputs.length });
  }
  if (inputs.length !== 0) {
    const checked = verifyTypes({ table: context.types, bindings: inputs, evidence: [],
      nominalOf: context.nominalOf, nodeExists: context.nodeExists, localExists: context.localExists });
    const invalid = new Set<number>();
    for (const violation of checked) {
      if (violation.site.kind === "binding" && violation.rule !== "type-reference") invalid.add(violation.site.vector);
    }
    for (const check of checks) {
      let failed = false;
      for (let index = check.first; index < check.end; index += 1) if (invalid.has(index)) failed = true;
      if (failed) {
        violations.push({ rule: "bindings-complete", site: check.site, detail: [{ kind: "text",
          value: "A binding vector retains every expected class, method, captured and self binding in canonical owner order." }] });
      }
    }
  }
  return (violations);
};

export const verifyRelationalArena = (
  arena: RelationalArena,
  owner: RelationalOwner,
  context: FactsVerificationContext,
): readonly Violation<FactsRule, FactsSite>[] => {
  const violations: Violation<FactsRule, FactsSite>[] = [];
  const report = (rule: FactsRule, site: FactsSite, text: string): void => {
    const detail: MessageArgument = ({ kind: "text", value: text });
    violations.push(({ rule, site, detail: ([detail]) }));
  };
  const checkSite = (at: RelationalSite): void => {
    const site = relationalSite(owner, at);
    if (at.kind === "declared") {
      if (!context.libraryExportExists(at.identity)) {
        report("relational-site-resolves", site, "A declared relational site must name an existing library export.");
      }
      const count = context.declaredSiteCount(at.identity);
      if (count === null || !validIndex(at.site, count)) {
        report("declared-site-ordinal", site, "A logical site ordinal must name an actual declared allocation site of that export.");
      }
    } else {
      if (!context.nodeExists({ kind: "body", value: at.node })) {
        report("relational-site-resolves", site, "A relational site must retain an existing qualified source occurrence.");
      }
      if (!nodeOwnedBy(owner, at.node, context)) {
        report("cross-owner-qualified", site, "A relational occurrence must belong to the same actual body or summary owner.");
      }
    }
  };
  const projections = new Set<string>();
  for (const [index, path] of arena.projections.entries()) {
    const site: FactsSite = { kind: "projection", owner, projection: path.id };
    if (path.id !== index || !validIndex(path.id, arena.projections.length)) report("projection-id-dense", site, "Projection IDs must equal their dense arena positions.");
    if (path.parent !== null && (!validIndex(path.parent, index) || !Object.is(arena.projections[path.parent]?.id, path.parent))) {
      report("projection-parent-precedes", site, "A projection parent must reference an earlier row of the same arena.");
    }
    const projection = path.projection;
    if (projection.kind === "field" || projection.kind === "method-value") {
      collectSelectionChecks(projection.member, site, context, violations);
    }
    const data: KeyData = projection.kind === "field" || projection.kind === "method-value"
      ? [projection.kind, memberSelectionKey(projection.member)]
      : projection.kind === "index" ? [projection.kind, projection.constant] : [projection.kind];
    const key = encodeKey([path.parent, data]);
    if (projections.has(key)) report("projection-unique", site, "A parent and selected projection must identify exactly one arena row.");
    projections.add(key);
  }
  const producers = new Set<string>();
  for (const [index, producer] of arena.producers.entries()) {
    const site: FactsSite = { kind: "producer", owner, producer: producer.id };
    if (producer.id !== index || !validIndex(producer.id, arena.producers.length)) report("producer-id-dense", site, "Producer IDs must equal their dense arena positions.");
    if (producer.path !== null && (!validIndex(producer.path, arena.projections.length) || !Object.is(arena.projections[producer.path]?.id, producer.path))) {
      report("producer-resolves", site, "A producer projection must resolve in its own relational arena.");
    }
    let identity: KeyData;
    switch (producer.kind) {
      case "allocation": checkSite(producer.at); identity = relationalSiteData(producer.at); break;
      case "parameter":
      case "capture":
        identity = producer.index;
        if (!Number.isSafeInteger(producer.index) || producer.index < 0 || Object.is(producer.index, -0)) {
          report("producer-resolves", site, "A formal or captured producer retains its actual nonnegative index.");
        }
        break;
      case "receiver": identity = null; break;
      case "shared":
        identity = producer.definition;
        if (!context.definitionExists(producer.definition)) {
          report("producer-resolves", site, "A shared producer must name an existing declaration.");
        }
        break;
      case "suspension-input":
        checkSite({ kind: "node", node: producer.at });
        identity = [producer.at.body, producer.at.node, producer.channel];
        break;
      case "call-result":
        checkSite({ kind: "node", node: producer.at });
        identity = [producer.at.body, producer.at.node, producer.callee.kind,
          producer.callee.kind === "direct" ? producer.callee.definition : null];
        if (producer.callee.kind === "direct" && !context.definitionExists(producer.callee.definition)) {
          report("producer-resolves", site, "A direct call-result producer must retain its actual callee declaration.");
        }
        break;
    }
    const key = encodeKey([producer.kind, producer.path, identity]);
    if (producers.has(key)) report("producer-unique", site, "A producer identity and projection must identify exactly one arena row.");
    producers.add(key);
  }
  const canonical = context.arenaOf(owner);
  if (canonical === null) {
    report("cross-owner-qualified", ownerSite(owner), "The actual relational owner must resolve to its canonical arena.");
  }
  for (const [index, value] of arena.contexts.entries()) {
    const site: FactsSite = { kind: "context", owner, context: value.id };
    if (value.id !== index || !validIndex(value.id, arena.contexts.length)) report("context-id-dense", site, "Value-context IDs must equal their dense arena positions.");
    if (value.receiver !== null && (!validIndex(value.receiver, arena.origins.length) || !Object.is(arena.origins[value.receiver]?.id, value.receiver))) {
      report("origins-resolves", site, "A receiver origin must resolve in its own relational arena.");
    }
    for (const argument of value.arguments) {
      if (!validIndex(argument, arena.origins.length) || !Object.is(arena.origins[argument]?.id, argument)) {
        report("origins-resolves", site, "Every parameter-ordered argument must reference origins in its own arena.");
      }
    }
    const expected = canonical?.contexts[index];
    if (canonical !== null && (expected === undefined || !Object.is(expected.id, value.id))) {
      report("context-resolves", site, "A value context retains its actual canonical owner and local identity.");
    }
    if (expected !== undefined && Object.is(expected.id, value.id) &&
      (expected.arguments.length !== value.arguments.length ||
        (expected.receiver === null) !== (value.receiver === null))) {
      report("context-arguments-total", site, "A value context retains every actual parameter and the actual receiver slot.");
    }
    if (expected !== undefined && Object.is(expected.id, value.id) && expected.arguments.length === value.arguments.length &&
      (expected.receiver === null) === (value.receiver === null) &&
      (expected.receiver !== value.receiver || expected.arguments.some((argument, position) => argument !== value.arguments[position]))) {
      report("origin-alternatives-correlated", site, "A value context retains its actual receiver and parameter origins without mixing alternatives.");
    }
    let previousCapture: number | null = null;
    for (const capture of value.captures) {
      if (!Number.isSafeInteger(capture.index) || capture.index < 0 || Object.is(capture.index, -0) ||
        previousCapture !== null && compareNumbers(previousCapture, capture.index) >= 0 ||
        !validIndex(capture.location, arena.boundProducers.length) || !Object.is(arena.boundProducers[capture.location]?.id, capture.location)) {
        report("capture-locations-exact", site, "Captured locations must retain distinct ordered indices and actual bound storage locations.");
      }
      previousCapture = capture.index;
    }
    if (expected !== undefined && Object.is(expected.id, value.id) &&
      (expected.captures.length !== value.captures.length || expected.captures.some((capture, position) => {
        const selected = value.captures[position];
        return selected === undefined || capture.index !== selected.index || capture.location !== selected.location;
      }))) {
      report("capture-locations-exact", site, "A capture vector retains actual storage locations rather than creation-time values.");
    }
  }
  const alternatives = new Set<string>();
  for (const [index, bound] of arena.boundProducers.entries()) {
    const site: FactsSite = { kind: "bound-producer", owner, producer: bound.id };
    if (bound.id !== index || !validIndex(bound.id, arena.boundProducers.length)) report("bound-producer-id-dense", site, "Bound-producer IDs must equal their dense arena positions.");
    if (!validIndex(bound.producer, arena.producers.length) || !Object.is(arena.producers[bound.producer]?.id, bound.producer)) {
      report("producer-resolves", site, "A bound alternative must reference an actual producer in its own arena.");
    }
    if (!validIndex(bound.context, arena.contexts.length) || !Object.is(arena.contexts[bound.context]?.id, bound.context)) {
      report("context-resolves", site, "A bound alternative must retain its actual value context in the same arena.");
    }
    const key = encodeKey([bound.producer, bindingsData(bound.bindings), bound.context]);
    const expected = canonical?.boundProducers[index];
    if (alternatives.has(key) || canonical !== null && (expected === undefined || !Object.is(expected.id, bound.id) ||
      encodeKey([expected.producer, bindingsData(expected.bindings), expected.context]) !== key)) {
      report("origin-alternatives-correlated", site, "Producer, complete type bindings and value context remain one canonical correlated alternative.");
    }
    alternatives.add(key);
  }
  for (const [index, origins] of arena.origins.entries()) {
    const site: FactsSite = { kind: "origins", owner, origins: origins.id };
    if (origins.id !== index || !validIndex(origins.id, arena.origins.length)) report("origins-id-dense", site, "Origins IDs must equal their dense arena positions.");
    let previous: number | null = null;
    for (const bound of origins.producers) {
      if (!validIndex(bound, arena.boundProducers.length) || !Object.is(arena.boundProducers[bound]?.id, bound)) {
        report("bound-producer-resolves", site, "An origin alternative must reference an actual bound producer in its own arena.");
      }
      if (previous !== null && compareNumbers(previous, bound) >= 0) {
        report("origin-alternatives-order", site, "Origin alternatives must be distinct and ordered by canonical bound-producer identity.");
      }
      previous = bound;
    }
    if (origins.kind === "open") {
      for (const boundary of origins.boundaries) {
        if (!validIndex(boundary, arena.boundaries.length) || !Object.is(arena.boundaries[boundary]?.id, boundary)) {
          report("boundary-resolves", site, "Every open-origin boundary must resolve in its own arena.");
        }
      }
    }
  }
  for (const [index, boundary] of arena.boundaries.entries()) {
    const site: FactsSite = { kind: "boundary", owner, boundary: boundary.id };
    if (boundary.id !== index || !validIndex(boundary.id, arena.boundaries.length)) report("boundary-id-dense", site, "Boundary IDs must equal their dense arena positions.");
    checkSite(boundary.at);
    if (!validIndex(boundary.subject, arena.producers.length) || !Object.is(arena.producers[boundary.subject]?.id, boundary.subject) ||
      boundary.owner !== null && (!validIndex(boundary.owner, arena.producers.length) || !Object.is(arena.producers[boundary.owner]?.id, boundary.owner))) {
      report("producer-resolves", site, "A boundary retains its actual subject and optional mutation-owner producer.");
    }
    if (!validIndex(boundary.context, arena.contexts.length) || !Object.is(arena.contexts[boundary.context]?.id, boundary.context)) {
      report("context-resolves", site, "A boundary retains its actual value context in the same arena.");
    }
  }
  return (violations);
};
