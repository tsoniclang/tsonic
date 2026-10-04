import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceDeclarationUse, SourceProgramNavigation } from "./types.js";
import { sourceLexicalCaptures, sourceDeclarationIsModuleScoped, type SourceLexicalCaptureSelection } from "./lexical-captures.js";
import { forEachSourceImmediateEvaluationChild } from "./immediate-evaluation.js";

export interface SourceLexicalEnvironment extends SourceLexicalCaptureSelection {
  readonly kind: "resolved";
  readonly callableRoots: readonly Node[];
}

export function sourceLexicalEnvironment(
  scope: Node, roots: readonly Node[], ast: AstReader,
  navigation: Pick<SourceProgramNavigation, "sourceReferenceFor" | "declarationUseSummary">,
  isRuntimeUse: (use: SourceDeclarationUse, declaration: Node) => boolean = () => true,
): SourceLexicalEnvironment | { readonly kind: "unresolved"; readonly reason: string } {
  const captures = new Map<Node, Set<Node>>();
  const receivers = new Map<Node, Set<Node>>();
  const selfReferences = new Set<Node>();
  const callableRoots = new Set<Node>();
  const pending: { readonly owner: Node; readonly roots: readonly Node[] }[] = [{ owner: scope, roots }];
  const useKinds = new Map<Node, ReadonlyMap<Node, SourceDeclarationUse>>();
  const evaluated = new Set<Node>();
  let steps = 0;
  let evaluationSteps = 0;
  while (pending.length > 0) {
    if (++steps > 262_144) return exhausted();
    const { owner, roots: selectedRoots } = pending.pop()!;
    if (callableRoots.has(owner)) continue;
    callableRoots.add(owner);
    const evaluationPending = selectedRoots.flatMap(root => ast.is.IsFunctionDeclaration(root)
      ? [...ast.parameters(root).flatMap(parameter => {
          const initializer = ast.as.AsParameterDeclaration(parameter)?.Initializer;
          return initializer === undefined ? [] : [initializer];
        }), ...(ast.body(root) === undefined ? [] : [ast.body(root)!])] : [root]);
    while (evaluationPending.length > 0) {
      if (++evaluationSteps > 4_194_304) return exhausted();
      const node = evaluationPending.pop()!;
      if (evaluated.has(node)) continue;
      evaluated.add(node);
      const declaration = ast.is.IsIdentifier(node) ? navigation.sourceReferenceFor(node)?.declaration : undefined;
      if (declaration !== undefined && ast.is.IsFunctionDeclaration(declaration) &&
        !sourceDeclarationIsModuleScoped(declaration, ast)) {
        const kinds = usesFor(declaration);
        if (kinds === undefined) return exhausted();
        const use = kinds.get(node);
        if (use?.kind === "direct-call" && isRuntimeUse(use, declaration)) pending.push({ owner: declaration, roots: [declaration] });
      }
      forEachSourceImmediateEvaluationChild(ast, node, child => evaluationPending.push(child));
    }
    const selected = sourceLexicalCaptures(owner, selectedRoots, ast, navigation);
    if (owner === scope) for (const reference of selected.selfReferences) selfReferences.add(reference);
    for (const receiver of selected.receivers) {
      if (within(receiver.owner)) continue;
      const references = receivers.get(receiver.owner) ?? new Set<Node>();
      for (const reference of receiver.references) references.add(reference);
      receivers.set(receiver.owner, references);
    }
    for (const capture of selected.captures) {
      if (++steps > 262_144) return exhausted();
      let references = capture.references;
      if (ast.is.IsFunctionDeclaration(capture.declaration)) {
        const kinds = usesFor(capture.declaration);
        if (kinds === undefined) return exhausted();
        for (const reference of references) {
          if (++steps > 262_144) return exhausted();
          if (kinds.get(reference) === undefined) return {
            kind: "unresolved", reason: "A lexical callable reference lost its exact checked use classification.",
          };
        }
        references = references.filter(reference => isRuntimeUse(kinds.get(reference)!, capture.declaration));
        if (references.some(reference => kinds.get(reference)?.kind === "direct-call")) {
          pending.push({ owner: capture.declaration, roots: [capture.declaration] });
        }
        references = references.filter(reference => kinds.get(reference)?.kind === "first-class");
      }
      if (references.length === 0 || within(capture.declaration)) continue;
      const values = captures.get(capture.declaration) ?? new Set<Node>();
      for (const reference of references) values.add(reference);
      captures.set(capture.declaration, values);
    }
  }
  if (steps > 262_144) return exhausted();
  return Object.freeze({
    kind: "resolved",
    captures: Object.freeze([...captures].map(([declaration, references]) => Object.freeze({
      declaration, references: Object.freeze([...references]),
    }))),
    selfReferences: Object.freeze([...selfReferences]),
    receivers: Object.freeze([...receivers].map(([owner, references]) => Object.freeze({
      owner, references: Object.freeze([...references]),
    }))),
    callableRoots: Object.freeze([...callableRoots]),
  });

  function within(node: Node): boolean {
    for (let current: Node | undefined = node; current !== undefined; current = ast.parent(current)) {
      if (++steps > 262_144) return false;
      if (current === scope) return true;
    }
    return false;
  }

  function usesFor(declaration: Node): ReadonlyMap<Node, SourceDeclarationUse> | undefined {
    const existing = useKinds.get(declaration);
    if (existing !== undefined) return existing;
    const indexed = new Map<Node, SourceDeclarationUse>();
    for (const use of navigation.declarationUseSummary(declaration).uses) {
      if (++steps > 262_144 || indexed.has(use.reference)) return undefined;
      indexed.set(use.reference, use);
    }
    useKinds.set(declaration, indexed);
    return indexed;
  }

  function exhausted(): { readonly kind: "unresolved"; readonly reason: string } {
    return { kind: "unresolved", reason: "Lexical environment analysis exceeded its finite source accounting budget." };
  }
}
