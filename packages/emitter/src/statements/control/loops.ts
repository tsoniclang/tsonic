/**
 * Loop statement emitters (while, for, for-of, for-in)
 * Returns CSharpStatementAst nodes.
 */

import { IrStatement } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitStatementAst } from "../../statement-emitter.js";
import { lowerPatternAst } from "../../patterns.js";
import {
  resolveTypeAlias,
  stripNullish,
} from "../../core/semantic/type-resolution.js";
import { deriveForOfElementType } from "../../core/semantic/iteration-types.js";
import {
  emitBooleanConditionAst,
} from "../../core/semantic/boolean-context.js";
import {
  allocateLocalName,
  registerLocalName,
} from "../../core/format/local-names.js";
import {
  registerForOfElementSymbolTypes,
  registerForInKeyTypes,
} from "../../core/semantic/symbol-types.js";
import { decimalIntegerLiteral } from "../../core/format/backend-ast/builders.js";
import type {
  CSharpStatementAst,
  CSharpExpressionAst,
  CSharpLocalDeclarationStatementAst,
} from "../../core/format/backend-ast/types.js";
import {
  detectCanonicalIntLoop,
  wrapInBlock,
  emitExprAstCb,
} from "./loop-helpers.js";

/**
 * Emit a while statement as AST
 */
export const emitWhileStatementAst = (
  stmt: Extract<IrStatement, { kind: "whileStatement" }>,
  context: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  const [condAst, condContext] = emitBooleanConditionAst(
    stmt.condition,
    emitExprAstCb,
    context
  );

  const [bodyStmts, bodyContext] = emitStatementAst(stmt.body, condContext);

  const whileStmt: CSharpStatementAst = {
    kind: "whileStatement",
    condition: condAst,
    body: wrapInBlock(bodyStmts),
  };

  return [[whileStmt], bodyContext];
};

/**
 * Emit a for statement as AST
 *
 * Special handling for canonical integer loop counters:
 * `for (let i = 0; i < n; i++)` emits as `for (int i = 0; ...)` in C#.
 * This avoids the double→int conversion cost when using loop variables
 * as CLR indexers (e.g., list[i]).
 */
