import type { Node } from "@tsonic/tsts";
import type { SourceLexicalCapture, SourceNodeDomain } from "../../source-navigation/lexical-captures.js";
import { sourceLexicalEnvironment } from "../../source-navigation/lexical-environments.js";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import { SourceFlowFailure } from "./resources.js";

export function createSourceFlowCaptureQuery(source: TargetSourceProgram, step: (node?: Node) => void,
  domain: SourceNodeDomain) {
  const completed = new WeakMap<Node, readonly SourceLexicalCapture[]>();
  const includes = (node: Node): boolean => domain === "source" || domain.has(node);
  return (node: Node): readonly SourceLexicalCapture[] => {
    if (!includes(node)) return Object.freeze([]);
    step(node);
    const existing = completed.get(node);
    if (existing !== undefined) return existing;
    const selected = sourceLexicalEnvironment(node, [node], source.ast, source.navigation, domain, () => true, step);
    if (selected.kind === "unresolved") throw new SourceFlowFailure(selected.reason, node);
    completed.set(node, selected.captures);
    return selected.captures;
  };
}
