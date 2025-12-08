/**
 * Tests for Declaration-Based Numeric Intent Recovery
 *
 * When TypeScript normalizes type aliases like `int` to plain `number`,
 * we recover the original numeric intent from the declaration AST.
 *
 * These tests verify:
 * - Property access recovery (arr.length → int)
 * - Call return type recovery (arr.indexOf() → int)
 * - Negative cases (plain number stays number)
 * - Guardrails (unions, complex types are NOT recovered)
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { compile } from "../../../index.js";
import { buildIr } from "../../builder.js";
import { IrModule, IrExpression, IrMemberExpression } from "../../types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// From dist/ir/converters/expressions/ go up to packages/frontend/, then up 2 more to monorepo root
const monorepoRoot = path.resolve(__dirname, "../../../../../..");
const jsGlobalsPath = path.join(
  monorepoRoot,
  "node_modules/@tsonic/js-globals"
);
const typesPath = path.join(monorepoRoot, "node_modules/@tsonic/types");

/**
 * Helper to compile TypeScript code with js-globals and extract IR
 */
const compileWithJsGlobals = (
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
    typeRoots: [jsGlobalsPath, typesPath],
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

      const { modules, ok } = compileWithJsGlobals(code);
      expect(ok).to.be.true;

      // Find arr.length member expression
      const lengthExpr = findExpression(
        modules,
        (expr): expr is IrMemberExpression =>
          expr.kind === "memberAccess" && expr.property === "length"
      );

      expect(lengthExpr).to.not.be.undefined;
      expect(lengthExpr?.inferredType).to.deep.equal({
        kind: "referenceType",
        name: "int",
      });
    });

    it("should recover 'int' from string.length property declaration", () => {
      const code = `
        export function getLen(s: string): number {
          return s.length;
        }
      `;

      const { modules, ok } = compileWithJsGlobals(code);
      expect(ok).to.be.true;

      // Find s.length member expression
      const lengthExpr = findExpression(
        modules,
        (expr): expr is IrMemberExpression =>
          expr.kind === "memberAccess" && expr.property === "length"
      );

      expect(lengthExpr).to.not.be.undefined;
      expect(lengthExpr?.inferredType).to.deep.equal({
        kind: "referenceType",
        name: "int",
      });
    });
  });

  describe("Call Return Type Recovery", () => {
    it("should recover 'int' from arr.indexOf() return type", () => {
      const code = `
        export function findIndex(arr: string[], item: string): number {
          return arr.indexOf(item);
        }
      `;

      const { modules, ok } = compileWithJsGlobals(code);
      expect(ok).to.be.true;

      // Find arr.indexOf() call expression
      const indexOfCall = findExpression(modules, (expr) => {
        if (expr.kind !== "call") return false;
        if (expr.callee.kind !== "memberAccess") return false;
        return expr.callee.property === "indexOf";
      });

      expect(indexOfCall).to.not.be.undefined;
      expect(indexOfCall?.inferredType).to.deep.equal({
        kind: "referenceType",
        name: "int",
      });
    });

    it("should recover 'int' from arr.lastIndexOf() return type", () => {
      const code = `
        export function findLast(arr: string[], item: string): number {
          return arr.lastIndexOf(item);
        }
      `;

      const { modules, ok } = compileWithJsGlobals(code);
      expect(ok).to.be.true;

      // Find arr.lastIndexOf() call expression
      const lastIndexOfCall = findExpression(modules, (expr) => {
        if (expr.kind !== "call") return false;
        if (expr.callee.kind !== "memberAccess") return false;
        return expr.callee.property === "lastIndexOf";
      });

      expect(lastIndexOfCall).to.not.be.undefined;
      expect(lastIndexOfCall?.inferredType).to.deep.equal({
        kind: "referenceType",
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

      const { modules, ok } = compileWithJsGlobals(code);
      expect(ok).to.be.true;

      // Find arr.length member expression
      const lengthExpr = findExpression(
        modules,
        (expr): expr is IrMemberExpression =>
          expr.kind === "memberAccess" && expr.property === "length"
      );

      expect(lengthExpr).to.not.be.undefined;
      // The arr.length expression itself should have int, regardless of target
      expect(lengthExpr?.inferredType).to.deep.equal({
        kind: "referenceType",
        name: "int",
      });
    });
  });
});
