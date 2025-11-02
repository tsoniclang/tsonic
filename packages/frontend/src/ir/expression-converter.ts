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
import { IrType } from "./types.js";

/**
 * Helper to get inferred type from TypeScript node
 */
const getInferredType = (
  node: ts.Node,
  checker: ts.TypeChecker
): IrType | undefined => {
  try {
    const tsType = checker.getTypeAtLocation(node);
    const typeNode = checker.typeToTypeNode(
      tsType,
      node,
      ts.NodeBuilderFlags.None
    );
    return typeNode ? convertType(typeNode, checker) : undefined;
  } catch {
    // If type extraction fails, return undefined
    return undefined;
  }
};

/**
 * Extract type arguments from a call or new expression
 * This captures both explicit type arguments and inferred ones
 */
const extractTypeArguments = (
  node: ts.CallExpression | ts.NewExpression,
  checker: ts.TypeChecker
): readonly IrType[] | undefined => {
  try {
    // First check for explicit type arguments
    if (node.typeArguments && node.typeArguments.length > 0) {
      return node.typeArguments.map((typeArg) => convertType(typeArg, checker));
    }

    // Try to get inferred type arguments from resolved signature
    const signature = checker.getResolvedSignature(node);
    if (!signature) {
      return undefined;
    }

    const typeParameters = signature.typeParameters;
    if (!typeParameters || typeParameters.length === 0) {
      return undefined;
    }

    // Get the type arguments inferred by the checker
    const typeArgs: IrType[] = [];
    for (const typeParam of typeParameters) {
      // Try to resolve the instantiated type for this parameter
      const typeNode = checker.typeToTypeNode(
        typeParam as ts.Type,
        node,
        ts.NodeBuilderFlags.None
      );
      if (typeNode) {
        typeArgs.push(convertType(typeNode, checker));
      }
    }

    return typeArgs.length > 0 ? typeArgs : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Check if a call/new expression requires specialization
 * Returns true for conditional types, infer, variadic generics, this typing
 */
const checkIfRequiresSpecialization = (
  node: ts.CallExpression | ts.NewExpression,
  checker: ts.TypeChecker
): boolean => {
  try {
    const signature = checker.getResolvedSignature(node);
    if (!signature || !signature.declaration) {
      return false;
    }

    const decl = signature.declaration;

    // Check for conditional return types
    if (
      ts.isFunctionDeclaration(decl) ||
      ts.isMethodDeclaration(decl) ||
      ts.isFunctionTypeNode(decl)
    ) {
      if (decl.type && ts.isConditionalTypeNode(decl.type)) {
        return true;
      }
    }

    // Check for variadic type parameters (rest parameters with generic types)
    const typeParameters = signature.typeParameters;
    if (typeParameters) {
      for (const typeParam of typeParameters) {
        const constraint = typeParam.getConstraint();
        if (constraint) {
          const constraintStr = checker.typeToString(constraint);
          // Check for unknown[] which indicates variadic
          if (
            constraintStr.includes("unknown[]") ||
            constraintStr.includes("any[]")
          ) {
            return true;
          }
        }
      }
    }

    return false;
  } catch {
    return false;
  }
};

export const convertExpression = (
  node: ts.Expression,
  checker: ts.TypeChecker
): IrExpression => {
  const inferredType = getInferredType(node, checker);

  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return convertLiteral(node, checker);
  }
  if (
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword
  ) {
    return {
      kind: "literal",
      value: node.kind === ts.SyntaxKind.TrueKeyword,
      raw: node.getText(),
      inferredType,
    };
  }
  if (node.kind === ts.SyntaxKind.NullKeyword) {
    return { kind: "literal", value: null, raw: "null", inferredType };
  }
  if (
    node.kind === ts.SyntaxKind.UndefinedKeyword ||
    ts.isVoidExpression(node)
  ) {
    return {
      kind: "literal",
      value: undefined,
      raw: "undefined",
      inferredType,
    };
  }
  if (ts.isIdentifier(node)) {
    return { kind: "identifier", name: node.text, inferredType };
  }
  if (ts.isArrayLiteralExpression(node)) {
    return convertArrayLiteral(node, checker);
  }
  if (ts.isObjectLiteralExpression(node)) {
    return convertObjectLiteral(node, checker);
  }
  if (
    ts.isPropertyAccessExpression(node) ||
    ts.isElementAccessExpression(node)
  ) {
    return convertMemberExpression(node, checker);
  }
  if (ts.isCallExpression(node)) {
    return convertCallExpression(node, checker);
  }
  if (ts.isNewExpression(node)) {
    return convertNewExpression(node, checker);
  }
  if (ts.isBinaryExpression(node)) {
    return convertBinaryExpression(node, checker);
  }
  if (ts.isPrefixUnaryExpression(node)) {
    return convertUnaryExpression(node, checker);
  }
  if (ts.isPostfixUnaryExpression(node)) {
    return convertUpdateExpression(node, checker);
  }
  if (ts.isTypeOfExpression(node)) {
    return {
      kind: "unary",
      operator: "typeof",
      expression: convertExpression(node.expression, checker),
      inferredType,
    };
  }
  if (ts.isVoidExpression(node)) {
    return {
      kind: "unary",
      operator: "void",
      expression: convertExpression(node.expression, checker),
      inferredType,
    };
  }
  if (ts.isDeleteExpression(node)) {
    return {
      kind: "unary",
      operator: "delete",
      expression: convertExpression(node.expression, checker),
      inferredType,
    };
  }
  if (ts.isConditionalExpression(node)) {
    return convertConditionalExpression(node, checker);
  }
  if (ts.isFunctionExpression(node)) {
    return convertFunctionExpression(node, checker);
  }
  if (ts.isArrowFunction(node)) {
    return convertArrowFunction(node, checker);
  }
  if (
    ts.isTemplateExpression(node) ||
    ts.isNoSubstitutionTemplateLiteral(node)
  ) {
    return convertTemplateLiteral(node, checker);
  }
  if (ts.isSpreadElement(node)) {
    return {
      kind: "spread",
      expression: convertExpression(node.expression, checker),
      inferredType,
    };
  }
  if (node.kind === ts.SyntaxKind.ThisKeyword) {
    return { kind: "this", inferredType };
  }
  if (ts.isAwaitExpression(node)) {
    return {
      kind: "await",
      expression: convertExpression(node.expression, checker),
      inferredType,
    };
  }
  if (ts.isParenthesizedExpression(node)) {
    return convertExpression(node.expression, checker);
  }
  if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
    // Type assertions are ignored in IR (runtime doesn't need them)
    return convertExpression(
      ts.isAsExpression(node) ? node.expression : node.expression,
      checker
    );
  }

  // Fallback - treat as identifier
  return { kind: "identifier", name: node.getText(), inferredType };
};

