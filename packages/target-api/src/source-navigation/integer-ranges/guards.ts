import type { Node } from "@tsonic/tsts";
import type { SourceLiteralDomain } from "../../source-model/literals/domain.js";
import { sourceBooleanLiteralDisposition } from "../../source-model/literals/domain.js";
import type { SourceProductionResult } from "../../source-semantics/descriptor-contracts.js";
import { sourceStatementAlwaysExits } from "../../source-semantics/native-control-flow.js";
import type { SourceGuardContext } from "../../source-semantics/value-flow-model.js";
import { Node_Expression } from "../ast.js";
import { sourceBindingHasMutableExposure } from "../binding-mutation-exposure.js";
import { sourceIntegerScalar } from "./domain.js";

export type SourceIntegerGuardContext = Pick<SourceGuardContext, "ast" | "navigation" | "protocols" | "syntaxDomain" | "enclosing">;

export function sourceIntegerIsNonnegative(input: SourceIntegerGuardContext, expression: Node): SourceProductionResult<boolean> {
  const { ast, navigation } = input;
  if (!navigation.includes(expression)) throw new Error("Integer guard proofs require the exact original Source occurrence.");
  let incomplete: Exclude<SourceProductionResult<SourceLiteralDomain>, { readonly kind: "resolved" }> | undefined;
  const complete = (value: boolean): SourceProductionResult<boolean> => incomplete ?? Object.freeze({ kind: "resolved", value });
  let remaining = 2_048;
  const enter = (): boolean => incomplete === undefined && --remaining >= 0;
  const execution = input.enclosing(expression, "execution", enter);
  const unwrap = (node: Node | undefined): Node | undefined => {
    while (node !== undefined && transparentKinds.has(ast.kindName(node))) {
      if (!enter()) return undefined;
      node = Node_Expression(ast, node);
    }
    return node;
  };
  const reference = unwrap(expression);
  const declaration = reference === undefined || !ast.is.IsIdentifier(reference)
    ? undefined : navigation.sourceReferenceFor(reference)?.declaration;
  if (declaration === undefined || !ast.is.IsVariableDeclaration(declaration) &&
    !ast.is.IsParameterDeclaration(declaration)) return complete(false);
  const summary = navigation.declarationUseSummary(declaration);
  if (summary.bindingWritten || summary.captured || summary.exported || summary.memberWritten) return complete(false);
  const exposure = sourceBindingHasMutableExposure(input, summary, enter);
  if (exposure.kind === "refused") return exposure;
  if (exposure.value) return complete(false);
  const selectsBinding = (node: Node | undefined): boolean => {
    const selected = unwrap(node);
    return selected !== undefined && ast.is.IsIdentifier(selected) &&
      navigation.sourceReferenceFor(selected)?.declaration === declaration;
  };
  const integerLiteral = (node: Node | undefined): bigint | undefined => {
    node = unwrap(node);
    if (node === undefined || !enter()) return undefined;
    const domain = input.syntaxDomain(node);
    if (domain.kind !== "resolved") { incomplete = domain; return undefined; }
    if (domain.value.kind !== "finite" || domain.value.values.length !== 1) return undefined;
    const unit = domain.value.values[0]!;
    if (unit.kind === "number" && (unit.value.kind === "authored" && unit.value.token.coefficient === 0n ||
      unit.value.kind === "checked-float64" && unit.value.value === 0)) return 0n;
    return sourceIntegerScalar(unit);
  };
  const proves = (condition: Node | undefined, truth: boolean, depth = 0): boolean => {
    condition = unwrap(condition);
    if (condition === undefined || depth > 64 || !enter()) return false;
    if (ast.is.IsPrefixUnaryExpression(condition) && ast.operatorKindName(condition) === "KindExclamationToken") {
      return proves(ast.as.AsPrefixUnaryExpression(condition)?.Operand, !truth, depth + 1);
    }
    if (!ast.is.IsBinaryExpression(condition)) return false;
    const binary = ast.as.AsBinaryExpression(condition);
    let operator = ast.operatorKindName(condition);
    if (operator === "KindAmpersandAmpersandToken" && truth || operator === "KindBarBarToken" && !truth) {
      return proves(binary?.Left, truth, depth + 1) || proves(binary?.Right, truth, depth + 1);
    }
    let bound = integerLiteral(binary?.Right);
    if (!selectsBinding(binary?.Left)) {
      if (!selectsBinding(binary?.Right)) return false;
      bound = integerLiteral(binary?.Left);
      operator = reversedOperators.get(operator ?? "") ?? operator;
    }
    if (bound === undefined) return false;
    if (!truth) operator = negatedOperators.get(operator ?? "");
    return operator === "KindGreaterThanEqualsToken" && bound >= 0n ||
      operator === "KindGreaterThanToken" && bound >= -1n ||
      (operator === "KindEqualsEqualsToken" || operator === "KindEqualsEqualsEqualsToken") && bound >= 0n;
  };
  const exits = (node: Node | undefined): boolean => {
    const selected = sourceStatementAlwaysExits(ast, node, expression => {
      const domain = input.syntaxDomain(expression);
      if (domain.kind !== "resolved") return domain;
      const disposition = sourceBooleanLiteralDisposition(domain.value);
      return Object.freeze({ kind: "resolved", value: disposition === "dynamic" ? undefined : disposition === "true" });
    }, enter);
    if (selected.kind !== "resolved") { incomplete = selected; return false; }
    return selected.value;
  };
  for (let current = expression, parent = ast.parent(current); parent !== undefined;
    current = parent, parent = ast.parent(parent)) {
    if (!enter() || parent === execution) return complete(false);
    if (ast.is.IsIfStatement(parent)) {
      const branch = ast.as.AsIfStatement(parent);
      if (current === branch?.ThenStatement && proves(branch.Expression, true) ||
        current === branch?.ElseStatement && proves(branch.Expression, false)) return complete(remaining >= 0);
    } else if (ast.is.IsConditionalExpression(parent)) {
      const branch = ast.as.AsConditionalExpression(parent);
      if (current === branch?.WhenTrue && proves(branch.Condition, true) ||
        current === branch?.WhenFalse && proves(branch.Condition, false)) return complete(remaining >= 0);
    } else if (ast.is.IsBinaryExpression(parent)) {
      const binary = ast.as.AsBinaryExpression(parent);
      const operator = ast.operatorKindName(parent);
      if (current === binary?.Right && (operator === "KindAmpersandAmpersandToken" && proves(binary.Left, true) ||
        operator === "KindBarBarToken" && proves(binary.Left, false))) return complete(remaining >= 0);
    } else if (ast.is.IsBlock(parent)) {
      for (const statement of ast.statements(parent)) {
        if (!enter()) return complete(false);
        if (statement === current) break;
        if (statement !== undefined && ast.is.IsIfStatement(statement)) {
          const branch = ast.as.AsIfStatement(statement);
          if (exits(branch?.ThenStatement) && proves(branch?.Expression, false) ||
            exits(branch?.ElseStatement) && proves(branch?.Expression, true)) return complete(remaining >= 0);
        }
      }
    }
  }
  return complete(false);
}

const transparentKinds = new Set(["KindParenthesizedExpression", "KindSatisfiesExpression", "KindNonNullExpression"]);
const reversedOperators = new Map([
  ["KindGreaterThanToken", "KindLessThanToken"], ["KindGreaterThanEqualsToken", "KindLessThanEqualsToken"],
  ["KindLessThanToken", "KindGreaterThanToken"], ["KindLessThanEqualsToken", "KindGreaterThanEqualsToken"],
]);
const negatedOperators = new Map([
  ["KindGreaterThanToken", "KindLessThanEqualsToken"], ["KindGreaterThanEqualsToken", "KindLessThanToken"],
  ["KindLessThanToken", "KindGreaterThanEqualsToken"], ["KindLessThanEqualsToken", "KindGreaterThanToken"],
  ["KindExclamationEqualsToken", "KindEqualsEqualsToken"],
  ["KindExclamationEqualsEqualsToken", "KindEqualsEqualsEqualsToken"],
]);
