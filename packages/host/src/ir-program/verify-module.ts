import type { ProgramSite, ModuleBodies, ProgramIndex, ProgramVerificationContext, PublishedBody, VerifyModuleBodies } from "./contract.js";
import type { ArgumentTransport, MetadataKey, RelationalOwner, SummaryKey } from "../ir-facts/contract.js";
import type { MirOperand, MirRvalue, MirSite, MirTerminator } from "../ir-mir/contract.js";
import type { MemberSelection, ResolvedCallee, TirVerifierInput } from "../ir-tir/contract.js";
import { verifyTir, verifyTirModule } from "../ir-tir/index.js";
import { verifyFacts } from "../ir-facts/index.js";
import { verifyMir } from "../ir-mir/index.js";
import { printTypes } from "../ir-types/index.js";
import type { NodeId } from "../ids/contract.js";
import type { SyntaxNode } from "../ir-hir/contract.js";
import type { TypedPhase } from "../ir-tir/contract.js";
import { childrenOfSyntax, indexSyntaxTree } from "../ir-hir/index.js";
import { encodeKey } from "../ids/index.js";
import type { SyntaxInventory } from "./syntax-arena.js";
import { inventorySyntax, moduleSyntaxRoots } from "./syntax-arena.js";
import { syntaxEdges } from "./syntax-edges.js";
import type { BodyInstance } from "../ir-types/contract.js";
import type { ProgramLookup, ProgramViolation } from "./program-values.js";
import { artifactEnvironmentKey, compareInstances, instanceKey, numberDetail, programChildRule, programLookup, textDetail, uniqueRows } from "./program-values.js";

function metadataKeys(published: PublishedBody): ReadonlyMap<string, ReadonlySet<string>> {
  const positions = new Map<string, Set<string>>();
  function allow(node: NodeId, metadata: MetadataKey): void {
    const position = encodeKey([node]);
    const key = artifactEnvironmentKey(metadata.definition, metadata.bindings);
    const previous = positions.get(position);
    if (previous === undefined) positions.set(position, new Set([key]));
    else previous.add(key);
  }
  const facts = published.facts;
  const fields = uniqueRows(facts.fieldBindings, field => encodeKey([field.node]));
  for (const observation of facts.observations) {
    allow(observation.node, observation.layout.metadata);
    if (observation.operation === "field-offset" && observation.field !== null) allow(observation.node, observation.field.metadata);
  }
  for (const field of facts.fieldBindings) allow(field.node, field.field.metadata);
  for (const record of facts.recordBindings) {
    allow(record.node, record.layout.metadata);
    for (const linked of record.fields) {
      const field = fields.get(encodeKey([linked.binding]));
      if (field !== undefined && field !== null) allow(record.node, field.field.metadata);
    }
  }
  return positions;
}

