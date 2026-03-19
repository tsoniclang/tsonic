/**
 * Tests for module resolver -- getNamespaceFromPath and getClassNameFromPath
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { getNamespaceFromPath, getClassNameFromPath } from "../resolver.js";

describe("Module Resolver", () => {
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
      expect(getClassNameFromPath("/src/todo-list.ts")).to.equal("TodoList");
      expect(getClassNameFromPath("/src/math.test.ts")).to.equal("MathTest");
    });
  });
});
