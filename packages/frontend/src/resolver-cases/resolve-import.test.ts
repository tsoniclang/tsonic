/**
 * Tests for module resolver -- resolveImport
 */

import { describe, it, before, after, beforeEach } from "mocha";
import { expect } from "chai";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { resolveImport } from "../resolver.js";
import { BindingRegistry } from "../program/bindings.js";
import { __resetDependencyPackageRootCachesForTests } from "../program/package-roots.js";
import { __resetSourcePackageResolutionCachesForTests } from "../resolver/source-package-resolution.js";
import { materializeFrontendFixture } from "../testing/filesystem-fixtures.js";

const materializeResolveImportFixture = (fixtureName: string) =>
  materializeFrontendFixture(`resolver/resolve-import/${fixtureName}`);

describe("Module Resolver", () => {
  describe("resolveImport", () => {
    const tempDir = path.join(os.tmpdir(), "tsonic-test");
    const sourceRoot = tempDir;
    const createNodeBindings = (
      moduleType: string,
      extraModuleTypes: readonly string[] = []
    ): BindingRegistry => {
      const bindings = new BindingRegistry();
      const moduleNames = Array.from(
        new Set([
          moduleType.replace(/^nodejs\./, ""),
          ...extraModuleTypes.map((t) => t.replace(/^nodejs\./, "")),
        ])
      );
      const moduleBindings = Object.fromEntries(
        moduleNames.flatMap((moduleName) => [
          [
            `node:${moduleName}`,
            {
              kind: "module" as const,
              assembly: "nodejs",
              type: `nodejs.${moduleName}`,
            },
          ],
          [
            moduleName,
            {
              kind: "module" as const,
              assembly: "nodejs",
              type: `nodejs.${moduleName}`,
            },
          ],
        ])
      );
      bindings.addBindings("/test/nodejs-bindings.json", {
        bindings: moduleBindings,
      });
      bindings.addBindings("/test/nodejs-types.json", {
        namespace: "nodejs",
        types: moduleNames.map((moduleName) => ({
          clrName: `nodejs.${moduleName}`,
          assemblyName: "nodejs",
          methods: [],
          properties: [],
          fields: [],
        })),
      });
      return bindings;
    };

    before(() => {
      // Create temp directory structure
      fs.mkdirSync(path.join(tempDir, "src", "models"), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, "src", "models", "User.ts"),
        "export class User {}"
      );
      fs.writeFileSync(path.join(tempDir, "src", "index.ts"), "");
    });

    beforeEach(() => {
      __resetDependencyPackageRootCachesForTests();
      __resetSourcePackageResolutionCachesForTests();
    });

    after(() => {
      // Clean up
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("should resolve local imports with .ts extension", () => {
      const result = resolveImport(
        "./models/User.ts",
        path.join(tempDir, "src", "index.ts"),
        sourceRoot
      );

      expect(result.ok).to.equal(true);
      if (result.ok) {
        expect(result.value.isLocal).to.equal(true);
        expect(result.value.isClr).to.equal(false);
        expect(result.value.resolvedPath).to.equal(
          path.join(tempDir, "src", "models", "User.ts")
        );
      }
    });

    it("should reject local imports that only match the source root by string prefix", () => {
      fs.mkdirSync(path.join(tempDir, "src-private"), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, "src-private", "Secret.ts"),
        "export const secret = 1;\n"
      );

      const result = resolveImport(
        "../src-private/Secret.ts",
        path.join(tempDir, "src", "index.ts"),
        path.join(tempDir, "src")
      );

      expect(result.ok).to.equal(false);
      if (!result.ok) {
        expect(result.error.code).to.equal("TSN1004");
        expect(result.error.message).to.include(
          "Import outside allowed module root"
        );
      }
    });

    it("should error on local imports without .js or .ts extension", () => {
      const result = resolveImport(
        "./models/User",
        path.join(tempDir, "src", "index.ts"),
        sourceRoot
      );

      expect(result.ok).to.equal(false);
      if (!result.ok) {
        expect(result.error.code).to.equal("TSN1001");
        expect(result.error.message).to.include(
          "must have .js or .ts extension"
        );
      }
    });

    it("should not detect bare imports as .NET without resolver with bindings", () => {
      // Import-driven resolution: bare imports like "System.IO" are only detected as .NET
      // if a resolver is provided and the import resolves to a package with bindings.json.
      // Without a resolver or package, bare imports are treated as unsupported node_modules.
      const result = resolveImport(
        "System.IO",
        path.join(tempDir, "src", "index.ts"),
        sourceRoot
        // No dotnetResolver passed
      );

      expect(result.ok).to.equal(false);
      if (!result.ok) {
        expect(result.error.code).to.equal("TSN1004");
        expect(result.error.message).to.include("Unsupported module import");
      }
    });

    it("should reject node_modules imports", () => {
      const result = resolveImport(
        "express",
        path.join(tempDir, "src", "index.ts"),
        sourceRoot
      );

      expect(result.ok).to.equal(false);
      if (!result.ok) {
        expect(result.error.code).to.equal("TSN1004");
        expect(result.error.message).to.include("Unsupported module import");
      }
    });

    it("should resolve installed tsonic source packages", () => {
      const fixture = materializeResolveImportFixture(
        "installed-source-package"
      );

      try {
        const projectRoot = fixture.path("app");
        const packageRoot = fixture.path("app/node_modules/@acme/math");
        const containingFile = fixture.path("app/src/index.ts");

        const result = resolveImport(
          "@acme/math",
          containingFile,
          projectRoot,
          {
            projectRoot,
            surface: "@tsonic/js",
          }
        );

        expect(result.ok).to.equal(true);
        if (result.ok) {
          expect(result.value.isLocal).to.equal(true);
          expect(result.value.isSourcePackage).to.equal(true);
          expect(result.value.resolvedPath).to.equal(
            path.join(packageRoot, "src", "index.ts")
          );
        }
      } finally {
        fixture.cleanup();
      }
    });

    it("should resolve installed source-package subpath exports", () => {
      const fixture = materializeResolveImportFixture(
        "installed-source-package"
      );

      try {
        const projectRoot = fixture.path("app");
        const packageRoot = fixture.path("app/node_modules/@acme/math");
        const containingFile = fixture.path("app/src/index.ts");

        const result = resolveImport(
          "@acme/math/helpers.js",
          containingFile,
          projectRoot,
          { projectRoot, surface: "@tsonic/js" }
        );

        expect(result.ok).to.equal(true);
        if (result.ok) {
          expect(result.value.isLocal).to.equal(true);
          expect(result.value.isSourcePackage).to.equal(true);
          expect(result.value.resolvedPath).to.equal(
            path.join(packageRoot, "src", "helpers.ts")
          );
        }
      } finally {
        fixture.cleanup();
      }
    });

    it("should resolve installed declaration package module imports", () => {
      const fixture = materializeResolveImportFixture(
        "installed-declaration-package"
      );

      try {
        const projectRoot = fixture.path("app");
        const packageRoot = fixture.path("app/node_modules/@tsonic/dotnet");
        const containingFile = fixture.path("app/src/index.ts");

        const result = resolveImport(
          "@tsonic/dotnet/System.js",
          containingFile,
          projectRoot,
          { projectRoot, surface: "@tsonic/js" }
        );

        expect(result.ok).to.equal(true);
        if (result.ok) {
          expect(result.value.isLocal).to.equal(true);
          expect(result.value.isClr).to.equal(false);
          expect(result.value.isSourcePackage).to.equal(undefined);
          expect(result.value.resolvedPath).to.equal(
            path.join(packageRoot, "System.d.ts")
          );
        }
      } finally {
        fixture.cleanup();
      }
    });

    it("should prefer direct source-package imports over CLR resolution", () => {
      const fixture = materializeResolveImportFixture(
        "source-package-over-clr"
      );

      try {
        const projectRoot = fixture.path("app");
        const processEntry = fixture.path(
          "app/node_modules/@tsonic/nodejs/src/process-module.ts"
        );
        const containingFile = fixture.path("app/src/index.ts");

        const result = resolveImport(
          "@tsonic/nodejs/process.js",
          containingFile,
          projectRoot,
          {
            projectRoot,
            surface: "@tsonic/js",
            clrResolver: {
              resolve: (specifier: string) =>
                specifier === "@tsonic/nodejs/process.js"
                  ? {
                      isClr: true as const,
                      resolvedNamespace: "process",
                    }
                  : { isClr: false as const },
            } as never,
          }
        );

        expect(result.ok).to.equal(true);
        if (result.ok) {
          expect(result.value.isLocal).to.equal(true);
          expect(result.value.isSourcePackage).to.equal(true);
          expect(result.value.isClr).to.equal(false);
          expect(result.value.resolvedPath).to.equal(processEntry);
        }
      } finally {
        fixture.cleanup();
      }
    });

    it("should resolve declaration-module aliases into source-package files", () => {
      const fixture = materializeResolveImportFixture(
        "declaration-alias-source-package"
      );

      try {
        const projectRoot = fixture.path("app");
        const packageRoot = fixture.path("app/node_modules/@tsonic/nodejs");
        const netEntry = fixture.path(
          "app/node_modules/@tsonic/nodejs/src/net/index.ts"
        );
        const containingFile = fixture.path("app/src/index.ts");

        const result = resolveImport("node:net", containingFile, projectRoot, {
          projectRoot,
          surface: "@tsonic/js",
          declarationModuleAliases: new Map([
            [
              "node:net",
              {
                targetSpecifier: "./net.js",
                declarationFile: path.join(packageRoot, "node-aliases.d.ts"),
              },
            ],
          ]),
        });

        expect(result.ok).to.equal(true);
        if (result.ok) {
          expect(result.value.isLocal).to.equal(true);
          expect(result.value.isSourcePackage).to.equal(true);
          expect(result.value.isClr).to.equal(false);
          expect(result.value.resolvedPath).to.equal(netEntry);
        }
      } finally {
        fixture.cleanup();
      }
    });

    it("should reject source-package local imports that only match the package root by string prefix", () => {
      const fixture = materializeResolveImportFixture(
        "installed-source-package"
      );

      try {
        const packageEntry = fixture.path(
          "app/node_modules/@acme/math/src/index.ts"
        );

        const result = resolveImport(
          "../../math-private/src/secret.ts",
          packageEntry,
          fixture.path("app/src")
        );

        expect(result.ok).to.equal(false);
        if (!result.ok) {
          expect(result.error.code).to.equal("TSN1004");
          expect(result.error.message).to.include(
            "Import outside allowed module root"
          );
        }
      } finally {
        fixture.cleanup();
      }
    });

    it("should reject source packages on incompatible surfaces", () => {
      const fixture = materializeResolveImportFixture("incompatible-surface");

      try {
        const projectRoot = fixture.path("app");
        const containingFile = fixture.path("app/src/index.ts");

        const result = resolveImport(
          "@acme/math",
          containingFile,
          projectRoot,
          {
            projectRoot,
            surface: "@tsonic/js",
          }
        );

        expect(result.ok).to.equal(false);
        if (!result.ok) {
          expect(result.error.message).to.include(
            "not compatible with surface"
          );
        }
      } finally {
        fixture.cleanup();
      }
    });

    it("should allow source packages on compatible parent surfaces", () => {
      const fixture = materializeResolveImportFixture(
        "compatible-parent-surface"
      );

      try {
        const projectRoot = fixture.path("app");
        const containingFile = fixture.path("app/src/index.ts");

        const result = resolveImport(
          "@acme/math",
          containingFile,
          projectRoot,
          {
            projectRoot,
            surface: "@acme/surface-node",
          }
        );

        expect(result.ok).to.equal(true);
      } finally {
        fixture.cleanup();
      }
    });

    it("should resolve authoritative @tsonic roots for source-package files outside the project graph", () => {
      const fixture = materializeResolveImportFixture(
        "authoritative-root-external-wave"
      );

      try {
        const projectRoot = fixture.path("workspace");
        const jsRoot = fixture.path("workspace/wave/js-next");
        const containingFile = fixture.path(
          "workspace/wave/nodejs-next/src/events-module.ts"
        );

        const result = resolveImport(
          "@tsonic/js/index.js",
          containingFile,
          projectRoot,
          {
            projectRoot,
            surface: "@tsonic/js",
            authoritativeTsonicPackageRoots: new Map([["@tsonic/js", jsRoot]]),
          }
        );

        expect(result.ok).to.equal(true);
        if (result.ok) {
          expect(result.value.isSourcePackage).to.equal(true);
          expect(result.value.resolvedPath).to.equal(
            path.join(jsRoot, "src", "index.ts")
          );
        }
      } finally {
        fixture.cleanup();
      }
    });

    it("should resolve sibling source-package dependencies from imported wave files", () => {
      const fixture = materializeResolveImportFixture(
        "sibling-wave-dependency"
      );

      try {
        const projectRoot = fixture.path("workspace");
        const jsRoot = fixture.path("workspace/wave/js-next");
        const containingFile = fixture.path(
          "workspace/wave/nodejs-next/src/events-module.ts"
        );

        const result = resolveImport(
          "@tsonic/js/index.js",
          containingFile,
          projectRoot,
          {
            projectRoot,
            surface: "@tsonic/js",
          }
        );

        expect(result.ok).to.equal(true);
        if (result.ok) {
          expect(result.value.isSourcePackage).to.equal(true);
          expect(result.value.resolvedPath).to.equal(
            path.join(jsRoot, "src", "index.ts")
          );
        }
      } finally {
        fixture.cleanup();
      }
    });

    it("should prefer sibling source-package dependencies over installed CLR shadows", () => {
      const fixture = materializeResolveImportFixture(
        "sibling-wave-over-shadow"
      );

      try {
        const projectRoot = fixture.path("workspace");
        const jsSourceRoot = fixture.path("workspace/wave/js-next/versions/10");
        const containingFile = fixture.path(
          "workspace/wave/nodejs-next/versions/10/src/events-module.ts"
        );

        const result = resolveImport(
          "@tsonic/js/index.js",
          containingFile,
          projectRoot,
          {
            projectRoot,
            surface: "@tsonic/js",
          }
        );

        expect(result.ok).to.equal(true);
        if (result.ok) {
          expect(result.value.isSourcePackage).to.equal(true);
          expect(result.value.resolvedPath).to.equal(
            path.join(jsSourceRoot, "src", "index.ts")
          );
        }
      } finally {
        fixture.cleanup();
      }
    });

    it("should error on non-existent local files", () => {
      const result = resolveImport(
        "./nonexistent.ts",
        path.join(tempDir, "src", "index.ts"),
        sourceRoot
      );

      expect(result.ok).to.equal(false);
      if (!result.ok) {
        expect(result.error.code).to.equal("TSN1004");
        expect(result.error.message).to.include("Cannot find module");
      }
    });

    it("should resolve node: aliases when matching module bindings exist", () => {
      const bindings = createNodeBindings("nodejs.fs");

      const result = resolveImport(
        "node:fs",
        path.join(tempDir, "src", "index.ts"),
        sourceRoot,
        { bindings }
      );

      expect(result.ok).to.equal(true);
      if (result.ok) {
        expect(result.value.isLocal).to.equal(false);
        expect(result.value.isClr).to.equal(false);
        expect(result.value.resolvedClrType).to.equal("nodejs.fs");
      }
    });

    it("should resolve extended node aliases when module bindings exist", () => {
      const bindings = createNodeBindings("nodejs.url");

      const result = resolveImport(
        "node:url",
        path.join(tempDir, "src", "index.ts"),
        sourceRoot,
        { bindings }
      );

      expect(result.ok).to.equal(true);
      if (result.ok) {
        expect(result.value.resolvedClrType).to.equal("nodejs.url");
      }
    });

    it("should resolve bare node module aliases when module bindings exist", () => {
      const bindings = createNodeBindings("nodejs.path");

      const result = resolveImport(
        "path",
        path.join(tempDir, "src", "index.ts"),
        sourceRoot,
        { bindings }
      );

      expect(result.ok).to.equal(true);
      if (result.ok) {
        expect(result.value.resolvedClrType).to.equal("nodejs.path");
      }
    });

    it("should resolve the node alias set exercised by fast js/node surface fixtures", () => {
      const cases = [
        ["node:assert", "nodejs.assert"],
        ["node:buffer", "nodejs.buffer"],
        ["node:child_process", "nodejs.child_process"],
        ["node:crypto", "nodejs.crypto"],
        ["node:dgram", "nodejs.dgram"],
        ["node:dns", "nodejs.dns"],
        ["node:events", "nodejs.events"],
        ["node:fs", "nodejs.fs"],
        ["node:http", "nodejs.http"],
        ["node:net", "nodejs.net"],
        ["node:os", "nodejs.os"],
        ["node:path", "nodejs.path"],
        ["node:process", "nodejs.process"],
        ["node:querystring", "nodejs.querystring"],
        ["node:readline", "nodejs.readline"],
        ["node:stream", "nodejs.stream"],
        ["node:timers", "nodejs.timers"],
        ["node:tls", "nodejs.tls"],
        ["node:url", "nodejs.url"],
        ["node:util", "nodejs.util"],
        ["node:zlib", "nodejs.zlib"],
        ["fs", "nodejs.fs"],
        ["path", "nodejs.path"],
        ["process", "nodejs.process"],
      ] as const;
      const bindings = createNodeBindings(
        cases[0][1],
        cases.slice(1).map(([, resolvedClrType]) => resolvedClrType)
      );

      for (const [specifier, resolvedClrType] of cases) {
        const result = resolveImport(
          specifier,
          path.join(tempDir, "src", "index.ts"),
          sourceRoot,
          { bindings }
        );

        expect(result.ok, specifier).to.equal(true);
        if (!result.ok) continue;

        expect(result.value.isLocal, specifier).to.equal(false);
        expect(result.value.isClr, specifier).to.equal(false);
        expect(result.value.resolvedAssembly, specifier).to.equal("nodejs");
        expect(result.value.resolvedClrType, specifier).to.equal(
          resolvedClrType
        );
      }
    });

    it("should resolve module imports even when a global binding shares the same alias", () => {
      const bindings = new BindingRegistry();
      bindings.addBindings("/test/js.json", {
        bindings: {
          console: {
            kind: "global",
            assembly: "js",
            type: "js.console",
          },
        },
      });
      bindings.addBindings("/test/nodejs.json", {
        bindings: {
          console: {
            kind: "module",
            assembly: "nodejs",
            type: "nodejs.console",
          },
        },
      });

      const result = resolveImport(
        "console",
        path.join(tempDir, "src", "index.ts"),
        sourceRoot,
        { bindings }
      );

      expect(result.ok).to.equal(true);
      if (result.ok) {
        expect(result.value.resolvedClrType).to.equal("nodejs.console");
        expect(result.value.resolvedAssembly).to.equal("nodejs");
      }
    });

    it("should reject node aliases when module bindings are missing", () => {
      const result = resolveImport(
        "node:fs",
        path.join(tempDir, "src", "index.ts"),
        sourceRoot,
        {
          bindings: new BindingRegistry(),
        }
      );

      expect(result.ok).to.equal(false);
      if (!result.ok) {
        expect(result.error.code).to.equal("TSN1004");
      }
    });
  });
});
