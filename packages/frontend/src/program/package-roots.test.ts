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
});
