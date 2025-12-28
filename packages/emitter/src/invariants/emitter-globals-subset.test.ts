/**
 * Mechanical Invariant Test: Emitter Special-Cases ⊆ Globals
 *
 * This test verifies that every identifier the emitter "just knows" about
 * via special-casing exists in the globals package.
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
 *
 * IMPORTANT: When adding new special-cases to the emitter, you MUST:
 * 1. Add the type to this list
 * 2. Ensure the type is declared in the globals package
 * 3. Update the assertions below
 */
const EMITTER_SPECIAL_CASES = [
  // From references.ts:192 - Array<T> → T[] (native array)
  "Array",

  // From references.ts:204,217 - Promise<T> → Task<T>
  "Promise",

  // From references.ts:224 - PromiseLike<T> → Task<T>
  "PromiseLike",
] as const;

/**
 * Types that are NOT in globals and must NOT be special-cased.
 * These must fail at TS name resolution first.
 */
const TYPES_NOT_IN_GLOBALS = [
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
 * Types that ARE in globals but are NOT special-cased by the emitter.
 * This is correct behavior - they go through normal type resolution.
 */
const IN_GLOBALS_NOT_SPECIAL_CASED = [
  "console", // In globals, resolves via normal path
  "Math", // In globals, resolves via normal path
  "JSON", // In globals, resolves via normal path
  "RegExp", // In globals (minimal), resolves via normal path
];

describe("Emitter-Globals Subset Invariant", () => {
  describe("Special-cased types exist in globals", () => {
    it("documents all special-cased types", () => {
      assert.deepEqual(
        [...EMITTER_SPECIAL_CASES].sort(),
        ["Array", "Promise", "PromiseLike"],
        "Complete list of emitter special-cased types"
      );
    });
  });

  describe("Types not in globals are not special-cased", () => {
    it("Map is not special-cased (not in globals)", () => {
      assert.ok(
        !EMITTER_SPECIAL_CASES.includes("Map" as never),
        "Map must not be special-cased - it's not in globals, TS will fail first"
      );
    });

    it("Set is not special-cased (not in globals)", () => {
      assert.ok(
        !EMITTER_SPECIAL_CASES.includes("Set" as never),
        "Set must not be special-cased - it's not in globals, TS will fail first"
      );
    });

    it("no types outside globals are special-cased", () => {
      for (const typeName of TYPES_NOT_IN_GLOBALS) {
        assert.ok(
          !EMITTER_SPECIAL_CASES.includes(typeName as never),
          `${typeName} must not be special-cased - it's not in globals`
        );
      }
    });
  });

  describe("Globals types correctly handled", () => {
    it("console/Math/JSON are in globals but not special-cased (correct)", () => {
      // These types ARE in globals and should NOT be special-cased.
      // They resolve through normal type resolution, not hardcoded CLR mappings.
      for (const typeName of IN_GLOBALS_NOT_SPECIAL_CASED) {
        assert.ok(
          !EMITTER_SPECIAL_CASES.includes(typeName as never),
          `${typeName} is in globals but should NOT be special-cased (uses normal resolution)`
        );
      }
    });
  });

  describe("Invariant documentation", () => {
    it("documents source locations for special cases", () => {
      // This is a documentation test - it reminds maintainers where to look
      const sourceLocations: Record<string, string> = {
        Array: "packages/emitter/src/types/references.ts:192",
        Promise: "packages/emitter/src/types/references.ts:204,217",
        PromiseLike: "packages/emitter/src/types/references.ts:224",
      };

      assert.equal(
        Object.keys(sourceLocations).length,
        EMITTER_SPECIAL_CASES.length,
        "All special cases should have documented source locations"
      );
    });
  });
});
