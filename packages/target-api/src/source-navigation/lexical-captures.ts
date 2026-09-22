import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "./types.js";
import { isTypeSyntaxNode } from "./syntax.js";

export interface SourceLexicalCapture {
  readonly declaration: Node;
  readonly references: readonly Node[];
}

export interface SourceLexicalCaptureSelection {
  readonly captures: readonly SourceLexicalCapture[];
  readonly selfReferences: readonly Node[];
}

export function sourceLexicalCaptures(
  scope: Node,
  roots: readonly Node[],
  ast: AstReader,
  navigation: Pick<SourceProgramNavigation, "sourceReferenceFor">,
): SourceLexicalCaptureSelection {
  const captures = new Map<Node, Node[]>();
  const selfReferences: Node[] = [];
  const visited = new Set<Node>();
  const visit = (node: Node): void => {
    if (visited.has(node) || isTypeSyntaxNode(ast, node)) return;
    visited.add(node);
    if (ast.is.IsIdentifier(node)) {
      const selected = navigation.sourceReferenceFor(node);
      if (selected?.project === true) {
        const declaration = selected.declaration;
        const kind = ast.kindName(declaration);
        const binding = ["KindParameter", "KindVariableDeclaration", "KindBindingElement", "KindFunctionDeclaration",
          "KindFunctionExpression", "KindClassDeclaration", "KindClassExpression", "KindEnumDeclaration"].includes(kind);
        if (!binding || ast.name(declaration) === node) return;
        if (declaration === scope) selfReferences.push(node);
        else if (!within(declaration, scope, ast) && !sourceDeclarationIsModuleScoped(declaration, ast)) {
          const references = captures.get(declaration) ?? [];
          references.push(node);
          captures.set(declaration, references);
        }
      }
    }
    ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  for (const root of roots) {
    if (!within(root, scope, ast)) throw new Error("A lexical-capture root must belong to its exact source scope.");
    visit(root);
  }
  return Object.freeze({
    captures: Object.freeze([...captures].map(([declaration, references]) => Object.freeze({
      declaration, references: Object.freeze(references),
    }))),
    selfReferences: Object.freeze(selfReferences),
  });
}

export function sourceDeclarationIsModuleScoped(declaration: Node, ast: AstReader): boolean {
  let current: Node | undefined = declaration;
  while (current !== undefined) {
    const parent = ast.parent(current);
    if (parent === undefined) return false;
    const parentKind = ast.kindName(parent);
    if (["KindFunctionDeclaration", "KindFunctionExpression", "KindArrowFunction", "KindMethodDeclaration",
      "KindConstructor", "KindGetAccessor", "KindSetAccessor"].includes(parentKind)) return false;
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
  let binding = declaration;
  while (ast.is.IsBindingElement(binding)) {
    const pattern = ast.parent(binding);
    const owner = pattern === undefined ? undefined : ast.parent(pattern);
    if (owner === undefined) return undefined;
    binding = owner;
  }
  if (ast.is.IsParameterDeclaration(binding)) {
    const callable = ast.parent(binding);
    return callable === undefined ? undefined : ast.body(callable);
  }
  const functionScoped = ast.is.IsVariableDeclaration(binding) && ast.variableDeclarationKind(binding) === "var";
  for (let current = ast.parent(binding); current !== undefined; current = ast.parent(current)) {
    const kind = ast.kindName(current);
    if (kind === "KindSourceFile") return current;
    if (["KindFunctionDeclaration", "KindFunctionExpression", "KindArrowFunction", "KindMethodDeclaration",
      "KindConstructor", "KindGetAccessor", "KindSetAccessor"].includes(kind)) return ast.body(current);
    if (!functionScoped && ["KindBlock", "KindForStatement", "KindForInStatement", "KindForOfStatement", "KindCaseBlock"].includes(kind)) return current;
    if (!functionScoped && kind === "KindCatchClause") return ast.as.AsCatchClause(current)?.Block;
  }
  return undefined;
}

function within(node: Node, ancestor: Node, ast: AstReader): boolean {
  for (let current: Node | undefined = node; current !== undefined; current = ast.parent(current)) {
    if (current === ancestor) return true;
  }
  return false;
}
