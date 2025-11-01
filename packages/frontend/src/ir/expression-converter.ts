/**
 * Expression converter - TypeScript AST to IR expressions
 */

import * as ts from "typescript";
import {
  IrExpression,
  IrLiteralExpression,
  IrArrayExpression,
  IrObjectExpression,
  IrObjectProperty,
  IrMemberExpression,
  IrCallExpression,
  IrNewExpression,
  IrUnaryExpression,
  IrUpdateExpression,
  IrConditionalExpression,
  IrFunctionExpression,
  IrArrowFunctionExpression,
  IrTemplateLiteralExpression,
  IrBinaryOperator,
  IrAssignmentOperator,
} from "./types.js";
import {
  convertParameters,
  convertBlockStatement,
} from "./statement-converter.js";
import { convertType } from "./type-converter.js";

export const convertExpression = (node: ts.Expression): IrExpression => {
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return convertLiteral(node);
  }
  if (
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword
  ) {
    return {
      kind: "literal",
      value: node.kind === ts.SyntaxKind.TrueKeyword,
      raw: node.getText(),
    };
  }
  if (node.kind === ts.SyntaxKind.NullKeyword) {
    return { kind: "literal", value: null, raw: "null" };
  }
  if (
    node.kind === ts.SyntaxKind.UndefinedKeyword ||
    ts.isVoidExpression(node)
  ) {
    return { kind: "literal", value: undefined, raw: "undefined" };
  }
  if (ts.isIdentifier(node)) {
    return { kind: "identifier", name: node.text };
  }
  if (ts.isArrayLiteralExpression(node)) {
    return convertArrayLiteral(node);
  }
  if (ts.isObjectLiteralExpression(node)) {
    return convertObjectLiteral(node);
  }
  if (
    ts.isPropertyAccessExpression(node) ||
    ts.isElementAccessExpression(node)
  ) {
    return convertMemberExpression(node);
  }
  if (ts.isCallExpression(node)) {
    return convertCallExpression(node);
  }
  if (ts.isNewExpression(node)) {
    return convertNewExpression(node);
  }
  if (ts.isBinaryExpression(node)) {
    return convertBinaryExpression(node);
  }
  if (ts.isPrefixUnaryExpression(node)) {
    return convertUnaryExpression(node);
  }
  if (ts.isPostfixUnaryExpression(node)) {
    return convertUpdateExpression(node);
  }
  if (ts.isTypeOfExpression(node)) {
    return {
      kind: "unary",
      operator: "typeof",
      expression: convertExpression(node.expression),
    };
  }
  if (ts.isVoidExpression(node)) {
    return {
      kind: "unary",
      operator: "void",
      expression: convertExpression(node.expression),
    };
  }
  if (ts.isDeleteExpression(node)) {
    return {
      kind: "unary",
      operator: "delete",
      expression: convertExpression(node.expression),
    };
  }
  if (ts.isConditionalExpression(node)) {
    return convertConditionalExpression(node);
  }
  if (ts.isFunctionExpression(node)) {
    return convertFunctionExpression(node);
  }
  if (ts.isArrowFunction(node)) {
    return convertArrowFunction(node);
  }
  if (
    ts.isTemplateExpression(node) ||
    ts.isNoSubstitutionTemplateLiteral(node)
  ) {
    return convertTemplateLiteral(node);
  }
  if (ts.isSpreadElement(node)) {
    return {
      kind: "spread",
      expression: convertExpression(node.expression),
    };
  }
  if (node.kind === ts.SyntaxKind.ThisKeyword) {
    return { kind: "this" };
  }
  if (ts.isAwaitExpression(node)) {
    return {
      kind: "await",
      expression: convertExpression(node.expression),
    };
  }
  if (ts.isParenthesizedExpression(node)) {
    return convertExpression(node.expression);
  }
  if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
    // Type assertions are ignored in IR (runtime doesn't need them)
    return convertExpression(
      ts.isAsExpression(node) ? node.expression : node.expression
    );
  }

  // Fallback - treat as identifier
  return { kind: "identifier", name: node.getText() };
};

