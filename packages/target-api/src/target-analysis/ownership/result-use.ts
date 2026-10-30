import type { Node } from "@tsonic/tsts";
import { sourceExpressionResultDisposition } from "../../source-navigation/expression-use.js";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import type { SourceDeclarationFlowExecutionRegion } from "../flow/model.js";
import type { SourceDeclarationAsyncResultDisposition, SourceDeclarationOwnershipBudget,
  SourceDeclarationOwnershipUnresolved } from "./model.js";
import { sourceDeclarationOwnershipUnresolved } from "./contracts.js";

export function resolveSourceDeclarationAsyncResultDisposition(input: {
  readonly source: TargetSourceProgram;
  readonly expression: Node;
  readonly budget: SourceDeclarationOwnershipBudget;
  readonly regionFor: (node: Node) => SourceDeclarationFlowExecutionRegion | SourceDeclarationOwnershipUnresolved;
}): SourceDeclarationAsyncResultDisposition | SourceDeclarationOwnershipUnresolved {
  const { source, expression, budget } = input;
  if (!budget.step(expression)) return budget.failure()!;
  const file = source.ast.getSourceFile(expression);
  if (file === undefined || !source.semantics.includes(file))
    return sourceDeclarationOwnershipUnresolved(expression,
      "Result disposition requires its original checked declaration-local expression.");
  const selected = sourceExpressionResultDisposition(source.ast, expression);
  if (selected.kind !== "awaited-in-scope") return selected;
  const region = input.regionFor(selected.use);
  return "kind" in region ? region : Object.freeze({ ...selected, region });
}
