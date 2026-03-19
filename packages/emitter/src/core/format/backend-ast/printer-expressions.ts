/**
 * Backend AST Printer – Expressions
 *
 * Expression printing, pattern printing, and helpers that depend on
 * printExpression (attributes, parameters, interpolated strings, etc.).
 */

import type {
  CSharpExpressionAst,
  CSharpPatternAst,
  CSharpParameterAst,
  CSharpSwitchExpressionArmAst,
  CSharpInterpolatedStringPart,
  CSharpAttributeAst,
  CSharpLambdaParameterAst,
} from "./types.js";

import {
  escapeCSharpStringLiteral,
  escapeCSharpCharLiteral,
  escapeIdentifier,
  escapeQualifiedName,
  printType,
  printNumericLiteral,
  needsPrefixUnarySeparator,
  getOperatorPrecedence,
  getExpressionPrecedence,
  needsParensInBinary,
  expressionMayPrintColon,
} from "./printer-shared.js";

// NOTE: circular import with printer-statements.ts is intentional and safe.
// Both modules only reference each other's exports inside function bodies
// (not at module-load time), so ESM initialization completes before any
// cross-module call occurs.
import { printStatementFlatBlock } from "./printer-statements.js";

/**
 * Wrap expression text in parens if needed for the given context.
 */
const parenthesizeIfNeeded = (
  expr: CSharpExpressionAst,
  parentPrecedence: number,
  isRightOperand: boolean,
  indent: string
): string => {
  const text = printExpression(expr, indent);
  return needsParensInBinary(expr, parentPrecedence, isRightOperand)
    ? `(${text})`
    : text;
};

// ============================================================
// Expression Printer
// ============================================================

