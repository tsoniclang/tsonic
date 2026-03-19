/**
 * Tests for union type emission
 * Verifies TypeScript unions map to C# Union<T1, T2>
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "../../emitter.js";
import { IrModule, IrType } from "@tsonic/frontend";

describe("Union Type Emission", () => {
  it("should emit eight-type union as Union<T1, T2, T3, T4, T5, T6, T7, T8>", () => {
    // Helper to create an interface declaration
    const makeInterface = (name: string) => ({
      kind: "interfaceDeclaration" as const,
      name,
      isExported: false,
      isStruct: false,
      typeParameters: [],
      extends: [],
      members: [],
    });

    const module: IrModule = {
      kind: "module",
      filePath: "/test/union8.ts",
      namespace: "Test",
      className: "union8",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        // Declare local types for the union
        makeInterface("User"),
        makeInterface("Product"),
        makeInterface("Order"),
        makeInterface("Payment"),
        makeInterface("Invoice"),
        {
          kind: "variableDeclaration",
          declarationKind: "const",
          isExported: false,
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "value" },
              type: {
                kind: "unionType",
                types: [
                  { kind: "primitiveType", name: "string" },
                  { kind: "primitiveType", name: "number" },
                  { kind: "primitiveType", name: "boolean" },
                  { kind: "referenceType", name: "User", typeArguments: [] },
                  { kind: "referenceType", name: "Product", typeArguments: [] },
                  { kind: "referenceType", name: "Order", typeArguments: [] },
                  { kind: "referenceType", name: "Payment", typeArguments: [] },
                  { kind: "referenceType", name: "Invoice", typeArguments: [] },
                ],
              },
              initializer: { kind: "literal", value: "hello" },
            },
          ],
        },
      ],
    };

    const code = emitModule(module);

    // Should use Union<T1, T2, T3, T4, T5, T6, T7, T8> with global:: FQN
    expect(code).to.include(
      "global::Tsonic.Runtime.Union<bool, double, string, Invoice, Order, Payment, Product, User> value"
    );
  });

  it("should fall back to object for unions with more than 8 types", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/union9.ts",
      namespace: "Test",
      className: "union9",
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
              type: {
                kind: "unionType",
                types: [
                  { kind: "primitiveType", name: "string" },
                  { kind: "primitiveType", name: "number" },
                  { kind: "primitiveType", name: "boolean" },
                  { kind: "referenceType", name: "T1", typeArguments: [] },
                  { kind: "referenceType", name: "T2", typeArguments: [] },
                  { kind: "referenceType", name: "T3", typeArguments: [] },
                  { kind: "referenceType", name: "T4", typeArguments: [] },
                  { kind: "referenceType", name: "T5", typeArguments: [] },
                  { kind: "referenceType", name: "T6", typeArguments: [] },
                ],
              },
              initializer: { kind: "literal", value: "hello" },
            },
          ],
        },
      ],
    };

    const code = emitModule(module);

    // Should fall back to object for 9+ types
    expect(code).to.include("object value");
  });

  it("falls back to object at recursive union re-entry boundaries", () => {
    const routerType = {
      kind: "referenceType",
      name: "Router",
      resolvedClrType: "global::System.Object",
      structuralMembers: [],
    } as unknown as Extract<IrType, { kind: "referenceType" }> & {
      structuralMembers: unknown[];
    };

    const middlewareLike = {
      kind: "unionType",
      types: [],
    } as unknown as Extract<IrType, { kind: "unionType" }> & {
      types: IrType[];
    };

    middlewareLike.types.push(routerType, {
      kind: "arrayType",
      elementType: middlewareLike,
    });

    routerType.structuralMembers = [
      {
        kind: "methodSignature",
        name: "use",
        parameters: [
          {
            kind: "parameter",
            pattern: { kind: "identifierPattern", name: "handlers" },
            type: middlewareLike,
            initializer: undefined,
            isOptional: false,
            isRest: true,
            passing: "value",
          },
        ],
        returnType: routerType,
      },
    ];

    const module: IrModule = {
      kind: "module",
      filePath: "/test/recursiveUnion.ts",
      namespace: "Test",
      className: "recursiveUnion",
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
              name: { kind: "identifierPattern", name: "handlers" },
              type: middlewareLike,
              initializer: { kind: "literal", value: null },
            },
          ],
        },
      ],
    };

    const code = emitModule(module);
    expect(code).to.include("object handlers");
  });

  it("collapses unions that already contain object to plain object", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/objectUnion.ts",
      namespace: "Test",
      className: "objectUnion",
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
              type: {
                kind: "unionType",
                types: [
                  { kind: "referenceType", name: "object" },
                  { kind: "primitiveType", name: "string" },
                  {
                    kind: "referenceType",
                    name: "RegExp",
                    resolvedClrType: "System.Text.RegularExpressions.Regex",
                  },
                ],
              },
              initializer: { kind: "literal", value: null },
            },
          ],
        },
      ],
    };

    const code = emitModule(module);
    expect(code).to.include("object value");
    expect(code).to.not.include("global::Tsonic.Runtime.Union");
  });
});
