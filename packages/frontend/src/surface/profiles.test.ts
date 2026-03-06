import { expect } from "chai";
import { describe, it } from "mocha";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { resolveSurfaceCapabilities } from "./profiles.js";

describe("Frontend Surface Profiles", () => {
  it("should resolve clr capabilities", () => {
    const caps = resolveSurfaceCapabilities("clr");
    expect(caps.includesClr).to.equal(true);
    expect(caps.requiredTypeRoots).to.deep.equal([
      "node_modules/@tsonic/globals",
    ]);
    expect(caps.useStandardLib).to.equal(false);
  });

  it("should resolve js capabilities", () => {
    const caps = resolveSurfaceCapabilities("@tsonic/js");
    expect(caps.includesClr).to.equal(false);
    expect(caps.requiredTypeRoots).to.deep.equal(["node_modules/@tsonic/js"]);
    expect(caps.useStandardLib).to.equal(false);
  });

  it("should resolve nodejs capabilities via package fallback type roots", () => {
    const caps = resolveSurfaceCapabilities("@tsonic/nodejs");
    expect(caps.includesClr).to.equal(false);
    expect(caps.requiredTypeRoots).to.deep.equal([
      "node_modules/@tsonic/nodejs",
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

  it("should support custom surfaces with fallback capabilities", () => {
    const caps = resolveSurfaceCapabilities("@acme/surface-web");
    expect(caps.mode).to.equal("@acme/surface-web");
    expect(caps.includesClr).to.equal(false);
    expect(caps.requiredTypeRoots).to.deep.equal([
      "node_modules/@acme/surface-web",
    ]);
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

  it("should resolve nodejs -> js chain from package manifests", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "tsonic-frontend-nodejs-"));
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
      writeFileSync(
        join(nodejsRoot, "tsonic.surface.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            id: "@tsonic/nodejs",
            extends: ["@tsonic/js"],
            requiredTypeRoots: ["types"],
            useStandardLib: false,
          },
          null,
          2
        )
      );

      const caps = resolveSurfaceCapabilities("@tsonic/nodejs", {
        projectRoot,
      });
      expect(caps.includesClr).to.equal(false);
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
            root === resolve(nodejsRoot, "types") ||
            /[/\\]nodejs[/\\]versions[/\\]\d+$/.test(root)
        )
      ).to.equal(true);
      expect(caps.useStandardLib).to.equal(false);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
