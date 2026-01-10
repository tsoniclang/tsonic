import { describe, it } from "mocha";
import { expect } from "chai";
import { getNamespaceFromPath } from "./namespace.js";

describe("getNamespaceFromPath", () => {
  it("should return root namespace for files directly in source root", () => {
    const result = getNamespaceFromPath(
      "/project/src/index.ts",
      "/project/src",
      "MyApp"
    );
    expect(result).to.equal("MyApp");
  });

  it("should return root namespace for files in source root without src directory", () => {
    const result = getNamespaceFromPath(
      "/project/index.ts",
      "/project",
      "MyApp"
    );
    expect(result).to.equal("MyApp");
  });

  it("should compute namespace from single subdirectory", () => {
    const result = getNamespaceFromPath(
      "/project/src/models/user.ts",
      "/project/src",
      "MyApp"
    );
    expect(result).to.equal("MyApp.Models");
  });

  it("should compute namespace from nested subdirectories", () => {
    const result = getNamespaceFromPath(
      "/project/src/models/entities/user.ts",
      "/project/src",
      "MyApp"
    );
    expect(result).to.equal("MyApp.Models.Entities");
  });

  it("should filter out 'src' from path components", () => {
    const result = getNamespaceFromPath(
      "/project/src/models/src/user.ts",
      "/project/src",
      "MyApp"
    );
    expect(result).to.equal("MyApp.Models");
  });

  it("should handle case-preserved directory names", () => {
    const result = getNamespaceFromPath(
      "/project/src/MyModels/UserEntity.ts",
      "/project/src",
      "MyApp"
    );
    expect(result).to.equal("MyApp.MyModels");
  });

  it("should handle deep nesting", () => {
    const result = getNamespaceFromPath(
      "/project/src/a/b/c/d/e/file.ts",
      "/project/src",
      "MyApp"
    );
    expect(result).to.equal("MyApp.A.B.C.D.E");
  });

  it("should handle source root without trailing slash", () => {
    const result = getNamespaceFromPath(
      "/project/src/models/user.ts",
      "/project/src",
      "MyApp"
    );
    expect(result).to.equal("MyApp.Models");
  });

  it("should handle source root with trailing slash", () => {
    const result = getNamespaceFromPath(
      "/project/src/models/user.ts",
      "/project/src/",
      "MyApp"
    );
    expect(result).to.equal("MyApp.Models");
  });
});
