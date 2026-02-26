/**
 * Statement Emitter - IR statements to C# AST nodes
 * Main dispatcher - delegates to specialized modules
 *
 * emitStatementAst: returns CSharpStatementAst[] (the AST pipeline)
 */

import { IrStatement } from "@tsonic/frontend";
import { EmitterContext } from "./types.js";
import type { CSharpStatementAst } from "./core/format/backend-ast/types.js";

// Import AST statement emitters from specialized modules
import {
  emitBlockStatementAst,
  emitReturnStatementAst,
  emitExpressionStatementAst,
  emitYieldStatementAst,
  emitGeneratorReturnStatementAst,
} from "./statements/blocks.js";

import {
  emitIfStatementAst,
  emitWhileStatementAst,
  emitForStatementAst,
  emitForOfStatementAst,
  emitForInStatementAst,
  emitSwitchStatementAst,
  emitTryStatementAst,
  emitThrowStatementAst,
} from "./statements/control.js";

import {
  emitVariableDeclarationAst,
  emitFunctionDeclarationAst,
} from "./statements/declarations.js";

/**
 * Emit an IR statement as C# AST nodes.
 *
 * Returns an array because some IR statements lower to multiple C# statements
 * (e.g., void-return splitting, yield exchange patterns, destructuring).
 * The parent block flattens these into its own statements array.
 *
 * Only handles true statement-level emissions. Module-level declarations
 * (class, interface, enum, type-alias) should use the AST declaration
 * emitters from statements/declarations.js directly.
 */
export const emitStatementAst = (
  stmt: IrStatement,
  context: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  switch (stmt.kind) {
    case "blockStatement": {
      const [ast, ctx] = emitBlockStatementAst(stmt, context);
      return [[ast], ctx];
    }

    case "returnStatement":
      return emitReturnStatementAst(stmt, context);

    case "expressionStatement":
      return emitExpressionStatementAst(stmt, context);

    case "yieldStatement":
      return emitYieldStatementAst(stmt, context);

    case "generatorReturnStatement":
      return emitGeneratorReturnStatementAst(stmt, context);

    case "ifStatement":
      return emitIfStatementAst(stmt, context);

    case "whileStatement":
      return emitWhileStatementAst(stmt, context);

    case "forStatement":
      return emitForStatementAst(stmt, context);

    case "forOfStatement":
      return emitForOfStatementAst(stmt, context);

    case "forInStatement":
      return emitForInStatementAst(stmt, context);

    case "switchStatement":
      return emitSwitchStatementAst(stmt, context);

    case "tryStatement":
      return emitTryStatementAst(stmt, context);

    case "throwStatement":
      return emitThrowStatementAst(stmt, context);

    case "variableDeclaration":
      return emitVariableDeclarationAst(stmt, context);

    case "functionDeclaration":
      return emitFunctionDeclarationAst(stmt, context);

    case "breakStatement":
      return [[{ kind: "breakStatement" }], context];

    case "continueStatement":
      return [[{ kind: "continueStatement" }], context];

    case "emptyStatement":
      return [[{ kind: "emptyStatement" }], context];

    // Module-level declarations should be handled by callers using
    // emitClassDeclaration/emitInterfaceDeclaration/etc. from declarations.js
    case "classDeclaration":
    case "interfaceDeclaration":
    case "enumDeclaration":
    case "typeAliasDeclaration":
      throw new Error(
        `ICE: Module-level declaration ${stmt.kind} reached emitStatementAst. ` +
          `Use the declaration emitters from statements/declarations.js directly.`
      );

    default:
      throw new Error(
        `Unhandled IR statement kind: ${String((stmt as { kind?: unknown }).kind)}`
      );
  }
};

// Re-export from barrel
export { emitBlockStatementAst } from "./statements/blocks.js";
export { emitParameters } from "./statements/classes.js";