function verifyMetadataOperands(published: PublishedBody): readonly ProgramViolation[] {
  const allowed = metadataKeys(published);
  const constants = uniqueRows(published.mir.constants, constant => encodeKey([constant.id]));
  const constantKeys = new Map<string, string>();
  const violations: ProgramViolation[] = [];
  function operand(value: MirOperand, site: MirSite, path: string): void {
    if (value.kind !== "constant") return;
    const identity = encodeKey([value.constant]);
    const constant = constants.get(identity);
    if (constant === undefined || constant === null || constant.value.kind !== "metadata") return;
    let key = constantKeys.get(identity);
    if (key === undefined) {
      key = artifactEnvironmentKey(constant.value.definition, constant.value.bindings);
      constantKeys.set(identity, key);
    }
    const keys = site.tir.body === published.facts.instance.body ? allowed.get(encodeKey([site.tir.node])) : undefined;
    if (keys === undefined || !keys.has(key)) violations.push({
      rule: "metadata-constant-not-materialised", site: { kind: "body", instance: published.instance },
      detail: [textDetail(path), numberDetail(value.constant), textDetail(key)],
    });
  }
  function rvalue(value: MirRvalue, site: MirSite, path: string): void {
    switch (value.kind) {
      case "use":
      case "unary":
      case "convert": operand(value.operand, site, path + ".operand"); break;
      case "binary":
        operand(value.left, site, path + ".left");
        operand(value.right, site, path + ".right");
        break;
      case "aggregate":
        switch (value.aggregate.kind) {
          case "array":
          case "tuple":
          case "fixed-array":
            for (const [position, entry] of value.aggregate.elements.entries()) operand(entry, site, path + ".aggregate.elements[" + position + "]");
            break;
          case "object":
          case "record":
            for (const [position, field] of value.aggregate.fields.entries()) operand(field.value, site, path + ".aggregate.fields[" + position + "].value");
            break;
        }
        break;
      case "address-of":
      case "closure": break;
    }
  }
  function terminator(value: MirTerminator, path: string): void {
    switch (value.kind) {
      case "goto":
      case "unreachable": break;
      case "switch":
        operand(value.operand, value, path + ".operand");
        for (const [position, target] of value.targets.entries()) operand({ kind: "constant", constant: target.constant }, value, path + ".targets[" + position + "].constant");
        break;
      case "call":
        if (value.callee.kind === "indirect") operand(value.callee.operand, value, path + ".callee.operand");
        if (value.receiver !== null) operand(value.receiver, value, path + ".receiver");
        for (const [position, argument] of value.arguments.entries()) {
          if (argument.kind === "value") operand(argument.operand, value, path + ".arguments[" + position + "].operand");
        }
        break;
      case "invoke":
        for (const [position, entry] of value.operands.entries()) operand(entry, value, path + ".operands[" + position + "]");
        break;
      case "await":
      case "throw": operand(value.operand, value, path + ".operand"); break;
      case "yield": if (value.operand !== null) operand(value.operand, value, path + ".operand"); break;
      case "delegate": operand(value.iterator, value, path + ".iterator"); break;
      case "return": if (value.value !== null) operand(value.value, value, path + ".value"); break;
    }
  }
  for (const [blockIndex, block] of published.mir.blocks.entries()) {
    const path = "mir.blocks[" + blockIndex + "]";
    for (const [position, statement] of block.statements.entries()) {
      switch (statement.kind) {
        case "storage-live":
        case "storage-dead": break;
        case "assign": rvalue(statement.value, statement, path + ".statements[" + position + "].value"); break;
      }
    }
    terminator(block.terminator, path + ".terminator");
  }
  return violations;
}

