/**
 * Tests for BindingRegistry member-resolution paths:
 * simple-binding type alias mapping, generic arrays, instance vs static members,
 * tsbindgen CLR name lookups, disambiguated aliases, qualified alias resolution,
 * and extension methods.
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { BindingRegistry } from "../bindings.js";

describe("Binding System", () => {
  describe("BindingRegistry — member resolution", () => {
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
            type: "Acme.Runtime.Array`1",
          },
        },
      });

      registry.addBindings("/test/acme-array/bindings.json", {
        namespace: "Acme.Runtime",
        types: [
          {
            clrName: "Acme.Runtime.Array`1",
            assemblyName: "Acme.Runtime",
            methods: [
              {
                clrName: "map",
                declaringClrType: "Acme.Runtime.Array`1",
                declaringAssemblyName: "Acme.Runtime",
              },
            ],
            properties: [
              {
                clrName: "length",
                declaringClrType: "Acme.Runtime.Array`1",
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
        "Acme.Runtime.Array`1"
      );

      const lengthOverloads = registry.getMemberOverloads("Array", "length");
      expect(lengthOverloads).to.not.equal(undefined);
      expect(lengthOverloads?.[0]?.binding.member).to.equal("length");
    });

    it("should resolve instance members through simple binding runtime types even when staticType differs", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/simple-array.json", {
        bindings: {
          Array: {
            kind: "global",
            assembly: "Acme.Runtime",
            type: "Acme.Runtime.Array`1",
            staticType: "Acme.Runtime.ArrayStatics",
            typeSemantics: {
              contributesTypeIdentity: true,
            },
          },
        },
      });

      registry.addBindings("/test/acme-array/bindings.json", {
        namespace: "Acme.Runtime",
        types: [
          {
            clrName: "Acme.Runtime.Array`1",
            assemblyName: "Acme.Runtime",
            methods: [
              {
                clrName: "push",
                declaringClrType: "Acme.Runtime.Array`1",
                declaringAssemblyName: "Acme.Runtime",
              },
              {
                clrName: "join",
                declaringClrType: "Acme.Runtime.Array`1",
                declaringAssemblyName: "Acme.Runtime",
              },
            ],
            properties: [],
            fields: [],
          },
          {
            clrName: "Acme.Runtime.ArrayStatics",
            assemblyName: "Acme.Runtime",
            methods: [
              {
                clrName: "from",
                declaringClrType: "Acme.Runtime.ArrayStatics",
                declaringAssemblyName: "Acme.Runtime",
              },
            ],
            properties: [],
            fields: [],
          },
        ],
      });

      const pushOverloads = registry.getMemberOverloads("Array", "push");
      expect(pushOverloads).to.not.equal(undefined);
      expect(pushOverloads?.[0]?.binding.type).to.equal(
        "Acme.Runtime.Array`1"
      );

      const joinOverloads = registry.getMemberOverloads("Array", "join");
      expect(joinOverloads).to.not.equal(undefined);
      expect(joinOverloads?.[0]?.binding.type).to.equal(
        "Acme.Runtime.Array`1"
      );
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

    it("should keep explicit tsbindgen aliases disambiguated when simple names collide", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/acme/bindings.json", {
        namespace: "Acme",
        types: [
          {
            clrName: "Acme.domain.ChannelFolderWithItems",
            alias: "Acme.domain.ChannelFolderWithItems",
            assemblyName: "Acme",
            methods: [],
            properties: [
              {
                clrName: "folder",
                declaringClrType: "Acme.domain.ChannelFolderWithItems",
                declaringAssemblyName: "Acme",
              },
            ],
            fields: [],
          },
          {
            clrName: "Acme.repo.ChannelFolderWithItems",
            alias: "Acme.repo.ChannelFolderWithItems",
            assemblyName: "Acme",
            methods: [],
            properties: [
              {
                clrName: "folder",
                declaringClrType: "Acme.repo.ChannelFolderWithItems",
                declaringAssemblyName: "Acme",
              },
            ],
            fields: [],
          },
        ],
      });

      const domainOverloads = registry.getMemberOverloads(
        "Acme.domain.ChannelFolderWithItems",
        "folder"
      );
      expect(domainOverloads).to.not.equal(undefined);
      expect(domainOverloads?.length).to.equal(1);
      expect(domainOverloads?.[0]?.binding.type).to.equal(
        "Acme.domain.ChannelFolderWithItems"
      );

      const repoOverloads = registry.getMemberOverloads(
        "Acme.repo.ChannelFolderWithItems",
        "folder"
      );
      expect(repoOverloads).to.not.equal(undefined);
      expect(repoOverloads?.length).to.equal(1);
      expect(repoOverloads?.[0]?.binding.type).to.equal(
        "Acme.repo.ChannelFolderWithItems"
      );

      expect(
        registry.getMemberOverloads("ChannelFolderWithItems", "folder")
      ).to.equal(undefined);
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

      const overloads = registry.getMemberOverloads("Acme.Core.Widget", "Name");
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
});
