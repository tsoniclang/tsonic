/**
 * Tests for Type Aliases
 * Covers spec/16-types-and-interfaces.md §3 - Type Aliases
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "../emitter.js";
import { IrModule } from "@tsonic/frontend";

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
          isStruct: false,
          isExported: true,
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include("public sealed class Point__Alias");
    expect(result).to.include("public required double x { get; set; }");
    expect(result).to.include("public required double y { get; set; }");
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
          isStruct: false,
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
          isStruct: false,
          isExported: true,
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include("public sealed class Node__Alias");
    expect(result).to.include("public required string name { get; set; }");
    // Self-reference should use __Alias suffix and be nullable (optional)
    expect(result).to.include("public Node__Alias? next { get; set; }");
  });

  it("should emit __Alias suffix when alias is referenced from another alias", () => {
    // Test case: type A = { name: string }; type B = { item: A }
    // B's item property should reference A__Alias, not A
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
          name: "PersonData",
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
            ],
          },
          isStruct: false,
          isExported: true,
        },
        {
          kind: "typeAliasDeclaration",
          name: "Container",
          typeParameters: undefined,
          type: {
            kind: "objectType",
            members: [
              {
                kind: "propertySignature",
                name: "item",
                type: {
                  kind: "referenceType",
                  name: "PersonData",
                  typeArguments: [],
                },
                isOptional: false,
                isReadonly: false,
              },
              {
                kind: "propertySignature",
                name: "items",
                type: {
                  kind: "referenceType",
                  name: "Array",
                  typeArguments: [
                    {
                      kind: "referenceType",
                      name: "PersonData",
                      typeArguments: [],
                    },
                  ],
                },
                isOptional: false,
                isReadonly: false,
              },
            ],
          },
          isStruct: false,
          isExported: true,
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    // PersonData should be emitted with __Alias suffix
    expect(result).to.include("public sealed class PersonData__Alias");
    // Container should be emitted with __Alias suffix
    expect(result).to.include("public sealed class Container__Alias");
    // Reference to PersonData inside Container should use __Alias suffix
    expect(result).to.include(
      "public required PersonData__Alias item { get; set; }"
    );
    // Array of PersonData should also use __Alias suffix
    expect(result).to.include(
      "public required global::System.Collections.Generic.List<PersonData__Alias> items { get; set; }"
    );
  });
});