function verifyReferenceRoots(
  lookup: ProgramLookup, published: PublishedBody, context: ProgramVerificationContext,
): readonly ProgramViolation[] {
  const violations: ProgramViolation[] = [];
  const site: ProgramSite = { kind: "body", instance: published.instance };
  function missing(rule: "binding-artifact-present" | "cross-owner-reference-resolves", path: string, key: string): void {
    violations.push({ rule, site, detail: [textDetail(path), textDetail(key)] });
  }
  function instance(value: BodyInstance, path: string): void {
    const key = instanceKey(value);
    switch (value.bindings.kind) {
      case "parametric":
        if (context.facts.bodyOwner(value.body) === null) missing("cross-owner-reference-resolves", path, key);
        break;
      case "instantiated": {
        const record = lookup.instances.get(key);
        if (record === undefined || record === null) missing("binding-artifact-present", path, key);
        break;
      }
    }
  }
  function metadata(value: MetadataKey, path: string): void {
    const key = artifactEnvironmentKey(value.definition, value.bindings);
    const record = lookup.metadata.get(key);
    if (record === undefined || record === null) missing("binding-artifact-present", path, key);
  }
  function summary(value: SummaryKey, path: string): void {
    const key = artifactEnvironmentKey(value.definition, value.bindings);
    const record = lookup.summaries.get(key);
    if (record === undefined || record === null) missing("binding-artifact-present", path, key);
  }
  function arena(owner: RelationalOwner, path: string): void {
    switch (owner.kind) {
      case "body": {
        const key = instanceKey(owner.instance);
        const record = lookup.instances.get(key);
        if (record === undefined || record === null) missing("cross-owner-reference-resolves", path, key);
        break;
      }
      case "summary": {
        const key = artifactEnvironmentKey(owner.definition, owner.bindings);
        const record = lookup.summaries.get(key);
        if (record === undefined || record === null) missing("cross-owner-reference-resolves", path, key);
        break;
      }
    }
  }
  function transport(value: ArgumentTransport, path: string): void {
    arena(value.formal.owner, path + ".formal.owner");
  }
  function callee(value: ResolvedCallee, path: string): void {
    if (value.activation !== null) instance(value.activation, path + ".activation");
  }
  function selection(value: MemberSelection, path: string): void {
    if (value.getter !== null) callee(value.getter, path + ".getter");
    if (value.setter !== null) callee(value.setter, path + ".setter");
  }
  for (const [position, constant] of published.mir.constants.entries()) {
    const path = "mir.constants[" + position + "].value";
    switch (constant.value.kind) {
      case "metadata": metadata(constant.value, path); break;
      case "constant": {
        const key = instanceKey(constant.value.reference.initializer);
        const record = lookup.constants.get(key);
        if (record === undefined || record === null) missing("binding-artifact-present", path + ".reference", key);
        break;
      }
      case "literal":
      case "definition":
      case "observation": break;
    }
  }
  for (const [position, place] of published.mir.places.entries()) {
    if ((place.base.kind === "place" || place.base.kind === "checked") && place.base.projection.kind === "field") selection(place.base.projection.member, "mir.places[" + position + "].base.projection.member");
  }
  for (const [blockIndex, block] of published.mir.blocks.entries()) {
    const path = "mir.blocks[" + blockIndex + "]";
    for (const [position, statement] of block.statements.entries()) {
      if (statement.kind !== "assign") continue;
      const value = statement.value;
      const valuePath = path + ".statements[" + position + "].value";
      if (value.kind === "closure") instance(value.instance, valuePath + ".instance");
      else if (value.kind === "aggregate" && (value.aggregate.kind === "object" || value.aggregate.kind === "record")) {
        for (const [fieldIndex, field] of value.aggregate.fields.entries()) selection(field.member, valuePath + ".aggregate.fields[" + fieldIndex + "].member");
      }
    }
    if (block.terminator.kind === "call") {
      if (block.terminator.callee.kind === "body") instance(block.terminator.callee.instance, path + ".terminator.callee.instance");
      else callee(block.terminator.callee.resolution, path + ".terminator.callee.resolution");
    }
  }
  const facts = published.facts;
  for (const [position, projection] of facts.arena.projections.entries()) {
    if (projection.projection.kind === "field" || projection.projection.kind === "method-value") selection(projection.projection.member, "facts.arena.projections[" + position + "].projection.member");
  }
  for (const [position, invocation] of facts.origins.invocations.entries()) {
    for (const [alternativeIndex, alternative] of invocation.alternatives.entries()) {
      const path = "facts.origins.invocations[" + position + "].alternatives[" + alternativeIndex + "]";
      callee(alternative.resolution, path + ".resolution");
      summary(alternative.summary, path + ".summary");
      for (const [argumentIndex, argument] of alternative.arguments.entries()) transport(argument, path + ".arguments[" + argumentIndex + "]");
    }
  }
  for (const [position, callback] of facts.origins.callbacks.entries()) transport(callback.argument, "facts.origins.callbacks[" + position + "].argument");
  for (const [position, activation] of facts.origins.activations.entries()) {
    instance(activation.activation, "facts.origins.activations[" + position + "].activation");
    if (activation.entry !== null) transport(activation.entry, "facts.origins.activations[" + position + "].entry");
  }
  for (const [position, construction] of facts.origins.constructions.entries()) {
    if (construction.body !== null) instance(construction.body, "facts.origins.constructions[" + position + "].body");
  }
  for (const [position, observation] of facts.observations.entries()) {
    const path = "facts.observations[" + position + "]";
    metadata(observation.layout.metadata, path + ".layout.metadata");
    if (observation.field !== null) metadata(observation.field.metadata, path + ".field.metadata");
  }
  for (const [position, location] of facts.rawLocations.entries()) metadata(location.layout.metadata, "facts.rawLocations[" + position + "].layout.metadata");
  for (const [position, field] of facts.fieldBindings.entries()) metadata(field.field.metadata, "facts.fieldBindings[" + position + "].field.metadata");
  for (const [position, record] of facts.recordBindings.entries()) metadata(record.layout.metadata, "facts.recordBindings[" + position + "].layout.metadata");
  for (const [position, closed] of facts.closedArrays.entries()) {
    if (closed.kind === "closed") for (const [elementIndex, element] of closed.elements.entries()) selection(element, "facts.closedArrays[" + position + "].elements[" + elementIndex + "]");
  }
  return violations;
}

