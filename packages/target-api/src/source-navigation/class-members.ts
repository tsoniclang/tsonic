import type { AstReader, Node } from "@tsonic/tsts";

export function sourceClassFieldIsTypeOnly(ast: AstReader, declaration: Node): boolean {
  return ast.kindName(declaration) === "KindPropertyDeclaration" &&
    ast.hasModifierKind(declaration, "ambient");
}

export function sourceParameterIsProperty(ast: AstReader, declaration: Node): boolean {
  if (ast.kindName(declaration) !== "KindParameter") return false;
  const constructor = ast.parent(declaration);
  const owner = constructor === undefined ? undefined : ast.parent(constructor);
  return constructor !== undefined && ast.kindName(constructor) === "KindConstructor" &&
    owner !== undefined && (ast.kindName(owner) === "KindClassDeclaration" || ast.kindName(owner) === "KindClassExpression") &&
    (["public", "private", "protected", "readonly"] as const).some(modifier =>
      ast.hasModifierKind(declaration, modifier));
}

export function sourceObjectMemberDeclarations(
  ast: AstReader,
  declaration: Node,
): readonly (Node | undefined)[] {
  const members = ast.members(declaration);
  if (ast.kindName(declaration) !== "KindClassDeclaration" && ast.kindName(declaration) !== "KindClassExpression") return members;
  const properties: (Node | undefined)[] = [];
  for (const member of members) {
    if (member === undefined || ast.kindName(member) !== "KindConstructor") continue;
    for (const parameter of ast.parameters(member)) {
      if (parameter === undefined || sourceParameterIsProperty(ast, parameter)) {
        properties.push(parameter);
      }
    }
  }
  return properties.length === 0 ? members : Object.freeze([...members, ...properties]);
}

export function sourceMemberOwner(ast: AstReader, declaration: Node): Node | undefined {
  const parent = ast.parent(declaration);
  return sourceParameterIsProperty(ast, declaration) && parent !== undefined
    ? ast.parent(parent)
    : parent;
}
