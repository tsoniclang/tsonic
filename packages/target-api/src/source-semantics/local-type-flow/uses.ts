import { Node_Initializer } from "../../source-navigation/ast.js";
import type { SourceTypeFlowAnalysisContext, SourceTypeFlowGraph, SourceTypeFlowUse } from "./types.js";
import { createSourceTypeFlowDeclaredSlotReader } from "./declared-slots.js";

export function collectSourceTypeFlowUses(context: SourceTypeFlowAnalysisContext, graph: SourceTypeFlowGraph): readonly SourceTypeFlowUse[] {
  const { ast, navigation } = context.source;
  const slots = createSourceTypeFlowDeclaredSlotReader(context);
  const uses: SourceTypeFlowUse[] = [];
  const records = new Map(graph.nodes.filter(record => record.variable.path.length === 0).map(record => [record.node, record]));
  for (const record of graph.nodes) {
    if (record.variable.path.length !== 0) continue;
    const node = record.node;
    const annotation = ast.typeNode(node);
    if (annotation !== undefined && (ast.is.IsVariableDeclaration(node) || ast.is.IsPropertyDeclaration(node) || ast.is.IsParameterDeclaration(node))) {
      const type = context.reader.describeSyntax(annotation, []);
      if (type.kind === "refused") uses.push({ kind: "refused", variable: record.variable, site: node, refusal: type });
      if (type.kind === "resolved") uses.push({ kind: "fill", variable: record.variable, site: node, value: type.value, authority: "declared" });
    }
    if (!(ast.is.IsArrayLiteralExpression(node) || ast.is.IsObjectLiteralExpression(node) ||
      ast.is.IsArrowFunction(node) || ast.is.IsFunctionExpression(node) || ast.is.IsNumericLiteral(node))) continue;
    const destination = slots.destination(node);
    if (destination.kind === "refused") uses.push({ kind: "refused", variable: record.variable, site: node, refusal: destination });
    if (destination.kind === "resolved" && destination.value.kind === "present") {
      const value = destination.value.value.applied;
      if (!(value.type.kind === "intrinsic" && ["unknown", "any", "object", "void"].includes(value.type.intrinsic))) {
        uses.push({ kind: "fill", variable: record.variable, site: node, value, authority: "declared" });
      }
    }
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
  return Object.freeze(uses.sort((left, right) => context.order(left.site).preorder - context.order(right.site).preorder));
}
