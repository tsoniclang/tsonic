import type { AstReader, Node } from "@tsonic/tsts";
import { isTypeSyntaxNode } from "./syntax.js";

export function forEachSourceImmediateEvaluationChild(
  ast: AstReader,
  node: Node,
  visit: (child: Node) => void,
): void {
  if (isTypeSyntaxNode(ast, node) || ast.is.IsTypeLiteralNode(node) ||
    ast.is.IsInterfaceDeclaration(node) || ast.is.IsTypeAliasDeclaration(node) ||
    ast.is.IsArrowFunction(node) || ast.is.IsFunctionExpression(node) ||
    ast.is.IsFunctionDeclaration(node)) return;
  if (ast.is.IsClassDeclaration(node) || ast.is.IsClassExpression(node)) {
    visitDecorators(ast, node, visit);
    for (const heritage of ast.extendsHeritageElements(node)) {
      if (heritage === undefined || !ast.is.IsExpressionWithTypeArguments(heritage)) continue;
      const expression = ast.as.AsExpressionWithTypeArguments(heritage)?.Expression;
      if (expression !== undefined) visit(expression);
    }
    const members = ast.members(node);
    for (const member of members) {
      if (member !== undefined) visitMemberDefinition(ast, member, visit);
    }
    for (const member of members) {
      if (member === undefined) continue;
      if (ast.is.IsClassStaticBlockDeclaration(member)) {
        const body = ast.as.AsClassStaticBlockDeclaration(member)?.Body;
        if (body !== undefined) visit(body);
      } else if (ast.is.IsPropertyDeclaration(member) && ast.hasModifierKind(member, "static")) {
        const initializer = ast.as.AsPropertyDeclaration(member)?.Initializer;
        if (initializer !== undefined) visit(initializer);
      }
    }
    return;
  }
  if (ast.is.IsMethodDeclaration(node) || ast.is.IsGetAccessorDeclaration(node) ||
    ast.is.IsSetAccessorDeclaration(node) || ast.is.IsConstructorDeclaration(node)) {
    visitMemberDefinition(ast, node, visit);
    return;
  }
  if (ast.is.IsPropertyDeclaration(node)) {
    visitMemberDefinition(ast, node, visit);
    if (ast.hasModifierKind(node, "static")) {
      const initializer = ast.as.AsPropertyDeclaration(node)?.Initializer;
      if (initializer !== undefined) visit(initializer);
    }
    return;
  }
  ast.forEachChild(node, child => {
    if (child !== undefined && !isTypeSyntaxNode(ast, child)) visit(child);
  });
}

function visitMemberDefinition(ast: AstReader, member: Node, visit: (child: Node) => void): void {
  visitDecorators(ast, member, visit);
  const name = ast.name(member);
  if (name !== undefined && ast.is.IsComputedPropertyName(name)) visit(name);
}

function visitDecorators(ast: AstReader, node: Node, visit: (child: Node) => void): void {
  for (const modifier of ast.modifiers(node)) {
    if (modifier !== undefined && ast.kindName(modifier) === "KindDecorator") visit(modifier);
  }
}
