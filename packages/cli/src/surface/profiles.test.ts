import { expect } from "chai";
import { describe, it } from "mocha";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  hasResolvedSurfaceProfile,
  isSurfaceMode,
  resolveSurfaceCapabilities,
} from "./profiles.js";

describe("CLI Surface Profiles", () => {
  it("should resolve clr capabilities", () => {
    const caps = resolveSurfaceCapabilities("clr");
    expect(caps.includesClr).to.equal(true);
    expect(caps.resolvedModes).to.deep.equal(["clr"]);
    expect(caps.requiredTypeRoots).to.deep.equal([
      "node_modules/@tsonic/globals",
    ]);
    expect(caps.requiredNpmPackages).to.deep.equal([
      "@tsonic/globals",
      "@tsonic/dotnet",
    ]);
    expect(caps.useStandardLib).to.equal(false);
  });

  it("should validate surface mode strings", () => {
    expect(isSurfaceMode("clr")).to.equal(true);
    expect(isSurfaceMode("@tsonic/js")).to.equal(true);
    expect(isSurfaceMode("@tsonic/nodejs")).to.equal(true);
    expect(isSurfaceMode("web")).to.equal(true);
    expect(isSurfaceMode("")).to.equal(false);
    expect(isSurfaceMode("   ")).to.equal(false);
  });

  it("should default to clr when mode is undefined", () => {
    const caps = resolveSurfaceCapabilities(undefined);
    expect(caps.mode).to.equal("clr");
    expect(caps.includesClr).to.equal(true);
    expect(caps.requiredTypeRoots).to.deep.equal([
      "node_modules/@tsonic/globals",
    ]);
  });

  it("should leave unresolved custom surfaces empty until a manifest is installed", () => {
    const caps = resolveSurfaceCapabilities("@acme/surface-web");
    expect(caps.mode).to.equal("@acme/surface-web");
    expect(caps.includesClr).to.equal(false);
    expect(caps.requiredTypeRoots).to.deep.equal([]);
    expect(caps.requiredNpmPackages).to.deep.equal([]);
    expect(caps.useStandardLib).to.equal(false);
  });

  it("should prefer installed @tsonic/js manifest without clr inheritance", () => {
    const workspaceRoot = mkdtempSync(
      join(tmpdir(), "tsonic-surface-sibling-")
    );
    try {
      writeFileSync(
        join(workspaceRoot, "package.json"),
        JSON.stringify({ name: "app", private: true, type: "module" }, null, 2)
      );
      const jsRoot = join(workspaceRoot, "node_modules", "@tsonic", "js");
      mkdirSync(jsRoot, { recursive: true });
      writeFileSync(
        join(jsRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/js", version: "1.0.0", type: "module" },
          null,
          2
        )
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
            useStandardLib: false,
          },
          null,
          2
        )
      );

      const caps = resolveSurfaceCapabilities("@tsonic/js", { workspaceRoot });
      expect(caps.requiredNpmPackages).to.deep.equal(["@tsonic/js"]);
      expect(caps.resolvedModes).to.deep.equal(["@tsonic/js"]);
      expect(caps.requiredTypeRoots).to.include(resolve(jsRoot, "types"));
      expect(caps.requiredTypeRoots).to.not.include(
        "node_modules/@tsonic/dotnet"
      );
      expect(caps.includesClr).to.equal(false);
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("should resolve js capabilities only when a surface manifest exists", () => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), "tsonic-surface-js-"));
    try {
      writeFileSync(
        join(workspaceRoot, "package.json"),
        JSON.stringify({ name: "app", private: true, type: "module" }, null, 2)
      );
      const jsRoot = join(workspaceRoot, "node_modules", "@tsonic", "js");
      mkdirSync(jsRoot, { recursive: true });
      writeFileSync(
        join(jsRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/js", version: "1.0.0", type: "module" },
          null,
          2
        )
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
            useStandardLib: false,
          },
          null,
          2
        )
      );

      const caps = resolveSurfaceCapabilities("@tsonic/js", { workspaceRoot });
      expect(caps.includesClr).to.equal(false);
      expect(caps.requiredNpmPackages).to.deep.equal(["@tsonic/js"]);
      expect(caps.requiredTypeRoots).to.include(resolve(jsRoot, "types"));
      expect(caps.useStandardLib).to.equal(false);
      expect(
        hasResolvedSurfaceProfile("@tsonic/js", { workspaceRoot })
      ).to.equal(true);
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("should not treat installed regular packages as surfaces without manifest", () => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), "tsonic-surface-nodejs-"));
    try {
      writeFileSync(
        join(workspaceRoot, "package.json"),
        JSON.stringify({ name: "app", private: true, type: "module" }, null, 2)
      );
      const nodejsRoot = join(
        workspaceRoot,
        "node_modules",
        "@tsonic",
        "nodejs"
      );
      mkdirSync(nodejsRoot, { recursive: true });
      writeFileSync(
        join(nodejsRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/nodejs", version: "1.0.0", type: "module" },
          null,
          2
        )
      );

      const caps = resolveSurfaceCapabilities("@tsonic/nodejs", {
        workspaceRoot,
      });
      expect(caps.includesClr).to.equal(false);
      expect(caps.requiredTypeRoots).to.deep.equal([]);
      expect(caps.requiredNpmPackages).to.deep.equal([]);
      expect(caps.useStandardLib).to.equal(false);
      expect(
        hasResolvedSurfaceProfile("@tsonic/nodejs", { workspaceRoot })
      ).to.equal(false);
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("should load custom surface manifest from installed package", () => {
    const workspaceRoot = mkdtempSync(
      join(tmpdir(), "tsonic-surface-manifest-")
    );
    try {
      writeFileSync(
        join(workspaceRoot, "package.json"),
        JSON.stringify({ name: "app", private: true, type: "module" }, null, 2)
      );
      const jsRoot = join(workspaceRoot, "node_modules", "@tsonic", "js");
      mkdirSync(jsRoot, { recursive: true });
      writeFileSync(
        join(jsRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/js", version: "1.0.0", type: "module" },
          null,
          2
        )
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
            useStandardLib: false,
          },
          null,
          2
        )
      );
      const packageRoot = join(
        workspaceRoot,
        "node_modules",
        "@acme",
        "surface-web"
      );
      mkdirSync(packageRoot, { recursive: true });
      writeFileSync(
        join(packageRoot, "package.json"),
        JSON.stringify(
          { name: "@acme/surface-web", version: "1.0.0", type: "module" },
          null,
          2
        )
      );
      writeFileSync(
        join(packageRoot, "tsonic.surface.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            id: "@acme/surface-web",
            extends: ["@tsonic/js"],
            requiredTypeRoots: ["types", "globals"],
            requiredNpmPackages: ["@acme/surface-web", "@acme/runtime"],
            useStandardLib: false,
          },
          null,
          2
        )
      );

      const caps = resolveSurfaceCapabilities("@acme/surface-web", {
        workspaceRoot,
      });
      expect(caps.mode).to.equal("@acme/surface-web");
      expect(caps.includesClr).to.equal(false);
      expect(caps.requiredNpmPackages).to.deep.equal([
        "@tsonic/js",
        "@acme/surface-web",
        "@acme/runtime",
      ]);
      expect(caps.requiredNpmPackages).to.not.include("@tsonic/dotnet");
      expect(caps.requiredTypeRoots).to.include(resolve(jsRoot, "types"));
      expect(caps.requiredTypeRoots).to.not.include(
        "node_modules/@tsonic/dotnet"
      );
      expect(caps.requiredTypeRoots).to.include(resolve(packageRoot, "types"));
      expect(caps.requiredTypeRoots).to.include(
        resolve(packageRoot, "globals")
      );
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("should resolve custom surface chains from installed package manifests", () => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), "tsonic-surface-custom-"));
    try {
      writeFileSync(
        join(workspaceRoot, "package.json"),
        JSON.stringify({ name: "app", private: true, type: "module" }, null, 2)
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
            useStandardLib: false,
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
            requiredNpmPackages: ["@acme/surface-node"],
            useStandardLib: false,
          },
          null,
          2
        )
      );

      const caps = resolveSurfaceCapabilities("@acme/surface-node", {
        workspaceRoot,
      });
      expect(caps.mode).to.equal("@acme/surface-node");
      expect(caps.resolvedModes).to.deep.equal([
        "@tsonic/js",
        "@acme/surface-node",
      ]);
      expect(caps.includesClr).to.equal(false);
      expect(caps.requiredNpmPackages).to.deep.equal([
        "@tsonic/js",
        "@acme/surface-node",
      ]);
      expect(
        caps.requiredTypeRoots.some(
          (root) =>
            root === resolve(jsRoot, "types") ||
            /[/\\]js[/\\]versions[/\\]\d+$/.test(root)
        )
      ).to.equal(true);
      expect(
        caps.requiredTypeRoots.some(
          (root) =>
            root === resolve(customRoot, "types") ||
            /[/\\]surface-node[/\\]types$/.test(root)
        )
      ).to.equal(true);
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });
});
