import { describe, it } from "mocha";
import { expect } from "chai";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addNpmCommand } from "../add-npm.js";
import {
  readWorkspaceConfig,
  writeLocalNpmPackage,
  writeWorkspaceConfig,
} from "./helpers.js";

describe("add npm (transitive package manifests)", function () {
  this.timeout(3 * 60 * 1000);

  it("resolves transitive package manifests and injects all runtime NuGet references", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-add-npm-package-manifest-transitive-")
    );
    try {
      const configPath = writeWorkspaceConfig(dir);
      writeLocalNpmPackage(dir, "local/acme-child", {
        name: "acme-child",
        packageManifest: {
          schemaVersion: 1,
          kind: "tsonic-source-package",
          surfaces: ["@tsonic/js"],
          runtime: {
            nugetPackages: [{ id: "Acme.Child.Runtime", version: "1.0.0" }],
          },
          producer: {
            tool: "tsonic",
            version: "0.0.70",
            mode: "tsonic-firstparty",
          },
          source: {
            exports: {
              ".": "./src/index.ts",
            },
          },
        },
      });
      mkdirSync(join(dir, "local/acme-child", "src"), { recursive: true });
      writeFileSync(
        join(dir, "local/acme-child", "src", "index.ts"),
        "export const child = true;\n",
        "utf-8"
      );
      writeLocalNpmPackage(dir, "local/acme-parent", {
        name: "acme-parent",
        dependencies: { "acme-child": "file:../acme-child" },
        packageManifest: {
          schemaVersion: 1,
          kind: "tsonic-source-package",
          surfaces: ["@tsonic/js"],
          runtime: {
            nugetPackages: [{ id: "Acme.Parent.Runtime", version: "1.0.0" }],
          },
          producer: {
            tool: "tsonic",
            version: "0.0.70",
            mode: "tsonic-firstparty",
          },
          source: {
            exports: {
              ".": "./src/index.ts",
            },
          },
        },
      });
      mkdirSync(join(dir, "local/acme-parent", "src"), { recursive: true });
      writeFileSync(
        join(dir, "local/acme-parent", "src", "index.ts"),
        "export const parent = true;\n",
        "utf-8"
      );

      const result = addNpmCommand("./local/acme-parent", configPath, {
        quiet: true,
      });
      expect(result.ok).to.equal(true);
      expect(result.ok ? result.value.packageName : "").to.equal("acme-parent");
      expect(readWorkspaceConfig(dir).dotnet.packageReferences).to.deep.equal([
        { id: "Acme.Child.Runtime", version: "1.0.0" },
        { id: "Acme.Parent.Runtime", version: "1.0.0" },
      ]);
      expect(
        existsSync(
          join(
            dir,
            ".tsonic",
            "manifests",
            "npm",
            "acme-child",
            "tsonic.bindings.normalized.json"
          )
        )
      ).to.equal(true);
      expect(
        existsSync(
          join(
            dir,
            ".tsonic",
            "manifests",
            "npm",
            "acme-parent",
            "tsonic.bindings.normalized.json"
          )
        )
      ).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails fast when a transitive source package has an invalid kind", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-add-npm-package-manifest-root-")
    );
    try {
      const configPath = writeWorkspaceConfig(dir);
      writeLocalNpmPackage(dir, "local/acme-node", {
        name: "@acme/node",
        packageManifest: {
          schemaVersion: 1,
          kind: "invalid-kind",
          runtime: {
            nugetPackages: [{ id: "Acme.Node.Runtime", version: "1.0.0" }],
          },
        },
      });

      const result = addNpmCommand("./local/acme-node", configPath, {
        quiet: true,
      });
      expect(result.ok).to.equal(false);
      expect(result.ok ? "" : result.error).to.match(/^TSN8A01:/);
      expect(result.ok ? "" : result.error).to.include(
        'kind must be "tsonic-source-package"'
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
