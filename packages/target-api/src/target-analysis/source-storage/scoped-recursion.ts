import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import { targetStronglyConnectedComponents } from "../graph-components.js";
import { sourceStorageRegionOwner } from "./lexical-regions.js";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageInvocationInputQuery } from "./invocation-inputs.js";
import type { SourceStorageSubject } from "./subjects.js";
import type { SourceStorageVariable } from "./scoped-model.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import { sourceStorageTransparentInput } from "./scoped-transport.js";

export function createSourceStorageScopedRecursion(source: TargetSourceProgram, budget: SourceStorageBudget,
  transport: SourceStorageScopedTransport, invocationInputs: SourceStorageInvocationInputQuery) {
  const rows = budget.createRows();
  let index: { readonly edges: ReadonlyMap<Node, readonly { readonly invocation: Node; readonly candidate: Node }[]>;
    readonly recursive: ReadonlyMap<Node, ReadonlySet<Node>> } | undefined;
  const ports = new Map<SourceStorageSubject, ReadonlyMap<Node, SourceStorageSubject> | null>();
  let initializing = false;
  const ownerFor = (invocation: Node): Node | undefined => {
    const region = transport.regions.enclosing(invocation);
    return region === undefined ? undefined : sourceStorageRegionOwner(source.ast, region);
  };
  const initialize = () => {
    if (!budget.step()) return undefined;
    if (index !== undefined) return index;
    if (initializing) { budget.reject("Source storage recursion cannot expose an unfinished call graph."); return undefined; }
    const owned = budget.createRows();
    let complete = false;
    initializing = true;
    try {
      const edges = new Map<Node, { readonly invocation: Node; readonly candidate: Node }[]>();
      const vertices = new Set<Node>();
      const recursive = new Map<Node, ReadonlySet<Node>>();
      for (const invocations of [transport.invocations, transport.accessorTargets.keys()]) for (const invocation of invocations) {
        if (!budget.step()) return undefined;
        const owner = ownerFor(invocation);
        if (owner === undefined) continue;
        if (!vertices.has(owner)) { if (!owned.add(1)) return undefined; vertices.add(owner); }
        const targets = edges.get(owner) ?? [];
        if (!edges.has(owner) && !owned.add(1)) return undefined;
        for (const candidate of transport.invocationImplementations(invocation)) {
          if (!budget.step()) return undefined;
          if (!vertices.has(candidate)) { if (!owned.add(1)) return undefined; vertices.add(candidate); }
          if (!owned.add(1)) return undefined;
          targets.push(Object.freeze({ invocation, candidate }));
        }
        edges.set(owner, targets);
      }
      const resolved = budget.withRows(temporary => {
        if (vertices.size !== 0 && !temporary.add(7 * vertices.size)) return false;
        const components = targetStronglyConnectedComponents(vertices, owner => (edges.get(owner) ?? []).map(edge => edge.candidate), budget.step);
        if (components.kind !== "resolved") { budget.reject(components.reason); return false; }
        for (const members of components.components) {
          if (!budget.step()) return false;
          if (members.length === 1 && !(edges.get(members[0]!) ?? []).some(edge => edge.candidate === members[0])) continue;
          if (!owned.add(1 + members.length)) return false;
          const component = new Set(members);
          for (const member of members) { if (!budget.step()) return false; recursive.set(member, component); }
        }
        return true;
      });
      if (!resolved || budget.failure() !== undefined) return undefined;
      index = Object.freeze({ edges, recursive }); complete = true;
      return index;
    } finally { initializing = false; if (!complete) owned.release(); }
  };
  const formalOwner = (subject: SourceStorageSubject): Node | undefined => {
    if (subject.kind === "receiver") return subject.node;
    if (subject.kind !== "input") return undefined;
    const owner = source.ast.parent(subject.node);
    return owner !== undefined && source.ast.parameters(owner).includes(subject.node) ? owner : undefined;
  };
  const invariantPorts = (root: SourceStorageSubject, component: ReadonlySet<Node>): ReadonlyMap<Node, SourceStorageSubject> | undefined => {
    if (ports.has(root)) return ports.get(root) ?? undefined;
    const owned = budget.createRows();
    let complete = false;
    let selected: ReadonlyMap<Node, SourceStorageSubject> | undefined;
    try { selected = budget.withRows(frontier => {
      const bindings = new Map<Node, SourceStorageSubject>();
      const pending: SourceStorageSubject[] = [];
      let maximumFrontier = 0;
      const schedule = (formal: SourceStorageSubject): boolean => {
        const owner = formalOwner(formal);
        if (owner === undefined || !component.has(owner) || formal.projection.length !== 0) return false;
        const retained = bindings.get(owner);
        if (retained !== undefined) return retained === formal;
        if (!owned.add(1)) return false;
        if (pending.length === maximumFrontier) {
          if (!frontier.add(1)) return false;
          maximumFrontier += 1;
        }
        bindings.set(owner, formal); pending.push(formal);
        return true;
      };
      if (!schedule(root)) return undefined;
      while (pending.length !== 0) {
        if (!budget.step()) return undefined;
        const formal = pending.pop()!;
        const owner = formalOwner(formal)!;
        for (const caller of component) for (const edge of index!.edges.get(caller) ?? []) {
          if (!budget.step()) return undefined;
          if (edge.candidate !== owner) continue;
          const inputs = invocationInputs(formal, owner, edge.invocation);
          if (inputs.context !== "caller" || inputs.subjects.size !== 1) return undefined;
          const input = budget.withRows(temporary => {
            let input = inputs.subjects.values().next().value!;
            const visited = new Set<SourceStorageSubject>();
            while (input.kind === "value") {
              if (!budget.step() || visited.has(input) || !temporary.add(1)) return undefined;
              visited.add(input);
              const original = sourceStorageTransparentInput(input, source.ast, transport);
              if (original === undefined) return undefined;
              input = original;
            }
            return input;
          });
          if (input === undefined) return undefined;
          if (formalOwner(input) !== caller || !schedule(input)) return undefined;
        }
      }
      if (!owned.add(1)) return undefined;
      complete = true;
      return bindings;
    }); } finally { if (!complete) owned.release(); }
    if (budget.failure() !== undefined) return undefined;
    if (selected === undefined && !rows.add(1)) return undefined;
    ports.set(root, selected ?? null);
    return selected;
  };
  const entryInputFor = (origin: SourceStorageSubject, variable: SourceStorageVariable): SourceStorageSubject | undefined => {
    if (variable.capture !== undefined) return undefined;
    if (initialize() === undefined) return undefined;
    if (!budget.step()) return undefined;
    const root = transport.subject(origin.node, origin.kind);
    if (root === undefined || formalOwner(root) !== variable.owner) return undefined;
    const selected = invariantPorts(root, variable.equation.component)?.get(variable.equation.entry);
    return selected === undefined ? undefined : transport.subject(selected.node, selected.kind, origin.projection);
  };
  return Object.freeze({ ownerFor, entryInputFor,
    componentFor: (candidate: Node): ReadonlySet<Node> | undefined => initialize()?.recursive.get(candidate),
    edgesFor: (caller: Node) => initialize()?.edges.get(caller) ?? [] });
}

export type SourceStorageScopedRecursion = ReturnType<typeof createSourceStorageScopedRecursion>;
