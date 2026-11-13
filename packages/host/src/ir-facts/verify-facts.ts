import type { Violation } from "../diag/contract.js";
import type { NodeId, NodeRef } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type { DeclarationTarget } from "../ir-hir/contract.js";
import { childrenOfSyntax } from "../ir-hir/index.js";
import type { TirNode, TypedPhase } from "../ir-tir/contract.js";
import type { ArtifactBindings, BodyInstance } from "../ir-types/contract.js";
import type {
  ArgumentTransport, EscapeTarget, FactsRule, FactsSite, MemoryField, MemoryLayout, MetadataFieldRef, MetadataLayoutRef, MirPoint, RelationalOwner,
  RetentionFact, VerifyFacts,
} from "./contract.js";
import {
  collectSelectionChecks, compareNumbers, escapeData, factBindingInputs, instanceKey, ownerKey, relationalUsage, sameBindings, sameCaptures, validIndex,
  verifyFactBindings, verifyRelationalArena,
} from "./verify-relations.js";

const compareText = (left: string, right: string): number => left === right ? 0 : left < right ? -1 : 1;
const compareNullableNumber = (left: number | null, right: number | null, nullOrder: -1 | 1): number => {
  if (left === null) return right === null ? 0 : nullOrder;
  if (right === null) return -nullOrder;
  return compareNumbers(left, right);
};

const compareDeclarations = (left: DeclarationTarget, right: DeclarationTarget): number => left.kind === "local"
  ? right.kind === "local" ? compareText(left.local.body, right.local.body) || compareNumbers(left.local.local, right.local.local) : -1
  : right.kind === "local" ? 1 : compareText(left.definition, right.definition);
const transportKey = (transport: ArgumentTransport | null): string => transport === null ? "" : encodeKey([
  transport.authoredIndex, transport.parameter, transport.parameterIndex, transport.repeated, transport.passing, transport.actual,
  ownerKey(transport.formal.owner), transport.formal.producer, transport.projection]);

interface TransportShape {
  readonly authoredIndex: number | null;
  readonly repeated: boolean;
  readonly component: number | null;
}

