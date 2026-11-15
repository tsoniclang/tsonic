import type { DataflowStop } from "../dataflow/contract.js";
import { chargeResultEntries, chargeWork, stronglyConnectedComponents } from "../dataflow/index.js";
import type { Violation } from "../diag/contract.js";
import { encodeKey } from "../ids/index.js";
import { verifyBindings } from "../ir-types/index.js";
import type { DependencyRule, FactsSite, SummaryKey, VerifyDependencyInventory } from "./contract.js";
import { acceptsProvided } from "./execution-entry.js";
import { admitSummaryIdentity, summaryBindings, summaryDefinition, summaryKey } from "./summary-key.js";
import { recordFinding, selectedMirBody } from "./verification.js";
import { validIndex } from "./verify-relations.js";

export const verifyDependencyInventory: VerifyDependencyInventory = (inventory, context, account) => {
  const initial = chargeWork(account, 1) ?? chargeResultEntries(account, 9);
  if (initial !== null) return initial;
  const violations: Violation<DependencyRule, FactsSite>[] = [];
  const positions = new Map<string, number>();
  const successors: number[][] = [];
  const sources: (number | undefined)[] = [];
  const report = (rule: DependencyRule, site: FactsSite, detail: string): DataflowStop | null =>
    recordFinding(account, violations, "last", rule, site, detail);
  for (let position = 0; position < inventory.operations.length; position += 1) {
    const row = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
    if (row !== null) return row;
    const operation = inventory.operations[position];
    if (operation === undefined) throw new TypeError("A ready dependency inventory has a dense operation vector");
    const site: FactsSite = { kind: "summary", summary: operation };
    const identity = admitSummaryIdentity(operation, account);
    if (identity !== null) return identity;
    const key = summaryKey(operation);
    if (positions.has(key)) {
      const stop = report("operation-unique", site, "Every complete required operation occurs exactly once.");
      if (stop !== null) return stop;
    } else positions.set(key, position);
    successors.push([]);
    const lookup = chargeWork(account, 1);
    if (lookup !== null) return lookup;
    const definition = summaryDefinition(operation, context);
    if (definition === null || !context.definitionExists(definition)) {
      const stop = report("execution-resolves", site, "The complete operation resolves to an actual selected declaration and entry.");
      if (stop !== null) return stop;
    }
    if (operation.kind === "body") {
      const selected = selectedMirBody(operation.execution, context, account);
      if (selected.kind !== "complete") return selected;
      if (selected.value === null) {
        const stop = report("execution-resolves", site, "The complete operation resolves to an actual selected declaration and entry.");
        if (stop !== null) return stop;
      }
    } else {
      const lookup = chargeWork(account, 1);
      if (lookup !== null) return lookup;
      const selected = context.signatureIdOf(operation.execution.request);
      const signature = selected !== null && validIndex(selected, context.types.signatures.length) ? context.types.signatures[selected] : undefined;
      let valid = signature !== undefined && Object.is(signature.id, selected)
        && (signature.declaration === null || signature.declaration === definition);
      if (signature !== undefined) {
        const entry = acceptsProvided(signature, operation.execution.provided, account);
        if (entry.kind !== "complete") return entry;
        valid = valid && entry.value === true;
      }
      if (!valid) {
        const stop = report("execution-resolves", site, "The complete operation resolves to an actual selected declaration and entry.");
        if (stop !== null) return stop;
      }
    }
    const bindings = summaryBindings(operation);
    if (bindings.kind === "instantiated" && definition !== null) {
      const lookup = chargeWork(account, 1);
      if (lookup !== null) return lookup;
      const scope = context.bindingScopeOf(definition);
      let valid = scope !== null;
      if (scope !== null) {
        const checked = verifyBindings([{ vector: bindings.bindings, scope }], context.types.terms.length,
          (work, entries) => chargeWork(account, work) ?? chargeResultEntries(account, entries));
        if (checked.kind === "resource-stop") return checked.stop;
        valid = checked.violations.length === 0;
      }
      if (!valid) {
        const stop = report("bindings-complete", site, "An instantiated operation retains the complete qualified declaration binding scope.");
        if (stop !== null) return stop;
      }
    }
  }
  const edges = new Set<string>();
  for (let position = 0; position < inventory.dependencies.length; position += 1) {
    const row = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (row !== null) return row;
    const dependency = inventory.dependencies[position];
    if (dependency === undefined) throw new TypeError("A ready dependency inventory has a dense dependency vector");
    const site: FactsSite = { kind: "node", at: { kind: "body", value: dependency.at } };
    const dependent: SummaryKey = { kind: "body", execution: dependency.dependent };
    const identities = admitSummaryIdentity(dependent, account) ?? admitSummaryIdentity(dependency.target, account)
      ?? chargeWork(account, dependency.at.body.length + 1);
    if (identities !== null) return identities;
    const source = positions.get(summaryKey(dependent)), target = positions.get(summaryKey(dependency.target));
    sources.push(source);
    if (source === undefined || target === undefined) {
      const stop = report("dependency-resolves", site, "Both ends of every dependency occur in the same complete required-operation inventory.");
      if (stop !== null) return stop;
    } else {
      const entry = chargeResultEntries(account, 1);
      if (entry !== null) return entry;
      const outgoing = successors[source];
      if (outgoing === undefined) throw new TypeError("The actual operation domain has an adjacency row");
      outgoing.push(target);
    }
    if (dependency.at.body !== dependency.dependent.instance.body) {
      const stop = report("cross-owner-qualified", site, "A typed dependency occurrence belongs to its complete dependent execution.");
      if (stop !== null) return stop;
    }
    if (!context.nodeExists(site.at)) {
      const stop = report("call-site-resolves", site, "A dependency retains an actual selected typed source occurrence.");
      if (stop !== null) return stop;
    }
    const identity = encodeKey([summaryKey(dependent), dependency.at.body, dependency.at.node, dependency.reason, summaryKey(dependency.target)]);
    if (edges.has(identity)) {
      const stop = report("dependency-unique", site, "A complete dependent, occurrence, target and reason identify one dependency.");
      if (stop !== null) return stop;
    } else {
      const entry = chargeResultEntries(account, 1);
      if (entry !== null) return entry;
      edges.add(identity);
    }
  }
  const connected = stronglyConnectedComponents({ successors }, account);
  if (connected.kind !== "complete") return connected;
  const membership = new Map<number, number>();
  const members: number[][] = [];
  const rows: number[][] = [];
  for (let position = 0; position < inventory.components.length; position += 1) {
    const row = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
    if (row !== null) return row;
    const component = inventory.components[position];
    if (component === undefined) throw new TypeError("A ready dependency inventory has a dense component vector");
    const site: FactsSite = { kind: "component", component: position };
    const selected: number[] = [];
    members.push(selected);
    rows.push([]);
    const input = component.kind === "declared" ? [component.operation] : component.members;
    let expected: number | undefined;
    let exact = input.length !== 0;
    let kind = true;
    for (let ordinal = 0; ordinal < input.length; ordinal += 1) {
      const step = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
      if (step !== null) return step;
      const member = input[ordinal];
      const operation = member !== undefined && validIndex(member, inventory.operations.length) ? inventory.operations[member] : undefined;
      if (member === undefined || operation === undefined || membership.has(member)) { exact = false; continue; }
      membership.set(member, position);
      selected.push(member);
      kind = kind && operation.kind === component.kind;
      const actual = connected.value.componentOf[member];
      if (expected === undefined) expected = actual;
      if (actual !== expected) exact = false;
    }
    const actual = expected === undefined ? undefined : connected.value.components[expected];
    if (!exact || actual === undefined || actual.length !== selected.length) {
      const stop = report("component-membership-exact", site, "Each component contains exactly one actual full strongly connected member set.");
      if (stop !== null) return stop;
    }
    if (!kind) {
      const stop = report("component-kind-exact", site, "Declared operations bind once; only body executions enter convergence components.");
      if (stop !== null) return stop;
    }
  }
  for (let operation = 0; operation < inventory.operations.length; operation += 1) {
    const row = chargeWork(account, 1);
    if (row !== null) return row;
    const selected = inventory.operations[operation];
    if (selected !== undefined && !membership.has(operation)) {
      const stop = report("component-membership-exact", { kind: "summary", summary: selected }, "Every required operation belongs to exactly one component.");
      if (stop !== null) return stop;
    }
  }
  for (let position = 0; position < sources.length; position += 1) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    const source = sources[position];
    const component = source === undefined ? undefined : membership.get(source);
    if (component === undefined) continue;
    const selected = rows[component];
    if (selected === undefined) throw new TypeError("The selected component retains its dependency rows");
    const entry = chargeResultEntries(account, 1);
    if (entry !== null) return entry;
    selected.push(position);
  }
  for (let position = 0; position < inventory.components.length; position += 1) {
    const row = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
    if (row !== null) return row;
    const component = inventory.components[position], selected = members[position];
    if (component === undefined || selected === undefined) throw new TypeError("Component verification retains the actual dense input domain");
    const site: FactsSite = { kind: "component", component: position };
    const expectedRows = rows[position];
    if (expectedRows === undefined) throw new TypeError("The component row domain is dense");
    const suppliedRows = component.kind === "body" ? component.rows : [];
    let exactRows = suppliedRows.length === expectedRows.length;
    for (let ordinal = 0; ordinal < suppliedRows.length; ordinal += 1) {
      const step = chargeWork(account, 1);
      if (step !== null) return step;
      if (suppliedRows[ordinal] !== expectedRows[ordinal]) exactRows = false;
    }
    if (!exactRows) {
      const stop = report("component-rows-exact", site, "Each body component retains exactly its dependent occurrence rows in original inventory order.");
      if (stop !== null) return stop;
    }
    const expected = new Set<number>();
    for (const member of selected) {
      const step = chargeWork(account, 1);
      if (step !== null) return step;
      const targets = successors[member];
      if (targets === undefined) throw new TypeError("The actual member has an adjacency row");
      for (let ordinal = 0; ordinal < targets.length; ordinal += 1) {
        const edge = chargeWork(account, 1);
        if (edge !== null) return edge;
        const target = targets[ordinal];
        const dependency = target === undefined ? undefined : membership.get(target);
        if (dependency === undefined || dependency === position || expected.has(dependency)) continue;
        const entry = chargeResultEntries(account, 1);
        if (entry !== null) return entry;
        expected.add(dependency);
      }
    }
    const supplied = new Set<number>();
    const dependencies = component.kind === "declared" ? [] : component.dependencies;
    let exact = true, ordered = true;
    for (let ordinal = 0; ordinal < dependencies.length; ordinal += 1) {
      const step = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
      if (step !== null) return step;
      const dependency = dependencies[ordinal];
      if (dependency === undefined || !validIndex(dependency, inventory.components.length) || supplied.has(dependency)) { exact = false; continue; }
      supplied.add(dependency);
      if (!expected.has(dependency)) exact = false;
      if (dependency >= position) ordered = false;
    }
    if (!exact || expected.size !== supplied.size) {
      const stop = report("component-dependencies-exact", site, "Component dependencies are exactly the actual distinct outgoing component targets.");
      if (stop !== null) return stop;
    }
    if (!ordered) {
      const stop = report("component-acyclic", site, "Every component follows all the components whose stable summaries it needs.");
      if (stop !== null) return stop;
    }
  }
  return { kind: "complete", violations };
};
