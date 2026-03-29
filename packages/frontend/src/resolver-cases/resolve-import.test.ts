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
        path.join(packageRoot, "tsonic.package.json"),
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

    it("should resolve installed source-package subpath exports", () => {
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
        path.join(packageRoot, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                ".": "./src/index.ts",
                "./helpers.js": "./src/helpers.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(packageRoot, "src", "index.ts"),
        'export { clampMin } from "./helpers.ts";\n'
      );
      fs.writeFileSync(
        path.join(packageRoot, "src", "helpers.ts"),
        "export const clampMin = (x: number, min: number): number => x < min ? min : x;\n"
      );

      const result = resolveImport(
        "@acme/math/helpers.js",
        path.join(tempDir, "src", "index.ts"),
        sourceRoot,
        { projectRoot: tempDir, surface: "@tsonic/js" }
      );

      expect(result.ok).to.equal(true);
      if (result.ok) {
        expect(result.value.isLocal).to.equal(true);
        expect(result.value.isSourcePackage).to.equal(true);
        expect(result.value.resolvedPath).to.equal(
          path.join(packageRoot, "src", "helpers.ts")
        );
      }
    });

    it("should resolve installed declaration package module imports", () => {
      const packageRoot = path.join(
        tempDir,
        "node_modules",
        "@tsonic",
        "dotnet"
      );
      fs.mkdirSync(packageRoot, { recursive: true });
      fs.writeFileSync(
        path.join(packageRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/dotnet", version: "1.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(packageRoot, "System.js"),
        "throw new Error('stub');\n"
      );
      fs.writeFileSync(
        path.join(packageRoot, "System.d.ts"),
        "export declare class StringBuilder {}\n"
      );

      const result = resolveImport(
        "@tsonic/dotnet/System.js",
        path.join(tempDir, "src", "index.ts"),
        sourceRoot,
        { projectRoot: tempDir, surface: "@tsonic/js" }
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
        path.join(packageRoot, "tsonic.package.json"),
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

    it("should resolve declaration-module aliases into source-package files", () => {
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
        path.join(packageRoot, "tsonic.package.json"),
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

      const result = resolveImport(
        "node:net",
        path.join(tempDir, "src", "index.ts"),
        sourceRoot,
        {
          projectRoot: tempDir,
          surface: "@tsonic/js",
          declarationModuleAliases: new Map([
            [
              "node:net",
              {
                targetSpecifier: "@tsonic/nodejs/net.js",
                declarationFile: path.join(packageRoot, "node-aliases.d.ts"),
              },
            ],
          ]),
        }
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
        path.join(packageRoot, "tsonic.package.json"),
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
        path.join(packageRoot, "tsonic.package.json"),
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
        path.join(packageRoot, "tsonic.package.json"),
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

    it("should resolve authoritative @tsonic roots for source-package files outside the project graph", () => {
      const jsRoot = path.join(tempDir, "wave", "js-next");
      fs.mkdirSync(path.join(jsRoot, "src"), { recursive: true });
      fs.mkdirSync(path.join(jsRoot, "tsonic"), { recursive: true });
      fs.writeFileSync(
        path.join(jsRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/js", version: "1.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(jsRoot, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                ".": "./src/index.ts",
                "./index.js": "./src/index.ts",
                "./console.js": "./src/console.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(jsRoot, "src", "index.ts"),
        'export * as console from "./console.js";\n'
      );
      fs.writeFileSync(
        path.join(jsRoot, "src", "console.ts"),
        "export const error = (..._args: unknown[]): void => {};\n"
      );

      const containingFile = path.join(
        tempDir,
        "wave",
        "nodejs-next",
        "src",
        "events-module.ts"
      );
      fs.mkdirSync(path.dirname(containingFile), { recursive: true });
      fs.writeFileSync(
        containingFile,
        'import { console } from "@tsonic/js/index.js";\nconsole.error("x");\n'
      );

      const result = resolveImport(
        "@tsonic/js/index.js",
        containingFile,
        sourceRoot,
        {
          projectRoot: tempDir,
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
    });

    it("should resolve sibling source-package dependencies from imported wave files", () => {
      const jsRoot = path.join(tempDir, "wave", "js-next");
      fs.mkdirSync(path.join(jsRoot, "src"), { recursive: true });
      fs.mkdirSync(path.join(jsRoot, "tsonic"), { recursive: true });
      fs.writeFileSync(
        path.join(jsRoot, "package.json"),
        JSON.stringify(
          {
            name: "@tsonic/js",
            version: "1.0.0",
            type: "module",
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(jsRoot, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                ".": "./src/index.ts",
                "./index.js": "./src/index.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(jsRoot, "src", "index.ts"),
        "export const ok = true;\n"
      );

      const nodejsRoot = path.join(tempDir, "wave", "nodejs-next");
      fs.mkdirSync(path.join(nodejsRoot, "src"), { recursive: true });
      fs.mkdirSync(path.join(nodejsRoot, "tsonic"), { recursive: true });
      fs.writeFileSync(
        path.join(nodejsRoot, "package.json"),
        JSON.stringify(
          {
            name: "@tsonic/nodejs",
            version: "1.0.0",
            type: "module",
            peerDependencies: {
              "@tsonic/js": "1.0.0",
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(nodejsRoot, "tsonic.package.json"),
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

      const containingFile = path.join(nodejsRoot, "src", "events-module.ts");
      fs.writeFileSync(
        containingFile,
        'import { ok } from "@tsonic/js/index.js";\nvoid ok;\n'
      );

      const result = resolveImport(
        "@tsonic/js/index.js",
        containingFile,
        sourceRoot,
        {
          projectRoot: tempDir,
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
    });

    it("should prefer sibling source-package dependencies over installed CLR shadows", () => {
      const jsClrRoot = path.join(
        tempDir,
        "wave",
        "nodejs-next",
        "versions",
        "10",
        "node_modules",
        "@tsonic",
        "js"
      );
      const jsSourceRoot = path.join(
        tempDir,
        "wave",
        "js-next",
        "versions",
        "10"
      );
      const nodejsRoot = path.join(
        tempDir,
        "wave",
        "nodejs-next",
        "versions",
        "10"
      );

      fs.mkdirSync(path.join(jsClrRoot, "index"), { recursive: true });
      fs.mkdirSync(path.join(jsSourceRoot, "src"), { recursive: true });
      fs.mkdirSync(path.join(jsSourceRoot, "tsonic"), { recursive: true });
      fs.mkdirSync(path.join(nodejsRoot, "src"), { recursive: true });
      fs.mkdirSync(path.join(nodejsRoot, "tsonic"), { recursive: true });

      fs.writeFileSync(
        path.join(jsClrRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/js", version: "10.0.48", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(jsClrRoot, "index.d.ts"),
        "export declare class Error {}\n"
      );
      fs.writeFileSync(
        path.join(jsSourceRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/js", version: "10.0.49-next.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(jsSourceRoot, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                ".": "./src/index.ts",
                "./index.js": "./src/index.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(jsSourceRoot, "src", "index.ts"),
        "export const ok = true;\n"
      );
      fs.writeFileSync(
        path.join(nodejsRoot, "package.json"),
        JSON.stringify(
          {
            name: "@tsonic/nodejs",
            version: "10.0.49-next.0",
            type: "module",
            peerDependencies: {
              "@tsonic/js": "10.0.49-next.0",
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(nodejsRoot, "tsonic.package.json"),
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

      const containingFile = path.join(nodejsRoot, "src", "events-module.ts");
      fs.writeFileSync(
        containingFile,
        'import { ok } from "@tsonic/js/index.js";\nvoid ok;\n'
      );

      const result = resolveImport(
        "@tsonic/js/index.js",
        containingFile,
        sourceRoot,
        {
          projectRoot: tempDir,
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
