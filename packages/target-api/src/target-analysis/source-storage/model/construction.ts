import type { Node } from "@tsonic/tsts";
import { AsExpressionWithTypeArguments, Node_Expression, Node_Initializer, sourceClassFieldIsTypeOnly } from "../../../source-navigation/index.js";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";

export function sourceStorageConstructedClass(
  invocation: Node,
  source: TargetSourceProgram,
  step: () => boolean,
): Node | undefined {
  const { ast } = source;
  if (!ast.is.IsNewExpression(invocation)) return undefined;
  return sourceStorageClassValue(Node_Expression(ast, invocation), source, step);
}

export function sourceStorageClassValue(
  expression: Node | undefined,
  source: TargetSourceProgram,
  step: () => boolean,
): Node | undefined {
  const { ast, navigation } = source;
  const visited = new Set<Node>();
  let current = expression;
  while (current !== undefined && !visited.has(current) && step()) {
    visited.add(current);
    if (ast.is.IsClassExpression(current)) return navigation.isProjectDeclaration(current) ? current : undefined;
    if (ast.is.IsParenthesizedExpression(current) || ast.is.IsAsExpression(current) ||
      ast.is.IsSatisfiesExpression(current) || ast.is.IsNonNullExpression(current) || ast.is.IsTypeAssertion(current)) {
      current = Node_Expression(ast, current);
      continue;
    }
    const declaration = navigation.sourceReferenceFor(current)?.declaration;
    if (declaration === undefined) return undefined;
    if (ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration))
      return navigation.isProjectDeclaration(declaration) ? declaration : undefined;
    if (!ast.is.IsVariableDeclaration(declaration)) return undefined;
    const uses = navigation.declarationUseSummary(declaration);
    if (uses.bindingWritten || uses.exported && ast.variableDeclarationKind(declaration) !== "const") return undefined;
    current = Node_Initializer(ast, declaration);
  }
  return undefined;
}

export function sourceStorageSuperConstructor(
  invocation: Node,
  source: TargetSourceProgram,
  step: () => boolean,
): { readonly owner: Node; readonly callee: Node } | undefined {
  const { ast, navigation } = source;
  if (!ast.is.IsCallExpression(invocation) || ast.kindName(Node_Expression(ast, invocation)) !== "KindSuperKeyword") return undefined;
  for (let owner = ast.parent(invocation); owner !== undefined && step(); owner = ast.parent(owner)) {
    if (!ast.is.IsConstructorDeclaration(owner)) continue;
    const declaration = ast.parent(owner);
    if (declaration === undefined) return undefined;
    const heritage = navigation.declaredHeritage(declaration);
    if (heritage.kind !== "resolved") return undefined;
    const bases = heritage.edges.filter(edge => edge.kind === "extends");
    const callee = bases.length === 1 ? AsExpressionWithTypeArguments(ast, bases[0]!.heritage)?.Expression : undefined;
    return callee === undefined ? undefined : Object.freeze({ owner, callee });
  }
  return undefined;
}

export function sourceStorageInvokedClass(invocation: Node, source: TargetSourceProgram, step: () => boolean): Node | undefined {
  return source.ast.is.IsNewExpression(invocation) ? sourceStorageConstructedClass(invocation, source, step)
    : sourceStorageClassValue(sourceStorageSuperConstructor(invocation, source, step)?.callee, source, step);
}

export function sourceStorageInstanceInitializers(declaration: Node, source: TargetSourceProgram,
  step: () => boolean): readonly Node[] {
  const initializers: Node[] = [];
  for (const member of source.ast.members(declaration)) {
    if (!step()) break;
    if (member === undefined || !source.ast.is.IsPropertyDeclaration(member) || source.ast.hasModifierKind(member, "static") ||
      sourceClassFieldIsTypeOnly(source.ast, member)) continue;
    const initializer = Node_Initializer(source.ast, member);
    if (initializer !== undefined) initializers.push(initializer);
  }
  return initializers;
}
