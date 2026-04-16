/**
 * Tests for union type emission
 * Verifies TypeScript unions map to C# Union<T1, T2>
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "../../emitter.js";
import { IrModule } from "@tsonic/frontend";
import { identifierType } from "../../core/format/backend-ast/builders.js";
import { printRuntimeUnionCarrierTypeForIrType } from "../../runtime-union-cases/helpers.js";

describe("Union Type Emission", () => {
  it("should handle union with custom types", () => {
    const resultType = {
      kind: "unionType",
      types: [
        { kind: "referenceType", name: "User", typeArguments: [] },
        { kind: "referenceType", name: "Product", typeArguments: [] },
      ],
    } as const;
    const module: IrModule = {
      kind: "module",
      filePath: "/test/customUnion.ts",
      namespace: "Test",
      className: "customUnion",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        // Declare local types for the union
        {
          kind: "interfaceDeclaration",
          name: "User",
          isExported: false,
          isStruct: false,
          typeParameters: [],
          extends: [],
          members: [],
        },
        {
          kind: "interfaceDeclaration",
          name: "Product",
          isExported: false,
          isStruct: false,
          typeParameters: [],
          extends: [],
          members: [],
        },
        {
          kind: "functionDeclaration",
          name: "getResult",
          parameters: [],
          returnType: resultType,
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "returnStatement",
                expression: { kind: "identifier", name: "user" },
              },
            ],
          },
          isAsync: false,
          isGenerator: false,
          isExported: true,
        },
      ],
    };

    const code = emitModule(module);

    // Should use the canonical runtime union carrier for Product | User
    expect(code).to.include(
      `${printRuntimeUnionCarrierTypeForIrType(resultType, [
        identifierType("Product"),
        identifierType("User"),
      ])} getResult()`
    );
  });

  it("should emit three-type union as Union<T1, T2, T3>", () => {
    const valueType = {
      kind: "unionType",
      types: [
        { kind: "primitiveType", name: "string" },
        { kind: "primitiveType", name: "number" },
        { kind: "primitiveType", name: "boolean" },
      ],
    } as const;
    const module: IrModule = {
      kind: "module",
      filePath: "/test/union3.ts",
      namespace: "Test",
      className: "union3",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "variableDeclaration",
          declarationKind: "const",
          isExported: false,
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "value" },
              type: valueType,
              initializer: { kind: "literal", value: "hello" },
            },
          ],
        },
      ],
    };

    const code = emitModule(module);

    const unionType = printRuntimeUnionCarrierTypeForIrType(valueType, [
      { kind: "predefinedType", keyword: "bool" },
      { kind: "predefinedType", keyword: "double" },
      { kind: "predefinedType", keyword: "string" },
    ]);

    expect(code).to.include(`${unionType} value`);
    expect(code).to.not.include("using Tsonic.Runtime");
  });

  it("flattens nested runtime union reference members into a single runtime union surface", () => {
    const valueType = {
      kind: "unionType",
      types: [
        { kind: "primitiveType", name: "string" },
        {
          kind: "referenceType",
          name: "PathSpec",
          resolvedClrType: "global::Tsonic.Runtime.Union`2",
          typeArguments: [
            { kind: "primitiveType", name: "string" },
            {
              kind: "referenceType",
              name: "RegExp",
              resolvedClrType: "global::js.RegExp",
            },
          ],
        },
      ],
    } as const;
    const module: IrModule = {
      kind: "module",
      filePath: "/test/nestedRuntimeUnion.ts",
      namespace: "Test",
      className: "nestedRuntimeUnion",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "variableDeclaration",
          declarationKind: "const",
          isExported: false,
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "value" },
              type: valueType,
              initializer: { kind: "literal", value: "hello" },
            },
          ],
        },
      ],
    };

    const code = emitModule(module);
    const unionType = printRuntimeUnionCarrierTypeForIrType(valueType, [
      { kind: "predefinedType", keyword: "string" },
      identifierType("global::js.RegExp"),
    ]);

    expect(code).to.include(`${unionType} value`);
    expect(code).not.to.include(
      "global::Tsonic.Internal.Union<string, global::Tsonic.Internal.Union"
    );
  });

  it("wraps multi-type unions with runtime-nullish members as nullable Union", () => {
    const valueType = {
      kind: "unionType",
      types: [
        { kind: "primitiveType", name: "string" },
        { kind: "primitiveType", name: "number" },
        { kind: "primitiveType", name: "undefined" },
      ],
    } as const;
    const module: IrModule = {
      kind: "module",
      filePath: "/test/nullableUnion3.ts",
      namespace: "Test",
      className: "nullableUnion3",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "variableDeclaration",
          declarationKind: "const",
          isExported: false,
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "value" },
              type: valueType,
              initializer: { kind: "literal", value: "hello" },
            },
          ],
        },
      ],
    };

    const code = emitModule(module);

    const unionType = printRuntimeUnionCarrierTypeForIrType(valueType, [
      { kind: "predefinedType", keyword: "double" },
      { kind: "predefinedType", keyword: "string" },
    ]);

    expect(code).to.include(`${unionType}? value`);
    expect(code).not.to.include("Union<string, double,");
  });

  it("should emit four-type union as Union<T1, T2, T3, T4>", () => {
    const returnType = {
      kind: "unionType",
      types: [
        { kind: "primitiveType", name: "string" },
        { kind: "primitiveType", name: "number" },
        { kind: "primitiveType", name: "boolean" },
        { kind: "referenceType", name: "DateLike", typeArguments: [] },
      ],
    } as const;
    const module: IrModule = {
      kind: "module",
      filePath: "/test/union4.ts",
      namespace: "Test",
      className: "union4",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        // Declare local type for the union (Date is not in globals)
        {
          kind: "interfaceDeclaration",
          name: "DateLike",
          isExported: false,
          isStruct: false,
          typeParameters: [],
          extends: [],
          members: [],
        },
        {
          kind: "functionDeclaration",
          name: "process",
          parameters: [],
          returnType,
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "returnStatement",
                expression: { kind: "literal", value: "hello" },
              },
            ],
          },
          isAsync: false,
          isGenerator: false,
          isExported: true,
        },
      ],
    };

    const code = emitModule(module);

    const unionType = printRuntimeUnionCarrierTypeForIrType(returnType, [
      { kind: "predefinedType", keyword: "bool" },
      { kind: "predefinedType", keyword: "double" },
      { kind: "predefinedType", keyword: "string" },
      identifierType("DateLike"),
    ]);

    expect(code).to.include(`${unionType} process()`);
  });
});
