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
  const statements = ast.statements(scope);
  const positions = new Map(statements.flatMap((statement, index) => statement === undefined ? [] : [[statement, index] as const]));
  const visited = new Set<Node>();
  let first = statements.length;
  while (pending.length > 0) {
    const reference = pending.pop()!;
    if (visited.has(reference)) continue;
    visited.add(reference);
    let current = reference;
    for (;;) {
      if (++steps > 262_144) return unresolved("Lexical value creation exceeded its finite source accounting budget.");
      const parent = ast.parent(current);
      if (parent === undefined) return unresolved("A lexical value use lost its checked source activation.");
      if (parent === scope) {
        const index = positions.get(current);
        if (index === undefined) return unresolved("A lexical value use has no exact owning statement.");
        first = Math.min(first, index);
        break;
      }
      if (ast.is.IsFunctionDeclaration(parent)) {
        for (const use of navigation.declarationUseSummary(parent).uses) {
          if ((use.kind === "direct-call" || use.kind === "first-class") && isRuntimeUse(use, parent)) pending.push(use.reference);
        }
        break;
      }
      current = parent;
    }
  }
  const statement = statements[first];
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
