import type {
  LoweringStatementPlan,
  LoweringVariablePlan,
} from "@tsonic/frontend";
import type { RenderContext } from "../types.js";
import { sanitizeIdentifier } from "./names.js";
import {
  isCompileTimeOnlyExpression,
  renderConditionExpression,
  renderExpression,
  renderFunctionExpressionType,
} from "./expressions.js";
import { renderCSharpType } from "./types.js";

const indent = (text: string, spaces: number): string => {
  const prefix = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line) => (line.length === 0 ? line : `${prefix}${line}`))
    .join("\n");
};

const unsupportedStatement = (
  context: RenderContext,
  plan: LoweringStatementPlan
): string => {
  context.reportUnsupported("statement", plan.sourceKindName, plan.sourceText);
  return "";
};

export const renderVariableFragment = (
  declaration: LoweringVariablePlan,
  context: RenderContext
): string => {
  const functionExpressionType = renderFunctionExpressionType(declaration.initializer);
  const declaredType = declaration.typeText
    ? renderCSharpType(declaration.typeText)
    : undefined;
  const type =
    functionExpressionType && (!declaredType || declaredType === "object?")
      ? functionExpressionType
      : declaredType ?? "var";
  const initializer = declaration.initializer
    ? ` = ${renderExpression(declaration.initializer, context)}`
    : "";
  return `${type} ${sanitizeIdentifier(declaration.name)}${initializer}`;
};

export const renderStaticField = (
  declaration: LoweringVariablePlan,
  context: RenderContext
): string => {
  const functionExpressionType = renderFunctionExpressionType(declaration.initializer);
  const declaredType = declaration.typeText
    ? renderCSharpType(declaration.typeText)
    : undefined;
  const type =
    functionExpressionType && (!declaredType || declaredType === "object?")
      ? functionExpressionType
      : declaredType ?? "object?";
  const initializer = declaration.initializer
    ? ` = ${renderExpression(declaration.initializer, context)}`
    : "";
  return `public static ${type} ${sanitizeIdentifier(declaration.name)}${initializer};`;
};

const renderBlockLike = (
  statements: readonly LoweringStatementPlan[],
  context: RenderContext
): string =>
  [
    "{",
    ...statements
      .map((statement) => renderStatement(statement, context))
      .filter((line) => line.length > 0)
      .map((line) => indent(line, 4)),
    "}",
  ].join("\n");

const endsControlFlow = (statement: LoweringStatementPlan | undefined): boolean => {
  if (!statement) return false;
  switch (statement.statementKind) {
    case "return":
    case "throw":
    case "break":
    case "continue":
      return true;
    case "block":
      return endsControlFlow(statement.statements.at(-1));
    default:
      return false;
  }
};

const renderSwitch = (
  plan: LoweringStatementPlan,
  context: RenderContext
): string => {
  const lines = [`switch (${renderExpression(plan.expression, context)})`, "{"];
  for (const switchCase of plan.cases) {
    lines.push(
      switchCase.isDefault
        ? "    default:"
        : `    case ${renderExpression(switchCase.expression, context)}:`
    );
    for (const statement of switchCase.statements) {
      lines.push(indent(renderStatement(statement, context), 8));
    }
    if (
      switchCase.statements.length > 0 &&
      !endsControlFlow(switchCase.statements.at(-1))
    ) {
      context.reportUnsupported(
        "switch fallthrough",
        plan.sourceKindName,
        plan.sourceText
      );
    }
  }
  lines.push("}");
  return lines.join("\n");
};

export const renderStatement = (
  plan: LoweringStatementPlan | undefined,
  context: RenderContext
): string => {
  if (!plan) return "";

  switch (plan.statementKind) {
    case "block":
      return renderBlockLike(plan.statements, context);
    case "return":
      return plan.expression
        ? `return ${renderExpression(plan.expression, context)};`
        : "return;";
    case "expression":
      if (isCompileTimeOnlyExpression(plan.expression)) {
        return "";
      }
      if (plan.expression?.expressionKind === "yield") {
        if (plan.expression.operatorText === "*") {
          context.reportUnsupported(
            "yield delegation",
            plan.expression.sourceKindName,
            plan.expression.sourceText
          );
          return "";
        }
        return `yield return ${renderExpression(plan.expression.expression, context)};`;
      }
      return `${renderExpression(plan.expression, context)};`;
    case "variable":
      return plan.declarations
        .map((declaration) => `${renderVariableFragment(declaration, context)};`)
        .join("\n");
    case "if": {
      const thenBody = renderStatement(plan.thenStatement, context);
      const elseBody = plan.elseStatement
        ? `\nelse ${renderStatement(plan.elseStatement, context)}`
        : "";
      return `if (${renderConditionExpression(plan.condition, context)}) ${thenBody}${elseBody}`;
    }
    case "while":
      return `while (${renderConditionExpression(plan.condition, context)}) ${renderStatement(plan.body, context)}`;
    case "for": {
      const initializer =
        plan.declarations.length > 0
          ? plan.declarations
              .map((declaration) => renderVariableFragment(declaration, context))
              .join(", ")
          : plan.expression
            ? renderExpression(plan.expression, context)
            : "";
      const condition = plan.condition
        ? renderConditionExpression(plan.condition, context)
        : "";
      const incrementor = plan.incrementor
        ? renderExpression(plan.incrementor, context)
        : "";
      return `for (${initializer}; ${condition}; ${incrementor}) ${renderStatement(plan.body, context)}`;
    }
    case "for-of": {
      if (plan.declarations.length !== 1 || plan.expression) {
        return unsupportedStatement(context, plan);
      }
      const declaration = plan.declarations[0];
      if (!declaration) return unsupportedStatement(context, plan);
      const type = declaration.typeText
        ? renderCSharpType(declaration.typeText)
        : "var";
      return `foreach (${type} ${sanitizeIdentifier(declaration.name)} in ${renderExpression(plan.iterable, context)}) ${renderStatement(plan.body, context)}`;
    }
    case "for-in":
      return unsupportedStatement(context, plan);
    case "break":
      return "break;";
    case "continue":
      return "continue;";
    case "switch":
      return renderSwitch(plan, context);
    case "try": {
      const catchBlock = plan.catchBlock
        ? `\ncatch${plan.catchVariable ? ` (Exception ${sanitizeIdentifier(plan.catchVariable.name)})` : ""} ${renderStatement(plan.catchBlock, context)}`
        : "";
      const finallyBlock = plan.finallyBlock
        ? `\nfinally ${renderStatement(plan.finallyBlock, context)}`
        : "";
      return `try ${renderStatement(plan.tryBlock, context)}${catchBlock}${finallyBlock}`;
    }
    case "throw":
      return `throw ${renderExpression(plan.expression, context)};`;
    case "empty":
    case "declaration":
      return "";
    case "unsupported":
      return unsupportedStatement(context, plan);
  }
};

export const renderFunctionBody = (
  body: LoweringStatementPlan | undefined,
  context: RenderContext
): string => {
  if (!body) return "{\n}";
  if (body.statementKind === "block") return renderStatement(body, context);
  return renderBlockLike([body], context);
};

export const renderTopLevelBody = (
  statements: readonly LoweringStatementPlan[],
  context: RenderContext
): string =>
  renderBlockLike(
    statements.filter((statement) => statement.statementKind !== "declaration"),
    context
  );