export const emitForStatementAst = (
  stmt: Extract<IrStatement, { kind: "forStatement" }>,
  context: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  const outerNameMap = context.localNameMap;
  const outerSemanticTypes = context.localSemanticTypes;
  const outerValueTypes = context.localValueTypes;
  let currentContext: EmitterContext = {
    ...context,
    localNameMap: new Map(outerNameMap ?? []),
  };

  // Check for canonical integer loop pattern
  const canonicalLoop = detectCanonicalIntLoop(stmt);

  // Initializer
  let declaration: CSharpLocalDeclarationStatementAst | undefined;
  let initializers: CSharpExpressionAst[] | undefined;

  if (stmt.initializer) {
    if (canonicalLoop) {
      // Canonical integer loop: emit `int varName = value` directly
      const alloc = allocateLocalName(canonicalLoop.varName, currentContext);
      currentContext = registerLocalName(
        canonicalLoop.varName,
        alloc.emittedName,
        alloc.context
      );
      declaration = {
        kind: "localDeclarationStatement",
        modifiers: [],
        type: { kind: "predefinedType", keyword: "int" },
        declarators: [
          {
            name: alloc.emittedName,
            initializer: decimalIntegerLiteral(canonicalLoop.initialValue),
          },
        ],
      };
    } else if (stmt.initializer.kind === "variableDeclaration") {
      // Non-canonical variable declaration: emit through AST pipeline
      const [initStmts, newContext] = emitStatementAst(
        stmt.initializer,
        currentContext
      );
      currentContext = newContext;
      // For for-loop initializers, expect a single localDeclarationStatement.
      // Multi-statement initializers (destructuring) are not valid in C# for-loops.
      if (
        initStmts.length === 1 &&
        initStmts[0]?.kind === "localDeclarationStatement"
      ) {
        declaration = initStmts[0];
      } else {
        throw new Error(
          `ICE: For-loop variable initializer produced ${initStmts.length} statements ` +
            `(expected single localDeclarationStatement). Complex destructuring in for-loop ` +
            `initializers is not supported.`
        );
      }
    } else {
      // Expression initializer
      const [initAst, newContext] = emitExpressionAst(
        stmt.initializer,
        currentContext
      );
      currentContext = newContext;
      initializers = [initAst];
    }
  }

  // Condition
  let condition: CSharpExpressionAst | undefined;
  if (stmt.condition) {
    const [condAst, newContext] = emitBooleanConditionAst(
      stmt.condition,
      emitExprAstCb,
      currentContext
    );
    currentContext = newContext;
    condition = condAst;
  }

  // Update
  const incrementors: CSharpExpressionAst[] = [];
  if (stmt.update) {
    const [updateAst, newContext] = emitExpressionAst(
      stmt.update,
      currentContext
    );
    currentContext = newContext;
    incrementors.push(updateAst);
  }

  // Body - if canonical loop, add the var to intLoopVars so indexers don't cast
  const bodyContextBase: EmitterContext = canonicalLoop
    ? (() => {
        const existingIntVars = currentContext.intLoopVars ?? new Set<string>();
        const emittedName =
          currentContext.localNameMap?.get(canonicalLoop.varName) ??
          canonicalLoop.varName;
        const newIntVars = new Set([...existingIntVars, emittedName]);
        return { ...currentContext, intLoopVars: newIntVars };
      })()
    : currentContext;

  const [bodyStmts, bodyContext] = emitStatementAst(stmt.body, bodyContextBase);

  // Restore intLoopVars after body (remove canonical loop var from scope)
  const finalBodyContext: EmitterContext = canonicalLoop
    ? {
        ...bodyContext,
        intLoopVars: currentContext.intLoopVars ?? new Set<string>(),
      }
    : bodyContext;

  const forStmt: CSharpStatementAst = {
    kind: "forStatement",
    declaration,
    initializers,
    condition,
    incrementors,
    body: wrapInBlock(bodyStmts),
  };

  return [
    [forStmt],
    {
      ...finalBodyContext,
      localNameMap: outerNameMap,
      localSemanticTypes: outerSemanticTypes,
      localValueTypes: outerValueTypes,
    },
  ];
};

/**
 * Emit a for-of statement as AST
 *
 * TypeScript: for (const x of items) { ... }
 * C#: foreach (var x in items) { ... }
 *
 * TypeScript: for await (const x of asyncItems) { ... }
 * C#: await foreach (var x in asyncItems) { ... }
 */
export const emitForOfStatementAst = (
  stmt: Extract<IrStatement, { kind: "forOfStatement" }>,
  context: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  const [exprAst, exprContext] = emitExpressionAst(stmt.expression, context);
  const outerNameMap = exprContext.localNameMap;
  const outerSemanticTypes = exprContext.localSemanticTypes;
  const outerValueTypes = exprContext.localValueTypes;
  let loopContext: EmitterContext = {
    ...exprContext,
    localNameMap: new Map(outerNameMap ?? []),
  };

  const semanticElementType = deriveForOfElementType(
    stmt.expression.inferredType,
    loopContext
  );

  if (stmt.variable.kind === "identifierPattern") {
    // Simple identifier: for (const x of items) -> foreach (var x in items)
    const originalName = stmt.variable.name;
    const alloc = allocateLocalName(originalName, loopContext);
    loopContext = registerLocalName(
      originalName,
      alloc.emittedName,
      alloc.context
    );
    loopContext = registerForOfElementSymbolTypes(
      originalName,
      stmt.expression.inferredType,
      loopContext
    );
    const varName = alloc.emittedName;
    const [bodyStmts, bodyContext] = emitStatementAst(stmt.body, loopContext);

    const foreachStmt: CSharpStatementAst = {
      kind: "foreachStatement",
      isAwait: stmt.isAwait,
      type: { kind: "varType" },
      identifier: varName,
      expression: exprAst,
      body: wrapInBlock(bodyStmts),
    };

    return [
      [foreachStmt],
      {
        ...bodyContext,
        localNameMap: outerNameMap,
        localSemanticTypes: outerSemanticTypes,
        localValueTypes: outerValueTypes,
      },
    ];
  }

  // Complex pattern: for (const [a, b] of items) or for (const {x, y} of items)
  // Generate: foreach (var __item in items) { var a = __item[0]; var b = __item[1]; ...body... }
  const tempAlloc = allocateLocalName("__item", loopContext);
  const tempVar = tempAlloc.emittedName;
  loopContext = tempAlloc.context;

  // Get element type from the expression's inferred type
  const elementType = semanticElementType;

  // Lower the pattern to destructuring statements (AST)
  const lowerResult = lowerPatternAst(
    stmt.variable,
    { kind: "identifierExpression", identifier: tempVar },
    elementType,
    loopContext
  );

  // Emit the original loop body
  const [bodyStmts, bodyContext] = emitStatementAst(
    stmt.body,
    lowerResult.context
  );

  // Combine: pattern lowering + original body in a block
  const combinedStatements: CSharpStatementAst[] = [
    ...lowerResult.statements,
    ...bodyStmts,
  ];

  // If the original body was a block, flatten its statements to avoid nested blocks
  const bodyAst: CSharpStatementAst =
    combinedStatements.length === 1 && combinedStatements[0]
      ? combinedStatements[0]
      : { kind: "blockStatement", statements: combinedStatements };

  const foreachStmt: CSharpStatementAst = {
    kind: "foreachStatement",
    isAwait: stmt.isAwait,
    type: { kind: "varType" },
    identifier: tempVar,
    expression: exprAst,
    body: bodyAst,
  };

  return [
    [foreachStmt],
    {
      ...bodyContext,
      localNameMap: outerNameMap,
      localSemanticTypes: outerSemanticTypes,
      localValueTypes: outerValueTypes,
    },
  ];
};

