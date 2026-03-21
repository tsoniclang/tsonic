/**
 * Tests for Declaration-Based Numeric Intent Recovery -- End-to-End Integration
 *
 * These tests verify arr[arr.Length - 1] and similar patterns pass numeric
 * proof validation without TSN5107 errors.
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import {
  compileWithGlobals,
  compileWithJsSurface,
  runNumericProofPass,
} from "./test-helpers.js";

describe("Declaration-Based Numeric Intent Recovery", function () {
  this.timeout(60_000);
  describe("End-to-End Integration: arr[arr.Length - 1]", () => {
    it("should pass numeric proof validation for arr[arr.Length - 1] pattern", () => {
      // This is the specific regression guard for the original issue.
      // The pattern arr[arr.Length - 1] must:
      // 1. Compile successfully
      // 2. Build IR with arr.Length having int intent
      // 3. Pass numeric proof pass without TSN5107
      const code = `
        export function getLast(arr: string[]): string {
          return arr[arr.Length - 1];
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

    it("should pass numeric proof for string.IndexOf() as index", () => {
      // Using string.IndexOf() result as string char index
      // Note: .NET arrays don't have indexOf method, use string instead
      const code = `
        export function getCharAtIndex(str: string, search: string): string {
          const idx = str.IndexOf(search);
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
      // Pattern: arr.Length in subtraction (common for last element access)
      const code = `
        export function getSecondLast(arr: string[]): string {
          return arr[arr.Length - 2];
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

    it("should pass numeric proof for explicit CLR array .length on js surface", () => {
      const code = `
        import { Encoding } from "@tsonic/dotnet/System.Text.js";
        import { Console } from "@tsonic/dotnet/System.js";

        export function writeBytes(value: string): void {
          const buffer = Encoding.UTF8.GetBytes(value);
          Console.WriteLine(buffer[buffer.length - 1]);
        }
      `;

      const { modules, ok, error } = compileWithJsSurface(code);
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

    it("should pass numeric proof for JS string length indexing on js surface", () => {
      const code = `
        export function getLastChar(value: string): string {
          return value[value.length - 1];
        }
      `;

      const { modules, ok, error } = compileWithJsSurface(code);
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

    it("should pass numeric proof for JS string trimming loops on js surface", () => {
      const code = `
        export function trimTrailingSlashes(value: string): string {
          let end = value.length;
          while (end > 1 && value[end - 1] === "/") {
            end -= 1;
          }
          return value.slice(0, end);
        }
      `;

      const { modules, ok, error } = compileWithJsSurface(code);
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
  // The unit tests here focus on built-in globals (arr.Length, string.IndexOf, etc.)
});
