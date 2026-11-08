import type { Node } from "@tsonic/tsts";
import type { SourceTypeEvidence } from "../public/source/contracts.js";
import { sourceBindingHasMutableExposure } from "../source-navigation/binding-mutation-exposure.js";
import { Node_Expression } from "../source-navigation/ast.js";
import { createSourceSyntaxDomain } from "../source-navigation/node-inventory.js";
import type { SourceProductionResult } from "./descriptor-contracts.js";
import { resolveSourceFlowConditions } from "./flow-conditions.js";
import { sourceGuardPreservesBinding } from "./guard-preservation.js";
import type { SourceGuard, SourceGuardContext } from "./value-flow-model.js";

function resolved<Value>(value: Value): SourceProductionResult<Value> { return Object.freeze({ kind: "resolved", value }); }

export function selectSourceGuardResult<Member, Predicate>(
  context: SourceGuardContext,
  expression: Node,
  membersFor: (reference: Node) => SourceProductionResult<readonly Member[] | undefined>,
  selectGuard: (expression: Node) => SourceProductionResult<SourceGuard<Predicate> | undefined>,
  testMember: (member: Member, predicate: Predicate) => SourceProductionResult<boolean | undefined>,
): SourceProductionResult<boolean | undefined> {
  context.navigation.callableRoles(expression);
  let current = expression;
  let negated = false;
  const contains = createSourceSyntaxDomain(context.ast, expression);
  const visited = new Set<Node>();
  while (contains(current) && !visited.has(current)) {
    visited.add(current);
    const kind = context.ast.kindName(current);
    if (kind === "KindTrueKeyword" || kind === "KindFalseKeyword") return resolved((kind === "KindTrueKeyword") !== negated);
    if (context.ast.is.IsParenthesizedExpression(current) || context.ast.is.IsSatisfiesExpression(current) ||
      context.ast.is.IsNonNullExpression(current)) {
      const inner = Node_Expression(context.ast, current);
      if (inner === undefined) return resolved(undefined);
      current = inner;
      continue;
    }
    if (context.ast.is.IsPrefixUnaryExpression(current) && context.ast.operatorKindName(current) === "KindExclamationToken") {
      const operand = context.ast.as.AsPrefixUnaryExpression(current)?.Operand;
      if (operand === undefined) return resolved(undefined);
      current = operand;
      negated = !negated;
      continue;
    }
    const guard = selectGuard(current);
    if (guard.kind !== "resolved") return guard;
    if (guard.value === undefined) return resolved(undefined);
    const members = membersFor(guard.value.sourceOperand);
    if (members.kind !== "resolved") return members;
    if (members.value === undefined || members.value.length === 0) return resolved(undefined);
    const narrowed = selectSourceGuardedValueMembers(context, guard.value.sourceOperand, members.value, selectGuard, testMember);
    if (narrowed.kind !== "resolved") return narrowed;
    const selected = narrowed.value ?? members.value;
    if (selected.length === 0) return resolved(undefined);
    const results: (boolean | undefined)[] = [];
    for (const member of selected) {
      const result = testMember(member, guard.value.predicate);
      if (result.kind !== "resolved") return result;
      results.push(result.value);
    }
    const result = results.every(value => value === true) ? true : results.every(value => value === false) ? false : undefined;
    return resolved(result === undefined ? undefined : result !== negated);
  }
  return resolved(undefined);
}

export function selectSourceGuardedEvidenceMembers<Predicate>(
  context: SourceGuardContext,
  reference: Node,
  value: SourceTypeEvidence,
  selectGuard: (expression: Node) => SourceProductionResult<SourceGuard<Predicate> | undefined>,
  testEvidence: (evidence: SourceTypeEvidence, predicate: Predicate) => SourceProductionResult<boolean | undefined>,
): SourceProductionResult<readonly SourceTypeEvidence[] | undefined> {
  context.view.assertEvidence(value);
  if (value.sum === undefined) return resolved(undefined);
  for (const arm of value.sum.arms) context.view.assertEvidence(arm);
  return selectSourceGuardedValueMembers(context, reference, value.sum.arms, selectGuard, (member, predicate) => {
    context.view.assertEvidence(member);
    return testEvidence(member, predicate);
  });
}

