/**
 * Block and simple statement emitters
 *
 * Returns CSharpStatementAst nodes. Multi-statement lowerings (e.g., void-return
 * splitting into `expr; return;`) return arrays of statements that the parent
 * block flattens into its own statements array.
 */

import { IrStatement, IrExpression } from "@tsonic/frontend";
import { EmitterContext, getIndent } from "../types.js";
import { emitExpressionAst } from "../expression-emitter.js";
import { emitStatementAst } from "../statement-emitter.js";
import { lowerPatternAst } from "../patterns.js";
import { allocateLocalName } from "../core/format/local-names.js";
import { printStatementFlatBlock } from "../core/format/backend-ast/printer.js";
import type {
  CSharpStatementAst,
  CSharpBlockStatementAst,
  CSharpExpressionAst,
} from "../core/format/backend-ast/types.js";

/**
 * Emit a block statement as AST
 */
export const emitBlockStatementAst = (
  stmt: Extract<IrStatement, { kind: "blockStatement" }>,
  context: EmitterContext
): [CSharpBlockStatementAst, EmitterContext] => {
  const outerNameMap = context.localNameMap;
  // New lexical scope for locals (prevents C# CS0136 shadowing errors).
  let currentContext: EmitterContext = {
    ...context,
    localNameMap: new Map(outerNameMap ?? []),
  };
  const statements: CSharpStatementAst[] = [];

  for (const s of stmt.statements) {
    const [stmts, newContext] = emitStatementAst(s, currentContext);
    statements.push(...stmts);
    currentContext = newContext;
  }

  return [
    { kind: "blockStatement", statements },
    { ...currentContext, localNameMap: outerNameMap },
  ];
};

/**
 * Emit a return statement as AST.
 * Uses context.returnType to pass expectedType for null → default conversion in generic contexts.
 *
 * Returns an array because void-return lowering may produce multiple statements
 * (e.g., `expr; return;` for side-effectful expressions in void-returning functions).
 */
export const emitReturnStatementAst = (
  stmt: Extract<IrStatement, { kind: "returnStatement" }>,
  context: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  if (stmt.expression) {
    // In TypeScript, `return expr;` is permitted in a `void`-returning function and
    // simply returns `undefined` after evaluating `expr` for side effects.
    //
    // C# forbids `return <expr>;` in a `void` method, so lower it to:
    //   <eval expr>;
    //   return;
    if (
      context.returnType?.kind === "voidType" ||
      context.returnType?.kind === "neverType"
    ) {
      const expr =
        stmt.expression.kind === "unary" && stmt.expression.operator === "void"
          ? stmt.expression.expression
          : stmt.expression;

      const isNoopExpr =
        (expr.kind === "literal" &&
          (expr.value === undefined || expr.value === null)) ||
        (expr.kind === "identifier" &&
          (expr.name === "undefined" || expr.name === "null"));

      const [exprAst, newContext] = emitExpressionAst(expr, context);

      if (isNoopExpr) {
        return [[{ kind: "returnStatement" }], newContext];
      }

      const returnStmt: CSharpStatementAst = { kind: "returnStatement" };

      if (
        expr.kind === "call" ||
        expr.kind === "new" ||
        expr.kind === "assignment" ||
        expr.kind === "update" ||
        expr.kind === "await"
      ) {
        return [
          [{ kind: "expressionStatement", expression: exprAst }, returnStmt],
          newContext,
        ];
      }

      // Use discard assignment for expressions that aren't valid C# statement-expressions
      const discardAssign: CSharpExpressionAst = {
        kind: "assignmentExpression",
        operatorToken: "=",
        left: { kind: "identifierExpression", identifier: "_" },
        right: exprAst,
      };
      return [
        [
          { kind: "expressionStatement", expression: discardAssign },
          returnStmt,
        ],
        newContext,
      ];
    }

    // Pass returnType as expectedType for null → default conversion in generic contexts
    const [exprAst, newContext] = emitExpressionAst(
      stmt.expression,
      context,
      context.returnType
    );
    return [[{ kind: "returnStatement", expression: exprAst }], newContext];
  }

  return [[{ kind: "returnStatement" }], context];
};

/**
 * Emit yield expression as C# yield return with exchange object pattern
 * (Legacy handler for IrYieldExpression - used for unidirectional generators)
 *
 * TypeScript: yield value
 * C#:
 *   exchange.Output = value;
 *   yield return exchange;
 *
 * TypeScript: yield* otherGenerator()
 * C#:
 *   foreach (var item in OtherGenerator())
 *     yield return item;
 */
