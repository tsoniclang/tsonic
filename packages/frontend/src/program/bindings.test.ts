/**
 * Tests for binding manifest loading and registry
 */

import { describe, it, beforeEach, afterEach } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { BindingRegistry, loadBindings } from "./bindings.js";

describe("Binding System", () => {
  describe("BindingRegistry", () => {
    it("should add and retrieve bindings", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/manifest.json", {
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
      });

      const consoleBinding = registry.getBinding("console");
      expect(consoleBinding).to.deep.equal({
        kind: "global",
        assembly: "Tsonic.Runtime",
        type: "Tsonic.Runtime.console",
      });

      const fsBinding = registry.getBinding("fs");
      expect(fsBinding).to.deep.equal({
        kind: "module",
        assembly: "Tsonic.NodeApi",
        type: "Tsonic.NodeApi.fs",
      });
    });

    it("should return undefined for non-existent bindings", () => {
      const registry = new BindingRegistry();
      const binding = registry.getBinding("nonexistent");
      expect(binding).to.equal(undefined);
    });

    it("should return all bindings", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/manifest.json", {
        bindings: {
          console: {
            kind: "global",
            assembly: "Tsonic.Runtime",
            type: "Tsonic.Runtime.console",
          },
          Math: {
            kind: "global",
            assembly: "Tsonic.Runtime",
            type: "Tsonic.Runtime.Math",
          },
        },
      });

      const allBindings = registry.getAllBindings();
      expect(allBindings).to.have.lengthOf(2);
      expect(allBindings.map((b) => b[0]).sort()).to.deep.equal([
        "Math",
        "console",
      ]);
    });

    it("should clear all bindings", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/manifest.json", {
        bindings: {
          console: {
            kind: "global",
            assembly: "Tsonic.Runtime",
            type: "Tsonic.Runtime.console",
          },
        },
      });

      expect(registry.getAllBindings()).to.have.lengthOf(1);

      registry.clear();
      expect(registry.getAllBindings()).to.have.lengthOf(0);
      expect(registry.getBinding("console")).to.equal(undefined);
    });

    it("should handle multiple manifest files", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/runtime.json", {
        bindings: {
          console: {
            kind: "global",
            assembly: "Tsonic.Runtime",
            type: "Tsonic.Runtime.console",
          },
        },
      });

      registry.addBindings("/test/node.json", {
        bindings: {
          fs: {
            kind: "module",
            assembly: "Tsonic.NodeApi",
            type: "Tsonic.NodeApi.fs",
          },
        },
      });

      expect(registry.getAllBindings()).to.have.lengthOf(2);
      expect(registry.getBinding("console")).not.to.equal(undefined);
      expect(registry.getBinding("fs")).not.to.equal(undefined);
    });
  });

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
      const manifestPath = path.join(tempDir, "test.bindings.json");
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

    it("should load bindings from manifest next to .d.ts file", () => {
      // Create a subdirectory structure
      const subDir = path.join(tempDir, "types");
      fs.mkdirSync(subDir, { recursive: true });

      // Create .d.ts and .bindings.json files
      fs.writeFileSync(path.join(subDir, "runtime.d.ts"), "");
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
        path.join(subDir, "runtime.bindings.json"),
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
        path.join(dir1, "runtime.bindings.json"),
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
        path.join(dir2, "node.bindings.json"),
        JSON.stringify(manifest2, null, 2)
      );

      const registry = loadBindings([dir1, dir2]);

      expect(registry.getAllBindings()).to.have.lengthOf(2);
      expect(registry.getBinding("console")).not.to.equal(undefined);
      expect(registry.getBinding("fs")).not.to.equal(undefined);
    });

    it("should handle malformed JSON gracefully", () => {
      const manifestPath = path.join(tempDir, "bad.bindings.json");
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
        path.join(tempDir, "mixed.bindings.json"),
        JSON.stringify(manifest, null, 2)
      );

      const registry = loadBindings([tempDir]);

      const consoleBinding = registry.getBinding("console");
      expect(consoleBinding?.kind).to.equal("global");

      const fsBinding = registry.getBinding("fs");
      expect(fsBinding?.kind).to.equal("module");
    });
  });
});
