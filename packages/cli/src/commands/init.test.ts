/**
 * Tests for init command
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { getTypePackageInfo, initWorkspace } from "./init.js";

describe("Init Command", () => {
  describe("getTypePackageInfo", () => {
    describe("default (no options)", () => {
      it("should return cli and clr surface packages", () => {
        const result = getTypePackageInfo();
        const packageNames = result.packages.map((p) => p.name);

        expect(packageNames).to.include("tsonic");
        expect(packageNames).to.include("@tsonic/globals");
        expect(packageNames).to.include("@tsonic/dotnet");
        expect(packageNames).to.not.include("@tsonic/core");
      });

      it("should include clr surface type roots", () => {
        const result = getTypePackageInfo();
        expect(result.typeRoots).to.deep.equal([
          "node_modules/@tsonic/globals",
        ]);
      });
    });

    it("should bootstrap @tsonic/js before manifest resolution", () => {
      const result = getTypePackageInfo({ surface: "@tsonic/js" });
      const packageNames = result.packages.map((p) => p.name);

      expect(packageNames).to.include("@tsonic/js");
      expect(packageNames).to.not.include("@tsonic/nodejs");
      expect(result.typeRoots).to.deep.equal([]);
    });

    it("should bootstrap an explicit custom surface package before manifest resolution", () => {
      const result = getTypePackageInfo({ surface: "@acme/surface-web" });
      const packageNames = result.packages.map((p) => p.name);

      expect(packageNames).to.include("@acme/surface-web");
      expect(result.typeRoots).to.deep.equal([]);
    });

    it("should include inherited surface package requirements from installed manifests", () => {
      const workspaceRoot = mkdtempSync(join(tmpdir(), "tsonic-init-surface-"));
      try {
        writeFileSync(
          join(workspaceRoot, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", private: true, type: "module" },
            null,
            2
          )
        );

        const jsRoot = join(workspaceRoot, "node_modules", "@tsonic", "js");
        mkdirSync(jsRoot, { recursive: true });
        writeFileSync(
          join(jsRoot, "package.json"),
          JSON.stringify({
            name: "@tsonic/js",
            version: "1.0.0",
            type: "module",
          })
        );
        writeFileSync(
          join(jsRoot, "tsonic.surface.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              id: "@tsonic/js",
              extends: [],
              requiredTypeRoots: ["types"],
              requiredNpmPackages: ["@tsonic/js"],
            },
            null,
            2
          )
        );

        const customRoot = join(
          workspaceRoot,
          "node_modules",
          "@acme",
          "surface-node"
        );
        mkdirSync(customRoot, { recursive: true });
        writeFileSync(
          join(customRoot, "package.json"),
          JSON.stringify(
            { name: "@acme/surface-node", version: "1.0.0", type: "module" },
            null,
            2
          )
        );
        writeFileSync(
          join(customRoot, "tsonic.surface.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              id: "@acme/surface-node",
              extends: ["@tsonic/js"],
              requiredTypeRoots: ["types"],
              requiredNpmPackages: ["@acme/surface-node", "@tsonic/js"],
            },
            null,
            2
          )
        );

        const result = getTypePackageInfo({
          surface: "@acme/surface-node",
          workspaceRoot,
        });
        const packageNames = result.packages.map((p) => p.name);
        expect(packageNames).to.include("@acme/surface-node");
        expect(packageNames).to.include("@tsonic/js");
        expect(result.typeRoots).to.include(join(jsRoot, "types"));
        expect(result.typeRoots).to.include(join(customRoot, "types"));
      } finally {
        rmSync(workspaceRoot, { recursive: true, force: true });
      }
    });

    it("should bootstrap custom surface package names before manifest resolution", () => {
      const result = getTypePackageInfo({ surface: "@acme/surface-web" });
      const packageNames = result.packages.map((p) => p.name);

      expect(packageNames).to.include("@acme/surface-web");
      expect(result.typeRoots).to.deep.equal([]);
    });

    describe("package versions", () => {
      it("should use latest version for all packages", () => {
        const result = getTypePackageInfo();

        for (const pkg of result.packages) {
          expect(pkg.version).to.equal("latest");
        }
      });
    });
  });

  describe("initWorkspace", () => {
    it("should reject custom surfaces that do not provide a manifest", () => {
      const dir = mkdtempSync(join(tmpdir(), "tsonic-init-custom-surface-"));
      try {
        const result = initWorkspace(dir, {
          skipTypes: true,
          surface: "@acme/surface-web",
        });
        expect(result.ok).to.equal(false);
        expect(result.ok ? "" : result.error).to.include("tsonic.surface.json");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("should generate dotnet sample for default mode", () => {
      const dir = mkdtempSync(join(tmpdir(), "tsonic-init-default-"));
      try {
        const result = initWorkspace(dir, { skipTypes: true });
        expect(result.ok).to.equal(true);

        const workspaceName = basename(dir);
        const appTs = readFileSync(
          join(dir, "packages", workspaceName, "src", "App.ts"),
          "utf-8"
        );
        expect(appTs).to.include("@tsonic/dotnet/System.js");
        expect(appTs).to.include("Console.WriteLine");

        const projectPkg = JSON.parse(
          readFileSync(
            join(dir, "packages", workspaceName, "package.json"),
            "utf-8"
          )
        ) as {
          readonly private?: boolean;
          readonly files?: readonly string[];
        };
        expect(projectPkg.private).to.equal(undefined);
        expect(projectPkg.files).to.deep.equal(["src", "tsonic", "README.md"]);

        const manifest = JSON.parse(
          readFileSync(
            join(
              dir,
              "packages",
              workspaceName,
              "tsonic",
              "package-manifest.json"
            ),
            "utf-8"
          )
        ) as {
          readonly kind?: string;
          readonly surfaces?: readonly string[];
          readonly source?: {
            readonly exports?: Readonly<Record<string, string>>;
          };
        };
        expect(manifest.kind).to.equal("tsonic-source-package");
        expect(manifest.surfaces).to.deep.equal(["clr"]);
        expect(manifest.source?.exports?.["."]).to.equal("./src/App.ts");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("should write @tsonic/js surface config when requested", () => {
      const dir = mkdtempSync(join(tmpdir(), "tsonic-init-js-"));
      try {
        const result = initWorkspace(dir, {
          skipTypes: true,
          surface: "@tsonic/js",
        });
        expect(result.ok).to.equal(true);

        const workspaceRaw = readFileSync(
          join(dir, "tsonic.workspace.json"),
          "utf-8"
        );
        const workspace = JSON.parse(workspaceRaw) as {
          readonly surface?: string;
          readonly dotnet?: {
            readonly typeRoots?: readonly string[];
          };
        };
        expect(workspace.surface).to.equal("@tsonic/js");
        expect(
          (workspace.dotnet?.typeRoots ?? []).some(
            (root) =>
              root === "node_modules/@tsonic/js" ||
              /[/\\]js[/\\]versions[/\\]\d+$/.test(root)
          )
        ).to.equal(true);

        const workspaceName = basename(dir);
        const appTs = readFileSync(
          join(dir, "packages", workspaceName, "src", "App.ts"),
          "utf-8"
        );
        expect(appTs).to.include("console.log");
        expect(appTs).to.include(".trim()");

        const manifest = JSON.parse(
          readFileSync(
            join(
              dir,
              "packages",
              workspaceName,
              "tsonic",
              "package-manifest.json"
            ),
            "utf-8"
          )
        ) as {
          readonly surfaces?: readonly string[];
        };
        expect(manifest.surfaces).to.deep.equal(["@tsonic/js"]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("should write custom surface config when requested", () => {
      const dir = mkdtempSync(join(tmpdir(), "tsonic-init-custom-surface-"));
      try {
        writeFileSync(
          join(dir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", private: true, type: "module" },
            null,
            2
          )
        );
        const jsRoot = join(dir, "node_modules", "@tsonic", "js");
        mkdirSync(jsRoot, { recursive: true });
        writeFileSync(
          join(jsRoot, "package.json"),
          JSON.stringify({
            name: "@tsonic/js",
            version: "1.0.0",
            type: "module",
          })
        );
        writeFileSync(
          join(jsRoot, "tsonic.surface.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              id: "@tsonic/js",
              extends: [],
              requiredTypeRoots: ["types"],
              requiredNpmPackages: ["@tsonic/js"],
            },
            null,
            2
          )
        );

        const customRoot = join(dir, "node_modules", "@acme", "surface-node");
        mkdirSync(customRoot, { recursive: true });
        writeFileSync(
          join(customRoot, "package.json"),
          JSON.stringify(
            { name: "@acme/surface-node", version: "1.0.0", type: "module" },
            null,
            2
          )
        );
        writeFileSync(
          join(customRoot, "tsonic.surface.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              id: "@acme/surface-node",
              extends: ["@tsonic/js"],
              requiredTypeRoots: ["types"],
              requiredNpmPackages: ["@acme/surface-node", "@tsonic/js"],
            },
            null,
            2
          )
        );

        const result = initWorkspace(dir, {
          skipTypes: true,
          surface: "@acme/surface-node",
        });
        expect(result.ok).to.equal(true);

        const workspaceRaw = readFileSync(
          join(dir, "tsonic.workspace.json"),
          "utf-8"
        );
        const workspace = JSON.parse(workspaceRaw) as {
          readonly surface?: string;
          readonly dotnet?: {
            readonly typeRoots?: readonly string[];
          };
        };
        expect(workspace.surface).to.equal("@acme/surface-node");
        expect(
          (workspace.dotnet?.typeRoots ?? []).some(
            (root) =>
              root === join(jsRoot, "types") ||
              root === "node_modules/@tsonic/js" ||
              /[/\\]js[/\\]versions[/\\]\d+$/.test(root)
          )
        ).to.equal(true);
        expect(
          (workspace.dotnet?.typeRoots ?? []).some(
            (root) =>
              root === join(customRoot, "types") ||
              root === "node_modules/@acme/surface-node" ||
              /[/\\]surface-node[/\\]\d+$/.test(root) ||
              /[/\\]surface-node[/\\]types$/.test(root)
          )
        ).to.equal(true);

        const workspaceName = basename(dir);
        const appTs = readFileSync(
          join(dir, "packages", workspaceName, "src", "App.ts"),
          "utf-8"
        );
        expect(appTs).to.include("console.log");
        expect(appTs).to.include(".trim()");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});
