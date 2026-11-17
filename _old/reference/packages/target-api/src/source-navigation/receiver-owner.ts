import type { AstReader, Node } from "@tsonic/tsts";

export type SourceReceiverBoundary = "callable" | "class" | "field" | "static-block" | "module";

export function sourceReceiverBoundary(node: Node, ast: AstReader): SourceReceiverBoundary | undefined {
  if (ast.is.IsFunctionDeclaration(node) || ast.is.IsFunctionExpression(node) ||
    ast.is.IsMethodDeclaration(node) || ast.is.IsConstructorDeclaration(node) ||
    ast.is.IsGetAccessorDeclaration(node) || ast.is.IsSetAccessorDeclaration(node)) return "callable";
  if (ast.is.IsClassDeclaration(node) || ast.is.IsClassExpression(node)) return "class";
  if (ast.is.IsPropertyDeclaration(node)) return "field";
  if (ast.is.IsClassStaticBlockDeclaration(node)) return "static-block";
  if (ast.is.IsSourceFile(node)) return "module";
  return undefined;
}

export function sourceReceiverOwner(node: Node, ast: AstReader, purpose: "lexical-capture" | "storage",
  enter: () => boolean = () => true): Node | undefined {
  for (let owner = ast.parent(node); owner !== undefined && enter(); owner = ast.parent(owner)) {
    const boundary = sourceReceiverBoundary(owner, ast);
    if (boundary !== undefined && (purpose === "lexical-capture" ? boundary !== "class"
      : boundary === "class" || boundary === "callable")) return owner;
  }
  return undefined;
}
