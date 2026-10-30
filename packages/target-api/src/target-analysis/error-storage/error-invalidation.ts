import type { Node } from "@tsonic/tsts";
import { forEachSourceImmediateEvaluationChild, sourceEnclosingCallable } from "../../source-navigation/index.js";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import type { SourceErrorDeclarationQueries } from "./protocol.js";

export function createSourceErrorLocalInvalidationQuery(
  source: TargetSourceProgram,
  fieldFor: SourceErrorDeclarationQueries["fieldFor"],
  mutationFor: SourceErrorDeclarationQueries["mutationFor"],
  owns: (node: Node) => boolean,
): SourceErrorDeclarationQueries["invalidationFor"] {
  const { ast } = source;
  return (read, expression) => {
    if (read === undefined || !owns(read.node) || !owns(expression)) return Object.freeze({ kind: "unresolved",
      reason: "Local Error invalidation requires the original checked read and later expression." });
    const checked = fieldFor(read.node);
    if (checked.kind !== "resolved" || checked.value !== read || read.accessMode !== "read") return Object.freeze({ kind: "unresolved",
      reason: "Local Error invalidation requires its exact published field-read selection." });
    const evaluationOwner = ast.is.IsArrowFunction(expression) || ast.is.IsFunctionExpression(expression) ||
      ast.is.IsFunctionDeclaration(expression) ? ast.parent(expression) : expression;
    if (sourceEnclosingCallable(read.node, ast) !== sourceEnclosingCallable(evaluationOwner, ast) ||
        ast.getSourceFile(read.node) !== ast.getSourceFile(expression)) return Object.freeze({ kind: "unresolved",
      reason: "Local Error invalidation cannot replay another callable or source file." });
    const pending = [{ node: expression, completed: false }];
    while (pending.length !== 0) {
      const { node, completed } = pending.pop()!;
      if (!owns(node)) return Object.freeze({ kind: "unresolved", reason: "An Error effect left its checked source domain." });
      if (!completed) {
        pending.push({ node, completed: true });
        const children: Node[] = [];
        forEachSourceImmediateEvaluationChild(ast, node, child => children.push(child));
        for (const child of children.reverse()) pending.push({ node: child, completed: false });
        continue;
      }
      if (ast.is.IsAwaitExpression(node) || ast.is.IsYieldExpression(node)) return Object.freeze({ kind: "invalidated", at: node });
      const mutations = mutationFor(node);
      if (mutations.kind === "unresolved") return mutations;
      if (mutations.kind === "resolved") {
        if (mutations.value.some(mutation => mutation.kind === "field"
          ? mutation.field.memberDeclaration === read.memberDeclaration
          : mutation.scalar.slot.fields.includes(read.memberDeclaration))) return Object.freeze({ kind: "invalidated", at: node });
      }
      if (ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node)) return Object.freeze({ kind: "invalidated", at: node });
      if (ast.is.IsElementAccessExpression(node)) return Object.freeze({ kind: "invalidated", at: node });
      if (ast.is.IsPropertyAccessExpression(node)) {
        const field = fieldFor(node);
        if (field.kind === "unresolved") return field;
        if (field.kind !== "resolved") {
          const property = source.semantics.forNode(node).operations.propertyAccess(node);
          const declaration = property?.selectedDeclaration;
          if (declaration === undefined || ast.is.IsGetAccessorDeclaration(declaration)) return Object.freeze({ kind: "invalidated", at: node });
        }
      }
      if (source.navigation.expressionEffects(node).mutates && mutations.kind !== "resolved")
        return Object.freeze({ kind: "invalidated", at: node });
    }
    return Object.freeze({ kind: "preserved" });
  };
}
