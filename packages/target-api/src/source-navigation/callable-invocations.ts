import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceNodeUseSummary, SourceNodeNavigationFacts } from "../source-model/navigation.js";
import { Node_Initializer } from "./ast.js";

const repeatedKinds: ReadonlySet<string> = new Set([
  "KindForStatement", "KindForInStatement", "KindForOfStatement", "KindWhileStatement", "KindDoStatement",
]);

export type SourceSubtreeParticipation =
  | { readonly kind: "resolved"; readonly nodes: readonly Node[] }
  | { readonly kind: "unresolved"; readonly reason: string };

type SourceLexicalFunctionNavigation = Pick<SourceNodeNavigationFacts, "declarationUseSummary" | "referencesToDeclaration" |
  "sourceReferenceFor" | "callableImplementation" | "includes" | "enclosing" | "callableRoles">;

export interface SourceCallableInvocationReference {
  readonly referenceDeclaration: Node | undefined;
  readonly directDeclaration: boolean;
  readonly directModule: boolean;
  readonly directLexical: boolean;
  readonly callAlias: boolean;
  readonly nativeFunction: boolean;
}

export function createSourceCallableInvocationReferenceQuery(input: {
  readonly ast: AstReader;
  readonly navigation: Pick<SourceNodeNavigationFacts, "sourceReferenceFor" | "callableImplementation" | "includes">;
  readonly nativeCallableFor: (binding: Node) => Node | undefined;
  readonly lexicalBindingFor: (declaration: Node) => Node | undefined;
  readonly callAliasFor: (binding: Node) => Node | undefined;
}): { forTarget(callee: Node, declaration: Node): SourceCallableInvocationReference } {
  const selected = new Map<Node, Map<Node, SourceCallableInvocationReference>>();
  return Object.freeze({
    forTarget(callee: Node, declaration: Node): SourceCallableInvocationReference {
      if (!input.navigation.includes(callee) || !input.navigation.includes(declaration))
        throw new Error("Callable references require exact original nodes from the same Source view.");
      const existing = selected.get(callee)?.get(declaration);
      if (existing !== undefined) return existing;
      const referenceDeclaration = input.navigation.sourceReferenceFor(callee)?.declaration;
      const implementation = referenceDeclaration === undefined ? undefined
        : input.navigation.callableImplementation(referenceDeclaration);
      const directModule = referenceDeclaration !== undefined && input.nativeCallableFor(referenceDeclaration) === declaration;
      const directDeclaration = referenceDeclaration === declaration || implementation?.kind === "resolved" &&
        implementation.implementation.declaration === declaration;
      const lexicalBinding = input.lexicalBindingFor(declaration);
      const directLexical = lexicalBinding !== undefined && lexicalBinding === referenceDeclaration;
      const callAlias = referenceDeclaration !== undefined && input.callAliasFor(referenceDeclaration) === declaration;
      const result: SourceCallableInvocationReference = Object.freeze({ referenceDeclaration, directDeclaration,
        directModule, directLexical, callAlias, nativeFunction: directModule || directLexical || callAlias ||
          input.ast.is.IsFunctionDeclaration(declaration) && referenceDeclaration === declaration });
      const targets = selected.get(callee) ?? new Map<Node, SourceCallableInvocationReference>();
      targets.set(declaration, result);
      selected.set(callee, targets);
      return result;
    },
  });
}

function lexicalFunctionUseSummaries(declaration: Node, ast: AstReader,
  navigation: SourceLexicalFunctionNavigation): readonly SourceNodeUseSummary[] | undefined {
  const sourceFile = ast.getSourceFile(declaration);
  if (sourceFile === undefined) return undefined;
  if (ast.is.IsArrowFunction(declaration)) {
    const binding = ast.parent(declaration);
    if (binding === undefined || !ast.is.IsVariableDeclaration(binding) ||
      ast.variableDeclarationKind(binding) !== "const" || Node_Initializer(ast, binding) !== declaration ||
      !ast.is.IsIdentifier(ast.name(binding))) return undefined;
    const implementation = navigation.callableImplementation(declaration);
    if (implementation.kind !== "resolved" ||
      implementation.implementation.declaration !== declaration || implementation.implementation.sourceFile !== sourceFile)
      return undefined;
    for (const reference of navigation.referencesToDeclaration(binding)) {
      const selected = navigation.sourceReferenceFor(reference);
      if (selected === undefined || selected.declaration !== binding || selected.sourceFile !== sourceFile) return undefined;
    }
    return Object.freeze([navigation.declarationUseSummary(binding)]);
  }
  const implementation = navigation.callableImplementation(declaration);
  if (implementation.kind !== "resolved")
    return undefined;
  const declarations = new Set([declaration, implementation.implementation.declaration]);
  const owner = ast.parent(declaration);
  if (owner !== undefined) ast.forEachChild(owner, candidate => {
    if (candidate === undefined || !ast.is.IsFunctionDeclaration(candidate)) return;
    const selected = navigation.callableImplementation(candidate);
    if (selected.kind === "resolved" && selected.implementation.declaration === implementation.implementation.declaration &&
        selected.implementation.sourceFile === sourceFile) declarations.add(candidate);
  });
  for (const reference of [...declarations].flatMap(original => navigation.referencesToDeclaration(original))) {
    const selected = navigation.sourceReferenceFor(reference);
    if (selected === undefined) return undefined;
    const candidate = navigation.callableImplementation(selected.declaration);
    if (candidate.kind !== "resolved" ||
      candidate.implementation.declaration !== implementation.implementation.declaration) return undefined;
    declarations.add(selected.declaration);
  }
  return Object.freeze([...declarations].map(selected => navigation.declarationUseSummary(selected)));
}

