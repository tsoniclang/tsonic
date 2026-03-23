/**
 * Tests for module resolver -- resolveImport
 */

import { describe, it, before, after } from "mocha";
import { expect } from "chai";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { resolveImport } from "../resolver.js";
import { BindingRegistry } from "../program/bindings.js";

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
      const packageRoot = path.join(tempDir, "node_modules", "@acme", "math");
      fs.mkdirSync(path.join(packageRoot, "tsonic"), { recursive: true });
      fs.mkdirSync(path.join(packageRoot, "src"), { recursive: true });
      fs.writeFileSync(
        path.join(packageRoot, "package.json"),
        JSON.stringify(
          { name: "@acme/math", version: "1.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(packageRoot, "tsonic", "package-manifest.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                ".": "./src/index.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(packageRoot, "src", "index.ts"),
        "export const clamp = (x: number): number => x;\n"
      );

      const result = resolveImport(
        "@acme/math",
        path.join(tempDir, "src", "index.ts"),
        sourceRoot,
        { projectRoot: tempDir, surface: "@tsonic/js" }
      );

      expect(result.ok).to.equal(true);
      if (result.ok) {
        expect(result.value.isLocal).to.equal(true);
        expect(result.value.isSourcePackage).to.equal(true);
        expect(result.value.resolvedPath).to.equal(
          path.join(packageRoot, "src", "index.ts")
        );
      }
    });

    it("should prefer direct source-package imports over CLR resolution", () => {
      const packageRoot = path.join(
        tempDir,
        "node_modules",
        "@tsonic",
        "nodejs"
      );
      fs.mkdirSync(path.join(packageRoot, "tsonic"), { recursive: true });
      fs.mkdirSync(path.join(packageRoot, "src"), { recursive: true });
      fs.writeFileSync(
        path.join(packageRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/nodejs", version: "1.0.0", type: "module" },
          null,
          2
        )
      );
      const processEntry = path.join(packageRoot, "src", "process-module.ts");
      fs.writeFileSync(
        path.join(packageRoot, "tsonic", "package-manifest.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                "./process.js": "./src/process-module.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        processEntry,
        "export const process = { version: 'v1.0.0-tsonic' };\n"
      );

      const result = resolveImport(
        "@tsonic/nodejs/process.js",
        path.join(tempDir, "src", "index.ts"),
        sourceRoot,
        {
          projectRoot: tempDir,
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
    });

    it("should prefer source-package redirects over CLR module bindings", () => {
      const packageRoot = path.join(
        tempDir,
        "node_modules",
        "@tsonic",
        "nodejs"
      );
      fs.mkdirSync(path.join(packageRoot, "tsonic"), { recursive: true });
      fs.mkdirSync(path.join(packageRoot, "src", "net"), { recursive: true });
      fs.writeFileSync(
        path.join(packageRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/nodejs", version: "1.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(packageRoot, "tsonic", "package-manifest.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                "./net.js": "./src/net/index.ts",
              },
            },
          },
          null,
          2
        )
      );
      const netEntry = path.join(packageRoot, "src", "net", "index.ts");
      fs.writeFileSync(netEntry, "export const createServer = () => ({});\n");

      const bindings = new BindingRegistry();
      bindings.addBindings("/test/nodejs-bindings.json", {
        bindings: {
          "node:net": {
            kind: "module",
            assembly: "nodejs",
            type: "nodejs.net",
            sourceImport: "@tsonic/nodejs/net.js",
          },
          net: {
            kind: "module",
            assembly: "nodejs",
            type: "nodejs.net",
            sourceImport: "@tsonic/nodejs/net.js",
          },
        },
      });

      const result = resolveImport(
        "node:net",
        path.join(tempDir, "src", "index.ts"),
        sourceRoot,
        { bindings, projectRoot: tempDir, surface: "@tsonic/js" }
      );

      expect(result.ok).to.equal(true);
      if (result.ok) {
        expect(result.value.isLocal).to.equal(true);
        expect(result.value.isSourcePackage).to.equal(true);
        expect(result.value.isClr).to.equal(false);
        expect(result.value.resolvedPath).to.equal(netEntry);
      }
    });

    it("should reject source-package local imports that only match the package root by string prefix", () => {
      const packageRoot = path.join(tempDir, "node_modules", "@acme", "math");
      const packageEntry = path.join(packageRoot, "src", "index.ts");
      const siblingRoot = path.join(
        tempDir,
        "node_modules",
        "@acme",
        "math-private"
      );
      fs.mkdirSync(path.join(packageRoot, "tsonic"), { recursive: true });
      fs.mkdirSync(path.join(packageRoot, "src"), { recursive: true });
      fs.mkdirSync(path.join(siblingRoot, "src"), { recursive: true });
      fs.writeFileSync(
        path.join(packageRoot, "package.json"),
        JSON.stringify(
          { name: "@acme/math", version: "1.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(packageRoot, "tsonic", "package-manifest.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                ".": "./src/index.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(packageEntry, "export const clamp = 1;\n");
      fs.writeFileSync(
        path.join(siblingRoot, "src", "secret.ts"),
        "export const secret = 1;\n"
      );

      const result = resolveImport(
        "../../math-private/src/secret.ts",
        packageEntry,
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

    it("should reject source packages on incompatible surfaces", () => {
      const packageRoot = path.join(tempDir, "node_modules", "@acme", "math");
      fs.mkdirSync(path.join(packageRoot, "tsonic"), { recursive: true });
      fs.mkdirSync(path.join(packageRoot, "src"), { recursive: true });
      fs.writeFileSync(
        path.join(packageRoot, "package.json"),
        JSON.stringify(
          { name: "@acme/math", version: "1.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(packageRoot, "tsonic", "package-manifest.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["clr"],
            source: {
              exports: {
                ".": "./src/index.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(packageRoot, "src", "index.ts"),
        "export const clamp = (x: number): number => x;\n"
      );

      const result = resolveImport(
        "@acme/math",
        path.join(tempDir, "src", "index.ts"),
        sourceRoot,
        { projectRoot: tempDir, surface: "@tsonic/js" }
      );

      expect(result.ok).to.equal(false);
      if (!result.ok) {
        expect(result.error.message).to.include("not compatible with surface");
      }
    });

    it("should allow source packages on compatible parent surfaces", () => {
      const jsSurfaceRoot = path.join(tempDir, "node_modules", "@tsonic", "js");
      fs.mkdirSync(jsSurfaceRoot, { recursive: true });
      fs.writeFileSync(
        path.join(jsSurfaceRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/js", version: "1.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(jsSurfaceRoot, "tsonic.surface.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            id: "@tsonic/js",
            extends: [],
            requiredTypeRoots: ["."],
          },
          null,
          2
        )
      );

      const customSurfaceRoot = path.join(
        tempDir,
        "node_modules",
        "@acme",
        "surface-node"
      );
      fs.mkdirSync(customSurfaceRoot, { recursive: true });
      fs.writeFileSync(
        path.join(customSurfaceRoot, "package.json"),
        JSON.stringify(
          { name: "@acme/surface-node", version: "1.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(customSurfaceRoot, "tsonic.surface.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            id: "@acme/surface-node",
            extends: ["@tsonic/js"],
            requiredTypeRoots: ["."],
          },
          null,
          2
        )
      );

      const packageRoot = path.join(tempDir, "node_modules", "@acme", "math");
      fs.mkdirSync(path.join(packageRoot, "tsonic"), { recursive: true });
      fs.mkdirSync(path.join(packageRoot, "src"), { recursive: true });
      fs.writeFileSync(
        path.join(packageRoot, "package.json"),
        JSON.stringify(
          { name: "@acme/math", version: "1.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(packageRoot, "tsonic", "package-manifest.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                ".": "./src/index.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(packageRoot, "src", "index.ts"),
        "export const clamp = (x: number): number => x;\n"
      );

      const result = resolveImport(
        "@acme/math",
        path.join(tempDir, "src", "index.ts"),
        sourceRoot,
        { projectRoot: tempDir, surface: "@acme/surface-node" }
      );

      expect(result.ok).to.equal(true);
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
