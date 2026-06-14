/**
 * Statement converter - TypeScript AST to IR statements
 * Main dispatcher - delegates to specialized modules
 *
 * Uses ProgramContext for statement conversion.
 */

import {
  getTstsBodyNode,
  getTstsNodeText,
  getTstsParameters,
  hasTstsAmbientModifier,
  hasTstsExportModifier,
  TstsSyntax,
  type TstsNode,
} from "@tsonic/tsts";
import type { IrStatement, IrType } from "./types.js";
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
const isAmbientDeclaration = (node: TstsNode): boolean =>
  hasTstsAmbientModifier(node);

const isCompileTimeNoopAssertionCall = (
  node: TstsNode,
  ctx: ProgramContext
): boolean => {
  const expression = TstsSyntax.Node_Expression(node);
  if (
    !expression ||
    expression.Kind !== TstsSyntax.KindCallExpression ||
    (TstsSyntax.Node_Arguments(expression) ?? []).length !== 0 ||
    (TstsSyntax.Node_TypeArguments(expression) ?? []).length === 0 ||
    TstsSyntax.Node_Expression(expression)?.Kind !== TstsSyntax.KindIdentifier
  ) {
    return false;
  }

  const callee = TstsSyntax.Node_Expression(expression);
  if (!callee) {
    return false;
  }
  const declId = ctx.binding.resolveIdentifier(callee);
  if (!declId) {
    return false;
  }

  const decl = ctx.binding.getValueDeclarationNode(declId);
  if (!decl || decl.Kind !== TstsSyntax.KindFunctionDeclaration) {
    return false;
  }

  const body = getTstsBodyNode(decl);
  return (
    getTstsParameters(decl).length === 0 &&
    (TstsSyntax.Node_TypeParameters(decl) ?? []).length > 0 &&
    TstsSyntax.Node_Type(decl)?.Kind === TstsSyntax.KindVoidKeyword &&
    (body ? (TstsSyntax.Node_Statements(body) ?? []).length : 0) === 0
  );
};

const isCompileTimeNoopFunctionDeclaration = (
  node: TstsNode
): boolean => {
  const body = getTstsBodyNode(node);
  if (
    TstsSyntax.Node_Name(node) === undefined ||
    (TstsSyntax.Node_TypeParameters(node) ?? []).length === 0 ||
    getTstsParameters(node).length !== 0 ||
    TstsSyntax.Node_Type(node)?.Kind !== TstsSyntax.KindVoidKeyword ||
    (body ? (TstsSyntax.Node_Statements(body) ?? []).length : 0) !== 0
  ) {
    return false;
  }

  return !hasTstsExportModifier(node);
};

/**
 * Main statement converter dispatcher
 *
 * @param ctx - ProgramContext for TypeSystem and binding access
 * @param expectedReturnType - Return type from enclosing function for contextual typing.
 *                             Pass `undefined` explicitly when not inside a function.
 */
export const convertStatement = (
  node: TstsNode,
  ctx: ProgramContext,
  expectedReturnType: IrType | undefined
): ConvertStatementResult => {
  // Skip ambient (declare) declarations - they're type-only
  if (isAmbientDeclaration(node)) {
    return null;
  }

  if (node.Kind === TstsSyntax.KindVariableStatement) {
    return convertVariableStatement(node, ctx);
  }
  if (node.Kind === TstsSyntax.KindFunctionDeclaration) {
    if (isCompileTimeNoopFunctionDeclaration(node)) {
      return null;
    }

    return convertFunctionDeclaration(node, ctx);
  }
  if (node.Kind === TstsSyntax.KindClassDeclaration) {
    return convertClassDeclaration(node, ctx);
  }
  if (node.Kind === TstsSyntax.KindInterfaceDeclaration) {
    return convertInterfaceDeclaration(node, ctx);
  }
  if (node.Kind === TstsSyntax.KindEnumDeclaration) {
    return convertEnumDeclaration(node, ctx);
  }
  // Type alias declarations may return multiple statements (synthetic interfaces + alias)
  if (node.Kind === TstsSyntax.KindTypeAliasDeclaration) {
    return convertTypeAliasDeclaration(node, ctx);
  }
  if (node.Kind === TstsSyntax.KindExpressionStatement) {
    if (isCompileTimeNoopAssertionCall(node, ctx)) {
      return null;
    }

    const expression = TstsSyntax.Node_Expression(node);
    if (!expression) {
      return null;
    }
    return {
      kind: "expressionStatement",
      expression: convertExpression(expression, ctx, undefined),
    };
  }
  if (node.Kind === TstsSyntax.KindReturnStatement) {
    const expression = TstsSyntax.Node_Expression(node);
    return {
      kind: "returnStatement",
      // Pass function return type for contextual typing of return expression
      expression: expression
        ? convertExpression(expression, ctx, expectedReturnType)
        : undefined,
    };
  }
  if (node.Kind === TstsSyntax.KindIfStatement) {
    return convertIfStatement(node, ctx, expectedReturnType);
  }
  if (node.Kind === TstsSyntax.KindWhileStatement) {
    return convertWhileStatement(node, ctx, expectedReturnType);
  }
  if (node.Kind === TstsSyntax.KindForStatement) {
    return convertForStatement(node, ctx, expectedReturnType);
  }
  if (node.Kind === TstsSyntax.KindForOfStatement) {
    return convertForOfStatement(node, ctx, expectedReturnType);
  }
  if (node.Kind === TstsSyntax.KindForInStatement) {
    return convertForInStatement(node, ctx, expectedReturnType);
  }
  if (node.Kind === TstsSyntax.KindSwitchStatement) {
    return convertSwitchStatement(node, ctx, expectedReturnType);
  }
  if (node.Kind === TstsSyntax.KindThrowStatement) {
    const expression = TstsSyntax.Node_Expression(node);
    if (!expression) {
      return null;
    }
    return {
      kind: "throwStatement",
      expression: convertExpression(expression, ctx, undefined),
    };
  }
  if (node.Kind === TstsSyntax.KindTryStatement) {
    return convertTryStatement(node, ctx, expectedReturnType);
  }
  if (node.Kind === TstsSyntax.KindBlock) {
    return convertBlockStatement(node, ctx, expectedReturnType);
  }
  if (node.Kind === TstsSyntax.KindBreakStatement) {
    return {
      kind: "breakStatement",
      label: getTstsNodeText(TstsSyntax.Node_Label(node)),
    };
  }
  if (node.Kind === TstsSyntax.KindContinueStatement) {
    return {
      kind: "continueStatement",
      label: getTstsNodeText(TstsSyntax.Node_Label(node)),
    };
  }
  if (node.Kind === TstsSyntax.KindEmptyStatement) {
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
  node: TstsNode,
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
