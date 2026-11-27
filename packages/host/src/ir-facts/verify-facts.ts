import type { DataflowResult, DataflowStop } from "../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork } from "../dataflow/index.js";
import type { ParameterMapping } from "../ir-infer/contract.js";
import type { TirArgument } from "../ir-tir/contract.js";
import { admitArtifactIdentity, admitOwnerIdentity, recordFinding } from "./verification.js";
import { escapeTargetKey } from "./escape-key.js";
import { summaryBindings, summaryDefinition, summaryKey } from "./summary-key.js";
import type { Violation } from "../diag/contract.js";
import type { NodeId, NodeRef } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type { DeclarationTarget } from "../ir-hir/contract.js";
import type { TirNode } from "../ir-tir/contract.js";
import type { ArtifactBindings, BodyInstance } from "../ir-types/contract.js";
import { instanceKey } from "../ir-types/index.js";
import { verifyCells } from "./verify-cells.js";
import type {
  ArgumentTransport, ArgumentTransportKey, BoundActivation, CompareBoundActivations, CompareConstructionAlternatives, ConstructionAlternative, EscapeFact, EscapeTarget, FactsRule, FactsSite, MemoryField, MemoryLayout, MetadataFieldRef, MetadataLayoutRef, MirPoint, RelationalOwner,
  CountedLoopFact, RetentionFact, VerifyFacts,
} from "./contract.js";
import { collectSelectionChecks, compareNumbers, ownerKey, relationalUsage, sameBindings, validIndex, verifyRelationalArena } from "./verify-relations.js";
import { factBindingInputs } from "./binding-inputs.js";
import { verifyFactBindings } from "./verify-bindings.js";
import { bodyNodes } from "./verify-body-nodes.js";
import { verifyLiveness } from "./verify-liveness.js";
import { countedLoops } from "./counted-loops.js";

const compareText = (left: string, right: string): number => left === right ? 0 : left < right ? -1 : 1;
const compareNullableNumber = (left: number | null, right: number | null, nullOrder: -1 | 1): number => {
  if (left === null) return right === null ? 0 : nullOrder;
  if (right === null) return -nullOrder;
  return compareNumbers(left, right);
};

const compareDeclarations = (left: DeclarationTarget, right: DeclarationTarget): number => left.kind === "local"
  ? right.kind === "local" ? compareText(left.local.body, right.local.body) || compareNumbers(left.local.local, right.local.local) : -1
  : right.kind === "local" ? 1 : compareText(left.definition, right.definition);
export const argumentTransportKey: ArgumentTransportKey = (transport, account) => {
  const previous = accountFailure(account);
  if (previous !== null) return previous;
  if (transport === null) return { kind: "complete", value: "" };
  const stop = admitOwnerIdentity(transport.formal.owner, account);
  if (stop !== null) return stop;
  const value = encodeKey(transport.kind === "provided"
    ? [transport.authoredIndex, transport.parameter, transport.parameterIndex, transport.repeated, transport.passing, transport.actual,
      ownerKey(transport.formal.owner), transport.formal.producer, transport.projection]
    : [transport.kind, transport.parameter, transport.parameterIndex, ownerKey(transport.formal.owner), transport.formal.producer]);
  return { kind: "complete", value };
};
type ProvidedTransport = Extract<ArgumentTransport, { readonly kind: "provided" }>;

interface TransportShape {
  readonly authoredIndex: number | null;
  readonly repeated: boolean;
  readonly component: number | null;
}

const comparePoints = (left: MirPoint, right: MirPoint): number =>
  compareNumbers(left.block, right.block) || compareNullableNumber(left.statement, right.statement, 1);

export const compareBoundActivations: CompareBoundActivations = (left, leftInstance, leftTransport, right, rightInstance, rightTransport) =>
  comparePoints(left.point, right.point) || compareNumbers(left.node, right.node) || compareText(leftInstance, rightInstance)
  || compareNumbers(left.context, right.context) || compareNullableNumber(left.caller, right.caller, -1) || compareText(leftTransport, rightTransport);

export const compareConstructionAlternatives: CompareConstructionAlternatives = (left, leftBody, right, rightBody) =>
  compareNumbers(left.node, right.node)
  || compareText(left.root.body, right.root.body) || compareNumbers(left.root.node, right.root.node)
  || compareText(left.allocation.body, right.allocation.body) || compareNumbers(left.allocation.node, right.allocation.node)
  || compareText(left.implementation ?? "", right.implementation ?? "") || compareText(leftBody, rightBody);

export const verifyFacts: VerifyFacts = (facts, mir, context, account) => {
  const initial = chargeWork(account, 1) ?? chargeResultEntries(account, 6);
  if (initial !== null) return initial;
  const violations: Violation<FactsRule, FactsSite>[] = [];
  const bodySite: FactsSite = { kind: "execution", execution: facts.execution };
  const owner: RelationalOwner = { kind: "body", execution: facts.execution };
  const inputIdentity = admitArtifactIdentity(facts.execution.instance.bindings, account);
  if (inputIdentity !== null) return inputIdentity;
  const tir = context.tirBody(facts.execution.instance);
  const at = (node: NodeId): FactsSite => ({ kind: "node", at: { kind: "body", value: { body: facts.execution.instance.body, node } } });
  const report = (rule: FactsRule, site: FactsSite, text: string): DataflowStop | null =>
    recordFinding(account, violations, "last", rule, site, text);
  const identity = admitArtifactIdentity(mir.bindings, account) ?? admitArtifactIdentity(tir.bindings, account);
  if (identity !== null) return identity;
  if (facts.execution.instance.body !== mir.body || facts.execution.instance.body !== tir.body ||
    !sameBindings(facts.execution.instance.bindings, mir.bindings) || !sameBindings(facts.execution.instance.bindings, tir.bindings)) {
    { const stop = report("body-instance-exact", bodySite, "Facts, TIR and MIR retain one exact body and complete binding environment."); if (stop !== null) return stop; }
  }
  const provided = facts.execution.provided;
  let entry = false;
  for (const candidate of mir.entries) {
    const work = chargeWork(account, 1);
    if (work !== null) return work;
    if (candidate !== undefined && Object.is(candidate.provided, provided)) { entry = true; break; }
  }
  if (!Number.isSafeInteger(provided) || provided < 0 || Object.is(provided, -0) || !entry) {
    { const stop = report("execution-entry-exact", bodySite, "Facts name an actual supplied-count entry of their exact MIR body instance."); if (stop !== null) return stop; }
  }
  const definition = tir.owner;
  if (!context.definitionExists(definition)) {
    { const stop = report("cross-owner-qualified", bodySite, "The actual checked body retains an existing declaration owner."); if (stop !== null) return stop; }
  }
  const diagnosticSites = new Set<string>();
  for (const diagnostic of context.diagnostics) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
if (diagnostic !== undefined && diagnostic.severity === "error" && diagnostic.site.kind === "source") {
    const origin = diagnostic.site.origin; diagnosticSites.add(encodeKey([origin.module, origin.start, origin.length]));
  }
  }
  const arena = verifyRelationalArena(facts.arena, owner, context, account);
  if (arena.kind !== "complete") return arena;
  const cells = verifyCells(facts.arena, owner, context, account);
  if (cells.kind !== "complete") return cells;
  for (const rows of [arena.violations, cells.violations]) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
