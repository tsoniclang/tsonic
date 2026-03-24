import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { discoverProgramInputs } from "./program-input-discovery.js";

describe("discoverProgramInputs", () => {
  it("widens rootDir to include external installed source package files", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-inputs-rootdir-")
    );

    try {
      const workspaceRoot = path.join(tempDir, "workspace");
      const projectRoot = path.join(workspaceRoot, "packages", "app");
      const sourceRoot = path.join(projectRoot, "src");
      const entryFile = path.join(sourceRoot, "App.ts");
      const externalPackageFile = path.join(
        tempDir,
        "external",
        "nodejs-next",
        "src",
        "fs-module.ts"
      );

      fs.mkdirSync(path.dirname(entryFile), { recursive: true });
      fs.mkdirSync(path.dirname(externalPackageFile), { recursive: true });
      fs.writeFileSync(entryFile, "export {};\n");
      fs.writeFileSync(externalPackageFile, "export {};\n");

      const discovery = discoverProgramInputs(
        [entryFile, externalPackageFile],
        {
          projectRoot,
          sourceRoot,
          rootNamespace: "App",
          surface: "@tsonic/js",
        },
        {
          requiredTypeRoots: [],
          resolvedModes: [],
        },
        () => null
      );

      expect(typeof discovery.tsOptions.rootDir).to.equal("string");
      if (typeof discovery.tsOptions.rootDir !== "string") return;

      const resolvedRootDir = path.resolve(discovery.tsOptions.rootDir);
      const relativeToProject = path.relative(resolvedRootDir, projectRoot);
      const relativeToExternal = path.relative(
        resolvedRootDir,
        externalPackageFile
      );

      expect(relativeToProject.startsWith("..")).to.equal(false);
      expect(path.isAbsolute(relativeToProject)).to.equal(false);
      expect(relativeToExternal.startsWith("..")).to.equal(false);
      expect(path.isAbsolute(relativeToExternal)).to.equal(false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("widens rootDir to include symlinked source package files by real path", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-inputs-symlink-rootdir-")
    );

    try {
      const workspaceRoot = path.join(tempDir, "workspace");
      const projectRoot = path.join(workspaceRoot, "packages", "app");
      const sourceRoot = path.join(projectRoot, "src");
      const entryFile = path.join(sourceRoot, "App.ts");
      const externalPackageRoot = path.join(
        tempDir,
        "external",
        "nodejs-next"
      );
      const externalPackageFile = path.join(
        externalPackageRoot,
        "src",
        "fs-module.ts"
      );
      const linkedPackageRoot = path.join(
        workspaceRoot,
        "node_modules",
        "@tsonic",
        "nodejs"
      );
      const linkedPackageFile = path.join(
        linkedPackageRoot,
        "src",
        "fs-module.ts"
      );

      fs.mkdirSync(path.dirname(entryFile), { recursive: true });
      fs.mkdirSync(path.dirname(externalPackageFile), { recursive: true });
      fs.mkdirSync(path.dirname(linkedPackageRoot), { recursive: true });
      fs.writeFileSync(entryFile, "export {};\n");
      fs.writeFileSync(externalPackageFile, "export {};\n");
      fs.symlinkSync(externalPackageRoot, linkedPackageRoot, "dir");

      const discovery = discoverProgramInputs(
        [entryFile, linkedPackageFile],
        {
          projectRoot,
          sourceRoot,
          rootNamespace: "App",
          surface: "@tsonic/js",
        },
        {
          requiredTypeRoots: [],
          resolvedModes: [],
        },
        () => null
      );

      expect(typeof discovery.tsOptions.rootDir).to.equal("string");
      if (typeof discovery.tsOptions.rootDir !== "string") return;

      const resolvedRootDir = path.resolve(discovery.tsOptions.rootDir);
      const relativeToProject = path.relative(resolvedRootDir, projectRoot);
      const relativeToExternal = path.relative(
        resolvedRootDir,
        fs.realpathSync(externalPackageFile)
      );

      expect(relativeToProject.startsWith("..")).to.equal(false);
      expect(path.isAbsolute(relativeToProject)).to.equal(false);
      expect(relativeToExternal.startsWith("..")).to.equal(false);
      expect(path.isAbsolute(relativeToExternal)).to.equal(false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
