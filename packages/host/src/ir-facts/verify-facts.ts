import type { Violation } from "../diag/contract.js";
import type { DefId, NodeId, NodeRef } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import { childrenOfSyntax } from "../ir-hir/index.js";
import type { TirNode, TypedPhase } from "../ir-tir/contract.js";
import type { BindingVector } from "../ir-types/contract.js";
import type {
  ArgumentTransport, EscapeTarget, FactsRule, FactsSite, MemoryField, MemoryLayout, MetadataFieldRef, MetadataLayoutRef, MirPoint, RelationalOwner,
  RetentionFact, VerifyFacts,
} from "./contract.js";
import {
  declarationOf, instanceKey, sameBindings, validIndex,
  verifyFactBindings, verifyRelationalArena,
} from "./verify-relations.js";
import type { FactBindingInput } from "./verify-relations.js";

type OrderPart = string | number;
const compare = (left: readonly OrderPart[], right: readonly OrderPart[]): number => {
  for (let index = 0; index < left.length; index += 1) {
    const first = left[index]; const second = right[index];
    if (first !== undefined && second !== undefined && first !== second) return first < second ? -1 : 1;
  }
  return left.length - right.length;
};

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
  const definition = declarationOf(facts.instance);
  if (definition === null || definition !== tir.owner) {
    report("cross-owner-qualified", bodySite, "The body identity retains its actual declaration owner.");
  }
  const bindingInputs: FactBindingInput[] = [];
  if (definition !== null && facts.instance.bindings.kind === "instantiated") {
    bindingInputs.push({ vector: facts.instance.bindings.bindings, definition, site: bodySite });
  }
  for (const violation of verifyRelationalArena(facts.arena, owner, context)) violations.push(violation);
  const nodes = new Map<NodeId, TirNode>();
  const valueNodes = new Set<NodeId>();
  const pending: TirNode[] = [tir.root];
  while (pending.length !== 0) {
    const node = pending.pop(); if (node === undefined || nodes.has(node.id)) continue;
    nodes.set(node.id, node);
    const annotation = node.tsonic;
    if (annotation !== null && "convertedType" in annotation) valueNodes.add(node.id);
    if (annotation !== null && ("callable" in annotation && annotation.callable.template !== null && annotation.callable.template.body !== tir.body ||
      "template" in annotation && annotation.template !== null && annotation.template.body !== tir.body)) continue;
    for (const child of childrenOfSyntax<TypedPhase>(node)) pending.push(child);
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
    if (block === undefined || block.id !== value.block || value.statement !== null && !validIndex(value.statement, block.statements.length)) {
      report(rule, site, "A MIR point names an actual block and statement, or that block's terminator.");
    }
  };
  const place = (id: number, site: FactsSite): void => {
    if (!validIndex(id, mir.places.length) || mir.places[id]?.id !== id) report("place-resolves", site, "A place reference resolves in this exact MIR body.");
  };
  const origins = (id: number, site: FactsSite): void => {
    if (!validIndex(id, facts.arena.origins.length) || facts.arena.origins[id]?.id !== id) report("origins-resolves", site, "Origins resolve in this exact relational arena.");
  };
  const producer = (id: number, site: FactsSite, bound = false): void => {
    const rows = bound ? facts.arena.boundProducers : facts.arena.producers;
    if (!validIndex(id, rows.length) || rows[id]?.id !== id) report(bound ? "bound-producer-resolves" : "producer-resolves", site,
      "A producer reference resolves in its exact declared arena.");
  };
  const valueContext = (id: number, site: FactsSite): void => {
    if (!validIndex(id, facts.arena.contexts.length) || facts.arena.contexts[id]?.id !== id) report("context-resolves", site, "A value context resolves in this exact arena.");
  };
  const boundary = (id: number, site: FactsSite): void => {
    if (!validIndex(id, facts.arena.boundaries.length) || facts.arena.boundaries[id]?.id !== id) report("boundary-resolves", site, "A boundary resolves in this exact arena.");
  };
  const path = (id: number | null, site: FactsSite): void => {
    if (id !== null && (!validIndex(id, facts.arena.projections.length) || facts.arena.projections[id]?.id !== id)) {
      report("producer-resolves", site, "A projected fact retains its actual projection-path identity.");
    }
  };
  const type = (id: number, site: FactsSite): void => {
    if (!validIndex(id, context.types.terms.length)) report("type-resolves", site, "A fact type resolves in the actual supplied type table.");
  };
  const signature = (id: number, site: FactsSite): void => {
    if (!validIndex(id, context.types.signatures.length) || context.types.signatures[id]?.id !== id) {
      report("signature-resolves", site, "A fact signature resolves in the actual supplied signature table.");
    }
  };
  const ordered = <Value>(rows: readonly Value[], rule: FactsRule, key: (row: Value) => readonly OrderPart[], site: (row: Value) => FactsSite): void => {
    let previous: readonly OrderPart[] | null = null;
    for (const row of rows) {
      const current = key(row);
      if (previous !== null && compare(previous, current) >= 0) report(rule, site(row), "Fact rows retain distinct canonical endpoint order.");
      previous = current;
    }
  };
  const nodeOrder = <Value extends { readonly node: NodeId }>(rows: readonly Value[], rule: FactsRule): void =>
    ordered(rows, rule, row => [row.node], row => at(row.node));
  const bindings = (vector: BindingVector, site: FactsSite, declaration: DefId | null = definition): void => {
    if (declaration !== null) bindingInputs.push({ vector, definition: declaration, site });
  };
  const target = (value: EscapeTarget, site: FactsSite): void => {
    switch (value.kind) {
      case "return": case "throw": break;
      case "shared":
        if (!context.definitionExists(value.definition)) report("producer-resolves", site, "A shared target retains its actual declaration.");
        path(value.path, site); break;
      case "parameter":
        if (!validIndex(value.index, tir.params.length)) report("producer-resolves", site, "An escape retains its actual declaration parameter index.");
        path(value.path, site); break;
      case "capture":
        if (!validIndex(value.index, tir.captures.length)) report("capture-locations-exact", site, "An escape retains its actual captured-location index.");
        path(value.path, site); break;
      case "receiver": path(value.path, site); break;
      case "callback": case "suspension":
        if (value.at.kind === "node") nodeRef(value.at.node, site);
        else if (!context.libraryExportExists(value.at.identity) || context.declaredSiteCount(value.at.identity) === null ||
          !validIndex(value.at.site, context.declaredSiteCount(value.at.identity) ?? 0)) report("declared-site-ordinal", site,
          "An escape's declared site retains its actual library export and logical allocation ordinal.");
        break;
      case "external": boundary(value.boundary, site); break;
    }
  };
  const retention = (rows: readonly RetentionFact[], site: FactsSite): void => {
    for (const row of rows) { producer(row.source, site); target(row.into, site); }
  };

  ordered(facts.liveness.stores, "stores-order", row => [row.node, row.point.block, row.point.statement === null ? Number.MAX_SAFE_INTEGER : row.point.statement], row => at(row.node));
  for (const store of facts.liveness.stores) { node(store.node); point(store.point, at(store.node)); }
  ordered(facts.liveness.locals, "locals-order", row => [row.local], row => ({ kind: "local", local: { body: facts.instance.body, local: row.local } }));
  ordered(facts.liveness.bindings, "locals-order", row => [row.local], row => ({ kind: "local", local: { body: facts.instance.body, local: row.local } }));
  for (const local of facts.liveness.locals) {
    const site: FactsSite = { kind: "local", local: { body: facts.instance.body, local: local.local } };
    if (!validIndex(local.local, mir.locals.length)) report("cross-owner-qualified", site, "A live local belongs to this actual MIR local table.");
    ordered(local.segments, "live-segments-order", row => [row.block, row.first, row.last], () => site);
    for (const segment of local.segments) {
      const block = mir.blocks[segment.block];
      if (block === undefined || !Number.isSafeInteger(segment.first) || segment.first < 0 || !Number.isSafeInteger(segment.last) ||
        segment.last < segment.first || segment.last > block.statements.length) report("live-segments-bounds", site,
        "A live interval contains ordered actual statement or terminator positions in its own block.");
    }
  }
  for (const storage of facts.liveness.bindings) if (!validIndex(storage.local, mir.locals.length)) {
    report("cross-owner-qualified", { kind: "local", local: { body: facts.instance.body, local: storage.local } }, "A binding-storage row belongs to this actual MIR local table.");
  }
  ordered(facts.liveness.captures, "captures-order", row => [row.local.body, row.local.local], row => ({ kind: "local", local: row.local }));
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
    if (integer.range !== null && (integer.nonnegative && integer.range.minimum < 0n || !integer.nonnegative && integer.range.minimum >= 0n)) {
      report("integer-proofs-consistent", at(integer.node), "A published interval and nonnegative proof cannot contradict one another.");
    }
  }
  if (integerNodes.size !== valueNodes.size || [...valueNodes].some(id => !integerNodes.has(id))) {
    report("integer-facts-domain-exact", bodySite, "Integer proofs retain every actual checked value occurrence, including explicit absent proofs.");
  }
  nodeOrder(facts.refinements.countedLoops, "counted-loops-order");
  for (const loop of facts.refinements.countedLoops) {
    const site = at(loop.statement);
    for (const endpoint of [loop.statement, loop.counterDeclaration, loop.start, loop.bound, loop.body]) {
      if (!nodes.has(endpoint)) report("counted-loop-endpoints-resolve", site, "All five counted-loop endpoints retain actual occurrences in this body.");
    }
    const statement = nodes.get(loop.statement);
    const counter = nodes.get(loop.counterDeclaration);
    if (statement?.kind !== "ForStatement" || counter?.kind !== "VariableDeclaration" || counter.initializer?.id !== loop.start ||
      statement.statement.id !== loop.body || statement.condition?.kind !== "BinaryExpression" || statement.condition.operatorToken.kind !== "LessThanToken" ||
      statement.condition.right.id !== loop.bound || statement.incrementor === null ||
      (statement.incrementor.kind !== "PostfixUnaryExpression" && statement.incrementor.kind !== "PrefixUnaryExpression") || statement.incrementor.operator !== "PlusPlusToken") {
      report("counted-loop-conditions-exact", site, "A counted loop retains its actual initialized counter, exclusive upper comparison and unit increment.");
    }
  }

  ordered(facts.origins.points, "points-order", row => [row.point.block, row.point.statement === null ? Number.MAX_SAFE_INTEGER : row.point.statement, row.place], () => bodySite);
  for (const entry of facts.origins.points) { point(entry.point, bodySite, "point-refs-resolve"); place(entry.place, bodySite); origins(entry.origins, bodySite); }
  ordered(facts.origins.reads, "reads-order", row => [row.node, row.place], row => at(row.node));
  for (const read of facts.origins.reads) { node(read.node); place(read.place, at(read.node)); origins(read.origins, at(read.node)); }
  ordered(facts.origins.subjects, "subjects-order", row => [row.node, row.role, row.path === null ? -1 : row.path], row => at(row.node));
  for (const subject of facts.origins.subjects) { node(subject.node); path(subject.path, at(subject.node)); origins(subject.origins, at(subject.node)); }
  nodeOrder(facts.origins.writes, "writes-order");
  for (const write of facts.origins.writes) {
    node(write.node); const site = at(write.node);
    for (const id of write.targets) producer(id, site, true);
    if (write.owner !== null) producer(write.owner, site, true);
    for (const value of write.values) { if (value.source !== null) nodeRef(value.source, site); origins(value.origins, site); }
    for (const id of write.boundaries) boundary(id, site);
  }
  ordered(facts.origins.escapes, "escapes-order", row => [row.node, row.producer, encodeKey(row.target)], row => at(row.node));
  for (const escape of facts.origins.escapes) { node(escape.node); producer(escape.producer, at(escape.node)); target(escape.target, at(escape.node)); }
  const checkArgument = (argument: ArgumentTransport, site: FactsSite): void => {
    origins(argument.actual, site); path(argument.projection, site);
    const foreign = context.arenaOf(argument.formal.owner);
    if (foreign === null) report("cross-owner-qualified", site, "A formal producer retains a resolving qualified relational owner.");
    else if (!validIndex(argument.formal.producer, foreign.producers.length) || foreign.producers[argument.formal.producer]?.id !== argument.formal.producer) {
      report("producer-resolves", site, "The actual formal producer resolves in its declared foreign arena.");
    }
    if (!context.definitionExists(argument.parameter)) report("argument-transports-total", site, "A transport retains its actual parameter declaration.");
  };
  nodeOrder(facts.origins.invocations, "invocations-order");
  for (const invocation of facts.origins.invocations) {
    node(invocation.node); const site = at(invocation.node);
    for (const id of invocation.boundaries) boundary(id, site);
    for (const alternative of invocation.alternatives) {
      const decision = alternative.resolution.decision;
      valueContext(alternative.context, site); origins(alternative.result, site); origins(alternative.thrown, site);
      signature(decision.advertised.signature, site); signature(decision.api.signature, site); signature(decision.completion.signature, site);
      type(decision.result, site); type(decision.completion.completion, site);
      if (decision.completion.yielded !== null) type(decision.completion.yielded, site);
      if (decision.completion.sent !== null) type(decision.completion.sent, site);
      bindings(decision.bindings, site, decision.advertised.declaration);
      if (decision.implementationBindings !== null) bindings(decision.implementationBindings, site, decision.api.declaration);
      const selected = context.types.signatures[decision.api.signature];
      const receiver = facts.arena.contexts[alternative.context];
      if (selected !== undefined && receiver !== undefined && (receiver.arguments.length !== selected.parameters.length ||
        (receiver.receiver === null) !== (selected.receiver === null))) report("context-arguments-total", site,
        "Each invocation context retains every actual selected parameter and receiver slot.");
      const seen = new Set<string>();
      let previous: readonly OrderPart[] | null = null;
      const supplied = new Map<number, number>();
      for (const argument of alternative.arguments) {
        checkArgument(argument, site);
        const key = [argument.authoredIndex === null ? -1 : argument.authoredIndex, argument.effectiveIndex, argument.parameterIndex];
        if (previous !== null && compare(previous, key) > 0) report("argument-transports-authored-order", site,
          "Transports retain authored actual order and effective rest-component order.");
        previous = key;
        const identity = encodeKey([argument.parameterIndex, argument.authoredIndex, argument.effectiveIndex]);
        const parameter = selected?.parameters[argument.parameterIndex];
        if (seen.has(identity) || parameter === undefined || parameter.declaration !== argument.parameter || parameter.passing !== argument.passing ||
          !Number.isSafeInteger(argument.effectiveIndex) || argument.effectiveIndex < 0 ||
          argument.repeated !== (parameter.kind === "rest")) report("argument-transports-total", site,
          "Transports retain complete selected formals, passing modes and effective actual components exactly once.");
        seen.add(identity); supplied.set(argument.parameterIndex, (supplied.get(argument.parameterIndex) ?? 0) + 1);
        if (argument.formal.owner.kind !== "summary" || argument.formal.owner.definition !== alternative.summary.definition ||
          !sameBindings(argument.formal.owner.bindings, alternative.summary.bindings)) report("cross-owner-qualified", site,
          "An argument's formal producer belongs to this exact callee summary and complete binding environment.");
      }
      for (let index = 0; index < (selected?.parameters.length ?? 0); index += 1) {
        const parameter = selected?.parameters[index];
        if (parameter !== undefined && parameter.kind !== "rest" && supplied.get(index) !== 1) report("argument-transports-total", site,
          "Every non-rest selected formal has its complete actual or explicit omitted transport.");
      }
      const activation = alternative.resolution.activation;
      if (alternative.summary.definition !== decision.api.declaration || alternative.summary.bindings.kind !== (activation?.bindings.kind ?? "parametric") ||
        activation !== null && !sameBindings(alternative.summary.bindings, activation.bindings)) report("summary-reference-exact", site,
        "An invocation names the actual selected declaration and exact instantiated summary environment.");
      const captureSet = new Set(alternative.resolution.captures.map(capture => encodeKey([capture.body, capture.local])));
      if (captureSet.size !== alternative.resolution.captures.length || receiver !== undefined && receiver.captures.length !== alternative.resolution.captures.length) {
        report("invocation-contexts-correlated", site, "Each invocation alternative retains its own complete actual captured-location vector.");
      }
      for (const capture of alternative.resolution.captures) if (!context.localExists(capture)) report("capture-locations-exact", site,
        "An invocation capture retains its actual qualified local location.");
    }
  }
  nodeOrder(facts.origins.callbacks, "callbacks-order");
  for (const callback of facts.origins.callbacks) {
    node(callback.node); checkArgument(callback.argument, at(callback.node));
    for (const input of callback.inputs) if (!Number.isSafeInteger(input.parameterIndex) || input.parameterIndex < 0 ||
      input.kind === "argument-element" && (!Number.isSafeInteger(input.sourceParameterIndex) || input.sourceParameterIndex < 0)) {
      report("argument-transports-total", at(callback.node), "A callback input retains actual nonnegative formal channel indices.");
    }
  }
  nodeOrder(facts.origins.activations, "activations-order");
  for (const activation of facts.origins.activations) {
    node(activation.node); const site = at(activation.node); valueContext(activation.context, site);
    if (activation.caller !== null) valueContext(activation.caller, site);
    if (activation.entry !== null) checkArgument(activation.entry, site);
    if (!context.definitionExists(activation.definition)) report("producer-resolves", site, "An activation retains its actual execution declaration.");
  }
  ordered(facts.origins.frontiers, "frontiers-order", row => [row.node, row.kind, row.subject, row.context], row => at(row.node));
  for (const frontier of facts.origins.frontiers) { node(frontier.node); producer(frontier.subject, at(frontier.node)); valueContext(frontier.context, at(frontier.node)); }
  ordered(facts.origins.constructions, "constructions-order", row => [row.node, row.root.body, row.root.node, row.allocation.body, row.allocation.node,
    row.implementation === null ? "" : row.implementation, row.body === null ? "" : instanceKey(row.body)], row => at(row.node));
  for (const construction of facts.origins.constructions) {
    node(construction.node); const site = at(construction.node); nodeRef(construction.root, site, false); nodeRef(construction.allocation, site, false);
    if (construction.implementation !== null && !context.definitionExists(construction.implementation)) report("producer-resolves", site,
      "A construction retains its actual selected implementation declaration.");
    for (const region of construction.regions) { nodeRef(region.node, site, false); valueContext(region.context, site);
      if (!context.definitionExists(region.owner)) report("cross-owner-qualified", site, "Each constructor region retains its actual lexical declaration owner."); }
  }
  ordered(facts.origins.instanceRegions, "regions-order", row => [row.owner, row.node.body, row.node.node, row.context], row => ({ kind: "node", at: row.node }));
  for (const region of facts.origins.instanceRegions) { nodeRef(region.node, { kind: "node", at: region.node }, false); valueContext(region.context, bodySite); }

  nodeOrder(facts.suspension.suspensions, "suspensions-order");
  const suspensionKinds = new Map<NodeId, "await" | "yield" | "delegate">();
  for (const block of mir.blocks) if (block.terminator.kind === "await" || block.terminator.kind === "yield" || block.terminator.kind === "delegate") {
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
    ordered(error.invalidations, "error-invalidations-order", row => [row.at.body, row.at.node, row.kind], () => site);
    for (const invalidation of error.invalidations) {
      nodeRef(invalidation.at, site);
      if (!validIndex(invalidation.owner, facts.arena.origins.length)) report("error-invalidation-origins-resolve", site,
        "An error invalidation retains its actual owner origins in this arena.");
      const owned = facts.arena.origins[invalidation.owner];
      if (invalidation.kind === "invalidated" && invalidation.cause === "overlapping-write") {
        if (!validIndex(invalidation.affected, facts.arena.origins.length)) report("error-invalidation-origins-resolve", site,
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
        if (id !== null && !validIndex(id, facts.arena.origins.length)) report("error-invalidation-origins-resolve", site,
          "An unproven error reason retains its actual affected or constructor origins.");
        if ((reason.kind === "incomplete-origins" || reason.kind === "open-constructor-domain") && id !== null && facts.arena.origins[id]?.kind === "complete") {
          report("error-invalidation-outcome-exact", site, "An incomplete-domain reason must retain an actually open origin domain.");
        }
      }
    }
  }
  nodeOrder(facts.pointerBacking.pointers, "pointers-order");
  for (const pointer of facts.pointerBacking.pointers) {
    node(pointer.node); const site = at(pointer.node); origins(pointer.origins, site);
    const actual = facts.arena.origins[pointer.origins];
    for (const backing of pointer.producers) {
      producer(backing.producer, site, true); nodeRef(backing.operation.at, site);
      if (actual !== undefined && !actual.producers.includes(backing.producer) ||
        backing.operation.family === "raw-memory" && backing.operation.operation !== "reinterpret" ||
        backing.operation.family === "typed-location" && !["allocate", "address-of", "bind-pointer", "project-pointer"].includes(backing.operation.operation)) {
        report("pointer-backing-family-exact", site, "Each pointer backing retains its own correlated producer and exact typed-location or raw-memory operation.");
      }
    }
  }
  const metadataLayout = (reference: MetadataLayoutRef, site: FactsSite): MemoryLayout | undefined => {
    const record = context.metadataOf(reference.metadata);
    const selected = record !== null && record.kind !== "data-layout" && validIndex(reference.layout, record.layouts.length) ? record.layouts[reference.layout] : undefined;
    if (record === null || selected === undefined || selected.id !== reference.layout || record.key.definition !== reference.metadata.definition ||
      !sameBindings(record.key.bindings, reference.metadata.bindings)) report("metadata-reference-resolves", site,
      "A layout reference retains its actual metadata declaration, complete binding environment and local layout ID.");
    return selected;
  };
  const metadataField = (reference: MetadataFieldRef, site: FactsSite): MemoryField | undefined => {
    const record = context.metadataOf(reference.metadata);
    const selected = record !== null && record.kind !== "data-layout" && validIndex(reference.field, record.fields.length) ? record.fields[reference.field] : undefined;
    if (record === null || selected === undefined || selected.id !== reference.field || record.key.definition !== reference.metadata.definition ||
      !sameBindings(record.key.bindings, reference.metadata.bindings)) report("metadata-reference-resolves", site,
      "A field reference retains its actual metadata declaration, complete binding environment and local field ID.");
    return selected;
  };
  nodeOrder(facts.observations, "observations-order");
  for (const observation of facts.observations) {
    node(observation.node); const site = at(observation.node); nodeRef(observation.operand, site);
    type(observation.result, site); valueContext(observation.context, site); bindings(observation.bindings, site, observation.layout.metadata.definition);
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
    bindings(raw.bindings, site, raw.layout.metadata.definition);
    const selected = metadataLayout(raw.layout, site);
    if (selected !== undefined && selected.source !== raw.pointee) report("cross-owner-qualified", site, "A raw location retains its actual selected pointee layout.");
  }
  nodeOrder(facts.fieldBindings, "field-bindings-order");
  for (const field of facts.fieldBindings) {
    node(field.node); const site = at(field.node); type(field.result, site); type(field.owner, site); type(field.pointee, site);
    nodeRef(field.fieldExpression, site); nodeRef(field.pointer, site); valueContext(field.context, site); bindings(field.bindings, site, field.field.metadata.definition);
    const selected = metadataField(field.field, site);
    if (selected !== undefined && (selected.owner !== field.owner || selected.value !== field.pointee)) report("cross-owner-qualified", site,
      "A bound field retains its exact authored owner and pointee correspondence.");
  }
  nodeOrder(facts.recordBindings, "record-bindings-order");
  for (const record of facts.recordBindings) {
    node(record.node); const site = at(record.node); type(record.result, site); nodeRef(record.layoutExpression, site);
    valueContext(record.context, site); bindings(record.bindings, site, record.layout.metadata.definition); metadataLayout(record.layout, site);
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
      if (origin === undefined || !context.diagnostics.some(diagnostic => diagnostic.severity === "error" && diagnostic.site.kind === "source" &&
        diagnostic.site.origin.module === origin.module && diagnostic.site.origin.start === origin.start && diagnostic.site.origin.length === origin.length)) {
        report("memory-binding-error-diagnostic", site, "An error binding retains an actual error diagnostic from the same complete checked diagnostic vector.");
      }
    }
  }
  ordered(facts.selectedMemoryDeclarations, "selected-declarations-order", row => [row], () => bodySite);
  for (const selected of facts.selectedMemoryDeclarations) if (!context.definitionExists(selected)) report("cross-owner-qualified", bodySite,
    "Every selected memory declaration retains its actual declaration identity.");
  nodeOrder(facts.closedArrays, "closed-arrays-order");
  for (const array of facts.closedArrays) {
    node(array.node); const site = at(array.node);
    if (array.kind === "unproven") {
      if (array.reason.kind === "open-origin-domain") origins(array.reason.origins, site); else nodeRef(array.reason.at, site);
    } else {
      for (const declaration of array.declarations) if (!context.definitionExists(declaration)) report("cross-owner-qualified", site,
        "A closed array retains actual checked declaration identities.");
      for (const reference of array.references) nodeRef(reference, site);
      for (const literal of array.literals) nodeRef(literal, site);
      for (const element of array.elements) {
        bindings(element.decision.bindings, site);
        if (element.decision.read !== null) type(element.decision.read, site);
        if (element.decision.write !== null) type(element.decision.write, site);
      }
    }
  }
  for (const violation of verifyFactBindings(bindingInputs, context)) violations.push(violation);
  const limits = context.limits;
  let exceeded = mir.blocks.length > limits.maximumBlocksPerBody || mir.places.length > limits.maximumPlacesPerBody;
  const arena = facts.arena;
  const depths: number[] = [];
  let references = 0;
  for (const projection of arena.projections) {
    const parent = projection.parent === null ? 0 : depths[projection.parent];
    const depth = parent === undefined ? 0 : parent + 1; depths.push(depth);
    if (depth > limits.maximumProjectionDepth) exceeded = true;
    if (projection.parent !== null) references += 1;
  }
  for (const origins of arena.origins) {
    if (origins.producers.length > limits.maximumOriginAlternatives) exceeded = true;
    references += origins.producers.length + (origins.kind === "open" ? origins.boundaries.length : 0);
  }
  for (const value of arena.contexts) references += value.arguments.length + value.captures.length + (value.receiver === null ? 0 : 1);
  references += arena.boundProducers.length * 2 + arena.boundaries.length * 3;
  const rows = arena.projections.length + arena.producers.length + arena.contexts.length + arena.boundProducers.length + arena.origins.length + arena.boundaries.length;
  if (exceeded || rows > limits.maximumRelationalRecordsPerBody || references > limits.maximumRelationalReferencesPerBody) {
    report("analysis-limits-respected", bodySite, "Published blocks, places, projection depth, alternatives, relational rows and references respect the actual six producer limits.");
  }
  return Object.freeze(violations);
};
