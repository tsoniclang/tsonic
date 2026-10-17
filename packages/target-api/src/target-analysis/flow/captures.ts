import type { Node } from "@tsonic/tsts";
import { sourceLexicalCaptures, type SourceLexicalCapture, type SourceNodeDomain } from "../../source-navigation/lexical-captures.js";
import { forEachSourceImmediateEvaluationChild } from "../../source-navigation/immediate-evaluation.js";
import type { TargetSourceProgram } from "../../source-semantics/types.js";

export function createSourceFlowCaptureQuery(source: TargetSourceProgram, step: (node?: Node) => void,
  domain: SourceNodeDomain) {
  const completed = new WeakMap<Node, readonly SourceLexicalCapture[]>();
  const includes = (node: Node): boolean => domain === "source" || domain.has(node);
  return (node: Node): readonly SourceLexicalCapture[] => {
    if (!includes(node)) return Object.freeze([]);
    step(node);
    const existing = completed.get(node);
    if (existing !== undefined) return existing;
    const immediate = new Set<Node>();
    forEachSourceImmediateEvaluationChild(source.ast, node, child => {
      if (includes(child)) { step(child); immediate.add(child); }
    });
    const selected = sourceLexicalCaptures(node, [node], source.ast, source.navigation, domain, step).captures;
    const captures: SourceLexicalCapture[] = [];
    for (const capture of selected) {
      step(capture.declaration);
      const references: Node[] = [];
      for (const reference of capture.references) {
        if (!includes(reference)) continue;
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