export const printExpression = (
  expr: CSharpExpressionAst,
  indent = ""
): string => {
  switch (expr.kind) {
    case "nullLiteralExpression":
      return "null";

    case "booleanLiteralExpression":
      return expr.value ? "true" : "false";

    case "stringLiteralExpression":
      return `"${escapeCSharpStringLiteral(expr.value)}"`;

    case "charLiteralExpression":
      return `'${escapeCSharpCharLiteral(expr.value)}'`;

    case "numericLiteralExpression":
      return printNumericLiteral(expr);

    case "identifierExpression":
      if (expr.identifier.includes(".") || expr.identifier.includes("::")) {
        throw new Error(
          `ICE: Simple identifierExpression '${expr.identifier}' contains qualification. Use qualifiedIdentifierExpression AST instead.`
        );
      }
      return escapeIdentifier(expr.identifier);

    case "qualifiedIdentifierExpression":
      return escapeQualifiedName(expr.name);

    case "typeReferenceExpression":
      return printType(expr.type);

    case "parenthesizedExpression":
      return `(${printExpression(expr.expression, indent)})`;

    case "memberAccessExpression":
      return `${printPrimaryExpression(expr.expression, indent)}.${escapeIdentifier(expr.memberName)}`;

    case "conditionalMemberAccessExpression":
      return `${printPrimaryExpression(expr.expression, indent)}?.${escapeIdentifier(expr.memberName)}`;

    case "elementAccessExpression": {
      const args = expr.arguments
        .map((arg) => printExpression(arg, indent))
        .join(", ");
      return `${printPrimaryExpression(expr.expression, indent)}[${args}]`;
    }

    case "conditionalElementAccessExpression": {
      const args = expr.arguments
        .map((arg) => printExpression(arg, indent))
        .join(", ");
      return `${printPrimaryExpression(expr.expression, indent)}?[${args}]`;
    }

    case "implicitElementAccessExpression": {
      const args = expr.arguments
        .map((arg) => printExpression(arg, indent))
        .join(", ");
      return `[${args}]`;
    }

    case "invocationExpression": {
      const callee = printPrimaryExpression(expr.expression, indent);
      const typeArgs =
        expr.typeArguments && expr.typeArguments.length > 0
          ? `<${expr.typeArguments.map(printType).join(", ")}>`
          : "";
      const args = expr.arguments
        .map((arg) => printExpression(arg, indent))
        .join(", ");
      return `${callee}${typeArgs}(${args})`;
    }

    case "objectCreationExpression": {
      const typeName = printType(expr.type);
      const args = expr.arguments
        .map((arg) => printExpression(arg, indent))
        .join(", ");
      const init =
        expr.initializer && expr.initializer.length > 0
          ? ` { ${expr.initializer.map((item) => printExpression(item, indent)).join(", ")} }`
          : "";
      // Omit () when using collection/object initializer with no constructor args
      // (C# allows `new List<T> { ... }` without parentheses)
      const argsSection =
        expr.initializer && expr.initializer.length > 0 && args.length === 0
          ? ""
          : `(${args})`;
      return `new ${typeName}${argsSection}${init}`;
    }

    case "arrayCreationExpression": {
      // varType element type → implicitly-typed new[] { ... }
      const isImplicit = expr.elementType.kind === "varType";
      const elemType = isImplicit ? "" : ` ${printType(expr.elementType)}`;
      if (expr.initializer && expr.initializer.length > 0) {
        const elems = expr.initializer
          .map((item) => printExpression(item, indent))
          .join(", ");
        if (expr.sizeExpression) {
          return `new${elemType}[${printExpression(expr.sizeExpression, indent)}] { ${elems} }`;
        }
        return `new${elemType}[] { ${elems} }`;
      }
      if (expr.sizeExpression) {
        return `new${elemType}[${printExpression(expr.sizeExpression, indent)}]`;
      }
      return `new${elemType}[0]`;
    }

    case "stackAllocArrayCreationExpression":
      return `stackalloc ${printType(expr.elementType)}[${printExpression(expr.sizeExpression, indent)}]`;

    case "assignmentExpression": {
      const left = printExpression(expr.left, indent);
      const right = printExpression(expr.right, indent);
      return `${left} ${expr.operatorToken} ${right}`;
    }

    case "binaryExpression": {
      const prec = getOperatorPrecedence(expr.operatorToken);
      const left = parenthesizeIfNeeded(expr.left, prec, false, indent);
      const right = parenthesizeIfNeeded(expr.right, prec, true, indent);
      return `${left} ${expr.operatorToken} ${right}`;
    }

    case "prefixUnaryExpression": {
      const operand = printUnaryOperand(expr.operand, true, indent);
      if (needsPrefixUnarySeparator(expr.operatorToken, expr.operand)) {
        return `${expr.operatorToken} ${operand}`;
      }
      return `${expr.operatorToken}${operand}`;
    }

    case "postfixUnaryExpression":
      return `${printUnaryOperand(expr.operand, false, indent)}${expr.operatorToken}`;

    case "conditionalExpression": {
      const cond = printExpression(expr.condition, indent);
      const whenTrue = printExpression(expr.whenTrue, indent);
      const whenFalse = printExpression(expr.whenFalse, indent);
      return `${cond} ? ${whenTrue} : ${whenFalse}`;
    }

    case "castExpression": {
      const typeName = printType(expr.type);
      const operand = printCastOperand(expr.expression, indent);
      return `(${typeName})${operand}`;
    }

    case "asExpression": {
      const inner = printExpression(expr.expression, indent);
      return `${inner} as ${printType(expr.type)}`;
    }

    case "isExpression": {
      const inner = printExpression(expr.expression, indent);
      const pattern = printPattern(expr.pattern);
      return `${inner} is ${pattern}`;
    }

    case "defaultExpression":
      return expr.type ? `default(${printType(expr.type)})` : "default";

    case "sizeOfExpression":
      return `sizeof(${printType(expr.type)})`;

    case "awaitExpression":
      return `await ${printUnaryOperand(expr.expression, true, indent)}`;

    case "lambdaExpression":
      return printLambdaExpression(expr, indent);

    case "interpolatedStringExpression":
      return printInterpolatedString(expr.parts, indent);

    case "throwExpression":
      return `throw ${printExpression(expr.expression, indent)}`;

    case "suppressNullableWarningExpression":
      return `${printPrimaryExpression(expr.expression, indent)}!`;

    case "typeofExpression":
      return `typeof(${printType(expr.type)})`;

    case "switchExpression":
      return printSwitchExpression(expr, indent);

    case "argumentModifierExpression":
      return `${expr.modifier} ${printExpression(expr.expression, indent)}`;

    case "tupleExpression": {
      const elems = expr.elements
        .map((element) => printExpression(element, indent))
        .join(", ");
      return `(${elems})`;
    }

    default: {
      const exhaustiveCheck: never = expr;
      throw new Error(
        `ICE: Unhandled expression AST kind: ${(exhaustiveCheck as CSharpExpressionAst).kind}`
      );
    }
  }
};

