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
import { emitModule } from "../emitter.js";
import { IrModule, IrType } from "@tsonic/frontend";

/**
 * Helper to create a minimal module with a variable declaration of a given type
 */
const createModuleWithType = (varType: IrType): IrModule => ({
  kind: "module",
  filePath: "/src/test.ts",
  namespace: "Test",
  className: "test",
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
    it("should emit Array<T> as List<T>", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "Array",
        typeArguments: [{ kind: "primitiveType", name: "number" }],
      });

      const result = emitModule(module);

      expect(result).to.include(
        "global::System.Collections.Generic.List<double>"
      );
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

    it("should emit Error as System.Exception in js mode (default)", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "Error",
      });

      // Default runtime is "js"
      const result = emitModule(module);

      expect(result).to.include("global::System.Exception");
    });

    it("should emit Error as System.Exception in js mode (explicit)", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "Error",
      });

      const result = emitModule(module, { runtime: "js" });

      expect(result).to.include("global::System.Exception");
    });

    it("should fail for Error in dotnet mode (not in base globals)", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "Error",
      });

      // Error is not in base globals, so it should fail as unresolved
      expect(() => emitModule(module, { runtime: "dotnet" })).to.throw(
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

  describe("Local Types", () => {
    it("should emit local class types without qualification", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "Test",
        className: "test",
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
        className: "test",
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
  });

  describe("Runtime Mode Guards", () => {
    it("should NOT emit JSRuntime in dotnet mode for array indexing", () => {
      // This test creates a module with array index access
      // In dotnet mode, it should use native indexer, not JSRuntime.Array.get()
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
                      // Proof marker: Int32 literal
                      inferredType: {
                        kind: "primitiveType",
                        name: "number",
                        numericIntent: "Int32",
                      },
                    },
                    isComputed: true,
                    isOptional: false,
                  },
                },
              ],
            },
          },
        ],
        exports: [],
      };

      const result = emitModule(module, { runtime: "dotnet" });

      // In dotnet mode, output should NOT contain JSRuntime
      expect(result).to.not.include("Tsonic.JSRuntime");
      // Should use native indexer (no cast needed with proof marker)
      expect(result).to.include("arr[0]");
    });

    it("should emit JSRuntime in js mode for array indexing", () => {
      // Same module as above but in js mode
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
                      // Proof marker: Int32 literal
                      inferredType: {
                        kind: "primitiveType",
                        name: "number",
                        numericIntent: "Int32",
                      },
                    },
                    isComputed: true,
                    isOptional: false,
                  },
                },
              ],
            },
          },
        ],
        exports: [],
      };

      const result = emitModule(module, { runtime: "js" });

      // In js mode, output should use JSRuntime.Array.get()
      expect(result).to.include("global::Tsonic.JSRuntime.Array.get");
    });
  });
});