for (const violation of rows) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

    const output = chargeResultEntries(account, 1);
    if (output !== null) return output;
    violations.push(violation);
  }
  }
  const syntax = bodyNodes(tir, account);
  if (syntax.kind !== "complete") return syntax;
  const { nodes, valueNodes } = syntax.value;
  const nodeRef = (reference: NodeRef, site: FactsSite, local = true): DataflowStop | null => {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    if (!context.nodeExists({ kind: "body", value: reference }) || local && !nodes.has(reference.node)) {
      { const stop = report("node-resolves", site, "Every fact retains an actual source occurrence in its declared body domain."); if (stop !== null) return stop; }
    }
    if (local && reference.body !== facts.execution.instance.body) {
      { const stop = report("cross-owner-qualified", site, "A local fact cannot borrow the same numeric node index from another body."); if (stop !== null) return stop; }
    }
      return null;
  };
  const node = (id: NodeId): DataflowStop | null => nodeRef({ body: facts.execution.instance.body, node: id }, at(id));
  const point = (value: MirPoint, site: FactsSite, rule: "mir-point-resolves" | "point-refs-resolve" = "mir-point-resolves"): DataflowStop | null => {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    const block = validIndex(value.block, mir.blocks.length) ? mir.blocks[value.block] : undefined;
    if (block === undefined || !Object.is(block.id, value.block) || value.statement !== null &&
      (!validIndex(value.statement, block.statements.length) || block.statements[value.statement] === undefined)) {
      { const stop = report(rule, site, "A MIR point names an actual block and statement, or that block's terminator."); if (stop !== null) return stop; }
    }
      return null;
  };
  const place = (id: number, site: FactsSite): DataflowStop | null => {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    if (!validIndex(id, mir.places.length) || !Object.is(mir.places[id]?.id, id)) { const stop = report("place-resolves", site, "A place reference resolves in this exact MIR body."); if (stop !== null) return stop; }
      return null;
  };
  const origins = (id: number, site: FactsSite): DataflowStop | null => {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    if (!validIndex(id, facts.arena.origins.length) || !Object.is(facts.arena.origins[id]?.id, id)) { const stop = report("origins-resolves", site, "Origins resolve in this exact relational arena."); if (stop !== null) return stop; }
      return null;
  };
  const producer = (id: number, site: FactsSite, bound = false): DataflowStop | null => {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    const rows = bound ? facts.arena.boundProducers : facts.arena.producers;
    if (!validIndex(id, rows.length) || !Object.is(rows[id]?.id, id)) { const stop = report(bound ? "bound-producer-resolves" : "producer-resolves", site,
      "A producer reference resolves in its exact declared arena."); if (stop !== null) return stop; }
      return null;
  };
  const valueContext = (id: number, site: FactsSite): DataflowStop | null => {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    if (!validIndex(id, facts.arena.contexts.length) || !Object.is(facts.arena.contexts[id]?.id, id)) { const stop = report("context-resolves", site, "A value context resolves in this exact arena."); if (stop !== null) return stop; }
      return null;
  };
  const boundary = (id: number, site: FactsSite): DataflowStop | null => {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    if (!validIndex(id, facts.arena.boundaries.length) || !Object.is(facts.arena.boundaries[id]?.id, id)) { const stop = report("boundary-resolves", site, "A boundary resolves in this exact arena."); if (stop !== null) return stop; }
      return null;
  };
  const path = (id: number | null, site: FactsSite): DataflowStop | null => {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    if (id !== null && (!validIndex(id, facts.arena.projections.length) || !Object.is(facts.arena.projections[id]?.id, id))) {
      { const stop = report("producer-resolves", site, "A projected fact retains its actual projection-path identity."); if (stop !== null) return stop; }
    }
      return null;
  };
  const type = (id: number, site: FactsSite): DataflowStop | null => {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    if (!validIndex(id, context.types.terms.length) || context.types.terms[id] === undefined) {
      { const stop = report("type-resolves", site, "A fact type resolves in the actual supplied type table."); if (stop !== null) return stop; }
    }
      return null;
  };
  const signature = (id: number, site: FactsSite): DataflowStop | null => {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    if (!validIndex(id, context.types.signatures.length) || !Object.is(context.types.signatures[id]?.id, id)) {
      { const stop = report("signature-resolves", site, "A fact signature resolves in the actual supplied signature table."); if (stop !== null) return stop; }
    }
      return null;
  };
  const ordered = <Value>(rows: readonly Value[], rule: FactsRule, comparator: (left: Value, right: Value) => number, site: (row: Value) => FactsSite): DataflowStop | null => {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    let previous: Value | null = null;
    for (const row of rows) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

      if (previous !== null && comparator(previous, row) >= 0) { const stop = report(rule, site(row), "Fact rows retain distinct canonical endpoint order."); if (stop !== null) return stop; }
      previous = row;
    }
      return null;
  };
  const nodeOrder = <Value extends { readonly node: NodeId }>(rows: readonly Value[], rule: FactsRule): DataflowStop | null =>
    ordered(rows, rule, (left, right) => compareNumbers(left.node, right.node), row => at(row.node));
  const target = (value: EscapeTarget, site: FactsSite): DataflowStop | null => {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    switch (value.kind) {
      case "return": case "throw": break;
      case "shared":
        if (!context.definitionExists(value.definition)) { const stop = report("producer-resolves", site, "A shared target retains its actual declaration."); if (stop !== null) return stop; }
        { const stop = path(value.path, site); if (stop !== null) return stop; } break;
      case "parameter":
        if (!validIndex(value.index, tir.params.length) || tir.params[value.index] === undefined) { const stop = report("producer-resolves", site, "An escape retains its actual declaration parameter index."); if (stop !== null) return stop; }
        { const stop = path(value.path, site); if (stop !== null) return stop; } break;
      case "capture":
        if (!validIndex(value.index, tir.captures.length) || tir.captures[value.index] === undefined) { const stop = report("capture-locations-exact", site, "An escape retains its actual captured-location index."); if (stop !== null) return stop; }
        { const stop = path(value.path, site); if (stop !== null) return stop; } break;
      case "receiver":
        if (!validIndex(tir.signature, context.types.signatures.length) || !Object.is(context.types.signatures[tir.signature]?.id, tir.signature) ||
          context.types.signatures[tir.signature]?.receiver === null) { const stop = report("producer-resolves", site, "A receiver escape retains an actual receiver slot."); if (stop !== null) return stop; }
        { const stop = path(value.path, site); if (stop !== null) return stop; } break;
      case "callback": case "suspension":
        if (value.at.kind === "node") {
          if (value.at.node.kind === "body") { const stop = nodeRef(value.at.node.value, site); if (stop !== null) return stop; }
          else { const stop = report("cross-owner-qualified", site, "A body retention occurrence belongs to this exact source body."); if (stop !== null) return stop; }
        }
        else {
          if (!context.libraryExportExists(value.at.identity)) { const stop = report("relational-site-resolves", site, "An escape retains an existing declared library export."); if (stop !== null) return stop; }
          const count = context.declaredSiteCount(value.at.identity);
          if (count === null || !validIndex(value.at.site, count)) { const stop = report("declared-site-ordinal", site,
            "An escape's declared site retains its actual library export and logical allocation ordinal."); if (stop !== null) return stop; }
        }
        break;
      case "external": { const stop = boundary(value.boundary, site); if (stop !== null) return stop; } break;
    }
      return null;
  };
  const retention = (rows: readonly RetentionFact[], site: FactsSite): DataflowStop | null => {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    for (const row of rows) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
 { const stop = producer(row.source, site); if (stop !== null) return stop; } { const stop = target(row.into, site); if (stop !== null) return stop; } }
      return null;
  };
  for (const row of facts.arena.producers) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

    const site: FactsSite = { kind: "producer", owner, producer: row.id };
    if (row.kind === "parameter" && (!validIndex(row.index, tir.params.length) || tir.params[row.index] === undefined) ||
      row.kind === "capture" && (!validIndex(row.index, tir.captures.length) || tir.captures[row.index] === undefined) ||
      row.kind === "receiver" && (!validIndex(tir.signature, context.types.signatures.length) ||
        !Object.is(context.types.signatures[tir.signature]?.id, tir.signature) || context.types.signatures[tir.signature]?.receiver === null)) {
      { const stop = report("producer-resolves", site, "A producer retains its actual body parameter, receiver or captured-location slot."); if (stop !== null) return stop; }
    }
  }

  const liveness = verifyLiveness(facts.liveness, facts.execution.instance, mir, context, account);
  if (liveness.kind !== "complete") return liveness;
  for (const violation of liveness.violations) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

    const output = chargeResultEntries(account, 1);
    if (output !== null) return output;
    violations.push(violation);
  }
  { const stop = ordered(facts.initialization.reads, "initialization-order", (left, right) => compareNumbers(left.node, right.node)
    || compareNumbers(left.place, right.place), row => at(row.node)); if (stop !== null) return stop; }
  for (const read of facts.initialization.reads) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
 { const stop = node(read.node); if (stop !== null) return stop; } { const stop = place(read.place, at(read.node)); if (stop !== null) return stop; } }
  { const stop = nodeOrder(facts.refinements.refinements, "refinements-order"); if (stop !== null) return stop; }
  for (const refinement of facts.refinements.refinements) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

    { const stop = node(refinement.node); if (stop !== null) return stop; } for (const guard of refinement.guards) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
 const stop = node(guard); if (stop !== null) return stop; }
    if (refinement.kind === "unproven" && refinement.reason.kind === "invalidated") for (const invalidation of refinement.reason.sites) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
 const stop = nodeRef(invalidation.at, at(refinement.node)); if (stop !== null) return stop; }
  }
  { const stop = nodeOrder(facts.refinements.integers, "integer-facts-order"); if (stop !== null) return stop; }
  const integerNodes = new Set<NodeId>();
  for (const integer of facts.refinements.integers) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

    const output = chargeResultEntries(account, 1);
    if (output !== null) return output;
    integerNodes.add(integer.node); { const stop = node(integer.node); if (stop !== null) return stop; }
    if (integer.range !== null && integer.range.minimum > integer.range.maximum) { const stop = report("integer-range-valid", at(integer.node), "An exact integer interval has ordered bigint endpoints."); if (stop !== null) return stop; }
    if (integer.range !== null && integer.nonnegative && integer.range.maximum < 0n) {
      { const stop = report("integer-proofs-consistent", at(integer.node), "A published interval and nonnegative proof cannot contradict one another."); if (stop !== null) return stop; }
    }
  }
  let sameIntegerDomain = integerNodes.size === valueNodes.size;
  for (const id of valueNodes) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
