import type { Node } from "@tsonic/tsts";
import { sourceTransparentExpressionOperand } from "../../source-navigation/ast.js";
import type { SourceFlowConstruction } from "./construction.js";

export function sourceFlowUnwrap(build: SourceFlowConstruction, node: Node): Node {
  let selected = node;
  while (true) {
    build.step(selected);
    const inner = sourceTransparentExpressionOperand(build.source.ast, selected);
    if (inner === undefined) return selected;
    selected = inner;
  }
}
