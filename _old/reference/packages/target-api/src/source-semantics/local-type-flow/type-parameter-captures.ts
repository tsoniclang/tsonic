import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceNodeNavigationFacts } from "../../source-model/navigation.js";
import { sourceTypeExpansionBudget } from "../type-expansion-budget.js";
import { failTargetCompilerResourceLimit } from "../../artifacts.js";

export function sourceOriginalTypeParameterCaptures(context: {
  readonly ast: AstReader;
  readonly navigation: Pick<SourceNodeNavigationFacts, "sourceReferenceFor">;
}, occurrence: Node, required: readonly Node[] = []): readonly Node[] {
  const { ast, navigation } = context;
  let work = 0;
  const charge = (): void => {
    if (++work > sourceTypeExpansionBudget.types) failTargetCompilerResourceLimit("tsonic", "Source type expansion", "types", sourceTypeExpansionBudget.types, occurrence);
  };
  const ancestors: Node[] = [];
  const owners = new Set<Node>();
  for (let owner = ast.parent(occurrence); owner !== undefined; owner = ast.parent(owner)) {
    charge();
    if (owners.has(owner)) throw new Error("Original Source binder ancestry must be acyclic.");
    owners.add(owner);
    ancestors.push(owner);
  }
  const captures = new Set(required);
  const visited = new Set<Node>();
  const pending = [occurrence];
  while (pending.length > 0) {
    charge();
    const node = pending.pop()!;
    if (visited.has(node)) continue;
    visited.add(node);
    const declaration = navigation.sourceReferenceFor(node)?.declaration;
    if (declaration !== undefined) {
      if (ast.is.IsTypeParameterDeclaration(declaration)) {
        const owner = ast.parent(declaration);
        if (owner !== undefined && owners.has(owner)) captures.add(declaration);
      } else {
        const annotation = ast.typeNode(declaration);
        if (annotation !== undefined) { charge(); pending.push(annotation); }
      }
    }
    const children: Node[] = [];
    ast.forEachChild(node, child => { if (child !== undefined) { charge(); children.push(child); } });
    for (let index = children.length - 1; index >= 0; index--) pending.push(children[index]!);
  }
  const result: Node[] = [];
  for (const owner of ancestors.reverse()) for (const declaration of ast.typeParameters(owner)) {
    charge();
    if (captures.delete(declaration)) result.push(declaration);
  }
  for (const declaration of captures) { charge(); result.push(declaration); }
  return Object.freeze(result);
}
