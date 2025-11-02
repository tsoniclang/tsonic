/**
 * Comprehensive tests for Generics and Interfaces
 * Covers spec/15-generics.md and spec/16-types-and-interfaces.md
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "./emitter.js";
import { IrModule } from "@tsonic/frontend";

describe("Generics Implementation", () => {
  describe("Generic Functions (spec/15 §3-5)", () => {
    it("should emit generic function with single type parameter", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/utils.ts",
        namespace: "MyApp",
        className: "utils",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "functionDeclaration",
            name: "identity",
            typeParameters: [
              {
                kind: "typeParameter",
                name: "T",
                constraint: undefined,
                default: undefined,
                variance: undefined,
                isStructuralConstraint: false,
              },
            ],
            parameters: [
              {
                kind: "parameter",
                pattern: { kind: "identifierPattern", name: "value" },
                type: { kind: "referenceType", name: "T", typeArguments: [] },
                isOptional: false,
                isRest: false,
              },
            ],
            returnType: { kind: "referenceType", name: "T", typeArguments: [] },
            body: {
              kind: "blockStatement",
              statements: [
                {
                  kind: "returnStatement",
                  expression: { kind: "identifier", name: "value" },
                },
              ],
            },
            isExported: true,
            isAsync: false,
            isGenerator: false,
          },
        ],
        exports: [],
      };

      const result = emitModule(module);

      expect(result).to.include("public static T identity<T>(T value)");
      expect(result).to.include("return value");
    });

    it("should emit generic function with multiple type parameters", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/utils.ts",
        namespace: "MyApp",
        className: "utils",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "functionDeclaration",
            name: "pair",
            typeParameters: [
              {
                kind: "typeParameter",
                name: "T",
                constraint: undefined,
                default: undefined,
                variance: undefined,
                isStructuralConstraint: false,
              },
              {
                kind: "typeParameter",
                name: "U",
                constraint: undefined,
                default: undefined,
                variance: undefined,
                isStructuralConstraint: false,
              },
            ],
            parameters: [
              {
                kind: "parameter",
                pattern: { kind: "identifierPattern", name: "first" },
                type: { kind: "referenceType", name: "T", typeArguments: [] },
                isOptional: false,
                isRest: false,
              },
              {
                kind: "parameter",
                pattern: { kind: "identifierPattern", name: "second" },
                type: { kind: "referenceType", name: "U", typeArguments: [] },
                isOptional: false,
                isRest: false,
              },
            ],
            returnType: {
              kind: "arrayType",
              elementType: {
                kind: "unionType",
                types: [
                  { kind: "referenceType", name: "T", typeArguments: [] },
                  { kind: "referenceType", name: "U", typeArguments: [] },
                ],
              },
            },
            body: {
              kind: "blockStatement",
              statements: [],
            },
            isExported: true,
            isAsync: false,
            isGenerator: false,
          },
        ],
        exports: [],
      };

      const result = emitModule(module);

      expect(result).to.include("<T, U>");
      expect(result).to.include("pair");
      expect(result).to.include("T first");
      expect(result).to.include("U second");
    });

    it("should emit generic function with nominal constraint", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/utils.ts",
        namespace: "MyApp",
        className: "utils",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "functionDeclaration",
            name: "process",
            typeParameters: [
              {
                kind: "typeParameter",
                name: "T",
                constraint: {
                  kind: "referenceType",
                  name: "Comparable",
                  typeArguments: [],
                },
                default: undefined,
                variance: undefined,
                isStructuralConstraint: false,
              },
            ],
            parameters: [
              {
                kind: "parameter",
                pattern: { kind: "identifierPattern", name: "item" },
                type: { kind: "referenceType", name: "T", typeArguments: [] },
                isOptional: false,
                isRest: false,
              },
            ],
            returnType: { kind: "voidType" },
            body: {
              kind: "blockStatement",
              statements: [],
            },
            isExported: true,
            isAsync: false,
            isGenerator: false,
          },
        ],
        exports: [],
      };

      const result = emitModule(module);

      expect(result).to.include("<T>");
      expect(result).to.include("where T : Comparable");
    });

    it("should emit generic function with structural constraint and adapter", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/utils.ts",
        namespace: "MyApp",
        className: "utils",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "functionDeclaration",
            name: "getId",
            typeParameters: [
              {
                kind: "typeParameter",
                name: "T",
                constraint: {
                  kind: "objectType",
                  members: [
                    {
                      kind: "propertySignature",
                      name: "id",
                      type: { kind: "primitiveType", name: "number" },
                      isOptional: false,
                      isReadonly: false,
                    },
                  ],
                },
                default: undefined,
                variance: undefined,
                isStructuralConstraint: true,
                structuralMembers: [
                  {
                    kind: "propertySignature",
                    name: "id",
                    type: { kind: "primitiveType", name: "number" },
                    isOptional: false,
                    isReadonly: false,
                  },
                ],
              },
            ],
            parameters: [
              {
                kind: "parameter",
                pattern: { kind: "identifierPattern", name: "obj" },
                type: { kind: "referenceType", name: "T", typeArguments: [] },
                isOptional: false,
                isRest: false,
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
                    object: { kind: "identifier", name: "obj" },
                    property: "id",
                    isComputed: false,
                    isOptional: false,
                  },
                },
              ],
            },
            isExported: true,
            isAsync: false,
            isGenerator: false,
          },
        ],
        exports: [],
      };

      const result = emitModule(module);

      // Should generate adapter interface
      expect(result).to.include("public interface __Constraint_T");
      expect(result).to.include("double id { get; }");

      // Should generate adapter wrapper class
      expect(result).to.include(
        "public sealed class __Wrapper_T : __Constraint_T"
      );
      expect(result).to.include("public double id { get; set; }");

      // Function should reference the constraint
      expect(result).to.include("where T : __Constraint_T");
    });
  });

  describe("Generic Classes (spec/15 §3-5)", () => {
    it("should emit generic class with type parameter", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/Box.ts",
        namespace: "MyApp",
        className: "Box",
        isStaticContainer: false,
        imports: [],
        body: [
          {
            kind: "classDeclaration",
            name: "Box",
            typeParameters: [
              {
                kind: "typeParameter",
                name: "T",
                constraint: undefined,
                default: undefined,
                variance: undefined,
                isStructuralConstraint: false,
              },
            ],
            members: [
              {
                kind: "propertyDeclaration",
                name: "value",
                type: { kind: "referenceType", name: "T", typeArguments: [] },
                initializer: undefined,
                accessibility: "public",
                isStatic: false,
                isReadonly: false,
              },
            ],
            superClass: undefined,
            implements: [],
            isExported: true,
          },
        ],
        exports: [],
      };

      const result = emitModule(module);

      expect(result).to.include("public class Box<T>");
      expect(result).to.include("public T value");
    });
  });

  describe("Interfaces (spec/16 §2)", () => {
    it("should emit interface as C# class with auto-properties", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/User.ts",
        namespace: "MyApp",
        className: "User",
        isStaticContainer: false,
        imports: [],
        body: [
          {
            kind: "interfaceDeclaration",
            name: "User",
            typeParameters: undefined,
            extends: [],
            members: [
              {
                kind: "propertySignature",
                name: "id",
                type: { kind: "primitiveType", name: "number" },
                isOptional: false,
                isReadonly: false,
              },
              {
                kind: "propertySignature",
                name: "name",
                type: { kind: "primitiveType", name: "string" },
                isOptional: false,
                isReadonly: false,
              },
              {
                kind: "propertySignature",
                name: "active",
                type: { kind: "primitiveType", name: "boolean" },
                isOptional: true,
                isReadonly: false,
              },
            ],
            isExported: true,
          },
        ],
        exports: [],
      };

      const result = emitModule(module);

      // Should emit as C# class, not interface
      expect(result).to.include("public class User");
      expect(result).not.to.include("interface User");

      // Should have auto-properties
      expect(result).to.include("public double id { get; set; }");
      expect(result).to.include("public string name { get; set; }");

      // Optional property should be nullable
      expect(result).to.include("public bool? active { get; set; }");
    });

    it("should emit interface with readonly members", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/Config.ts",
        namespace: "MyApp",
        className: "Config",
        isStaticContainer: false,
        imports: [],
        body: [
          {
            kind: "interfaceDeclaration",
            name: "Config",
            typeParameters: undefined,
            extends: [],
            members: [
              {
                kind: "propertySignature",
                name: "apiUrl",
                type: { kind: "primitiveType", name: "string" },
                isOptional: false,
                isReadonly: true,
              },
            ],
            isExported: true,
          },
        ],
        exports: [],
      };

      const result = emitModule(module);

      // Readonly should use private set
      expect(result).to.include("public string apiUrl { get; }");
    });

    it("should emit generic interface", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/Result.ts",
        namespace: "MyApp",
        className: "Result",
        isStaticContainer: true, // Changed to true to emit at top level
        imports: [],
        body: [
          {
            kind: "interfaceDeclaration",
            name: "Result",
            typeParameters: [
              {
                kind: "typeParameter",
                name: "T",
                constraint: undefined,
                default: undefined,
                variance: undefined,
                isStructuralConstraint: false,
              },
            ],
            extends: [],
            members: [
              {
                kind: "propertySignature",
                name: "data",
                type: { kind: "referenceType", name: "T", typeArguments: [] },
                isOptional: false,
                isReadonly: false,
              },
            ],
            isExported: true,
          },
        ],
        exports: [],
      };

      const result = emitModule(module);

      // Allow for whitespace variations
      expect(result).to.match(/public\s+class\s+Result\s*<T>/);
      expect(result).to.include("public T data { get; set; }");
    });
  });

  describe("Type Aliases (spec/16 §3)", () => {
    it("should emit structural type alias as sealed class with __Alias suffix", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/types.ts",
        namespace: "MyApp",
        className: "types",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "typeAliasDeclaration",
            name: "Point",
            typeParameters: undefined,
            type: {
              kind: "objectType",
              members: [
                {
                  kind: "propertySignature",
                  name: "x",
                  type: { kind: "primitiveType", name: "number" },
                  isOptional: false,
                  isReadonly: false,
                },
                {
                  kind: "propertySignature",
                  name: "y",
                  type: { kind: "primitiveType", name: "number" },
                  isOptional: false,
                  isReadonly: false,
                },
              ],
            },
            isExported: true,
          },
        ],
        exports: [],
      };

      const result = emitModule(module);

      expect(result).to.include("public sealed class Point__Alias");
      expect(result).to.include("public double x { get; set; }");
      expect(result).to.include("public double y { get; set; }");
    });

    it("should emit non-structural type alias as comment", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/types.ts",
        namespace: "MyApp",
        className: "types",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "typeAliasDeclaration",
            name: "ID",
            typeParameters: undefined,
            type: { kind: "primitiveType", name: "number" },
            isExported: true,
          },
        ],
        exports: [],
      };

      const result = emitModule(module);

      expect(result).to.include("// type ID = double");
    });

    it("should emit recursive type alias with self-reference", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/types.ts",
        namespace: "MyApp",
        className: "types",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "typeAliasDeclaration",
            name: "Node",
            typeParameters: undefined,
            type: {
              kind: "objectType",
              members: [
                {
                  kind: "propertySignature",
                  name: "name",
                  type: { kind: "primitiveType", name: "string" },
                  isOptional: false,
                  isReadonly: false,
                },
                {
                  kind: "propertySignature",
                  name: "next",
                  type: {
                    kind: "referenceType",
                    name: "Node",
                    typeArguments: [],
                  },
                  isOptional: true,
                  isReadonly: false,
                },
              ],
            },
            isExported: true,
          },
        ],
        exports: [],
      };

      const result = emitModule(module);

      expect(result).to.include("public sealed class Node__Alias");
      expect(result).to.include("public string name { get; set; } = default!;");
      // Self-reference should be nullable
      expect(result).to.include("public Node? next { get; set; } = default!;");
    });
  });

  describe("Call-Site Rewriting (spec/15 §5)", () => {
    it("should emit call with explicit type arguments", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/main.ts",
        namespace: "MyApp",
        className: "main",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "functionDeclaration",
            name: "test",
            parameters: [],
            returnType: { kind: "voidType" },
            body: {
              kind: "blockStatement",
              statements: [
                {
                  kind: "expressionStatement",
                  expression: {
                    kind: "call",
                    callee: { kind: "identifier", name: "identity" },
                    arguments: [{ kind: "literal", value: "hello" }],
                    isOptional: false,
                    typeArguments: [{ kind: "primitiveType", name: "string" }],
                    requiresSpecialization: false,
                  },
                },
              ],
            },
            isExported: false,
            isAsync: false,
            isGenerator: false,
          },
        ],
        exports: [],
      };

      const result = emitModule(module);

      expect(result).to.include("identity<string>(");
    });

    it("should emit specialized call when requiresSpecialization is true", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/main.ts",
        namespace: "MyApp",
        className: "main",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "functionDeclaration",
            name: "test",
            parameters: [],
            returnType: { kind: "voidType" },
            body: {
              kind: "blockStatement",
              statements: [
                {
                  kind: "expressionStatement",
                  expression: {
                    kind: "call",
                    callee: { kind: "identifier", name: "process" },
                    arguments: [{ kind: "literal", value: "data" }],
                    isOptional: false,
                    typeArguments: [{ kind: "primitiveType", name: "string" }],
                    requiresSpecialization: true,
                  },
                },
              ],
            },
            isExported: false,
            isAsync: false,
            isGenerator: false,
          },
        ],
        exports: [],
      };

      const result = emitModule(module);

      // Should generate specialized name
      expect(result).to.include("process__string(");
      expect(result).not.to.include("process<string>(");
    });
  });
});
