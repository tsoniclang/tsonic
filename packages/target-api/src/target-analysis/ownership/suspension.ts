import type { Node, ResolvedSourceResourceManagementInfo } from "@tsonic/tsts";
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
  const operations = new Map<Node, SourceDeclarationPendingSelection>();
  const results = new Map<Node, SourceDeclarationPendingSelection>();
  const pending = new WeakSet<SourceDeclarationPendingOperation>();
  const select = (operation: Node, selection:
    | { readonly kind: "expression"; readonly expression: Node; readonly use: "operation" | "value" }
    | { readonly kind: "resource-cleanup"; readonly resource: ResolvedSourceResourceManagementInfo }
  ): SourceDeclarationPendingSelection => {
    const subject = selection.kind === "expression" ? selection.expression : selection.resource.declaration;
    const use = selection.kind === "expression" ? selection.use : "resource-cleanup";
    if (!budget.step(operation)) return budget.failure()!;
    const cache = use === "operation" ? operations : results;
    const existing = cache.get(operation);
    if (existing !== undefined) return existing;
    const region = values.regionFor(operation);
    if ("kind" in region) return region;
    const value = values.forNode(subject);
    if ("kind" in value) return value;
    if (value.region !== region)
      return sourceDeclarationOwnershipUnresolved(operation, "A native pending operand must belong to this exact checked execution region.");
    if (selection.kind === "resource-cleanup" && !source.semantics.forNode(operation).types.isIdentical(
      selection.resource.sourceResourceType, value.component.selectedType))
      return sourceDeclarationOwnershipUnresolved(operation, "Resource cleanup requires its exact checked resource type and local value.");
    if (use === "value") {
      const types = source.semantics.forNode(subject).types;
      const immediate = (type: typeof value.component.selectedType): boolean => {
        if (!budget.step(subject) || types.isAny(type) || types.isUnknown(type) || types.isIntersection(type)) return false;
        if (types.isUnion(type)) {
          const members = types.unionOrIntersectionTypes(type);
          return members.length !== 0 && members.every(immediate);
        }
        return types.isNever(type) || types.isNumberLike(type) || types.isBooleanLike(type) || types.isStringLike(type) ||
          types.isBigIntLike(type) || types.isSymbolLike(type) || types.isNullish(type) || types.isVoidLike(type);
      };
      if (immediate(value.component.selectedType)) {
        const rows = budget.createRows(operation);
        if (!rows.add(2)) { rows.release(); return budget.failure()!; }
        const result = Object.freeze({ kind: "never" as const });
        cache.set(operation, result);
        return result;
      }
      const failure = budget.failure();
      if (failure !== undefined) return failure;
    }
    const selected = premises.suspensionFor(value, use);
    if (selected === undefined)
      return sourceDeclarationOwnershipUnresolved(subject,
        "A missing declaration body or native completion record is not proof of a non-suspending operation.");
    if (selected.kind === "unresolved") return selected;
    if (selected.value !== value)
      return sourceDeclarationOwnershipUnresolved(subject, "Native suspension evidence belongs to a different checked local operand.");
    const problem = sourceDeclarationOwnershipContractProblem(source, subject, value.component, selected.contract);
    if (problem !== undefined) return sourceDeclarationOwnershipUnresolved(subject, problem);
    const rows = budget.createRows(operation);
    if (!rows.add(selected.kind === "never" ? 2 : 4)) { rows.release(); return budget.failure()!; }
    if (selected.kind === "never") {
      const result = Object.freeze({ kind: "never" as const });
      cache.set(operation, result);
      return result;
    }
    const contracts = Object.freeze([Object.freeze({ value, contract: selected.contract })]);
    const witness: SourceDeclarationPendingOperation = selection.kind === "expression"
      ? Object.freeze({ kind: "expression", operation, expression: subject, region, contracts })
      : Object.freeze({ kind: "resource-cleanup", operation, resource: selection.resource, region, contracts });
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
      return select(operation, { kind: "expression", expression, use: "value" });
    },
    forResourceCleanup(resource: ResolvedSourceResourceManagementInfo): SourceDeclarationPendingSelection {
      const operation = resource.declaration;
      if (!budget.step(operation)) return budget.failure()!;
      const file = source.ast.getSourceFile(operation);
      if (file === undefined || !source.semantics.includes(file) || !source.ast.is.IsVariableDeclaration(operation) ||
        source.ast.variableDeclarationKind(operation) !== "await using")
        return sourceDeclarationOwnershipUnresolved(operation, "Cleanup suspension requires its original checked await-using declaration.");
      const checked = source.semantics.forNode(operation).operations.resourceManagement(operation);
      if (checked !== resource || checked.declarationKind !== "await using" || checked.disposal.kind !== "selected")
        return sourceDeclarationOwnershipUnresolved(operation, "Cleanup suspension requires its exact checked acquisition and selected disposal facts.");
      return select(operation, { kind: "resource-cleanup", resource: checked });
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
      return select(call, { kind: "expression", expression: call, use: "operation" });
    },
    forResult(expression: Node): SourceDeclarationPendingSelection {
      return select(expression, { kind: "expression", expression, use: "value" });
    },
  });
}

export type SourceDeclarationSuspensionQueries = ReturnType<typeof createSourceDeclarationSuspensionQuery>;
