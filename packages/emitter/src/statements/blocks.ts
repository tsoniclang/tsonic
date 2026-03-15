/**
 * Block and simple statement emitters
 *
 * Returns CSharpStatementAst nodes. Multi-statement lowerings (e.g., void-return
 * splitting into `expr; return;`) return arrays of statements that the parent
 * block flattens into its own statements array.
 */

import { IrStatement, IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitExpressionAst } from "../expression-emitter.js";
import { emitStatementAst } from "../statement-emitter.js";
import { lowerPatternAst } from "../patterns.js";
import { allocateLocalName } from "../core/format/local-names.js";
import { identifierType } from "../core/format/backend-ast/builders.js";
import type {
  CSharpStatementAst,
  CSharpBlockStatementAst,
  CSharpExpressionAst,
} from "../core/format/backend-ast/types.js";

const ASYNC_WRAPPER_NAMES = new Set([
  "Promise",
  "PromiseLike",
  "Task",
  "ValueTask",
]);

const isAsyncWrapperType = (
  type: IrType | undefined,
  visited: Set<IrType> = new Set()
): boolean => {
  if (!type || visited.has(type)) return false;
  visited.add(type);

  if (type.kind === "referenceType") {
    const simple = type.name.includes(".")
      ? type.name.slice(type.name.lastIndexOf(".") + 1)
      : type.name;
    if (ASYNC_WRAPPER_NAMES.has(simple)) return true;
  }

  if (type.kind === "unionType" || type.kind === "intersectionType") {
    return type.types.some((t) => isAsyncWrapperType(t, visited));
  }

  return false;
};

const expressionProducesAsyncWrapper = (expr: IrExpression): boolean => {
  if (expr.kind === "identifier" || expr.kind === "memberAccess") {
    return isAsyncWrapperType(expr.inferredType);
  }

  if (expr.kind === "call" || expr.kind === "new") {
    if (isAsyncWrapperType(expr.inferredType)) return true;
    const calleeType = expr.callee.inferredType;
    if (calleeType?.kind === "functionType") {
      return isAsyncWrapperType(calleeType.returnType);
    }
  }

  return false;
};

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
      const discardLocal = allocateLocalName("__tsonic_discard", newContext);
      return [
        [
          {
            kind: "localDeclarationStatement",
            modifiers: [],
            type: identifierType("var"),
            declarators: [
              {
                name: discardLocal.emittedName,
                initializer: exprAst,
              },
            ],
          },
          returnStmt,
        ],
        discardLocal.context,
      ];
    }

    // Pass returnType as expectedType for null → default conversion in generic contexts
    const [exprAst, newContext] = emitExpressionAst(
      stmt.expression,
      context,
      context.returnType
    );

    const shouldAutoAwait =
      context.isAsync &&
      context.returnType !== undefined &&
      !isAsyncWrapperType(context.returnType) &&
      expressionProducesAsyncWrapper(stmt.expression) &&
      stmt.expression.kind !== "await";

    return [
      [
        {
          kind: "returnStatement",
          expression: shouldAutoAwait
            ? { kind: "awaitExpression", expression: exprAst }
            : exprAst,
        },
      ],
      newContext,
    ];
  }

  return [[{ kind: "returnStatement" }], context];
};

/**
 * Emit yield expression as C# yield return with exchange object pattern
 * (Handler for IrYieldExpression in unidirectional generators)
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
  // Handles unprocessed IR (before yield-lowering pass)
  if (stmt.expression.kind === "yield") {
    return emitYieldExpressionAst(stmt.expression, context);
  }

  const isNoopVoidOperand = (
    expr: IrExpression,
    state: EmitterContext
  ): boolean => {
    if (
      expr.kind === "literal" &&
      (expr.value === undefined || expr.value === null)
    ) {
      return true;
    }

    if (expr.kind !== "identifier") {
      return false;
    }

    if (expr.resolvedClrType !== undefined) {
      return true;
    }

    const importBinding = state.importBindings?.get(expr.name);
    if (importBinding?.kind === "namespace" || importBinding?.kind === "type") {
      return true;
    }

    return false;
  };

  const isMethodGroupAccess = (
    expr: IrExpression
  ): expr is Extract<IrExpression, { kind: "memberAccess" }> => {
    if (expr.kind !== "memberAccess") return false;
    return expr.memberBinding?.kind === "method";
  };

  const emitVoidOperandAst = (
    expr: IrExpression,
    state: EmitterContext
  ): [readonly CSharpStatementAst[], EmitterContext] => {
    if (isMethodGroupAccess(expr)) {
      return emitVoidOperandAst(expr.object, state);
    }

    if (isNoopVoidOperand(expr, state)) {
      return [[], state];
    }

    const [exprAst, newContext] = emitExpressionAst(expr, state);

    if (
      expr.kind === "call" ||
      expr.kind === "new" ||
      expr.kind === "assignment" ||
      expr.kind === "update" ||
      expr.kind === "await"
    ) {
      return [
        [{ kind: "expressionStatement", expression: exprAst }],
        newContext,
      ];
    }

    const discardLocal = allocateLocalName("__tsonic_discard", newContext);
    return [
      [
        {
          kind: "localDeclarationStatement",
          modifiers: [],
          type: identifierType("var"),
          declarators: [
            {
              name: discardLocal.emittedName,
              initializer: exprAst,
            },
          ],
        },
      ],
      discardLocal.context,
    ];
  };

  // TypeScript `void expr;` evaluates `expr` and discards the result.
  //
  // In C#, expression statements are restricted. Lower to the smallest
  // side-effect-preserving statement sequence we can represent deterministically.
  if (stmt.expression.kind === "unary" && stmt.expression.operator === "void") {
    return emitVoidOperandAst(stmt.expression.expression, context);
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