export function sourceNodesOutsideErasedSubtrees(
  ast: Pick<AstReader, "parent">,
  nodes: readonly Node[],
  isErased: (node: Node) => boolean,
): SourceSubtreeParticipation {
  const domain = new Set(nodes);
  if (domain.size !== nodes.length) return Object.freeze({ kind: "unresolved",
    reason: "Source participation requires one occurrence of each checked source node." });
  const parents = new Map<Node, Node | undefined>();
  for (const node of nodes) {
    const parent = ast.parent(node);
    if (parent !== undefined && !domain.has(parent)) return Object.freeze({ kind: "unresolved",
      reason: "Source participation requires every checked parent in its finite source domain." });
    parents.set(node, parent);
  }
  const ordered: Node[] = [];
  const completed = new Set<Node>();
  for (const node of nodes) {
    const path: Node[] = [];
    const visiting = new Set<Node>();
    for (let current: Node | undefined = node; current !== undefined && !completed.has(current); current = parents.get(current)) {
      if (visiting.has(current)) return Object.freeze({ kind: "unresolved",
        reason: "Source participation requires acyclic checked parent correspondence." });
      visiting.add(current);
      path.push(current);
    }
    while (path.length !== 0) {
      const current = path.pop()!;
      completed.add(current);
      ordered.push(current);
    }
  }
  const selected = new Map<Node, boolean>();
  for (const node of ordered) {
    const parent = parents.get(node);
    selected.set(node, (parent === undefined || selected.get(parent) === true) && !isErased(node));
  }
  return Object.freeze({ kind: "resolved", nodes: Object.freeze(nodes.filter(node => selected.get(node) === true)) });
}

export function sourceLexicalFunctionIsUnused(
  declaration: Node,
  ast: AstReader,
  navigation: SourceLexicalFunctionNavigation,
): boolean {
  if (!ast.is.IsFunctionDeclaration(declaration) ||
    navigation.enclosing(declaration, "deferred") === undefined) return false;
  const summaries = lexicalFunctionUseSummaries(declaration, ast, navigation);
  return summaries !== undefined && summaries.every(summary => !summary.exported && !summary.bindingWritten &&
    !summary.hasUnclassifiedValueUse && summary.uses.every(use => use.kind === "type-only"));
}

export function createSourceSingleInvocationQuery(
  ast: AstReader,
  navigation: SourceLexicalFunctionNavigation,
): (declaration: Node) => boolean {
  const memo = new WeakMap<Node, boolean>();
  return declaration => select(declaration, new Set());

  function select(declaration: Node, active: Set<Node>): boolean {
    if (!navigation.includes(declaration)) throw new Error("A callable-use query requires its exact original Source declaration.");
    const previous = memo.get(declaration);
    if (previous !== undefined) return previous;
    if (active.has(declaration) || active.size >= 128 ||
      !ast.is.IsFunctionDeclaration(declaration) && !ast.is.IsArrowFunction(declaration)) return false;
    active.add(declaration);
    const result = classify(declaration, active);
    active.delete(declaration);
    memo.set(declaration, result);
    return result;
  }

  function classify(declaration: Node, active: Set<Node>): boolean {
    const owner = navigation.enclosing(declaration, "deferred");
    if (owner === undefined) return false;
    const summaries = lexicalFunctionUseSummaries(declaration, ast, navigation);
    if (summaries === undefined || summaries.some(summary => summary.exported || summary.bindingWritten || summary.hasUnclassifiedValueUse))
      return false;
    const uses = [...new Set(summaries.flatMap(summary => summary.uses))]
      .filter(use => use.kind !== "type-only" && use.kind !== "source-linkage");
    if (uses.length !== 1 || uses[0]!.kind !== "direct-call" || uses[0]!.role !== "call-target" || uses[0]!.throughMember) return false;
    const visited = new Set<Node>();
    for (let current = ast.parent(uses[0]!.reference); current !== undefined; current = ast.parent(current)) {
      if (visited.has(current) || visited.size >= 128) return false;
      visited.add(current);
      if (current === owner) return true;
      const kind = ast.kindName(current);
      if (repeatedKinds.has(kind)) return false;
      if (navigation.callableRoles(current).body) return (ast.is.IsFunctionDeclaration(current) || ast.is.IsArrowFunction(current)) &&
        navigation.enclosing(current, "deferred") === owner && select(current, active);
    }
    return false;
  }
}