const convertLiteral = (
  node: ts.StringLiteral | ts.NumericLiteral
): IrLiteralExpression => {
  return {
    kind: "literal",
    value: ts.isStringLiteral(node) ? node.text : Number(node.text),
    raw: node.getText(),
  };
};

const convertArrayLiteral = (
  node: ts.ArrayLiteralExpression
): IrArrayExpression => {
  return {
    kind: "array",
    elements: node.elements.map((elem) => {
      if (ts.isOmittedExpression(elem)) {
        return undefined; // Hole in sparse array
      }
      if (ts.isSpreadElement(elem)) {
        return {
          kind: "spread" as const,
          expression: convertExpression(elem.expression),
        };
      }
      return convertExpression(elem);
    }),
  };
};

const convertObjectLiteral = (
  node: ts.ObjectLiteralExpression
): IrObjectExpression => {
  const properties: IrObjectProperty[] = [];

  node.properties.forEach((prop) => {
    if (ts.isPropertyAssignment(prop)) {
      const key = ts.isComputedPropertyName(prop.name)
        ? convertExpression(prop.name.expression)
        : ts.isIdentifier(prop.name)
          ? prop.name.text
          : String(prop.name.text);

      properties.push({
        kind: "property",
        key,
        value: convertExpression(prop.initializer),
        shorthand: false,
      });
    } else if (ts.isShorthandPropertyAssignment(prop)) {
      properties.push({
        kind: "property",
        key: prop.name.text,
        value: { kind: "identifier", name: prop.name.text },
        shorthand: true,
      });
    } else if (ts.isSpreadAssignment(prop)) {
      properties.push({
        kind: "spread",
        expression: convertExpression(prop.expression),
      });
    }
    // Skip getters/setters/methods for now (can add later if needed)
  });

  return { kind: "object", properties };
};

const convertMemberExpression = (
  node: ts.PropertyAccessExpression | ts.ElementAccessExpression
): IrMemberExpression => {
  const isOptional = node.questionDotToken !== undefined;

  if (ts.isPropertyAccessExpression(node)) {
    return {
      kind: "memberAccess",
      object: convertExpression(node.expression),
      property: node.name.text,
      isComputed: false,
      isOptional,
    };
  } else {
    return {
      kind: "memberAccess",
      object: convertExpression(node.expression),
      property: convertExpression(node.argumentExpression),
      isComputed: true,
      isOptional,
    };
  }
};

const convertCallExpression = (node: ts.CallExpression): IrCallExpression => {
  return {
    kind: "call",
    callee: convertExpression(node.expression),
    arguments: node.arguments.map((arg) => {
      if (ts.isSpreadElement(arg)) {
        return {
          kind: "spread" as const,
          expression: convertExpression(arg.expression),
        };
      }
      return convertExpression(arg);
    }),
    isOptional: node.questionDotToken !== undefined,
  };
};

const convertNewExpression = (node: ts.NewExpression): IrNewExpression => {
  return {
    kind: "new",
    callee: convertExpression(node.expression),
    arguments:
      node.arguments?.map((arg) => {
        if (ts.isSpreadElement(arg)) {
          return {
            kind: "spread" as const,
            expression: convertExpression(arg.expression),
          };
        }
        return convertExpression(arg);
      }) ?? [],
  };
};

const convertBinaryExpression = (node: ts.BinaryExpression): IrExpression => {
  const operator = convertBinaryOperator(node.operatorToken);

  // Handle assignment separately
  if (isAssignmentOperator(node.operatorToken)) {
    return {
      kind: "assignment",
      operator: operator as IrAssignmentOperator,
      left: ts.isIdentifier(node.left)
        ? { kind: "identifier", name: node.left.text }
        : convertExpression(node.left),
      right: convertExpression(node.right),
    };
  }

  // Handle logical operators
  if (operator === "&&" || operator === "||" || operator === "??") {
    return {
      kind: "logical",
      operator,
      left: convertExpression(node.left),
      right: convertExpression(node.right),
    };
  }

  // Regular binary expression
  return {
    kind: "binary",
    operator: operator as IrBinaryOperator,
    left: convertExpression(node.left),
    right: convertExpression(node.right),
  };
};

