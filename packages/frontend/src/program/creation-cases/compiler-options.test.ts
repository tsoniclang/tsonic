/**
 * Tests for compiler option defaults and rootDir computation
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createCompilerOptions } from "../creation.js";

describe("Program Creation – compiler options", function () {
  this.timeout(90_000);

  it("should keep noLib mode in js surface mode", () => {
    const options = createCompilerOptions({
      projectRoot: "/tmp/app",
      sourceRoot: "/tmp/app/src",
      rootNamespace: "App",
      surface: "@tsonic/js",
    });

    expect(options.noLib).to.equal(true);
  });

  it("should widen rootDir to the nearest common ancestor when sourceRoot is outside projectRoot", () => {
    const tempSourceRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-rootdir-")
    );

    try {
      const projectRoot = path.resolve("/home/jester/repos/tsoniclang/tsonic");
      const options = createCompilerOptions({
        projectRoot,
        sourceRoot: tempSourceRoot,
        rootNamespace: "App",
        surface: "@tsonic/js",
      });

      expect(typeof options.rootDir).to.equal("string");
      if (typeof options.rootDir !== "string") return;

      const relativeToProject = path.relative(options.rootDir, projectRoot);
      const relativeToSource = path.relative(options.rootDir, tempSourceRoot);
      expect(relativeToProject.startsWith("..")).to.equal(false);
      expect(path.isAbsolute(relativeToProject)).to.equal(false);
      expect(relativeToSource.startsWith("..")).to.equal(false);
      expect(path.isAbsolute(relativeToSource)).to.equal(false);
    } finally {
      fs.rmSync(tempSourceRoot, { recursive: true, force: true });
    }
  });

  it("should widen rootDir to the workspace node_modules root for installed source packages", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-rootdir-node-modules-")
    );

    try {
      const projectRoot = path.join(tempDir, "packages", "app");
      const sourceRoot = path.join(projectRoot, "src");
      fs.mkdirSync(path.join(tempDir, "node_modules"), { recursive: true });
      fs.mkdirSync(sourceRoot, { recursive: true });

      const options = createCompilerOptions({
        projectRoot,
        sourceRoot,
        rootNamespace: "App",
        surface: "@tsonic/js",
      });

      expect(typeof options.rootDir).to.equal("string");
      if (typeof options.rootDir !== "string") return;
      expect(path.resolve(options.rootDir)).to.equal(path.resolve(tempDir));
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should preserve symlinked package paths during compilation", () => {
    const options = createCompilerOptions({
      projectRoot: "/tmp/app",
      sourceRoot: "/tmp/app/src",
      rootNamespace: "App",
      surface: "@tsonic/js",
    });

    expect(options.preserveSymlinks).to.equal(true);
  });
});
