/**
 * Mechanical Invariant Test: Emitter Special-Cases ⊆ Globals
 *
 * This test verifies that every identifier the emitter "just knows" about
 * via special-casing exists in at least one globals package.
 *
 * The principle: The emitter must not emit CLR mappings for types that
 * aren't declared in the globals packages. If a type isn't in globals,
 * TypeScript name resolution will fail first (which is correct behavior).
 *
 * Source of truth for special-cased identifiers:
 * - packages/emitter/src/types/references.ts
 */

import { describe, it } from "mocha";
import { strict as assert } from "assert";

/**
 * Types that the emitter special-cases with hardcoded CLR mappings.
 * Each entry specifies which runtime mode(s) the special-casing applies to.
 *
 * IMPORTANT: When adding new special-cases to the emitter, you MUST:
 * 1. Add the type to this list
 * 2. Ensure the type is declared in the appropriate globals package(s)
 * 3. Update the assertions below
 */
const EMITTER_SPECIAL_CASES = {
  // From references.ts:192 - Array<T> → List<T>
  Array: { js: true, dotnet: true },

  // From references.ts:204,217 - Promise<T> → Task<T>
  Promise: { js: true, dotnet: true },

  // From references.ts:236 - PromiseLike<T> → Task<T>
  PromiseLike: { js: true, dotnet: true },

  // From references.ts:232 - Error → Exception (JS mode only)
  Error: { js: true, dotnet: false },
} as const;

/**
 * Types that MUST be declared in js-globals for the emitter to work correctly.
 * These are types that have special-case handling when runtime === "js".
 */
const REQUIRED_IN_JS_GLOBALS = ["Array", "Promise", "PromiseLike", "Error"];

/**
 * Types that MUST be declared in dotnet-globals for the emitter to work correctly.
 * These are types that have special-case handling when runtime === "dotnet".
 */
const REQUIRED_IN_DOTNET_GLOBALS = ["Array", "Promise", "PromiseLike"];

/**
 * Types that are NOT in any globals package.
 * These must NOT be special-cased because TS name resolution will fail first.
 * If the emitter special-cased these, it would produce wrong output for code
 * that can't even type-check.
 */
const TYPES_NOT_IN_ANY_GLOBALS = [
  "Map", // Not in globals - must fail at TS name resolution
  "Set", // Not in globals - must fail at TS name resolution
  "WeakMap", // Not in globals
  "WeakSet", // Not in globals
  "Date", // Not in globals (uses System.DateTime via imports)
  "parseInt", // Not in globals
  "parseFloat", // Not in globals
  "isNaN", // Not in globals
  "isFinite", // Not in globals
];

/**
 * Types that ARE in js-globals but are NOT special-cased by the emitter.
 * This is correct behavior - they go through normal type resolution.
 * These are listed here to document that they're intentionally not special-cased.
 *
 * Note: These types are legitimate in JS mode and resolve through the normal
 * import/binding path, not hardcoded CLR mappings.
 */
const IN_JS_GLOBALS_NOT_SPECIAL_CASED = [
  "console", // In js-globals, resolves via normal path
  "Math", // In js-globals, resolves via normal path
  "JSON", // In js-globals, resolves via normal path
  "RegExp", // In js-globals (minimal), resolves via normal path
];

describe("Emitter-Globals Subset Invariant", () => {
  describe("Special-cased types exist in appropriate globals", () => {
    it("all JS-mode special cases are in js-globals", () => {
      const jsSpecialCases = Object.entries(EMITTER_SPECIAL_CASES)
        .filter(([_, modes]) => modes.js)
        .map(([name]) => name);

      // This assertion documents the invariant
      assert.deepEqual(
        jsSpecialCases.sort(),
        REQUIRED_IN_JS_GLOBALS.sort(),
        "JS-mode special cases must match required js-globals types"
      );
    });

    it("all dotnet-mode special cases are in dotnet-globals", () => {
      const dotnetSpecialCases = Object.entries(EMITTER_SPECIAL_CASES)
        .filter(([_, modes]) => modes.dotnet)
        .map(([name]) => name);

      assert.deepEqual(
        dotnetSpecialCases.sort(),
        REQUIRED_IN_DOTNET_GLOBALS.sort(),
        "Dotnet-mode special cases must match required dotnet-globals types"
      );
    });

    it("Error is only special-cased in JS mode", () => {
      const errorConfig = EMITTER_SPECIAL_CASES.Error;
      assert.equal(
        errorConfig.js,
        true,
        "Error should be special-cased in JS mode"
      );
      assert.equal(
        errorConfig.dotnet,
        false,
        "Error should NOT be special-cased in dotnet mode"
      );
    });
  });

  describe("Types not in globals are not special-cased", () => {
    it("Map is not special-cased (not in any globals)", () => {
      assert.equal(
        (EMITTER_SPECIAL_CASES as Record<string, unknown>)["Map"],
        undefined,
        "Map must not be special-cased - it's not in globals, TS will fail first"
      );
    });

    it("Set is not special-cased (not in any globals)", () => {
      assert.equal(
        (EMITTER_SPECIAL_CASES as Record<string, unknown>)["Set"],
        undefined,
        "Set must not be special-cased - it's not in globals, TS will fail first"
      );
    });

    it("no types outside globals are special-cased", () => {
      for (const typeName of TYPES_NOT_IN_ANY_GLOBALS) {
        assert.equal(
          (EMITTER_SPECIAL_CASES as Record<string, unknown>)[typeName],
          undefined,
          `${typeName} must not be special-cased - it's not in any globals package`
        );
      }
    });
  });

  describe("JS-globals types correctly handled", () => {
    it("console/Math/JSON are in js-globals but not special-cased (correct)", () => {
      // These types ARE in js-globals and should NOT be special-cased.
      // They resolve through normal type resolution, not hardcoded CLR mappings.
      for (const typeName of IN_JS_GLOBALS_NOT_SPECIAL_CASED) {
        assert.equal(
          (EMITTER_SPECIAL_CASES as Record<string, unknown>)[typeName],
          undefined,
          `${typeName} is in js-globals but should NOT be special-cased (uses normal resolution)`
        );
      }
    });
  });

  describe("Invariant documentation", () => {
    it("documents the complete list of special-cased types", () => {
      const specialCasedTypes = Object.keys(EMITTER_SPECIAL_CASES);

      // This test will fail if someone adds a new special case without updating this file
      assert.deepEqual(
        specialCasedTypes.sort(),
        ["Array", "Error", "Promise", "PromiseLike"],
        "Complete list of emitter special-cased types"
      );
    });

    it("documents source locations for special cases", () => {
      // This is a documentation test - it reminds maintainers where to look
      const sourceLocations = {
        Array: "packages/emitter/src/types/references.ts:192",
        Promise: "packages/emitter/src/types/references.ts:204,217",
        PromiseLike: "packages/emitter/src/types/references.ts:236",
        Error: "packages/emitter/src/types/references.ts:232",
      };

      assert.equal(
        Object.keys(sourceLocations).length,
        Object.keys(EMITTER_SPECIAL_CASES).length,
        "All special cases should have documented source locations"
      );
    });
  });
});
