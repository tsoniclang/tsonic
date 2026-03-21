/**
 * Tests for loadBindings() — filesystem-based manifest loading:
 * typeRoot scanning, .d.ts sibling manifests, multiple typeRoots,
 * malformed JSON handling, transitive dependency traversal.
 */

import { describe, it, beforeEach, afterEach } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { loadBindings } from "../bindings.js";

describe("Binding System", () => {
  describe("loadBindings", () => {
    let tempDir: string;

    beforeEach(() => {
      // Create a temporary directory for test files
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tsonic-bindings-test-"));
    });

    afterEach(() => {
      // Clean up temporary directory
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("should load bindings from a manifest file in typeRoot", () => {
      // Create a test binding manifest
      const manifestPath = path.join(tempDir, "bindings.json");
      const manifest = {
        bindings: {
          console: {
            kind: "global",
            assembly: "Tsonic.Runtime",
            type: "Tsonic.Runtime.console",
          },
        },
      };
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

      const registry = loadBindings([tempDir]);

      const binding = registry.getBinding("console");
      expect(binding).to.deep.equal({
        kind: "global",
        assembly: "Tsonic.Runtime",
        type: "Tsonic.Runtime.console",
      });
    });

    it("should load root-level global function bindings with csharpName", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify(
          {
            name: "@fixture/js",
            version: "1.0.0",
            type: "module",
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(tempDir, "tsonic.surface.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            id: "@fixture/js",
            extends: [],
            requiredTypeRoots: ["."],
            useStandardLib: false,
          },
          null,
          2
        )
      );
      fs.writeFileSync(path.join(tempDir, "index.d.ts"), "export {};\n");
      fs.writeFileSync(
        path.join(tempDir, "bindings.json"),
        JSON.stringify(
          {
            bindings: {
              setInterval: {
                kind: "global",
                assembly: "Tsonic.JSRuntime",
                type: "Tsonic.JSRuntime.Timers",
                csharpName: "Timers.setInterval",
              },
              clearInterval: {
                kind: "global",
                assembly: "Tsonic.JSRuntime",
                type: "Tsonic.JSRuntime.Timers",
                csharpName: "Timers.clearInterval",
              },
            },
          },
          null,
          2
        )
      );

      const registry = loadBindings([tempDir]);

      expect(registry.getBinding("setInterval")).to.deep.equal({
        kind: "global",
        assembly: "Tsonic.JSRuntime",
        type: "Tsonic.JSRuntime.Timers",
        csharpName: "Timers.setInterval",
      });
      expect(registry.getBinding("clearInterval")).to.deep.equal({
        kind: "global",
        assembly: "Tsonic.JSRuntime",
        type: "Tsonic.JSRuntime.Timers",
        csharpName: "Timers.clearInterval",
      });
    });

    it("should load bindings from manifest next to .d.ts file", () => {
      // Create a facade + namespace directory structure
      // `Runtime.d.ts` at root, with `Runtime/bindings.json` next to it.
      fs.writeFileSync(path.join(tempDir, "Runtime.d.ts"), "");

      const namespaceDir = path.join(tempDir, "Runtime");
      fs.mkdirSync(namespaceDir, { recursive: true });
      const manifest = {
        bindings: {
          Math: {
            kind: "global",
            assembly: "Tsonic.Runtime",
            type: "Tsonic.Runtime.Math",
          },
        },
      };
      fs.writeFileSync(
        path.join(namespaceDir, "bindings.json"),
        JSON.stringify(manifest, null, 2)
      );

      const registry = loadBindings([tempDir]);

      const binding = registry.getBinding("Math");
      expect(binding).to.deep.equal({
        kind: "global",
        assembly: "Tsonic.Runtime",
        type: "Tsonic.Runtime.Math",
      });
    });

    it("should handle non-existent typeRoots gracefully", () => {
      const registry = loadBindings(["/nonexistent/path"]);
      expect(registry.getAllBindings()).to.have.lengthOf(0);
    });

    it("should load from multiple typeRoots", () => {
      // Create two separate directories
      const dir1 = path.join(tempDir, "dir1");
      const dir2 = path.join(tempDir, "dir2");
      fs.mkdirSync(dir1);
      fs.mkdirSync(dir2);

      // Create manifest in first directory
      const manifest1 = {
        bindings: {
          console: {
            kind: "global",
            assembly: "Tsonic.Runtime",
            type: "Tsonic.Runtime.console",
          },
        },
      };
      fs.writeFileSync(
        path.join(dir1, "bindings.json"),
        JSON.stringify(manifest1, null, 2)
      );

      // Create manifest in second directory
      const manifest2 = {
        bindings: {
          fs: {
            kind: "module",
            assembly: "Tsonic.NodeApi",
            type: "Tsonic.NodeApi.fs",
          },
        },
      };
      fs.writeFileSync(
        path.join(dir2, "bindings.json"),
        JSON.stringify(manifest2, null, 2)
      );

      const registry = loadBindings([dir1, dir2]);

      expect(registry.getAllBindings()).to.have.lengthOf(2);
      expect(registry.getBinding("console")).not.to.equal(undefined);
      expect(registry.getBinding("fs")).not.to.equal(undefined);
    });

    it("should handle malformed JSON gracefully", () => {
      const manifestPath = path.join(tempDir, "bindings.json");
      fs.writeFileSync(manifestPath, "{ invalid json }");

      // Should not throw, just skip the bad file
      const registry = loadBindings([tempDir]);
      expect(registry.getAllBindings()).to.have.lengthOf(0);
    });

    it("should distinguish between global and module bindings", () => {
      const manifest = {
        bindings: {
          console: {
            kind: "global",
            assembly: "Tsonic.Runtime",
            type: "Tsonic.Runtime.console",
          },
          fs: {
            kind: "module",
            assembly: "Tsonic.NodeApi",
            type: "Tsonic.NodeApi.fs",
          },
        },
      };
      fs.writeFileSync(
        path.join(tempDir, "bindings.json"),
        JSON.stringify(manifest, null, 2)
      );

      const registry = loadBindings([tempDir]);

      const consoleBinding = registry.getBinding("console");
      expect(consoleBinding?.kind).to.equal("global");

      const fsBinding = registry.getBinding("fs");
      expect(fsBinding?.kind).to.equal("module");
    });

    it("should load transitive bindings from non-@tsonic dependencies", () => {
      const workspaceRoot = path.join(tempDir, "workspace");
      const surfaceRoot = path.join(
        workspaceRoot,
        "node_modules",
        "@acme",
        "surface-web"
      );
      const runtimeRoot = path.join(
        workspaceRoot,
        "node_modules",
        "@acme",
        "runtime"
      );

      fs.mkdirSync(surfaceRoot, { recursive: true });
      fs.mkdirSync(runtimeRoot, { recursive: true });

      fs.writeFileSync(
        path.join(surfaceRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/surface-web",
            version: "1.0.0",
            dependencies: {
              "@acme/runtime": "1.0.0",
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(surfaceRoot, "tsonic.surface.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            id: "web",
            extends: ["clr"],
          },
          null,
          2
        )
      );

      fs.writeFileSync(
        path.join(runtimeRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/runtime",
            version: "1.0.0",
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(runtimeRoot, "bindings.json"),
        JSON.stringify(
          {
            bindings: {
              runtimeLog: {
                kind: "global",
                assembly: "Acme.Runtime",
                type: "Acme.Runtime.Log",
              },
            },
          },
          null,
          2
        )
      );

      const registry = loadBindings([surfaceRoot]);
      const binding = registry.getBinding("runtimeLog");
      expect(binding).to.deep.equal({
        kind: "global",
        assembly: "Acme.Runtime",
        type: "Acme.Runtime.Log",
      });
    });

    it("should traverse top-level dependency graph even when the root package has no bindings", () => {
      const workspaceRoot = path.join(tempDir, "workspace-no-bindings-root");
      const rootPkg = path.join(workspaceRoot, "node_modules", "@acme", "root");
      const depPkg = path.join(workspaceRoot, "node_modules", "@acme", "dep");

      fs.mkdirSync(rootPkg, { recursive: true });
      fs.mkdirSync(depPkg, { recursive: true });

      fs.writeFileSync(
        path.join(rootPkg, "package.json"),
        JSON.stringify(
          {
            name: "@acme/root",
            version: "1.0.0",
            dependencies: {
              "@acme/dep": "1.0.0",
            },
          },
          null,
          2
        )
      );

      fs.writeFileSync(
        path.join(depPkg, "package.json"),
        JSON.stringify(
          {
            name: "@acme/dep",
            version: "1.0.0",
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(depPkg, "bindings.json"),
        JSON.stringify(
          {
            bindings: {
              depGlobal: {
                kind: "global",
                assembly: "Acme.Dep",
                type: "Acme.Dep.Global",
              },
            },
          },
          null,
          2
        )
      );

      const registry = loadBindings([rootPkg]);
      const binding = registry.getBinding("depGlobal");
      expect(binding).to.deep.equal({
        kind: "global",
        assembly: "Acme.Dep",
        type: "Acme.Dep.Global",
      });
    });

    it("should load transitive bindings from sibling workspace versioned packages", () => {
      const workspaceRoot = path.join(tempDir, "tsoniclang");
      const globalsRoot = path.join(workspaceRoot, "globals", "versions", "10");
      const dotnetRoot = path.join(workspaceRoot, "dotnet", "versions", "10");

      fs.mkdirSync(globalsRoot, { recursive: true });
      fs.mkdirSync(dotnetRoot, { recursive: true });

      fs.writeFileSync(
        path.join(globalsRoot, "package.json"),
        JSON.stringify(
          {
            name: "@tsonic/globals",
            version: "1.0.0",
            dependencies: {
              "@tsonic/dotnet": "1.0.0",
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(globalsRoot, "tsonic.surface.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            id: "clr",
            extends: [],
            requiredTypeRoots: ["."],
          },
          null,
          2
        )
      );

      fs.writeFileSync(
        path.join(dotnetRoot, "package.json"),
        JSON.stringify(
          {
            name: "@tsonic/dotnet",
            version: "1.0.0",
          },
          null,
          2
        )
      );
      fs.writeFileSync(path.join(dotnetRoot, "System.d.ts"), "export {};\n");
      fs.mkdirSync(path.join(dotnetRoot, "System"), { recursive: true });
      fs.writeFileSync(
        path.join(dotnetRoot, "System", "bindings.json"),
        JSON.stringify(
          {
            bindings: {
              SerializableAttribute: {
                kind: "global",
                assembly: "System.Runtime",
                type: "System.SerializableAttribute",
              },
            },
          },
          null,
          2
        )
      );

      const registry = loadBindings([globalsRoot]);
      const binding = registry.getBinding("SerializableAttribute");
      expect(binding).to.deep.equal({
        kind: "global",
        assembly: "System.Runtime",
        type: "System.SerializableAttribute",
      });
    });
  });
});
