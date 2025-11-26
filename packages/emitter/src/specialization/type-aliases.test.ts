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
    expect(result).to.include("public string name { get; set; } = default!;");
    // Self-reference should be nullable
    expect(result).to.include("public Node? next { get; set; } = default!;");
  });
});
