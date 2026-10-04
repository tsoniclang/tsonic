import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceDeclarationUse } from "./types.js";
import type { SourceProgramNavigation } from "./types.js";
import { sourceBindingScope, sourceLexicalCaptures } from "./lexical-captures.js";

export type SourceLexicalValueCreation =
  | { readonly kind: "resolved"; readonly statement: Node; readonly inlineReference?: Node }
  | { readonly kind: "unused" }
  | { readonly kind: "unresolved"; readonly reason: string };

export function sourceLexicalFunctionValueCreation(
  declaration: Node, ast: AstReader,
  navigation: Pick<SourceProgramNavigation, "declarationUseSummary">,
  isRuntimeUse: (use: SourceDeclarationUse, declaration: Node) => boolean,
): SourceLexicalValueCreation {
  const pending = navigation.declarationUseSummary(declaration).uses
    .filter(use => use.kind === "first-class" && isRuntimeUse(use, declaration)).map(use => use.reference);
  if (pending.length === 0) return { kind: "unused" };
  const scope = sourceBindingScope(declaration, ast);
  if (scope === undefined || !ast.is.IsBlock(scope)) return unresolved("A lexical value has no exact statement activation.");
  const onlyReference = pending.length === 1 ? pending[0] : undefined;
  let inlineReference = onlyReference;
  let steps = 0;
  for (let current = onlyReference; current !== undefined && current !== scope; current = ast.parent(current)) {
    if (++steps > 262_144) return unresolved("Lexical value creation exceeded its finite source accounting budget.");
    if (["KindArrowFunction", "KindFunctionExpression", "KindFunctionDeclaration", "KindMethodDeclaration",
      "KindConstructor", "KindGetAccessor", "KindSetAccessor", "KindForStatement", "KindForInStatement",
      "KindForOfStatement", "KindWhileStatement", "KindDoStatement"].includes(ast.kindName(current))) {
      inlineReference = undefined;
      break;
    }
  }
  const positionsByBlock = new Map<Node, ReadonlyMap<Node, number>>();
  const visited = new Set<Node>();
  let common: Map<Node, { readonly statement: Node; readonly index: number }> | undefined;
  while (pending.length > 0) {
    const reference = pending.pop()!;
    if (visited.has(reference)) continue;
    visited.add(reference);
    let current = reference;
    const activations = new Map<Node, { readonly statement: Node; readonly index: number }>();
    for (;;) {
      if (++steps > 262_144) return unresolved("Lexical value creation exceeded its finite source accounting budget.");
      const parent = ast.parent(current);
      if (parent === undefined) return unresolved("A lexical value use lost its checked source activation.");
      if (ast.is.IsBlock(parent)) {
        let positions = positionsByBlock.get(parent);
        if (positions === undefined) {
          const statements = ast.statements(parent);
          steps += statements.length;
          if (steps > 262_144) return unresolved("Lexical value creation exceeded its finite source accounting budget.");
          positions = new Map(statements.flatMap((statement, index) => statement === undefined ? [] : [[statement, index] as const]));
          positionsByBlock.set(parent, positions);
        }
        const index = positions.get(current);
        if (index === undefined) return unresolved("A lexical value use has no exact owning statement.");
        activations.set(parent, { statement: current, index });
      }
      if (parent === scope) {
        if (common === undefined) common = activations;
        else for (const [block, first] of common) {
          const selected = activations.get(block);
          if (selected === undefined) common.delete(block);
          else if (selected.index < first.index) common.set(block, selected);
        }
        break;
      }
      if (ast.is.IsFunctionDeclaration(parent)) {
        for (const use of navigation.declarationUseSummary(parent).uses) {
          if ((use.kind === "direct-call" || use.kind === "first-class") && isRuntimeUse(use, parent)) pending.push(use.reference);
        }
        break;
      }
      if (["KindArrowFunction", "KindFunctionExpression", "KindMethodDeclaration", "KindConstructor",
        "KindGetAccessor", "KindSetAccessor", "KindForStatement", "KindForInStatement", "KindForOfStatement",
        "KindWhileStatement", "KindDoStatement"].includes(ast.kindName(parent))) activations.clear();
      current = parent;
    }
  }
  const statement = common?.values().next().value?.statement;
  return statement === undefined ? { kind: "unused" } : { kind: "resolved", statement,
    ...(inlineReference === undefined ? {} : { inlineReference }) };
}

function unresolved(reason: string): SourceLexicalValueCreation {
  return { kind: "unresolved", reason };
}

export function sourceLexicalFunctionValueOrder(
  declarations: readonly Node[], ast: AstReader,
  navigation: Pick<SourceProgramNavigation, "sourceReferenceFor" | "declarationUseSummary">,
  isRuntimeUse: (use: SourceDeclarationUse, declaration: Node) => boolean = () => true,
): { readonly kind: "resolved"; readonly declarations: readonly Node[] } |
  { readonly kind: "unresolved"; readonly reason: string } {
  const remaining = new Map<Node, Set<Node>>();
  const dependants = new Map<Node, Node[]>();
  const members = new Set(declarations);
  if (members.size !== declarations.length || declarations.length > 65_536) {
    return { kind: "unresolved", reason: "Lexical value ordering requires bounded, unique checked declarations." };
  }
  let steps = 0;
  for (const declaration of declarations) {
    const captures = sourceLexicalCaptures(declaration, [declaration], ast, navigation).captures;
    const dependencies = new Set<Node>();
    for (const capture of captures) {
      if (++steps > 262_144) return { kind: "unresolved", reason: "Lexical value ordering exceeded its finite source accounting budget." };
      if (!members.has(capture.declaration)) continue;
      const references = new Set(capture.references);
      if (navigation.declarationUseSummary(capture.declaration).uses.some(use =>
        use.kind === "first-class" && isRuntimeUse(use, capture.declaration) && references.has(use.reference))) dependencies.add(capture.declaration);
    }
    remaining.set(declaration, dependencies);
    for (const dependency of dependencies) {
      const values = dependants.get(dependency) ?? [];
      values.push(declaration);
      dependants.set(dependency, values);
    }
  }
  const ordered: Node[] = [];
  const ready = declarations.filter(declaration => remaining.get(declaration)?.size === 0);
  for (let index = 0; index < ready.length; index++) {
    const declaration = ready[index]!;
    ordered.push(declaration);
    remaining.delete(declaration);
    for (const dependant of dependants.get(declaration) ?? []) {
      if (++steps > 262_144) return { kind: "unresolved", reason: "Lexical value ordering exceeded its finite source accounting budget." };
      const dependencies = remaining.get(dependant);
      if (dependencies === undefined) continue;
      dependencies.delete(declaration);
      if (dependencies.size === 0) ready.push(dependant);
    }
  }
  if (remaining.size > 0) return { kind: "unresolved", reason: "Cyclic lexical callable values require an exact shared retained environment." };
  return { kind: "resolved", declarations: Object.freeze(ordered) };
}
