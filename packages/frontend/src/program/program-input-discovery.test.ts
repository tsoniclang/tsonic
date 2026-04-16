import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as path from "node:path";
import { materializeFrontendFixture } from "../testing/filesystem-fixtures.js";
import { discoverProgramInputs } from "./program-input-discovery.js";

describe("discoverProgramInputs", () => {
  it("treats the current project source package as authoritative input state", () => {
    const fixture = materializeFrontendFixture(
      "program/program-input-discovery/self-package-authoritative"
    );

    try {
      const projectRoot = fixture.path("workspace/packages/js-like");
      const sourceRoot = fixture.path("workspace/packages/js-like/src");
      const entryFile = fixture.path("workspace/packages/js-like/src/index.ts");
      const ambientFile = fixture.path("workspace/packages/js-like/globals.ts");

      const discovery = discoverProgramInputs(
        [entryFile],
        {
          projectRoot,
          sourceRoot,
          rootNamespace: "Acme.JsLike",
          surface: "@tsonic/js",
        },
        {
          requiredTypeRoots: [],
          resolvedModes: [],
        }
      );

      expect(
        discovery.authoritativeTsonicPackageRoots.get("@acme/js-like")
      ).to.equal(projectRoot);
      expect(discovery.typeRoots).to.include(projectRoot);
      expect(discovery.allFiles).to.include(ambientFile);
    } finally {
      fixture.cleanup();
    }
  });

  it("widens rootDir to include external installed source package files", () => {
    const fixture = materializeFrontendFixture(
      "program/program-input-discovery/rootdir-external"
    );

    try {
      const projectRoot = fixture.path("workspace/packages/app");
      const sourceRoot = fixture.path("workspace/packages/app/src");
      const entryFile = fixture.path("workspace/packages/app/src/App.ts");
      const externalPackageFile = fixture.path(
        "external/nodejs-next/src/fs-module.ts"
      );

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
        }
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
      fixture.cleanup();
    }
  });

  it("widens rootDir to include symlinked source package files by real path", () => {
    const fixture = materializeFrontendFixture(
      "program/program-input-discovery/rootdir-symlink"
    );

    try {
      const projectRoot = fixture.path("workspace/packages/app");
      const sourceRoot = fixture.path("workspace/packages/app/src");
      const entryFile = fixture.path("workspace/packages/app/src/App.ts");
      const externalPackageFile = fixture.path(
        "external/nodejs-next/src/fs-module.ts"
      );
      const linkedPackageFile = fixture.path(
        "workspace/node_modules/@tsonic/nodejs/src/fs-module.ts"
      );

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
        }
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
      fixture.cleanup();
    }
  });

  it("treats symlinked installed source surface packages as authoritative", () => {
    const fixture = materializeFrontendFixture(
      "program/program-input-discovery/symlinked-installed-surface"
    );

    try {
      const projectRoot = fixture.path("app");
      const sourceRoot = fixture.path("app/src");
      const entryFile = fixture.path("app/src/index.ts");
      const linkedJsRoot = fixture.path("app/node_modules/@tsonic/js");

      const discovery = discoverProgramInputs(
        [entryFile],
        {
          projectRoot,
          sourceRoot,
          rootNamespace: "App",
          surface: "@tsonic/js",
        },
        {
          requiredTypeRoots: [],
          resolvedModes: ["@tsonic/js"],
        }
      );

      expect(
        discovery.authoritativeTsonicPackageRoots.get("@tsonic/js")
      ).to.equal(linkedJsRoot);
      expect(discovery.typeRoots).to.include(linkedJsRoot);
    } finally {
      fixture.cleanup();
    }
  });

  it("activates installed source surface packages when sibling first-party source typeRoots are present", () => {
    const fixture = materializeFrontendFixture(
      "program/program-input-discovery/symlinked-installed-surface"
    );

    try {
      const projectRoot = fixture.path("app");
      const sourceRoot = fixture.path("app/src");
      const entryFile = fixture.path("app/src/index.ts");
      const linkedJsRoot = fixture.path("app/node_modules/@tsonic/js");
      const linkedJsAmbientFile = fixture.path("app/node_modules/@tsonic/js/globals.ts");
      const sourceNodejsRoot = fixture.path("app/node_modules/@tsonic/nodejs");

      fs.mkdirSync(path.join(sourceNodejsRoot, "src"), { recursive: true });
      fs.writeFileSync(
        path.join(sourceNodejsRoot, "package.json"),
        JSON.stringify(
          {
            name: "@tsonic/nodejs",
            version: "10.0.49-next.0",
            type: "module",
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(sourceNodejsRoot, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/nodejs"],
            source: {
              namespace: "nodejs",
              exports: {
                "./index.js": "./src/index.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(sourceNodejsRoot, "src/index.ts"),
        "export const nodeRuntime = true;\n"
      );

      const discovery = discoverProgramInputs(
        [entryFile],
        {
          projectRoot,
          sourceRoot,
          rootNamespace: "App",
          surface: "@tsonic/js",
          typeRoots: [sourceNodejsRoot],
        },
        {
          requiredTypeRoots: [],
          resolvedModes: ["@tsonic/js"],
        }
      );

      expect(
        discovery.authoritativeTsonicPackageRoots.get("@tsonic/js")
      ).to.equal(linkedJsRoot);
      expect(discovery.typeRoots).to.include(linkedJsRoot);
      expect(discovery.typeRoots).to.include(fs.realpathSync(sourceNodejsRoot));
      expect(discovery.allFiles).to.include(linkedJsAmbientFile);
    } finally {
      fixture.cleanup();
    }
  });

  it("expands sibling source-package waves beyond stale installed @tsonic roots", () => {
    const fixture = materializeFrontendFixture(
      "program/program-input-discovery/sibling-wave"
    );

    try {
      const projectRoot = fixture.path("workspace/proof/js");
      const sourceRoot = fixture.path("workspace/proof/js/src");
      const entryFile = fixture.path("workspace/proof/js/src/App.ts");
      const installedNodejsRoot = fixture.path(
        "workspace/proof/js/node_modules/@tsonic/nodejs"
      );
      const installedJsRoot = fixture.path(
        "workspace/proof/js/node_modules/@tsonic/js"
      );
      const jsSiblingRoot = fixture.path("workspace/js-next/versions/10");

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
        }
      );

      expect(
        discovery.authoritativeTsonicPackageRoots.get("@tsonic/nodejs")
      ).to.equal(fs.realpathSync(installedNodejsRoot));
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
      fixture.cleanup();
    }
  });

  it("does not activate unrelated installed source-package ambients for clr compilations", () => {
    const fixture = materializeFrontendFixture(
      "program/program-input-discovery/no-js-leak-clr"
    );

    try {
      const projectRoot = fixture.path("app");
      const sourceRoot = fixture.path("app/src");
      const entryFile = fixture.path("app/src/index.ts");
      const jsRoot = fixture.path("app/node_modules/@tsonic/js");
      const jsAmbientFile = fixture.path("app/node_modules/@tsonic/js/globals.ts");

      const discovery = discoverProgramInputs(
        [entryFile],
        {
          projectRoot,
          sourceRoot,
          rootNamespace: "App",
        },
        {
          requiredTypeRoots: [],
          resolvedModes: ["clr"],
        }
      );

      expect(
        discovery.authoritativeTsonicPackageRoots.get("@tsonic/js")
      ).to.equal(jsRoot);
      expect(discovery.typeRoots.includes(jsRoot)).to.equal(false);
      expect(discovery.allFiles.includes(jsAmbientFile)).to.equal(false);
    } finally {
      fixture.cleanup();
    }
  });

  it("orders active source-package typeRoots from the current surface before inherited surfaces", () => {
    const fixture = materializeFrontendFixture(
      "surface/profiles/sibling-nodejs-surface-before-default"
    );

    try {
      const projectRoot = fixture.path("workspace/app");
      const sourceRoot = fixture.path("workspace/app/src");
      const entryFile = fixture.path("workspace/app/src/index.ts");
      const jsRoot = fixture.path("workspace/js/versions/10");
      const nodejsRoot = fixture.path("workspace/nodejs/versions/10");

      fs.mkdirSync(sourceRoot, { recursive: true });
      fs.writeFileSync(entryFile, "export {};\n");

      const discovery = discoverProgramInputs(
        [entryFile],
        {
          projectRoot,
          sourceRoot,
          rootNamespace: "App",
          surface: "@tsonic/nodejs",
        },
        {
          requiredTypeRoots: [jsRoot, nodejsRoot],
          resolvedModes: ["@tsonic/js", "@tsonic/nodejs"],
        }
      );

      expect(discovery.typeRoots.indexOf(nodejsRoot)).to.be.greaterThan(-1);
      expect(discovery.typeRoots.indexOf(jsRoot)).to.be.greaterThan(-1);
      expect(discovery.typeRoots.indexOf(nodejsRoot)).to.be.lessThan(
        discovery.typeRoots.indexOf(jsRoot)
      );
    } finally {
      fixture.cleanup();
    }
  });
});