export const emitYieldExpressionAst = (
  expr: Extract<IrExpression, { kind: "yield" }>,
  context: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  let currentContext = context;
  const parts: CSharpStatementAst[] = [];

  if (expr.delegate) {
    // yield* delegation
    if (expr.expression) {
      const [delegateAst, newContext] = emitExpressionAst(
        expr.expression,
        currentContext
      );
      currentContext = newContext;
      // Use await foreach for async generators, foreach for sync
      const itemAlloc = allocateLocalName("item", currentContext);
      currentContext = itemAlloc.context;
      parts.push({
        kind: "foreachStatement",
        isAwait: currentContext.isAsync,
        type: { kind: "varType" },
        identifier: itemAlloc.emittedName,
        expression: delegateAst,
        body: {
          kind: "yieldStatement",
          isBreak: false,
          expression: {
            kind: "identifierExpression",
            identifier: itemAlloc.emittedName,
          },
        },
      });
    }
  } else {
    // Regular yield
    if (expr.expression) {
      const [valueAst, newContext] = emitExpressionAst(
        expr.expression,
        currentContext
      );
      currentContext = newContext;
      const exchangeVar = currentContext.generatorExchangeVar ?? "exchange";
      parts.push({
        kind: "expressionStatement",
        expression: {
          kind: "assignmentExpression",
          operatorToken: "=",
          left: {
            kind: "memberAccessExpression",
            expression: {
              kind: "identifierExpression",
              identifier: exchangeVar,
            },
            memberName: "Output",
          },
          right: valueAst,
        },
      });
      parts.push({
        kind: "yieldStatement",
        isBreak: false,
        expression: {
          kind: "identifierExpression",
          identifier: exchangeVar,
        },
      });
    } else {
      // Bare yield (no value)
      const exchangeVar = currentContext.generatorExchangeVar ?? "exchange";
      parts.push({
        kind: "yieldStatement",
        isBreak: false,
        expression: {
          kind: "identifierExpression",
          identifier: exchangeVar,
        },
      });
    }
  }

  return [parts, currentContext];
};

/**
 * Emit IrYieldStatement (lowered form from yield-lowering pass)
 * Handles bidirectional communication: const x = yield value;
 *
 * TypeScript: const x = yield value;
 * C#:
 *   exchange.Output = value;
 *   yield return exchange;
 *   var x = exchange.Input;  // or pattern destructuring
 *
 * TypeScript: yield value;  (no receiveTarget)
 * C#:
 *   exchange.Output = value;
 *   yield return exchange;
 */
export const emitYieldStatementAst = (
  stmt: Extract<IrStatement, { kind: "yieldStatement" }>,
  context: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  let currentContext = context;
  const parts: CSharpStatementAst[] = [];

  if (stmt.delegate) {
    // yield* delegation - emit foreach pattern
    if (stmt.output) {
      const [delegateAst, newContext] = emitExpressionAst(
        stmt.output,
        currentContext
      );
      currentContext = newContext;
      // Use await foreach for async generators, foreach for sync
      const itemAlloc = allocateLocalName("item", currentContext);
      currentContext = itemAlloc.context;
      parts.push({
        kind: "foreachStatement",
        isAwait: currentContext.isAsync,
        type: { kind: "varType" },
        identifier: itemAlloc.emittedName,
        expression: delegateAst,
        body: {
          kind: "yieldStatement",
          isBreak: false,
          expression: {
            kind: "identifierExpression",
            identifier: itemAlloc.emittedName,
          },
        },
      });
    }
  } else {
    // Regular yield with optional bidirectional support
    if (stmt.output) {
      const [valueAst, newContext] = emitExpressionAst(
        stmt.output,
        currentContext
      );
      currentContext = newContext;
      const exchangeVar = currentContext.generatorExchangeVar ?? "exchange";
      parts.push({
        kind: "expressionStatement",
        expression: {
          kind: "assignmentExpression",
          operatorToken: "=",
          left: {
            kind: "memberAccessExpression",
            expression: {
              kind: "identifierExpression",
              identifier: exchangeVar,
            },
            memberName: "Output",
          },
          right: valueAst,
        },
      });
    }
    const exchangeVar = currentContext.generatorExchangeVar ?? "exchange";
    parts.push({
      kind: "yieldStatement",
      isBreak: false,
      expression: {
        kind: "identifierExpression",
        identifier: exchangeVar,
      },
    });

    // Handle receiveTarget for bidirectional communication
    if (stmt.receiveTarget) {
      const inputExpr: CSharpExpressionAst = {
        kind: "parenthesizedExpression",
        expression: {
          kind: "binaryExpression",
          operatorToken: "??",
          left: {
            kind: "memberAccessExpression",
            expression: {
              kind: "identifierExpression",
              identifier: exchangeVar,
            },
            memberName: "Input",
          },
          right: {
            kind: "suppressNullableWarningExpression",
            expression: { kind: "defaultExpression" },
          },
        },
      };
      const lowered = lowerPatternAst(
        stmt.receiveTarget,
        inputExpr,
        stmt.receivedType,
        currentContext
      );
      parts.push(...lowered.statements);
      currentContext = lowered.context;
    }
  }

  return [parts, currentContext];
};

