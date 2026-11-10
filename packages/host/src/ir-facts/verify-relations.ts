import type { MessageArgument, Violation } from "../diag/contract.js";
import type { DefId, KeyData, NodeRef } from "../ids/contract.js";
import { decodeBodyId, encodeKey } from "../ids/index.js";
import type { HirCallableEndpoint } from "../ir-hir/contract.js";
import type { ParameterMapping } from "../ir-infer/contract.js";
import type { MemberSelection, ResolvedCallee } from "../ir-tir/contract.js";
import type {
  ArtifactBindings, BindingVector, BindingVerificationInput, BodyInstance, MemberKey, MemberOrigin, TypeBinding,
} from "../ir-types/contract.js";
import { verifyTypes } from "../ir-types/index.js";
import type {
  FactsRule, FactsSite, FactsVerificationContext, RelationalArena, RelationalOwner, RelationalSite,
} from "./contract.js";

export const validIndex = (index: number, length: number): boolean =>
  Number.isSafeInteger(index) && index >= 0 && index < length && !Object.is(index, -0);

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

const endpointData = (endpoint: HirCallableEndpoint | null): KeyData => endpoint === null ? null
  : [endpoint.declaration, endpoint.role, endpoint.signature, endpoint.body];

const parameterData = (parameter: ParameterMapping): KeyData => {
  switch (parameter.kind) {
    case "argument": return [parameter.kind, parameter.parameter, parameter.argument, parameter.component, parameter.passing];
    case "default": return [parameter.kind, parameter.parameter, parameter.initializer];
    case "omitted": return [parameter.kind, parameter.parameter, parameter.type];
    case "rest": return [parameter.kind, parameter.parameter, parameter.arguments, parameter.passing];
  }
};

export const calleeData = (callee: ResolvedCallee | null): KeyData => callee === null ? null : [
  callee.decision.candidate, endpointData(callee.decision.advertised), endpointData(callee.decision.api),
  bindingsData(callee.decision.bindings),
  callee.decision.implementationBindings === null ? null : bindingsData(callee.decision.implementationBindings),
  callee.decision.parameters.map(parameterData),
  [callee.decision.completion.signature, callee.decision.completion.completion,
    callee.decision.completion.yielded, callee.decision.completion.sent],
  callee.decision.result,
  callee.activation === null ? null : [callee.activation.body, artifactData(callee.activation.bindings)],
  callee.captures.map(capture => [capture.body, capture.local]),
];

const memberKeyData = (key: MemberKey): KeyData => {
  switch (key.kind) {
    case "text": return [key.kind, key.value];
    case "number": return [key.kind, key.value.numerator, key.value.denominator, key.value.negativeZero];
    case "symbol": return [key.kind, key.declaration];
  }
};

const memberOriginData = (origin: MemberOrigin): KeyData => {
  switch (origin.kind) {
    case "declared": return [origin.kind, origin.declaration];
    case "class-prototype": return [origin.kind, origin.owner];
    case "mapped": return [origin.kind, origin.owner.kind,
      origin.owner.kind === "body" ? origin.owner.value.body : origin.owner.value.owner,
      origin.owner.value.node, memberKeyData(origin.key)];
  }
};

export const memberData = (member: MemberSelection): KeyData => [
  memberKeyData(member.decision.key), member.decision.origins.map(memberOriginData),
  member.decision.selectedDeclarations, member.decision.primary, member.decision.read, member.decision.write,
  endpointData(member.decision.getter), endpointData(member.decision.setter), bindingsData(member.decision.bindings),
  calleeData(member.getter), calleeData(member.setter),
];

export const relationalSiteData = (site: RelationalSite): KeyData => site.kind === "node"
  ? [site.kind, site.node.body, site.node.node]
  : [site.kind, site.identity.module.providerId, site.identity.module.providerVersion, site.identity.module.packageName,
    site.identity.module.moduleSpecifier, site.identity.module.providerModuleId,
    site.identity.exportId, site.identity.memberId, site.identity.signatureId, site.site];

export const relationalSite = (owner: RelationalOwner, at: RelationalSite): FactsSite => at.kind === "node"
  ? { kind: "node", at: at.node } : { kind: "declared-site", owner, identity: at.identity, site: at.site };

export const ownerSite = (owner: RelationalOwner): FactsSite => owner.kind === "body"
  ? { kind: "body", instance: owner.instance }
  : { kind: "summary", summary: { definition: owner.definition, bindings: owner.bindings } };

export const nodeOwnedBy = (owner: RelationalOwner, node: NodeRef): boolean => {
  if (owner.kind === "body") return node.body === owner.instance.body;
  const decoded = decodeBodyId(node.body);
  return decoded.kind === "decoded" && decoded.value.owner === owner.definition;
};

