import { Node_Initializer } from "../../source-navigation/ast.js";
import { sourceArgumentContextSite } from "./argument-context.js";
import type { SourceTypeFlowAnalysisContext, SourceTypeFlowGraph, SourceTypeFlowUse } from "./types.js";

export function collectSourceTypeFlowUses(context: SourceTypeFlowAnalysisContext, graph: SourceTypeFlowGraph): readonly SourceTypeFlowUse[] {
  const { ast, navigation } = context.source;
  const uses: SourceTypeFlowUse[] = [];
  const records = new Map(graph.nodes.filter(record => record.variable.path.length === 0).map(record => [record.node, record]));
  for (const record of graph.nodes) {
    if (record.variable.path.length !== 0) continue;
    const node = record.node;
    const annotation = ast.typeNode(node);
    if (annotation !== undefined && (ast.is.IsVariableDeclaration(node) || ast.is.IsPropertyDeclaration(node) || ast.is.IsParameterDeclaration(node))) {
      const initializer = Node_Initializer(ast, node);
      const source = initializer === undefined ? undefined : records.get(initializer);
      if (source !== undefined) uses.push({ kind: "contextual", variable: source.variable, site: initializer! });
    }
    if (sourceArgumentContextSite({ ast }, node) === undefined && !(ast.is.IsArrayLiteralExpression(node) || ast.is.IsObjectLiteralExpression(node) ||
      ast.is.IsArrowFunction(node) || ast.is.IsFunctionExpression(node) || ast.is.IsNumericLiteral(node))) continue;
    uses.push({ kind: "contextual", variable: record.variable, site: node });
  }
  for (const record of graph.nodes) {
    if (record.declaration !== record.node || record.kind !== "open-local") continue;
    for (const write of navigation.declarationWrites(record.node, record.root)) {
      for (const value of write.values) {
        const source = records.get(value.expression);
        if (value.kind !== "value" || value.projection.length !== 0 || source === undefined || Node_Initializer(ast, record.node) === value.expression) continue;
        uses.push({ kind: "write", site: write.operation, variable: record.variable, value: value.expression,
          valueVariable: source.variable, required: record.node });
      }
    }
  }
  return Object.freeze(uses.sort((left, right) => {
    const first = context.order(left.site), second = context.order(right.site);
    return first.start - second.start || first.preorder - second.preorder;
  }).map(use => Object.freeze(use)));
}