if (!integerNodes.has(id)) sameIntegerDomain = false;
  }
  if (!sameIntegerDomain) {
    { const stop = report("integer-facts-domain-exact", bodySite, "Integer proofs retain every actual checked value occurrence, including explicit absent proofs."); if (stop !== null) return stop; }
  }
  { const stop = ordered(facts.refinements.countedLoops, "counted-loops-order",
    (left, right) => compareNumbers(left.statement, right.statement), row => at(row.statement)); if (stop !== null) return stop; }
  const resolvesCounter = (reference: TirNode, declaration: DeclarationTarget): boolean => {
    if (reference.kind !== "Identifier") return false;
    const annotation = reference.tsonic;
    if (!("resolution" in annotation)) return false;
    const resolution = annotation.resolution;
    return resolution.kind === "local" && declaration.kind === "local"
      ? resolution.local.body === declaration.local.body && resolution.local.local === declaration.local.local
      : resolution.kind === "definition" && declaration.kind === "definition" && resolution.definition === declaration.definition;
  };
  let provedLoops: readonly CountedLoopFact[] | null = null;
  for (const loop of facts.refinements.countedLoops) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

    const site = at(loop.statement);
    for (const endpoint of [loop.statement, loop.counterDeclaration, loop.bound, loop.body]) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

      if (!nodes.has(endpoint)) { const stop = report("counted-loop-endpoints-resolve", site, "A counted-loop anchor must retain an actual occurrence in its qualified body."); if (stop !== null) return stop; }
    }
    const statement = nodes.get(loop.statement);
    const counter = nodes.get(loop.counterDeclaration);
    const startWork = chargeWork(account, 1);
    if (startWork !== null) return startWork;
    const start = loop.start;
    const initialized = counter?.kind === "VariableDeclaration" && counter.initializer?.id === start.node
      && start.body === (counter.tsonic.initializer ?? tir.body);
    if (start.body === tir.body ? !nodes.has(start.node) : !initialized) {
      const stop = report("counted-loop-endpoints-resolve", site, "A counted-loop anchor must retain an actual occurrence in its qualified body.");
      if (stop !== null) return stop;
    }
    if (statement?.kind !== "ForStatement" || !initialized ||
      statement.statement.id !== loop.body || statement.condition?.kind !== "BinaryExpression" || statement.condition.operatorToken.kind !== "LessThanToken" ||
      statement.condition.right.id !== loop.bound || !resolvesCounter(statement.condition.left, counter.tsonic.declaration) ||
      statement.initializer?.kind !== "VariableDeclarationList" || statement.initializer.declarations.nodes.length !== 1 ||
      statement.initializer.declarations.nodes[0]?.id !== counter.id || statement.incrementor === null ||
      (statement.incrementor.kind !== "PostfixUnaryExpression" && statement.incrementor.kind !== "PrefixUnaryExpression") ||
      statement.incrementor.operator !== "PlusPlusToken" || !resolvesCounter(statement.incrementor.operand, counter.tsonic.declaration)) {
      { const stop = report("counted-loop-conditions-exact", site, "A counted loop retains its actual initialized counter, exclusive upper comparison and unit increment."); if (stop !== null) return stop; }
      continue;
    }
    if (provedLoops === null) {
      const derived = countedLoops(account, mir, provided, node => nodes.get(node));
      if (derived.kind !== "complete") return derived;
      provedLoops = derived.value;
    }
    let lower = 0;
    let upper: number = provedLoops.length;
    let matching = false;
    while (lower < upper) {
      const work = chargeWork(account, 1);
      if (work !== null) return work;
      const middle = lower + Math.floor((upper - lower) / 2);
      const proof: CountedLoopFact | undefined = provedLoops[middle];
      if (proof === undefined) break;
      if (proof.statement < loop.statement) lower = middle + 1;
      else if (proof.statement > loop.statement) upper = middle;
      else {
        matching = proof.counterDeclaration === loop.counterDeclaration && proof.start.body === start.body && proof.start.node === start.node
          && proof.bound === loop.bound && proof.body === loop.body && proof.direction === loop.direction
          && proof.comparison === loop.comparison && proof.step === loop.step;
        break;
      }
    }
    if (!matching) {
      const stop = report("counted-loop-conditions-exact", site, "A counted loop must be proved by its entry's MIR control flow and owned counter storage.");
      if (stop !== null) return stop;
    }
  }

  { const stop = ordered(facts.origins.points, "points-order", (left, right) => compareNumbers(left.point.block, right.point.block) ||
    compareNullableNumber(left.point.statement, right.point.statement, 1) || compareNumbers(left.place, right.place), () => bodySite); if (stop !== null) return stop; }
  for (const entry of facts.origins.points) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
 { const stop = point(entry.point, bodySite, "point-refs-resolve"); if (stop !== null) return stop; } { const stop = place(entry.place, bodySite); if (stop !== null) return stop; } { const stop = origins(entry.origins, bodySite); if (stop !== null) return stop; } }
  { const stop = ordered(facts.origins.reads, "reads-order", (left, right) => compareNumbers(left.node, right.node) || compareNumbers(left.place, right.place), row => at(row.node)); if (stop !== null) return stop; }
  for (const read of facts.origins.reads) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
 { const stop = node(read.node); if (stop !== null) return stop; } { const stop = place(read.place, at(read.node)); if (stop !== null) return stop; } { const stop = origins(read.origins, at(read.node)); if (stop !== null) return stop; } }
  { const stop = ordered(facts.origins.subjects, "subjects-order", (left, right) => compareNumbers(left.node, right.node) || compareText(left.role, right.role) ||
    compareNullableNumber(left.path, right.path, -1), row => at(row.node)); if (stop !== null) return stop; }
  for (const subject of facts.origins.subjects) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
 { const stop = node(subject.node); if (stop !== null) return stop; } { const stop = path(subject.path, at(subject.node)); if (stop !== null) return stop; } { const stop = origins(subject.origins, at(subject.node)); if (stop !== null) return stop; } }
  { const stop = ordered(facts.origins.writes, "writes-order", (left, right) => comparePoints(left.point, right.point) || compareNumbers(left.node, right.node), row => at(row.node)); if (stop !== null) return stop; }
  for (const write of facts.origins.writes) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

    { const stop = node(write.node); if (stop !== null) return stop; } const site = at(write.node); { const stop = point(write.point, site); if (stop !== null) return stop; }
    for (const id of write.targets) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
 const stop = producer(id, site, true); if (stop !== null) return stop; }
    if (write.owner !== null) { const stop = producer(write.owner, site, true); if (stop !== null) return stop; }
    for (const value of write.values) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
 if (value.source !== null) { const stop = nodeRef(value.source, site); if (stop !== null) return stop; } { const stop = origins(value.origins, site); if (stop !== null) return stop; } }
    for (const id of write.boundaries) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
 const stop = boundary(id, site); if (stop !== null) return stop; }
  }
  let previousEscape: EscapeFact | null = null;
  let previousEscapeKey = "";
  for (const escape of facts.origins.escapes) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    const identity = escapeTargetKey(escape.target, account);
    if (identity.kind !== "complete") return identity;
    const key = identity.value;
    const comparison = chargeWork(account, previousEscapeKey.length + key.length);
    if (comparison !== null) return comparison;
    if (previousEscape !== null && (comparePoints(previousEscape.point, escape.point)
      || compareNumbers(previousEscape.node, escape.node) || compareNumbers(previousEscape.producer, escape.producer)
      || compareText(previousEscapeKey, key)) >= 0) {
      const stop = report("escapes-order", at(escape.node), "Fact rows retain distinct canonical endpoint order.");
      if (stop !== null) return stop;
    }
    previousEscape = escape;
    previousEscapeKey = key;
  }
  for (const escape of facts.origins.escapes) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    { const stop = node(escape.node); if (stop !== null) return stop; } { const stop = point(escape.point, at(escape.node)); if (stop !== null) return stop; } { const stop = producer(escape.producer, at(escape.node)); if (stop !== null) return stop; } { const stop = target(escape.target, at(escape.node)); if (stop !== null) return stop; }
  }
  for (const exit of [facts.origins.exitContents.onReturn, facts.origins.exitContents.onUnwind]) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

    { const stop = ordered(exit, "writes-order", (left, right) => compareNumbers(left.target, right.target) || compareNumbers(left.value, right.value), () => bodySite); if (stop !== null) return stop; }
    for (const write of exit) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

      if (!validIndex(write.target, facts.arena.cells.length) || !Object.is(facts.arena.cells[write.target]?.id, write.target))
        { const stop = report("cell-role-resolves", bodySite, "An exit-content write resolves in its actual logical-cell arena."); if (stop !== null) return stop; }
      { const stop = origins(write.value, bodySite); if (stop !== null) return stop; }
    }
  }
  const checkArgument = (argument: ArgumentTransport, site: FactsSite): DataflowStop | null => {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    if (argument.kind === "provided") {
      const stop = origins(argument.actual, site) ?? path(argument.projection, site);
      if (stop !== null) return stop;
    } else if (argument.kind !== "omitted" || "authoredIndex" in argument || "repeated" in argument
      || "passing" in argument || "actual" in argument || "projection" in argument) {
      const stop = report("argument-transports-total", site, "An omitted formal carries no authored operand, passing mode, origins or projection.");
      if (stop !== null) return stop;
    }
    if (!Number.isSafeInteger(argument.parameterIndex) || argument.parameterIndex < 0 || Object.is(argument.parameterIndex, -0) ||
      argument.kind === "provided" && (!Number.isSafeInteger(argument.authoredIndex) || argument.authoredIndex < 0 || Object.is(argument.authoredIndex, -0))) {
      { const stop = report("argument-transports-total", site, "A transport retains actual nonnegative authored and formal indices."); if (stop !== null) return stop; }
    }
    const identity = admitOwnerIdentity(argument.formal.owner, account);
    if (identity !== null) return identity;
    const foreign = context.arenaOf(argument.formal.owner);
    const formal = foreign === null ? undefined : foreign.producers[argument.formal.producer];
    if (foreign === null) { const stop = report("cross-owner-qualified", site, "A formal producer retains a resolving qualified relational owner."); if (stop !== null) return stop; }
    else if (!validIndex(argument.formal.producer, foreign.producers.length) || formal === undefined || !Object.is(formal.id, argument.formal.producer)) {
      { const stop = report("producer-resolves", site, "The actual formal producer resolves in its declared foreign arena."); if (stop !== null) return stop; }
    } else if (formal.kind !== "parameter" || formal.index !== argument.parameterIndex) { const stop = report("argument-transports-total", site,
        "A transport's formal producer retains its actual declaration parameter position."); if (stop !== null) return stop; }
    if (!context.definitionExists(argument.parameter)) { const stop = report("argument-transports-total", site, "A transport retains its actual parameter declaration."); if (stop !== null) return stop; }
      return null;
  };
  { const stop = ordered(facts.origins.invocations, "invocations-order", (left, right) => comparePoints(left.point, right.point), row => at(row.node)); if (stop !== null) return stop; }
  for (const invocation of facts.origins.invocations) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

    { const stop = node(invocation.node); if (stop !== null) return stop; } const site = at(invocation.node);
    { const stop = point(invocation.point, site); if (stop !== null) return stop; }
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const block = validIndex(invocation.point.block, mir.blocks.length) ? mir.blocks[invocation.point.block] : undefined;
    const operation = invocation.point.statement === null ? block?.terminator : undefined;
    if (operation?.kind !== "call" || operation.tir.body !== facts.execution.instance.body || operation.tir.node !== invocation.node) {
      const stop = report("cross-owner-qualified", site, "An invocation retains its actual MIR call occurrence and qualified source node.");
      if (stop !== null) return stop;
    }
    const syntax = nodes.get(invocation.node);
    const phase = syntax?.kind === "CallExpression" || syntax?.kind === "NewExpression" || syntax?.kind === "TaggedTemplateExpression"
      ? syntax.tsonic : null;
    const application = phase !== null && "application" in phase && phase.application.kind === "decided" ? phase.application.decision : null;
    const authored = new Map<NodeId, number>();
    if (syntax?.kind === "CallExpression" || syntax?.kind === "NewExpression") {
      const args = syntax.arguments;
      if (args !== null && "kind" in args) {
        const stop = report("cross-owner-qualified", site, "A layout quotation is not a runtime invocation.");
        if (stop !== null) return stop;
      }
      for (const [index, argument] of (args === null || "kind" in args ? [] : args.nodes).entries()) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

        const output = chargeResultEntries(account, 1);
        if (output !== null) return output;
        authored.set(argument.kind === "SpreadElement" ? argument.expression.id : argument.id, index);
      }
    }
    for (const id of invocation.boundaries) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
 const stop = boundary(id, site); if (stop !== null) return stop; }
    for (const alternative of invocation.alternatives) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

      const decision = alternative.resolution.decision;
      const identity = admitOwnerIdentity({ kind: "summary", key: alternative.summary }, account);
      if (identity !== null) return identity;
      { const stop = valueContext(alternative.context, site); if (stop !== null) return stop; } { const stop = origins(alternative.result, site); if (stop !== null) return stop; } { const stop = origins(alternative.thrown, site); if (stop !== null) return stop; }
      { const stop = signature(decision.advertised.signature, site); if (stop !== null) return stop; } { const stop = signature(decision.api.signature, site); if (stop !== null) return stop; } { const stop = signature(decision.completion.signature, site); if (stop !== null) return stop; }
      { const stop = type(decision.result, site); if (stop !== null) return stop; } { const stop = type(decision.completion.completion, site); if (stop !== null) return stop; }
      if (decision.completion.yielded !== null) { const stop = type(decision.completion.yielded, site); if (stop !== null) return stop; }
      if (decision.completion.sent !== null) { const stop = type(decision.completion.sent, site); if (stop !== null) return stop; }
      const completion = context.types.signatures[decision.completion.signature];
      const selected = Object.is(completion?.id, decision.completion.signature) ? completion : undefined;
      const receiver = facts.arena.contexts[alternative.context];
      const mappings = new Map<number, ParameterMapping>();
      const restAuthored = new Map<number, Set<number>>();
      for (const mapping of decision.parameters) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

        const growth = chargeResultEntries(account, 1);
        if (growth !== null) return growth;
        mappings.set(mapping.parameter, mapping);
        if (mapping.kind === "rest") {
          const first = chargeResultEntries(account, 2);
          if (first !== null) return first;
          const authored = new Set<number>();
          for (const argument of mapping.arguments) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

            const output = chargeResultEntries(account, 1);
            if (output !== null) return output;
            authored.add(argument);
          }
          restAuthored.set(mapping.parameter, authored);
        }
      }
      const consumed = new Map<number, Set<number>>();
      for (const mapping of decision.parameters) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
