/**
 * Statement converter - TypeScript AST to IR statements
 * Main dispatcher - delegates to specialized modules
 */

import * as ts from "typescript";
import { IrStatement, IrType } from "./types.js";
import { convertExpression } from "./expression-converter.js";

// Import converters from specialized modules
import {
  convertVariableStatement,
  convertFunctionDeclaration,
  convertClassDeclaration,
  convertInterfaceDeclaration,
  convertEnumDeclaration,
  convertTypeAliasDeclaration,
} from "./converters/statements/declarations.js";

import {
  convertIfStatement,
  convertWhileStatement,
  convertForStatement,
  convertForOfStatement,
  convertForInStatement,
  convertSwitchStatement,
  convertTryStatement,
  convertBlockStatement,
} from "./converters/statements/control.js";

/**
 * Result type for statement conversion.
 * Some converters (like type aliases with synthetic types) return multiple statements.
 */
export type ConvertStatementResult =
  | IrStatement
  | readonly IrStatement[]
  | null;

/**
 * Check if a node is an ambient (declare) declaration.
 * Ambient declarations are type-only and should not be emitted.
 */
const isAmbientDeclaration = (node: ts.Node): boolean => {
  const modifierFlags = ts.getCombinedModifierFlags(node as ts.Declaration);
  return !!(modifierFlags & ts.ModifierFlags.Ambient);
};

/**
 * Main statement converter dispatcher
 *
 * @param expectedReturnType - Return type from enclosing function for contextual typing.
 *                             Pass `undefined` explicitly when not inside a function.
 */
export const convertStatement = (
  node: ts.Node,
  checker: ts.TypeChecker,
  expectedReturnType: IrType | undefined
): ConvertStatementResult => {
  // Skip ambient (declare) declarations - they're type-only
  if (isAmbientDeclaration(node)) {
    return null;
  }

  if (ts.isVariableStatement(node)) {
    return convertVariableStatement(node, checker);
  }
  if (ts.isFunctionDeclaration(node)) {
    return convertFunctionDeclaration(node, checker);
  }
  if (ts.isClassDeclaration(node)) {
    return convertClassDeclaration(node, checker);
  }
  if (ts.isInterfaceDeclaration(node)) {
    return convertInterfaceDeclaration(node, checker);
  }
  if (ts.isEnumDeclaration(node)) {
    return convertEnumDeclaration(node, checker);
  }
  // Type alias declarations may return multiple statements (synthetic interfaces + alias)
  if (ts.isTypeAliasDeclaration(node)) {
    return convertTypeAliasDeclaration(node, checker);
  }
  if (ts.isExpressionStatement(node)) {
    return {
      kind: "expressionStatement",
      expression: convertExpression(node.expression, checker, undefined),
    };
  }
  if (ts.isReturnStatement(node)) {
    return {
      kind: "returnStatement",
      // Pass function return type for contextual typing of return expression
      expression: node.expression
        ? convertExpression(node.expression, checker, expectedReturnType)
        : undefined,
    };
  }
  if (ts.isIfStatement(node)) {
    return convertIfStatement(node, checker, expectedReturnType);
  }
  if (ts.isWhileStatement(node)) {
    return convertWhileStatement(node, checker, expectedReturnType);
  }
  if (ts.isForStatement(node)) {
    return convertForStatement(node, checker, expectedReturnType);
  }
  if (ts.isForOfStatement(node)) {
    return convertForOfStatement(node, checker, expectedReturnType);
  }
  if (ts.isForInStatement(node)) {
    return convertForInStatement(node, checker, expectedReturnType);
  }
  if (ts.isSwitchStatement(node)) {
    return convertSwitchStatement(node, checker, expectedReturnType);
  }
  if (ts.isThrowStatement(node)) {
    if (!node.expression) {
      return null;
    }
    return {
      kind: "throwStatement",
      expression: convertExpression(node.expression, checker, undefined),
    };
  }
  if (ts.isTryStatement(node)) {
    return convertTryStatement(node, checker, expectedReturnType);
  }
  if (ts.isBlock(node)) {
    return convertBlockStatement(node, checker, expectedReturnType);
  }
  if (ts.isBreakStatement(node)) {
    return {
      kind: "breakStatement",
      label: node.label?.text,
    };
  }
  if (ts.isContinueStatement(node)) {
    return {
      kind: "continueStatement",
      label: node.label?.text,
    };
  }
  if (ts.isEmptyStatement(node)) {
    return { kind: "emptyStatement" };
  }

  return null;
};

/**
 * Flatten a convert statement result into an array of statements.
 * Handles both single statements and arrays.
 */
export const flattenStatementResult = (
  result: ConvertStatementResult
): readonly IrStatement[] => {
  if (result === null) {
    return [];
  }
  if (Array.isArray(result)) {
    return result;
  }
  // At this point, result is IrStatement (not array, not null)
  return [result as IrStatement];
};

/**
 * Convert a statement and return a single statement (for contexts where arrays not expected).
 * Type aliases inside control flow will return the first statement (usually the only one).
 *
 * @param expectedReturnType - Return type from enclosing function for contextual typing.
 *                             Must be passed through for return statements in nested blocks.
 */
export const convertStatementSingle = (
  node: ts.Node,
  checker: ts.TypeChecker,
  expectedReturnType?: IrType
): IrStatement | null => {
  const result = convertStatement(node, checker, expectedReturnType);
  if (result === null) {
    return null;
  }
  if (Array.isArray(result)) {
    // In control flow contexts, we expect single statements
    // Return first statement (type aliases in control flow are rare)
    return result[0] ?? null;
  }
  // At this point, result is IrStatement (not array, not null)
  return result as IrStatement;
};

// Re-export commonly used functions for backward compatibility
export { convertBlockStatement } from "./converters/statements/control.js";
export { convertParameters } from "./converters/statements/helpers.js";
export {
  setMetadataRegistry,
  setBindingRegistry,
} from "./converters/statements/declarations.js";
