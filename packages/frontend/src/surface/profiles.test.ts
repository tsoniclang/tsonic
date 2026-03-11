import { expect } from "chai";
import { describe, it } from "mocha";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  hasResolvedSurfaceProfile,
  resolveSurfaceCapabilities,
} from "./profiles.js";

describe("Frontend Surface Profiles", () => {
  it("should resolve clr capabilities", () => {
    const caps = resolveSurfaceCapabilities("clr");
    expect(caps.includesClr).to.equal(true);
    expect(caps.resolvedModes).to.deep.equal(["clr"]);
    expect(caps.requiredTypeRoots).to.deep.equal([
      "node_modules/@tsonic/globals",
    ]);
    expect(caps.useStandardLib).to.equal(false);
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
    expect(caps.useStandardLib).to.equal(false);
  });

  it("should load custom surface manifest from installed package", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "tsonic-frontend-surface-"));
    try {
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify({ name: "app", private: true, type: "module" }, null, 2)
      );
      const jsRoot = join(projectRoot, "node_modules", "@tsonic", "js");
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
            useStandardLib: false,
          },
          null,
          2
        )
      );
      const packageRoot = join(
        projectRoot,
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
            useStandardLib: false,
          },
          null,
          2
        )
      );

      const caps = resolveSurfaceCapabilities("@acme/surface-web", {
        projectRoot,
      });
      expect(caps.mode).to.equal("@acme/surface-web");
      expect(caps.resolvedModes).to.deep.equal([
        "@tsonic/js",
        "@acme/surface-web",
      ]);
      expect(caps.includesClr).to.equal(false);
      expect(caps.requiredTypeRoots).to.not.include(
        "node_modules/@tsonic/dotnet"
      );
      expect(caps.requiredTypeRoots).to.include(resolve(packageRoot, "types"));
      expect(caps.requiredTypeRoots).to.include(
        resolve(packageRoot, "globals")
      );
      expect(caps.requiredTypeRoots).to.include(resolve(jsRoot, "types"));
      expect(caps.useStandardLib).to.equal(false);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it("should resolve js capabilities only when a surface manifest exists", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "tsonic-frontend-js-"));
    try {
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify({ name: "app", private: true, type: "module" }, null, 2)
      );
      const jsRoot = join(projectRoot, "node_modules", "@tsonic", "js");
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
            useStandardLib: false,
          },
          null,
          2
        )
      );

      const caps = resolveSurfaceCapabilities("@tsonic/js", { projectRoot });
      expect(caps.includesClr).to.equal(false);
      expect(caps.resolvedModes).to.deep.equal(["@tsonic/js"]);
      expect(caps.requiredTypeRoots).to.deep.equal([resolve(jsRoot, "types")]);
      expect(caps.useStandardLib).to.equal(false);
      expect(hasResolvedSurfaceProfile("@tsonic/js", { projectRoot })).to.equal(
        true
      );
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it("prefers sibling @tsonic surface packages over stray ancestor node_modules installs", () => {
    const strayJsRoot = join(tmpdir(), "node_modules", "@tsonic", "js");
    const strayPackageJsonPath = join(strayJsRoot, "package.json");
    const strayManifestPath = join(strayJsRoot, "tsonic.surface.json");
    const hadStray = existsSync(strayJsRoot);
    const originalPackageJson = existsSync(strayPackageJsonPath)
      ? readFileSync(strayPackageJsonPath, "utf-8")
      : undefined;
    const originalManifest = existsSync(strayManifestPath)
      ? readFileSync(strayManifestPath, "utf-8")
      : undefined;
    const projectRoot = mkdtempSync(join(tmpdir(), "tsonic-frontend-stray-"));
    try {
      mkdirSync(strayJsRoot, { recursive: true });
      writeFileSync(
        strayPackageJsonPath,
        JSON.stringify(
          { name: "@tsonic/js", version: "0.0.0-test", type: "module" },
          null,
          2
        )
      );
      writeFileSync(
        strayManifestPath,
        JSON.stringify(
          {
            schemaVersion: 1,
            id: "@tsonic/js",
            extends: [],
            requiredTypeRoots: ["types"],
            useStandardLib: false,
          },
          null,
          2
        )
      );

      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify({ name: "app", private: true, type: "module" }, null, 2)
      );

      const caps = resolveSurfaceCapabilities("@tsonic/js", { projectRoot });
      expect(
        caps.requiredTypeRoots.some((root) => /[/\\]js[/\\]versions[/\\]\d+$/.test(root))
      ).to.equal(true);
      expect(caps.requiredTypeRoots).to.not.include(resolve(strayJsRoot, "types"));
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
      if (hadStray) {
        if (originalPackageJson !== undefined) {
          writeFileSync(strayPackageJsonPath, originalPackageJson);
        }
        if (originalManifest !== undefined) {
          writeFileSync(strayManifestPath, originalManifest);
        }
      } else {
        rmSync(strayJsRoot, { recursive: true, force: true });
      }
    }
  });

  it("should not treat installed regular packages as surfaces without manifest", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "tsonic-frontend-nodejs-"));
    try {
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify({ name: "app", private: true, type: "module" }, null, 2)
      );
      const nodejsRoot = join(projectRoot, "node_modules", "@tsonic", "nodejs");
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
        projectRoot,
      });
      expect(caps.includesClr).to.equal(false);
      expect(caps.requiredTypeRoots).to.deep.equal([]);
      expect(caps.useStandardLib).to.equal(false);
      expect(
        hasResolvedSurfaceProfile("@tsonic/nodejs", { projectRoot })
      ).to.equal(false);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it("should resolve custom surface -> js chain from package manifests", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "tsonic-frontend-custom-"));
    try {
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify({ name: "app", private: true, type: "module" }, null, 2)
      );

      const jsRoot = join(projectRoot, "node_modules", "@tsonic", "js");
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
            useStandardLib: false,
          },
          null,
          2
        )
      );

      const customRoot = join(
        projectRoot,
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
            useStandardLib: false,
          },
          null,
          2
        )
      );

      const caps = resolveSurfaceCapabilities("@acme/surface-node", {
        projectRoot,
      });
      expect(caps.includesClr).to.equal(false);
      expect(caps.resolvedModes).to.deep.equal([
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
      expect(caps.useStandardLib).to.equal(false);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
