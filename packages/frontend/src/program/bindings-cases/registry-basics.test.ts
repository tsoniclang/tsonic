/**
 * Tests for BindingRegistry core CRUD operations:
 * add / retrieve / clear / case-insensitive lookup / multiple manifests.
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { BindingRegistry } from "../bindings.js";

describe("Binding System", () => {
  describe("BindingRegistry — basics", () => {
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

    it("should prefer the requested CLR owner when a TS alias maps to multiple CLR types", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/globals.json", {
        bindings: {
          console: {
            kind: "global",
            assembly: "Tsonic.JSRuntime",
            type: "Tsonic.JSRuntime.console",
          },
        },
      });
      registry.addBindings("/test/js-runtime/bindings.json", {
        namespace: "Tsonic.JSRuntime",
        types: [
          {
            clrName: "Tsonic.JSRuntime.console",
            assemblyName: "Tsonic.JSRuntime",
            methods: [
              {
                clrName: "error",
                normalizedSignature:
                  "error|(System.Object[]):System.Void|static=true",
                parameterCount: 1,
                declaringClrType: "Tsonic.JSRuntime.console",
                declaringAssemblyName: "Tsonic.JSRuntime",
              },
            ],
            properties: [],
            fields: [],
          },
        ],
      });
      registry.addBindings("/test/nodejs/bindings.json", {
        namespace: "nodejs",
        types: [
          {
            clrName: "nodejs.console",
            assemblyName: "nodejs",
            methods: [
              {
                clrName: "error",
                normalizedSignature:
                  "error|(System.Object,System.Object[]):System.Void|static=true",
                parameterCount: 2,
                declaringClrType: "nodejs.console",
                declaringAssemblyName: "nodejs",
              },
            ],
            properties: [],
            fields: [],
          },
        ],
      });

      const overloads = registry.getMemberOverloads(
        "Tsonic.JSRuntime.console",
        "error",
        false
      );

      expect(overloads?.map((binding) => binding.binding.type)).to.deep.equal([
        "Tsonic.JSRuntime.console",
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

    it("should retain both global and module bindings for the same alias", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/js-runtime.json", {
        bindings: {
          console: {
            kind: "global",
            assembly: "Tsonic.JSRuntime",
            type: "Tsonic.JSRuntime.console",
          },
        },
      });

      registry.addBindings("/test/nodejs.json", {
        bindings: {
          console: {
            kind: "module",
            assembly: "nodejs",
            type: "nodejs.console",
          },
        },
      });

      expect(registry.getBinding("console")).to.deep.equal({
        kind: "global",
        assembly: "Tsonic.JSRuntime",
        type: "Tsonic.JSRuntime.console",
      });
      expect(registry.getBindingByKind("console", "global")).to.deep.equal({
        kind: "global",
        assembly: "Tsonic.JSRuntime",
        type: "Tsonic.JSRuntime.console",
      });
      expect(registry.getBindingByKind("console", "module")).to.deep.equal({
        kind: "module",
        assembly: "nodejs",
        type: "nodejs.console",
      });
    });
  });
});