function verifySyntaxIdentities(module: ModuleBodies, input: TirVerifierInput | null, syntax: SyntaxInventory): readonly ProgramViolation[] {
  const violations: ProgramViolation[] = [];
  const anchors = new Map<string, SyntaxNode<TypedPhase> | null>();
  let position = 0;
  for (const node of syntax.nodes) {
    if (position === syntax.firstRootSize) break;
    const key = encodeKey([node.id]);
    anchors.set(key, anchors.has(key) ? null : node);
    if (!Object.is(node.id, position)) violations.push({
      rule: "module-node-id-dense", site: { kind: "node", module: node.origin.module, node: node.id }, detail: [numberDetail(position), numberDetail(node.id)],
    });
    position += 1;
  }
  if (input === null) return violations;
  const canonical = uniqueRows(indexSyntaxTree(input.source.tree), node => encodeKey([node.id]));
  const bodies = uniqueRows(input.source.bodies, body => body.body);
  const failures = new Map<SyntaxNode<TypedPhase>, { readonly node: NodeId; readonly kind: string }>();
  for (const node of syntax.postorder) {
    const source = canonical.get(encodeKey([node.id]));
    const children = syntaxEdges(node);
    let differs = source === undefined || source === null || source.kind !== node.kind;
    if (source !== undefined && source !== null && !differs) {
      const expected = childrenOfSyntax(source);
      differs = expected.length !== children.length || children.some((child, index) => {
        const original = expected[index];
        return original === undefined || !Object.is(original.id, child.node.id) || original.kind !== child.node.kind;
      });
    }
    if (differs) failures.set(node, { node: node.id, kind: node.kind });
    else for (const child of children) {
      const failure = failures.get(child.node);
      if (failure !== undefined) { failures.set(node, failure); break; }
    }
  }
  for (const published of module.bodies) {
    const site: ProgramSite = { kind: "body", instance: published.instance };
    const root = published.tir.root;
    const source = bodies.get(published.tir.body);
    const failure = failures.get(root);
    if (source === undefined || source === null) violations.push({ rule: "body-levels-total", site, detail: [textDetail("source")] });
    else {
      if (!Object.is(source.root.id, root.id)) violations.push({ rule: "instance-node-ids-exact", site, detail: [numberDetail(source.root.id), numberDetail(root.id)] });
      else if (failure !== undefined) violations.push({ rule: "instance-node-ids-exact", site, detail: [numberDetail(failure.node), textDetail(failure.kind)] });
      if (encodeKey(source.nestedBodies) !== encodeKey(published.tir.nestedBodies)) violations.push({
        rule: "nested-body-boundary", site, detail: [textDetail(encodeKey(source.nestedBodies)), textDetail(encodeKey(published.tir.nestedBodies))],
      });
    }
    const anchor = anchors.get(encodeKey([root.id]));
    if (published.instance.bindings.kind === "parametric" && anchor !== root) violations.push({
      rule: "template-body-shared", site, detail: [numberDetail(root.id)],
    });
  }
  return violations;
}

export function verifyPublishedChildren(
  index: ProgramIndex,
  module: ModuleBodies,
  input: TirVerifierInput | null,
  context: ProgramVerificationContext,
): readonly ProgramViolation[] {
  const violations: ProgramViolation[] = [];
  if (input === null) {
    violations.push({ rule: "tir-valid", site: { kind: "module", module: module.module }, detail: [textDetail("missing-module-data")] });
  } else {
    for (const child of verifyTirModule(input, {
      module: module.module, tree: module.tree, bodies: module.bodies.map(published => published.tir),
    })) {
      const site: ProgramSite = { kind: "node", module: child.site.module, node: child.site.node };
      violations.push({ rule: programChildRule("tir-valid", child.rule), site, detail: [textDetail(child.rule), ...child.detail] });
    }
  }
  for (const published of module.bodies) {
    const site: ProgramSite = { kind: "body", instance: published.instance };
    if (input !== null) {
      for (const child of verifyTir(input, published.tir)) {
        violations.push({ rule: programChildRule("tir-valid", child.rule), site, detail: [textDetail(child.rule), ...child.detail] });
      }
      for (const child of verifyMir(published.mir, {
        source: published.tir, types: index.types,
        declarationOf: input.declarationOf, bodyOwner: context.facts.bodyOwner,
      })) {
        violations.push({ rule: programChildRule("mir-valid", child.rule), site, detail: [textDetail(child.rule), ...child.detail] });
      }
    }
    for (const child of verifyFacts(published.facts, published.mir, context.facts)) {
      violations.push({ rule: programChildRule("facts-valid", child.rule), site, detail: [textDetail(child.rule), ...child.detail] });
    }
  }
  return violations;
}

