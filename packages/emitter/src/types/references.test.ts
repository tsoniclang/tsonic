/**
 * Tests for Reference Type Emission
 *
 * Tests:
 * - bindingsRegistry lookup for CLR types
 * - C# primitive type passthrough
 * - Local type passthrough
 * - Hard failure for unresolved external types
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitCSharpFiles, emitModule } from "../emitter.js";
import { IrModule, IrType } from "@tsonic/frontend";
import type { TypeBinding as FrontendTypeBinding } from "@tsonic/frontend";

/**
 * Helper to create a minimal module with a variable declaration of a given type
 */
const createModuleWithType = (varType: IrType): IrModule => ({
  kind: "module",
  filePath: "/src/test.ts",
  namespace: "Test",
  className: "Test",
  isStaticContainer: true,
  imports: [],
  body: [
    {
      kind: "variableDeclaration",
      declarationKind: "const",
      isExported: false,
      declarations: [
        {
          kind: "variableDeclarator",
          name: { kind: "identifierPattern", name: "x" },
          type: varType,
          initializer: { kind: "literal", value: null },
        },
      ],
    },
  ],
  exports: [],
});

describe("Reference Type Emission", () => {
  describe("C# Primitive Types", () => {
    it("should emit int without qualification", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "int",
      });

      const result = emitModule(module);

      expect(result).to.include("int x");
    });

    it("should emit long without qualification", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "long",
      });

      const result = emitModule(module);

      expect(result).to.include("long x");
    });

    it("should emit double without qualification", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "double",
      });

      const result = emitModule(module);

      expect(result).to.include("double x");
    });

    it("should emit decimal without qualification", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "decimal",
      });

      const result = emitModule(module);

      expect(result).to.include("decimal x");
    });

    it("should emit bool without qualification", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "bool",
      });

      const result = emitModule(module);

      expect(result).to.include("bool x");
    });

    it("should emit nint (native int) without qualification", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "nint",
      });

      const result = emitModule(module);

      expect(result).to.include("nint x");
    });
  });

  describe("Known Builtin Types", () => {
    it("should emit Array<T> as native T[] array", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "Array",
        typeArguments: [{ kind: "primitiveType", name: "number" }],
      });

      const result = emitModule(module);

      expect(result).to.include("double[]");
      expect(result).not.to.include("List");
    });

    it("should emit Promise<T> as Task<T>", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "Promise",
        typeArguments: [{ kind: "primitiveType", name: "string" }],
      });

      const result = emitModule(module);

      expect(result).to.include("global::System.Threading.Tasks.Task<string>");
    });

    it("should fail for Error type (not supported)", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "Error",
      });

      // Error is not in globals, so it should fail as unresolved
      expect(() => emitModule(module)).to.throw(
        "ICE: Unresolved reference type 'Error'"
      );
    });
  });

  describe("Pre-resolved CLR Types", () => {
    it("should use resolvedClrType when present", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "Action",
        resolvedClrType: "global::System.Action",
      });

      const result = emitModule(module);

      expect(result).to.include("global::System.Action");
    });

    it("should use resolvedClrType with type arguments", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "Func",
        resolvedClrType: "global::System.Func",
        typeArguments: [
          { kind: "primitiveType", name: "string" },
          { kind: "primitiveType", name: "number" },
        ],
      });

      const result = emitModule(module);

      expect(result).to.include("global::System.Func<string, double>");
    });
  });

  describe("Imported Type Identity", () => {
    it("should map Foo$instance to imported Foo CLR type", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "Test",
        className: "Test",
        isStaticContainer: true,
        imports: [
          {
            kind: "import",
            source: "@jotster/core/Jotster.Core.js",
            isLocal: false,
            isClr: true,
            resolvedNamespace: "Jotster.Core",
            specifiers: [
              {
                kind: "named",
                name: "Channel",
                localName: "Channel",
                isType: true,
                resolvedClrType: "Jotster.Core.db.entities.Channel",
              },
            ],
          },
        ],
        body: [
          {
            kind: "variableDeclaration",
            declarationKind: "const",
            isExported: false,
            declarations: [
              {
                kind: "variableDeclarator",
                name: { kind: "identifierPattern", name: "x" },
                type: {
                  kind: "referenceType",
                  name: "Channel$instance",
                },
                initializer: { kind: "literal", value: null },
              },
            ],
          },
        ],
        exports: [],
      };

      const result = emitModule(module);
      expect(result).to.include("global::Jotster.Core.db.entities.Channel x");
    });

    it("should use module-bound imported type FQNs instead of module container members", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "Test",
        className: "Test",
        isStaticContainer: true,
        imports: [
          {
            kind: "import",
            source: "node:http",
            isLocal: false,
            isClr: false,
            resolvedClrType: "nodejs.Http.http",
            specifiers: [
              {
                kind: "named",
                name: "IncomingMessage",
                localName: "IncomingMessage",
                isType: true,
                resolvedClrType: "nodejs.Http.IncomingMessage",
              },
            ],
          },
        ],
        body: [
          {
            kind: "variableDeclaration",
            declarationKind: "const",
            isExported: false,
            declarations: [
              {
                kind: "variableDeclarator",
                name: { kind: "identifierPattern", name: "req" },
                type: {
                  kind: "referenceType",
                  name: "IncomingMessage$instance",
                },
                initializer: { kind: "literal", value: null },
              },
            ],
          },
        ],
        exports: [],
      };

      const result = emitModule(module);
      expect(result).to.include("global::nodejs.Http.IncomingMessage req");
      expect(result).not.to.include("global::nodejs.Http.http.IncomingMessage");
    });
  });

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

  describe("Array Indexing", () => {
    it("should use native indexer for array indexing", () => {
      // This test creates a module with array index access
      // Should use native indexer, not JSRuntime.Array.get()
      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "Test",
        className: "test",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "functionDeclaration",
            name: "getFirst",
            isExported: true,
            isAsync: false,
            isGenerator: false,
            parameters: [
              {
                kind: "parameter",
                pattern: { kind: "identifierPattern", name: "arr" },
                type: {
                  kind: "arrayType",
                  elementType: { kind: "primitiveType", name: "number" },
                },
                isOptional: false,
                isRest: false,
                passing: "value",
              },
            ],
            returnType: { kind: "primitiveType", name: "number" },
            body: {
              kind: "blockStatement",
              statements: [
                {
                  kind: "returnStatement",
                  expression: {
                    kind: "memberAccess",
                    object: {
                      kind: "identifier",
                      name: "arr",
                      inferredType: {
                        kind: "arrayType",
                        elementType: { kind: "primitiveType", name: "number" },
                      },
                    },
                    property: {
                      kind: "literal",
                      value: 0,
                      // Proof marker: int literal
                      inferredType: {
                        kind: "primitiveType",
                        name: "int",
                      },
                    },
                    isComputed: true,
                    isOptional: false,
                    accessKind: "clrIndexer",
                  },
                },
              ],
            },
          },
        ],
        exports: [],
      };

      const result = emitModule(module);

      // Output should NOT contain JSRuntime
      expect(result).to.not.include("Tsonic.JSRuntime");
      // Should use native indexer (no cast needed with proof marker)
      expect(result).to.include("arr[0]");
    });
  });

  describe("Cross-module local type resolution", () => {
    it("should qualify imported interface references from another module", () => {
      const apiModule: IrModule = {
        kind: "module",
        filePath: "/src/model/api.ts",
        namespace: "Test.Model",
        className: "api",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "interfaceDeclaration",
            name: "MetricsRow",
            isExported: true,
            isStruct: false,
            typeParameters: [],
            extends: [],
            members: [
              {
                kind: "propertySignature",
                name: "count",
                type: { kind: "referenceType", name: "int" },
                isOptional: false,
                isReadonly: false,
              },
            ],
          },
        ],
        exports: [],
      };

      const queryModule: IrModule = {
        kind: "module",
        filePath: "/src/db/query.ts",
        namespace: "Test.Db",
        className: "query",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "variableDeclaration",
            declarationKind: "const",
            isExported: false,
            declarations: [
              {
                kind: "variableDeclarator",
                name: { kind: "identifierPattern", name: "rows" },
                type: {
                  kind: "referenceType",
                  name: "global::System.Collections.Generic.List",
                  resolvedClrType: "global::System.Collections.Generic.List",
                  typeArguments: [
                    { kind: "referenceType", name: "MetricsRow" },
                  ],
                },
                initializer: { kind: "literal", value: null },
              },
            ],
          },
        ],
        exports: [],
      };

      const result = emitCSharpFiles([apiModule, queryModule], {
        rootNamespace: "Test",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const queryCode = Array.from(result.files.entries()).find(([filePath]) =>
        filePath.endsWith("query.cs")
      )?.[1];
      expect(queryCode).to.not.equal(undefined);
      expect(queryCode).to.include(
        "global::System.Collections.Generic.List<global::Test.Model.MetricsRow> rows"
      );
    });
  });
});
