import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { resolveDependencyPackageRoot } from "./package-roots.js";

describe("resolveDependencyPackageRoot", () => {
  it("prefers sibling workspace versioned packages over unrelated installed ancestors", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-package-roots-")
    );

    try {
      const workspaceRoot = path.join(tempDir, "tsoniclang");
      const globalsRoot = path.join(workspaceRoot, "globals", "versions", "10");
      const dotnetSiblingRoot = path.join(
        workspaceRoot,
        "dotnet",
        "versions",
        "10"
      );
      const strayInstalledRoot = path.join(
        tempDir,
        "node_modules",
        "@tsonic",
        "dotnet"
      );

      fs.mkdirSync(globalsRoot, { recursive: true });
      fs.mkdirSync(dotnetSiblingRoot, { recursive: true });
      fs.mkdirSync(strayInstalledRoot, { recursive: true });

      fs.writeFileSync(
        path.join(globalsRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/globals", version: "10.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(dotnetSiblingRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/dotnet", version: "10.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(strayInstalledRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/dotnet", version: "0.0.0", type: "module" },
          null,
          2
        )
      );

      expect(
        resolveDependencyPackageRoot(globalsRoot, "@tsonic/dotnet")
      ).to.equal(dotnetSiblingRoot);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("falls back to installed package roots when no sibling workspace package exists", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-package-roots-")
    );

    try {
      const packageRoot = path.join(
        tempDir,
        "node_modules",
        "@tsonic",
        "globals"
      );
      const installedDotnetRoot = path.join(
        tempDir,
        "node_modules",
        "@tsonic",
        "dotnet"
      );

      fs.mkdirSync(packageRoot, { recursive: true });
      fs.mkdirSync(installedDotnetRoot, { recursive: true });

      fs.writeFileSync(
        path.join(packageRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/globals", version: "10.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(installedDotnetRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/dotnet", version: "10.0.0", type: "module" },
          null,
          2
        )
      );

      expect(
        resolveDependencyPackageRoot(packageRoot, "@tsonic/dotnet")
      ).to.equal(installedDotnetRoot);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("can prefer installed package roots over sibling workspace packages when requested", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-package-roots-installed-first-")
    );

    try {
      const workspaceRoot = path.join(tempDir, "tsoniclang");
      const globalsRoot = path.join(workspaceRoot, "globals", "versions", "10");
      const dotnetSiblingRoot = path.join(
        workspaceRoot,
        "dotnet",
        "versions",
        "10"
      );
      const installedDotnetRoot = path.join(
        globalsRoot,
        "node_modules",
        "@tsonic",
        "dotnet"
      );

      fs.mkdirSync(globalsRoot, { recursive: true });
      fs.mkdirSync(dotnetSiblingRoot, { recursive: true });
      fs.mkdirSync(installedDotnetRoot, { recursive: true });

      fs.writeFileSync(
        path.join(globalsRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/globals", version: "10.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(dotnetSiblingRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/dotnet", version: "10.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(installedDotnetRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/dotnet", version: "10.1.0-local", type: "module" },
          null,
          2
        )
      );

      expect(
        resolveDependencyPackageRoot(
          globalsRoot,
          "@tsonic/dotnet",
          "installed-first"
        )
      ).to.equal(installedDotnetRoot);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("resolves installed export-mapped packages from project directories without package.json", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-package-roots-workspace-project-")
    );

    try {
      const workspaceRoot = path.join(tempDir, "workspace");
      const projectRoot = path.join(workspaceRoot, "packages", "app");
      const installedNodejsRoot = path.join(
        workspaceRoot,
        "node_modules",
        "@tsonic",
        "nodejs"
      );

      fs.mkdirSync(projectRoot, { recursive: true });
      fs.mkdirSync(path.join(installedNodejsRoot, "src"), { recursive: true });

      fs.writeFileSync(
        path.join(workspaceRoot, "package.json"),
        JSON.stringify(
          {
            name: "workspace",
            private: true,
            type: "module",
            dependencies: {
              "@tsonic/nodejs": "10.0.0",
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(installedNodejsRoot, "package.json"),
        JSON.stringify(
          {
            name: "@tsonic/nodejs",
            version: "10.0.0",
            type: "module",
            exports: {
              ".": {
                types: "./index.d.ts",
                default: "./src/index.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(installedNodejsRoot, "index.d.ts"),
        "export {};\n"
      );
      fs.writeFileSync(
        path.join(installedNodejsRoot, "src", "index.ts"),
        "export {};\n"
      );

      expect(
        resolveDependencyPackageRoot(
          projectRoot,
          "@tsonic/nodejs",
          "installed-first"
        )
      ).to.equal(installedNodejsRoot);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("preserves symlinked installed package roots for installed-first resolution", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-package-roots-symlink-installed-")
    );

    try {
      const workspaceRoot = path.join(tempDir, "workspace");
      const projectRoot = path.join(workspaceRoot, "apps", "proof");
      const externalNodejsRoot = path.join(
        tempDir,
        "external",
        "nodejs-next",
        "versions",
        "10"
      );
      const linkedNodejsRoot = path.join(
        projectRoot,
        "node_modules",
        "@tsonic",
        "nodejs"
      );

      fs.mkdirSync(projectRoot, { recursive: true });
      fs.mkdirSync(externalNodejsRoot, { recursive: true });
      fs.mkdirSync(path.dirname(linkedNodejsRoot), { recursive: true });

      fs.writeFileSync(
        path.join(externalNodejsRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/nodejs", version: "10.0.0", type: "module" },
          null,
          2
        )
      );

      fs.symlinkSync(externalNodejsRoot, linkedNodejsRoot, "dir");

      expect(
        resolveDependencyPackageRoot(
          projectRoot,
          "@tsonic/nodejs",
          "installed-first"
        )
      ).to.equal(linkedNodejsRoot);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("resolves sibling workspace packages from symlinked source-package roots", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-package-roots-symlink-wave-")
    );

    try {
      const workspaceRoot = path.join(tempDir, "tsoniclang");
      const nodejsSiblingRepo = path.join(workspaceRoot, "nodejs-next");
      const jsSiblingRoot = path.join(workspaceRoot, "js-next", "versions", "10");
      const consumerRoot = path.join(tempDir, "consumer");
      const installedNodejsRoot = path.join(
        consumerRoot,
        "node_modules",
        "@tsonic",
        "nodejs"
      );

      fs.mkdirSync(path.join(nodejsSiblingRepo, "versions", "10"), {
        recursive: true,
      });
      fs.mkdirSync(jsSiblingRoot, { recursive: true });
      fs.mkdirSync(path.dirname(installedNodejsRoot), { recursive: true });

      fs.writeFileSync(
        path.join(nodejsSiblingRepo, "versions", "10", "package.json"),
        JSON.stringify(
          { name: "@tsonic/nodejs", version: "10.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(jsSiblingRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/js", version: "10.0.0", type: "module" },
          null,
          2
        )
      );

      fs.symlinkSync(
        path.join(nodejsSiblingRepo, "versions", "10"),
        installedNodejsRoot,
        "dir"
      );

      expect(resolveDependencyPackageRoot(installedNodejsRoot, "@tsonic/js")).to
        .equal(jsSiblingRoot);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("prefers sibling source packages over CLR siblings with the same package name", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-package-roots-source-preference-")
    );

    try {
      const workspaceRoot = path.join(tempDir, "tsoniclang");
      const nodejsRoot = path.join(workspaceRoot, "nodejs-next", "versions", "10");
      const jsClrRoot = path.join(workspaceRoot, "js", "versions", "10");
      const jsSourceRoot = path.join(workspaceRoot, "js-next", "versions", "10");

      fs.mkdirSync(path.join(nodejsRoot, "tsonic"), { recursive: true });
      fs.mkdirSync(jsClrRoot, { recursive: true });
      fs.mkdirSync(path.join(jsSourceRoot, "tsonic"), { recursive: true });

      fs.writeFileSync(
        path.join(nodejsRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/nodejs", version: "10.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(nodejsRoot, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: { exports: { ".": "./src/index.ts" } },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(jsClrRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/js", version: "10.0.48", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(jsSourceRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/js", version: "10.0.49-next.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(jsSourceRoot, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: { exports: { ".": "./src/index.ts" } },
          },
          null,
          2
        )
      );

      expect(resolveDependencyPackageRoot(nodejsRoot, "@tsonic/js")).to.equal(
        jsSourceRoot
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
