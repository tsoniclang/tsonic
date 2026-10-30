import type { Node } from "@tsonic/tsts";
import { Node_Expression } from "../../source-navigation/index.js";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import type { SourceDeclarationOwnershipBudget, SourceDeclarationOwnershipPremises, SourceDeclarationOwnershipValues,
  SourceDeclarationPendingOperation, SourceDeclarationPendingSelection } from "./model.js";
import { sourceDeclarationOwnershipContractProblem, sourceDeclarationOwnershipUnresolved } from "./contracts.js";

export function createSourceDeclarationSuspensionQuery(input: {
  readonly source: TargetSourceProgram;
  readonly values: SourceDeclarationOwnershipValues;
  readonly premises: Pick<SourceDeclarationOwnershipPremises, "suspensionFor">;
  readonly budget: SourceDeclarationOwnershipBudget;
}) {
  const { source, values, premises, budget } = input;
  const cache = new Map<Node, SourceDeclarationPendingSelection>();
  const pending = new WeakSet<SourceDeclarationPendingOperation>();
  const select = (operation: Node, expression: Node): SourceDeclarationPendingSelection => {
    if (!budget.step(operation)) return budget.failure()!;
    const existing = cache.get(operation);
    if (existing !== undefined) return existing;
    const region = values.regionFor(operation);
    if ("kind" in region) return region;
    const value = values.forNode(expression);
    if ("kind" in value) return value;
    if (value.region !== region)
      return sourceDeclarationOwnershipUnresolved(operation, "A native pending operand must belong to this exact checked execution region.");
    const selected = premises.suspensionFor(value);
    if (selected === undefined)
      return sourceDeclarationOwnershipUnresolved(expression,
        "A missing declaration body or native completion record is not proof of a non-suspending operation.");
    if (selected.kind === "unresolved") return selected;
    if (selected.value !== value)
      return sourceDeclarationOwnershipUnresolved(expression, "Native suspension evidence belongs to a different checked local operand.");
    const problem = sourceDeclarationOwnershipContractProblem(source, expression, value.component, selected.contract);
    if (problem !== undefined) return sourceDeclarationOwnershipUnresolved(expression, problem);
    const rows = budget.createRows(operation);
    if (!rows.add(selected.kind === "never" ? 2 : 4)) { rows.release(); return budget.failure()!; }
    if (selected.kind === "never") {
      const result = Object.freeze({ kind: "never" as const });
      cache.set(operation, result);
      return result;
    }
    const witness: SourceDeclarationPendingOperation = Object.freeze({ operation, expression, region,
      contracts: Object.freeze([Object.freeze({ value, contract: selected.contract })]) });
    pending.add(witness);
    const result = Object.freeze({ kind: "resolved" as const, pending: witness });
    cache.set(operation, result);
    return result;
  };
  return Object.freeze({
    owns: (witness: SourceDeclarationPendingOperation): boolean => pending.has(witness),
    forAwait(operation: Node): SourceDeclarationPendingSelection {
      if (!budget.step(operation)) return budget.failure()!;
      const file = source.ast.getSourceFile(operation);
      const expression = source.ast.is.IsAwaitExpression(operation)
        ? Node_Expression(source.ast, operation) : undefined;
      if (file === undefined || !source.semantics.includes(file) || expression === undefined)
        return sourceDeclarationOwnershipUnresolved(operation, "A pending await requires its original checked operation and operand.");
      return select(operation, expression);
    },
    forCall(call: Node): SourceDeclarationPendingSelection {
      if (!budget.step(call)) return budget.failure()!;
      const file = source.ast.getSourceFile(call);
      if (file === undefined || !source.semantics.includes(file) ||
        !source.ast.is.IsCallExpression(call) && !source.ast.is.IsNewExpression(call))
        return sourceDeclarationOwnershipUnresolved(call, "Native completion requires its exact checked call operation.");
      const selected = source.semantics.forNode(call).operations.call(call);
      if (selected?.sourceSelectedSignatureKind !== "resolved")
        return sourceDeclarationOwnershipUnresolved(call, "Native completion requires its checked selected declaration contract.");
      return select(call, call);
    },
    forResult(expression: Node): SourceDeclarationPendingSelection { return select(expression, expression); },
  });
}

export type SourceDeclarationSuspensionQueries = ReturnType<typeof createSourceDeclarationSuspensionQuery>;