const convertLiteral = (
  node: ts.StringLiteral | ts.NumericLiteral,
  checker: ts.TypeChecker
): IrLiteralExpression => {
  return {
    kind: "literal",
    value: ts.isStringLiteral(node) ? node.text : Number(node.text),
    raw: node.getText(),
    inferredType: getInferredType(node, checker),
  };
};

const convertArrayLiteral = (
  node: ts.ArrayLiteralExpression,
  checker: ts.TypeChecker
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
          expression: convertExpression(elem.expression, checker),
        };
      }
      return convertExpression(elem, checker);
    }),
    inferredType: getInferredType(node, checker),
  };
};

const convertObjectLiteral = (
  node: ts.ObjectLiteralExpression,
  checker: ts.TypeChecker
): IrObjectExpression => {
  const properties: IrObjectProperty[] = [];

  node.properties.forEach((prop) => {
    if (ts.isPropertyAssignment(prop)) {
      const key = ts.isComputedPropertyName(prop.name)
        ? convertExpression(prop.name.expression, checker)
        : ts.isIdentifier(prop.name)
          ? prop.name.text
          : String(prop.name.text);

      properties.push({
        kind: "property",
        key,
        value: convertExpression(prop.initializer, checker),
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
        expression: convertExpression(prop.expression, checker),
      });
    }
    // Skip getters/setters/methods for now (can add later if needed)
  });

  return {
    kind: "object",
    properties,
    inferredType: getInferredType(node, checker),
  };
};

const convertMemberExpression = (
  node: ts.PropertyAccessExpression | ts.ElementAccessExpression,
  checker: ts.TypeChecker
): IrMemberExpression => {
  const isOptional = node.questionDotToken !== undefined;
  const inferredType = getInferredType(node, checker);

  if (ts.isPropertyAccessExpression(node)) {
    return {
      kind: "memberAccess",
      object: convertExpression(node.expression, checker),
      property: node.name.text,
      isComputed: false,
      isOptional,
      inferredType,
    };
  } else {
    return {
      kind: "memberAccess",
      object: convertExpression(node.expression, checker),
      property: convertExpression(node.argumentExpression, checker),
      isComputed: true,
      isOptional,
      inferredType,
    };
  }
};

const convertCallExpression = (
  node: ts.CallExpression,
  checker: ts.TypeChecker
): IrCallExpression => {
  // Extract type arguments from the call signature
  const typeArguments = extractTypeArguments(node, checker);
  const requiresSpecialization = checkIfRequiresSpecialization(node, checker);

  return {
    kind: "call",
    callee: convertExpression(node.expression, checker),
    arguments: node.arguments.map((arg) => {
      if (ts.isSpreadElement(arg)) {
        return {
          kind: "spread" as const,
          expression: convertExpression(arg.expression, checker),
        };
      }
      return convertExpression(arg, checker);
    }),
    isOptional: node.questionDotToken !== undefined,
    inferredType: getInferredType(node, checker),
    typeArguments,
    requiresSpecialization,
  };
};