const convertUnaryExpression = (
  node: ts.PrefixUnaryExpression
): IrUnaryExpression | IrUpdateExpression => {
  // Check if it's an increment/decrement (++ or --)
  if (
    node.operator === ts.SyntaxKind.PlusPlusToken ||
    node.operator === ts.SyntaxKind.MinusMinusToken
  ) {
    return {
      kind: "update",
      operator: node.operator === ts.SyntaxKind.PlusPlusToken ? "++" : "--",
      prefix: true,
      expression: convertExpression(node.operand),
    };
  }

  // Handle regular unary operators
  let operator: IrUnaryExpression["operator"] = "+";

  switch (node.operator) {
    case ts.SyntaxKind.PlusToken:
      operator = "+";
      break;
    case ts.SyntaxKind.MinusToken:
      operator = "-";
      break;
    case ts.SyntaxKind.ExclamationToken:
      operator = "!";
      break;
    case ts.SyntaxKind.TildeToken:
      operator = "~";
      break;
  }

  return {
    kind: "unary",
    operator,
    expression: convertExpression(node.operand),
  };
};

const convertUpdateExpression = (
  node: ts.PostfixUnaryExpression | ts.PrefixUnaryExpression
): IrUpdateExpression => {
  if (ts.isPrefixUnaryExpression(node)) {
    // Check if it's an increment or decrement
    if (
      node.operator === ts.SyntaxKind.PlusPlusToken ||
      node.operator === ts.SyntaxKind.MinusMinusToken
    ) {
      return {
        kind: "update",
        operator: node.operator === ts.SyntaxKind.PlusPlusToken ? "++" : "--",
        prefix: true,
        expression: convertExpression(node.operand),
      };
    }
  }

  // Handle postfix unary expression
  const postfix = node as ts.PostfixUnaryExpression;
  return {
    kind: "update",
    operator: postfix.operator === ts.SyntaxKind.PlusPlusToken ? "++" : "--",
    prefix: false,
    expression: convertExpression(postfix.operand),
  };
};

const convertConditionalExpression = (
  node: ts.ConditionalExpression
): IrConditionalExpression => {
  return {
    kind: "conditional",
    condition: convertExpression(node.condition),
    whenTrue: convertExpression(node.whenTrue),
    whenFalse: convertExpression(node.whenFalse),
  };
};

const convertFunctionExpression = (
  node: ts.FunctionExpression
): IrFunctionExpression => {
  // Note: For now we pass undefined for checker. This should be passed from the builder in a future refactor.
  const checker = undefined as unknown as ts.TypeChecker;
  return {
    kind: "functionExpression",
    name: node.name?.text,
    parameters: convertParameters(node.parameters, checker),
    returnType: node.type ? convertType(node.type, checker) : undefined,
    body: node.body
      ? convertBlockStatement(node.body, checker)
      : { kind: "blockStatement", statements: [] },
    isAsync: !!node.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.AsyncKeyword
    ),
    isGenerator: !!node.asteriskToken,
  };
};

const convertArrowFunction = (
  node: ts.ArrowFunction
): IrArrowFunctionExpression => {
  // Note: For now we pass undefined for checker. This should be passed from the builder in a future refactor.
  const checker = undefined as unknown as ts.TypeChecker;
  const body = ts.isBlock(node.body)
    ? convertBlockStatement(node.body, checker)
    : convertExpression(node.body);

  return {
    kind: "arrowFunction",
    parameters: convertParameters(node.parameters, checker),
    returnType: node.type ? convertType(node.type, checker) : undefined,
    body,
    isAsync: !!node.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.AsyncKeyword
    ),
  };
};

