import { sourceCallableValueParameters } from "../../source-navigation/callable-parameters.js";
import type { Node } from "@tsonic/tsts";
import { forEachSourceImmediateEvaluationChild } from "../../source-navigation/immediate-evaluation.js";
import { sourceReceiverBoundary } from "../../source-navigation/receiver-owner.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../source-storage/model/resource-budget.js";
import type { SourceStorageLimits, SourceStorageQueries, SourceStorageUnresolved } from "../source-storage/model/types.js";

interface ReceiverScope {
  readonly declaration: Node;
  readonly outer: ReceiverScope | undefined;
}

export type SourceReceiverOccurrencesSelection =
  | { readonly kind: "resolved"; readonly occurrences: ReadonlyMap<Node, readonly Node[]> }
  | SourceStorageUnresolved;

export function analyzeSourceReceiverOccurrences(storage: SourceStorageQueries,
  limits?: Partial<SourceStorageLimits>): SourceReceiverOccurrencesSelection {
  const { ast } = storage.source;
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, ...limits });
  const states = new Map<Node, { readonly scope: ReceiverScope | undefined; readonly ambient: boolean }>();
  const bodies = new Map<Node, ReceiverScope>();
  const boundaries = new Set<Node>();
  const files = new Set<Node>(storage.sourceFiles);
  const evaluated = new Set<Node>(files);
  const occurrences = new Map<Node, Node[]>();
  const unresolved = (reason: string): SourceStorageUnresolved => Object.freeze({ kind: "unresolved", reason });
  const exhausted = (): SourceStorageUnresolved => unresolved(budget.failure()!);
  const sourceFailure = storage.failureReason();
  if (sourceFailure !== undefined) return unresolved(sourceFailure);
  for (const node of storage.nodes) {
    if (!budget.node() || !budget.step()) return exhausted();
    const parent = ast.parent(node);
    const inherited = parent === undefined ? undefined : states.get(parent);
    if (states.has(node) || (ast.is.IsSourceFile(node) ? !files.has(node) : inherited === undefined)) {
      return unresolved("Receiver occurrences require unique checked nodes after their exact source parents.");
    }
    const ambient = inherited?.ambient === true || ast.modifiers(node).some(modifier =>
      modifier !== undefined && ast.kindName(modifier) === "KindDeclareKeyword") ||
      ast.is.IsSourceFile(node) && ast.isDeclarationFile(ast.getSourceFile(node));
    const scope = bodies.get(node) ?? (boundaries.has(node) ? undefined : inherited?.scope);
    states.set(node, { scope, ambient });
    const arrow = ast.is.IsArrowFunction(node);
    const callable = arrow || sourceReceiverBoundary(node, ast) === "callable";
    const body = callable ? ast.body(node) : undefined;
    if (body !== undefined && !ambient) {
      if (!budget.row()) return exhausted();
      bodies.set(body, { declaration: node, outer: arrow ? scope : undefined });
      occurrences.set(node, []);
      evaluated.add(body);
      const parameters = sourceCallableValueParameters(ast, node, storage.source.semantics.forNode(node), { kind: "declaration" });
      if (parameters === undefined) return unresolved("Receiver scopes require their exact checked value parameters.");
      for (const parameter of parameters) {
        if (!budget.step()) return exhausted();
        if (parameter !== undefined) boundaries.add(parameter);
      }
    }
    if (ast.is.IsPropertyDeclaration(node)) {
      const initializer = ast.as.AsPropertyDeclaration(node)?.Initializer;
      if (initializer !== undefined) boundaries.add(initializer);
    } else if (ast.is.IsClassStaticBlockDeclaration(node)) {
      const block = ast.as.AsClassStaticBlockDeclaration(node)?.Body;
      if (block !== undefined) boundaries.add(block);
    }
    if (ambient || !evaluated.has(node)) continue;
    const kind = ast.kindName(node);
    if (kind === "KindThisKeyword" || kind === "KindThisExpression") {
      for (let selected = scope; selected !== undefined; selected = selected.outer) {
        if (!budget.step() || !budget.row()) return exhausted();
        occurrences.get(selected.declaration)!.push(node);
      }
    }
    forEachSourceImmediateEvaluationChild(ast, node, child => {
      if (budget.step()) evaluated.add(child);
    });
    if (budget.failure() !== undefined) return exhausted();
  }
  for (const file of files) {
    if (!budget.step()) return exhausted();
    if (!states.has(file)) return unresolved("Receiver occurrences require every selected checked source file.");
  }
  return Object.freeze({ kind: "resolved", occurrences: new Map([...occurrences].map(([declaration, references]) =>
    [declaration, Object.freeze(references)])) });
}
