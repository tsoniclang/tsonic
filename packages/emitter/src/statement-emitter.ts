/**
 * Statement Emitter - IR statements to C# AST nodes
 * Main dispatcher - delegates to specialized modules
 *
 * emitStatementAst: returns CSharpStatementAst[] (the AST pipeline)
 * emitStatement: backward-compatible text shim for callers not yet on AST
 */

import { IrStatement } from "@tsonic/frontend";
import { EmitterContext, getIndent } from "./types.js";
import type { CSharpStatementAst } from "./core/format/backend-ast/types.js";
import {
  printStatementFlatBlock,
  printTypeDeclaration,
  printMember,
} from "./core/format/backend-ast/printer.js";

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

// Text-based declaration emitters (module-level, not yet on AST)
import {
  emitClassDeclaration,
  emitInterfaceDeclaration,
  emitEnumDeclaration,
  emitTypeAliasDeclaration,
  emitVariableDeclaration,
  emitFunctionDeclaration,
} from "./statements/declarations.js";

/**
 * Emit an IR statement as C# AST nodes.
 *
 * Returns an array because some IR statements lower to multiple C# statements
 * (e.g., void-return splitting, yield exchange patterns, destructuring).
 * The parent block flattens these into its own statements array.
 *
 * Only handles true statement-level emissions. Module-level declarations
 * (class, interface, enum, type-alias) are handled by the text shim.
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

    // Module-level declarations are handled by the text shim below.
    // If they reach here, it's an ICE.
    case "classDeclaration":
    case "interfaceDeclaration":
    case "enumDeclaration":
    case "typeAliasDeclaration":
      throw new Error(
        `ICE: Module-level declaration ${stmt.kind} reached emitStatementAst. ` +
          `Use emitStatement (text shim) for module-level declarations.`
      );

    default:
      throw new Error(
        `Unhandled IR statement kind: ${String((stmt as { kind?: unknown }).kind)}`
      );
  }
};

/**
 * Emit a C# statement from an IR statement (backward-compatible text shim).
 *
 * Routes module-level declarations (class, interface, enum, type-alias,
 * and static variable/function declarations) to text-based emitters.
 * Everything else goes through the AST pipeline and is printed.
 */
export const emitStatement = (
  stmt: IrStatement,
  context: EmitterContext
): [string, EmitterContext] => {
  // Module-level type declarations - still text-based
  switch (stmt.kind) {
    case "classDeclaration": {
      const [classDecls, classCtx] = emitClassDeclaration(stmt, context);
      const ind = getIndent(context);
      const code = classDecls
        .map((d) => printTypeDeclaration(d, ind))
        .join("\n");
      return [code, classCtx];
    }

    case "interfaceDeclaration": {
      const [ifaceDecls, ifaceCtx] = emitInterfaceDeclaration(stmt, context);
      const ind = getIndent(context);
      const code = ifaceDecls
        .map((d) => printTypeDeclaration(d, ind))
        .join("\n");
      return [code, ifaceCtx];
    }

    case "enumDeclaration": {
      const [enumAst, enumCtx] = emitEnumDeclaration(stmt, context);
      const ind = getIndent(context);
      return [printTypeDeclaration(enumAst, ind), enumCtx];
    }

    case "typeAliasDeclaration": {
      const [aliasAst, aliasCtx, commentText] = emitTypeAliasDeclaration(
        stmt,
        context
      );
      const ind = getIndent(context);
      if (aliasAst) {
        return [printTypeDeclaration(aliasAst, ind), aliasCtx];
      }
      // Non-structural alias → comment
      return [commentText ?? `${ind}// type ${stmt.name}`, aliasCtx];
    }

    // Static variable/function declarations are module-level members,
    // not statement-level AST. Route to text emitters.
    case "variableDeclaration":
      if (context.isStatic) {
        const [varMembers, varCtx] = emitVariableDeclaration(stmt, context);
        const varInd = getIndent(context);
        const varCode = varMembers
          .map((m) => printMember(m, varInd))
          .join("\n");
        return [varCode, varCtx];
      }
      break;

    case "functionDeclaration":
      if (context.isStatic) {
        const [funcMembers, funcCtx] = emitFunctionDeclaration(stmt, context);
        const ind = getIndent(context);
        const code = funcMembers.map((m) => printMember(m, ind)).join("\n\n");
        return [code, funcCtx];
      }
      break;
  }

  // Statement-level: use AST pipeline and print to text.
  // Use printStatementFlatBlock so that blockStatement ASTs are printed
  // with the old Tsonic convention (braces and inner at same indent level)
  // rather than the printer's standard C# convention (inner at +4).
  const [stmts, ctx] = emitStatementAst(stmt, context);
  const ind = getIndent(context);
  const text = stmts.map((s) => printStatementFlatBlock(s, ind)).join("\n");
  return [text, ctx];
};

// Re-export for backward compatibility
export { emitBlockStatementAst } from "./statements/blocks.js";
export { emitParameters } from "./statements/classes.js";
