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

  it("expands sibling source-package waves beyond stale installed @tsonic roots", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-inputs-wave-rootdir-")
    );

    try {
      const workspaceRoot = path.join(tempDir, "tsoniclang");
      const projectRoot = path.join(workspaceRoot, "proof", "js");
      const sourceRoot = path.join(projectRoot, "src");
      const entryFile = path.join(sourceRoot, "App.ts");
      const installedNodejsRoot = path.join(
        projectRoot,
        "node_modules",
        "@tsonic",
        "nodejs"
      );
      const installedJsRoot = path.join(
        projectRoot,
        "node_modules",
        "@tsonic",
        "js"
      );
      const nodejsExternalRoot = path.join(
        workspaceRoot,
        "nodejs-next",
        "versions",
        "10"
      );
      const jsSiblingRoot = path.join(workspaceRoot, "js-next", "versions", "10");

      fs.mkdirSync(path.dirname(entryFile), { recursive: true });
      fs.mkdirSync(path.dirname(installedNodejsRoot), { recursive: true });
      fs.mkdirSync(installedJsRoot, { recursive: true });
      fs.mkdirSync(path.join(nodejsExternalRoot, "tsonic"), { recursive: true });
      fs.mkdirSync(path.join(jsSiblingRoot, "tsonic"), { recursive: true });
      fs.writeFileSync(entryFile, "export {};\n");

      fs.writeFileSync(
        path.join(nodejsExternalRoot, "package.json"),
        JSON.stringify(
          {
            name: "@tsonic/nodejs",
            version: "10.0.0",
            type: "module",
            peerDependencies: {
              "@tsonic/js": "10.0.0",
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(nodejsExternalRoot, "tsonic", "package-manifest.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                ".": "./src/index.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.mkdirSync(path.join(nodejsExternalRoot, "src"), { recursive: true });
      fs.writeFileSync(
        path.join(nodejsExternalRoot, "src", "index.ts"),
        "export {};\n"
      );

      fs.writeFileSync(
        path.join(jsSiblingRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/js", version: "10.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(jsSiblingRoot, "tsonic", "package-manifest.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                ".": "./src/index.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.mkdirSync(path.join(jsSiblingRoot, "src"), { recursive: true });
      fs.writeFileSync(
        path.join(jsSiblingRoot, "src", "index.ts"),
        "export {};\n"
      );

      fs.writeFileSync(
        path.join(installedJsRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/js", version: "9.9.9", type: "module" },
          null,
          2
        )
      );

      fs.symlinkSync(nodejsExternalRoot, installedNodejsRoot, "dir");

      const discovery = discoverProgramInputs(
        [entryFile],
        {
          projectRoot,
          sourceRoot,
          rootNamespace: "App",
          surface: "@tsonic/js",
          typeRoots: [installedNodejsRoot],
        },
        {
          requiredTypeRoots: [],
          resolvedModes: [],
        },
        () => null
      );

      expect(
        discovery.authoritativeTsonicPackageRoots.get("@tsonic/nodejs")
      ).to.equal(installedNodejsRoot);
      expect(
        discovery.authoritativeTsonicPackageRoots.get("@tsonic/js")
      ).to.equal(jsSiblingRoot);
      expect(discovery.typeRoots.includes(installedJsRoot)).to.equal(false);

      expect(typeof discovery.tsOptions.rootDir).to.equal("string");
      if (typeof discovery.tsOptions.rootDir !== "string") return;

      const resolvedRootDir = path.resolve(discovery.tsOptions.rootDir);
      const relativeToJsSibling = path.relative(
        resolvedRootDir,
        path.join(jsSiblingRoot, "src", "index.ts")
      );

      expect(relativeToJsSibling.startsWith("..")).to.equal(false);
      expect(path.isAbsolute(relativeToJsSibling)).to.equal(false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
