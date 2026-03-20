/**
 * Tests for Declaration-Based Numeric Intent Recovery -- Property Access Recovery
 *
 * When TypeScript normalizes type aliases like `int` to plain `number`,
 * we recover the original numeric intent from the declaration AST.
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import {
  compileWithGlobals,
  compileWithJsSurface,
  findExpression,
  unwrapTransparentExpression,
} from "./test-helpers.js";
import type { IrMemberExpression } from "./test-helpers.js";

describe("Declaration-Based Numeric Intent Recovery", function () {
  this.timeout(60_000);
  describe("Property Access Recovery", () => {
    it("should recover 'int' from arr.Length property declaration", () => {
      const code = `
        export function getLen(arr: string[]): number {
          return arr.Length;
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
      // CLR numeric types are represented as primitiveType in IR
      // (see primitives.ts: "When user writes `: int`, it becomes primitiveType(name='int')")
      expect(lengthExpr?.inferredType).to.deep.equal({
        kind: "primitiveType",
        name: "int",
      });
    });

    it("should recover 'int' from string.Length property declaration", () => {
      const code = `
        export function getLen(s: string): number {
          return s.Length;
        }
      `;

      const { modules, ok } = compileWithGlobals(code);
      expect(ok).to.be.true;

      // Find s.length member expression
      const lengthExpr = findExpression(
        modules,
        (expr): expr is IrMemberExpression =>
          expr.kind === "memberAccess" && expr.property === "Length"
      );

      expect(lengthExpr).to.not.be.undefined;
      // CLR numeric types are represented as primitiveType in IR
      expect(lengthExpr?.inferredType).to.deep.equal({
        kind: "primitiveType",
        name: "int",
      });
    });

    it("should recover 'int' from arr.length property declaration on js surface", () => {
      const code = `
        export function getLen(arr: string[]): number {
          return arr.length;
        }
      `;

      const { modules, ok, error } = compileWithJsSurface(code);
      expect(ok, `Compile failed: ${error}`).to.be.true;

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

    it("should recover 'int' from explicit CLR array .length on js surface", () => {
      const code = `
        import { Encoding } from "@tsonic/dotnet/System.Text.js";

        export function getBytesLen(value: string): number {
          return Encoding.UTF8.GetBytes(value).length;
        }
      `;

      const { modules, ok, error } = compileWithJsSurface(code);
      expect(ok, `Compile failed: ${error}`).to.be.true;

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

    it("should recover 'int' from string.length property declaration on js surface", () => {
      const code = `
        export function getLen(value: string): number {
          return value.length;
        }
      `;

      const { modules, ok, error } = compileWithJsSurface(code);
      expect(ok, `Compile failed: ${error}`).to.be.true;

      const lengthExpr = findExpression(
        modules,
        (expr): expr is IrMemberExpression =>
          expr.kind === "memberAccess" &&
          expr.property === "length" &&
          expr.object.kind === "identifier" &&
          expr.object.name === "value"
      );

      expect(lengthExpr).to.not.be.undefined;
      expect(lengthExpr?.inferredType).to.deep.equal({
        kind: "primitiveType",
        name: "int",
      });
    });

    it("should attach a concrete member binding for readonly array length on js surface", () => {
      const code = `
        export function getLen(arr: readonly string[]): number {
          return arr.length;
        }
      `;

      const { modules, ok, error } = compileWithJsSurface(code);
      expect(ok, `Compile failed: ${error}`).to.be.true;

      const lengthExpr = findExpression(
        modules,
        (expr): expr is IrMemberExpression =>
          expr.kind === "memberAccess" &&
          expr.property === "length" &&
          expr.object.kind === "identifier" &&
          expr.object.name === "arr"
      );

      expect(lengthExpr).to.not.be.undefined;
      expect(lengthExpr?.kind).to.equal("memberAccess");
      if (!lengthExpr || lengthExpr.kind !== "memberAccess") return;
      expect(lengthExpr.memberBinding).to.not.equal(undefined);
      expect(lengthExpr.memberBinding?.kind).to.equal("property");
      expect(lengthExpr.memberBinding?.member.toLowerCase()).to.equal("length");
    });

    it("should attach a concrete member binding for nullish readonly property length on js surface", () => {
      const code = `
        export type Query = {
          readonly paths?: readonly string[];
        };

        export function hasPaths(query: Query): boolean {
          return query.paths !== undefined && query.paths.length > 0;
        }
      `;

      const { modules, ok, error } = compileWithJsSurface(code);
      expect(ok, `Compile failed: ${error}`).to.be.true;

      const lengthExpr = findExpression(
        modules,
        (expr): expr is IrMemberExpression => {
          if (expr.kind !== "memberAccess" || expr.property !== "length") {
            return false;
          }

          const target = unwrapTransparentExpression(expr.object);
          return target.kind === "memberAccess" && target.property === "paths";
        }
      );

      expect(lengthExpr).to.not.be.undefined;
      expect(lengthExpr?.kind).to.equal("memberAccess");
      if (!lengthExpr || lengthExpr.kind !== "memberAccess") return;
      const target = unwrapTransparentExpression(lengthExpr.object);
      expect(target.kind).to.equal("memberAccess");
      if (target.kind !== "memberAccess") return;
      expect(target.property).to.equal("paths");
      expect(lengthExpr.memberBinding).to.not.equal(undefined);
      expect(lengthExpr.memberBinding?.kind).to.equal("property");
      expect(lengthExpr.memberBinding?.member.toLowerCase()).to.equal("length");
    });
  });
});
