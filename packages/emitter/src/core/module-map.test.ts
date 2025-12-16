/**
 * Module Map Tests
 *
 * Tests for module path canonicalization and import path resolution.
 * These tests guard against regressions in ESM import handling.
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { canonicalizeFilePath, resolveImportPath } from "./module-map.js";

describe("Module Map", () => {
  describe("canonicalizeFilePath", () => {
    it("should remove .ts extension", () => {
      expect(canonicalizeFilePath("src/utils/Math.ts")).to.equal(
        "src/utils/Math"
      );
    });

    it("should normalize backslashes to forward slashes", () => {
      expect(canonicalizeFilePath("src\\utils\\Math.ts")).to.equal(
        "src/utils/Math"
      );
    });

    it("should resolve . segments", () => {
      expect(canonicalizeFilePath("src/./utils/Math.ts")).to.equal(
        "src/utils/Math"
      );
    });

    it("should resolve .. segments", () => {
      expect(canonicalizeFilePath("src/utils/../models/User.ts")).to.equal(
        "src/models/User"
      );
    });

    it("should handle multiple .. segments", () => {
      expect(canonicalizeFilePath("src/a/b/../../c/D.ts")).to.equal("src/c/D");
    });
  });

  describe("resolveImportPath", () => {
    describe("extension handling", () => {
      it("should strip .ts extension from import source", () => {
        const result = resolveImportPath(
          "src/index.ts",
          "./utils/Math.ts"
        );
        expect(result).to.equal("src/utils/Math");
      });

      it("should strip .js extension from import source (ESM style)", () => {
        // REGRESSION TEST: ESM imports use .js extension for TypeScript files
        // This was the root cause of 7 E2E test failures (multi-file, namespace-imports, etc.)
        const result = resolveImportPath(
          "src/index.ts",
          "./utils/Math.js"
        );
        expect(result).to.equal("src/utils/Math");
      });

      it("should handle import without extension", () => {
        const result = resolveImportPath(
          "src/index.ts",
          "./utils/Math"
        );
        expect(result).to.equal("src/utils/Math");
      });

      it(".js and .ts imports should resolve to same canonical path", () => {
        // Critical: Both ESM (.js) and explicit (.ts) imports must resolve identically
        const fromJs = resolveImportPath("src/index.ts", "./utils/Math.js");
        const fromTs = resolveImportPath("src/index.ts", "./utils/Math.ts");
        const fromBare = resolveImportPath("src/index.ts", "./utils/Math");

        expect(fromJs).to.equal(fromTs);
        expect(fromTs).to.equal(fromBare);
        expect(fromJs).to.equal("src/utils/Math");
      });
    });

    describe("relative path resolution", () => {
      it("should resolve ./ imports (same directory)", () => {
        const result = resolveImportPath(
          "src/services/api.ts",
          "./auth.js"
        );
        expect(result).to.equal("src/services/auth");
      });

      it("should resolve ../ imports (parent directory)", () => {
        const result = resolveImportPath(
          "src/services/api.ts",
          "../models/User.js"
        );
        expect(result).to.equal("src/models/User");
      });

      it("should resolve multiple ../ segments", () => {
        const result = resolveImportPath(
          "src/a/b/c/deep.ts",
          "../../utils/helper.js"
        );
        expect(result).to.equal("src/a/utils/helper");
      });

      it("should handle bare imports (no ./ prefix) as same directory", () => {
        const result = resolveImportPath(
          "src/index.ts",
          "utils/Math.js"
        );
        expect(result).to.equal("src/utils/Math");
      });
    });

    describe("real-world E2E test cases", () => {
      // These mirror the actual imports from failing E2E tests

      it("multi-file: ./utils/Math.js from src/index.ts", () => {
        const result = resolveImportPath(
          "src/index.ts",
          "./utils/Math.js"
        );
        expect(result).to.equal("src/utils/Math");
      });

      it("namespace-imports: ./utils/math.js from src/index.ts", () => {
        const result = resolveImportPath(
          "src/index.ts",
          "./utils/math.js"
        );
        expect(result).to.equal("src/utils/math");
      });

      it("barrel-reexports: ./User.js from src/models/index.ts", () => {
        const result = resolveImportPath(
          "src/models/index.ts",
          "./User.js"
        );
        expect(result).to.equal("src/models/User");
      });

      it("multi-file-imports: ../utils/index.js from src/index.ts", () => {
        // Note: This tests parent directory + index file
        const result = resolveImportPath(
          "src/app/index.ts",
          "../utils/index.js"
        );
        expect(result).to.equal("src/utils/index");
      });
    });
  });
});
