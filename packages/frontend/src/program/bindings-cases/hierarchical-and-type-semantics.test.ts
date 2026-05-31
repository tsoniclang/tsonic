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

      registry.addBindings("/test/system-linq.json", { schema: "tsonic.bindings", provider: { namespace: "System.Linq", ownerIdentities: ["System.Linq"] }, sourceSurface: { namespaces: [
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
        ] }, targetSurface: { types: [] } });

      const namespace = registry.getNamespace("systemLinq");
      expect(namespace).to.not.equal(undefined);
      expect(namespace?.name).to.equal("System.Linq");
      expect(namespace?.types).to.have.lengthOf(1);
    });

    it("should retrieve type bindings from hierarchical manifest", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/system-linq.json", { schema: "tsonic.bindings", provider: { namespace: "System.Linq", ownerIdentities: ["System.Linq"] }, sourceSurface: { namespaces: [
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
        ] }, targetSurface: { types: [] } });

      const type = registry.getType("enumerable");
      expect(type).to.not.equal(undefined);
      expect(type?.name).to.equal("Enumerable");
      expect(type?.kind).to.equal("class");
    });

    it("should retrieve member bindings from hierarchical manifest", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/system-linq.json", { schema: "tsonic.bindings", provider: { namespace: "System.Linq", ownerIdentities: ["System.Linq"] }, sourceSurface: { namespaces: [
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
                      ownerIdentity: "System.Linq",
                      type: "System.Linq.Enumerable",
                      member: "SelectMany",
                    },
                  },
                ],
              },
            ],
          },
        ] }, targetSurface: { types: [] } });

      const member = registry.getMember("enumerable", "selectMany");
      expect(member).to.not.equal(undefined);
      expect(member?.name).to.equal("SelectMany");
      expect(member?.binding.type).to.equal("System.Linq.Enumerable");
      expect(member?.binding.member).to.equal("SelectMany");
    });

    it("should handle multiple namespaces in one manifest", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/multi-namespace.json", { schema: "tsonic.bindings", provider: { namespace: "MyLib", ownerIdentities: ["MyLib"] }, sourceSurface: { namespaces: [
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
        ] }, targetSurface: { types: [] } });

      expect(registry.getNamespace("ns1")).to.not.equal(undefined);
      expect(registry.getNamespace("ns2")).to.not.equal(undefined);
      expect(registry.getAllNamespaces()).to.have.lengthOf(2);
    });

    it("should support both simple and hierarchical manifests", () => {
      const registry = new BindingRegistry();

      // Add simple manifest
      registry.addBindings("/test/simple.json", { schema: "tsonic.bindings", provider: { namespace: "sourceSurface" }, sourceSurface: { bindings: {
          console: {
            kind: "global",
            ownerIdentity: "Tsonic.Runtime",
            type: "Tsonic.Runtime.console",
          },
        } }, targetSurface: { types: [] } });

      // Add hierarchical manifest
      registry.addBindings("/test/hierarchical.json", { schema: "tsonic.bindings", provider: { namespace: "System.Linq", ownerIdentities: ["System.Linq"] }, sourceSurface: { namespaces: [
          {
            name: "System.Linq",
            alias: "systemLinq",
            types: [],
          },
        ] }, targetSurface: { types: [] } });

      // Both should work
      expect(registry.getBinding("console")).to.not.equal(undefined);
      expect(registry.getNamespace("systemLinq")).to.not.equal(undefined);
    });

    it("merges shared namespaces from multiple manifests", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/efcore.bindings.json", { schema: "tsonic.bindings", provider: { namespace: "Microsoft.EntityFrameworkCore" }, targetSurface: { types: [
          {
            targetName: "Microsoft.EntityFrameworkCore.DbContext",
            ownerIdentity: "Microsoft.EntityFrameworkCore",
            kind: "Class",
            methods: [],
            properties: [],
            fields: [],
          },
          {
            targetName: "Microsoft.EntityFrameworkCore.DbSet`1",
            ownerIdentity: "Microsoft.EntityFrameworkCore",
            kind: "Class",
            methods: [],
            properties: [],
            fields: [],
          },
        ] } });

      registry.addBindings("/test/efcore-sqlite.bindings.json", { schema: "tsonic.bindings", provider: { namespace: "Microsoft.EntityFrameworkCore" }, targetSurface: { types: [
          {
            targetName:
              "Microsoft.EntityFrameworkCore.SqliteDbContextOptionsBuilderExtensions",
            ownerIdentity: "Microsoft.EntityFrameworkCore.Sqlite",
            kind: "Class",
            methods: [],
            properties: [],
            fields: [],
          },
        ] } });

      const namespace = registry.getNamespace("Microsoft.EntityFrameworkCore");
      expect(namespace).to.not.equal(undefined);
      expect(namespace?.types.map((type) => type.alias)).to.deep.equal([
        "DbContext",
        "DbSet_1",
        "SqliteDbContextOptionsBuilderExtensions",
      ]);
      expect(registry.getType("DbContext")?.name).to.equal(
        "Microsoft.EntityFrameworkCore.DbContext"
      );
      expect(registry.getType("DbSet_1")?.name).to.equal(
        "Microsoft.EntityFrameworkCore.DbSet`1"
      );
    });

    it("rejects conflicting shared namespace aliases", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/first.bindings.json", { schema: "tsonic.bindings", provider: { namespace: "Acme.Tools" }, targetSurface: { types: [
          {
            targetName: "Acme.Tools.Widget",
            ownerIdentity: "Acme.Tools",
            kind: "Class",
            methods: [],
            properties: [],
            fields: [],
          },
        ] } });

      expect(() =>
        registry.addBindings("/test/second.bindings.json", { schema: "tsonic.bindings", provider: { namespace: "Acme.Tools" }, targetSurface: { types: [
            {
              targetName: "Acme.Tools.OtherWidget",
              alias: "Widget",
              ownerIdentity: "Acme.Tools",
              kind: "Class",
              methods: [],
              properties: [],
              fields: [],
            },
          ] } })
      ).to.throw("Conflicting type binding");
    });

    it("should return undefined for non-existent hierarchical bindings", () => {
      const registry = new BindingRegistry();

      expect(registry.getNamespace("nonexistent")).to.equal(undefined);
      expect(registry.getType("nonexistent")).to.equal(undefined);
      expect(registry.getMember("nonexistent", "member")).to.equal(undefined);
    });

    it("should clear hierarchical bindings along with simple bindings", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/mixed.json", { schema: "tsonic.bindings", provider: { namespace: "Test", ownerIdentities: ["Test"] }, sourceSurface: { namespaces: [
          {
            name: "Test.NS",
            alias: "ns",
            types: [],
          },
        ] }, targetSurface: { types: [] } });

      expect(registry.getAllNamespaces()).to.have.lengthOf(1);

      registry.clear();

      expect(registry.getAllNamespaces()).to.have.lengthOf(0);
      expect(registry.getNamespace("ns")).to.equal(undefined);
    });

    it("should index member bindings by type.member key", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/members.json", { schema: "tsonic.bindings", provider: { namespace: "MyLib", ownerIdentities: ["MyLib"] }, sourceSurface: { namespaces: [
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
                      ownerIdentity: "MyLib",
                      type: "MyLib.TypeA",
                      member: "Method1",
                    },
                  },
                  {
                    kind: "method",
                    name: "Method2",
                    alias: "method2",
                    binding: {
                      ownerIdentity: "MyLib",
                      type: "MyLib.TypeA",
                      member: "Method2",
                    },
                  },
                ],
              },
            ],
          },
        ] }, targetSurface: { types: [] } });

      const member1 = registry.getMember("typeA", "method1");
      const member2 = registry.getMember("typeA", "method2");

      expect(member1?.name).to.equal("Method1");
      expect(member2?.name).to.equal("Method2");
    });

    it("should preserve explicit simple-binding type semantics in the registry", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/simple.json", { schema: "tsonic.bindings", provider: { namespace: "sourceSurface" }, sourceSurface: { bindings: {
          Date: {
            kind: "global",
            ownerIdentity: "js",
            type: "js.Date",
            typeSemantics: {
              contributesTypeIdentity: true,
            },
          },
          JSON: {
            kind: "global",
            ownerIdentity: "js",
            type: "js.JSON",
            typeSemantics: {
              contributesTypeIdentity: false,
            },
          },
        } }, targetSurface: { types: [] } });

      expect(
        registry.getBinding("Date")?.typeSemantics?.contributesTypeIdentity
      ).to.equal(true);
      expect(
        registry.getBinding("JSON")?.typeSemantics?.contributesTypeIdentity
      ).to.equal(false);
    });

    it("should use explicit type semantics only in emitter type map", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/simple.json", { schema: "tsonic.bindings", provider: { namespace: "sourceSurface" }, sourceSurface: { bindings: {
          Date: {
            kind: "global",
            ownerIdentity: "js",
            type: "js.Date",
            typeSemantics: {
              contributesTypeIdentity: true,
            },
          },
          JSON: {
            kind: "global",
            ownerIdentity: "js",
            type: "js.JSON",
            typeSemantics: {
              contributesTypeIdentity: false,
            },
          },
          Error: {
            kind: "global",
            ownerIdentity: "js",
            type: "js.Error",
            typeSemantics: {
              contributesTypeIdentity: true,
            },
          },
          console: {
            kind: "global",
            ownerIdentity: "js",
            type: "js.console",
          },
        } }, targetSurface: { types: [] } });

      const emitterTypes = registry.getEmitterTypeMap();
      expect(emitterTypes.has("Date")).to.equal(true);
      expect(emitterTypes.has("JSON")).to.equal(false);
      expect(emitterTypes.has("Error")).to.equal(true);
      expect(emitterTypes.has("console")).to.equal(false);
    });

    it("should expose only explicit simple-binding type identities", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/simple.json", { schema: "tsonic.bindings", provider: { namespace: "sourceSurface" }, sourceSurface: { bindings: {
          Uint8Array: {
            kind: "global",
            ownerIdentity: "js",
            type: "js.Uint8Array",
            staticType: "js.Uint8Array",
            typeSemantics: {
              contributesTypeIdentity: true,
            },
          },
        } }, targetSurface: { types: [] } });

      const emitterTypes = registry.getEmitterTypeMap();
      expect(emitterTypes.get("Uint8Array")?.name).to.equal("js.Uint8Array");
      expect(emitterTypes.has("Uint8ArrayConstructor")).to.equal(false);
    });

    it("should not infer type identity from uppercase aliases when metadata is absent", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/simple.json", { schema: "tsonic.bindings", provider: { namespace: "sourceSurface" }, sourceSurface: { bindings: {
          Date: {
            kind: "global",
            ownerIdentity: "js",
            type: "js.Date",
          },
          JSON: {
            kind: "global",
            ownerIdentity: "js",
            type: "js.JSON",
          },
        } }, targetSurface: { types: [] } });

      const emitterTypes = registry.getEmitterTypeMap();
      expect(emitterTypes.has("Date")).to.equal(false);
      expect(emitterTypes.has("JSON")).to.equal(false);
    });

    it("should preserve explicit member emit semantics from tsbindgen bindings", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/linq/bindings.json", { schema: "tsonic.bindings", provider: { namespace: "System.Linq" }, targetSurface: { types: [
          {
            targetName: "System.Linq.Enumerable",
            ownerIdentity: "System.Linq",
            methods: [
              {
                targetName: "Where",
                ownerQualifiedName: "System.Linq.Enumerable",
                ownerIdentity: "System.Linq",
                normalizedSignature:
                  "Where|(IEnumerable_1,Func_2):IEnumerable_1|static=true",
                parameterCount: 2,
                isExtensionMethod: true,
                emitSemantics: {
                  callStyle: "static",
                },
              },
              {
                targetName: "ToList",
                ownerQualifiedName: "System.Linq.Enumerable",
                ownerIdentity: "System.Linq",
                normalizedSignature:
                  "ToList|(IEnumerable_1):List_1|static=true",
                parameterCount: 1,
                isExtensionMethod: true,
                emitSemantics: {
                  callStyle: "receiver",
                },
              },
            ],
            properties: [
              {
                targetName: "Shared",
                ownerQualifiedName: "System.Buffers.ArrayPool`1",
                ownerIdentity: "System.Memory",
                emitSemantics: {
                  callableStaticAccessorKind: "property",
                },
              },
            ],
            fields: [
              {
                targetName: "Empty",
                ownerQualifiedName: "System.Memory`1",
                ownerIdentity: "System.Memory",
                emitSemantics: {
                  callableStaticAccessorKind: "field",
                },
              },
            ],
          },
        ] } });

      const where = registry.getMemberOverloads("Enumerable", "Where")?.[0];
      const toList = registry.getMemberOverloads("Enumerable", "ToList")?.[0];
      const shared = registry.getMemberOverloads("ArrayPool_1", "Shared")?.[0];
      const empty = registry.getMemberOverloads("Memory_1", "Empty")?.[0];

      expect(where?.emitSemantics?.callStyle).to.equal("static");
      expect(toList?.emitSemantics?.callStyle).to.equal("receiver");
      expect(shared?.emitSemantics?.callableStaticAccessorKind).to.equal(
        "property"
      );
      expect(empty?.emitSemantics?.callableStaticAccessorKind).to.equal(
        "field"
      );
      expect(
        registry.getTargetMemberOverloads(
          "System.Linq",
          "System.Linq.Enumerable",
          "ToList"
        )?.[0]?.emitSemantics?.callStyle
      ).to.equal("receiver");
    });

    it("should merge duplicate tsbindgen member metadata additively", () => {
      const addArraySegmentBindings = (
        registry: BindingRegistry,
        path: string,
        emitSemantics?: {
          readonly callableStaticAccessorKind: "property" | "field";
        }
      ): void => {
        const emptyProperty = {
          targetName: "Empty",
          ownerQualifiedName: "System.ArraySegment`1",
          ownerIdentity: "System.Private.CoreLib",
          normalizedSignature: "Empty|:ArraySegment_1|static=true|accessor=get",
          ...(emitSemantics ? { emitSemantics } : {}),
        };

        registry.addBindings(path, { schema: "tsonic.bindings", provider: { namespace: "System" }, targetSurface: { types: [
            {
              targetName: "System.ArraySegment`1",
              ownerIdentity: "System.Private.CoreLib",
              kind: "Struct",
              methods: [],
              properties: [emptyProperty],
              fields: [],
            },
          ] } });
      };

      for (const order of ["older-first", "newer-first"] as const) {
        const registry = new BindingRegistry();
        if (order === "older-first") {
          addArraySegmentBindings(registry, "/old/System/bindings.json");
          addArraySegmentBindings(registry, "/new/System/bindings.json", {
            callableStaticAccessorKind: "property",
          });
        } else {
          addArraySegmentBindings(registry, "/new/System/bindings.json", {
            callableStaticAccessorKind: "property",
          });
          addArraySegmentBindings(registry, "/old/System/bindings.json");
        }

        const overloads = registry.getMemberOverloads(
          "ArraySegment_1",
          "Empty"
        );
        const type = registry.getType("ArraySegment_1");
        expect(overloads).to.have.lengthOf(1);
        expect(type?.members).to.have.lengthOf(1);
        expect(
          overloads?.[0]?.emitSemantics?.callableStaticAccessorKind
        ).to.equal("property");
        expect(
          type?.members[0]?.emitSemantics?.callableStaticAccessorKind
        ).to.equal("property");
      }
    });

    it("should reject duplicate tsbindgen member metadata conflicts", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/first/System/bindings.json", { schema: "tsonic.bindings", provider: { namespace: "System" }, targetSurface: { types: [
          {
            targetName: "System.ArraySegment`1",
            ownerIdentity: "System.Private.CoreLib",
            kind: "Struct",
            methods: [],
            properties: [
              {
                targetName: "Empty",
                ownerQualifiedName: "System.ArraySegment`1",
                ownerIdentity: "System.Private.CoreLib",
                normalizedSignature:
                  "Empty|:ArraySegment_1|static=true|accessor=get",
                emitSemantics: {
                  callableStaticAccessorKind: "field",
                },
              },
            ],
            fields: [],
          },
        ] } });

      expect(() =>
        registry.addBindings("/second/System/bindings.json", { schema: "tsonic.bindings", provider: { namespace: "System" }, targetSurface: { types: [
            {
              targetName: "System.ArraySegment`1",
              ownerIdentity: "System.Private.CoreLib",
              kind: "Struct",
              methods: [],
              properties: [
                {
                  targetName: "Empty",
                  ownerQualifiedName: "System.ArraySegment`1",
                  ownerIdentity: "System.Private.CoreLib",
                  normalizedSignature:
                    "Empty|:ArraySegment_1|static=true|accessor=get",
                  emitSemantics: {
                    callableStaticAccessorKind: "property",
                  },
                },
              ],
              fields: [],
            },
          ] } })
      ).to.throw(
        /Conflicting member binding for System\.ArraySegment_1:Empty\.emitSemantics\.callableStaticAccessorKind/
      );
    });

    it("should merge extension surfaces that share target names but have distinct stable identities", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/first/System.Collections.Generic/bindings.json", { schema: "tsonic.bindings", provider: { namespace: "System.Collections.Generic" }, targetSurface: { types: [
          {
            stableId:
              "System.Private.CoreLib:System.Collections.Generic.CollectionExtensions",
            targetName: "System.Collections.Generic.CollectionExtensions",
            ownerIdentity: "System.Private.CoreLib",
            kind: "Class",
            methods: [
              {
                stableId:
                  "System.Private.CoreLib:System.Collections.Generic.CollectionExtensions::TryAdd(IDictionary_2,TKey,TValue):System.Boolean",
                targetName: "TryAdd",
                normalizedSignature:
                  "TryAdd|(IDictionary_2,TKey,TValue):System.Boolean|static=true",
                isExtensionMethod: true,
              },
            ],
            properties: [],
            fields: [],
          },
        ] } });

      registry.addBindings("/second/System.Collections.Generic/bindings.json", { schema: "tsonic.bindings", provider: { namespace: "System.Collections.Generic" }, targetSurface: { types: [
          {
            stableId:
              "Microsoft.Extensions.DependencyModel:System.Collections.Generic.CollectionExtensions",
            targetName: "System.Collections.Generic.CollectionExtensions",
            ownerIdentity: "Microsoft.Extensions.DependencyModel",
            kind: "Class",
            methods: [
              {
                stableId:
                  "Microsoft.Extensions.DependencyModel:System.Collections.Generic.CollectionExtensions::GetDefaultGroup(IEnumerable_1):RuntimeAssetGroup",
                targetName: "GetDefaultGroup",
                normalizedSignature:
                  "GetDefaultGroup|(IEnumerable_1):RuntimeAssetGroup|static=true",
                isExtensionMethod: true,
              },
            ],
            properties: [],
            fields: [],
          },
        ] } });

      const type = registry.getType("CollectionExtensions");
      expect(type?.stableId).to.equal(undefined);
      expect(type?.stableIds).to.deep.equal([
        "Microsoft.Extensions.DependencyModel:System.Collections.Generic.CollectionExtensions",
        "System.Private.CoreLib:System.Collections.Generic.CollectionExtensions",
      ]);
      expect(type?.members.map((member) => member.alias)).to.deep.equal([
        "TryAdd",
        "GetDefaultGroup",
      ]);
    });

    it("should expose tsbindgen namespace types for namespace-scoped import identity", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/System.Collections.Generic/bindings.json", { schema: "tsonic.bindings", provider: { namespace: "System.Collections.Generic" }, targetSurface: { types: [
          {
            targetName: "System.Collections.Generic.IEnumerable`1",
            ownerIdentity: "System.Runtime",
            kind: "Interface",
            methods: [],
            properties: [],
            fields: [],
          },
        ] } });

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