/**
 * Print an expression that appears in a "primary" position
 * (before `.member`, `[index]`, `(args)`, etc.).
 * Wraps in parens if needed.
 */
const printPrimaryExpression = (
  expr: CSharpExpressionAst,
  indent: string
): string => {
  const text = printExpression(expr, indent);
  const prec = getExpressionPrecedence(expr);
  // Primary position requires precedence >= 15 (postfix and primary)
  // or the expression is already a parenthesized/literal/identifier
  if (prec >= 15) return text;
  if (
    expr.kind === "parenthesizedExpression" ||
    expr.kind === "nullLiteralExpression" ||
    expr.kind === "booleanLiteralExpression" ||
    expr.kind === "stringLiteralExpression" ||
    expr.kind === "charLiteralExpression" ||
    expr.kind === "numericLiteralExpression" ||
    expr.kind === "identifierExpression" ||
    expr.kind === "qualifiedIdentifierExpression" ||
    expr.kind === "defaultExpression" ||
    expr.kind === "sizeOfExpression" ||
    expr.kind === "typeofExpression" ||
    expr.kind === "interpolatedStringExpression" ||
    expr.kind === "objectCreationExpression" ||
    expr.kind === "arrayCreationExpression"
  ) {
    return text;
  }
  return `(${text})`;
};

/**
 * Print an expression that appears as a unary operand.
 */
const printUnaryOperand = (
  expr: CSharpExpressionAst,
  isPrefix: boolean,
  indent: string
): string => {
  const text = printExpression(expr, indent);
  const prec = getExpressionPrecedence(expr);
  if (isPrefix) {
    // Prefix unary needs operand to be at least unary precedence
    return prec >= 14 ? text : `(${text})`;
  }
  // Postfix unary needs primary expression
  return prec >= 15 ? text : `(${text})`;
};

/**
 * Print an expression that appears as a cast operand.
 * Special rules: unary minus after cast needs parens to avoid ambiguity.
 */
const printCastOperand = (
  expr: CSharpExpressionAst,
  indent: string
): string => {
  const text = printExpression(expr, indent);

  // Cast operand needs at least unary precedence
  if (getExpressionPrecedence(expr) < 14) {
    return `(${text})`;
  }

  // Special case: negative literals after cast need parens
  // (int)-1 is ambiguous: could be cast or subtraction
  if (expr.kind === "prefixUnaryExpression" && expr.operatorToken === "-") {
    return `(${text})`;
  }

  return text;
};

const printLambdaExpression = (
  expr: Extract<CSharpExpressionAst, { kind: "lambdaExpression" }>,
  indent: string
): string => {
  const asyncPrefix = expr.isAsync ? "async " : "";
  const params = printLambdaParameters(expr.parameters);

  if (expr.body.kind === "blockStatement") {
    const bodyIndent = `${indent}    `;
    return `${asyncPrefix}${params} =>\n${printStatementFlatBlock(expr.body, bodyIndent)}`;
  }

  return `${asyncPrefix}${params} => ${printExpression(expr.body, indent)}`;
};