if (mapping.kind === "argument" && mapping.component !== null) {
        const components = consumed.get(mapping.argument);
        const output = chargeResultEntries(account, components === undefined ? 3 : 1);
        if (output !== null) return output;
        if (components === undefined) consumed.set(mapping.argument, new Set([mapping.component]));
        else components.add(mapping.component);
      }
  }
      const restParts = new Map<number, TirArgument>();
      if (application !== null) for (const argument of application.arguments) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
if (argument.kind === "rest") {
        const output = chargeResultEntries(account, 1);
        if (output !== null) return output;
        restParts.set(argument.parameter, argument);
      }
  }
      const expectedRests = new Map<number, readonly TransportShape[]>();
      for (const mapping of decision.parameters) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
if (mapping.kind === "rest") {
        const output = chargeResultEntries(account, 2);
        if (output !== null) return output;
        const shapes: TransportShape[] = [];
        if (mapping.arguments.length === 0) expectedRests.set(mapping.parameter, shapes);
        else {
          const rest = restParts.get(mapping.parameter);
          if (rest !== undefined && rest.kind === "rest") {
            for (const part of rest.parts) {
    const step = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (step !== null) return step;

              const index = authored.get(part.expression);
              if (index === undefined || !restAuthored.get(mapping.parameter)?.has(index)) {
                { const stop = report("argument-transports-total", site, "Rest transports retain their actual selected authored spread and value occurrences."); if (stop !== null) return stop; }
              } else if (part.kind === "value") shapes.push({ authoredIndex: index, repeated: false, component: null });
              else if (part.tuple === null) shapes.push({ authoredIndex: index, repeated: true, component: null });
              else for (const [component] of part.tuple.entries()) {
    const step = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (step !== null) return step;
if (!consumed.get(index)?.has(component)) {
                shapes.push({ authoredIndex: index, repeated: false, component });
              }
  }
            }
            expectedRests.set(mapping.parameter, shapes);
          }
        }
      }
  }
      if (selected !== undefined && receiver !== undefined && (receiver.arguments.length !== selected.parameters.length ||
        (receiver.receiver === null) !== (selected.receiver === null))) { const stop = report("context-arguments-total", site,
        "Each invocation context retains every actual selected parameter and receiver slot."); if (stop !== null) return stop; }
      let previousAuthored: number | null = null;
      const supplied = new Map<number, number>();
      const rests = new Map<number, ProvidedTransport[]>();
      for (const argument of alternative.arguments) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

        { const stop = checkArgument(argument, site); if (stop !== null) return stop; }
        if (argument.kind === "provided") {
          if (previousAuthored !== null && compareNumbers(previousAuthored, argument.authoredIndex) > 0) { const stop = report("argument-transports-authored-order", site,
            "Transports retain authored actual evaluation order without inventing a flattened runtime slot."); if (stop !== null) return stop; }
          previousAuthored = argument.authoredIndex;
        }
        const parameter = selected?.parameters[argument.parameterIndex];
        const mapping = mappings.get(argument.parameterIndex);
        if ((selected !== undefined && (parameter === undefined || parameter.declaration !== argument.parameter
          || (argument.kind === "provided" ? parameter.passing !== argument.passing : !parameter.acceptsOmission))) ||
          mapping === undefined || argument.kind === "provided" && mapping.kind !== "rest" && argument.repeated) { const stop = report("argument-transports-total", site,
          "Transports retain complete selected formals, passing modes and effective actual components exactly once."); if (stop !== null) return stop; }
        const slot = receiver?.arguments[argument.parameterIndex];
        const actualSlot = operation?.kind === "call" && operation.callee.kind === "direct" && application !== null
          && mapping !== undefined && mapping.kind !== "rest" ? operation.arguments[argument.parameterIndex] : undefined;
        if (actualSlot !== undefined && (actualSlot.kind === "omitted") !== (argument.kind === "omitted")) {
          const stop = report("argument-transports-total", site, "A transport retains its actual MIR provided or omitted disposition.");
          if (stop !== null) return stop;
        }
        if (argument.kind === "omitted") {
          if ((mapping?.kind !== "default" && mapping?.kind !== "omitted") || receiver !== undefined && slot?.kind !== "omitted") {
            const stop = report("argument-transports-total", site, "An omitted transport must match its selected omission and omitted context slot.");
            if (stop !== null) return stop;
          }
        } else if (argument.kind === "provided" && mapping !== undefined &&
          Number.isSafeInteger(argument.authoredIndex) && argument.authoredIndex >= 0 && !Object.is(argument.authoredIndex, -0)) {
          const valid = mapping.kind === "argument" ? argument.authoredIndex === mapping.argument
            : mapping.kind === "rest" && restAuthored.get(mapping.parameter)?.has(argument.authoredIndex) === true;
          const projection = argument.projection === null ? null : facts.arena.projections[argument.projection]?.projection;
          if (!valid || receiver !== undefined && (slot?.kind !== "provided" || mapping.kind !== "rest" && slot.origins !== argument.actual) ||
            mapping.kind === "argument" && (mapping.component === null ? argument.projection !== null
              : !Number.isSafeInteger(mapping.component) || mapping.component < 0 || Object.is(mapping.component, -0) ||
                projection?.kind !== "index" || projection.constant !== BigInt(mapping.component))) {
            { const stop = report("argument-transports-total", site, "A transport retains its actual selected argument, default, omission or rest mapping and correlated origins."); if (stop !== null) return stop; }
          }
        }
        if (mapping?.kind === "rest" && argument.kind === "provided") {
          const rows = rests.get(argument.parameterIndex);
          const output = chargeResultEntries(account, rows === undefined ? 2 : 1);
          if (output !== null) return output;
          if (rows === undefined) rests.set(argument.parameterIndex, [argument]); else rows.push(argument);
        }
        const output = chargeResultEntries(account, 1);
        if (output !== null) return output;
        supplied.set(argument.parameterIndex, (supplied.get(argument.parameterIndex) ?? 0) + 1);
        if (argument.formal.owner.kind !== "summary" || summaryKey(argument.formal.owner.key) !== summaryKey(alternative.summary)) { const stop = report("cross-owner-qualified", site,
          "An argument's formal producer belongs to this exact callee summary and complete binding environment."); if (stop !== null) return stop; }
      }
      for (const [index, parameter] of selected?.parameters.entries() ?? []) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

        if (parameter !== undefined && parameter.kind !== "rest" && supplied.get(index) !== 1) { const stop = report("argument-transports-total", site,
          "Every non-rest selected formal has its complete actual or explicit omitted transport."); if (stop !== null) return stop; }
      }
      for (const [parameter, shapes] of expectedRests) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

        const rows = rests.get(parameter) ?? [];
        let exact = rows.length === shapes.length;
        for (let position = 0; position < shapes.length; position += 1) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

          const shape = shapes[position];
          const row = rows[position];
          if (shape === undefined || row === undefined) { exact = false; continue; }
          const projection = row.projection === null ? null : facts.arena.projections[row.projection]?.projection;
          if (shape.authoredIndex !== row.authoredIndex || shape.repeated !== row.repeated
            || (shape.component === null ? shape.repeated ? projection?.kind !== "element" : projection !== null
              : projection?.kind !== "index" || projection.constant !== BigInt(shape.component))) exact = false;
        }
        if (!exact) { const stop = report("argument-transports-total", site,
          "Rest transports retain every actual unconsumed tuple component or one symbolic repeated sequence, including known empty spreads."); if (stop !== null) return stop; }
      }
      const activation = alternative.resolution.activation;
      const environment: ArtifactBindings = { kind: "instantiated", bindings: decision.implementationBindings };
      if (activation === null) {
        const selectedBindings = admitArtifactIdentity(environment, account);
        if (selectedBindings !== null) return selectedBindings;
      }
      const actual = activation === null ? null : context.tirBody(activation);
      const captured = actual === null ? 0 : actual.captures.length;
      const activationValid = actual === null || activation === null || actual.body === activation.body && actual.owner === decision.api.declaration &&
        sameBindings(actual.bindings, activation.bindings) && sameBindings(activation.bindings, environment);
      let provided = 0;
      for (const parameter of decision.parameters) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
