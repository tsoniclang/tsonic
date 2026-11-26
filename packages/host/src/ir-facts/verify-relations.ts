import { summaryKey } from "./summary-key.js";
import type { Violation } from "../diag/contract.js";
import type { DataflowAccount, DataflowResult, DataflowStop } from "../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork } from "../dataflow/index.js";
import { admitBindingIdentity, admitOwnerIdentity, admitSelectionIdentity, recordFinding } from "./verification.js";
import type { KeyData, SourceNodeRef } from "../ids/contract.js";
import { admitIntegerKey, encodeKey, projectionPathId } from "../ids/index.js";
import type { HirCallableEndpoint } from "../ir-hir/contract.js";
import type { MemberSelection } from "../ir-tir/contract.js";
import { memberSelectionKey } from "../ir-tir/index.js";
import type {
  ArtifactBindings, MemberKey, MemberStorageSelection,
} from "../ir-types/contract.js";
import { artifactBindingsKey, bindingVectorData, executionKey, memberStorageData } from "../ir-types/index.js";
import type {
  EscapeTarget, FactsRule, FactsSite, FactsVerification, FactsVerificationContext, FieldProjectionIdentityData, MetadataVerificationContext,
  RelationalArena, RelationalOwner, RelationalSite,
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

export const fieldProjectionIdentityData: FieldProjectionIdentityData = member => {
  const { decision } = member;
  const { location } = decision;
  return location.kind === "data" && location.receiver === "by-reference" && location.check.kind === "none"
    && member.getter === null && member.setter === null && decision.getter === null && decision.setter === null
    ? ["storage", memberStorageData(decision)]
    : ["selection", memberSelectionKey(member)];
};

export const relationalUsage = (arena: RelationalArena, account: DataflowAccount): DataflowResult<{
  readonly records: number; readonly references: number; readonly depth: number; readonly alternatives: number;
}> => {
  const initial = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
  if (initial !== null) return initial;
  const depths: number[] = [];
  let references = 0; let depth = 0; let alternatives = 0;
  let cells = arena.cells.length;
  for (const cell of arena.cells) {
    const work = chargeWork(account, 1);
    if (work !== null) return work;
    if (cell === undefined) continue;
    cells += cell.lifetimes.length;
    references += 1 + cell.lifetimes.length * 2;
  }
  for (const path of arena.projections) {
    const work = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (work !== null) return work;
    const parent = path.parent === null ? 0 : depths[path.parent];
    const current = parent === undefined ? 0 : parent + 1;
    depths.push(current);
    if (current > depth) depth = current;
    if (path.parent !== null) references += 1;
  }
  for (const producer of arena.producers) {
    const work = chargeWork(account, 1);
    if (work !== null) return work;
    if (producer.path !== null) references += 1;
  }
  for (const value of arena.contexts) {
    const work = chargeWork(account, 1);
    if (work !== null) return work;
    references += (value.receiver === null ? 0 : 1) + value.arguments.length;
    const captures = value.captures;
    for (let index = 0; index < captures.length; index += 1) {
      const read = chargeWork(account, 1);
      if (read !== null) return read;
      const capture = captures[index];
      if (capture !== undefined) references += "origins" in capture ? 1 : 2;
    }
  }
  for (const origins of arena.origins) {
    const work = chargeWork(account, 1);
    if (work !== null) return work;
    if (origins.producers.length > alternatives) alternatives = origins.producers.length;
    references += origins.producers.length + (origins.kind === "open" ? origins.boundaries.length : 0);
  }
  for (const boundary of arena.boundaries) {
    const work = chargeWork(account, 1);
    if (work !== null) return work;
    references += 2 + (boundary.owner === null ? 0 : 1);
  }
  references += arena.boundProducers.length * 2;
  return { kind: "complete", value: { records: cells + arena.projections.length + arena.producers.length + arena.contexts.length +
    arena.boundProducers.length + arena.origins.length + arena.boundaries.length, references, depth, alternatives } };
};

export const sameBindings = (left: ArtifactBindings, right: ArtifactBindings): boolean =>
  artifactBindingsKey(left) === artifactBindingsKey(right);

export const ownerKey = (owner: RelationalOwner): string => encodeKey([owner.kind, owner.kind === "body"
  ? executionKey(owner.execution) : summaryKey(owner.key)]);

export const relationalSiteData = (site: RelationalSite): KeyData => site.kind === "node"
  ? [site.kind, site.node.kind, site.node.kind === "body" ? site.node.value.body : site.node.value.owner, site.node.value.node]
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
  ? { kind: "node", at: at.node } : { kind: "declared-site", owner, identity: at.identity, site: at.site };

export const ownerSite = (owner: RelationalOwner): FactsSite => owner.kind === "body"
  ? { kind: "execution", execution: owner.execution } : { kind: "summary", summary: owner.key };

export const nodeOwnedBy = (owner: RelationalOwner, node: SourceNodeRef, context: FactsVerificationContext): boolean => {
  if (owner.kind === "body") return node.kind === "body" && node.value.body === owner.execution.instance.body;
  if (owner.key.kind === "body") return node.kind === "body" && node.value.body === owner.key.execution.instance.body;
  const source = context.declarationSourceOf(owner.key.execution.request.definition);
  if (source === null || source.value.node !== node.value.node) return false;
  return source.kind === "body" ? node.kind === "body" && source.value.body === node.value.body
    : node.kind === "item" && source.value.owner === node.value.owner;
};


const collectStorageOrigins = (
  member: MemberStorageSelection, site: FactsSite, context: MetadataVerificationContext,
  violations: Violation<FactsRule, FactsSite>[], account: DataflowAccount,
): DataflowStop | null => {
  const key = (value: MemberKey): DataflowStop | null => {
    const work = chargeWork(account, 1);
    if (work !== null) return work;
    return value.kind === "symbol" && !context.definitionExists(value.declaration)
      ? recordFinding(account, violations, "last", "producer-resolves", site, "A selected member symbol key retains its actual declaration.") : null;
  };
  const first = key(member.key);
  if (first !== null) return first;
  for (const origin of member.origins) {
    const work = chargeWork(account, 1);
    if (work !== null) return work;
    switch (origin.kind) {
      case "declared":
        if (!context.definitionExists(origin.declaration)) {
          const stop = recordFinding(account, violations, "last", "producer-resolves", site, "A selected member origin retains its actual declaration.");
          if (stop !== null) return stop;
        }
        break;
      case "class-prototype":
        if (!context.definitionExists(origin.owner)) {
          const stop = recordFinding(account, violations, "last", "producer-resolves", site, "A selected member origin retains its actual declaration.");
          if (stop !== null) return stop;
        }
        break;
      case "intrinsic":
        break;
      case "source-member":
        if (!context.nodeExists({ kind: "body", value: origin.occurrence })) {
          const stop = recordFinding(account, violations, "last", "node-resolves", site, "A selected data-property member origin retains its actual qualified source occurrence.");
          if (stop !== null) return stop;
        }
        break;
      case "mapped": {
        if (!context.nodeExists(origin.owner)) {
          const stop = recordFinding(account, violations, "last", "node-resolves", site, "A selected member origin retains its actual qualified source occurrence.");
          if (stop !== null) return stop;
        }
        const stop = key(origin.key);
        if (stop !== null) return stop;
        break;
      }
    }
  }
  return null;
};

const collectStorageDeclarations = (
  member: MemberStorageSelection, site: FactsSite, context: MetadataVerificationContext,
  violations: Violation<FactsRule, FactsSite>[], account: DataflowAccount,
): DataflowStop | null => {
  for (const selected of member.selectedDeclarations) {
    const work = chargeWork(account, 1);
    if (work !== null) return work;
    if (!context.definitionExists(selected)) {
      const stop = recordFinding(account, violations, "last", "producer-resolves", site, "A selected member retains its actual selected declaration group.");
      if (stop !== null) return stop;
    }
  }
  return null;
};

export const collectStorageChecks = (
  member: MemberStorageSelection, site: FactsSite, context: MetadataVerificationContext,
  violations: Violation<FactsRule, FactsSite>[], account: DataflowAccount,
): DataflowStop | null =>
  collectStorageOrigins(member, site, context, violations, account)
    ?? collectStorageDeclarations(member, site, context, violations, account);

export const collectSelectionChecks = (
  selection: MemberSelection, site: FactsSite, context: FactsVerificationContext,
  violations: Violation<FactsRule, FactsSite>[], account: DataflowAccount,
): DataflowStop | null => {
  const type = (id: number | null): DataflowStop | null => {
    const work = chargeWork(account, 1);
    if (work !== null) return work;
    return id !== null && (!validIndex(id, context.types.terms.length) || context.types.terms[id] === undefined)
      ? recordFinding(account, violations, "last", "type-resolves", site, "A selected member type resolves in the actual supplied type table.") : null;
  };
  const endpoint = (value: HirCallableEndpoint | null): DataflowStop | null => {
    const work = chargeWork(account, 1);
    if (work !== null) return work;
    if (value === null) return null;
    if (!context.definitionExists(value.declaration)) {
      const stop = recordFinding(account, violations, "last", "producer-resolves", site, "A selected member endpoint retains its actual declaration.");
      if (stop !== null) return stop;
    }
    return !validIndex(value.signature, context.types.signatures.length) || !Object.is(context.types.signatures[value.signature]?.id, value.signature)
      ? recordFinding(account, violations, "last", "signature-resolves", site, "A selected member endpoint resolves in the actual supplied signature table.") : null;
  };
  const initial = chargeWork(account, 1);
  if (initial !== null) return initial;
  const member = selection.decision;
  const selected = collectStorageOrigins(member, site, context, violations, account)
    ?? type(member.read) ?? type(member.write) ?? endpoint(member.getter) ?? endpoint(member.setter)
    ?? collectStorageDeclarations(member, site, context, violations, account);
  if (selected !== null) return selected;
  for (const callee of [selection.getter, selection.setter]) {
    const work = chargeWork(account, 1);
    if (work !== null) return work;
    if (callee === null) continue;
    const decision = callee.decision;
    const endpoints = endpoint(decision.advertised) ?? endpoint(decision.api);
    if (endpoints !== null) return endpoints;
    if (!validIndex(decision.completion.signature, context.types.signatures.length)
      || !Object.is(context.types.signatures[decision.completion.signature]?.id, decision.completion.signature)) {
      const stop = recordFinding(account, violations, "last", "signature-resolves", site, "A selected member completion retains its actual signature.");
      if (stop !== null) return stop;
    }
    const completion = type(decision.result) ?? type(decision.completion.completion) ?? type(decision.completion.yielded) ?? type(decision.completion.sent);
    if (completion !== null) return completion;
    if (callee.activation !== null) for (const row of context.tirBody(callee.activation).captures) {
      const work = chargeWork(account, 1);
      if (work !== null) return work;
      if (row === undefined || !context.localExists(row.local)) {
        const stop = recordFinding(account, violations, "last", "capture-locations-exact", site, "A selected accessor retains its actual captured storage locations.");
        if (stop !== null) return stop;
      }
    }
    for (const parameter of decision.parameters) {
      const work = chargeWork(account, 1);
      if (work !== null) return work;
      if (parameter.kind === "omitted") {
        const stop = type(parameter.type);
        if (stop !== null) return stop;
      }
    }
  }
  return null;
};


export const verifyRelationalArena = (
  arena: RelationalArena,
  owner: RelationalOwner,
  context: FactsVerificationContext,
  account: DataflowAccount,
): FactsVerification<FactsRule> => {
  const initial = chargeWork(account, 1) ?? chargeResultEntries(account, 6);
  if (initial !== null) return initial;
  const admittedOwner = admitOwnerIdentity(owner, account);
  if (admittedOwner !== null) return admittedOwner;
  const violations: Violation<FactsRule, FactsSite>[] = [];
  const report = (rule: FactsRule, site: FactsSite, text: string): DataflowStop | null =>
    recordFinding(account, violations, "last", rule, site, text);
  const checkSite = (at: RelationalSite): DataflowStop | null => {
    const work = chargeWork(account, 1);
    if (work !== null) return work;
    const site = relationalSite(owner, at);
    if (at.kind === "declared") {
      if (!context.libraryExportExists(at.identity)) {
        { const stop = report("relational-site-resolves", site, "A declared relational site must name an existing library export."); if (stop !== null) return stop; }
      }
      const count = context.declaredSiteCount(at.identity);
      if (count === null || !validIndex(at.site, count)) {
        { const stop = report("declared-site-ordinal", site, "A logical site ordinal must name an actual declared allocation site of that export."); if (stop !== null) return stop; }
      }
    } else {
      if (!context.nodeExists(at.node)) {
        { const stop = report("relational-site-resolves", site, "A relational site must retain an existing qualified source occurrence."); if (stop !== null) return stop; }
      }
      if (!nodeOwnedBy(owner, at.node, context)) {
        { const stop = report("cross-owner-qualified", site, "A relational occurrence must belong to the same actual body or summary owner."); if (stop !== null) return stop; }
      }
    }
    return null;
  };
  const projections = new Set<string>();
  for (let index = 0; index < arena.projections.length; index += 1) {
    const step = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (step !== null) return step;
    const path = arena.projections[index];
    if (path === undefined) {
      const stop = report("projection-id-dense", { kind: "projection", owner, projection: projectionPathId(index) },
        "Projection IDs must equal their dense arena positions.");
      if (stop !== null) return stop;
      continue;
    }
    const site: FactsSite = { kind: "projection", owner, projection: path.id };
    if (path.id !== index || !validIndex(path.id, arena.projections.length)) { const stop = report("projection-id-dense", site, "Projection IDs must equal their dense arena positions."); if (stop !== null) return stop; }
    if (path.parent !== null && (!validIndex(path.parent, index) || !Object.is(arena.projections[path.parent]?.id, path.parent))) {
      { const stop = report("projection-parent-precedes", site, "A projection parent must reference an earlier row of the same arena."); if (stop !== null) return stop; }
    }
    const projection = path.projection;
    if (projection.kind === "field" || projection.kind === "method-value") {
      { const stop = collectSelectionChecks(projection.member, site, context, violations, account); if (stop !== null) return stop; }
    }
    if (projection.kind === "field" || projection.kind === "method-value") {
      const stop = admitSelectionIdentity(projection.member, account);
      if (stop !== null) return stop;
    }
    let constant: bigint | null = null;
    if (projection.kind === "index") {
      const beforeRead = chargeWork(account, 1);
      if (beforeRead !== null) return beforeRead;
      constant = projection.constant;
      const width = admitIntegerKey(constant, count => chargeWork(account, count));
      if (width !== null) return width;
    }
    const data: KeyData = projection.kind === "field" ? [projection.kind, fieldProjectionIdentityData(projection.member)]
      : projection.kind === "method-value" ? [projection.kind, memberSelectionKey(projection.member)]
        : constant !== null ? [projection.kind, constant] : [projection.kind];
    const key = encodeKey([path.parent, data]);
    if (projections.has(key)) { const stop = report("projection-unique", site, "A parent and selected projection must identify exactly one arena row."); if (stop !== null) return stop; }
    projections.add(key);
  }
  const producers = new Set<string>();
  for (const [index, producer] of arena.producers.entries()) {
    const step = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (step !== null) return step;
    const site: FactsSite = { kind: "producer", owner, producer: producer.id };
    if (producer.id !== index || !validIndex(producer.id, arena.producers.length)) { const stop = report("producer-id-dense", site, "Producer IDs must equal their dense arena positions."); if (stop !== null) return stop; }
    if (producer.path !== null && (!validIndex(producer.path, arena.projections.length) || !Object.is(arena.projections[producer.path]?.id, producer.path))) {
      { const stop = report("producer-resolves", site, "A producer projection must resolve in its own relational arena."); if (stop !== null) return stop; }
    }
    let identity: KeyData;
    switch (producer.kind) {
      case "allocation": { const stop = checkSite(producer.at); if (stop !== null) return stop; } identity = relationalSiteData(producer.at); break;
      case "parameter":
      case "capture":
        identity = producer.index;
        if (!Number.isSafeInteger(producer.index) || producer.index < 0 || Object.is(producer.index, -0)) {
          { const stop = report("producer-resolves", site, "A formal or captured producer retains its actual nonnegative index."); if (stop !== null) return stop; }
        }
        break;
      case "receiver": identity = null; break;
      case "local": {
        const stop = chargeWork(account, 1 + producer.local.body.length) ?? chargeResultEntries(account, 2);
        if (stop !== null) return stop;
        identity = [producer.local.body, producer.local.local];
        const selected = owner.kind === "body" ? owner.execution : owner.key.kind === "body" ? owner.key.execution : null;
        let exists = false;
        if (selected !== null && producer.local.body === selected.instance.body
          && Number.isSafeInteger(producer.local.local) && producer.local.local >= 0 && !Object.is(producer.local.local, -0)) {
          exists = context.localExists(producer.local);
          const failure = accountFailure(account);
          if (failure !== null) return failure;
        }
        if (!exists) {
          const finding = report("producer-resolves", site, "A local location retains an actual qualified source local of its selected owning body.");
          if (finding !== null) return finding;
        }
        break;
      }
      case "cell-content":
        identity = [producer.cell, producer.phase];
        if (!validIndex(producer.cell, arena.cells.length) || !Object.is(arena.cells[producer.cell]?.id, producer.cell))
          { const stop = report("producer-resolves", site, "Shared content symbols retain an actual cell and their distinct entry or uncontrolled-time boundary."); if (stop !== null) return stop; }
        break;
      case "shared":
        identity = producer.definition;
        if (!context.definitionExists(producer.definition)) {
          { const stop = report("producer-resolves", site, "A shared producer must name an existing declaration."); if (stop !== null) return stop; }
        }
        break;
      case "suspension-input":
        { const stop = checkSite({ kind: "node", node: { kind: "body", value: producer.at } }); if (stop !== null) return stop; }
        identity = [producer.at.body, producer.at.node, producer.channel];
        break;
      case "call-result":
        { const stop = checkSite({ kind: "node", node: { kind: "body", value: producer.at } }); if (stop !== null) return stop; }
        identity = [producer.at.body, producer.at.node, producer.callee.kind,
          producer.callee.kind === "direct" ? producer.callee.definition : null];
        if (producer.callee.kind === "direct" && !context.definitionExists(producer.callee.definition)) {
          { const stop = report("producer-resolves", site, "A direct call-result producer must retain its actual callee declaration."); if (stop !== null) return stop; }
        }
        break;
    }
    const key = encodeKey([producer.kind, producer.path, identity]);
    if (producers.has(key)) { const stop = report("producer-unique", site, "A producer identity and projection must identify exactly one arena row."); if (stop !== null) return stop; }
    producers.add(key);
  }
  const lookup = chargeWork(account, 1);
  if (lookup !== null) return lookup;
  const canonical = context.arenaOf(owner);
  if (canonical === null) {
    { const stop = report("cross-owner-qualified", ownerSite(owner), "The actual relational owner must resolve to its canonical arena."); if (stop !== null) return stop; }
  }
  for (const [index, value] of arena.contexts.entries()) {
    const step = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (step !== null) return step;
    const site: FactsSite = { kind: "context", owner, context: value.id };
    if (value.id !== index || !validIndex(value.id, arena.contexts.length)) { const stop = report("context-id-dense", site, "Value-context IDs must equal their dense arena positions."); if (stop !== null) return stop; }
    if (value.receiver !== null && (!validIndex(value.receiver, arena.origins.length) || !Object.is(arena.origins[value.receiver]?.id, value.receiver))) {
      { const stop = report("origins-resolves", site, "A receiver origin must resolve in its own relational arena."); if (stop !== null) return stop; }
    }
    for (const argument of value.arguments) {
    const step = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (step !== null) return step;
      if (argument?.kind === "omitted" && "origins" in argument || argument?.kind !== "omitted" && argument?.kind !== "provided") {
        const stop = report("context-arguments-total", site, "A parameter slot is either explicitly omitted or provided with actual origins.");
        if (stop !== null) return stop;
      } else if (argument.kind === "provided" &&
        (!validIndex(argument.origins, arena.origins.length) || !Object.is(arena.origins[argument.origins]?.id, argument.origins))) {
        { const stop = report("origins-resolves", site, "Every parameter-ordered argument must reference origins in its own arena."); if (stop !== null) return stop; }
      }
    }
    const expected = canonical?.contexts[index];
    if (canonical !== null && (expected === undefined || !Object.is(expected.id, value.id))) {
      { const stop = report("context-resolves", site, "A value context retains its actual canonical owner and local identity."); if (stop !== null) return stop; }
    }
    if (expected !== undefined && Object.is(expected.id, value.id) &&
      (expected.arguments.length !== value.arguments.length ||
        (expected.receiver === null) !== (value.receiver === null))) {
      { const stop = report("context-arguments-total", site, "A value context retains every actual parameter and the actual receiver slot."); if (stop !== null) return stop; }
    }
    let argumentMismatch = false;
    if (expected !== undefined && Object.is(expected.id, value.id) && expected.arguments.length === value.arguments.length &&
      (expected.receiver === null) === (value.receiver === null)) {
      argumentMismatch = expected.receiver !== value.receiver;
      if (!argumentMismatch) for (let position = 0; position < expected.arguments.length; position += 1) {
        const work = chargeWork(account, 1);
        if (work !== null) return work;
        const left = expected.arguments[position];
        const right = value.arguments[position];
        if (left?.kind !== right?.kind || left?.kind === "provided" && right?.kind === "provided" && left.origins !== right.origins) {
          argumentMismatch = true;
          break;
        }
      }
    }
    if (argumentMismatch) {
      { const stop = report("origin-alternatives-correlated", site, "A value context retains its actual receiver and parameter origins without mixing alternatives."); if (stop !== null) return stop; }
    }
    let previousCapture: number | null = null;
    const captures = value.captures;
    for (let position = 0; position < captures.length; position += 1) {
      const step = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
      if (step !== null) return step;
      const capture = captures[position];
      if (capture === undefined) {
        const stop = report("capture-locations-exact", site, "A value context retains its dense capture vector.");
        if (stop !== null) return stop;
        continue;
      }
      const validSubject = "origins" in capture
        ? !("location" in capture) && !("cell" in capture) && validIndex(capture.origins, arena.origins.length)
          && Object.is(arena.origins[capture.origins]?.id, capture.origins)
        : validIndex(capture.location, arena.boundProducers.length) && Object.is(arena.boundProducers[capture.location]?.id, capture.location)
          && validIndex(capture.cell, arena.cells.length) && Object.is(arena.cells[capture.cell]?.id, capture.cell);
      if (!Number.isSafeInteger(capture.index) || capture.index < 0 || Object.is(capture.index, -0) || !validSubject ||
        previousCapture !== null && compareNumbers(previousCapture, capture.index) >= 0) {
        { const stop = report("capture-locations-exact", site, "Captures retain distinct ordered indices, bound value subjects and their actual separately supplied logical cells."); if (stop !== null) return stop; }
      }
      previousCapture = capture.index;
    }
    let captureMismatch = false;
    if (expected !== undefined && Object.is(expected.id, value.id)) {
      captureMismatch = expected.captures.length !== value.captures.length;
      if (!captureMismatch) for (let position = 0; position < expected.captures.length; position += 1) {
        const work = chargeWork(account, 1);
        if (work !== null) return work;
        const capture = expected.captures[position];
        const selected = value.captures[position];
        if (capture === undefined || selected === undefined || capture.index !== selected.index ||
          ("origins" in capture ? !("origins" in selected) || capture.origins !== selected.origins
            : "origins" in selected || capture.location !== selected.location || capture.cell !== selected.cell)) {
          captureMismatch = true;
          break;
        }
      }
    }
    if (captureMismatch) {
      { const stop = report("capture-locations-exact", site, "A capture vector retains actual storage locations rather than creation-time values."); if (stop !== null) return stop; }
    }
  }
  const alternatives = new Set<string>();
  for (const [index, bound] of arena.boundProducers.entries()) {
    const step = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (step !== null) return step;
    const site: FactsSite = { kind: "bound-producer", owner, producer: bound.id };
    if (bound.id !== index || !validIndex(bound.id, arena.boundProducers.length)) { const stop = report("bound-producer-id-dense", site, "Bound-producer IDs must equal their dense arena positions."); if (stop !== null) return stop; }
    if (!validIndex(bound.producer, arena.producers.length) || !Object.is(arena.producers[bound.producer]?.id, bound.producer)) {
      { const stop = report("producer-resolves", site, "A bound alternative must reference an actual producer in its own arena."); if (stop !== null) return stop; }
    }
    if (!validIndex(bound.context, arena.contexts.length) || !Object.is(arena.contexts[bound.context]?.id, bound.context)) {
      { const stop = report("context-resolves", site, "A bound alternative must retain its actual value context in the same arena."); if (stop !== null) return stop; }
    }
    const boundSource = arena.producers[bound.producer];
    if (boundSource?.kind === "parameter" && arena.contexts[bound.context]?.arguments[boundSource.index]?.kind === "omitted") {
      const stop = report("context-arguments-total", site, "An omitted formal has no incoming caller value to bind.");
      if (stop !== null) return stop;
    }
    const identityStop = admitBindingIdentity(bound.bindings, account);
    if (identityStop !== null) return identityStop;
    const key = encodeKey([bound.producer, bindingVectorData(bound.bindings), bound.context]);
    const expected = canonical?.boundProducers[index];
    if (expected !== undefined) {
      const stop = admitBindingIdentity(expected.bindings, account);
      if (stop !== null) return stop;
    }
    if (alternatives.has(key) || canonical !== null && (expected === undefined || !Object.is(expected.id, bound.id) ||
      encodeKey([expected.producer, bindingVectorData(expected.bindings), expected.context]) !== key)) {
      { const stop = report("origin-alternatives-correlated", site, "Producer, complete type bindings and value context remain one canonical correlated alternative."); if (stop !== null) return stop; }
    }
    alternatives.add(key);
  }
  const originPayloads = new Set<string>();
  for (const [index, origins] of arena.origins.entries()) {
    const step = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (step !== null) return step;
    const site: FactsSite = { kind: "origins", owner, origins: origins.id };
    if (origins.id !== index || !validIndex(origins.id, arena.origins.length)) { const stop = report("origins-id-dense", site, "Origins IDs must equal their dense arena positions."); if (stop !== null) return stop; }
    let previous: number | null = null;
    for (const bound of origins.producers) {
    const step = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (step !== null) return step;
      const alternative = validIndex(bound, arena.boundProducers.length) ? arena.boundProducers[bound] : undefined;
      if (alternative === undefined || !Object.is(alternative.id, bound)) {
        { const stop = report("bound-producer-resolves", site, "An origin alternative must reference an actual bound producer in its own arena."); if (stop !== null) return stop; }
      } else {
        const lookup = chargeWork(account, 1);
        if (lookup !== null) return lookup;
        const producer = validIndex(alternative.producer, arena.producers.length) ? arena.producers[alternative.producer] : undefined;
        if (producer?.kind === "local") {
          const stop = report("local-producer-location-only", site, "A local producer denotes a storage location, never an origin of a value.");
          if (stop !== null) return stop;
        }
      }
      if (previous !== null && compareNumbers(previous, bound) >= 0) {
        { const stop = report("origin-alternatives-order", site, "Origin alternatives must be distinct and ordered by canonical bound-producer identity."); if (stop !== null) return stop; }
      }
      previous = bound;
    }
    if (origins.kind === "open") {
      if (origins.boundaries.length === 0) {
        const stop = report("origin-alternatives-order", site, "Open Origins retain a nonempty canonical boundary set.");
        if (stop !== null) return stop;
      }
      let previousBoundary: number | null = null;
      for (const boundary of origins.boundaries) {
    const step = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (step !== null) return step;
        if (!validIndex(boundary, arena.boundaries.length) || !Object.is(arena.boundaries[boundary]?.id, boundary)) {
          { const stop = report("boundary-resolves", site, "Every open-origin boundary must resolve in its own arena."); if (stop !== null) return stop; }
        }
        if (previousBoundary !== null && compareNumbers(previousBoundary, boundary) >= 0) {
          const stop = report("origin-alternatives-order", site, "Open-origin boundaries must be distinct and ordered by canonical boundary identity.");
          if (stop !== null) return stop;
        }
        previousBoundary = boundary;
      }
    }
    const payloadWork = chargeWork(account, 3 + origins.producers.length + (origins.kind === "open" ? origins.boundaries.length : 0));
    if (payloadWork !== null) return payloadWork;
    const payload = encodeKey([origins.kind, origins.producers, origins.includesAbsence, origins.kind === "open" ? origins.boundaries : null]);
    if (originPayloads.has(payload)) {
      const stop = report("origins-unique", site, "An Origins payload identifies exactly one row within its relational arena.");
      if (stop !== null) return stop;
    }
    originPayloads.add(payload);
  }
  for (const [index, boundary] of arena.boundaries.entries()) {
    const step = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (step !== null) return step;
    const site: FactsSite = { kind: "boundary", owner, boundary: boundary.id };
    if (boundary.id !== index || !validIndex(boundary.id, arena.boundaries.length)) { const stop = report("boundary-id-dense", site, "Boundary IDs must equal their dense arena positions."); if (stop !== null) return stop; }
    { const stop = checkSite(boundary.at); if (stop !== null) return stop; }
    if (!validIndex(boundary.subject, arena.producers.length) || !Object.is(arena.producers[boundary.subject]?.id, boundary.subject) ||
      boundary.owner !== null && (!validIndex(boundary.owner, arena.producers.length) || !Object.is(arena.producers[boundary.owner]?.id, boundary.owner))) {
      { const stop = report("producer-resolves", site, "A boundary retains its actual subject and optional mutation-owner producer."); if (stop !== null) return stop; }
    }
    if (!validIndex(boundary.context, arena.contexts.length) || !Object.is(arena.contexts[boundary.context]?.id, boundary.context)) {
      { const stop = report("context-resolves", site, "A boundary retains its actual value context in the same arena."); if (stop !== null) return stop; }
    }
  }
  return { kind: "complete", violations };
};
