import { expect } from "chai";
import { describe, it } from "mocha";
import { resolve } from "node:path";
import { materializeFrontendFixture } from "../testing/filesystem-fixtures.js";
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
  });

  it("should load custom surface manifest from installed package", () => {
    const fixture = materializeFrontendFixture(
      "surface/profiles/custom-surface-manifest"
    );
    try {
      const projectRoot = fixture.path("app");
      const jsRoot = fixture.path("app/node_modules/@tsonic/js");
      const packageRoot = fixture.path("app/node_modules/@acme/surface-web");

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
    } finally {
      fixture.cleanup();
    }
  });

  it("should resolve js capabilities only when a surface manifest exists", () => {
    const fixture = materializeFrontendFixture(
      "surface/profiles/js-surface-manifest"
    );
    try {
      const projectRoot = fixture.path("app");
      const jsRoot = fixture.path("app/node_modules/@tsonic/js");

      const caps = resolveSurfaceCapabilities("@tsonic/js", { projectRoot });
      expect(caps.includesClr).to.equal(false);
      expect(caps.resolvedModes).to.deep.equal(["@tsonic/js"]);
      expect(caps.requiredTypeRoots).to.deep.equal([resolve(jsRoot, "types")]);
      expect(hasResolvedSurfaceProfile("@tsonic/js", { projectRoot })).to.equal(
        true
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("prefers a project-installed symlinked surface package over a sibling checkout", () => {
    const fixture = materializeFrontendFixture(
      "surface/profiles/project-symlinked-surface"
    );
    try {
      const projectRoot = fixture.path("project");
      const externalRoot = fixture.path("external/js");

      const caps = resolveSurfaceCapabilities("@tsonic/js", { projectRoot });
      expect(caps.requiredTypeRoots).to.include(
        resolve(externalRoot, "linked-types")
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("prefers an ancestor workspace-installed surface package over a sibling checkout", () => {
    const fixture = materializeFrontendFixture(
      "surface/profiles/ancestor-workspace-symlinked-surface"
    );
    try {
      const projectRoot = fixture.path("workspace/packages/app");
      const externalRoot = fixture.path("external/js");

      const caps = resolveSurfaceCapabilities("@tsonic/js", { projectRoot });
      expect(caps.requiredTypeRoots).to.include(
        resolve(externalRoot, "linked-types")
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("finds an ancestor installed surface package even when the active roots have no package.json", () => {
    const fixture = materializeFrontendFixture(
      "surface/profiles/ancestor-installed-no-package-json"
    );
    try {
      const projectRoot = fixture.path("workspace/packages/app");
      const externalRoot = fixture.path("external/js");

      const caps = resolveSurfaceCapabilities("@tsonic/js", { projectRoot });
      expect(caps.requiredTypeRoots).to.include(
        resolve(externalRoot, "linked-types")
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("prefers sibling @tsonic surface packages over stray ancestor node_modules installs", () => {
    const fixture = materializeFrontendFixture(
      "surface/profiles/sibling-source-over-stray-ancestor"
    );
    try {
      const strayJsRoot = fixture.path("workspace/node_modules/@tsonic/js");
      const projectRoot = fixture.path("workspace/nodejs");
      const siblingJsRoot = fixture.path("workspace/js/versions/10");

      const caps = resolveSurfaceCapabilities("@tsonic/js", { projectRoot });
      expect(caps.requiredTypeRoots).to.include(resolve(siblingJsRoot));
      expect(caps.requiredTypeRoots).to.not.include(
        resolve(strayJsRoot, "types")
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("prefers a sibling source package over an installed legacy surface package relative to the project root", () => {
    const fixture = materializeFrontendFixture(
      "surface/profiles/sibling-source-over-legacy-installed"
    );
    try {
      const projectRoot = fixture.path("workspace/nodejs");
      const installedJsRoot = fixture.path(
        "workspace/nodejs/node_modules/@tsonic/js"
      );
      const siblingJsRoot = fixture.path("workspace/js/versions/10");

      const caps = resolveSurfaceCapabilities("@tsonic/js", { projectRoot });
      expect(caps.requiredTypeRoots).to.include(resolve(siblingJsRoot));
      expect(caps.requiredTypeRoots).to.not.include(
        resolve(installedJsRoot, "legacy-types")
      );
      expect(caps.resolvedModes).to.deep.equal(["@tsonic/js"]);
    } finally {
      fixture.cleanup();
    }
  });

  it("prefers an ancestor workspace-installed source package over a sibling source package", () => {
    const fixture = materializeFrontendFixture(
      "surface/profiles/installed-source-over-sibling-source"
    );
    try {
      const projectRoot = fixture.path("workspace/packages/app");
      const installedJsRoot = fixture.path("workspace/node_modules/@tsonic/js");
      const siblingJsRoot = fixture.path("workspace/js/versions/10");

      const caps = resolveSurfaceCapabilities("@tsonic/js", { projectRoot });
      expect(caps.requiredTypeRoots).to.deep.equal([resolve(installedJsRoot)]);
      expect(caps.requiredTypeRoots).to.not.include(resolve(siblingJsRoot));
      expect(caps.resolvedModes).to.deep.equal(["@tsonic/js"]);
    } finally {
      fixture.cleanup();
    }
  });

  it("should not treat installed regular packages as surfaces without manifest", () => {
    const fixture = materializeFrontendFixture(
      "surface/profiles/regular-package-not-surface"
    );
    try {
      const projectRoot = fixture.path("app");

      const caps = resolveSurfaceCapabilities("@tsonic/nodejs", {
        projectRoot,
      });
      expect(caps.includesClr).to.equal(false);
      expect(caps.requiredTypeRoots).to.deep.equal([]);
      expect(
        hasResolvedSurfaceProfile("@tsonic/nodejs", { projectRoot })
      ).to.equal(false);
    } finally {
      fixture.cleanup();
    }
  });

  it("should resolve custom surface -> js chain from package manifests", () => {
    const fixture = materializeFrontendFixture(
      "surface/profiles/custom-surface-js-chain"
    );
    try {
      const projectRoot = fixture.path("app");
      const jsRoot = fixture.path("app/node_modules/@tsonic/js");
      const customRoot = fixture.path("app/node_modules/@acme/surface-node");

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
    } finally {
      fixture.cleanup();
    }
  });

  it("loads sibling source-package surface manifests before falling back to source-package defaults", () => {
    const fixture = materializeFrontendFixture(
      "surface/profiles/sibling-nodejs-surface-before-default"
    );
    try {
      const projectRoot = fixture.path("workspace/app");
      const jsRoot = fixture.path("workspace/js/versions/10");
      const nodejsRoot = fixture.path("workspace/nodejs/versions/10");

      const caps = resolveSurfaceCapabilities("@tsonic/nodejs", {
        projectRoot,
      });
      expect(caps.includesClr).to.equal(false);
      expect(caps.resolvedModes).to.deep.equal([
        "@tsonic/js",
        "@tsonic/nodejs",
      ]);
      expect(caps.requiredTypeRoots).to.include(resolve(jsRoot));
      expect(caps.requiredTypeRoots).to.include(resolve(nodejsRoot));
    } finally {
      fixture.cleanup();
    }
  });
});
