import { createModuleWithType, describe, emitModule, expect, it } from "./helpers.js";
import type { FrontendTypeBinding, IrModule } from "./helpers.js";
describe("Reference Type Emission", () => {
  describe("Bindings Registry Types", () => {
    it("should strip generic arity markers from CLR names", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "Dictionary_2",
        typeArguments: [
          { kind: "primitiveType", name: "int" },
          { kind: "primitiveType", name: "string" },
        ],
      });

      const dictionaryBinding: FrontendTypeBinding = {
        name: "System.Collections.Generic.Dictionary`2",
        alias: "Dictionary_2",
        kind: "class",
        members: [],
      };

      const clrBindings = new Map<string, FrontendTypeBinding>([
        ["Dictionary_2", dictionaryBinding],
      ]);

      const result = emitModule(module, { clrBindings });

      expect(result).to.include(
        "global::System.Collections.Generic.Dictionary<int, string>"
      );
      expect(result).to.not.include("Dictionary`2");
    });

    it("should preserve generic arguments for qualified canonical type identities", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "List",
        typeArguments: [{ kind: "primitiveType", name: "int" }],
        typeId: {
          stableId: "System.Private.CoreLib:System.Collections.Generic.List`1",
          clrName: "System.Collections.Generic.List`1",
          assemblyName: "System.Private.CoreLib",
          tsName: "List",
        },
      });

      const result = emitModule(module);

      expect(result).to.include("global::System.Collections.Generic.List<int>");
      expect(result).to.not.include("List`1");
    });

    it("should resolve tsbindgen instance aliases through registry base names", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "MkdirOptions$instance",
      });

      const mkdirOptionsBinding: FrontendTypeBinding = {
        name: "nodejs.MkdirOptions",
        alias: "MkdirOptions",
        kind: "class",
        members: [],
      };

      const clrBindings = new Map<string, FrontendTypeBinding>([
        ["MkdirOptions", mkdirOptionsBinding],
      ]);

      const result = emitModule(module, { clrBindings });

      expect(result).to.include("global::nodejs.MkdirOptions x");
    });

    it("should canonicalize anonymous structural references to a unique binding-backed type", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "__Anon_local",
        structuralMembers: [
          {
            kind: "propertySignature",
            name: "success",
            type: { kind: "literalType", value: true },
            isOptional: false,
            isReadonly: false,
          },
          {
            kind: "propertySignature",
            name: "rendered",
            type: { kind: "primitiveType", name: "string" },
            isOptional: false,
            isReadonly: false,
          },
        ],
      });

      const anonymousBinding: FrontendTypeBinding = {
        name: "Acme.Messages.__Anon_8be6_614f176b",
        alias: "__Anon_8be6_614f176b",
        kind: "class",
        members: [
          {
            kind: "property",
            alias: "success",
            name: "success",
            semanticType: { kind: "literalType", value: true },
            binding: {
              assembly: "Acme.Messages",
              type: "Acme.Messages.__Anon_8be6_614f176b",
              member: "success",
            },
          },
          {
            kind: "property",
            alias: "rendered",
            name: "rendered",
            semanticType: { kind: "primitiveType", name: "string" },
            binding: {
              assembly: "Acme.Messages",
              type: "Acme.Messages.__Anon_8be6_614f176b",
              member: "rendered",
            },
          },
        ],
      };

      const clrBindings = new Map<string, FrontendTypeBinding>([
        [anonymousBinding.alias, anonymousBinding],
      ]);

      const result = emitModule(module, { clrBindings });

      expect(result).to.include("global::Acme.Messages.__Anon_8be6_614f176b x");
      expect(result).to.not.include("__Anon_local x");
    });
  });

  describe("Local Types", () => {
    it("should emit local class types without qualification", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "Test",
        className: "Test",
        isStaticContainer: true,
        imports: [],
        body: [
          // Define a local class
          {
            kind: "classDeclaration",
            name: "User",
            isExported: true,
            isStruct: false,
            typeParameters: [],
            implements: [],
            members: [],
          },
          // Use the local class as a type
          {
            kind: "variableDeclaration",
            declarationKind: "const",
            isExported: false,
            declarations: [
              {
                kind: "variableDeclarator",
                name: { kind: "identifierPattern", name: "user" },
                type: { kind: "referenceType", name: "User" },
                initializer: { kind: "literal", value: null },
              },
            ],
          },
        ],
        exports: [],
      };

      const result = emitModule(module);

      expect(result).to.include("User user");
    });

    it("should emit local interface types without qualification", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "Test",
        className: "Test",
        isStaticContainer: true,
        imports: [],
        body: [
          // Define a local interface
          {
            kind: "interfaceDeclaration",
            name: "IUser",
            isExported: true,
            isStruct: false,
            typeParameters: [],
            extends: [],
            members: [],
          },
          // Use the local interface as a type
          {
            kind: "variableDeclaration",
            declarationKind: "const",
            isExported: false,
            declarations: [
              {
                kind: "variableDeclarator",
                name: { kind: "identifierPattern", name: "user" },
                type: { kind: "referenceType", name: "IUser" },
                initializer: { kind: "literal", value: null },
              },
            ],
          },
        ],
        exports: [],
      };

      const result = emitModule(module);

      expect(result).to.include("IUser user");
    });

    it("should map generic void type arguments to object", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "Test",
        className: "Test",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "classDeclaration",
            name: "Box",
            isExported: true,
            isStruct: false,
            typeParameters: [{ kind: "typeParameter", name: "T" }],
            implements: [],
            members: [],
          },
          {
            kind: "variableDeclaration",
            declarationKind: "const",
            isExported: false,
            declarations: [
              {
                kind: "variableDeclarator",
                name: { kind: "identifierPattern", name: "box" },
                type: {
                  kind: "referenceType",
                  name: "Box",
                  typeArguments: [{ kind: "voidType" }],
                },
                initializer: { kind: "literal", value: null },
              },
            ],
          },
        ],
        exports: [],
      };

      const result = emitModule(module);
      expect(result).to.include("Box<object> box");
    });

    it("should redirect canonicalized local structural types", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/repo/test.ts",
        namespace: "Repo",
        className: "Test",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "interfaceDeclaration",
            name: "Row",
            isExported: false,
            isStruct: false,
            typeParameters: [],
            extends: [],
            members: [
              {
                kind: "propertySignature",
                name: "id",
                type: { kind: "primitiveType", name: "string" },
                isOptional: false,
                isReadonly: false,
              },
            ],
          },
          {
            kind: "variableDeclaration",
            declarationKind: "const",
            isExported: false,
            declarations: [
              {
                kind: "variableDeclarator",
                name: { kind: "identifierPattern", name: "row" },
                type: { kind: "referenceType", name: "Row" },
                initializer: { kind: "literal", value: null },
              },
            ],
          },
        ],
        exports: [],
      };

      const result = emitModule(module, {
        canonicalLocalTypeTargets: new Map([["Repo::Row", "Domain.Row"]]),
      });

      expect(result).to.include("global::Domain.Row row");
    });
  });

});