const printLambdaParameters = (
  params: readonly CSharpLambdaParameterAst[]
): string => {
  const sole = params.length === 1 ? params[0] : undefined;
  if (sole && !sole.type && !sole.modifier) {
    return escapeIdentifier(sole.name);
  }
  const parts = params.map((p) => {
    const mod = p.modifier ? `${p.modifier} ` : "";
    return p.type
      ? `${mod}${printType(p.type)} ${escapeIdentifier(p.name)}`
      : `${mod}${escapeIdentifier(p.name)}`;
  });
  return `(${parts.join(", ")})`;
};

const printInterpolatedString = (
  parts: readonly CSharpInterpolatedStringPart[],
  indent: string
): string => {
  const inner = parts
    .map((part) => {
      if (part.kind === "text") return part.text;
      const exprText = printExpression(part.expression, indent);
      const safeText = expressionMayPrintColon(part.expression)
        ? `(${exprText})`
        : exprText;
      return part.formatClause
        ? `{${safeText}:${part.formatClause}}`
        : `{${safeText}}`;
    })
    .join("");
  return `$"${inner}"`;
};

const printSwitchExpression = (
  expr: Extract<CSharpExpressionAst, { kind: "switchExpression" }>,
  indent: string
): string => {
  const gov = printExpression(expr.governingExpression, indent);
  const arms = expr.arms
    .map((arm) => printSwitchExpressionArm(arm, indent))
    .join(", ");
  return `${gov} switch { ${arms} }`;
};

const printSwitchExpressionArm = (
  arm: CSharpSwitchExpressionArmAst,
  indent: string
): string => {
  const pattern = printPattern(arm.pattern);
  const whenClause = arm.whenClause
    ? ` when ${printExpression(arm.whenClause, indent)}`
    : "";
  const result = printExpression(arm.expression, indent);
  return `${pattern}${whenClause} => ${result}`;
};

// ============================================================
// Pattern Printer
// ============================================================

export const printPattern = (pattern: CSharpPatternAst): string => {
  switch (pattern.kind) {
    case "typePattern":
      return printType(pattern.type);

    case "declarationPattern":
      return `${printType(pattern.type)} ${escapeIdentifier(pattern.designation)}`;

    case "varPattern":
      return `var ${escapeIdentifier(pattern.designation)}`;

    case "constantPattern":
      return printExpression(pattern.expression);

    case "discardPattern":
      return "_";

    case "negatedPattern":
      return `not ${printPattern(pattern.pattern)}`;

    default: {
      const exhaustiveCheck: never = pattern;
      throw new Error(
        `ICE: Unhandled pattern AST kind: ${(exhaustiveCheck as CSharpPatternAst).kind}`
      );
    }
  }
};

// ============================================================
// Attribute & Parameter Printers
// ============================================================

export const printAttributes = (
  attrs: readonly CSharpAttributeAst[],
  indent: string
): string => {
  if (attrs.length === 0) return "";
  return attrs
    .map((a) => {
      const targetPrefix = a.target ? `${a.target}: ` : "";
      const args =
        a.arguments && a.arguments.length > 0
          ? `(${a.arguments.map((arg) => printExpression(arg, indent)).join(", ")})`
          : "";
      return `${indent}[${targetPrefix}${printType(a.type)}${args}]\n`;
    })
    .join("");
};

export const printParameter = (param: CSharpParameterAst): string => {
  const attrPrefix =
    param.attributes && param.attributes.length > 0
      ? param.attributes
          .map((a) => {
            const targetPrefix = a.target ? `${a.target}: ` : "";
            const args =
              a.arguments && a.arguments.length > 0
                ? `(${a.arguments.map((arg) => printExpression(arg)).join(", ")})`
                : "";
            return `[${targetPrefix}${printType(a.type)}${args}]`;
          })
          .join("") + " "
      : "";
  const mods =
    param.modifiers && param.modifiers.length > 0
      ? `${param.modifiers.join(" ")} `
      : "";
  const typeName = printType(param.type);
  const name = escapeIdentifier(param.name);
  const defaultVal = param.defaultValue
    ? ` = ${printExpression(param.defaultValue)}`
    : "";
  return `${attrPrefix}${mods}${typeName} ${name}${defaultVal}`;
};