export const declarationOf = (instance: BodyInstance): DefId | null => {
  const decoded = decodeBodyId(instance.body);
  return decoded.kind === "decoded" ? decoded.value.owner : null;
};

export interface FactBindingInput {
  readonly vector: BindingVector;
  readonly definition: DefId;
  readonly site: FactsSite;
}

export const verifyFactBindings = (
  entries: readonly FactBindingInput[],
  context: FactsVerificationContext,
): readonly Violation<FactsRule, FactsSite>[] => {
  const inputs: BindingVerificationInput[] = [];
  const sites: FactsSite[] = [];
  const violations: Violation<FactsRule, FactsSite>[] = [];
  for (const entry of entries) {
    const scope = context.bindingScopeOf(entry.definition);
    if (scope === null) {
      violations.push({ rule: "bindings-complete", site: entry.site,
        detail: [{ kind: "text", value: "The complete lexical binding scope must resolve in the supplied declaration inventory." }] });
    } else {
      inputs.push({ vector: entry.vector, scope });
      sites.push(entry.site);
    }
  }
  if (inputs.length !== 0) {
    const checked = verifyTypes({ table: context.types, bindings: inputs, evidence: [] });
    for (const violation of checked) {
      if (violation.site.kind !== "binding") continue;
      const site = sites[violation.site.vector];
      if (site !== undefined) violations.push({ rule: "bindings-complete", site, detail: violation.detail });
    }
  }
  return Object.freeze(violations);
};

