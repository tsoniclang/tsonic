import type { Node } from "@tsonic/tsts";
import { sourceLexicalCaptures, type SourceLexicalCapture } from "../../source-navigation/lexical-captures.js";
import { forEachSourceImmediateEvaluationChild } from "../../source-navigation/immediate-evaluation.js";
import type { TargetSourceProgram } from "../../source-semantics/types.js";

export function createSourceFlowCaptureQuery(source: TargetSourceProgram, step: (node?: Node) => void) {
  const completed = new WeakMap<Node, readonly SourceLexicalCapture[]>();
  return (node: Node): readonly SourceLexicalCapture[] => {
    step(node);
    const existing = completed.get(node);
    if (existing !== undefined) return existing;
    const immediate = new Set<Node>();
    forEachSourceImmediateEvaluationChild(source.ast, node, child => { step(child); immediate.add(child); });
    const selected = sourceLexicalCaptures(node, [node], source.ast, source.navigation, step).captures;
    const captures: SourceLexicalCapture[] = [];
    for (const capture of selected) {
      step(capture.declaration);
      const references: Node[] = [];
      for (const reference of capture.references) {
        let current: Node | undefined = reference;
        while (current !== undefined && current !== node && !immediate.has(current)) {
          step(current);
          current = source.ast.parent(current);
        }
        if (current === node) references.push(reference);
      }
      if (references.length > 0) captures.push(Object.freeze({ declaration: capture.declaration, references: Object.freeze(references) }));
    }
    const result = Object.freeze(captures);
    completed.set(node, result);
    return result;
  };
}
