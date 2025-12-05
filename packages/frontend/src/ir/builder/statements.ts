/**
 * Statement extraction from TypeScript source
 */

import * as ts from "typescript";
import { IrStatement } from "../types.js";
import {
  convertStatement,
  flattenStatementResult,
} from "../statement-converter.js";
import {
  resetSyntheticRegistry,
  getSyntheticDeclarations,
} from "../converters/anonymous-synthesis.js";

/**
 * Extract statements from source file.
 *
 * Handles converters that return multiple statements (e.g., type aliases
 * with synthetic interface generation).
 *
 * Also collects synthetic type declarations generated during conversion
 * (from anonymous object literal synthesis) and prepends them.
 */
export const extractStatements = (
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker
): readonly IrStatement[] => {
  // Reset synthetic registry for this file
  resetSyntheticRegistry();

  const statements: IrStatement[] = [];

  sourceFile.statements.forEach((stmt) => {
    // Skip imports and exports (handled separately)
    if (
      !ts.isImportDeclaration(stmt) &&
      !ts.isExportDeclaration(stmt) &&
      !ts.isExportAssignment(stmt)
    ) {
      const converted = convertStatement(stmt, checker);
      // Flatten result (handles both single statements and arrays)
      statements.push(...flattenStatementResult(converted));
    }
  });

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