if (parameter.kind === "argument") provided += 1;
  }
      const summary = alternative.summary;
      let selectedExecution = false;
      if (activation !== null) selectedExecution = summary.kind === "body" && instanceKey(summary.execution.instance) === instanceKey(activation);
      else if (summary.kind === "declared" && summary.execution.request.definition === decision.api.declaration
        && summary.execution.request.endpoint === decision.api.role && Object.is(context.types.signatures[decision.api.signature]?.id, decision.api.signature)) {
        const bound = context.signatureIdOf(summary.execution.request);
        selectedExecution = bound !== null && (selected === undefined || Object.is(bound, selected.id));
      }
      if (summaryDefinition(summary, context) !== decision.api.declaration || !sameBindings(summaryBindings(summary), environment) ||
        !selectedExecution || !Object.is(summary.execution.provided, provided) || !activationValid) { const stop = report("summary-reference-exact", site,
        "An invocation names the actual selected declaration and exact instantiated summary environment."); if (stop !== null) return stop; }
      const captureSet = new Set<string>();
      if (actual !== null) for (let position = 0; position < actual.captures.length; position += 1) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

        const row = actual.captures[position];
        if (row === undefined || !context.localExists(row.local)) {
          { const stop = report("capture-locations-exact", site, "An invocation capture retains its actual qualified local location."); if (stop !== null) return stop; }
          continue;
        }
        if (receiver !== undefined) {
          const read = chargeWork(account, 1);
          if (read !== null) return read;
          const selected = receiver.captures[position];
          if (selected !== undefined && (selected.index !== position ||
            (row.capture === "captured-value") !== ("origins" in selected))) {
            const stop = report("capture-locations-exact", site, "A capture binds the actual selected caller value or location, never the other mode.");
            if (stop !== null) return stop;
          }
        }
        const output = chargeWork(account, row.local.body.length) ?? chargeResultEntries(account, 2);
        if (output !== null) return output;
        captureSet.add(encodeKey([row.local.body, row.local.local]));
      }
      if (captureSet.size !== captured || receiver !== undefined && receiver.captures.length !== captured) {
        { const stop = report("invocation-contexts-correlated", site, "Each invocation alternative retains its own complete actual captured-location vector."); if (stop !== null) return stop; }
      }
    }
  }
  { const stop = nodeOrder(facts.origins.callbacks, "callbacks-order"); if (stop !== null) return stop; }
  for (const callback of facts.origins.callbacks) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

    { const stop = node(callback.node); if (stop !== null) return stop; }
    if (callback.argument.kind !== "provided") {
      const stop = report("argument-transports-total", at(callback.node), "A callback argument requires an actual provided transport.");
      if (stop !== null) return stop;
    }
    { const stop = checkArgument(callback.argument, at(callback.node)); if (stop !== null) return stop; }
    for (const input of callback.inputs) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
