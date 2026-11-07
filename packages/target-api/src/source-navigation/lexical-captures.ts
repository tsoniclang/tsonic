import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "./types.js";
import { isTypeSyntaxNode } from "./syntax.js";
import { sourceNodeHasRole } from "./callable-boundaries.js";
import { sourceReceiverOwner } from "./receiver-owner.js";

export interface SourceLexicalCapture {
  readonly declaration: Node;
  readonly references: readonly Node[];
}

export interface SourceLexicalCaptureSelection {
  readonly captures: readonly SourceLexicalCapture[];
  readonly selfReferences: readonly Node[];
  readonly receivers: readonly { readonly owner: Node; readonly references: readonly Node[] }[];
}

export type SourceNodeDomain = "source" | { readonly has: (node: Node) => boolean };

export function sourceLexicalCaptures(
  scope: Node,
  roots: readonly Node[],
  ast: AstReader,
  navigation: Pick<SourceProgramNavigation, "sourceReferenceFor">,
  domain: SourceNodeDomain,
  step: (node?: Node) => void = () => {},
): SourceLexicalCaptureSelection {
  if (domain !== "source" && (domain === null || typeof domain !== "object" || typeof domain.has !== "function")) {
    throw new Error("Lexical captures require an explicit source-node domain.");
  }
  const includes = (node: Node): boolean => domain === "source" || domain.has(node);
  if (!includes(scope)) throw new Error("A lexical-capture scope must belong to its explicit source-node domain.");
  const captures = new Map<Node, Node[]>();
  const selfReferences: Node[] = [];
  const receivers = new Map<Node, Node[]>();
  const visited = new Set<Node>();
  const visit = (node: Node): void => {
    if (!includes(node)) return;
    step(node);
    if (visited.has(node) || isTypeSyntaxNode(ast, node)) return;
    visited.add(node);
    const nodeKind = ast.kindName(node);
    if (nodeKind === "KindThisKeyword" || nodeKind === "KindSuperKeyword") {
      step(node);
      const owner = sourceReceiverOwner(node, ast, "lexical-capture", () => { step(node); return true; });
      if (owner !== undefined && !within(owner, scope, ast, step)) {
        const references = receivers.get(owner) ?? [];
        references.push(node);
        receivers.set(owner, references);
      }
    }
    if (ast.is.IsIdentifier(node)) {
      const parent = ast.parent(node);
      if (parent !== undefined && ast.is.IsPropertyAccessExpression(parent) && ast.name(parent) === node) return;
      const selected = navigation.sourceReferenceFor(node);
      if (selected?.project === true) {
        const declaration = selected.declaration;
        const kind = ast.kindName(declaration);
        const binding = ["KindParameter", "KindVariableDeclaration", "KindBindingElement", "KindFunctionDeclaration",
          "KindFunctionExpression", "KindClassDeclaration", "KindClassExpression", "KindEnumDeclaration"].includes(kind);
        if (!binding || ast.name(declaration) === node) return;
        if (declaration === scope) selfReferences.push(node);
        else if (!within(declaration, scope, ast, step) && !sourceDeclarationIsModuleScoped(declaration, ast, step)) {
          const references = captures.get(declaration) ?? [];
          references.push(node);
          captures.set(declaration, references);
        }
      }
    }
    ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  for (const root of roots) {
    if (!includes(root)) throw new Error("A lexical-capture root must belong to its explicit source-node domain.");
    if (!within(root, scope, ast, step)) throw new Error("A lexical-capture root must belong to its exact source scope.");
    visit(root);
  }
  return Object.freeze({
    captures: Object.freeze([...captures].map(([declaration, references]) => Object.freeze({
      declaration, references: Object.freeze(references),
    }))),
    selfReferences: Object.freeze(selfReferences),
    receivers: Object.freeze([...receivers].map(([owner, references]) => Object.freeze({
      owner, references: Object.freeze(references),
    }))),
  });
}

/** The owners a lexical capture selection is published for: callables that own a body, and classes. */
const lexicalCaptureOwnerKinds: ReadonlySet<string> = new Set([
  "KindFunctionDeclaration", "KindFunctionExpression", "KindArrowFunction", "KindMethodDeclaration", "KindConstructor",
  "KindGetAccessor", "KindSetAccessor", "KindClassDeclaration", "KindClassExpression",
]);

/**
 * The published lexical capture query (`facts.analyses.lexicalCaptures`): the full selection of an owner over the whole
 * owner (roots `[owner]`), with every captured binding's references, the owner's self references and the captured outer
 * receivers. Keyed by declaration Node; references resolve through the reference index (no Symbol, I3). One memo table
 * per program view (I5). An owner outside the published domain (a project callable with a body, or a project class) is
 * an invariant failure.
 */
export function createSourceLexicalCaptureQuery(
  ast: AstReader,
  navigation: Pick<SourceProgramNavigation, "sourceReferenceFor" | "isProjectDeclaration">,
): (owner: Node) => SourceLexicalCaptureSelection {
  const memo = new WeakMap<Node, SourceLexicalCaptureSelection>();
  return (owner: Node): SourceLexicalCaptureSelection => {
    const known = memo.get(owner);
    if (known !== undefined) return known;
    const kind = ast.kindName(owner);
    if (!navigation.isProjectDeclaration(owner) || !lexicalCaptureOwnerKinds.has(kind) ||
      kind !== "KindClassDeclaration" && kind !== "KindClassExpression" && ast.body(owner) === undefined) {
      throw new Error(`Lexical captures are published for a project callable with a body or a project class, not '${kind}'.`);
    }
    const selected = sourceLexicalCaptures(owner, [owner], ast, navigation, "source");
    memo.set(owner, selected);
    return selected;
  };
}

export function sourceDeclarationIsModuleScoped(declaration: Node, ast: AstReader, step: (node?: Node) => void = () => {}): boolean {
  let current: Node | undefined = declaration;
  while (current !== undefined) {
    step(current);
    const parent = ast.parent(current);
    if (parent === undefined) return false;
    const parentKind = ast.kindName(parent);
    // A declaration inside another execution (a callable body or a class static block) is not module scoped.
    if (sourceNodeHasRole(ast, parent, "execution-barrier")) return false;
    if (parentKind === "KindSourceFile") {
      const kind = ast.kindName(declaration);
      return current === declaration
        ? ["KindFunctionDeclaration", "KindClassDeclaration", "KindEnumDeclaration", "KindExportAssignment"].includes(kind)
        : ast.kindName(current) === "KindVariableStatement" && ["KindVariableDeclaration", "KindBindingElement"].includes(kind);
    }
    current = parent;
  }
  return false;
}

export function sourceBindingScope(declaration: Node, ast: AstReader): Node | undefined {
  const binding = rootBindingDeclaration(declaration, ast);
  if (binding === undefined) return undefined;
  if (ast.is.IsParameterDeclaration(binding)) {
    const callable = ast.parent(binding);
    return callable === undefined ? undefined : ast.body(callable);
  }
  const functionScoped = ast.is.IsVariableDeclaration(binding) && ast.variableDeclarationKind(binding) === "var";
  for (let current = ast.parent(binding); current !== undefined; current = ast.parent(current)) {
    const kind = ast.kindName(current);
    if (kind === "KindSourceFile") return current;
    // An execution barrier (a callable body or a class static block) owns its `var`s (E13; F2-1 static-block defect).
    if (sourceNodeHasRole(ast, current, "execution-barrier")) return ast.body(current) ?? current;
    if (!functionScoped && ["KindBlock", "KindForStatement", "KindForInStatement", "KindForOfStatement", "KindCaseBlock"].includes(kind)) return current;
    if (!functionScoped && ast.is.IsCatchClause(current)) return ast.as.AsCatchClause(current)?.Block;
  }
  return undefined;
}

export function sourceBindingIterationScope(declaration: Node, ast: AstReader): Node | undefined {
  const binding = rootBindingDeclaration(declaration, ast);
  if (binding === undefined || !ast.is.IsVariableDeclaration(binding)) return undefined;
  const initializer = ast.parent(binding);
  if (initializer === undefined || !ast.is.IsVariableDeclarationList(initializer) ||
    ast.variableDeclarationKind(initializer) !== "let") return undefined;
  const scope = ast.parent(initializer);
  return scope !== undefined && ast.is.IsForStatement(scope) && ast.as.AsForStatement(scope)?.Initializer === initializer
    ? scope : undefined;
}

function rootBindingDeclaration(declaration: Node, ast: AstReader): Node | undefined {
  let binding = declaration;
  while (ast.is.IsBindingElement(binding)) {
    const pattern = ast.parent(binding);
    const owner = pattern === undefined ? undefined : ast.parent(pattern);
    if (owner === undefined) return undefined;
    binding = owner;
  }
  return binding;
}

function within(node: Node, ancestor: Node, ast: AstReader, step: (node?: Node) => void): boolean {
  for (let current: Node | undefined = node; current !== undefined; current = ast.parent(current)) {
    step(current);
    if (current === ancestor) return true;
  }
  return false;
}
