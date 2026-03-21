/**
 * Tests for Declaration-Based Numeric Intent Recovery -- Call Return Type & Intent
 *
 * - Call return type recovery (string.IndexOf() -> int)
 * - Intent honored at source site (assigned to number variable)
 * - Chained call type recovery
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { compileWithGlobals, findExpression } from "./test-helpers.js";
import type { IrMemberExpression } from "./test-helpers.js";

describe("Declaration-Based Numeric Intent Recovery", function () {
  this.timeout(60_000);
  describe("Call Return Type Recovery", () => {
    it("should recover 'int' from string.IndexOf() return type", () => {
      // Note: Using string.IndexOf() because .NET arrays don't have indexOf method
      // (use Array.IndexOf static method or LINQ instead)
      const code = `
        export function findIndex(str: string, search: string): number {
          return str.IndexOf(search);
        }
      `;

      const { modules, ok } = compileWithGlobals(code);
      expect(ok).to.be.true;

      // Find str.indexOf() call expression
      const indexOfCall = findExpression(modules, (expr) => {
        if (expr.kind !== "call") return false;
        if (expr.callee.kind !== "memberAccess") return false;
        return expr.callee.property === "IndexOf";
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
          const len: number = arr.Length;
        }
      `;

      const { modules, ok } = compileWithGlobals(code);
      expect(ok).to.be.true;

      // Find arr.length member expression
      const lengthExpr = findExpression(
        modules,
        (expr): expr is IrMemberExpression =>
          expr.kind === "memberAccess" && expr.property === "Length"
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

  describe("Chained Call Type Recovery", () => {
    it("should recover correct type through method chain", () => {
      // str.Substring() returns string, then .Length returns int
      // Note: .Length is declared as int in globals, no import needed
      const code = `
        export function getSubLength(s: string): number {
          return s.Substring(0, 5).Length;
        }
      `;

      const { modules, ok, error } = compileWithGlobals(code);
      expect(ok, `Compile failed: ${error}`).to.be.true;

      // Find .length member expression at end of chain
      const lengthExpr = findExpression(
        modules,
        (expr): expr is IrMemberExpression =>
          expr.kind === "memberAccess" && expr.property === "Length"
      );

      expect(lengthExpr).to.not.be.undefined;
      expect(lengthExpr?.inferredType).to.deep.equal({
        kind: "primitiveType",
        name: "int",
      });
    });
  });
});