if (!Number.isSafeInteger(input.parameterIndex) || input.parameterIndex < 0 || Object.is(input.parameterIndex, -0) ||
      input.kind === "argument-element" && (!Number.isSafeInteger(input.sourceParameterIndex) || input.sourceParameterIndex < 0 || Object.is(input.sourceParameterIndex, -0))) {
      { const stop = report("argument-transports-total", at(callback.node), "A callback input retains actual nonnegative formal channel indices."); if (stop !== null) return stop; }
    }
  }
  }
  const numberKey = (value: number): string => Object.is(value, -0) ? "-0" : String(value);
  const pointKey = (value: MirPoint): string => encodeKey([numberKey(value.block), value.statement === null ? null : numberKey(value.statement)]);
  const selectedActivationKey = (point: MirPoint, node: NodeId, valueContextId: number, selected: BodyInstance): string =>
    encodeKey([pointKey(point), numberKey(node), numberKey(valueContextId), instanceKey(selected)]);
  const invocationPoints = new Set<string>();
  const selectedActivations = new Set<string>();
  for (const invocation of facts.origins.invocations) {
    const work = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (work !== null) return work;
    const occurrence = pointKey(invocation.point);
    if (invocationPoints.has(occurrence)) continue;
    invocationPoints.add(occurrence);
    for (const alternative of invocation.alternatives) {
      const step = chargeWork(account, 1);
      if (step !== null) return step;
      const selected = alternative.resolution.activation;
      if (selected === null || !validIndex(alternative.context, facts.arena.contexts.length)) continue;
      const identity = chargeWork(account, selected.body.length) ?? admitArtifactIdentity(selected.bindings, account)
        ?? chargeResultEntries(account, 1);
      if (identity !== null) return identity;
      selectedActivations.add(selectedActivationKey(invocation.point, invocation.node, alternative.context, selected));
    }
  }
  let previousActivation: BoundActivation | null = null;
  let previousInstance = "";
  let previousTransport = "";
  for (const activation of facts.origins.activations) {
    const work = chargeWork(account, 1 + activation.activation.body.length)
      ?? admitArtifactIdentity(activation.activation.bindings, account);
    if (work !== null) return work;
    const identity = argumentTransportKey(activation.entry, account);
    if (identity.kind !== "complete") return identity;
    const instance = instanceKey(activation.activation);
    const transport = identity.value;
    const comparison = chargeWork(account, instance.length + transport.length + previousInstance.length + previousTransport.length);
    if (comparison !== null) return comparison;
    if (previousActivation !== null && compareBoundActivations(previousActivation, previousInstance, previousTransport,
      activation, instance, transport) >= 0) {
      const stop = report("activations-order", at(activation.node), "Fact rows retain distinct canonical endpoint order.");
      if (stop !== null) return stop;
    }
    previousActivation = activation;
    previousInstance = instance;
    previousTransport = transport;
  }
  for (const activation of facts.origins.activations) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

    { const stop = node(activation.node); if (stop !== null) return stop; } const site = at(activation.node); { const stop = valueContext(activation.context, site); if (stop !== null) return stop; }
    { const stop = point(activation.point, site); if (stop !== null) return stop; }
    if (activation.caller !== null) { const stop = valueContext(activation.caller, site); if (stop !== null) return stop; }
    const activated = activation.activation;
    const activatedOwner = context.bodyOwner(activated.body);
    if (activatedOwner === null || !context.definitionExists(activatedOwner)) { const stop = report("producer-resolves", site,
      "An activation retains its actual executed body and its existing owner declaration."); if (stop !== null) return stop; }
    if (activation.entry !== null) {
      if (activation.entry.kind !== "provided") {
        const stop = report("argument-transports-total", site, "An argument-sourced activation retains an actual provided transport.");
        if (stop !== null) return stop;
      }
      const stop = checkArgument(activation.entry, site);
      if (stop !== null) return stop;
      continue;
    }
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const block = validIndex(activation.point.block, mir.blocks.length) ? mir.blocks[activation.point.block] : undefined;
    const operation = activation.point.statement === null ? block?.terminator : undefined;
    const call = operation?.kind === "call" && operation.tir.body === facts.execution.instance.body && operation.tir.node === activation.node
      ? operation : null;
    if (call === null) {
      const stop = report("cross-owner-qualified", site, "An activation binding retains its actual MIR call occurrence and qualified source node.");
      if (stop !== null) return stop;
    }
    if (call !== null) {
      const selected = call.callee.kind === "body" ? call.callee.instance : call.callee.resolution.activation;
      if (selected !== null) {
        const work = chargeWork(account, 1 + selected.body.length) ?? admitArtifactIdentity(selected.bindings, account);
        if (work !== null) return work;
      }
      if (selected === null || selected.body !== activated.body || !sameBindings(selected.bindings, activated.bindings)) {
        const stop = report("cross-owner-qualified", site, "A direct activation binding retains the complete selected instance of its actual MIR callee.");
        if (stop !== null) return stop;
      } else if (call.callee.kind !== "body" && !selectedActivations.has(selectedActivationKey(activation.point, activation.node, activation.context, activated))) {
        const stop = report("cross-owner-qualified", site, "A direct activation binding retains the selected invocation alternative at its exact MIR point and value context.");
        if (stop !== null) return stop;
      }
    }
  }
  { const stop = ordered(facts.origins.frontiers, "frontiers-order", (left, right) => compareNumbers(left.node, right.node) || compareText(left.kind, right.kind) ||
    compareNumbers(left.subject, right.subject) || compareNumbers(left.context, right.context), row => at(row.node)); if (stop !== null) return stop; }
  for (const frontier of facts.origins.frontiers) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
 { const stop = node(frontier.node); if (stop !== null) return stop; } { const stop = producer(frontier.subject, at(frontier.node)); if (stop !== null) return stop; } { const stop = valueContext(frontier.context, at(frontier.node)); if (stop !== null) return stop; } }
  let previousConstruction: ConstructionAlternative | null = null;
  let previousConstructionBody = "";
  for (const construction of facts.origins.constructions) {
    const work = chargeWork(account, 1 + construction.root.body.length + construction.allocation.body.length
      + (construction.implementation?.length ?? 0) + (construction.body?.body.length ?? 0))
      ?? (construction.body === null ? null : admitArtifactIdentity(construction.body.bindings, account));
    if (work !== null) return work;
    const body = construction.body === null ? "" : instanceKey(construction.body);
    const comparison = chargeWork(account, body.length + previousConstructionBody.length);
    if (comparison !== null) return comparison;
    if (previousConstruction !== null && compareConstructionAlternatives(previousConstruction, previousConstructionBody, construction, body) >= 0) {
      const stop = report("constructions-order", at(construction.node), "Fact rows retain distinct canonical endpoint order.");
      if (stop !== null) return stop;
    }
    previousConstruction = construction;
    previousConstructionBody = body;
  }
  for (const construction of facts.origins.constructions) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

    { const stop = node(construction.node); if (stop !== null) return stop; } const site = at(construction.node); { const stop = nodeRef(construction.root, site, false); if (stop !== null) return stop; } { const stop = nodeRef(construction.allocation, site, false); if (stop !== null) return stop; }
    if (construction.implementation !== null && !context.definitionExists(construction.implementation)) { const stop = report("producer-resolves", site,
      "A construction retains its actual selected implementation declaration."); if (stop !== null) return stop; }
    if (construction.body !== null) {
      const actual = context.tirBody(construction.body);
      const identity = admitArtifactIdentity(actual.bindings, account);
      if (identity !== null) return identity;
      if (actual.body !== construction.body.body || !sameBindings(actual.bindings, construction.body.bindings) ||
        construction.implementation !== null && construction.implementation !== actual.owner) {
        { const stop = report("cross-owner-qualified", site, "A construction retains its actual selected body, implementation owner and complete artifact environment."); if (stop !== null) return stop; }
      }
    }
    for (const region of construction.regions) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
 { const stop = nodeRef(region.node, site, false); if (stop !== null) return stop; } { const stop = valueContext(region.context, site); if (stop !== null) return stop; }
      if (!context.definitionExists(region.owner)) { const stop = report("cross-owner-qualified", site, "Each constructor region retains its actual lexical declaration owner."); if (stop !== null) return stop; } }
  }
  { const stop = ordered(facts.origins.instanceRegions, "regions-order", (left, right) => compareText(left.owner, right.owner) || compareText(left.node.body, right.node.body) ||
    compareNumbers(left.node.node, right.node.node) || compareNumbers(left.context, right.context), row => ({ kind: "node", at: { kind: "body", value: row.node } })); if (stop !== null) return stop; }
  for (const region of facts.origins.instanceRegions) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

    const site: FactsSite = { kind: "node", at: { kind: "body", value: region.node } };
    { const stop = nodeRef(region.node, site, false); if (stop !== null) return stop; } { const stop = valueContext(region.context, bodySite); if (stop !== null) return stop; }
    if (!context.definitionExists(region.owner)) { const stop = report("cross-owner-qualified", site, "An instance region retains its actual lexical declaration owner."); if (stop !== null) return stop; }
  }

  { const stop = nodeOrder(facts.suspension.suspensions, "suspensions-order"); if (stop !== null) return stop; }
  const suspensionKinds = new Map<NodeId, "await" | "yield" | "delegate">();
  for (const block of mir.blocks) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