export const verifyFacts: VerifyFacts = (facts, mir, context) => {
  const violations: Violation<FactsRule, FactsSite>[] = [];
  const bodySite: FactsSite = { kind: "body", instance: facts.instance };
  const owner: RelationalOwner = { kind: "body", instance: facts.instance };
  const tir = context.tirBody(facts.instance);
  const at = (node: NodeId): FactsSite => ({ kind: "node", at: { body: facts.instance.body, node } });
  const report = (rule: FactsRule, site: FactsSite, text: string): void => {
    violations.push({ rule, site, detail: [{ kind: "text", value: text }] });
  };
  if (facts.instance.body !== mir.body || facts.instance.body !== tir.body ||
    !sameBindings(facts.instance.bindings, mir.bindings) || !sameBindings(facts.instance.bindings, tir.bindings)) {
    report("body-instance-exact", bodySite, "Facts, TIR and MIR retain one exact body and complete binding environment.");
  }
  const definition = tir.owner;
  if (!context.definitionExists(definition)) {
    report("cross-owner-qualified", bodySite, "The actual checked body retains an existing declaration owner.");
  }
  const diagnosticSites = new Set<string>();
  for (const diagnostic of context.diagnostics) if (diagnostic !== undefined && diagnostic.severity === "error" && diagnostic.site.kind === "source") {
    const origin = diagnostic.site.origin; diagnosticSites.add(encodeKey([origin.module, origin.start, origin.length]));
  }
  for (const violation of verifyRelationalArena(facts.arena, owner, context)) violations.push(violation);
  const nodes = new Map<NodeId, TirNode>();
  const valueNodes = new Set<NodeId>();
  const nestedBodies = new Set(tir.nestedBodies);
  const pending: TirNode[] = [tir.root];
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    if (nodes.has(node.id)) continue;
    nodes.set(node.id, node);
    const annotation = node.tsonic;
    if (annotation !== null && "convertedType" in annotation) valueNodes.add(node.id);
    const template = annotation !== null && "callable" in annotation ? annotation.callable.template
      : annotation !== null && "template" in annotation ? annotation.template : null;
    const bodyRoot = template !== null && nestedBodies.has(template.body) && "body" in node && node.body !== null ? node.body.id : null;
    const initializerRoot = annotation !== null && "initializer" in annotation && annotation.initializer !== null &&
      nestedBodies.has(annotation.initializer) && "initializer" in node && node.initializer !== null ? node.initializer.id : null;
    for (const child of childrenOfSyntax<TypedPhase>(node)) if (child.id !== bodyRoot && child.id !== initializerRoot) pending.push(child);
  }
  const nodeRef = (reference: NodeRef, site: FactsSite, local = true): void => {
    if (!context.nodeExists({ kind: "body", value: reference }) || local && !nodes.has(reference.node)) {
      report("node-resolves", site, "Every fact retains an actual source occurrence in its declared body domain.");
    }
    if (local && reference.body !== facts.instance.body) {
      report("cross-owner-qualified", site, "A local fact cannot borrow the same numeric node index from another body.");
    }
  };
  const node = (id: NodeId): void => nodeRef({ body: facts.instance.body, node: id }, at(id));
  const point = (value: MirPoint, site: FactsSite, rule: "mir-point-resolves" | "point-refs-resolve" = "mir-point-resolves"): void => {
    const block = validIndex(value.block, mir.blocks.length) ? mir.blocks[value.block] : undefined;
    if (block === undefined || !Object.is(block.id, value.block) || value.statement !== null &&
      (!validIndex(value.statement, block.statements.length) || block.statements[value.statement] === undefined)) {
      report(rule, site, "A MIR point names an actual block and statement, or that block's terminator.");
    }
  };
  const place = (id: number, site: FactsSite): void => {
    if (!validIndex(id, mir.places.length) || !Object.is(mir.places[id]?.id, id)) report("place-resolves", site, "A place reference resolves in this exact MIR body.");
  };
  const origins = (id: number, site: FactsSite): void => {
    if (!validIndex(id, facts.arena.origins.length) || !Object.is(facts.arena.origins[id]?.id, id)) report("origins-resolves", site, "Origins resolve in this exact relational arena.");
  };
  const producer = (id: number, site: FactsSite, bound = false): void => {
    const rows = bound ? facts.arena.boundProducers : facts.arena.producers;
    if (!validIndex(id, rows.length) || !Object.is(rows[id]?.id, id)) report(bound ? "bound-producer-resolves" : "producer-resolves", site,
      "A producer reference resolves in its exact declared arena.");
  };
  const valueContext = (id: number, site: FactsSite): void => {
    if (!validIndex(id, facts.arena.contexts.length) || !Object.is(facts.arena.contexts[id]?.id, id)) report("context-resolves", site, "A value context resolves in this exact arena.");
  };
  const boundary = (id: number, site: FactsSite): void => {
    if (!validIndex(id, facts.arena.boundaries.length) || !Object.is(facts.arena.boundaries[id]?.id, id)) report("boundary-resolves", site, "A boundary resolves in this exact arena.");
  };
  const path = (id: number | null, site: FactsSite): void => {
    if (id !== null && (!validIndex(id, facts.arena.projections.length) || !Object.is(facts.arena.projections[id]?.id, id))) {
      report("producer-resolves", site, "A projected fact retains its actual projection-path identity.");
    }
  };
  const type = (id: number, site: FactsSite): void => {
    if (!validIndex(id, context.types.terms.length) || context.types.terms[id] === undefined) {
      report("type-resolves", site, "A fact type resolves in the actual supplied type table.");
    }
  };
  const signature = (id: number, site: FactsSite): void => {
    if (!validIndex(id, context.types.signatures.length) || !Object.is(context.types.signatures[id]?.id, id)) {
      report("signature-resolves", site, "A fact signature resolves in the actual supplied signature table.");
    }
  };
  const ordered = <Value>(rows: readonly Value[], rule: FactsRule, comparator: (left: Value, right: Value) => number, site: (row: Value) => FactsSite): void => {
    let previous: Value | null = null;
    for (const row of rows) {
      if (previous !== null && comparator(previous, row) >= 0) report(rule, site(row), "Fact rows retain distinct canonical endpoint order.");
      previous = row;
    }
  };
  const nodeOrder = <Value extends { readonly node: NodeId }>(rows: readonly Value[], rule: FactsRule): void =>
    ordered(rows, rule, (left, right) => compareNumbers(left.node, right.node), row => at(row.node));
  const target = (value: EscapeTarget, site: FactsSite): void => {
    switch (value.kind) {
      case "return": case "throw": break;
      case "shared":
        if (!context.definitionExists(value.definition)) report("producer-resolves", site, "A shared target retains its actual declaration.");
        path(value.path, site); break;
      case "parameter":
        if (!validIndex(value.index, tir.params.length) || tir.params[value.index] === undefined) report("producer-resolves", site, "An escape retains its actual declaration parameter index.");
        path(value.path, site); break;
      case "capture":
        if (!validIndex(value.index, tir.captures.length) || tir.captures[value.index] === undefined) report("capture-locations-exact", site, "An escape retains its actual captured-location index.");
        path(value.path, site); break;
      case "receiver":
        if (!validIndex(tir.signature, context.types.signatures.length) || !Object.is(context.types.signatures[tir.signature]?.id, tir.signature) ||
          context.types.signatures[tir.signature]?.receiver === null) report("producer-resolves", site, "A receiver escape retains an actual receiver slot.");
        path(value.path, site); break;
      case "callback": case "suspension":
        if (value.at.kind === "node") nodeRef(value.at.node, site);
        else {
          if (!context.libraryExportExists(value.at.identity)) report("relational-site-resolves", site, "An escape retains an existing declared library export.");
          const count = context.declaredSiteCount(value.at.identity);
          if (count === null || !validIndex(value.at.site, count)) report("declared-site-ordinal", site,
            "An escape's declared site retains its actual library export and logical allocation ordinal.");
        }
        break;
      case "external": boundary(value.boundary, site); break;
    }
  };
  const retention = (rows: readonly RetentionFact[], site: FactsSite): void => {
    for (const row of rows) { producer(row.source, site); target(row.into, site); }
  };
  for (const row of facts.arena.producers) {
    const site: FactsSite = { kind: "producer", owner, producer: row.id };
    if (row.kind === "parameter" && (!validIndex(row.index, tir.params.length) || tir.params[row.index] === undefined) ||
      row.kind === "capture" && (!validIndex(row.index, tir.captures.length) || tir.captures[row.index] === undefined) ||
      row.kind === "receiver" && (!validIndex(tir.signature, context.types.signatures.length) ||
        !Object.is(context.types.signatures[tir.signature]?.id, tir.signature) || context.types.signatures[tir.signature]?.receiver === null)) {
      report("producer-resolves", site, "A producer retains its actual body parameter, receiver or captured-location slot.");
    }
  }

  ordered(facts.liveness.stores, "stores-order", (left, right) => compareNumbers(left.node, right.node) || compareNumbers(left.point.block, right.point.block) ||
    compareNullableNumber(left.point.statement, right.point.statement, 1), row => at(row.node));
  for (const store of facts.liveness.stores) { node(store.node); point(store.point, at(store.node)); }
  ordered(facts.liveness.locals, "locals-order", (left, right) => compareNumbers(left.local, right.local), row => ({ kind: "local", local: { body: facts.instance.body, local: row.local } }));
  ordered(facts.liveness.bindings, "locals-order", (left, right) => compareNumbers(left.local, right.local), row => ({ kind: "local", local: { body: facts.instance.body, local: row.local } }));
  for (const local of facts.liveness.locals) {
    const site: FactsSite = { kind: "local", local: { body: facts.instance.body, local: local.local } };
    if (!validIndex(local.local, mir.locals.length) || !Object.is(mir.locals[local.local]?.id, local.local)) {
      report("cross-owner-qualified", site, "A live local belongs to this actual MIR local table.");
    }
    ordered(local.segments, "live-segments-order", (left, right) => compareNumbers(left.block, right.block) || compareNumbers(left.first, right.first) || compareNumbers(left.last, right.last), () => site);
    for (const segment of local.segments) {
      const block = validIndex(segment.block, mir.blocks.length) ? mir.blocks[segment.block] : undefined;
      if (block === undefined || !Object.is(block.id, segment.block) || !validIndex(segment.first, block.statements.length + 1) ||
        !validIndex(segment.last, block.statements.length + 1) || segment.last < segment.first ||
        segment.first < block.statements.length && block.statements[segment.first] === undefined ||
        segment.last < block.statements.length && block.statements[segment.last] === undefined) report("live-segments-bounds", site,
        "A live interval contains ordered actual statement or terminator positions in its own block.");
    }
  }
  for (const storage of facts.liveness.bindings) if (!validIndex(storage.local, mir.locals.length) || !Object.is(mir.locals[storage.local]?.id, storage.local)) {
    report("cross-owner-qualified", { kind: "local", local: { body: facts.instance.body, local: storage.local } }, "A binding-storage row belongs to this actual MIR local table.");
  }
  ordered(facts.liveness.captures, "captures-order", (left, right) => compareText(left.local.body, right.local.body) || compareNumbers(left.local.local, right.local.local), row => ({ kind: "local", local: row.local }));
  for (const capture of facts.liveness.captures) if (!context.localExists(capture.local)) {
    report("capture-locations-exact", { kind: "local", local: capture.local }, "A capture retains its actual qualified outer local.");
  }
  nodeOrder(facts.initialization.reads, "initialization-order");
  for (const read of facts.initialization.reads) { node(read.node); place(read.place, at(read.node)); }
  nodeOrder(facts.refinements.refinements, "refinements-order");
  for (const refinement of facts.refinements.refinements) {
    node(refinement.node); for (const guard of refinement.guards) node(guard);
    if (refinement.kind === "unproven" && refinement.reason.kind === "invalidated") for (const invalidation of refinement.reason.sites) nodeRef(invalidation.at, at(refinement.node));
  }
  nodeOrder(facts.refinements.integers, "integer-facts-order");
  const integerNodes = new Set<NodeId>();
  for (const integer of facts.refinements.integers) {
    integerNodes.add(integer.node); node(integer.node);
    if (integer.range !== null && integer.range.minimum > integer.range.maximum) report("integer-range-valid", at(integer.node), "An exact integer interval has ordered bigint endpoints.");
    if (integer.range !== null && integer.nonnegative && integer.range.maximum < 0n) {
      report("integer-proofs-consistent", at(integer.node), "A published interval and nonnegative proof cannot contradict one another.");
    }
  }
  if (integerNodes.size !== valueNodes.size || [...valueNodes].some(id => !integerNodes.has(id))) {
    report("integer-facts-domain-exact", bodySite, "Integer proofs retain every actual checked value occurrence, including explicit absent proofs.");
  }
  ordered(facts.refinements.countedLoops, "counted-loops-order",
    (left, right) => compareNumbers(left.statement, right.statement), row => at(row.statement));
  const resolvesCounter = (reference: TirNode, declaration: DeclarationTarget): boolean => {
    if (reference.kind !== "Identifier") return false;
    const annotation = reference.tsonic;
    if (!("resolution" in annotation)) return false;
    const resolution = annotation.resolution;
    return resolution.kind === "local" && declaration.kind === "local"
      ? resolution.local.body === declaration.local.body && resolution.local.local === declaration.local.local
      : resolution.kind === "definition" && declaration.kind === "definition" && resolution.definition === declaration.definition;
  };
  for (const loop of facts.refinements.countedLoops) {
    const site = at(loop.statement);
    for (const endpoint of [loop.statement, loop.counterDeclaration, loop.start, loop.bound, loop.body]) {
      if (!nodes.has(endpoint)) report("counted-loop-endpoints-resolve", site, "All five counted-loop endpoints retain actual occurrences in this body.");
    }
    const statement = nodes.get(loop.statement);
    const counter = nodes.get(loop.counterDeclaration);
    if (statement?.kind !== "ForStatement" || counter?.kind !== "VariableDeclaration" || counter.initializer?.id !== loop.start ||
      statement.statement.id !== loop.body || statement.condition?.kind !== "BinaryExpression" || statement.condition.operatorToken.kind !== "LessThanToken" ||
      statement.condition.right.id !== loop.bound || !resolvesCounter(statement.condition.left, counter.tsonic.declaration) ||
      statement.initializer?.kind !== "VariableDeclarationList" || statement.initializer.declarations.nodes.length !== 1 ||
      statement.initializer.declarations.nodes[0]?.id !== counter.id || statement.incrementor === null ||
      (statement.incrementor.kind !== "PostfixUnaryExpression" && statement.incrementor.kind !== "PrefixUnaryExpression") ||
      statement.incrementor.operator !== "PlusPlusToken" || !resolvesCounter(statement.incrementor.operand, counter.tsonic.declaration)) {
      report("counted-loop-conditions-exact", site, "A counted loop retains its actual initialized counter, exclusive upper comparison and unit increment.");
    }
  }

  ordered(facts.origins.points, "points-order", (left, right) => compareNumbers(left.point.block, right.point.block) ||
    compareNullableNumber(left.point.statement, right.point.statement, 1) || compareNumbers(left.place, right.place), () => bodySite);
  for (const entry of facts.origins.points) { point(entry.point, bodySite, "point-refs-resolve"); place(entry.place, bodySite); origins(entry.origins, bodySite); }
  ordered(facts.origins.reads, "reads-order", (left, right) => compareNumbers(left.node, right.node) || compareNumbers(left.place, right.place), row => at(row.node));
  for (const read of facts.origins.reads) { node(read.node); place(read.place, at(read.node)); origins(read.origins, at(read.node)); }
  ordered(facts.origins.subjects, "subjects-order", (left, right) => compareNumbers(left.node, right.node) || compareText(left.role, right.role) ||
    compareNullableNumber(left.path, right.path, -1), row => at(row.node));
  for (const subject of facts.origins.subjects) { node(subject.node); path(subject.path, at(subject.node)); origins(subject.origins, at(subject.node)); }
  nodeOrder(facts.origins.writes, "writes-order");
  for (const write of facts.origins.writes) {
    node(write.node); const site = at(write.node);
    for (const id of write.targets) producer(id, site, true);
    if (write.owner !== null) producer(write.owner, site, true);
    for (const value of write.values) { if (value.source !== null) nodeRef(value.source, site); origins(value.origins, site); }
    for (const id of write.boundaries) boundary(id, site);
  }
  ordered(facts.origins.escapes, "escapes-order", (left, right) => compareNumbers(left.node, right.node) || compareNumbers(left.producer, right.producer) ||
    compareText(encodeKey(escapeData(left.target)), encodeKey(escapeData(right.target))), row => at(row.node));
  for (const escape of facts.origins.escapes) { node(escape.node); producer(escape.producer, at(escape.node)); target(escape.target, at(escape.node)); }
  const checkArgument = (argument: ArgumentTransport, site: FactsSite): void => {
    origins(argument.actual, site); path(argument.projection, site);
    if (!Number.isSafeInteger(argument.parameterIndex) || argument.parameterIndex < 0 || Object.is(argument.parameterIndex, -0) ||
      argument.authoredIndex !== null && (!Number.isSafeInteger(argument.authoredIndex) || argument.authoredIndex < 0 || Object.is(argument.authoredIndex, -0))) {
      report("argument-transports-total", site, "A transport retains actual nonnegative authored and formal indices.");
    }
    const foreign = context.arenaOf(argument.formal.owner);
    const formal = foreign === null ? undefined : foreign.producers[argument.formal.producer];
    if (foreign === null) report("cross-owner-qualified", site, "A formal producer retains a resolving qualified relational owner.");
    else if (!validIndex(argument.formal.producer, foreign.producers.length) || formal === undefined || !Object.is(formal.id, argument.formal.producer)) {
      report("producer-resolves", site, "The actual formal producer resolves in its declared foreign arena.");
    } else if (formal.kind !== "parameter" || formal.index !== argument.parameterIndex) report("argument-transports-total", site,
        "A transport's formal producer retains its actual declaration parameter position.");
    if (!context.definitionExists(argument.parameter)) report("argument-transports-total", site, "A transport retains its actual parameter declaration.");
  };
  nodeOrder(facts.origins.invocations, "invocations-order");
  for (const invocation of facts.origins.invocations) {
    node(invocation.node); const site = at(invocation.node);
    const syntax = nodes.get(invocation.node);
    const application = (syntax?.kind === "CallExpression" || syntax?.kind === "NewExpression" || syntax?.kind === "TaggedTemplateExpression") && syntax.tsonic.application.kind === "decided"
      ? syntax.tsonic.application.decision : null;
    const authored = new Map<NodeId, number>();
    if (syntax?.kind === "CallExpression" || syntax?.kind === "NewExpression") {
      for (const [index, argument] of (syntax.arguments?.nodes ?? []).entries()) {
        authored.set(argument.kind === "SpreadElement" ? argument.expression.id : argument.id, index);
      }
    }
    for (const id of invocation.boundaries) boundary(id, site);
    for (const alternative of invocation.alternatives) {
      const decision = alternative.resolution.decision;
      valueContext(alternative.context, site); origins(alternative.result, site); origins(alternative.thrown, site);
      signature(decision.advertised.signature, site); signature(decision.api.signature, site); signature(decision.completion.signature, site);
      type(decision.result, site); type(decision.completion.completion, site);
      if (decision.completion.yielded !== null) type(decision.completion.yielded, site);
      if (decision.completion.sent !== null) type(decision.completion.sent, site);
      const selected = context.types.signatures[decision.api.signature];
      const receiver = facts.arena.contexts[alternative.context];
      const mappings = new Map(decision.parameters.map(mapping => [mapping.parameter, mapping]));
      const restAuthored = new Map(decision.parameters.filter(mapping => mapping.kind === "rest").map(mapping => [mapping.parameter, new Set(mapping.arguments)]));
      const consumed = new Map<number, Set<number>>();
      for (const mapping of decision.parameters) if (mapping.kind === "argument" && mapping.component !== null) {
        const components = consumed.get(mapping.argument);
        if (components === undefined) consumed.set(mapping.argument, new Set([mapping.component]));
        else components.add(mapping.component);
      }
      const restParts = new Map(application === null ? [] : application.arguments.filter(argument => argument.kind === "rest").map(argument => [argument.parameter, argument]));
      const expectedRests = new Map<number, readonly TransportShape[]>();
      for (const mapping of decision.parameters) if (mapping.kind === "rest") {
        const shapes: TransportShape[] = [];
        if (mapping.arguments.length === 0) expectedRests.set(mapping.parameter, shapes);
        else {
          const rest = restParts.get(mapping.parameter);
          if (rest !== undefined) {
            for (const part of rest.parts) {
              const index = authored.get(part.expression);
              if (index === undefined || !restAuthored.get(mapping.parameter)?.has(index)) {
                report("argument-transports-total", site, "Rest transports retain their actual selected authored spread and value occurrences.");
              } else if (part.kind === "value") shapes.push({ authoredIndex: index, repeated: false, component: null });
              else if (part.tuple === null) shapes.push({ authoredIndex: index, repeated: true, component: null });
              else for (const [component] of part.tuple.entries()) if (!consumed.get(index)?.has(component)) {
                shapes.push({ authoredIndex: index, repeated: false, component });
              }
            }
            expectedRests.set(mapping.parameter, shapes);
          }
        }
      }
      if (selected !== undefined && receiver !== undefined && (receiver.arguments.length !== selected.parameters.length ||
        (receiver.receiver === null) !== (selected.receiver === null))) report("context-arguments-total", site,
        "Each invocation context retains every actual selected parameter and receiver slot.");
      let previousAuthored: number | null = null;
      const supplied = new Map<number, number>();
      const rests = new Map<number, ArgumentTransport[]>();
      for (const argument of alternative.arguments) {
        checkArgument(argument, site);
        if (argument.authoredIndex !== null) {
          if (previousAuthored !== null && compareNumbers(previousAuthored, argument.authoredIndex) > 0) report("argument-transports-authored-order", site,
            "Transports retain authored actual evaluation order without inventing a flattened runtime slot.");
          previousAuthored = argument.authoredIndex;
        }
        const parameter = selected?.parameters[argument.parameterIndex];
        const mapping = mappings.get(argument.parameterIndex);
        if (parameter === undefined || parameter.declaration !== argument.parameter || parameter.passing !== argument.passing ||
          mapping === undefined || mapping.kind !== "rest" && argument.repeated) report("argument-transports-total", site,
          "Transports retain complete selected formals, passing modes and effective actual components exactly once.");
        if (mapping !== undefined && (argument.authoredIndex === null || Number.isSafeInteger(argument.authoredIndex) && argument.authoredIndex >= 0 && !Object.is(argument.authoredIndex, -0))) {
          const valid = mapping.kind === "argument" ? argument.authoredIndex === mapping.argument
            : mapping.kind === "rest" ? argument.authoredIndex !== null && restAuthored.get(mapping.parameter)?.has(argument.authoredIndex) === true
              : argument.authoredIndex === null;
          const projection = argument.projection === null ? null : facts.arena.projections[argument.projection]?.projection;
          if (!valid || mapping.kind !== "rest" && receiver !== undefined && receiver.arguments[argument.parameterIndex] !== argument.actual ||
            mapping.kind === "argument" && (mapping.component === null ? argument.projection !== null
              : !Number.isSafeInteger(mapping.component) || mapping.component < 0 || Object.is(mapping.component, -0) ||
                projection?.kind !== "index" || projection.constant !== BigInt(mapping.component))) {
            report("argument-transports-total", site, "A transport retains its actual selected argument, default, omission or rest mapping and correlated origins.");
          }
        }
        if (mapping?.kind === "rest") {
          const rows = rests.get(argument.parameterIndex);
          if (rows === undefined) rests.set(argument.parameterIndex, [argument]); else rows.push(argument);
        }
        supplied.set(argument.parameterIndex, (supplied.get(argument.parameterIndex) ?? 0) + 1);
        if (argument.formal.owner.kind !== "summary" || argument.formal.owner.definition !== alternative.summary.definition ||
          !sameBindings(argument.formal.owner.bindings, alternative.summary.bindings)) report("cross-owner-qualified", site,
          "An argument's formal producer belongs to this exact callee summary and complete binding environment.");
      }
      for (const [index, parameter] of selected?.parameters.entries() ?? []) {
        if (parameter !== undefined && parameter.kind !== "rest" && supplied.get(index) !== 1) report("argument-transports-total", site,
          "Every non-rest selected formal has its complete actual or explicit omitted transport.");
      }
      for (const [parameter, shapes] of expectedRests) {
        const rows = rests.get(parameter) ?? [];
        const expected = encodeKey(shapes.map(shape => [shape.authoredIndex, shape.repeated,
          shape.component === null ? shape.repeated ? "element" : null : BigInt(shape.component)]));
        const actual = encodeKey(rows.map(row => {
          const projection = row.projection === null ? null : facts.arena.projections[row.projection]?.projection;
          return [row.authoredIndex, row.repeated, projection === null ? null : projection === undefined ? "missing"
            : projection.kind === "index" ? projection.constant : projection.kind];
        }));
        if (actual !== expected) report("argument-transports-total", site,
          "Rest transports retain every actual unconsumed tuple component or one symbolic repeated sequence, including known empty spreads.");
      }
      const activation = alternative.resolution.activation;
      const dependent = context.bindingDependentOf(decision.api.declaration);
      const environment: ArtifactBindings | null = dependent === null ? null : dependent
        ? { kind: "instantiated", bindings: decision.implementationBindings } : { kind: "parametric" };
      let activationValid = true;
      let capturesValid = true;
      if (activation !== null) {
        const actual = context.tirBody(activation);
        activationValid = actual.body === activation.body && actual.owner === decision.api.declaration &&
          sameBindings(actual.bindings, activation.bindings) && environment !== null && sameBindings(activation.bindings, environment);
        capturesValid = sameCaptures(actual.captures, alternative.resolution.captures);
      }
      if (alternative.summary.definition !== decision.api.declaration || environment === null || !sameBindings(alternative.summary.bindings, environment) ||
        !activationValid) report("summary-reference-exact", site,
        "An invocation names the actual selected declaration and exact instantiated summary environment.");
      const captureSet = new Set<string>();
      for (const capture of alternative.resolution.captures) if (capture !== undefined) captureSet.add(encodeKey([capture.body, capture.local]));
      if (!capturesValid || captureSet.size !== alternative.resolution.captures.length ||
        receiver !== undefined && receiver.captures.length !== alternative.resolution.captures.length) {
        report("invocation-contexts-correlated", site, "Each invocation alternative retains its own complete actual captured-location vector.");
      }
      for (const capture of alternative.resolution.captures) if (capture === undefined || !context.localExists(capture)) report("capture-locations-exact", site,
        "An invocation capture retains its actual qualified local location.");
    }
  }
  nodeOrder(facts.origins.callbacks, "callbacks-order");
  for (const callback of facts.origins.callbacks) {
    node(callback.node); checkArgument(callback.argument, at(callback.node));
    for (const input of callback.inputs) if (!Number.isSafeInteger(input.parameterIndex) || input.parameterIndex < 0 || Object.is(input.parameterIndex, -0) ||
      input.kind === "argument-element" && (!Number.isSafeInteger(input.sourceParameterIndex) || input.sourceParameterIndex < 0 || Object.is(input.sourceParameterIndex, -0))) {
      report("argument-transports-total", at(callback.node), "A callback input retains actual nonnegative formal channel indices.");
    }
  }
  // The selected complete instances of direct activations, built once: for the first invocation row of each node,
  // every alternative that has a body, keyed by node, value context and complete instance. `instanceKey` equality is
  // body equality together with `sameBindings` (both compare the encoded artifact data, verify-relations.ts).
  const numberKey = (value: number): string => Object.is(value, -0) ? "-0" : String(value);
  const selectedActivationKey = (node: NodeId, valueContextId: number, selected: BodyInstance): string | null =>
    Number.isNaN(valueContextId) ? null : encodeKey([numberKey(node), String(valueContextId + 0), instanceKey(selected)]);
  const invocationNodes = new Set<string>();
  const selectedActivations = new Set<string>();
  for (const invocation of facts.origins.invocations) {
    if (invocationNodes.has(numberKey(invocation.node))) continue;
    invocationNodes.add(numberKey(invocation.node));
    for (const alternative of invocation.alternatives) {
      const key = alternative.resolution.activation === null ? null
        : selectedActivationKey(invocation.node, alternative.context, alternative.resolution.activation);
      if (key !== null) selectedActivations.add(key);
    }
  }
  ordered(facts.origins.activations, "activations-order", (left, right) => compareNumbers(left.node, right.node) ||
    compareText(instanceKey(left.activation), instanceKey(right.activation)) || compareNumbers(left.context, right.context) ||
    compareNullableNumber(left.caller, right.caller, -1) || compareText(transportKey(left.entry), transportKey(right.entry)), row => at(row.node));
  for (const activation of facts.origins.activations) {
    node(activation.node); const site = at(activation.node); valueContext(activation.context, site);
    if (activation.caller !== null) valueContext(activation.caller, site);
    const activated = activation.activation;
    const activatedOwner = context.bodyOwner(activated.body);
    if (activatedOwner === null || !context.definitionExists(activatedOwner)) report("producer-resolves", site,
      "An activation retains its actual executed body and its existing owner declaration.");
    if (activation.entry !== null) checkArgument(activation.entry, site);
    else {
      const key = selectedActivationKey(activation.node, activation.context, activated);
      if (key === null || !selectedActivations.has(key)) report("cross-owner-qualified", site,
        "A direct activation is the complete selected instance of an invocation alternative at its node and value context.");
    }
  }
  ordered(facts.origins.frontiers, "frontiers-order", (left, right) => compareNumbers(left.node, right.node) || compareText(left.kind, right.kind) ||
    compareNumbers(left.subject, right.subject) || compareNumbers(left.context, right.context), row => at(row.node));
  for (const frontier of facts.origins.frontiers) { node(frontier.node); producer(frontier.subject, at(frontier.node)); valueContext(frontier.context, at(frontier.node)); }
  ordered(facts.origins.constructions, "constructions-order", (left, right) => compareNumbers(left.node, right.node) || compareText(left.root.body, right.root.body) ||
    compareNumbers(left.root.node, right.root.node) || compareText(left.allocation.body, right.allocation.body) || compareNumbers(left.allocation.node, right.allocation.node) ||
    compareText(left.implementation === null ? "" : left.implementation, right.implementation === null ? "" : right.implementation) ||
    compareText(left.body === null ? "" : instanceKey(left.body), right.body === null ? "" : instanceKey(right.body)), row => at(row.node));
  for (const construction of facts.origins.constructions) {
    node(construction.node); const site = at(construction.node); nodeRef(construction.root, site, false); nodeRef(construction.allocation, site, false);
    if (construction.implementation !== null && !context.definitionExists(construction.implementation)) report("producer-resolves", site,
      "A construction retains its actual selected implementation declaration.");
    if (construction.body !== null) {
      const actual = context.tirBody(construction.body);
      if (actual.body !== construction.body.body || !sameBindings(actual.bindings, construction.body.bindings) ||
        construction.implementation !== null && construction.implementation !== actual.owner) {
        report("cross-owner-qualified", site, "A construction retains its actual selected body, implementation owner and complete artifact environment.");
      }
    }
    for (const region of construction.regions) { nodeRef(region.node, site, false); valueContext(region.context, site);
      if (!context.definitionExists(region.owner)) report("cross-owner-qualified", site, "Each constructor region retains its actual lexical declaration owner."); }
  }
  ordered(facts.origins.instanceRegions, "regions-order", (left, right) => compareText(left.owner, right.owner) || compareText(left.node.body, right.node.body) ||
    compareNumbers(left.node.node, right.node.node) || compareNumbers(left.context, right.context), row => ({ kind: "node", at: row.node }));
  for (const region of facts.origins.instanceRegions) {
    const site: FactsSite = { kind: "node", at: region.node };
    nodeRef(region.node, site, false); valueContext(region.context, bodySite);
    if (!context.definitionExists(region.owner)) report("cross-owner-qualified", site, "An instance region retains its actual lexical declaration owner.");
  }

  nodeOrder(facts.suspension.suspensions, "suspensions-order");
  const suspensionKinds = new Map<NodeId, "await" | "yield" | "delegate">();
  for (const block of mir.blocks) if (block !== undefined &&
    (block.terminator.kind === "await" || block.terminator.kind === "yield" || block.terminator.kind === "delegate")) {
    suspensionKinds.set(block.terminator.tir.node, block.terminator.kind);
  }
  for (const suspension of facts.suspension.suspensions) {
    node(suspension.node); const site = at(suspension.node);
    const selected = suspensionKinds.get(suspension.node);
    if (selected !== suspension.kind) report("suspension-input-site", site, "A suspension retains its actual MIR await, yield or delegated-yield occurrence.");
    const expected = suspension.kind === "await" ? ["resume", "unwind"] : ["resume", "return", "unwind"];
    for (const value of suspension.values) {
      place(value.place, site); origins(value.origins, site); retention(value.retention, site);
      if (value.continuations.length !== expected.length || value.continuations.some((entry, index) => entry !== expected[index])) {
        report("suspension-continuations-exact", site, "Suspension continuations retain exact resume, generator-return and unwind obligations.");
      }
    }
  }
  for (const source of facts.arena.producers) if (source.kind === "suspension-input") {
    const selected = suspensionKinds.get(source.at.node);
    if (source.at.body !== facts.instance.body || selected === undefined || source.channel === "sent" && selected === "await") {
      report("suspension-input-site", { kind: "producer", owner, producer: source.id }, "A suspension input retains the actual supported suspension channel and occurrence.");
    }
  }
  nodeOrder(facts.errorStorage.errors, "errors-order");
  for (const error of facts.errorStorage.errors) {
    node(error.node); const site = at(error.node); origins(error.origins, site); retention(error.retention, site);
    for (const write of error.writes) node(write);
    ordered(error.invalidations, "error-invalidations-order", (left, right) => compareText(left.at.body, right.at.body) || compareNumbers(left.at.node, right.at.node) || compareText(left.kind, right.kind), () => site);
    for (const invalidation of error.invalidations) {
      nodeRef(invalidation.at, site);
      if (!validIndex(invalidation.owner, facts.arena.origins.length) || !Object.is(facts.arena.origins[invalidation.owner]?.id, invalidation.owner)) report("error-invalidation-origins-resolve", site,
        "An error invalidation retains its actual owner origins in this arena.");
      const owned = facts.arena.origins[invalidation.owner];
      if (invalidation.kind === "invalidated" && invalidation.cause === "overlapping-write") {
        if (!validIndex(invalidation.affected, facts.arena.origins.length) || !Object.is(facts.arena.origins[invalidation.affected]?.id, invalidation.affected)) report("error-invalidation-origins-resolve", site,
          "An overlapping error write retains its actual affected origins.");
        const affected = facts.arena.origins[invalidation.affected];
        if (affected !== undefined && affected.producers.length === 0 && affected.kind === "complete") report("error-invalidation-outcome-exact", site,
          "A known empty affected origin cannot be claimed as an overlapping write.");
      } else if (invalidation.kind === "invalidated" && !suspensionKinds.has(invalidation.at.node)) {
        report("error-invalidation-outcome-exact", site, "A suspension invalidation retains an actual suspension occurrence.");
      } else if (invalidation.kind === "preserved" && owned?.kind === "open") {
        report("error-invalidation-outcome-exact", site, "Unknown error-owner origins cannot be relabelled as a proven preserved owner.");
      } else if (invalidation.kind === "unproven") {
        const reason = invalidation.reason;
        const id = reason.kind === "incomplete-origins" || reason.kind === "opaque-invocation-footprint" ? reason.affected
          : reason.kind === "open-constructor-domain" ? reason.constructor : null;
        if (id !== null && (!validIndex(id, facts.arena.origins.length) || !Object.is(facts.arena.origins[id]?.id, id))) report("error-invalidation-origins-resolve", site,
          "An unproven error reason retains its actual affected or constructor origins.");
        if ((reason.kind === "incomplete-origins" || reason.kind === "open-constructor-domain") && id !== null && facts.arena.origins[id]?.kind === "complete") {
          report("error-invalidation-outcome-exact", site, "An incomplete-domain reason must retain an actually open origin domain.");
        }
      }
    }
  }
  nodeOrder(facts.pointerBacking.pointers, "pointers-order");
  const pointerAlternatives = new Map<number, ReadonlySet<number>>();
  for (const pointer of facts.pointerBacking.pointers) {
    node(pointer.node); const site = at(pointer.node); origins(pointer.origins, site);
    const actual = facts.arena.origins[pointer.origins];
    if (actual !== undefined && !pointerAlternatives.has(pointer.origins)) pointerAlternatives.set(pointer.origins, new Set(actual.producers));
    const alternatives = pointerAlternatives.get(pointer.origins);
    for (const backing of pointer.producers) {
      producer(backing.producer, site, true); nodeRef(backing.operation.at, site);
      if (alternatives !== undefined && !alternatives.has(backing.producer)) {
        report("pointer-backing-family-exact", site, "Each pointer backing retains its own correlated producer and exact typed-location or raw-memory operation.");
      }
    }
  }
  const metadataLayout = (reference: MetadataLayoutRef, site: FactsSite): MemoryLayout | undefined => {
    const record = context.metadataOf(reference.metadata);
    const selected = record !== null && record.kind !== "data-layout" && validIndex(reference.layout, record.layouts.length) ? record.layouts[reference.layout] : undefined;
    if (record === null || selected === undefined || !Object.is(selected.id, reference.layout) || record.key.definition !== reference.metadata.definition ||
      !sameBindings(record.key.bindings, reference.metadata.bindings)) report("metadata-reference-resolves", site,
      "A layout reference retains its actual metadata declaration, complete binding environment and local layout ID.");
    return selected;
  };
  const metadataField = (reference: MetadataFieldRef, site: FactsSite): MemoryField | undefined => {
    const record = context.metadataOf(reference.metadata);
    const selected = record !== null && record.kind !== "data-layout" && validIndex(reference.field, record.fields.length) ? record.fields[reference.field] : undefined;
    if (record === null || selected === undefined || !Object.is(selected.id, reference.field) || record.key.definition !== reference.metadata.definition ||
      !sameBindings(record.key.bindings, reference.metadata.bindings)) report("metadata-reference-resolves", site,
      "A field reference retains its actual metadata declaration, complete binding environment and local field ID.");
    return selected;
  };
  nodeOrder(facts.observations, "observations-order");
  for (const observation of facts.observations) {
    node(observation.node); const site = at(observation.node); nodeRef(observation.operand, site);
    type(observation.result, site); valueContext(observation.context, site);
    const layout = metadataLayout(observation.layout, site);
    const field = observation.field === null ? undefined : metadataField(observation.field, site);
    if (observation.operation === "field-offset" ? field === undefined : observation.field !== null) {
      report("observation-field-exact", site, "Only a field-offset observation names the actual selected field metadata.");
    }
    if (layout !== undefined) {
      const expected = observation.operation === "size" ? layout.byteSize : observation.operation === "alignment" ? layout.byteAlignment
        : observation.operation === "stride" ? layout.stride : field?.byteOffset;
      if (expected !== undefined && expected !== observation.value) report("observation-exact-value", site,
        "The observation retains the exact authored bigint size, alignment, stride or field offset.");
      if (field !== undefined && field.owner !== layout.source) report("observation-field-exact", site,
        "A field-offset observation retains the selected field's actual owner layout.");
    }
  }
  nodeOrder(facts.rawLocations, "raw-locations-order");
  for (const raw of facts.rawLocations) {
    node(raw.node); const site = at(raw.node); type(raw.pointee, site); valueContext(raw.context, site);
    const selected = metadataLayout(raw.layout, site);
    if (selected !== undefined && selected.source !== raw.pointee) report("cross-owner-qualified", site, "A raw location retains its actual selected pointee layout.");
  }
  nodeOrder(facts.fieldBindings, "field-bindings-order");
  for (const field of facts.fieldBindings) {
    node(field.node); const site = at(field.node); type(field.result, site); type(field.owner, site); type(field.pointee, site);
    nodeRef(field.fieldExpression, site); nodeRef(field.pointer, site); valueContext(field.context, site);
    const selected = metadataField(field.field, site);
    if (selected !== undefined && (selected.owner !== field.owner || selected.value !== field.pointee)) report("cross-owner-qualified", site,
      "A bound field retains its exact authored owner and pointee correspondence.");
  }
  nodeOrder(facts.recordBindings, "record-bindings-order");
  for (const record of facts.recordBindings) {
    node(record.node); const site = at(record.node); type(record.result, site); nodeRef(record.layoutExpression, site);
    valueContext(record.context, site); metadataLayout(record.layout, site);
    for (const field of record.fields) { nodeRef(field.expression, site); node(field.binding); }
  }
  nodeOrder(facts.memoryBindings, "memory-bindings-order");
  const recordBindings = new Set(facts.recordBindings.map(record => record.node));
  for (const binding of facts.memoryBindings) {
    node(binding.node); const site = at(binding.node);
    if (binding.kind === "bound") {
      if (!recordBindings.has(binding.record)) report("metadata-reference-resolves", site, "A bound memory occurrence retains its actual complete record-binding row.");
    } else {
      const origin = nodes.get(binding.node)?.origin;
      if (origin === undefined || !diagnosticSites.has(encodeKey([origin.module, origin.start, origin.length]))) {
        report("memory-binding-error-diagnostic", site, "An error binding retains an actual error diagnostic from the same complete checked diagnostic vector.");
      }
    }
  }
  ordered(facts.selectedMemoryDeclarations, "selected-declarations-order", compareText, () => bodySite);
  for (const selected of facts.selectedMemoryDeclarations) if (!context.definitionExists(selected)) report("cross-owner-qualified", bodySite,
    "Every selected memory declaration retains its actual declaration identity.");
  nodeOrder(facts.closedArrays, "closed-arrays-order");
  for (const array of facts.closedArrays) {
    node(array.node); const site = at(array.node);
    if (array.kind === "unproven") {
      if (array.reason.kind === "open-origin-domain") origins(array.reason.origins, site); else nodeRef(array.reason.at, site);
    } else {
      ordered(array.declarations, "closed-array-declarations-order", compareDeclarations, () => site);
      for (const declaration of array.declarations) {
        if (declaration.kind === "local") {
          if (declaration.local.body !== facts.instance.body || !validIndex(declaration.local.local, tir.locals.length) ||
            !Object.is(tir.locals[declaration.local.local]?.id, declaration.local.local)) report("cross-owner-qualified", site,
            "A closed array's local declaration is a local of this actual checked body.");
        } else if (!context.definitionExists(declaration.definition)) report("cross-owner-qualified", site,
          "A closed array retains actual checked declaration identities.");
      }
      for (const reference of array.references) nodeRef(reference, site);
      for (const literal of array.literals) nodeRef(literal, site);
      for (const element of array.elements) collectSelectionChecks(element, site, context, violations);
    }
  }
  for (const violation of verifyFactBindings(factBindingInputs(facts, context), { kind: "body", instance: facts.instance }, bodySite, context)) violations.push(violation);
  const limits = context.limits;
  const usage = relationalUsage(facts.arena);
  if (usage.depth > limits.maximumProjectionDepth || usage.alternatives > limits.maximumOriginAlternatives ||
    usage.records > limits.maximumRelationalRecordsPerBody || usage.references > limits.maximumRelationalReferencesPerBody) {
    report("analysis-limits-respected", bodySite, "Published projection depth, alternatives, relational rows and references respect the actual four producer limits.");
  }
  return (violations);
};
