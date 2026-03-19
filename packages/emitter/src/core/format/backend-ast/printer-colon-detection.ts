/**
 * Backend AST Printer – Colon Detection
 *
 * Utilities for detecting whether a type, pattern, or expression AST
 * node may emit a colon (via alias qualifiers like `global::`) when
 * printed. Used by the ternary expression printer to decide whether
 * parenthesization is needed to avoid ambiguity with `?:`.
 */

import type {
  CSharpTypeAst,
  CSharpExpressionAst,
  CSharpPatternAst,
  CSharpQualifiedNameAst,
} from "./types.js";

export const nameMayPrintColon = (name: CSharpQualifiedNameAst): boolean =>
  name.aliasQualifier !== undefined;

export const typeMayPrintColon = (type: CSharpTypeAst): boolean => {
  switch (type.kind) {
    case "predefinedType":
    case "varType":
      return false;
    case "identifierType":
      return type.typeArguments?.some(typeMayPrintColon) === true;
    case "qualifiedIdentifierType":
      return (
        nameMayPrintColon(type.name) ||
        type.typeArguments?.some(typeMayPrintColon) === true
      );
    case "nullableType":
      return typeMayPrintColon(type.underlyingType);
    case "arrayType":
      return typeMayPrintColon(type.elementType);
    case "pointerType":
      return typeMayPrintColon(type.elementType);
    case "tupleType":
      return type.elements.some((element) => typeMayPrintColon(element.type));
    default: {
      const exhaustive: never = type;
      throw new Error(
        `ICE: Unhandled type AST kind '${(exhaustive as CSharpTypeAst).kind}' in typeMayPrintColon`
      );
    }
  }
};

export const patternMayPrintColon = (pattern: CSharpPatternAst): boolean => {
  switch (pattern.kind) {
    case "typePattern":
    case "declarationPattern":
      return typeMayPrintColon(pattern.type);
    case "varPattern":
    case "discardPattern":
      return false;
    case "constantPattern":
      return expressionMayPrintColon(pattern.expression);
    case "negatedPattern":
      return patternMayPrintColon(pattern.pattern);
    default: {
      const exhaustive: never = pattern;
      throw new Error(
        `ICE: Unhandled pattern AST kind '${(exhaustive as CSharpPatternAst).kind}' in patternMayPrintColon`
      );
    }
  }
};

export const expressionMayPrintColon = (expr: CSharpExpressionAst): boolean => {
  switch (expr.kind) {
    case "conditionalExpression":
      return true;
    case "identifierExpression":
      return false;
    case "qualifiedIdentifierExpression":
      return nameMayPrintColon(expr.name);
    case "typeReferenceExpression":
      return typeMayPrintColon(expr.type);
    case "parenthesizedExpression":
    case "awaitExpression":
    case "throwExpression":
    case "suppressNullableWarningExpression":
    case "argumentModifierExpression":
      return expressionMayPrintColon(expr.expression);
    case "prefixUnaryExpression":
    case "postfixUnaryExpression":
      return expressionMayPrintColon(expr.operand);
    case "memberAccessExpression":
    case "conditionalMemberAccessExpression":
      return expressionMayPrintColon(expr.expression);
    case "elementAccessExpression":
    case "conditionalElementAccessExpression":
      return (
        expressionMayPrintColon(expr.expression) ||
        expr.arguments.some(expressionMayPrintColon)
      );
    case "implicitElementAccessExpression":
      return expr.arguments.some(expressionMayPrintColon);
    case "invocationExpression":
      return (
        expressionMayPrintColon(expr.expression) ||
        expr.arguments.some(expressionMayPrintColon) ||
        expr.typeArguments?.some(typeMayPrintColon) === true
      );
    case "objectCreationExpression":
      return (
        typeMayPrintColon(expr.type) ||
        expr.arguments.some(expressionMayPrintColon) ||
        expr.initializer?.some(expressionMayPrintColon) === true
      );
    case "arrayCreationExpression":
      return (
        typeMayPrintColon(expr.elementType) ||
        (expr.sizeExpression
          ? expressionMayPrintColon(expr.sizeExpression)
          : false) ||
        expr.initializer?.some(expressionMayPrintColon) === true
      );
    case "stackAllocArrayCreationExpression":
      return (
        typeMayPrintColon(expr.elementType) ||
        expressionMayPrintColon(expr.sizeExpression)
      );
    case "assignmentExpression":
    case "binaryExpression":
      return (
        expressionMayPrintColon(expr.left) ||
        expressionMayPrintColon(expr.right)
      );
    case "castExpression":
      return (
        typeMayPrintColon(expr.type) || expressionMayPrintColon(expr.expression)
      );
    case "asExpression":
      return (
        typeMayPrintColon(expr.type) || expressionMayPrintColon(expr.expression)
      );
    case "isExpression":
      return (
        expressionMayPrintColon(expr.expression) ||
        patternMayPrintColon(expr.pattern)
      );
    case "defaultExpression":
      return expr.type ? typeMayPrintColon(expr.type) : false;
    case "sizeOfExpression":
    case "typeofExpression":
      return typeMayPrintColon(expr.type);
    case "lambdaExpression":
      return expr.parameters.some((p) =>
        p.type ? typeMayPrintColon(p.type) : false
      );
    case "interpolatedStringExpression":
      return expr.parts.some(
        (part) =>
          part.kind === "interpolation" &&
          expressionMayPrintColon(part.expression)
      );
    case "switchExpression":
      return (
        expressionMayPrintColon(expr.governingExpression) ||
        expr.arms.some(
          (arm) =>
            patternMayPrintColon(arm.pattern) ||
            (arm.whenClause
              ? expressionMayPrintColon(arm.whenClause)
              : false) ||
            expressionMayPrintColon(arm.expression)
        )
      );
    case "tupleExpression":
      return expr.elements.some(expressionMayPrintColon);
    case "nullLiteralExpression":
    case "booleanLiteralExpression":
    case "stringLiteralExpression":
    case "charLiteralExpression":
    case "numericLiteralExpression":
      return false;
    default: {
      const exhaustive: never = expr;
      throw new Error(
        `ICE: Unhandled expression AST kind '${(exhaustive as CSharpExpressionAst).kind}' in expressionMayPrintColon`
      );
    }
  }
};
