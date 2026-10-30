import type { Node } from "@tsonic/tsts";
import { sourceExpressionResultDisposition } from "../../source-navigation/expression-use.js";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import type { SourceDeclarationFlowExecutionRegion } from "../flow/model.js";
import type { SourceDeclarationAsyncResultDisposition, SourceDeclarationOwnershipBudget,
  SourceDeclarationOwnershipUnresolved } from "./model.js";
import { sourceDeclarationOwnershipUnresolved, type createSourceDeclarationParameterUseQuery } from "./contracts.js";

export function resolveSourceDeclarationAsyncResultDisposition(input: {
  readonly source: TargetSourceProgram;
  readonly expression: Node;
  readonly budget: SourceDeclarationOwnershipBudget;
  readonly regionFor: (node: Node) => SourceDeclarationFlowExecutionRegion | SourceDeclarationOwnershipUnresolved;
  readonly parameterUses: ReturnType<typeof createSourceDeclarationParameterUseQuery>;
}): SourceDeclarationAsyncResultDisposition | SourceDeclarationOwnershipUnresolved {
  const { source, expression, budget } = input;
  if (!budget.step(expression)) return budget.failure()!;
  const file = source.ast.getSourceFile(expression);
  if (file === undefined || !source.semantics.includes(file))
    return sourceDeclarationOwnershipUnresolved(expression,
      "Result disposition requires its original checked declaration-local expression.");
  const visited = new Set<Node>();
  let current = expression;
  for (;;) {
    if (!budget.step(current)) return budget.failure()!;
    if (visited.has(current)) return sourceDeclarationOwnershipUnresolved(current,
      "Native result use requires acyclic checked local expressions.");
    visited.add(current);
    const selected = sourceExpressionResultDisposition(source.ast, current);
    if (selected.kind === "awaited-in-scope") {
      const region = input.regionFor(selected.use);
      return "kind" in region ? region : Object.freeze({ ...selected, region });
    }
    if (selected.kind !== "passed") return selected;
    const parameter = input.parameterUses.forArgument(selected.invocation, selected.argument);
    if (parameter.kind === "unresolved") return parameter.cause.kind === "resource-limit" ? parameter : selected;
    if (parameter.use === "retained") return Object.freeze({ kind: "stored", use: selected.invocation });
    current = selected.invocation;
  }
}
