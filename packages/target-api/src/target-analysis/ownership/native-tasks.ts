import type { Node, SourceFile } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import { createTargetGraphComponentQuery } from "../graph-component-query.js";
import type { SourceDeclarationOwnershipBudget, SourceDeclarationOwnershipContract,
  SourceDeclarationOwnershipUnresolved, SourceDeclarationOwnershipValues } from "./model.js";
import { sourceDeclarationOwnershipUnresolved } from "./contracts.js";
import { isSourceCallableBodyBoundary } from "../../source-navigation/index.js";

export interface SourceNativeTaskSpawn {
  readonly node: Node;
  readonly operand: Node;
  readonly owner: Node;
}

export function analyzeSourceDeclarationNativeTaskGraph(input: {
  readonly source: TargetSourceProgram;
  readonly values: SourceDeclarationOwnershipValues;
  readonly nodes: readonly Node[];
  readonly spawns: readonly { readonly node: Node; readonly operand: Node }[];
  readonly lifecycleOwner: SourceFile | undefined;
  readonly publishedDeclarations: ReadonlySet<Node>;
  readonly scopeFor: (declaration: Node) => SourceDeclarationOwnershipUnresolved | {
    readonly kind: "parameter" | "capture" | "none";
    readonly contract: SourceDeclarationOwnershipContract;
  };
  readonly budget: SourceDeclarationOwnershipBudget;
}): { readonly kind: "resolved"; readonly graph: SourceNativeTaskGraph }
  | { readonly kind: "unresolved"; readonly issues: readonly SourceNativeTaskIssue[] }
  | SourceDeclarationOwnershipUnresolved {
  const { source, values, budget } = input;
  if (input.spawns.length === 0) return Object.freeze({ kind: "resolved", graph: Object.freeze({
    lifecycleOwner: undefined, spawns: Object.freeze([]), owners: Object.freeze([]), parameterOwners: new Set<Node>(),
    calls: Object.freeze([]), entries: Object.freeze([]) }) });
  const subject = input.spawns[0]!.node;
  const rows = budget.createRows(subject);
  const byOwner = new Map<Node, SourceNativeTaskGraph["calls"][number][]>();
  const spawns: SourceNativeTaskSpawn[] = [];
  const spawnedOwners = new Set<Node>();
  const owners = new Set<Node>();
  const issues: SourceNativeTaskIssue[] = [];
  const scopes = new Map<Node, "parameter" | "capture" | "none">();
  let published = false;
  let failure: SourceDeclarationOwnershipUnresolved | undefined;
  const reject = (node: Node, kind: SourceNativeTaskIssue["kind"], reason: string): void => {
    if (rows.add(1)) issues.push(Object.freeze({ node, kind, reason }));
  };
  const generator = (declaration: Node): boolean =>
    (source.ast.is.IsFunctionDeclaration(declaration) || source.ast.is.IsFunctionExpression(declaration) ||
      source.ast.is.IsMethodDeclaration(declaration)) && source.ast.children(declaration).some(child =>
        child !== undefined && source.ast.kindName(child) === "KindAsteriskToken");
  const unsupportedOwner = (node: Node): Node | undefined => {
    const visited = new Set<Node>();
    for (let current: Node | undefined = node; current !== undefined; current = source.ast.parent(current)) {
      if (!budget.step(node)) { failure = budget.failure(); return undefined; }
      if (visited.has(current)) {
        failure = sourceDeclarationOwnershipUnresolved(node, "A native task operation requires acyclic checked declaration ancestry.");
        return undefined;
      }
      visited.add(current);
      if (source.ast.is.IsClassStaticBlockDeclaration(current)) return current;
      if (isSourceCallableBodyBoundary(source.ast, current))
        return generator(current) ? current : undefined;
      if (source.ast.is.IsSourceFile(current)) return undefined;
    }
    return undefined;
  };
  const scopeFor = (declaration: Node): "parameter" | "capture" | "none" | undefined => {
    if (!budget.step(declaration)) { failure = budget.failure(); return undefined; }
    const existing = scopes.get(declaration);
    if (existing !== undefined) return existing;
    if (source.ast.is.IsSourceFile(declaration)) return "none";
    const selected = input.scopeFor(declaration);
    if (selected.kind === "unresolved") { failure = selected; return undefined; }
    if (selected.contract.kind !== "declaration" || selected.contract.declaration !== declaration) {
      failure = sourceDeclarationOwnershipUnresolved(declaration,
        "A native scope requirement must be published by this exact selected declaration.");
      return undefined;
    }
    const file = source.ast.getSourceFile(declaration);
    if (file === undefined) {
      failure = sourceDeclarationOwnershipUnresolved(declaration, "A native task declaration must belong to the checked program.");
      return undefined;
    }
    const semantics = source.semantics.forNode(declaration);
    const component = semantics.types.declarationSignatureInfo(declaration)?.returnType ??
      semantics.declarations.declaredValueType(declaration);
    if (component === undefined || !semantics.types.isIdentical(component, selected.contract.component.selectedType)) {
      failure = sourceDeclarationOwnershipUnresolved(declaration,
        "A native task scope needs its exact selected declaration component, not an unrelated checked type.");
      return undefined;
    }
    if (!rows.add(1)) { failure = budget.failure(); return undefined; }
    scopes.set(declaration, selected.kind);
    return selected.kind;
  };
  try {
    if (input.lifecycleOwner === undefined || !source.sourceFiles.includes(input.lifecycleOwner))
      reject(subject, "lifecycle-owner", "Native task scope requires its actual root lifecycle source identity.");
    for (const spawn of input.spawns) {
      if (!budget.step(spawn.node)) return budget.failure()!;
      const unsupported = unsupportedOwner(spawn.operand);
      if (failure !== undefined) return failure;
      const region = unsupported === undefined ? values.regionFor(spawn.operand) : undefined;
      if (region !== undefined && "kind" in region) return region;
      const owner = unsupported ?? region!.owner;
      if (!rows.add(3)) return budget.failure()!;
      spawns.push(Object.freeze({ ...spawn, owner }));
      spawnedOwners.add(owner);
      owners.add(owner);
      if (unsupported !== undefined)
        reject(unsupported, "scope-owner", "Native explicit void spawn is unsupported in this selected constructor, initializer or generator.");
    }
    if (issues.some(issue => issue.kind === "scope-owner"))
      return budget.failure() ?? Object.freeze({ kind: "unresolved", issues: Object.freeze(issues) });
    for (const node of input.nodes) {
      if (!budget.step(node)) return budget.failure()!;
      const semantics = source.semantics.forNode(node);
      const targets: Node[] = [];
      if (source.ast.is.IsCallExpression(node) || source.ast.is.IsNewExpression(node)) {
        const call = semantics.operations.call(node);
        const declaration = call?.sourceSelectedSignatureKind === "resolved"
          ? semantics.declarations.signatureDeclaration(call.selectedSignature) : undefined;
        if (declaration !== undefined) targets.push(declaration);
      } else if (source.ast.is.IsPropertyAccessExpression(node)) {
        const access = semantics.operations.propertyAccess(node);
        if (access?.accessMode !== "write" && access?.selectedReadDeclaration !== undefined && source.ast.is.IsGetAccessorDeclaration(access.selectedReadDeclaration))
          targets.push(access.selectedReadDeclaration);
        if (access?.accessMode !== "read" && access?.selectedWriteDeclaration !== undefined && source.ast.is.IsSetAccessorDeclaration(access.selectedWriteDeclaration))
          targets.push(access.selectedWriteDeclaration);
      }
      if (targets.length === 0) continue;
      const unsupported = unsupportedOwner(node);
      if (failure !== undefined) return failure;
      const region = unsupported === undefined ? values.regionFor(node) : undefined;
      if (region !== undefined && "kind" in region) return region;
      const owner = unsupported ?? region!.owner;
      const previous = byOwner.get(owner);
      if (!rows.add(3 + targets.length)) return budget.failure()!;
      const edge = Object.freeze({ node, owner, targets: Object.freeze(targets) });
      if (previous === undefined) byOwner.set(owner, [edge]); else previous.push(edge);
      owners.add(owner);
      for (const target of targets) owners.add(target);
    }
    const required = createTargetGraphComponentQuery<Node, boolean, boolean>(declaration => {
      if (!budget.step(declaration)) { failure = budget.failure(); return undefined; }
      const declaredScope = source.ast.body(declaration) === undefined && !source.ast.is.IsSourceFile(declaration) &&
        !source.ast.is.IsClassDeclaration(declaration) && !source.ast.is.IsClassExpression(declaration) &&
        !source.ast.is.IsClassStaticBlockDeclaration(declaration) ? scopeFor(declaration) : undefined;
      if (failure !== undefined) return undefined;
      const neighbours = new Set<Node>();
      for (const edge of byOwner.get(declaration) ?? []) {
        for (const target of edge.targets) {
          if (!budget.step(edge.node) || !rows.add(1)) { failure = budget.failure(); return undefined; }
          neighbours.add(target);
        }
      }
      return { data: spawnedOwners.has(declaration) || declaredScope !== undefined && declaredScope !== "none", neighbours };
    }, members => members.some(member => member.data || member.successors.some(Boolean)), {
      step: () => budget.step(subject), createRows: () => budget.createRows(subject),
    });
    const needed = new Set<Node>();
    const calls: SourceNativeTaskGraph["calls"][number][] = [];
    for (const declaration of owners) {
      if (!budget.step(declaration)) return budget.failure()!;
      const selected = required(declaration);
      if (selected === undefined) return failure ?? budget.failure() ??
        sourceDeclarationOwnershipUnresolved(declaration, "The native task declaration graph has no completed scope contract.");
      if (!selected) continue;
      needed.add(declaration);
      if (source.ast.is.IsSourceFile(declaration)) continue;
      if (source.ast.is.IsConstructorDeclaration(declaration) || source.ast.is.IsClassDeclaration(declaration) ||
        source.ast.is.IsClassExpression(declaration) || source.ast.is.IsClassStaticBlockDeclaration(declaration) ||
        generator(declaration)) {
        reject(declaration, "scope-owner", "Native explicit void spawn is unsupported in this selected constructor, initializer or generator.");
        continue;
      }
      const scope = scopeFor(declaration);
      if (scope === undefined) return failure ?? budget.failure()!;
      if (scope !== "parameter") reject(declaration, "scope-owner",
        "A demanded native task declaration requires its exact declared scope input, not a captured or invented parameter.");
      const container = source.ast.parent(declaration);
      if (input.publishedDeclarations.has(declaration) || container !== undefined && input.publishedDeclarations.has(container))
        reject(declaration, "public-scope",
        "A public native signature cannot acquire an implicit executor input from its callers.");
    }
    for (const edges of byOwner.values()) for (const edge of edges) {
      if (!budget.step(edge.node)) return budget.failure()!;
      if (!edge.targets.some(target => needed.has(target))) continue;
      if (!rows.add(1)) return budget.failure()!;
      calls.push(edge);
    }
    const unresolved = failure ?? budget.failure();
    if (unresolved !== undefined) return unresolved;
    if (issues.length !== 0) return Object.freeze({ kind: "unresolved", issues: Object.freeze(issues) });
    const declarations = [...needed].filter(owner => !source.ast.is.IsSourceFile(owner));
    published = true;
    return Object.freeze({ kind: "resolved", graph: Object.freeze({ lifecycleOwner: input.lifecycleOwner,
      spawns: Object.freeze(spawns), owners: Object.freeze(declarations), parameterOwners: new Set(declarations),
      calls: Object.freeze(calls), entries: Object.freeze([...needed].filter(owner => source.ast.is.IsSourceFile(owner))) }) });
  } finally { if (!published) rows.release(); }
}

export interface SourceNativeTaskGraph {
  readonly lifecycleOwner: SourceFile | undefined;
  readonly spawns: readonly SourceNativeTaskSpawn[];
  readonly owners: readonly Node[];
  readonly parameterOwners: ReadonlySet<Node>;
  readonly calls: readonly { readonly node: Node; readonly owner: Node; readonly targets: readonly Node[] }[];
  readonly entries: readonly Node[];
}

export interface SourceNativeTaskIssue {
  readonly kind: "lifecycle-owner" | "scope-owner" | "call-graph" | "public-scope";
  readonly node: Node;
  readonly reason: string;
}
