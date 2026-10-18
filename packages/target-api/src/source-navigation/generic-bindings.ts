import type { AstReader, Node } from "@tsonic/tsts";
import { sourceNodeIdentity } from "./identity.js";

export function generatedTypeParameterNames(
  parameters: readonly { readonly identity: string; readonly name: string }[],
  authoredNames: Iterable<string>,
): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  const used = new Set(authoredNames);
  const reserved = new Set([...used, ...parameters.map(parameter => parameter.name)]);
  for (const parameter of parameters) {
    if (names.has(parameter.identity)) continue;
    let name = parameter.name;
    if (used.has(name)) {
      const preferred = `Captured${name}`;
      name = preferred;
      let suffix = 2;
      while (reserved.has(name)) name = `${preferred}${suffix++}`;
    }
    names.set(parameter.identity, name);
    used.add(name);
    reserved.add(name);
  }
  return names;
}

export function authoredTypeParameterNames(
  node: Node, ast: AstReader, excluded: ReadonlySet<string> = new Set(),
): readonly string[] {
  const names = new Set<string>();
  const visit = (current: Node): void => {
    if (ast.is.IsTypeParameterDeclaration(current) && !excluded.has(sourceNodeIdentity(ast, current) ?? "")) {
      const name = ast.name(current);
      if (name !== undefined) names.add(ast.text(name));
    }
    ast.forEachChild(current, child => { if (child !== undefined) visit(child); });
  };
  visit(node);
  return [...names];
}

export function sourceEnclosingGenericParameters(
  declaration: Node, ast: AstReader,
): readonly Node[] | undefined {
  if (ast.kind(declaration) === undefined) return undefined;
  const parameters: Node[] = [];
  const visited = new Set<Node>([declaration]);
  for (let owner = ast.parent(declaration); owner !== undefined; owner = ast.parent(owner)) {
    if (visited.has(owner) || visited.size >= 4096) return undefined;
    visited.add(owner);
    for (const parameter of ast.typeParameters(owner)) {
      if (parameter === undefined || !ast.is.IsTypeParameterDeclaration(parameter) ||
        parameters.length >= 65_536) return undefined;
      parameters.push(parameter);
    }
  }
  return Object.freeze(parameters);
}
