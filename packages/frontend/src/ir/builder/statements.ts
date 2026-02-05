/**
 * Statement extraction from TypeScript source
 *
 * Phase 5 Step 4: Uses ProgramContext instead of global singletons.
 */

import * as ts from "typescript";
import { IrStatement, IrVariableDeclaration } from "../types.js";
import {
  convertStatement,
  flattenStatementResult,
} from "../statement-converter.js";
import {
  resetSyntheticRegistry,
  getSyntheticDeclarations,
} from "../converters/anonymous-synthesis.js";
import type { ProgramContext } from "../program-context.js";
import { withVariableTypeEnv } from "../converters/type-env.js";

/**
 * Extract statements from source file.
 *
 * Handles converters that return multiple statements (e.g., type aliases
 * with synthetic interface generation).
 *
 * Also collects synthetic type declarations generated during conversion
 * (from anonymous object literal synthesis) and prepends them.
 *
 * @param sourceFile - The TypeScript source file to extract from
 * @param ctx - ProgramContext for TypeSystem and binding access
 */
export const extractStatements = (
  sourceFile: ts.SourceFile,
  ctx: ProgramContext
): readonly IrStatement[] => {
  // Reset synthetic registry for this file
  resetSyntheticRegistry();

  const statements: IrStatement[] = [];
  let currentCtx = ctx;

  for (const stmt of sourceFile.statements) {
    // Skip imports and exports (handled separately)
    if (
      !ts.isImportDeclaration(stmt) &&
      !ts.isExportDeclaration(stmt) &&
      !ts.isExportAssignment(stmt)
    ) {
      const converted = convertStatement(stmt, currentCtx, undefined);
      // Flatten result (handles both single statements and arrays)
      statements.push(...flattenStatementResult(converted));

      if (
        ts.isVariableStatement(stmt) &&
        converted !== null &&
        !Array.isArray(converted)
      ) {
        const single = converted as IrStatement;
        if (single.kind !== "variableDeclaration") continue;
        currentCtx = withVariableTypeEnv(
          currentCtx,
          stmt.declarationList.declarations,
          single as IrVariableDeclaration
        );
      }
    }
  }

  // Collect synthetic declarations and prepend them
  const syntheticDecls = getSyntheticDeclarations();
  if (syntheticDecls.length > 0) {
    return [...syntheticDecls, ...statements];
  }

  return statements;
};

/**
 * Check if a statement is executable (not a declaration)
 */
export const isExecutableStatement = (stmt: IrStatement): boolean => {
  // Declarations are not executable - they become static members in the container
  const declarationKinds = [
    "functionDeclaration",
    "classDeclaration",
    "interfaceDeclaration",
    "typeAliasDeclaration",
    "enumDeclaration",
    "variableDeclaration", // Added: variable declarations become static fields
  ];

  // Empty statements are not executable
  if (stmt.kind === "emptyStatement") {
    return false;
  }

  return !declarationKinds.includes(stmt.kind);
};