/**
 * Emit an expression statement as AST
 */
export const emitExpressionStatementAst = (
  stmt: Extract<IrStatement, { kind: "expressionStatement" }>,
  context: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  // Special handling for yield expressions in generators
  // Note: After yield-lowering pass, generators will have IrYieldStatement nodes instead
  // This is kept for backward compatibility with unprocessed IR
  if (stmt.expression.kind === "yield") {
    return emitYieldExpressionAst(stmt.expression, context);
  }

  // TypeScript `void expr;` evaluates `expr` and discards the result.
  //
  // In C#, expression statements are restricted (identifiers/literals can't stand
  // alone). Emit a discard assignment so we can evaluate arbitrary expressions
  // without introducing runtime helpers.
  if (stmt.expression.kind === "unary" && stmt.expression.operator === "void") {
    const operand = stmt.expression.expression;
    const [operandAst, newContext] = emitExpressionAst(operand, context);

    // If the operand is already a valid statement-expression (call/new/assignment/
    // update/await), emit it directly. Otherwise, use a discard assignment.
    if (
      operand.kind === "call" ||
      operand.kind === "new" ||
      operand.kind === "assignment" ||
      operand.kind === "update" ||
      operand.kind === "await"
    ) {
      return [
        [{ kind: "expressionStatement", expression: operandAst }],
        newContext,
      ];
    }

    const discardAssign: CSharpExpressionAst = {
      kind: "assignmentExpression",
      operatorToken: "=",
      left: { kind: "identifierExpression", identifier: "_" },
      right: operandAst,
    };
    return [
      [{ kind: "expressionStatement", expression: discardAssign }],
      newContext,
    ];
  }

  const [exprAst, newContext] = emitExpressionAst(stmt.expression, context);
  return [[{ kind: "expressionStatement", expression: exprAst }], newContext];
};

/**
 * Emit IrGeneratorReturnStatement (lowered form from yield-lowering pass)
 * Handles return statements in generators with TReturn.
 *
 * TypeScript: return "done";
 * C#:
 *   __returnValue = "done";
 *   yield break;
 *
 * TypeScript: return;  (no expression)
 * C#:
 *   yield break;
 *
 * The __returnValue variable is declared in the enclosing function emission.
 * The wrapper's _getReturnValue closure captures this value when iteration completes.
 */
export const emitGeneratorReturnStatementAst = (
  stmt: Extract<IrStatement, { kind: "generatorReturnStatement" }>,
  context: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  let currentContext = context;
  const returnVar = currentContext.generatorReturnValueVar ?? "__returnValue";
  const parts: CSharpStatementAst[] = [];

  if (stmt.expression) {
    // Capture the return value in __returnValue before terminating
    const [valueAst, newContext] = emitExpressionAst(
      stmt.expression,
      currentContext
    );
    currentContext = newContext;
    parts.push({
      kind: "expressionStatement",
      expression: {
        kind: "assignmentExpression",
        operatorToken: "=",
        left: { kind: "identifierExpression", identifier: returnVar },
        right: valueAst,
      },
    });
  }

  // Terminate the iterator
  parts.push({ kind: "yieldStatement", isBreak: true });

  return [parts, currentContext];
};

/**
 * Emit a block statement as text (backward-compatible shim).
 *
 * Routes through the AST pipeline and prints the result.
 * Used by text-based callers (e.g., static function declarations)
 * that haven't been converted to AST yet.
 *
 * Note: the old text path emitted inner statements at the same indent level
 * as the block braces. printBlockStatement (via printStatement) would add an
 * extra innerIndent, so we manually assemble the block to match the old format.
 */
export const emitBlockStatement = (
  stmt: Extract<IrStatement, { kind: "blockStatement" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const [ast, ctx] = emitBlockStatementAst(stmt, context);
  const ind = getIndent(context);
  const stmts = ast.statements
    .map((s) => printStatementFlatBlock(s, ind))
    .join("\n");
  return [`${ind}{\n${stmts}\n${ind}}`, ctx];
};
