import type { Node, Type } from "@tsonic/tsts";
import { sourceBindingHasMutableExposure } from "../source-navigation/binding-mutation-exposure.js";
import { Node_Expression } from "../source-navigation/ast.js";
import { sourceGuardPreservesBinding } from "./guard-preservation.js";
import type { SourceNativeGuard, SourceValueFlowQueryContext } from "./value-flow-model.js";
import { createSourceSyntaxDomain } from "../source-navigation/node-inventory.js";

export function selectSourceNativeGuardResult<Member, Predicate>(
  context: SourceValueFlowQueryContext,
  expression: Node,
  membersFor: (reference: Node) => readonly Member[] | undefined,
  selectGuard: (expression: Node) => SourceNativeGuard<Predicate> | undefined,
  testMember: (member: Member, predicate: Predicate) => boolean | undefined,
): boolean | undefined {
  let current = expression;
  let negated = false;
  const contains = createSourceSyntaxDomain(context.ast, expression);
  const visited = new Set<Node>();
  while (contains(current) && !visited.has(current)) {
    visited.add(current);
    const kind = context.ast.kindName(current);
    if (kind === "KindTrueKeyword" || kind === "KindFalseKeyword") return (kind === "KindTrueKeyword") !== negated;
    if (context.ast.is.IsParenthesizedExpression(current) || context.ast.is.IsSatisfiesExpression(current) ||
      context.ast.is.IsNonNullExpression(current)) {
      const inner = Node_Expression(context.ast, current);
      if (inner === undefined) return undefined;
      current = inner;
      continue;
    }
    if (context.ast.is.IsPrefixUnaryExpression(current) &&
      context.ast.operatorKindName(current) === "KindExclamationToken") {
      const operand = context.ast.as.AsPrefixUnaryExpression(current)?.Operand;
      if (operand === undefined) return undefined;
      current = operand;
      negated = !negated;
      continue;
    }
    const guard = selectGuard(current);
    if (guard === undefined) return undefined;
    const members = membersFor(guard.sourceOperand);
    if (members === undefined || members.length === 0) return undefined;
    const selected = selectSourceGuardedValueMembers(context, guard.sourceOperand, members, selectGuard, testMember) ?? members;
    if (selected.length === 0) return undefined;
    const results = selected.map(member => testMember(member, guard.predicate));
    const result = results.every(value => value === true) ? true
      : results.every(value => value === false) ? false : undefined;
    return result === undefined ? undefined : result !== negated;
  }
  return undefined;
}

export function selectSourceGuardedTypeMembers<Predicate>(
  context: SourceValueFlowQueryContext,
  reference: Node,
  sourceType: Type,
  selectGuard: (expression: Node) => SourceNativeGuard<Predicate> | undefined,
  testType: (type: Type, predicate: Predicate) => boolean | undefined,
): readonly Type[] | undefined {
  const types = context.semanticsFor(reference).types;
  if (!types.isUnion(sourceType)) return undefined;
  const members = types.unionOrIntersectionTypes(sourceType);
  let cyclic = false;
  const test = (type: Type, predicate: Predicate): boolean | undefined => {
    const active = new Set<Type>();
    const results: (boolean | undefined)[] = [];
    const pending: { readonly type: Type; readonly children?: number }[] = [{ type }];
    while (pending.length > 0) {
      const current = pending.pop()!;
      if (current.children !== undefined) {
        const parts = results.splice(results.length - current.children);
        active.delete(current.type);
        results.push(types.isIntersection(current.type)
          ? parts.includes(false) ? false : parts.every(value => value === true) ? true : undefined
          : parts.every(value => value === true) ? true : parts.every(value => value === false) ? false : undefined);
      } else if (active.has(current.type)) {
        cyclic = true;
        return undefined;
      } else if (!types.isUnion(current.type) && !types.isIntersection(current.type)) {
        results.push(testType(current.type, predicate));
      } else {
        const parts = types.unionOrIntersectionTypes(current.type);
        if (parts.length === 0) return undefined;
        active.add(current.type);
        pending.push({ type: current.type, children: parts.length });
        for (const part of parts) pending.push({ type: part });
      }
    }
    return results.length === 1 ? results[0] : undefined;
  };
  const selected = selectSourceGuardedValueMembers(context, reference, members, selectGuard,
    (member, predicate) => test(member, predicate));
  return cyclic ? undefined : selected;
}