/**
 * Emit a for-in statement as AST
 *
 * TypeScript: for (const k in dict) { ... }
 * C#: foreach (var k in dict.Keys) { ... }
 *
 * Note: We currently support for-in only for `Record<string, T>` / dictionaryType receivers.
 */
export const emitForInStatementAst = (
  stmt: Extract<IrStatement, { kind: "forInStatement" }>,
  context: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  const [exprAst, exprContext] = emitExpressionAst(stmt.expression, context);
  const outerNameMap = exprContext.localNameMap;
  const outerSemanticTypes = exprContext.localSemanticTypes;
  const outerValueTypes = exprContext.localValueTypes;
  let loopContext: EmitterContext = {
    ...exprContext,
    localNameMap: new Map(outerNameMap ?? []),
  };

  if (stmt.variable.kind !== "identifierPattern") {
    throw new Error(`for...in requires an identifier binding pattern`);
  }

  const receiverType = stmt.expression.inferredType
    ? resolveTypeAlias(stripNullish(stmt.expression.inferredType), context)
    : undefined;

  if (
    receiverType?.kind !== "dictionaryType" ||
    receiverType.keyType.kind !== "primitiveType" ||
    receiverType.keyType.name !== "string"
  ) {
    throw new Error(
      `for...in is only supported for Record<string, T> dictionaries (got ${receiverType?.kind ?? "unknown"}).`
    );
  }

  const originalName = stmt.variable.name;
  const alloc = allocateLocalName(originalName, loopContext);
  loopContext = registerLocalName(
    originalName,
    alloc.emittedName,
    alloc.context
  );
  loopContext = registerForInKeyTypes(originalName, loopContext);
  const varName = alloc.emittedName;

  // Iterate over .Keys: (expr).Keys
  const keysExpr: CSharpExpressionAst = {
    kind: "memberAccessExpression",
    expression: {
      kind: "parenthesizedExpression",
      expression: exprAst,
    },
    memberName: "Keys",
  };

  const [bodyStmts, bodyContext] = emitStatementAst(stmt.body, loopContext);

  const foreachStmt: CSharpStatementAst = {
    kind: "foreachStatement",
    isAwait: false,
    type: { kind: "varType" },
    identifier: varName,
    expression: keysExpr,
    body: wrapInBlock(bodyStmts),
  };

  return [
    [foreachStmt],
    {
      ...bodyContext,
      localNameMap: outerNameMap,
      localSemanticTypes: outerSemanticTypes,
      localValueTypes: outerValueTypes,
    },
  ];
};