if (block !== undefined &&
    (block.terminator.kind === "await" || block.terminator.kind === "yield" || block.terminator.kind === "delegate")) {
    const output = chargeResultEntries(account, 1);
    if (output !== null) return output;
    suspensionKinds.set(block.terminator.tir.node, block.terminator.kind);
  }
  }
  for (const suspension of facts.suspension.suspensions) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

    { const stop = node(suspension.node); if (stop !== null) return stop; } const site = at(suspension.node);
    const selected = suspensionKinds.get(suspension.node);
    if (selected !== suspension.kind) { const stop = report("suspension-input-site", site, "A suspension retains its actual MIR await, yield or delegated-yield occurrence."); if (stop !== null) return stop; }
    const expected = suspension.kind === "await" ? ["resume", "unwind"] : ["resume", "return", "unwind"];
    for (const value of suspension.values) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

      { const stop = place(value.place, site); if (stop !== null) return stop; } { const stop = origins(value.origins, site); if (stop !== null) return stop; } { const stop = retention(value.retention, site); if (stop !== null) return stop; }
      let sameContinuations = value.continuations.length === expected.length;
      for (let index = 0; index < value.continuations.length; index += 1)
        {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
if (value.continuations[index] !== expected[index]) sameContinuations = false;
  }
      if (!sameContinuations) {
        { const stop = report("suspension-continuations-exact", site, "Suspension continuations retain exact resume, generator-return and unwind obligations."); if (stop !== null) return stop; }
      }
    }
  }
  for (const source of facts.arena.producers) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