export function selectSourceGuardedValueMembers<Member, Predicate>(
  context: SourceGuardContext,
  reference: Node,
  members: readonly Member[],
  selectGuard: (expression: Node) => SourceProductionResult<SourceGuard<Predicate> | undefined>,
  testMember: (member: Member, predicate: Predicate) => SourceProductionResult<boolean | undefined>,
): SourceProductionResult<readonly Member[] | undefined> {
  context.navigation.callableRoles(reference);
  if (!context.ast.is.IsIdentifier(reference)) return resolved(undefined);
  const binding = context.navigation.sourceReferenceFor(reference);
  if (binding === undefined || !context.ast.is.IsVariableDeclaration(binding.declaration) &&
    !context.ast.is.IsParameterDeclaration(binding.declaration) && !context.ast.is.IsBindingElement(binding.declaration)) return resolved(undefined);
  const summary = context.navigation.declarationUseSummary(binding.declaration);
  if (summary.exported) return resolved(undefined);
  const capturedWrites = summary.uses.some(use => use.captured && use.role === "write" && !use.throughMember);
  const enter = createSourceSyntaxDomain(context.ast, reference);
  const exposure = sourceBindingHasMutableExposure(context, summary, enter);
  if (exposure.kind === "refused") return exposure;
  if (exposure.value) return resolved(undefined);
  const original = context.flowConditions(reference);
  const selectedFlow = resolveSourceFlowConditions(context, reference, original.kind === "present" ? original.value : undefined);
  if (selectedFlow.kind !== "resolved") return selectedFlow;
  const flow = selectedFlow.value;
  if (flow === undefined || flow.reference !== reference) return resolved(undefined);
  let selected = members;
  let consulted = false;
  let invalid = false;
  const selectCondition = (expression: Node, assumed: boolean, values: readonly Member[]):
    SourceProductionResult<readonly Member[] | undefined> => {
    const active = new Set<Node>();
    const results: (readonly Member[] | undefined)[] = [];
    const pending: { readonly expression: Node; readonly assumed: boolean;
      readonly combine?: "transparent" | "intersection" | "union" }[] = [{ expression, assumed }];
    while (pending.length !== 0) {
      const current = pending.pop()!;
      if (current.combine !== undefined) {
        active.delete(current.expression);
        if (current.combine === "transparent") continue;
        const right = results.pop();
        const left = results.pop();
        results.push(current.combine === "intersection"
          ? left === undefined ? right : right === undefined ? left : left.filter(member => right.includes(member))
          : left === undefined || right === undefined ? undefined : values.filter(member => left.includes(member) || right.includes(member)));
        continue;
      }
      const node = current.expression;
      if (!enter(node) || active.has(node)) { invalid = true; return resolved(undefined); }
      active.add(node);
      const transparent = context.ast.is.IsParenthesizedExpression(node) || context.ast.is.IsSatisfiesExpression(node) ||
        context.ast.is.IsNonNullExpression(node);
      const negated = context.ast.is.IsPrefixUnaryExpression(node) && context.ast.operatorKindName(node) === "KindExclamationToken";
      if (transparent || negated) {
        const operand = negated ? context.ast.as.AsPrefixUnaryExpression(node)?.Operand : Node_Expression(context.ast, node);
        if (operand === undefined) { active.delete(node); results.push(undefined); continue; }
        pending.push({ ...current, combine: "transparent" }, { expression: operand, assumed: negated ? !current.assumed : current.assumed });
        continue;
      }
      const operator = context.ast.operatorKindName(node);
      if (context.ast.is.IsBinaryExpression(node) && (operator === "KindAmpersandAmpersandToken" || operator === "KindBarBarToken")) {
        const binary = context.ast.as.AsBinaryExpression(node);
        if (binary?.Left !== undefined && binary.Right !== undefined) {
          pending.push({ ...current, combine: (operator === "KindAmpersandAmpersandToken") === current.assumed ? "intersection" : "union" },
            { expression: binary.Right, assumed: current.assumed }, { expression: binary.Left, assumed: current.assumed });
          continue;
        }
        active.delete(node);
        results.push(undefined);
        continue;
      }
      const guard = selectGuard(node);
      if (guard.kind !== "resolved") return guard;
      if (guard.value === undefined || !context.ast.is.IsIdentifier(guard.value.sourceOperand) ||
        context.navigation.sourceReferenceFor(guard.value.sourceOperand)?.declaration !== binding.declaration) results.push(undefined);
      else {
        const retained: Member[] = [];
        for (const member of values) {
          const result = testMember(member, guard.value.predicate);
          if (result.kind !== "resolved") return result;
          if (result.value === undefined || result.value === current.assumed) retained.push(member);
        }
        results.push(Object.freeze(retained));
      }
      active.delete(node);
    }
    return resolved(results.length === 1 ? results[0] : undefined);
  };
  for (const condition of flow.conditions) {
    if (!enter(condition.expression)) return resolved(undefined);
    if (condition.assignments.some(assignment => context.navigation.declarationWrites(binding.declaration, assignment).length > 0)) continue;
    if (capturedWrites) {
      const preserved = sourceGuardPreservesBinding(context, condition.expression, reference, condition.assumed, enter);
      if (preserved.kind === "refused") return preserved;
      if (!preserved.value) continue;
    }
    const narrowed = selectCondition(condition.expression, condition.assumed, selected);
    if (narrowed.kind !== "resolved") return narrowed;
    if (invalid) return resolved(undefined);
    if (narrowed.value === undefined) continue;
    consulted = true;
    selected = narrowed.value;
  }
  return resolved(consulted ? Object.freeze([...selected]) : undefined);
}
