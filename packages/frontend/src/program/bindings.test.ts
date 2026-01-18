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

    it("should resolve tsbindgen extension methods for instance-style calls", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/System.Linq/bindings.json", {
        namespace: "System.Linq",
        types: [
          {
            clrName: "System.Linq.Enumerable",
            assemblyName: "System.Linq",
            methods: [
              {
                clrName: "Where",
                normalizedSignature:
                  "Where|(IEnumerable_1,Func_2):IEnumerable_1|static=true",
                declaringClrType: "System.Linq.Enumerable",
                declaringAssemblyName: "System.Linq",
                isExtensionMethod: true,
              },
            ],
            properties: [],
            fields: [],
          },
        ],
      });

      const resolved = registry.resolveExtensionMethod(
        "__Ext_System_Linq_IEnumerable_1",
        "Where"
      );

      expect(resolved).to.not.equal(undefined);
      expect(resolved?.binding.type).to.equal("System.Linq.Enumerable");
      expect(resolved?.binding.member).to.equal("Where");
      expect(resolved?.isExtensionMethod).to.equal(true);
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
  });

  describe("Hierarchical Binding Manifests", () => {
    it("should add and retrieve hierarchical namespace bindings", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/system-linq.json", {
        assembly: "System.Linq",
        namespaces: [
          {
            name: "System.Linq",
            alias: "systemLinq",
            types: [
              {
                name: "Enumerable",
                alias: "enumerable",
                kind: "class",
                members: [],
              },
            ],
          },
        ],
      });

      const namespace = registry.getNamespace("systemLinq");
      expect(namespace).to.not.equal(undefined);
      expect(namespace?.name).to.equal("System.Linq");
      expect(namespace?.types).to.have.lengthOf(1);
    });

    it("should retrieve type bindings from hierarchical manifest", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/system-linq.json", {
        assembly: "System.Linq",
        namespaces: [
          {
            name: "System.Linq",
            alias: "systemLinq",
            types: [
              {
                name: "Enumerable",
                alias: "enumerable",
                kind: "class",
                members: [],
              },
            ],
          },
        ],
      });

      const type = registry.getType("enumerable");
      expect(type).to.not.equal(undefined);
      expect(type?.name).to.equal("Enumerable");
      expect(type?.kind).to.equal("class");
    });

    it("should retrieve member bindings from hierarchical manifest", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/system-linq.json", {
        assembly: "System.Linq",
        namespaces: [
          {
            name: "System.Linq",
            alias: "systemLinq",
            types: [
              {
                name: "Enumerable",
                alias: "enumerable",
                kind: "class",
                members: [
                  {
                    kind: "method",
                    name: "SelectMany",
                    alias: "selectMany",
                    binding: {
                      assembly: "System.Linq",
                      type: "System.Linq.Enumerable",
                      member: "SelectMany",
                    },
                  },
                ],
              },
            ],
          },
        ],
      });

      const member = registry.getMember("enumerable", "selectMany");
      expect(member).to.not.equal(undefined);
      expect(member?.name).to.equal("SelectMany");
      expect(member?.binding.type).to.equal("System.Linq.Enumerable");
      expect(member?.binding.member).to.equal("SelectMany");
    });

    it("should handle multiple namespaces in one manifest", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/multi-namespace.json", {
        assembly: "MyLib",
        namespaces: [
          {
            name: "MyLib.Namespace1",
            alias: "ns1",
            types: [],
          },
          {
            name: "MyLib.Namespace2",
            alias: "ns2",
            types: [],
          },
        ],
      });

      expect(registry.getNamespace("ns1")).to.not.equal(undefined);
      expect(registry.getNamespace("ns2")).to.not.equal(undefined);
      expect(registry.getAllNamespaces()).to.have.lengthOf(2);
    });

    it("should support both simple and hierarchical manifests", () => {
      const registry = new BindingRegistry();

      // Add simple manifest
      registry.addBindings("/test/simple.json", {
        bindings: {
          console: {
            kind: "global",
            assembly: "Tsonic.Runtime",
            type: "Tsonic.Runtime.console",
          },
        },
      });

      // Add hierarchical manifest
      registry.addBindings("/test/hierarchical.json", {
        assembly: "System.Linq",
        namespaces: [
          {
            name: "System.Linq",
            alias: "systemLinq",
            types: [],
          },
        ],
      });

      // Both should work
      expect(registry.getBinding("console")).to.not.equal(undefined);
      expect(registry.getNamespace("systemLinq")).to.not.equal(undefined);
    });

    it("should return undefined for non-existent hierarchical bindings", () => {
      const registry = new BindingRegistry();

      expect(registry.getNamespace("nonexistent")).to.equal(undefined);
      expect(registry.getType("nonexistent")).to.equal(undefined);
      expect(registry.getMember("nonexistent", "member")).to.equal(undefined);
    });

    it("should clear hierarchical bindings along with simple bindings", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/mixed.json", {
        assembly: "Test",
        namespaces: [
          {
            name: "Test.NS",
            alias: "ns",
            types: [],
          },
        ],
      });

      expect(registry.getAllNamespaces()).to.have.lengthOf(1);

      registry.clear();

      expect(registry.getAllNamespaces()).to.have.lengthOf(0);
      expect(registry.getNamespace("ns")).to.equal(undefined);
    });

    it("should index member bindings by type.member key", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/members.json", {
        assembly: "MyLib",
        namespaces: [
          {
            name: "MyLib",
            alias: "myLib",
            types: [
              {
                name: "TypeA",
                alias: "typeA",
                kind: "class",
                members: [
                  {
                    kind: "method",
                    name: "Method1",
                    alias: "method1",
                    binding: {
                      assembly: "MyLib",
                      type: "MyLib.TypeA",
                      member: "Method1",
                    },
                  },
                  {
                    kind: "method",
                    name: "Method2",
                    alias: "method2",
                    binding: {
                      assembly: "MyLib",
                      type: "MyLib.TypeA",
                      member: "Method2",
                    },
                  },
                ],
              },
            ],
          },
        ],
      });

      const member1 = registry.getMember("typeA", "method1");
      const member2 = registry.getMember("typeA", "method2");

      expect(member1?.name).to.equal("Method1");
      expect(member2?.name).to.equal("Method2");
    });
  });
});
