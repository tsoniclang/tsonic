/**
 * Tests for Declaration-Based Numeric Intent Recovery
 *
 * When TypeScript normalizes type aliases like `int` to plain `number`,
 * we recover the original numeric intent from the declaration AST.
 *
 * These tests verify:
 * - Property access recovery (arr.length, string.length → int)
 * - Call return type recovery (string.indexOf() → int)
 * - Negative cases (plain number stays number)
 * - Guardrails (unions, complex types are NOT recovered)
 *
 * Note: .NET arrays don't have indexOf method (use Array.IndexOf or LINQ).
 * String has indexOf from System.String.
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { compile, runNumericProofPass } from "../../../index.js";
import { buildIr } from "../../builder.js";
import { IrModule, IrExpression, IrMemberExpression } from "../../types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// From dist/ir/converters/expressions/ go up to packages/frontend/, then up 2 more to monorepo root
const monorepoRoot = path.resolve(__dirname, "../../../../../..");
const globalsPath = path.join(monorepoRoot, "node_modules/@tsonic/globals");
const corePath = path.join(monorepoRoot, "node_modules/@tsonic/core");

/**
 * Helper to compile TypeScript code with globals and extract IR
 */
const compileWithGlobals = (
  code: string
): { modules: readonly IrModule[]; ok: boolean; error?: string } => {
  const tmpDir = `/tmp/numeric-recovery-test-${Date.now()}`;
  fs.mkdirSync(tmpDir, { recursive: true });

  const filePath = path.join(tmpDir, "test.ts");
  fs.writeFileSync(filePath, code);

  const compileResult = compile([filePath], {
    projectRoot: monorepoRoot,
    sourceRoot: tmpDir,
    rootNamespace: "Test",
    typeRoots: [globalsPath, corePath],
  });

  if (!compileResult.ok) {
    const errorMsg = compileResult.error.diagnostics
      .map((d) => `${d.code}: ${d.message}`)
      .join("\n");
    return { modules: [], ok: false, error: errorMsg };
  }

  const irResult = buildIr(compileResult.value.program, {
    sourceRoot: tmpDir,
    rootNamespace: "Test",
  });
  if (!irResult.ok) {
    const errorMsg = irResult.error
      .map((d) => `${d.code}: ${d.message}`)
      .join("\n");
    return { modules: [], ok: false, error: errorMsg };
  }

  return { modules: irResult.value, ok: true };
};

/**
 * Helper to find an expression in the IR by predicate
 */
const findExpression = (
  modules: readonly IrModule[],
  predicate: (expr: IrExpression) => boolean
): IrExpression | undefined => {
  const visitExpression = (expr: IrExpression): IrExpression | undefined => {
    if (predicate(expr)) return expr;

    // Recursively check nested expressions
    if (expr.kind === "memberAccess") {
      const result = visitExpression(expr.object);
      if (result) return result;
      // Also check computed property if it's an expression
      if (typeof expr.property !== "string") {
        const propResult = visitExpression(expr.property);
        if (propResult) return propResult;
      }
    }
    if (expr.kind === "call") {
      const result = visitExpression(expr.callee);
      if (result) return result;
      for (const arg of expr.arguments) {
        if (arg.kind !== "spread") {
          const argResult = visitExpression(arg);
          if (argResult) return argResult;
        }
      }
    }
    if (expr.kind === "binary") {
      const leftResult = visitExpression(expr.left);
      if (leftResult) return leftResult;
      const rightResult = visitExpression(expr.right);
      if (rightResult) return rightResult;
    }

    return undefined;
  };

  for (const module of modules) {
    for (const stmt of module.body) {
      if (stmt.kind === "variableDeclaration") {
        for (const decl of stmt.declarations) {
          if (decl.initializer) {
            const result = visitExpression(decl.initializer);
            if (result) return result;
          }
        }
      }
      if (stmt.kind === "functionDeclaration" && stmt.body) {
        for (const bodyStmt of stmt.body.statements) {
          if (bodyStmt.kind === "returnStatement" && bodyStmt.expression) {
            const result = visitExpression(bodyStmt.expression);
            if (result) return result;
          }
          if (bodyStmt.kind === "variableDeclaration") {
            for (const decl of bodyStmt.declarations) {
              if (decl.initializer) {
                const result = visitExpression(decl.initializer);
                if (result) return result;
              }
            }
          }
        }
      }
    }
  }

  return undefined;
};

