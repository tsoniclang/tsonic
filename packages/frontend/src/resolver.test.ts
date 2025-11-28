/**
 * Tests for module resolver
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import {
  resolveImport,
  getNamespaceFromPath,
  getClassNameFromPath,
} from "./resolver.js";

describe("Module Resolver", () => {
  describe("resolveImport", () => {
    const tempDir = path.join(os.tmpdir(), "tsonic-test");
    const sourceRoot = tempDir;

    before(() => {
      // Create temp directory structure
      fs.mkdirSync(path.join(tempDir, "src", "models"), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, "src", "models", "User.ts"),
        "export class User {}"
      );
      fs.writeFileSync(path.join(tempDir, "src", "index.ts"), "");
    });

    after(() => {
      // Clean up
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("should resolve local imports with .ts extension", () => {
      const result = resolveImport(
        "./models/User.ts",
        path.join(tempDir, "src", "index.ts"),
        sourceRoot
      );

      expect(result.ok).to.equal(true);
      if (result.ok) {
        expect(result.value.isLocal).to.equal(true);
        expect(result.value.isClr).to.equal(false);
        expect(result.value.resolvedPath).to.equal(
          path.join(tempDir, "src", "models", "User.ts")
        );
      }
    });

    it("should error on local imports without .ts extension", () => {
      const result = resolveImport(
        "./models/User",
        path.join(tempDir, "src", "index.ts"),
        sourceRoot
      );

      expect(result.ok).to.equal(false);
      if (!result.ok) {
        expect(result.error.code).to.equal("TSN1001");
        expect(result.error.message).to.include("must have .ts extension");
      }
    });

    it("should not detect bare imports as .NET without resolver with bindings", () => {
      // Import-driven resolution: bare imports like "System.IO" are only detected as .NET
      // if a resolver is provided and the import resolves to a package with bindings.json.
      // Without a resolver or package, bare imports are treated as unsupported node_modules.
      const result = resolveImport(
        "System.IO",
        path.join(tempDir, "src", "index.ts"),
        sourceRoot
        // No dotnetResolver passed
      );

      expect(result.ok).to.equal(false);
      if (!result.ok) {
        expect(result.error.code).to.equal("TSN1004");
        expect(result.error.message).to.include("Unsupported module import");
      }
    });

    it("should reject node_modules imports", () => {
      const result = resolveImport(
        "express",
        path.join(tempDir, "src", "index.ts"),
        sourceRoot
      );

      expect(result.ok).to.equal(false);
      if (!result.ok) {
        expect(result.error.code).to.equal("TSN1004");
        expect(result.error.message).to.include("Unsupported module import");
      }
    });

    it("should error on non-existent local files", () => {
      const result = resolveImport(
        "./nonexistent.ts",
        path.join(tempDir, "src", "index.ts"),
        sourceRoot
      );

      expect(result.ok).to.equal(false);
      if (!result.ok) {
        expect(result.error.code).to.equal("TSN1004");
        expect(result.error.message).to.include("Cannot find module");
      }
    });
  });

  describe("getNamespaceFromPath", () => {
    it("should generate namespace from directory structure", () => {
      const namespace = getNamespaceFromPath(
        "/project/src/models/auth/User.ts",
        "/project/src",
        "MyApp"
      );

      expect(namespace).to.equal("MyApp.models.auth");
    });

    it("should use root namespace for files in source root", () => {
      const namespace = getNamespaceFromPath(
        "/project/src/index.ts",
        "/project/src",
        "MyApp"
      );

      expect(namespace).to.equal("MyApp");
    });

    it("should preserve case in directory names", () => {
      const namespace = getNamespaceFromPath(
        "/project/src/Models/Auth/User.ts",
        "/project/src",
        "MyApp"
      );

      expect(namespace).to.equal("MyApp.Models.Auth");
    });
  });

  describe("getClassNameFromPath", () => {
    it("should extract class name from file name", () => {
      expect(getClassNameFromPath("/src/User.ts")).to.equal("User");
      expect(getClassNameFromPath("/src/models/UserProfile.ts")).to.equal(
        "UserProfile"
      );
      expect(getClassNameFromPath("index.ts")).to.equal("index");
    });
  });
});
