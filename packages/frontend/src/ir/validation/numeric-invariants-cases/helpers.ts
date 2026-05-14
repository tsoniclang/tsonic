/**
 * Shared test helpers for numeric invariants tests.
 *
 * Re-exports mocha/chai and provides factory functions for IR nodes
 * used across all numeric-invariant topic test files.
 */

export { describe, it } from "mocha";
export { expect } from "chai";

export { runNumericProofPass } from "../numeric-proof-pass.js";
export type {
  IrModule,
  IrExpression,
  IrType,
  IrStatement,
  IrNumericNarrowingExpression,
  IrMemberExpression,
  IrBlockStatement,
  IrParameter,
} from "../../types.js";

import type {
  IrModule,
  IrExpression,
  IrType,
  IrStatement,
  IrNumericNarrowingExpression,
  IrBlockStatement,
  IrParameter,
} from "../../types.js";
import { createIfBranchPlans } from "../../converters/statements/control/if-branch-plan.js";

const normalizeTestBlock = (block: IrBlockStatement): IrBlockStatement => ({
  ...block,
  statements: block.statements.map(normalizeTestStatement),
});

const normalizeTestStatement = (statement: unknown): IrStatement => {
  const stmt = statement as IrStatement;

  switch (stmt.kind) {
    case "blockStatement":
      return normalizeTestBlock(stmt);
    case "ifStatement": {
      const branchPlans =
        stmt.thenPlan && stmt.elsePlan
          ? { thenPlan: stmt.thenPlan, elsePlan: stmt.elsePlan }
          : createIfBranchPlans(stmt.condition);
      return {
        ...stmt,
        thenStatement: normalizeTestStatement(stmt.thenStatement),
        ...(stmt.elseStatement
          ? { elseStatement: normalizeTestStatement(stmt.elseStatement) }
          : {}),
        ...branchPlans,
      };
    }
    default:
      return stmt;
  }
};

/**
 * Helper to create a minimal module with statements
 */
export const createModule = (
  body: readonly unknown[],
  filePath = "/src/test.ts"
): IrModule => ({
  kind: "module",
  filePath,
  namespace: "Test",
  className: "test",
  isStaticContainer: true,
  imports: [],
  body: body.map(normalizeTestStatement),
  exports: [],
});

/**
 * Helper to create a variable declaration with an expression
 */
export const createVarDecl = (
  name: string,
  init: IrExpression,
  declarationKind: "const" | "let" = "const"
): IrStatement => ({
  kind: "variableDeclaration",
  declarationKind,
  isExported: false,
  declarations: [
    {
      kind: "variableDeclarator",
      name: { kind: "identifierPattern", name },
      initializer: init,
    },
  ],
});

/**
 * Helper to create a numeric literal
 */
export const numLiteral = (value: number, raw?: string): IrExpression => ({
  kind: "literal",
  value,
  raw: raw ?? String(value),
  inferredType: { kind: "primitiveType", name: "number" },
});

/**
 * Helper to create a numeric narrowing expression
 * INVARIANT: "Int32" -> primitiveType(name="int"), others -> referenceType
 */
export const narrowTo = (
  expr: IrExpression,
  targetKind: "Int32" | "Int64" | "Double" | "Byte"
): IrNumericNarrowingExpression => ({
  kind: "numericNarrowing",
  expression: expr,
  targetKind,
  inferredType:
    targetKind === "Int32"
      ? { kind: "primitiveType", name: "int" }
      : { kind: "referenceType", name: targetKind },
});

/**
 * Helper to create an identifier expression
 */
export const ident = (name: string): IrExpression => ({
  kind: "identifier",
  name,
  inferredType: { kind: "primitiveType", name: "number" },
});

/**
 * Helper to create an array access expression
 * Includes accessKind: "clrIndexer" to match IR build behavior
 */
export const arrayAccess = (
  object: IrExpression,
  index: IrExpression
): IrExpression => ({
  kind: "memberAccess",
  object,
  property: index,
  isComputed: true,
  isOptional: false,
  accessKind: "clrIndexer", // Set by IR converter for array types
  inferredType: { kind: "primitiveType", name: "number" },
});

/**
 * Helper to create an array identifier
 */
export const arrayIdent = (name: string): IrExpression => ({
  kind: "identifier",
  name,
  inferredType: {
    kind: "arrayType",
    elementType: { kind: "primitiveType", name: "number" },
  },
});

/**
 * Helper to create a binary expression
 */
export const binaryExpr = (
  operator: "+" | "-" | "*" | "/",
  left: IrExpression,
  right: IrExpression
): IrExpression => ({
  kind: "binary",
  operator,
  left,
  right,
  inferredType: { kind: "primitiveType", name: "number" },
});

/**
 * Helper to create a logical expression.
 */
export const logicalExpr = (
  operator: "&&" | "||" | "??",
  left: IrExpression,
  right: IrExpression,
  inferredType: IrType
): IrExpression => ({
  kind: "logical",
  operator,
  left,
  right,
  inferredType,
});

export const booleanType: IrType = { kind: "primitiveType", name: "boolean" };

export const memberCall = (
  objectName: string,
  methodName: string,
  args: IrExpression[],
  inferredType: IrType = booleanType
): IrExpression => ({
  kind: "call",
  callee: {
    kind: "memberAccess",
    object: ident(objectName),
    property: methodName,
    isComputed: false,
    isOptional: false,
    inferredType: { kind: "unknownType" },
  },
  arguments: args,
  isOptional: false,
  inferredType,
});

export const compareExpr = (
  operator: "<" | "<=" | ">" | ">=",
  left: IrExpression,
  right: IrExpression
): IrExpression => ({
  kind: "binary",
  operator,
  left,
  right,
  inferredType: booleanType,
});

export const block = (statements: readonly unknown[]): IrBlockStatement => ({
  kind: "blockStatement",
  statements: statements.map(normalizeTestStatement),
});

export const parameter = (name: string, type: IrType): IrParameter => ({
  kind: "parameter",
  pattern: { kind: "identifierPattern", name },
  type,
  isOptional: false,
  isRest: false,
  passing: "value",
});

/**
 * Helper to create an array expression
 */
export const arrayExpr = (elements: IrExpression[]): IrExpression => ({
  kind: "array",
  elements,
  inferredType: {
    kind: "arrayType",
    elementType: { kind: "primitiveType", name: "number" },
  },
});

export const conditionalExpr = (
  condition: IrExpression,
  whenTrue: IrExpression,
  whenFalse: IrExpression,
  inferredType: IrType
): IrExpression => ({
  kind: "conditional",
  condition,
  whenTrue,
  whenFalse,
  inferredType,
});