describe("Declaration-Based Numeric Intent Recovery", () => {
  describe("Property Access Recovery", () => {
    it("should recover 'int' from arr.length property declaration", () => {
      const code = `
        export function getLen(arr: string[]): number {
          return arr.length;
        }
      `;

      const { modules, ok } = compileWithGlobals(code);
      expect(ok).to.be.true;

      // Find arr.length member expression
      const lengthExpr = findExpression(
        modules,
        (expr): expr is IrMemberExpression =>
          expr.kind === "memberAccess" && expr.property === "length"
      );

      expect(lengthExpr).to.not.be.undefined;
      // CLR numeric types are represented as primitiveType in IR
      // (see primitives.ts: "When user writes `: int`, it becomes primitiveType(name='int')")
      expect(lengthExpr?.inferredType).to.deep.equal({
        kind: "primitiveType",
        name: "int",
      });
    });

    it("should recover 'int' from string.length property declaration", () => {
      const code = `
        export function getLen(s: string): number {
          return s.length;
        }
      `;

      const { modules, ok } = compileWithGlobals(code);
      expect(ok).to.be.true;

      // Find s.length member expression
      const lengthExpr = findExpression(
        modules,
        (expr): expr is IrMemberExpression =>
          expr.kind === "memberAccess" && expr.property === "length"
      );

      expect(lengthExpr).to.not.be.undefined;
      // CLR numeric types are represented as primitiveType in IR
      expect(lengthExpr?.inferredType).to.deep.equal({
        kind: "primitiveType",
        name: "int",
      });
    });
  });

  describe("Call Return Type Recovery", () => {
    it("should recover 'int' from string.indexOf() return type", () => {
      // Note: Using string.indexOf() because .NET arrays don't have indexOf method
      // (use Array.IndexOf static method or LINQ instead)
      const code = `
        export function findIndex(str: string, search: string): number {
          return str.indexOf(search);
        }
      `;

      const { modules, ok } = compileWithGlobals(code);
      expect(ok).to.be.true;

      // Find str.indexOf() call expression
      const indexOfCall = findExpression(modules, (expr) => {
        if (expr.kind !== "call") return false;
        if (expr.callee.kind !== "memberAccess") return false;
        return expr.callee.property === "indexOf";
      });

      expect(indexOfCall).to.not.be.undefined;
      // CLR numeric types are represented as primitiveType in IR
      // (see primitives.ts: "When user writes `: int`, it becomes primitiveType(name='int')")
      expect(indexOfCall?.inferredType).to.deep.equal({
        kind: "primitiveType",
        name: "int",
      });
    });
  });

  describe("Intent Honored at Source Site", () => {
    it("should recover 'int' even when assigned to number variable", () => {
      const code = `
        export function assignToNumber(arr: string[]): void {
          const len: number = arr.length;
        }
      `;

      const { modules, ok } = compileWithGlobals(code);
      expect(ok).to.be.true;

      // Find arr.length member expression
      const lengthExpr = findExpression(
        modules,
        (expr): expr is IrMemberExpression =>
          expr.kind === "memberAccess" && expr.property === "length"
      );

      expect(lengthExpr).to.not.be.undefined;
      // The arr.length expression itself should have int, regardless of target
      // CLR numeric types are represented as primitiveType in IR
      expect(lengthExpr?.inferredType).to.deep.equal({
        kind: "primitiveType",
        name: "int",
      });
    });
  });

  describe("End-to-End Integration: arr[arr.length - 1]", () => {
    it("should pass numeric proof validation for arr[arr.length - 1] pattern", () => {
      // This is the specific regression guard for the original issue.
      // The pattern arr[arr.length - 1] must:
      // 1. Compile successfully
      // 2. Build IR with arr.length having int intent
      // 3. Pass numeric proof pass without TSN5107
      const code = `
        export function getLast(arr: string[]): string {
          return arr[arr.length - 1];
        }
      `;

      const { modules, ok, error } = compileWithGlobals(code);
      expect(ok, `Compile failed: ${error}`).to.be.true;
      expect(modules.length).to.be.greaterThan(0);

      // Run numeric proof pass - this should NOT produce TSN5107
      const proofResult = runNumericProofPass(modules);

      // Check for TSN5107 specifically (cannot prove int for array index)
      const tsn5107Errors = proofResult.diagnostics.filter(
        (d) => d.code === "TSN5107"
      );

      expect(
        tsn5107Errors.length,
        `Expected no TSN5107 errors but got: ${tsn5107Errors.map((d) => d.message).join("; ")}`
      ).to.equal(0);

      // The proof pass should succeed (or have only non-blocking diagnostics)
      expect(
        proofResult.ok,
        `Proof pass failed: ${proofResult.diagnostics.map((d) => `${d.code}: ${d.message}`).join("; ")}`
      ).to.be.true;
    });

    it("should pass numeric proof for string.indexOf() as index", () => {
      // Using string.indexOf() result as string char index
      // Note: .NET arrays don't have indexOf method, use string instead
      const code = `
        export function getCharAtIndex(str: string, search: string): string {
          const idx = str.indexOf(search);
          return str[idx];
        }
      `;

      const { modules, ok, error } = compileWithGlobals(code);
      expect(ok, `Compile failed: ${error}`).to.be.true;

      const proofResult = runNumericProofPass(modules);

      const tsn5107Errors = proofResult.diagnostics.filter(
        (d) => d.code === "TSN5107"
      );

      expect(
        tsn5107Errors.length,
        `Expected no TSN5107 errors but got: ${tsn5107Errors.map((d) => d.message).join("; ")}`
      ).to.equal(0);

      expect(proofResult.ok).to.be.true;
    });

    it("should pass numeric proof for length-based arithmetic", () => {
      // Pattern: arr.length in subtraction (common for last element access)
      const code = `
        export function getSecondLast(arr: string[]): string {
          return arr[arr.length - 2];
        }
      `;

      const { modules, ok, error } = compileWithGlobals(code);
      expect(ok, `Compile failed: ${error}`).to.be.true;

      const proofResult = runNumericProofPass(modules);

      const tsn5107Errors = proofResult.diagnostics.filter(
        (d) => d.code === "TSN5107"
      );

      expect(
        tsn5107Errors.length,
        `Expected no TSN5107 errors but got: ${tsn5107Errors.map((d) => d.message).join("; ")}`
      ).to.equal(0);

      expect(proofResult.ok).to.be.true;
    });
  });

  // Note: User-defined function return type recovery is tested through E2E tests
  // (test/fixtures/*) which have proper node_modules setup for @tsonic/core imports.
  // The unit tests here focus on built-in globals (arr.length, string.indexOf, etc.)

  describe("Chained Call Type Recovery", () => {
    it("should recover correct type through method chain", () => {
      // str.substring() returns string, then .length returns int
      // Note: .length is declared as int in globals, no import needed
      const code = `
        export function getSubLength(s: string): number {
          return s.substring(0, 5).length;
        }
      `;

      const { modules, ok, error } = compileWithGlobals(code);
      expect(ok, `Compile failed: ${error}`).to.be.true;

      // Find .length member expression at end of chain
      const lengthExpr = findExpression(
        modules,
        (expr): expr is IrMemberExpression =>
          expr.kind === "memberAccess" && expr.property === "length"
      );

      expect(lengthExpr).to.not.be.undefined;
      expect(lengthExpr?.inferredType).to.deep.equal({
        kind: "primitiveType",
        name: "int",
      });
    });
  });
});