export function selectSourceGuardedValueMembers<Member, Predicate>(
  context: SourceValueFlowQueryContext,
  reference: Node,
  members: readonly Member[],
  selectGuard: (expression: Node) => SourceNativeGuard<Predicate> | undefined,
  testMember: (member: Member, predicate: Predicate) => boolean | undefined,
): readonly Member[] | undefined {
  if (!context.ast.is.IsIdentifier(reference)) return undefined;
  const binding = context.navigation.referenceFor(reference);
  if (binding === undefined ||
    !context.ast.is.IsVariableDeclaration(binding.declaration) &&
    !context.ast.is.IsParameterDeclaration(binding.declaration) &&
    !context.ast.is.IsBindingElement(binding.declaration)) return undefined;
  const summary = context.navigation.declarationUseSummary(binding.declaration);
  if (summary.exported) return undefined;
  const capturedWrites = summary.uses.some(use => use.captured && use.role === "write" && !use.throughMember);
  const enter = createSourceSyntaxDomain(context.ast, reference);
  if (sourceBindingHasMutableExposure(context, summary, enter)) return undefined;
  const flow = context.semanticsFor(reference).operations.flowConditions(reference);
  if (flow === undefined || flow.reference !== reference) return undefined;
  let selected = members;
  let consulted = false;
  let invalid = false;
  const selectCondition = (expression: Node, assumed: boolean, values: readonly Member[]): readonly Member[] | undefined => {
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
      if (!enter(node) || active.has(node)) { invalid = true; return undefined; }
      active.add(node);
      const transparent = context.ast.is.IsParenthesizedExpression(node) || context.ast.is.IsSatisfiesExpression(node) ||
        context.ast.is.IsNonNullExpression(node);
      const negated = context.ast.is.IsPrefixUnaryExpression(node) && context.ast.operatorKindName(node) === "KindExclamationToken";
      if (transparent || negated) {
        const operand = negated ? context.ast.as.AsPrefixUnaryExpression(node)?.Operand : Node_Expression(context.ast, node);
        if (operand === undefined) {
          active.delete(node);
          results.push(undefined);
          continue;
        }
        pending.push({ ...current, combine: "transparent" }, { expression: operand,
          assumed: negated ? !current.assumed : current.assumed });
        continue;
      }
      const operator = context.ast.operatorKindName(node);
      if (context.ast.is.IsBinaryExpression(node) &&
        (operator === "KindAmpersandAmpersandToken" || operator === "KindBarBarToken")) {
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
      results.push(guard === undefined || !context.ast.is.IsIdentifier(guard.sourceOperand) ||
        context.navigation.referenceFor(guard.sourceOperand)?.declaration !== binding.declaration ? undefined
        : values.filter(member => {
          const result = testMember(member, guard.predicate);
          return result === undefined || result === current.assumed;
        }));
      active.delete(node);
    }
    return results.length === 1 ? results[0] : undefined;
  };
  for (const condition of flow.conditions) {
    if (!enter(condition.expression)) return undefined;
    if (condition.assignments.some(assignment =>
      context.navigation.bindingWritesWithin(binding.symbol, assignment).length > 0)) continue;
    if (capturedWrites && !sourceGuardPreservesBinding(context, condition.expression, reference, condition.assumed, enter)) continue;
    const narrowed = selectCondition(condition.expression, condition.assumed, selected);
    if (invalid) return undefined;
    if (narrowed === undefined) continue;
    consulted = true;
    selected = narrowed;
  }
  return consulted ? Object.freeze([...selected]) : undefined;
}
