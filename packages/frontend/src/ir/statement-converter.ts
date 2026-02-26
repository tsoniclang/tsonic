/**
 * Statement converter - TypeScript AST to IR statements
 * Main dispatcher - delegates to specialized modules
 *
 * Phase 5 Step 4: Uses ProgramContext instead of global singletons.
 */

import * as ts from "typescript";
import { IrStatement, IrType } from "./types.js";
import { convertExpression } from "./expression-converter.js";
import type { ProgramContext } from "./program-context.js";

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
 * @param ctx - ProgramContext for TypeSystem and binding access
 * @param expectedReturnType - Return type from enclosing function for contextual typing.
 *                             Pass `undefined` explicitly when not inside a function.
 */
export const convertStatement = (
  node: ts.Node,
  ctx: ProgramContext,
  expectedReturnType: IrType | undefined
): ConvertStatementResult => {
  // Skip ambient (declare) declarations - they're type-only
  if (isAmbientDeclaration(node)) {
    return null;
  }

  if (ts.isVariableStatement(node)) {
    return convertVariableStatement(node, ctx);
  }
  if (ts.isFunctionDeclaration(node)) {
    return convertFunctionDeclaration(node, ctx);
  }
  if (ts.isClassDeclaration(node)) {
    return convertClassDeclaration(node, ctx);
  }
  if (ts.isInterfaceDeclaration(node)) {
    return convertInterfaceDeclaration(node, ctx);
  }
  if (ts.isEnumDeclaration(node)) {
    return convertEnumDeclaration(node, ctx);
  }
  // Type alias declarations may return multiple statements (synthetic interfaces + alias)
  if (ts.isTypeAliasDeclaration(node)) {
    return convertTypeAliasDeclaration(node, ctx);
  }
  if (ts.isExpressionStatement(node)) {
    return {
      kind: "expressionStatement",
      expression: convertExpression(node.expression, ctx, undefined),
    };
  }
  if (ts.isReturnStatement(node)) {
    return {
      kind: "returnStatement",
      // Pass function return type for contextual typing of return expression
      expression: node.expression
        ? convertExpression(node.expression, ctx, expectedReturnType)
        : undefined,
    };
  }
  if (ts.isIfStatement(node)) {
    return convertIfStatement(node, ctx, expectedReturnType);
  }
  if (ts.isWhileStatement(node)) {
    return convertWhileStatement(node, ctx, expectedReturnType);
  }
  if (ts.isForStatement(node)) {
    return convertForStatement(node, ctx, expectedReturnType);
  }
  if (ts.isForOfStatement(node)) {
    return convertForOfStatement(node, ctx, expectedReturnType);
  }
  if (ts.isForInStatement(node)) {
    return convertForInStatement(node, ctx, expectedReturnType);
  }
  if (ts.isSwitchStatement(node)) {
    return convertSwitchStatement(node, ctx, expectedReturnType);
  }
  if (ts.isThrowStatement(node)) {
    if (!node.expression) {
      return null;
    }
    return {
      kind: "throwStatement",
      expression: convertExpression(node.expression, ctx, undefined),
    };
  }
  if (ts.isTryStatement(node)) {
    return convertTryStatement(node, ctx, expectedReturnType);
  }
  if (ts.isBlock(node)) {
    return convertBlockStatement(node, ctx, expectedReturnType);
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
 * @param ctx - ProgramContext for TypeSystem and binding access
 * @param expectedReturnType - Return type from enclosing function for contextual typing.
 *                             Must be passed through for return statements in nested blocks.
 */
export const convertStatementSingle = (
  node: ts.Node,
  ctx: ProgramContext,
  expectedReturnType?: IrType
): IrStatement | null => {
  const result = convertStatement(node, ctx, expectedReturnType);
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
