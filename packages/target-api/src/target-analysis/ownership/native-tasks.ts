import type { Node, SourceFile } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import type { SourceStorageQueries } from "../source-storage/model/types.js";
import type { SourceOwnershipBudget } from "./model.js";
import { sourceStorageAccessDeclarations } from "../source-storage/model/components.js";
import { sourceStorageRegionOwner } from "../source-storage/graph/lexical-regions.js";

export interface SourceNativeTaskSpawn {
  readonly node: Node;
  readonly operand: Node;
  readonly owner: Node;
}

export interface SourceNativeTaskGraph {
  readonly lifecycleOwner: SourceFile | undefined;
  readonly spawns: readonly SourceNativeTaskSpawn[];
  readonly owners: readonly Node[];
  readonly parameterOwners: ReadonlySet<Node>;
  readonly calls: readonly { readonly node: Node; readonly owner: Node; readonly targets: readonly Node[] }[];
  readonly entries: readonly Node[];
}

export interface SourceNativeTaskOwnerUse {
  readonly capture: boolean;
  readonly parameter: boolean;
}

export interface SourceNativeTaskIssue {
  readonly kind: "lifecycle-owner" | "scope-owner" | "call-graph" | "public-scope";
  readonly node: Node;
  readonly reason: string;
}

export function analyzeSourceNativeTaskGraph(input: {
  readonly source: TargetSourceProgram;
  readonly storage: SourceStorageQueries;
  readonly nodes: readonly Node[];
  readonly spawns: readonly { readonly node: Node; readonly operand: Node }[];
  readonly lifecycleOwner: SourceFile | undefined;
  readonly ownerUses: ReadonlyMap<Node, SourceNativeTaskOwnerUse>;
  readonly callInputs: ReadonlyMap<Node, "parameter" | "capture" | "none">;
  readonly publishedDeclarations: ReadonlySet<Node>;
  readonly budget: SourceOwnershipBudget;
}): { readonly kind: "resolved"; readonly graph: SourceNativeTaskGraph }
  | { readonly kind: "unresolved"; readonly issues: readonly SourceNativeTaskIssue[] } {
  const { source, storage, budget } = input;
  if (source !== storage.source) throw new Error("Native task propagation and storage require the identical checked source program.");
  const { ast, semantics } = source;
  const rows = budget.createRows();
  let published = false;
  const issues: SourceNativeTaskIssue[] = [];
  const reject = (node: Node, kind: SourceNativeTaskIssue["kind"], reason: string): void => {
    if (rows.add(1)) issues.push(Object.freeze({ kind, node, reason }));
  };
  const ownerFor = (node: Node): Node | undefined => {
    const visited = new Set<Node>();
    const region = storage.enclosingRegionFor(node);
    if (region === undefined) return undefined;
    for (let current: Node | undefined = node; current !== undefined && current !== region; current = ast.parent(current)) {
      if (!budget.step() || visited.has(current)) return undefined;
      visited.add(current);
      if (ast.is.IsClassStaticBlockDeclaration(current)) return current;
    }
    return ast.is.IsSourceFile(region) ? region : sourceStorageRegionOwner(ast, region);
  };
  try {
    const spawns: SourceNativeTaskSpawn[] = [];
    for (const spawn of input.spawns) {
      if (!budget.step()) break;
      const owner = ownerFor(spawn.operand);
      if (owner === undefined) reject(spawn.node, "scope-owner", "An admitted native task requires its original checked execution owner.");
      else if (rows.add(1)) spawns.push(Object.freeze({ ...spawn, owner }));
    }
    if (input.spawns.length !== 0 && input.lifecycleOwner === undefined)
      reject(input.spawns[0]!.node, "lifecycle-owner", "Native task scope requires its actual root lifecycle source identity.");
    const edges: { readonly node: Node; readonly owner: Node; readonly targets: readonly Node[]; readonly exact: boolean }[] = [];
    const openEdges = new Map<Node, { readonly node: Node; readonly reason: string }[]>();
    const accessorInvocations = new Set(storage.accessorInvocations);
    const contracts = new Map<Node, readonly Node[]>();
    const implementations = new Map<Node, Node[]>();
    if (spawns.length !== 0) for (const node of input.nodes) {
      if (!budget.step()) break;
      const parent = ast.parent(node);
      if (parent !== undefined && (ast.is.IsClassDeclaration(parent) || ast.is.IsClassExpression(parent) || ast.is.IsInterfaceDeclaration(parent)) &&
        (ast.is.IsMethodDeclaration(node) || ast.is.IsMethodSignatureDeclaration(node) ||
          ast.is.IsGetAccessorDeclaration(node) || ast.is.IsSetAccessorDeclaration(node))) {
        const selected = source.navigation.memberContracts(node);
        if (selected.kind === "resolved" && rows.add(1 + selected.contracts.length)) {
          contracts.set(node, selected.contracts);
          for (const contract of selected.contracts) {
            const members = implementations.get(contract);
            if (!rows.add(members === undefined ? 2 : 1)) break;
            if (members === undefined) implementations.set(contract, [node]);
            else members.push(node);
          }
        }
      }
      const accessor = accessorInvocations.has(node);
      if (!ast.is.IsCallExpression(node) && !ast.is.IsNewExpression(node) && !accessor) continue;
      const selected = semantics.forNode(node);
      const call = selected.operations.call(node);
      const declaration = call === undefined ? undefined : selected.declarations.signatureDeclaration(call.selectedSignature) ??
        (ast.is.IsNewExpression(node) ? call.sourceCallee.selectedDeclaration : undefined);
      const file = declaration === undefined ? undefined : ast.getSourceFile(declaration);
      if (!accessor && (declaration === undefined || file === undefined || ast.isDeclarationFile(file) || !semantics.includes(file))) continue;
      const owner = ownerFor(node);
      if (owner === undefined) { reject(node, "scope-owner", "A native task invocation has no checked caller owner."); continue; }
      const bindings = ast.is.IsSourceFile(owner) ? { kind: "resolved" as const, bindings: storage.emptyBindings }
        : storage.bindingsForLexicalOwner(owner);
      const targets = bindings.kind === "unresolved" ? bindings : storage.invocationImplementationsFor(node, bindings.bindings);
      if (targets.kind === "unresolved") {
        const declarations = accessor ? [...sourceStorageAccessDeclarations(source, node, "read") ?? [],
          ...sourceStorageAccessDeclarations(source, node, "write") ?? []] : declaration === undefined ? [] : [declaration];
        if (declarations.length === 0) reject(node, "call-graph", targets.reason);
        for (const target of new Set(declarations)) {
          if (!budget.step()) break;
          const previous = openEdges.get(target);
          if (!rows.add(previous === undefined ? 2 : 1)) break;
          const entry = Object.freeze({ node, reason: targets.reason });
          if (previous === undefined) openEdges.set(target, [entry]);
          else previous.push(entry);
        }
        continue;
      }
      if (rows.add(1 + targets.nodes.length)) edges.push(Object.freeze({ node, owner, targets: targets.nodes, exact: targets.exact }));
    }
    const incoming = new Map<Node, typeof edges>();
    for (const edge of edges) for (const target of edge.targets) {
      if (!budget.step()) break;
      const previous = incoming.get(target);
      if (!rows.add(previous === undefined ? 2 : 1)) break;
      if (previous === undefined) incoming.set(target, [edge]);
      else previous.push(edge);
    }
    const needed = new Set<Node>();
    const queue: Node[] = [];
    const calls = new Map<Node, SourceNativeTaskGraph["calls"][number]>();
    const requireOwner = (owner: Node): void => {
      if (needed.has(owner) || !rows.add(2)) return;
      needed.add(owner); queue.push(owner);
    };
    for (const spawn of spawns) requireOwner(spawn.owner);
    for (let index = 0; index < queue.length; index += 1) {
      if (!budget.step()) break;
      const owner = queue[index]!;
      if (ast.is.IsSourceFile(owner)) continue;
      if (ast.is.IsClassDeclaration(owner) || ast.is.IsClassExpression(owner) ||
          ast.is.IsConstructorDeclaration(owner) || ast.is.IsClassStaticBlockDeclaration(owner)) {
        reject(owner, "scope-owner", "Native explicit void spawn is unsupported in a constructor or initializer.");
        continue;
      }
      if (semantics.forNode(owner).operations.generator(owner) !== undefined) {
        reject(owner, "scope-owner", "Native explicit void spawn is unsupported in a generator activation.");
        continue;
      }
      const use = input.ownerUses.get(owner);
      if (use?.capture === true) {
        reject(owner, "scope-owner", "Native explicit void spawn is unsupported in a retained callable capture.");
        continue;
      }
      if (use === undefined || !use.parameter) {
        reject(owner, "scope-owner", "A demanded native task owner requires its checked direct helper parameter contract."); continue;
      }
      const authored = ast.parent(owner);
      if (input.publishedDeclarations.has(owner) || authored !== undefined && input.publishedDeclarations.has(authored))
        reject(owner, "public-scope", "A public package function requiring native task scope cannot expose an implicit executor parameter in its source ABI.");
      for (const member of [...contracts.get(owner) ?? [], ...implementations.get(owner) ?? []]) {
        if (!budget.step()) break;
        requireOwner(member);
      }
      for (const edge of openEdges.get(owner) ?? []) reject(edge.node, "call-graph", edge.reason);
      for (const edge of incoming.get(owner) ?? []) {
        if (!budget.step()) break;
        const mode = input.callInputs.get(edge.node);
        if (!edge.exact || mode !== "parameter" || edge.targets.some(target => {
          const selected = input.ownerUses.get(target);
          return selected === undefined || !selected.parameter || selected.capture;
        })) {
          reject(edge.node, "call-graph", "A native task invocation requires one exact scope ownership contract for every callable alternative.");
          continue;
        }
        for (const target of edge.targets) requireOwner(target);
        if (!calls.has(edge.node) && !rows.add(1)) break;
        calls.set(edge.node, Object.freeze({ node: edge.node, owner: edge.owner, targets: edge.targets }));
        requireOwner(edge.owner);
      }
    }
    const failure = budget.failure();
    if (failure !== undefined) {
      const node = input.spawns[0]?.node ?? source.sourceFiles[0];
      if (node !== undefined) issues.push(Object.freeze({ kind: "call-graph", node, reason: failure }));
    }
    if (issues.length !== 0 || failure !== undefined)
      return Object.freeze({ kind: "unresolved", issues: Object.freeze(issues) });
    const owners = [...needed].filter(owner => !ast.is.IsSourceFile(owner));
    const graph: SourceNativeTaskGraph = Object.freeze({ lifecycleOwner: spawns.length === 0 ? undefined : input.lifecycleOwner,
      spawns: Object.freeze(spawns), owners: Object.freeze(owners),
      parameterOwners: new Set(owners.filter(owner => input.ownerUses.get(owner)?.parameter === true)),
      calls: Object.freeze([...calls.values()]), entries: Object.freeze([...needed].filter(owner => ast.is.IsSourceFile(owner))) });
    published = true;
    return Object.freeze({ kind: "resolved", graph });
  } finally { if (!published) rows.release(); }
}
