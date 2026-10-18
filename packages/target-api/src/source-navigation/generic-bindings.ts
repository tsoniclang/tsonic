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
