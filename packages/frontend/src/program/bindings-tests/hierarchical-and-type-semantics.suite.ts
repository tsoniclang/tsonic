/**
 * Tests for hierarchical binding manifests, type semantics,
 * emitter type map, and tsbindgen emit-semantics / namespace exposure.
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { BindingRegistry } from "../bindings.js";

describe("Binding System", () => {
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
      expect(emitterTypes.has("DateConstructor")).to.equal(true);
      expect(emitterTypes.has("JSON")).to.equal(false);
      expect(emitterTypes.has("Error")).to.equal(true);
      expect(emitterTypes.has("ErrorConstructor")).to.equal(true);
      expect(emitterTypes.has("console")).to.equal(false);
    });

    it("should expose constructor aliases for simple bindings with type identity", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/simple.json", {
        bindings: {
          Uint8Array: {
            kind: "global",
            assembly: "Tsonic.JSRuntime",
            type: "Tsonic.JSRuntime.Uint8Array",
            staticType: "Tsonic.JSRuntime.Uint8Array",
            typeSemantics: {
              contributesTypeIdentity: true,
            },
          },
        },
      });

      const emitterTypes = registry.getEmitterTypeMap();
      expect(emitterTypes.get("Uint8Array")?.name).to.equal(
        "Tsonic.JSRuntime.Uint8Array"
      );
      expect(emitterTypes.get("Uint8ArrayConstructor")?.name).to.equal(
        "Tsonic.JSRuntime.Uint8Array"
      );
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
        registry.getClrMemberOverloads(
          "System.Linq",
          "System.Linq.Enumerable",
          "ToList"
        )?.[0]?.emitSemantics?.callStyle
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
