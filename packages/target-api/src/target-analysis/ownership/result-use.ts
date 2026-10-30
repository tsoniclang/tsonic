import type { Node } from "@tsonic/tsts";
import { sourceExpressionResultDisposition } from "../../source-navigation/expression-use.js";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import type { SourceStorageBindings, SourceStorageQueries } from "../source-storage/model/types.js";
import type { SourceAsyncResultDisposition, SourceOwnershipBudget, SourceOwnershipUnresolved } from "./model.js";
import { sourceOwnershipUnresolved as unresolved } from "./contracts.js";
import type { SourceDeclarationFlowExecutionRegion } from "../flow/model.js";
import type { SourceDeclarationAsyncResultDisposition, SourceDeclarationOwnershipBudget,
  SourceDeclarationOwnershipUnresolved } from "./model.js";
import { sourceDeclarationOwnershipUnresolved } from "./contracts.js";

export function resolveSourceAsyncResultDisposition(source: TargetSourceProgram, storage: SourceStorageQueries,
  expression: Node, budget: SourceOwnershipBudget,
  bindings: SourceStorageBindings = storage.emptyBindings): SourceAsyncResultDisposition | SourceOwnershipUnresolved {
  if (source !== storage.source) return unresolved(expression, "Result disposition and storage require the identical checked source program.");
  const file = source.ast.getSourceFile(expression);
  if (file === undefined || !source.semantics.includes(file)) {
    return unresolved(expression, "Result disposition requires an expression from the exact checked source program.");
  }
  const visited = new Set<Node>();
  let current = expression;
  for (;;) {
    if (!budget.step()) return unresolved(current, budget.failure()!);
    if (visited.has(current)) return unresolved(current, "Async result transport has a cyclic selected consumer.");
    visited.add(current);
    const selected = sourceExpressionResultDisposition(source.ast, current);
    if (selected.kind === "awaited-in-scope") {
      const region = storage.enclosingRegionFor(selected.use);
      return region === undefined ? unresolved(selected.use, "An immediate await requires its exact checked execution region.")
        : Object.freeze({ ...selected, region });
    }
    if (selected.kind === "discarded" || selected.kind === "stored" || selected.kind === "returned") return selected;
    if (selected.kind === "consumed") return selected;
    const transports = storage.argumentTransportsFor(selected.invocation);
    const implementations = storage.invocationImplementationsFor(selected.invocation, bindings);
    if (transports.kind === "unresolved" || implementations.kind === "unresolved") {
      return budget.failure() === undefined ? selected : unresolved(selected.use, budget.failure()!);
    }
    const argument = storage.subjectFor(selected.argument);
    if (argument.kind === "unresolved") return unresolved(selected.argument, argument.reason);
    const parameters = transports.arguments.filter(transport => transport.actual === argument.subject)
      .map(argument => argument.selectedParameterDeclaration);
    if (!implementations.exact || implementations.nodes.length !== 1 || parameters.length !== 1) {
      return selected;
    }
    const parameter = parameters[0]!;
    const uses = source.navigation.declarationUses(parameter).filter(use => use.kind !== "type-only");
    if (uses.length !== 1 || uses[0]!.captured || uses[0]!.throughMember) {
      return selected;
    }
    const use = sourceExpressionResultDisposition(source.ast, uses[0]!.reference);
    if (use.kind === "stored") return Object.freeze({ kind: "stored", use: use.use });
    if (use.kind !== "returned" || source.ast.hasModifierKind(implementations.nodes[0]!, "async")) {
      return selected;
    }
    current = selected.invocation;
  }
}

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