const convertNewExpression = (
  node: ts.NewExpression,
  checker: ts.TypeChecker
): IrNewExpression => {
  // Extract type arguments from the constructor signature
  const typeArguments = extractTypeArguments(node, checker);
  const requiresSpecialization = checkIfRequiresSpecialization(node, checker);

  return {
    kind: "new",
    callee: convertExpression(node.expression, checker),
    arguments:
      node.arguments?.map((arg) => {
        if (ts.isSpreadElement(arg)) {
          return {
            kind: "spread" as const,
            expression: convertExpression(arg.expression, checker),
          };
        }
        return convertExpression(arg, checker);
      }) ?? [],
    inferredType: getInferredType(node, checker),
    typeArguments,
    requiresSpecialization,
  };
};

const convertBinaryExpression = (
  node: ts.BinaryExpression,
  checker: ts.TypeChecker
): IrExpression => {
  const operator = convertBinaryOperator(node.operatorToken);
  const inferredType = getInferredType(node, checker);

  // Handle assignment separately
  if (isAssignmentOperator(node.operatorToken)) {
    return {
      kind: "assignment",
      operator: operator as IrAssignmentOperator,
      left: ts.isIdentifier(node.left)
        ? { kind: "identifier", name: node.left.text }
        : convertExpression(node.left, checker),
      right: convertExpression(node.right, checker),
      inferredType,
    };
  }

  // Handle logical operators
  if (operator === "&&" || operator === "||" || operator === "??") {
    return {
      kind: "logical",
      operator,
      left: convertExpression(node.left, checker),
      right: convertExpression(node.right, checker),
      inferredType,
    };
  }

  // Regular binary expression
  return {
    kind: "binary",
    operator: operator as IrBinaryOperator,
    left: convertExpression(node.left, checker),
    right: convertExpression(node.right, checker),
    inferredType,
  };
};

const convertUnaryExpression = (
  node: ts.PrefixUnaryExpression,
  checker: ts.TypeChecker
): IrUnaryExpression | IrUpdateExpression => {
  const inferredType = getInferredType(node, checker);

  // Check if it's an increment/decrement (++ or --)
  if (
    node.operator === ts.SyntaxKind.PlusPlusToken ||
    node.operator === ts.SyntaxKind.MinusMinusToken
  ) {
    return {
      kind: "update",
      operator: node.operator === ts.SyntaxKind.PlusPlusToken ? "++" : "--",
      prefix: true,
      expression: convertExpression(node.operand, checker),
      inferredType,
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
    expression: convertExpression(node.operand, checker),
    inferredType,
  };
};

const convertUpdateExpression = (
  node: ts.PostfixUnaryExpression | ts.PrefixUnaryExpression,
  checker: ts.TypeChecker
): IrUpdateExpression => {
  const inferredType = getInferredType(node, checker);

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
        expression: convertExpression(node.operand, checker),
        inferredType,
      };
    }
  }

  // Handle postfix unary expression
  const postfix = node as ts.PostfixUnaryExpression;
  return {
    kind: "update",
    operator: postfix.operator === ts.SyntaxKind.PlusPlusToken ? "++" : "--",
    prefix: false,
    expression: convertExpression(postfix.operand, checker),
    inferredType,
  };
};

const convertConditionalExpression = (
  node: ts.ConditionalExpression,
  checker: ts.TypeChecker
): IrConditionalExpression => {
  return {
    kind: "conditional",
    condition: convertExpression(node.condition, checker),
    whenTrue: convertExpression(node.whenTrue, checker),
    whenFalse: convertExpression(node.whenFalse, checker),
    inferredType: getInferredType(node, checker),
  };
};

const convertFunctionExpression = (
  node: ts.FunctionExpression,
  checker: ts.TypeChecker
): IrFunctionExpression => {
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
    inferredType: getInferredType(node, checker),
  };
};

const convertArrowFunction = (
  node: ts.ArrowFunction,
  checker: ts.TypeChecker
): IrArrowFunctionExpression => {
  const body = ts.isBlock(node.body)
    ? convertBlockStatement(node.body, checker)
    : convertExpression(node.body, checker);

  return {
    kind: "arrowFunction",
    parameters: convertParameters(node.parameters, checker),
    returnType: node.type ? convertType(node.type, checker) : undefined,
    body,
    isAsync: !!node.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.AsyncKeyword
    ),
    inferredType: getInferredType(node, checker),
  };
};

const convertTemplateLiteral = (
  node: ts.TemplateExpression | ts.NoSubstitutionTemplateLiteral,
  checker: ts.TypeChecker
): IrTemplateLiteralExpression => {
  if (ts.isNoSubstitutionTemplateLiteral(node)) {
    return {
      kind: "templateLiteral",
      quasis: [node.text],
      expressions: [],
      inferredType: getInferredType(node, checker),
    };
  }

  const quasis: string[] = [node.head.text];
  const expressions: IrExpression[] = [];

  node.templateSpans.forEach((span) => {
    expressions.push(convertExpression(span.expression, checker));
    quasis.push(span.literal.text);
  });

  return {
    kind: "templateLiteral",
    quasis,
    expressions,
    inferredType: getInferredType(node, checker),
  };
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