export const verifyModuleBodies: VerifyModuleBodies = (index, module, context) => {
  const syntax = inventorySyntax(moduleSyntaxRoots(module, "ModuleBodies"));
  const lookup = programLookup(index);
  const input = context.tirOf(module.module);
  const violations: ProgramViolation[] = [...verifyModuleInventory(lookup, index, module)];
  for (const published of module.bodies) {
    for (const violation of verifyReferenceRoots(lookup, published, context)) violations.push(violation);
  }
  for (const violation of verifySyntaxIdentities(module, input, syntax)) violations.push(violation);
  const expectedTypes = printTypes(index.types);
  if (expectedTypes !== printTypes(context.facts.types) || (input !== null && expectedTypes !== printTypes(input.types))) {
    violations.push({ rule: "shared-type-table", site: { kind: "module", module: module.module }, detail: [] });
  }
  for (const child of verifyPublishedChildren(index, module, input, context)) violations.push(child);
  return violations;
};

export function verifyModuleInventory(
  lookup: ProgramLookup,
  index: ProgramIndex,
  module: ModuleBodies,
): readonly ProgramViolation[] {
  const violations: ProgramViolation[] = [];
  const site: ProgramSite = { kind: "module", module: module.module };
  const record = lookup.modules.get(module.module);
  if (record === undefined || record === null) {
    violations.push({ rule: "chunk-module-resolves", site, detail: [textDetail(module.module)] });
  }
  if (module.tree.tsonic.module !== module.module || module.tree.origin.module !== module.module) {
    violations.push({
      rule: "chunk-tree-module-exact", site,
      detail: [textDetail(module.tree.tsonic.module), textDetail(module.tree.origin.module)],
    });
  }
  const instances = new Set<string>();
  let previous: BodyInstance | null = null;
  for (const published of module.bodies) {
    const bodySite: ProgramSite = { kind: "body", instance: published.instance };
    const key = instanceKey(published.instance);
    if (previous !== null && compareInstances(previous, published.instance) >= 0) {
      violations.push({ rule: "chunk-bodies-order", site: bodySite, detail: [textDetail(instanceKey(previous)), textDetail(key)] });
    }
    previous = published.instance;
    instances.add(key);
    const expected = lookup.instances.get(key);
    if (expected === undefined || expected === null || expected.module !== module.module) {
      violations.push({ rule: "body-levels-total", site: bodySite, detail: [textDetail(module.module)] });
    }
    const tirKey = instanceKey({ body: published.tir.body, bindings: published.tir.bindings });
    const mirKey = instanceKey({ body: published.mir.body, bindings: published.mir.bindings });
    const factsKey = instanceKey(published.facts.instance);
    if (key !== tirKey || key !== mirKey || key !== factsKey) {
      violations.push({
        rule: "body-instance-exact", site: bodySite,
        detail: [textDetail(tirKey), textDetail(mirKey), textDetail(factsKey)],
      });
    }
    if (expected !== undefined && expected !== null) {
      const actualCounts = [
        published.mir.locals.length, published.mir.constants.length,
        published.mir.places.length, published.mir.blocks.length,
      ];
      const expectedCounts = [
        expected.mirLocalCount, expected.mirConstantCount,
        expected.mirPlaceCount, expected.mirBlockCount,
      ];
      if (actualCounts.some((count, position) => !Object.is(count, expectedCounts[position]))) {
        violations.push({
          rule: "mir-index-counts-exact", site: bodySite,
          detail: [...expectedCounts.map(numberDetail), ...actualCounts.map(numberDetail)],
        });
      }
    }
    for (const violation of verifyMetadataOperands(published)) violations.push(violation);
  }
  for (const body of index.bodies) {
    if (body.module === module.module && !instances.has(instanceKey(body.instance))) {
      violations.push({
        rule: "body-levels-total", site: { kind: "body", instance: body.instance }, detail: [textDetail(module.module)],
      });
    }
  }
  return violations;
}
