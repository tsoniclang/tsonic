import { ProgramWork } from "./work.js";
import type { ProgramVerificationResult, ProgramSite, ModuleBodies, ProgramIndex, ProgramVerificationContext, PublishedBody, VerifyModuleBodies } from "./contract.js";
import type { ArgumentTransport, MetadataKey, RelationalOwner, SummaryKey } from "../ir-facts/contract.js";
import type { MemberSelection, ResolvedCallee, TirVerifierInput } from "../ir-tir/contract.js";
import { verifyTir, verifyTirModule } from "../ir-tir/index.js";
import { summaryKey, verifyFacts, verifyObservations } from "../ir-facts/index.js";
import { verifyMir } from "../ir-mir/index.js";
import { constantReferenceKey, executionKey, instanceKey, printTypes } from "../ir-types/index.js";
import type { NodeId } from "../ids/contract.js";
import type { SyntaxNode } from "../ir-hir/contract.js";
import type { TypedPhase } from "../ir-tir/contract.js";
import { childrenOfSyntax, indexSyntaxTree } from "../ir-hir/index.js";
import { encodeKey } from "../ids/index.js";
import type { SyntaxInventory } from "./syntax-arena.js";
import { inventorySyntax, moduleSyntaxRoots } from "./syntax-arena.js";
import { syntaxEdges } from "./syntax-edges.js";
import type { BodyInstance, Execution, TypeInterner } from "../ir-types/contract.js";
import type { ProgramLookup, ProgramViolation } from "./program-values.js";
import { artifactEnvironmentKey, compareExecutions, compareInstances, numberDetail, programChildRule, programLookup, textDetail, uniqueRows } from "./program-values.js";
import { refuseVerification, verificationTypes } from "./verification-work.js";
import { verifyMetadataOperands } from "./verify-metadata-operands.js";


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
    const key = summaryKey(value);
    const record = lookup.summaries.get(key);
    if (record === undefined || record === null) missing("binding-artifact-present", path, key);
  }
  function arena(owner: RelationalOwner, path: string): void {
    switch (owner.kind) {
      case "body": {
        const key = executionKey(owner.execution);
        const record = lookup.executions.get(key);
        const body = lookup.instances.get(instanceKey(owner.execution.instance));
        if (record === undefined || record === null || body === undefined || body === null) missing("cross-owner-reference-resolves", path, key);
        break;
      }
      case "summary": {
        const key = summaryKey(owner.key);
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
        const key = constantReferenceKey(constant.value.reference);
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
  for (const facts of published.facts) {
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
  for (const [position, location] of facts.rawLocations.entries()) metadata(location.layout.metadata, "facts.rawLocations[" + position + "].layout.metadata");
  for (const [position, field] of facts.fieldBindings.entries()) metadata(field.field.metadata, "facts.fieldBindings[" + position + "].field.metadata");
  for (const [position, record] of facts.recordBindings.entries()) metadata(record.layout.metadata, "facts.recordBindings[" + position + "].layout.metadata");
  for (const [position, closed] of facts.closedArrays.entries()) {
    if (closed.kind === "closed") for (const [elementIndex, element] of closed.elements.entries()) selection(element, "facts.closedArrays[" + position + "].elements[" + elementIndex + "]");
  }
  }
  for (const [position, observation] of published.observations.rows.entries()) {
    const path = "observations.rows[" + position + "]";
    metadata(observation.layout.metadata, path + ".layout.metadata");
    if (observation.field !== null) metadata(observation.field.metadata, path + ".field.metadata");
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
  types: TypeInterner,
  lookup: ProgramLookup,
): ProgramVerificationResult {
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
  const sourceBodies = uniqueRows(input === null ? [] : input.source.bodies, body => body.body);
  for (const published of module.bodies) {
    const site: ProgramSite = { kind: "body", instance: published.instance };
    const source = sourceBodies.get(published.instance.body);
    if (source === undefined || source === null || input === null) {
      violations.push({ rule: "facts-valid", site, detail: [textDetail("missing-observation-source")] });
    } else {
      const observations = verifyObservations(published.observations, {
        source, bodyOf: body => sourceBodies.get(body) ?? null, nodeOf: input.nodeOf, facts: context.facts,
        types, typeExpansion: ProgramWork.state(context.resources).limits.typeExpansion,
      });
      if (observations.kind === "resource-limit") return { ...observations, site };
      for (const child of observations.violations) {
        violations.push({ rule: programChildRule("facts-valid", child.rule), site, detail: [textDetail(child.rule), ...child.detail] });
      }
      const metadata = verifyMetadataOperands(published, input, lookup, context, types);
      if (metadata.kind === "resource-limit") return metadata;
      for (const child of metadata.violations) violations.push(child);
    }
    if (input !== null) {
      for (const child of verifyTir(input, published.tir)) {
        violations.push({ rule: programChildRule("tir-valid", child.rule), site, detail: [textDetail(child.rule), ...child.detail] });
      }
      const mir = verifyMir(published.mir, {
        limits: context.mirVerification, source: published.tir, bodyOf: input.bodyOf, types: index.types,
        declarationOf: input.declarationOf, bodyOwner: context.facts.bodyOwner,
      });
      // A body past its limit is the answer for the module: it names the body, and nothing gathered so far is a finding.
      if (mir.kind === "resource-limit") return { kind: "resource-limit", body: published.instance, dimension: mir.dimension, maximum: mir.maximum };
      for (const child of mir.violations) {
        violations.push({ rule: programChildRule("mir-valid", child.rule), site, detail: [textDetail(child.rule), ...child.detail] });
      }
    }
    for (const facts of published.facts) {
      if (instanceKey(facts.execution.instance) !== instanceKey(published.instance)) continue;
      for (const child of verifyFacts(facts, published.mir, context.facts)) {
        violations.push({ rule: programChildRule("facts-valid", child.rule), site, detail: [textDetail(child.rule), ...child.detail] });
      }
    }
  }
  return { kind: "complete", violations };
}

export const verifyModuleBodies: VerifyModuleBodies = (index, module, context) => {
  const prepared = verificationTypes(index, context.resources);
  if (prepared.kind === "resource-limit") return prepared;
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
  const children = verifyPublishedChildren(index, module, input, context, prepared.types, lookup);
  if (children.kind === "resource-limit") return refuseVerification(index, context.resources, children);
  for (const child of children.violations) violations.push(child);
  return { kind: "complete", violations };
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
    const observationsKey = instanceKey(published.observations.instance);
    if (key !== tirKey || key !== mirKey || key !== observationsKey) {
      violations.push({
        rule: "body-instance-exact", site: bodySite,
        detail: [textDetail(tirKey), textDetail(mirKey), textDetail(observationsKey)],
      });
    }
    const required = lookup.executionsByInstance.get(key) ?? [];
    const factsKeys = new Set<string>();
    let previousExecution: Execution | null = null;
    for (const facts of published.facts) {
      const execution = facts.execution;
      const factsKey = executionKey(execution);
      if (previousExecution !== null && compareExecutions(previousExecution, execution) >= 0) {
        violations.push({ rule: "facts-execution-order", site: bodySite, detail: [textDetail(factsKey)] });
      }
      previousExecution = execution;
      const selected = lookup.executions.get(factsKey);
      if (instanceKey(execution.instance) !== key || selected === undefined || selected === null || factsKeys.has(factsKey)) {
        violations.push({ rule: "facts-execution-total", site: bodySite, detail: [textDetail(factsKey)] });
      }
      factsKeys.add(factsKey);
    }
    for (const execution of required) {
      const executionIdentity = executionKey(execution);
      if (!factsKeys.has(executionIdentity)) {
        violations.push({ rule: "facts-execution-total", site: bodySite, detail: [textDetail(executionIdentity)] });
      }
      const entry = published.mir.entries[published.mir.entries[0] === undefined ? -1
        : published.mir.entries[0].provided - execution.provided];
      if (entry === undefined || entry.provided !== execution.provided || !Number.isSafeInteger(execution.provided)
        || execution.provided < 0 || Object.is(execution.provided, -0)) {
        violations.push({ rule: "execution-entry-resolves", site: bodySite, detail: [numberDetail(execution.provided)] });
      }
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
