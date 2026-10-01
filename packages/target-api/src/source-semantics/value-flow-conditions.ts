import type { AstReader, Node, ReadonlySourceFactResolver } from "@tsonic/tsts";
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
