import type { AstReader, Node, ReadonlySourceFactResolver, Type } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "../source-navigation/types.js";
import { sourceBindingHasMutableExposure } from "../source-navigation/binding-mutation-exposure.js";
import { Node_Expression } from "../source-navigation/ast.js";
import type { SourceFileSemantics } from "./types.js";

export interface SourceValueFlowQueryContext {
  readonly ast: AstReader;
  readonly navigation: SourceProgramNavigation;
  readonly sourceFacts?: ReadonlySourceFactResolver;
  semanticsFor(node: Node): SourceFileSemantics;
}

export interface SourceNativeGuard<Predicate> {
  readonly sourceOperand: Node;
  readonly predicate: Predicate;
}

export function selectSourceNativeGuardResult<Member, Predicate>(
  context: SourceValueFlowQueryContext,
  expression: Node,
  membersFor: (reference: Node) => readonly Member[] | undefined,
  selectGuard: (expression: Node) => SourceNativeGuard<Predicate> | undefined,
  testMember: (member: Member, predicate: Predicate) => boolean | undefined,
): boolean | undefined {
  let current = expression;
  let negated = false;
  for (let remaining = 2_048; remaining > 0; remaining -= 1) {
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
    if (guard === undefined || !context.ast.is.IsIdentifier(guard.sourceOperand)) return undefined;
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
  let remaining = 2_048;
  let cyclic = false;
  const test = (type: Type, predicate: Predicate): boolean | undefined => {
    const active = new Set<Type>();
    const results: (boolean | undefined)[] = [];
    const pending: { readonly type: Type; readonly children?: number }[] = [{ type }];
    while (pending.length > 0) {
      if (--remaining < 0) return undefined;
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
        if (parts.length === 0 || pending.length + parts.length + 1 > remaining) {
          remaining = -1;
          return undefined;
        }
        active.add(current.type);
        pending.push({ type: current.type, children: parts.length });
        for (const part of parts) pending.push({ type: part });
      }
    }
    return results.length === 1 ? results[0] : undefined;
  };
  const selected = selectSourceGuardedValueMembers(context, reference, members, selectGuard,
    (member, predicate) => test(member, predicate));
  return remaining >= 0 && !cyclic ? selected : undefined;
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
  if (summary.exported || summary.uses.some(use => use.captured && use.role === "write" && !use.throughMember)) return undefined;
  let remaining = 2_048;
  const enter = (): boolean => --remaining >= 0;
  if (sourceBindingHasMutableExposure(context, summary, enter)) return undefined;
  const flow = context.semanticsFor(reference).operations.flowConditions(reference);
  if (flow === undefined || flow.reference !== reference) return undefined;
  let selected = members;
  let consulted = false;
  for (const condition of flow.conditions) {
    if (!enter()) return undefined;
    if (condition.assignments.some(assignment =>
      context.navigation.bindingWritesWithin(binding.symbol, assignment).length > 0)) continue;
    let expression = condition.expression;
    let assumed = condition.assumed;
    for (;;) {
      if (!enter()) return undefined;
      if (context.ast.is.IsParenthesizedExpression(expression) || context.ast.is.IsSatisfiesExpression(expression) ||
        context.ast.is.IsNonNullExpression(expression)) {
        const inner = Node_Expression(context.ast, expression);
        if (inner === undefined) return undefined;
        expression = inner;
      } else if (context.ast.is.IsPrefixUnaryExpression(expression) &&
        context.ast.operatorKindName(expression) === "KindExclamationToken") {
        const operand = context.ast.as.AsPrefixUnaryExpression(expression)?.Operand;
        if (operand === undefined) return undefined;
        expression = operand;
        assumed = !assumed;
      } else break;
    }
    const guard = selectGuard(expression);
    if (guard === undefined || !context.ast.is.IsIdentifier(guard.sourceOperand) ||
      context.navigation.referenceFor(guard.sourceOperand)?.declaration !== binding.declaration) continue;
    consulted = true;
    selected = selected.filter(member => {
      const result = testMember(member, guard.predicate);
      return result === undefined || result === assumed;
    });
  }
  return consulted ? Object.freeze([...selected]) : undefined;
}