export const verifyRelationalArena = (
  arena: RelationalArena,
  owner: RelationalOwner,
  context: FactsVerificationContext,
): readonly Violation<FactsRule, FactsSite>[] => {
  const violations: Violation<FactsRule, FactsSite>[] = [];
  const report = (rule: FactsRule, site: FactsSite, text: string): void => {
    const detail: MessageArgument = Object.freeze({ kind: "text", value: text });
    violations.push(Object.freeze({ rule, site, detail: Object.freeze([detail]) }));
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
      if (!nodeOwnedBy(owner, at.node)) {
        report("cross-owner-qualified", site, "A relational occurrence must belong to the same actual body or summary owner.");
      }
    }
  };
  const projections = new Set<string>();
  for (let index = 0; index < arena.projections.length; index += 1) {
    const path = arena.projections[index];
    if (path === undefined) continue;
    const site: FactsSite = { kind: "projection", owner, projection: path.id };
    if (path.id !== index) report("projection-id-dense", site, "Projection IDs must equal their dense arena positions.");
    if (path.parent !== null && !validIndex(path.parent, index)) {
      report("projection-parent-precedes", site, "A projection parent must reference an earlier row of the same arena.");
    }
    const projection = path.projection;
    const data: KeyData = projection.kind === "field" || projection.kind === "method-value"
      ? [projection.kind, memberData(projection.member)]
      : projection.kind === "index" ? [projection.kind, projection.constant] : [projection.kind];
    const key = encodeKey([path.parent, data]);
    if (projections.has(key)) report("projection-unique", site, "A parent and selected projection must identify exactly one arena row.");
    projections.add(key);
  }
  const producers = new Set<string>();
  for (let index = 0; index < arena.producers.length; index += 1) {
    const producer = arena.producers[index];
    if (producer === undefined) continue;
    const site: FactsSite = { kind: "producer", owner, producer: producer.id };
    if (producer.id !== index) report("producer-id-dense", site, "Producer IDs must equal their dense arena positions.");
    if (producer.path !== null && !validIndex(producer.path, arena.projections.length)) {
      report("producer-resolves", site, "A producer projection must resolve in its own relational arena.");
    }
    let identity: KeyData;
    switch (producer.kind) {
      case "allocation": checkSite(producer.at); identity = relationalSiteData(producer.at); break;
      case "parameter":
      case "capture": identity = producer.index; break;
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
  for (let index = 0; index < arena.contexts.length; index += 1) {
    const value = arena.contexts[index];
    if (value === undefined) continue;
    const site: FactsSite = { kind: "context", owner, context: value.id };
    if (value.id !== index) report("context-id-dense", site, "Value-context IDs must equal their dense arena positions.");
    if (value.receiver !== null && !validIndex(value.receiver, arena.origins.length)) {
      report("origins-resolves", site, "A receiver origin must resolve in its own relational arena.");
    }
    for (const argument of value.arguments) {
      if (!validIndex(argument, arena.origins.length)) {
        report("origins-resolves", site, "Every parameter-ordered argument must reference origins in its own arena.");
      }
    }
    const expected = canonical?.contexts[index];
    if (expected !== undefined && expected.id === value.id &&
      (expected.arguments.length !== value.arguments.length ||
        (expected.receiver === null) !== (value.receiver === null))) {
      report("context-arguments-total", site, "A value context retains every actual parameter and the actual receiver slot.");
    }
    let previousCapture = -1;
    for (const capture of value.captures) {
      if (!Number.isSafeInteger(capture.index) || capture.index < 0 || capture.index <= previousCapture ||
        !validIndex(capture.location, arena.boundProducers.length)) {
        report("capture-locations-exact", site, "Captured locations must retain distinct ordered indices and actual bound storage locations.");
      }
      previousCapture = capture.index;
    }
    if (expected !== undefined && expected.id === value.id &&
      (expected.captures.length !== value.captures.length || expected.captures.some((capture, position) => {
        const selected = value.captures[position];
        return selected === undefined || capture.index !== selected.index || capture.location !== selected.location;
      }))) {
      report("capture-locations-exact", site, "A capture vector retains actual storage locations rather than creation-time values.");
    }
  }
  const bindings: FactBindingInput[] = [];
  const ownerDefinition = owner.kind === "summary" ? owner.definition : declarationOf(owner.instance);
  const alternatives = new Set<string>();
  for (let index = 0; index < arena.boundProducers.length; index += 1) {
    const bound = arena.boundProducers[index];
    if (bound === undefined) continue;
    const site: FactsSite = { kind: "bound-producer", owner, producer: bound.id };
    if (bound.id !== index) report("bound-producer-id-dense", site, "Bound-producer IDs must equal their dense arena positions.");
    if (!validIndex(bound.producer, arena.producers.length)) {
      report("producer-resolves", site, "A bound alternative must reference an actual producer in its own arena.");
    }
    if (!validIndex(bound.context, arena.contexts.length)) {
      report("context-resolves", site, "A bound alternative must retain its actual value context in the same arena.");
    }
    const key = encodeKey([bound.producer, bindingsData(bound.bindings), bound.context]);
    const expected = canonical?.boundProducers[index];
    if (alternatives.has(key) || expected !== undefined && expected.id === bound.id &&
      encodeKey([expected.producer, bindingsData(expected.bindings), expected.context]) !== key) {
      report("origin-alternatives-correlated", site, "Producer, complete type bindings and value context remain one canonical correlated alternative.");
    }
    alternatives.add(key);
    const producer = arena.producers[bound.producer];
    const definition = producer?.kind === "shared" ? producer.definition
      : producer?.kind === "call-result" && producer.callee.kind === "direct" ? producer.callee.definition : ownerDefinition;
    if (definition !== null) bindings.push({ vector: bound.bindings, definition, site });
  }
  for (let index = 0; index < arena.origins.length; index += 1) {
    const origins = arena.origins[index];
    if (origins === undefined) continue;
    const site: FactsSite = { kind: "origins", owner, origins: origins.id };
    if (origins.id !== index) report("origins-id-dense", site, "Origins IDs must equal their dense arena positions.");
    let previous = -1;
    for (const bound of origins.producers) {
      if (!validIndex(bound, arena.boundProducers.length)) {
        report("bound-producer-resolves", site, "An origin alternative must reference an actual bound producer in its own arena.");
      }
      if (bound <= previous) {
        report("origin-alternatives-order", site, "Origin alternatives must be distinct and ordered by canonical bound-producer identity.");
      }
      previous = bound;
    }
    if (origins.kind === "open") {
      for (const boundary of origins.boundaries) {
        if (!validIndex(boundary, arena.boundaries.length)) {
          report("boundary-resolves", site, "Every open-origin boundary must resolve in its own arena.");
        }
      }
    }
  }
  for (let index = 0; index < arena.boundaries.length; index += 1) {
    const boundary = arena.boundaries[index];
    if (boundary === undefined) continue;
    const site: FactsSite = { kind: "boundary", owner, boundary: boundary.id };
    if (boundary.id !== index) report("boundary-id-dense", site, "Boundary IDs must equal their dense arena positions.");
    checkSite(boundary.at);
    if (!validIndex(boundary.subject, arena.producers.length) ||
      boundary.owner !== null && !validIndex(boundary.owner, arena.producers.length)) {
      report("producer-resolves", site, "A boundary retains its actual subject and optional mutation-owner producer.");
    }
    if (!validIndex(boundary.context, arena.contexts.length)) {
      report("context-resolves", site, "A boundary retains its actual value context in the same arena.");
    }
    if (ownerDefinition !== null) bindings.push({ vector: boundary.bindings, definition: ownerDefinition, site });
  }
  for (const violation of verifyFactBindings(bindings, context)) violations.push(violation);
  return Object.freeze(violations);
};
