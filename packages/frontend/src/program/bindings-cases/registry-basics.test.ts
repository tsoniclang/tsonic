/**
 * Tests for BindingRegistry core CRUD operations:
 * add / retrieve / clear / multiple manifests.
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { BindingRegistry } from "../bindings.js";

describe("Binding System", () => {
  describe("BindingRegistry — basics", () => {
    it("should add and retrieve bindings", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/manifest.json", { schema: "tsonic.bindings", provider: { namespace: "sourceSurface" }, sourceSurface: { bindings: {
          console: {
            kind: "global",
            ownerIdentity: "Tsonic.Runtime",
            type: "Tsonic.Runtime.console",
          },
          fs: {
            kind: "module",
            ownerIdentity: "Tsonic.NodeApi",
            type: "Tsonic.NodeApi.fs",
          },
        } }, targetSurface: { types: [] } });

      const consoleBinding = registry.getBinding("console");
      expect(consoleBinding).to.deep.equal({
        kind: "global",
        ownerIdentity: "Tsonic.Runtime",
        type: "Tsonic.Runtime.console",
      });

      const fsBinding = registry.getBinding("fs");
      expect(fsBinding).to.deep.equal({
        kind: "module",
        ownerIdentity: "Tsonic.NodeApi",
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

      registry.addBindings("/test/manifest.json", { schema: "tsonic.bindings", provider: { namespace: "sourceSurface" }, sourceSurface: { bindings: {
          console: {
            kind: "global",
            ownerIdentity: "Tsonic.Runtime",
            type: "Tsonic.Runtime.console",
          },
          Math: {
            kind: "global",
            ownerIdentity: "Tsonic.Runtime",
            type: "Tsonic.Runtime.Math",
          },
        } }, targetSurface: { types: [] } });

      const allBindings = registry.getAllBindings();
      expect(allBindings).to.have.lengthOf(2);
      expect(allBindings.map((b) => b[0]).sort()).to.deep.equal([
        "Math",
        "console",
      ]);
    });

    it("should prefer the requested CLR owner when a TS alias maps to multiple CLR types", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/globals.json", { schema: "tsonic.bindings", provider: { namespace: "sourceSurface" }, sourceSurface: { bindings: {
          console: {
            kind: "global",
            ownerIdentity: "js",
            type: "js.console",
          },
        } }, targetSurface: { types: [] } });
      registry.addBindings("/test/js/bindings.json", { schema: "tsonic.bindings", provider: { namespace: "js" }, targetSurface: { types: [
          {
            targetName: "js.console",
            ownerIdentity: "js",
            methods: [
              {
                targetName: "error",
                normalizedSignature:
                  "error|(System.Object[]):System.Void|static=true",
                parameterCount: 1,
                ownerQualifiedName: "js.console",
                ownerIdentity: "js",
              },
            ],
            properties: [],
            fields: [],
          },
        ] } });
      registry.addBindings("/test/nodejs/bindings.json", { schema: "tsonic.bindings", provider: { namespace: "nodejs" }, targetSurface: { types: [
          {
            targetName: "nodejs.console",
            ownerIdentity: "nodejs",
            methods: [
              {
                targetName: "error",
                normalizedSignature:
                  "error|(System.Object,System.Object[]):System.Void|static=true",
                parameterCount: 2,
                ownerQualifiedName: "nodejs.console",
                ownerIdentity: "nodejs",
              },
            ],
            properties: [],
            fields: [],
          },
        ] } });

      const overloads = registry.getMemberOverloads(
        "js.console",
        "error",
        "js.console"
      );

      expect(overloads?.map((binding) => binding.binding.type)).to.deep.equal([
        "js.console",
      ]);
    });

    it("should clear all bindings", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/manifest.json", { schema: "tsonic.bindings", provider: { namespace: "sourceSurface" }, sourceSurface: { bindings: {
          console: {
            kind: "global",
            ownerIdentity: "Tsonic.Runtime",
            type: "Tsonic.Runtime.console",
          },
        } }, targetSurface: { types: [] } });

      expect(registry.getAllBindings()).to.have.lengthOf(1);

      registry.clear();
      expect(registry.getAllBindings()).to.have.lengthOf(0);
      expect(registry.getBinding("console")).to.equal(undefined);
    });

    it("should handle multiple manifest files", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/runtime.json", { schema: "tsonic.bindings", provider: { namespace: "sourceSurface" }, sourceSurface: { bindings: {
          console: {
            kind: "global",
            ownerIdentity: "Tsonic.Runtime",
            type: "Tsonic.Runtime.console",
          },
        } }, targetSurface: { types: [] } });

      registry.addBindings("/test/node.json", { schema: "tsonic.bindings", provider: { namespace: "sourceSurface" }, sourceSurface: { bindings: {
          fs: {
            kind: "module",
            ownerIdentity: "Tsonic.NodeApi",
            type: "Tsonic.NodeApi.fs",
          },
        } }, targetSurface: { types: [] } });

      expect(registry.getAllBindings()).to.have.lengthOf(2);
      expect(registry.getBinding("console")).not.to.equal(undefined);
      expect(registry.getBinding("fs")).not.to.equal(undefined);
    });

    it("should retain both global and module bindings for the same alias", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/js.json", { schema: "tsonic.bindings", provider: { namespace: "sourceSurface" }, sourceSurface: { bindings: {
          console: {
            kind: "global",
            ownerIdentity: "js",
            type: "js.console",
          },
        } }, targetSurface: { types: [] } });

      registry.addBindings("/test/nodejs.json", { schema: "tsonic.bindings", provider: { namespace: "sourceSurface" }, sourceSurface: { bindings: {
          console: {
            kind: "module",
            ownerIdentity: "nodejs",
            type: "nodejs.console",
          },
        } }, targetSurface: { types: [] } });

      expect(registry.getBinding("console")).to.deep.equal({
        kind: "global",
        ownerIdentity: "js",
        type: "js.console",
      });
      expect(registry.getBindingByKind("console", "global")).to.deep.equal({
        kind: "global",
        ownerIdentity: "js",
        type: "js.console",
      });
      expect(registry.getBindingByKind("console", "module")).to.deep.equal({
        kind: "module",
        ownerIdentity: "nodejs",
        type: "nodejs.console",
      });
    });
  });
});
