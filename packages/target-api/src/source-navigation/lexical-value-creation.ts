import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceDeclarationUse } from "./types.js";
import type { SourceProgramNavigation } from "./types.js";
import { sourceLexicalCaptures, type SourceNodeDomain } from "./lexical-captures.js";

export function sourceLexicalFunctionValueOrder(
  declarations: readonly Node[], ast: AstReader,
  navigation: Pick<SourceProgramNavigation, "sourceReferenceFor" | "declarationUseSummary">,
  domain: SourceNodeDomain,
  isRuntimeUse: (use: SourceDeclarationUse, declaration: Node) => boolean = () => true,
): { readonly kind: "resolved"; readonly declarations: readonly Node[] } |
  { readonly kind: "unresolved"; readonly reason: string } {
  if (domain !== "source" && (domain === null || typeof domain !== "object" || typeof domain.has !== "function")) {
    throw new Error("Lexical value ordering requires an explicit source-node domain.");
  }
  if (domain !== "source" && declarations.some(declaration => !domain.has(declaration))) return {
    kind: "unresolved", reason: "Lexical value ordering requires every declaration in its explicit source-node domain.",
  };
  const remaining = new Map<Node, Set<Node>>();
  const dependants = new Map<Node, Node[]>();
  const members = new Set(declarations);
  if (members.size !== declarations.length || declarations.length > 65_536) {
    return { kind: "unresolved", reason: "Lexical value ordering requires bounded, unique checked declarations." };
  }
  let steps = 0;
  for (const declaration of declarations) {
    const captures = sourceLexicalCaptures(declaration, [declaration], ast, navigation, domain).captures;
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
