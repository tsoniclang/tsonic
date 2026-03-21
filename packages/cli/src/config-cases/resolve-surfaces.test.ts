import { describe, it } from "mocha";
import { expect } from "chai";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveConfig } from "../config.js";
import {
  PROJECT_ROOT,
  WORKSPACE_ROOT,
  hasSurfaceRoot,
  makeProjectConfig,
  makeWorkspaceConfig,
} from "./helpers.js";

describe("Config (surfaces and type roots)", () => {
  it("should default surface to clr", () => {
    const result = resolveConfig(
      makeWorkspaceConfig(),
      makeProjectConfig(),
      {},
      WORKSPACE_ROOT,
      PROJECT_ROOT
    );
    expect(result.surface).to.equal("clr");
  });

  it("should resolve @tsonic/js surface from workspace config", () => {
    const result = resolveConfig(
      makeWorkspaceConfig({ surface: "@tsonic/js" }),
      makeProjectConfig(),
      {},
      WORKSPACE_ROOT,
      PROJECT_ROOT
    );
    expect(result.surface).to.equal("@tsonic/js");
    expect(hasSurfaceRoot(result.typeRoots, "@tsonic/js")).to.equal(true);
  });

  it("should append required @tsonic/js typeRoots when partially configured", () => {
    const result = resolveConfig(
      makeWorkspaceConfig({
        surface: "@tsonic/js",
        dotnet: { typeRoots: ["custom/path/types"] },
      }),
      makeProjectConfig(),
      {},
      WORKSPACE_ROOT,
      PROJECT_ROOT
    );
    expect(result.typeRoots).to.include("custom/path/types");
    expect(hasSurfaceRoot(result.typeRoots, "@tsonic/js")).to.equal(true);
  });

  it("should include inherited typeRoots when a custom surface manifest extends @tsonic/js", () => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), "tsonic-config-surface-"));
    const projectRoot = join(workspaceRoot, "packages", "myapp");
    mkdirSync(projectRoot, { recursive: true });

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
        JSON.stringify({ name: "@tsonic/js", version: "1.0.0", type: "module" })
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

      const result = resolveConfig(
        makeWorkspaceConfig({ surface: "@acme/surface-node" }),
        makeProjectConfig(),
        {},
        workspaceRoot,
        projectRoot
      );
      expect(
        result.typeRoots.includes(join(jsRoot, "types")) ||
          hasSurfaceRoot(result.typeRoots, "@tsonic/js")
      ).to.equal(true);
      expect(
        result.typeRoots.includes(join(customRoot, "types")) ||
          hasSurfaceRoot(result.typeRoots, "@acme/surface-node")
      ).to.equal(true);
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("should default typeRoots to clr surface roots", () => {
    const result = resolveConfig(
      makeWorkspaceConfig({ dotnet: {} }),
      makeProjectConfig(),
      {},
      WORKSPACE_ROOT,
      PROJECT_ROOT
    );
    expect(result.typeRoots).to.deep.equal(["node_modules/@tsonic/globals"]);
  });

  it("should use typeRoots from workspace.dotnet.typeRoots", () => {
    const result = resolveConfig(
      makeWorkspaceConfig({
        dotnet: {
          typeRoots: ["custom/path/types", "another/path/types"],
        },
      }),
      makeProjectConfig(),
      {},
      WORKSPACE_ROOT,
      PROJECT_ROOT
    );
    expect(result.typeRoots).to.deep.equal([
      "custom/path/types",
      "another/path/types",
      "node_modules/@tsonic/globals",
    ]);
  });
});
