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

    it("should resolve simple bindings case-insensitively", () => {
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

      const upper = registry.getBinding("Console");
      expect(upper).to.deep.equal({
        kind: "global",
        assembly: "Tsonic.Runtime",
        type: "Tsonic.Runtime.console",
      });
    });

    it("should resolve member overloads via simple binding type alias mapping", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/simple.json", {
        bindings: {
          Console: {
            kind: "global",
            assembly: "Acme.Runtime",
            type: "Acme.Runtime.console",
          },
        },
      });

      registry.addBindings("/test/acme/bindings.json", {
        namespace: "Acme.Runtime",
        types: [
          {
            clrName: "Acme.Runtime.console",
            assemblyName: "Acme.Runtime",
            methods: [
              {
                clrName: "log",
                declaringClrType: "Acme.Runtime.console",
                declaringAssemblyName: "Acme.Runtime",
              },
            ],
            properties: [],
            fields: [],
          },
        ],
      });

      const overloads = registry.getMemberOverloads("Console", "log");
      expect(overloads).to.not.equal(undefined);
      expect(overloads?.length).to.equal(1);
      expect(overloads?.[0]?.binding.type).to.equal("Acme.Runtime.console");
      expect(overloads?.[0]?.binding.member).to.equal("log");
    });

    it("should resolve generic array aliases via simple binding type mapping", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/simple-array.json", {
        bindings: {
          Array: {
            kind: "global",
            assembly: "Acme.Runtime",
            type: "Acme.Runtime.JSArray`1",
          },
        },
      });

      registry.addBindings("/test/acme-array/bindings.json", {
        namespace: "Acme.Runtime",
        types: [
          {
            clrName: "Acme.Runtime.JSArray`1",
            assemblyName: "Acme.Runtime",
            methods: [
              {
                clrName: "map",
                declaringClrType: "Acme.Runtime.JSArray`1",
                declaringAssemblyName: "Acme.Runtime",
              },
            ],
            properties: [
              {
                clrName: "length",
                declaringClrType: "Acme.Runtime.JSArray`1",
                declaringAssemblyName: "Acme.Runtime",
              },
            ],
            fields: [],
          },
        ],
      });

      const mapOverloads = registry.getMemberOverloads("Array", "map");
      expect(mapOverloads).to.not.equal(undefined);
      expect(mapOverloads?.[0]?.binding.type).to.equal(
        "Acme.Runtime.JSArray`1"
      );

      const lengthOverloads = registry.getMemberOverloads("Array", "length");
      expect(lengthOverloads).to.not.equal(undefined);
      expect(lengthOverloads?.[0]?.binding.member).to.equal("length");
    });

    it("should resolve tsbindgen types by CLR name", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/acme/bindings.json", {
        namespace: "Acme.Core",
        types: [
          {
            clrName: "Acme.Core.Widget",
            assemblyName: "Acme.Core",
            methods: [],
            properties: [
              {
                clrName: "Name",
                declaringClrType: "Acme.Core.Widget",
                declaringAssemblyName: "Acme.Core",
              },
            ],
            fields: [],
          },
        ],
      });

      const byAlias = registry.getType("Widget");
      const byClrName = registry.getType("Acme.Core.Widget");

      expect(byAlias?.name).to.equal("Acme.Core.Widget");
      expect(byClrName?.alias).to.equal("Widget");
    });

    it("should resolve member overloads by CLR type name for source-binding canonical identities", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/acme/bindings.json", {
        namespace: "Acme.Core",
        types: [
          {
            clrName: "Acme.Core.Widget",
            assemblyName: "Acme.Core",
            methods: [],
            properties: [
              {
                clrName: "Name",
                declaringClrType: "Acme.Core.Widget",
                declaringAssemblyName: "Acme.Core",
              },
            ],
            fields: [],
          },
        ],
      });

      const overloads = registry.getMemberOverloads(
        "Acme.Core.Widget",
        "Name"
      );
      expect(overloads).to.not.equal(undefined);
      expect(overloads?.length).to.equal(1);
      expect(overloads?.[0]?.binding.type).to.equal("Acme.Core.Widget");
      expect(overloads?.[0]?.binding.member).to.equal("Name");
    });

    it("should resolve member overloads by qualified TS alias for source-binding canonical identities", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/acme/bindings.json", {
        namespace: "Acme.Core",
        types: [
          {
            clrName: "Acme.Core.Ok__Alias`1",
            assemblyName: "Acme.Core",
            methods: [],
            properties: [
              {
                clrName: "success",
                declaringClrType: "Acme.Core.Ok__Alias`1",
                declaringAssemblyName: "Acme.Core",
              },
            ],
            fields: [],
          },
        ],
      });

      const byQualifiedAlias = registry.getType("Acme.Core.Ok__Alias_1");
      const overloads = registry.getMemberOverloads(
        "Acme.Core.Ok__Alias_1",
        "success"
      );

      expect(byQualifiedAlias?.alias).to.equal("Ok__Alias_1");
      expect(overloads).to.not.equal(undefined);
      expect(overloads?.length).to.equal(1);
      expect(overloads?.[0]?.binding.type).to.equal("Acme.Core.Ok__Alias`1");
      expect(overloads?.[0]?.binding.member).to.equal("success");
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

    it("should preserve explicit simple-binding type semantics in the registry", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/simple.json", {
        bindings: {
          Date: {
            kind: "global",
            assembly: "Tsonic.JSRuntime",
            type: "Tsonic.JSRuntime.Date",
            typeSemantics: {
              contributesTypeIdentity: true,
            },
          },
          JSON: {
            kind: "global",
            assembly: "Tsonic.JSRuntime",
            type: "Tsonic.JSRuntime.JSON",
            typeSemantics: {
              contributesTypeIdentity: false,
            },
          },
        },
      });

      expect(
        registry.getBinding("Date")?.typeSemantics?.contributesTypeIdentity
      ).to.equal(true);
      expect(
        registry.getBinding("JSON")?.typeSemantics?.contributesTypeIdentity
      ).to.equal(false);
    });

    it("should use explicit type semantics before uppercase fallback in emitter type map", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/simple.json", {
        bindings: {
          Date: {
            kind: "global",
            assembly: "Tsonic.JSRuntime",
            type: "Tsonic.JSRuntime.Date",
            typeSemantics: {
              contributesTypeIdentity: true,
            },
          },
          JSON: {
            kind: "global",
            assembly: "Tsonic.JSRuntime",
            type: "Tsonic.JSRuntime.JSON",
            typeSemantics: {
              contributesTypeIdentity: false,
            },
          },
          Error: {
            kind: "global",
            assembly: "Tsonic.JSRuntime",
            type: "Tsonic.JSRuntime.Error",
            typeSemantics: {
              contributesTypeIdentity: true,
            },
          },
          console: {
            kind: "global",
            assembly: "Tsonic.JSRuntime",
            type: "Tsonic.JSRuntime.console",
          },
        },
      });

      const emitterTypes = registry.getEmitterTypeMap();
      expect(emitterTypes.has("Date")).to.equal(true);
      expect(emitterTypes.has("JSON")).to.equal(false);
      expect(emitterTypes.has("Error")).to.equal(true);
      expect(emitterTypes.has("console")).to.equal(false);
    });

    it("should not infer type identity from uppercase aliases when metadata is absent", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/simple.json", {
        bindings: {
          Date: {
            kind: "global",
            assembly: "Tsonic.JSRuntime",
            type: "Tsonic.JSRuntime.Date",
          },
          JSON: {
            kind: "global",
            assembly: "Tsonic.JSRuntime",
            type: "Tsonic.JSRuntime.JSON",
          },
        },
      });

      const emitterTypes = registry.getEmitterTypeMap();
      expect(emitterTypes.has("Date")).to.equal(false);
      expect(emitterTypes.has("JSON")).to.equal(false);
    });

    it("should preserve explicit member emit semantics from tsbindgen bindings", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/linq/bindings.json", {
        namespace: "System.Linq",
        types: [
          {
            clrName: "System.Linq.Enumerable",
            assemblyName: "System.Linq",
            methods: [
              {
                clrName: "Where",
                declaringClrType: "System.Linq.Enumerable",
                declaringAssemblyName: "System.Linq",
                normalizedSignature:
                  "Where|(IEnumerable_1,Func_2):IEnumerable_1|static=true",
                parameterCount: 2,
                isExtensionMethod: true,
                emitSemantics: {
                  callStyle: "static",
                },
              },
              {
                clrName: "ToList",
                declaringClrType: "System.Linq.Enumerable",
                declaringAssemblyName: "System.Linq",
                normalizedSignature:
                  "ToList|(IEnumerable_1):List_1|static=true",
                parameterCount: 1,
                isExtensionMethod: true,
                emitSemantics: {
                  callStyle: "receiver",
                },
              },
            ],
            properties: [],
            fields: [],
          },
        ],
      });

      const where = registry.getMemberOverloads("Enumerable", "Where")?.[0];
      const toList = registry.getMemberOverloads("Enumerable", "ToList")?.[0];

      expect(where?.emitSemantics?.callStyle).to.equal("static");
      expect(toList?.emitSemantics?.callStyle).to.equal("receiver");
      expect(
        registry
          .getClrMemberOverloads("System.Linq", "System.Linq.Enumerable", "ToList")
          ?.[0]?.emitSemantics?.callStyle
      ).to.equal("receiver");
    });

    it("should expose tsbindgen namespace types for namespace-scoped import identity", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/System.Collections.Generic/bindings.json", {
        namespace: "System.Collections.Generic",
        types: [
          {
            clrName: "System.Collections.Generic.IEnumerable`1",
            assemblyName: "System.Runtime",
            kind: "Interface",
            methods: [],
            properties: [],
            fields: [],
          },
        ],
      });

      const namespace = registry.getNamespace("System.Collections.Generic");
      expect(namespace).to.not.equal(undefined);
      expect(namespace?.name).to.equal("System.Collections.Generic");
      expect(
        namespace?.types.some(
          (type) =>
            type.alias === "IEnumerable_1" &&
            type.name === "System.Collections.Generic.IEnumerable`1"
        )
      ).to.equal(true);
    });
  });
});