if (source.kind === "suspension-input") {
    const selected = suspensionKinds.get(source.at.node);
    if (source.at.body !== facts.execution.instance.body || selected === undefined || source.channel === "sent" && selected === "await") {
      { const stop = report("suspension-input-site", { kind: "producer", owner, producer: source.id }, "A suspension input retains the actual supported suspension channel and occurrence."); if (stop !== null) return stop; }
    }
  }
  }
  { const stop = nodeOrder(facts.errorStorage.errors, "errors-order"); if (stop !== null) return stop; }
  for (const error of facts.errorStorage.errors) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

    { const stop = node(error.node); if (stop !== null) return stop; } const site = at(error.node); { const stop = origins(error.origins, site); if (stop !== null) return stop; } { const stop = retention(error.retention, site); if (stop !== null) return stop; }
    for (const write of error.writes) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
 const stop = node(write); if (stop !== null) return stop; }
    { const stop = ordered(error.invalidations, "error-invalidations-order", (left, right) => compareText(left.at.body, right.at.body) || compareNumbers(left.at.node, right.at.node) || compareText(left.kind, right.kind), () => site); if (stop !== null) return stop; }
    for (const invalidation of error.invalidations) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

      { const stop = nodeRef(invalidation.at, site); if (stop !== null) return stop; }
      if (!validIndex(invalidation.owner, facts.arena.origins.length) || !Object.is(facts.arena.origins[invalidation.owner]?.id, invalidation.owner)) { const stop = report("error-invalidation-origins-resolve", site,
        "An error invalidation retains its actual owner origins in this arena."); if (stop !== null) return stop; }
      const owned = facts.arena.origins[invalidation.owner];
      if (invalidation.kind === "invalidated" && invalidation.cause === "overlapping-write") {
        if (!validIndex(invalidation.affected, facts.arena.origins.length) || !Object.is(facts.arena.origins[invalidation.affected]?.id, invalidation.affected)) { const stop = report("error-invalidation-origins-resolve", site,
          "An overlapping error write retains its actual affected origins."); if (stop !== null) return stop; }
        const affected = facts.arena.origins[invalidation.affected];
        if (affected !== undefined && affected.producers.length === 0 && affected.kind === "complete") { const stop = report("error-invalidation-outcome-exact", site,
          "A known empty affected origin cannot be claimed as an overlapping write."); if (stop !== null) return stop; }
      } else if (invalidation.kind === "invalidated" && !suspensionKinds.has(invalidation.at.node)) {
        { const stop = report("error-invalidation-outcome-exact", site, "A suspension invalidation retains an actual suspension occurrence."); if (stop !== null) return stop; }
      } else if (invalidation.kind === "preserved" && owned?.kind === "open") {
        { const stop = report("error-invalidation-outcome-exact", site, "Unknown error-owner origins cannot be relabelled as a proven preserved owner."); if (stop !== null) return stop; }
      } else if (invalidation.kind === "unproven") {
        const reason = invalidation.reason;
        const id = reason.kind === "incomplete-origins" || reason.kind === "opaque-invocation-footprint" ? reason.affected
          : reason.kind === "open-constructor-domain" ? reason.constructor : null;
        if (id !== null && (!validIndex(id, facts.arena.origins.length) || !Object.is(facts.arena.origins[id]?.id, id))) { const stop = report("error-invalidation-origins-resolve", site,
          "An unproven error reason retains its actual affected or constructor origins."); if (stop !== null) return stop; }
        if ((reason.kind === "incomplete-origins" || reason.kind === "open-constructor-domain") && id !== null && facts.arena.origins[id]?.kind === "complete") {
          { const stop = report("error-invalidation-outcome-exact", site, "An incomplete-domain reason must retain an actually open origin domain."); if (stop !== null) return stop; }
        }
      }
    }
  }
  { const stop = nodeOrder(facts.pointerBacking.pointers, "pointers-order"); if (stop !== null) return stop; }
  const pointerAlternatives = new Map<number, ReadonlySet<number>>();
  for (const pointer of facts.pointerBacking.pointers) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

    { const stop = node(pointer.node); if (stop !== null) return stop; } const site = at(pointer.node); { const stop = origins(pointer.origins, site); if (stop !== null) return stop; }
    const actual = facts.arena.origins[pointer.origins];
    if (actual !== undefined && !pointerAlternatives.has(pointer.origins)) {
      const growth = chargeWork(account, actual.producers.length) ?? chargeResultEntries(account, 1 + actual.producers.length);
      if (growth !== null) return growth;
      const copy = chargeWork(account, actual.producers.length) ?? chargeResultEntries(account, actual.producers.length + 2);
      if (copy !== null) return copy;
      pointerAlternatives.set(pointer.origins, new Set(actual.producers));
    }
    const alternatives = pointerAlternatives.get(pointer.origins);
    for (const backing of pointer.producers) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

      { const stop = producer(backing.producer, site, true); if (stop !== null) return stop; } { const stop = nodeRef(backing.operation.at, site); if (stop !== null) return stop; }
      if (alternatives !== undefined && !alternatives.has(backing.producer)) {
        { const stop = report("pointer-backing-family-exact", site, "Each pointer backing retains its own correlated producer and exact typed-location or raw-memory operation."); if (stop !== null) return stop; }
      }
    }
  }
  const metadataLayout = (reference: MetadataLayoutRef, site: FactsSite): DataflowResult<MemoryLayout | undefined> => {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    const admitted = admitArtifactIdentity(reference.metadata.bindings, account);
    if (admitted !== null) return admitted;
    const record = context.metadataOf(reference.metadata);
    const recordIdentity = record === null ? null : admitArtifactIdentity(record.key.bindings, account);
    if (recordIdentity !== null) return recordIdentity;
    const selected = record !== null && record.kind !== "data-layout" && validIndex(reference.layout, record.layouts.length) ? record.layouts[reference.layout] : undefined;
    if (record === null || selected === undefined || !Object.is(selected.id, reference.layout) || record.key.definition !== reference.metadata.definition ||
      !sameBindings(record.key.bindings, reference.metadata.bindings)) { const stop = report("metadata-reference-resolves", site,
      "A layout reference retains its actual metadata declaration, complete binding environment and local layout ID."); if (stop !== null) return stop; }
    return { kind: "complete", value: selected };
  };
  const metadataField = (reference: MetadataFieldRef, site: FactsSite): DataflowResult<MemoryField | undefined> => {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    const record = context.metadataOf(reference.metadata);
    const selected = record !== null && record.kind !== "data-layout" && validIndex(reference.field, record.fields.length) ? record.fields[reference.field] : undefined;
    if (record === null || selected === undefined || !Object.is(selected.id, reference.field) || record.key.definition !== reference.metadata.definition ||
      !sameBindings(record.key.bindings, reference.metadata.bindings)) { const stop = report("metadata-reference-resolves", site,
      "A field reference retains its actual metadata declaration, complete binding environment and local field ID."); if (stop !== null) return stop; }
    return { kind: "complete", value: selected };
  };
  { const stop = nodeOrder(facts.rawLocations, "raw-locations-order"); if (stop !== null) return stop; }
  for (const raw of facts.rawLocations) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

    { const stop = node(raw.node); if (stop !== null) return stop; } const site = at(raw.node); { const stop = type(raw.pointee, site); if (stop !== null) return stop; } { const stop = valueContext(raw.context, site); if (stop !== null) return stop; }
    const selectedLayout = metadataLayout(raw.layout, site);
    if (selectedLayout.kind !== "complete") return selectedLayout;
    const selected = selectedLayout.value;
    if (selected !== undefined && selected.source !== raw.pointee) { const stop = report("cross-owner-qualified", site, "A raw location retains its actual selected pointee layout."); if (stop !== null) return stop; }
  }
  { const stop = nodeOrder(facts.fieldBindings, "field-bindings-order"); if (stop !== null) return stop; }
  for (const field of facts.fieldBindings) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

    { const stop = node(field.node); if (stop !== null) return stop; } const site = at(field.node); { const stop = type(field.result, site); if (stop !== null) return stop; } { const stop = type(field.owner, site); if (stop !== null) return stop; } { const stop = type(field.pointee, site); if (stop !== null) return stop; }
    { const stop = nodeRef(field.fieldExpression, site); if (stop !== null) return stop; } { const stop = nodeRef(field.pointer, site); if (stop !== null) return stop; } { const stop = valueContext(field.context, site); if (stop !== null) return stop; }
    const selectedField = metadataField(field.field, site);
    if (selectedField.kind !== "complete") return selectedField;
    const selected = selectedField.value;
    if (selected !== undefined && (selected.owner !== field.owner || selected.value !== field.pointee)) { const stop = report("cross-owner-qualified", site,
      "A bound field retains its exact authored owner and pointee correspondence."); if (stop !== null) return stop; }
  }
  { const stop = nodeOrder(facts.recordBindings, "record-bindings-order"); if (stop !== null) return stop; }
  for (const record of facts.recordBindings) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

    { const stop = node(record.node); if (stop !== null) return stop; } const site = at(record.node); { const stop = type(record.result, site); if (stop !== null) return stop; } { const stop = nodeRef(record.layoutExpression, site); if (stop !== null) return stop; }
    { const stop = valueContext(record.context, site); if (stop !== null) return stop; }
    const selectedLayout = metadataLayout(record.layout, site);
    if (selectedLayout.kind !== "complete") return selectedLayout;
    for (const field of record.fields) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
 { const stop = nodeRef(field.expression, site); if (stop !== null) return stop; } { const stop = node(field.binding); if (stop !== null) return stop; } }
  }
  { const stop = nodeOrder(facts.memoryBindings, "memory-bindings-order"); if (stop !== null) return stop; }
  const recordBindings = new Set<NodeId>();
  for (const record of facts.recordBindings) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

    const growth = chargeResultEntries(account, 1);
    if (growth !== null) return growth;
    recordBindings.add(record.node);
  }
  for (const binding of facts.memoryBindings) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

    { const stop = node(binding.node); if (stop !== null) return stop; } const site = at(binding.node);
    if (binding.kind === "bound") {
      if (!recordBindings.has(binding.record)) { const stop = report("metadata-reference-resolves", site, "A bound memory occurrence retains its actual complete record-binding row."); if (stop !== null) return stop; }
    } else {
      const origin = nodes.get(binding.node)?.origin;
      if (origin === undefined || !diagnosticSites.has(encodeKey([origin.module, origin.start, origin.length]))) {
        { const stop = report("memory-binding-error-diagnostic", site, "An error binding retains an actual error diagnostic from the same complete checked diagnostic vector."); if (stop !== null) return stop; }
      }
    }
  }
  { const stop = ordered(facts.selectedMemoryDeclarations, "selected-declarations-order", compareText, () => bodySite); if (stop !== null) return stop; }
  for (const selected of facts.selectedMemoryDeclarations) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
if (!context.definitionExists(selected)) { const stop = report("cross-owner-qualified", bodySite,
    "Every selected memory declaration retains its actual declaration identity."); if (stop !== null) return stop; }
  }
  { const stop = nodeOrder(facts.closedArrays, "closed-arrays-order"); if (stop !== null) return stop; }
  for (const array of facts.closedArrays) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

    { const stop = node(array.node); if (stop !== null) return stop; } const site = at(array.node);
    if (array.kind === "unproven") {
      if (array.reason.kind === "open-origin-domain") { const stop = origins(array.reason.origins, site); if (stop !== null) return stop; } else { const stop = nodeRef(array.reason.at, site); if (stop !== null) return stop; }
    } else {
      { const stop = ordered(array.declarations, "closed-array-declarations-order", compareDeclarations, () => site); if (stop !== null) return stop; }
      for (const declaration of array.declarations) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

        if (declaration.kind === "local") {
          if (declaration.local.body !== facts.execution.instance.body || !validIndex(declaration.local.local, tir.locals.length) ||
            !Object.is(tir.locals[declaration.local.local]?.id, declaration.local.local)) { const stop = report("cross-owner-qualified", site,
            "A closed array's local declaration is a local of this actual checked body."); if (stop !== null) return stop; }
        } else if (!context.definitionExists(declaration.definition)) { const stop = report("cross-owner-qualified", site,
          "A closed array retains actual checked declaration identities."); if (stop !== null) return stop; }
      }
      for (const reference of array.references) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
 const stop = nodeRef(reference, site); if (stop !== null) return stop; }
      for (const literal of array.literals) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
 const stop = nodeRef(literal, site); if (stop !== null) return stop; }
      for (const element of array.elements) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
 const stop = collectSelectionChecks(element, site, context, violations, account); if (stop !== null) return stop; }
    }
  }
  const checkedBindings = verifyFactBindings(factBindingInputs(facts, context), { kind: "body", execution: facts.execution }, bodySite, context, account);
  if (checkedBindings.kind !== "complete") return checkedBindings;
  for (const violation of checkedBindings.violations) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;

    const output = chargeResultEntries(account, 1);
    if (output !== null) return output;
    violations.push(violation);
  }
  const limits = context.limits;
  const measured = relationalUsage(facts.arena, account);
  if (measured.kind !== "complete") return measured;
  const usage = measured.value;
  if (usage.depth > limits.maximumProjectionDepth || usage.alternatives > limits.maximumOriginAlternatives ||
    usage.records > limits.maximumRelationalRecordsPerBody || usage.references > limits.maximumRelationalReferencesPerBody) {
    { const stop = report("analysis-limits-respected", bodySite, "Published projection depth, alternatives, relational rows and references respect the actual four producer limits."); if (stop !== null) return stop; }
  }
  return { kind: "complete", violations };
};
