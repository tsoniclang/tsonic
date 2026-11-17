import type { DataflowAccount, DataflowResult, DataflowStop, DirectedGraph } from "../dataflow/contract.js";
import { chargeResultEntries, chargeWork, refuseAccount, stronglyConnectedComponents } from "../dataflow/index.js";
import { admitSummaryIdentity, summaryKey } from "../ir-facts/index.js";
import type { DependencyComponent, DependencyInventory, SummaryKey } from "../ir-facts/contract.js";
import type { ComponentsOf } from "./contract.js";

interface ComponentWork {
  readonly members: readonly number[];
  readonly rows: number[];
  readonly dependencies: Set<number>;
  readonly dependents: number[];
  remaining: number;
}

const admit = (account: DataflowAccount, work: number, entries: number): DataflowStop | null =>
  chargeWork(account, work) ?? chargeResultEntries(account, entries);

export const componentsOf: ComponentsOf = (deps, input) => {
  const { account, maximumComponentSize } = deps;
  if (!Number.isSafeInteger(maximumComponentSize) || maximumComponentSize < 0 || Object.is(maximumComponentSize, -0))
    throw new TypeError("Summaries component size is a nonnegative safe count");
  const initial = admit(account, 1, 6);
  if (initial !== null) return initial;
  const positions = new Map<string, number>();
  const successors: number[][] = [];
  const edges: { readonly source: number; readonly target: number }[] = [];
  for (let position = 0; position < input.operations.length; position += 1) {
    const row = admit(account, 1, 3);
    if (row !== null) return row;
    const operation = input.operations[position];
    if (operation === undefined) throw new TypeError("The required-operation vector is dense");
    const identity = admitSummaryIdentity(operation, account);
    if (identity !== null) return identity;
    const key = summaryKey(operation);
    if (positions.has(key)) throw new TypeError("Every complete required operation occurs once");
    positions.set(key, position);
    successors.push([]);
  }
  for (let position = 0; position < input.dependencies.length; position += 1) {
    const row = chargeWork(account, 1);
    if (row !== null) return row;
    const dependency = input.dependencies[position];
    if (dependency === undefined) throw new TypeError("The dependency vector is dense");
    const dependent: SummaryKey = { kind: "body", execution: dependency.dependent };
    const identities = admitSummaryIdentity(dependent, account) ?? admitSummaryIdentity(dependency.target, account);
    if (identities !== null) return identities;
    const source = positions.get(summaryKey(dependent));
    const target = positions.get(summaryKey(dependency.target));
    if (source === undefined || target === undefined)
      throw new TypeError("Components require the complete closed required-operation inventory");
    if (dependency.at.body !== dependency.dependent.instance.body)
      throw new TypeError("A dependency occurrence belongs to its actual dependent execution");
    const edge = admit(account, 1, 4);
    if (edge !== null) return edge;
    const outgoing = successors[source];
    if (outgoing === undefined) throw new TypeError("The dependent operation has an adjacency row");
    outgoing.push(target);
    edges.push({ source, target });
  }
  const graph: DirectedGraph = { successors };
  const connected = stronglyConnectedComponents(graph, account);
  if (connected.kind !== "complete") return connected;
  const graphResult = connected.value;
  const work: ComponentWork[] = [];
  for (let position = 0; position < graphResult.components.length; position += 1) {
    const row = chargeWork(account, 1);
    if (row !== null) return row;
    const members = graphResult.components[position];
    if (members === undefined || members.length === 0) throw new TypeError("Dataflow supplies nonempty dense components");
    if (members.length > maximumComponentSize) return refuseAccount(account, deps.componentRefusal);
    const growth = chargeResultEntries(account, 5);
    if (growth !== null) return growth;
    work.push({ members, rows: [], dependencies: new Set(), dependents: [], remaining: 0 });
  }
  for (let position = 0; position < edges.length; position += 1) {
    const row = admit(account, 1, 1);
    if (row !== null) return row;
    const dependency = edges[position];
    if (dependency === undefined) throw new TypeError("The retained dependency vector is dense");
    const component = graphResult.componentOf[dependency.source];
    const state = component === undefined ? undefined : work[component];
    if (component === undefined || state === undefined) throw new TypeError("Dataflow component membership is total");
    state.rows.push(position);
    const selected = graphResult.componentOf[dependency.target];
    if (selected === undefined) throw new TypeError("Dataflow component membership covers every dependency");
    if (selected === component || state.dependencies.has(selected)) continue;
    const growth = chargeResultEntries(account, 2);
    if (growth !== null) return growth;
    const destination = work[selected];
    if (destination === undefined) throw new TypeError("The target component has an adjacency row");
    state.dependencies.add(selected);
    destination.dependents.push(component);
    state.remaining += 1;
  }
  const pending: number[] = [];
  for (let position = 0; position < work.length; position += 1) {
    const row = chargeWork(account, 1);
    if (row !== null) return row;
    const state = work[position];
    if (state === undefined) throw new TypeError("The component work vector is dense");
    if (state.remaining !== 0) continue;
    const entry = chargeResultEntries(account, 1);
    if (entry !== null) return entry;
    pending.push(position);
  }
  const published = new Map<number, number>();
  const components: DependencyComponent[] = [];
  for (let cursor = 0; cursor < pending.length; cursor += 1) {
    const row = chargeWork(account, 1);
    if (row !== null) return row;
    const original = pending[cursor];
    const state = original === undefined ? undefined : work[original];
    if (original === undefined || state === undefined) throw new TypeError("The component schedule selects an actual component");
    const dependencies: number[] = [];
    for (const dependency of state.dependencies) {
      const step = admit(account, 1, 1);
      if (step !== null) return step;
      const earlier = published.get(dependency);
      if (earlier === undefined) throw new TypeError("A component is scheduled only after all its dependencies");
      dependencies.push(earlier);
    }
    const first = state.members[0];
    const operation = first === undefined ? undefined : input.operations[first];
    if (first === undefined || operation === undefined) throw new TypeError("A component selects an actual required operation");
    if (operation.kind === "declared" && (state.members.length !== 1 || dependencies.length !== 0))
      throw new TypeError("A declared operation has one binding schedule, not a body convergence component");
    const growth = chargeResultEntries(account, 2);
    if (growth !== null) return growth;
    published.set(original, components.length);
    components.push(operation.kind === "declared" ? { kind: "declared", operation: first }
      : { kind: "body", members: state.members, rows: state.rows, dependencies });
    for (let position = 0; position < state.dependents.length; position += 1) {
      const step = chargeWork(account, 1);
      if (step !== null) return step;
      const dependent = state.dependents[position];
      const next = dependent === undefined ? undefined : work[dependent];
      if (dependent === undefined || next === undefined) throw new TypeError("The condensation graph retains actual dependents");
      next.remaining -= 1;
      if (next.remaining !== 0) continue;
      const entry = chargeResultEntries(account, 1);
      if (entry !== null) return entry;
      pending.push(dependent);
    }
  }
  if (components.length !== work.length) throw new TypeError("Dataflow components form an acyclic condensation graph");
  const result: DataflowResult<DependencyInventory> = {
    kind: "complete", value: { operations: input.operations, dependencies: input.dependencies, components },
  };
  return result;
};
