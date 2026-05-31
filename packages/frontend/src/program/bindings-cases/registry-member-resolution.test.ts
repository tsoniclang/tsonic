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

      registry.addBindings("/test/simple.json", { schema: "tsonic.bindings", provider: { namespace: "sourceSurface" }, sourceSurface: { bindings: {
          Console: {
            kind: "global",
            ownerIdentity: "Acme.Runtime",
            type: "Acme.Runtime.console",
          },
        } }, targetSurface: { types: [] } });

      registry.addBindings("/test/acme/bindings.json", { schema: "tsonic.bindings", provider: { namespace: "Acme.Runtime" }, targetSurface: { types: [
          {
            targetName: "Acme.Runtime.console",
            ownerIdentity: "Acme.Runtime",
            methods: [
              {
                targetName: "log",
                ownerQualifiedName: "Acme.Runtime.console",
                ownerIdentity: "Acme.Runtime",
              },
            ],
            properties: [],
            fields: [],
          },
        ] } });

      const overloads = registry.getMemberOverloads("Console", "log");
      expect(overloads).to.not.equal(undefined);
      expect(overloads?.length).to.equal(1);
      expect(overloads?.[0]?.binding.type).to.equal("Acme.Runtime.console");
      expect(overloads?.[0]?.binding.member).to.equal("log");
    });

    it("should resolve generic array aliases via simple binding type mapping", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/simple-array.json", { schema: "tsonic.bindings", provider: { namespace: "sourceSurface" }, sourceSurface: { bindings: {
          Array: {
            kind: "global",
            ownerIdentity: "Acme.Runtime",
            type: "Acme.Runtime.Array`1",
          },
        } }, targetSurface: { types: [] } });

      registry.addBindings("/test/acme-array/bindings.json", { schema: "tsonic.bindings", provider: { namespace: "Acme.Runtime" }, targetSurface: { types: [
          {
            targetName: "Acme.Runtime.Array`1",
            ownerIdentity: "Acme.Runtime",
            methods: [
              {
                targetName: "map",
                ownerQualifiedName: "Acme.Runtime.Array`1",
                ownerIdentity: "Acme.Runtime",
              },
            ],
            properties: [
              {
                targetName: "length",
                ownerQualifiedName: "Acme.Runtime.Array`1",
                ownerIdentity: "Acme.Runtime",
              },
            ],
            fields: [],
          },
        ] } });

      const mapOverloads = registry.getMemberOverloads("Array", "map");
      expect(mapOverloads).to.not.equal(undefined);
      expect(mapOverloads?.[0]?.binding.type).to.equal("Acme.Runtime.Array`1");

      const lengthOverloads = registry.getMemberOverloads("Array", "length");
      expect(lengthOverloads).to.not.equal(undefined);
      expect(lengthOverloads?.[0]?.binding.member).to.equal("length");
    });

    it("should resolve instance members through simple binding runtime types even when staticType differs", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/simple-array.json", { schema: "tsonic.bindings", provider: { namespace: "sourceSurface" }, sourceSurface: { bindings: {
          Array: {
            kind: "global",
            ownerIdentity: "Acme.Runtime",
            type: "Acme.Runtime.Array`1",
            staticType: "Acme.Runtime.ArrayStatics",
            typeSemantics: {
              contributesTypeIdentity: true,
            },
          },
        } }, targetSurface: { types: [] } });

      registry.addBindings("/test/acme-array/bindings.json", { schema: "tsonic.bindings", provider: { namespace: "Acme.Runtime" }, targetSurface: { types: [
          {
            targetName: "Acme.Runtime.Array`1",
            ownerIdentity: "Acme.Runtime",
            methods: [
              {
                targetName: "push",
                ownerQualifiedName: "Acme.Runtime.Array`1",
                ownerIdentity: "Acme.Runtime",
              },
              {
                targetName: "join",
                ownerQualifiedName: "Acme.Runtime.Array`1",
                ownerIdentity: "Acme.Runtime",
              },
            ],
            properties: [],
            fields: [],
          },
          {
            targetName: "Acme.Runtime.ArrayStatics",
            ownerIdentity: "Acme.Runtime",
            methods: [
              {
                targetName: "from",
                ownerQualifiedName: "Acme.Runtime.ArrayStatics",
                ownerIdentity: "Acme.Runtime",
              },
            ],
            properties: [],
            fields: [],
          },
        ] } });

      const pushOverloads = registry.getMemberOverloads("Array", "push");
      expect(pushOverloads).to.not.equal(undefined);
      expect(pushOverloads?.[0]?.binding.type).to.equal("Acme.Runtime.Array`1");

      const joinOverloads = registry.getMemberOverloads("Array", "join");
      expect(joinOverloads).to.not.equal(undefined);
      expect(joinOverloads?.[0]?.binding.type).to.equal("Acme.Runtime.Array`1");
    });

    it("should resolve tsbindgen types by CLR name", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/acme/bindings.json", { schema: "tsonic.bindings", provider: { namespace: "Acme.Core" }, targetSurface: { types: [
          {
            targetName: "Acme.Core.Widget",
            ownerIdentity: "Acme.Core",
            methods: [],
            properties: [
              {
                targetName: "Name",
                ownerQualifiedName: "Acme.Core.Widget",
                ownerIdentity: "Acme.Core",
              },
            ],
            fields: [],
          },
        ] } });

      const byAlias = registry.getType("Widget");
      const byTargetName = registry.getType("Acme.Core.Widget");

      expect(byAlias?.name).to.equal("Acme.Core.Widget");
      expect(byTargetName?.alias).to.equal("Widget");
    });

    it("should keep explicit tsbindgen aliases disambiguated when simple names collide", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/acme/bindings.json", { schema: "tsonic.bindings", provider: { namespace: "Acme" }, targetSurface: { types: [
          {
            targetName: "Acme.domain.ChannelFolderWithItems",
            alias: "Acme.domain.ChannelFolderWithItems",
            ownerIdentity: "Acme",
            methods: [],
            properties: [
              {
                targetName: "folder",
                ownerQualifiedName: "Acme.domain.ChannelFolderWithItems",
                ownerIdentity: "Acme",
              },
            ],
            fields: [],
          },
          {
            targetName: "Acme.repo.ChannelFolderWithItems",
            alias: "Acme.repo.ChannelFolderWithItems",
            ownerIdentity: "Acme",
            methods: [],
            properties: [
              {
                targetName: "folder",
                ownerQualifiedName: "Acme.repo.ChannelFolderWithItems",
                ownerIdentity: "Acme",
              },
            ],
            fields: [],
          },
        ] } });

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

      registry.addBindings("/test/acme/bindings.json", { schema: "tsonic.bindings", provider: { namespace: "Acme.Core" }, targetSurface: { types: [
          {
            targetName: "Acme.Core.Widget",
            ownerIdentity: "Acme.Core",
            methods: [],
            properties: [
              {
                targetName: "Name",
                ownerQualifiedName: "Acme.Core.Widget",
                ownerIdentity: "Acme.Core",
              },
            ],
            fields: [],
          },
        ] } });

      const overloads = registry.getMemberOverloads("Acme.Core.Widget", "Name");
      expect(overloads).to.not.equal(undefined);
      expect(overloads?.length).to.equal(1);
      expect(overloads?.[0]?.binding.type).to.equal("Acme.Core.Widget");
      expect(overloads?.[0]?.binding.member).to.equal("Name");
    });

    it("should resolve member overloads by qualified TS alias for source-binding canonical identities", () => {
      const registry = new BindingRegistry();

      registry.addBindings("/test/acme/bindings.json", { schema: "tsonic.bindings", provider: { namespace: "Acme.Core" }, targetSurface: { types: [
          {
            targetName: "Acme.Core.Ok__Alias`1",
            ownerIdentity: "Acme.Core",
            methods: [],
            properties: [
              {
                targetName: "success",
                ownerQualifiedName: "Acme.Core.Ok__Alias`1",
                ownerIdentity: "Acme.Core",
              },
            ],
            fields: [],
          },
        ] } });

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

      registry.addBindings("/test/System.Linq/bindings.json", { schema: "tsonic.bindings", provider: { namespace: "System.Linq" }, targetSurface: { types: [
          {
            targetName: "System.Linq.Enumerable",
            ownerIdentity: "System.Linq",
            methods: [
              {
                targetName: "Where",
                normalizedSignature:
                  "Where|(IEnumerable_1,Func_2):IEnumerable_1|static=true",
                ownerQualifiedName: "System.Linq.Enumerable",
                ownerIdentity: "System.Linq",
                isExtensionMethod: true,
              },
            ],
            properties: [],
            fields: [],
          },
        ] } });

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
