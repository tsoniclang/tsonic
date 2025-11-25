/**
 * Tests for Generic Functions
 * Covers spec/15-generics.md §3-5 - Generic Functions
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "../../emitter.js";
import { IrModule } from "@tsonic/frontend";

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
              passing: "value",
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
              passing: "value",
            },
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "second" },
              type: { kind: "referenceType", name: "U", typeArguments: [] },
              isOptional: false,
              isRest: false,
              passing: "value",
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
              passing: "value",
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
