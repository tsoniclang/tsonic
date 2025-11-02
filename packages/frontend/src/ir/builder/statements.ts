/**
 * Statement extraction from TypeScript source
 */

import * as ts from "typescript";
import { IrStatement } from "../types.js";
import { convertStatement } from "../statement-converter.js";

/**
 * Extract statements from source file
 */
export const extractStatements = (
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker
): readonly IrStatement[] => {
  const statements: IrStatement[] = [];

  sourceFile.statements.forEach((stmt) => {
    // Skip imports and exports (handled separately)
    if (
      !ts.isImportDeclaration(stmt) &&
      !ts.isExportDeclaration(stmt) &&
      !ts.isExportAssignment(stmt)
    ) {
      const converted = convertStatement(stmt, checker);
      if (converted) {
        statements.push(converted);
      }
    }
  });

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