const convertTemplateLiteral = (
  node: ts.TemplateExpression | ts.NoSubstitutionTemplateLiteral
): IrTemplateLiteralExpression => {
  if (ts.isNoSubstitutionTemplateLiteral(node)) {
    return {
      kind: "templateLiteral",
      quasis: [node.text],
      expressions: [],
    };
  }

  const quasis: string[] = [node.head.text];
  const expressions: IrExpression[] = [];

  node.templateSpans.forEach((span) => {
    expressions.push(convertExpression(span.expression));
    quasis.push(span.literal.text);
  });

  return { kind: "templateLiteral", quasis, expressions };
};

const convertBinaryOperator = (token: ts.BinaryOperatorToken): string => {
  const operatorMap: Record<number, string> = {
    [ts.SyntaxKind.PlusToken]: "+",
    [ts.SyntaxKind.MinusToken]: "-",
    [ts.SyntaxKind.AsteriskToken]: "*",
    [ts.SyntaxKind.SlashToken]: "/",
    [ts.SyntaxKind.PercentToken]: "%",
    [ts.SyntaxKind.AsteriskAsteriskToken]: "**",
    [ts.SyntaxKind.EqualsEqualsToken]: "==",
    [ts.SyntaxKind.ExclamationEqualsToken]: "!=",
    [ts.SyntaxKind.EqualsEqualsEqualsToken]: "===",
    [ts.SyntaxKind.ExclamationEqualsEqualsToken]: "!==",
    [ts.SyntaxKind.LessThanToken]: "<",
    [ts.SyntaxKind.GreaterThanToken]: ">",
    [ts.SyntaxKind.LessThanEqualsToken]: "<=",
    [ts.SyntaxKind.GreaterThanEqualsToken]: ">=",
    [ts.SyntaxKind.LessThanLessThanToken]: "<<",
    [ts.SyntaxKind.GreaterThanGreaterThanToken]: ">>",
    [ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken]: ">>>",
    [ts.SyntaxKind.AmpersandToken]: "&",
    [ts.SyntaxKind.BarToken]: "|",
    [ts.SyntaxKind.CaretToken]: "^",
    [ts.SyntaxKind.AmpersandAmpersandToken]: "&&",
    [ts.SyntaxKind.BarBarToken]: "||",
    [ts.SyntaxKind.QuestionQuestionToken]: "??",
    [ts.SyntaxKind.InKeyword]: "in",
    [ts.SyntaxKind.InstanceOfKeyword]: "instanceof",
    [ts.SyntaxKind.EqualsToken]: "=",
    [ts.SyntaxKind.PlusEqualsToken]: "+=",
    [ts.SyntaxKind.MinusEqualsToken]: "-=",
    [ts.SyntaxKind.AsteriskEqualsToken]: "*=",
    [ts.SyntaxKind.SlashEqualsToken]: "/=",
    [ts.SyntaxKind.PercentEqualsToken]: "%=",
    [ts.SyntaxKind.AsteriskAsteriskEqualsToken]: "**=",
    [ts.SyntaxKind.LessThanLessThanEqualsToken]: "<<=",
    [ts.SyntaxKind.GreaterThanGreaterThanEqualsToken]: ">>=",
    [ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken]: ">>>=",
    [ts.SyntaxKind.AmpersandEqualsToken]: "&=",
    [ts.SyntaxKind.BarEqualsToken]: "|=",
    [ts.SyntaxKind.CaretEqualsToken]: "^=",
    [ts.SyntaxKind.AmpersandAmpersandEqualsToken]: "&&=",
    [ts.SyntaxKind.BarBarEqualsToken]: "||=",
    [ts.SyntaxKind.QuestionQuestionEqualsToken]: "??=",
  };

  return operatorMap[token.kind] ?? "=";
};

const isAssignmentOperator = (token: ts.BinaryOperatorToken): boolean => {
  return (
    token.kind >= ts.SyntaxKind.FirstAssignment &&
    token.kind <= ts.SyntaxKind.LastAssignment
  );
};
