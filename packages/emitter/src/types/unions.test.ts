/**
 * Tests for union type emission
 * Verifies TypeScript unions map to C# Union<T1, T2>
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "./emitter.js";
import { IrModule } from "@tsonic/frontend";

describe("Union Type Emission", () => {
  it("should emit nullable type as T?", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/nullable.ts",
      namespace: "Test",
      className: "nullable",
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
              name: { kind: "identifierPattern", name: "maybeString" },
              type: {
                kind: "unionType",
                types: [
                  { kind: "primitiveType", name: "string" },
                  { kind: "primitiveType", name: "null" },
                ],
              },
              initializer: { kind: "literal", value: null },
            },
          ],
        },
      ],
    };

    const code = emitModule(module);

    // Should use nullable syntax
    expect(code).to.include("string? maybeString");
  });

  it("should emit two-type union as Union<T1, T2>", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/union.ts",
      namespace: "Test",
      className: "union",
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
                ],
              },
              initializer: { kind: "literal", value: "hello" },
            },
          ],
        },
      ],
    };

    const code = emitModule(module);

    // Should use Union<T1, T2>
    expect(code).to.include("Union<string, double> value");
    expect(code).to.include("using Tsonic.Runtime");
  });

  it("should emit function returning union type", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/unionFunc.ts",
      namespace: "Test",
      className: "unionFunc",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "getValue",
          parameters: [],
          returnType: {
            kind: "unionType",
            types: [
              { kind: "primitiveType", name: "string" },
              { kind: "primitiveType", name: "number" },
            ],
          },
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

    // Should return Union<string, double>
    expect(code).to.include("public static Union<string, double> getValue()");
  });

  it("should emit function parameter with union type", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/unionParam.ts",
      namespace: "Test",
      className: "unionParam",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "process",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "input" },
              type: {
                kind: "unionType",
                types: [
                  { kind: "primitiveType", name: "string" },
                  { kind: "primitiveType", name: "boolean" },
                ],
              },
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
          isAsync: false,
          isGenerator: false,
          isExported: true,
        },
      ],
    };

    const code = emitModule(module);

    // Should accept Union<string, bool> parameter
    expect(code).to.include("process(Union<string, bool> input)");
  });

  it("should handle union with custom types", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/customUnion.ts",
      namespace: "Test",
      className: "customUnion",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "getResult",
          parameters: [],
          returnType: {
            kind: "unionType",
            types: [
              { kind: "referenceType", name: "User", typeArguments: [] },
              { kind: "referenceType", name: "Product", typeArguments: [] },
            ],
          },
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

    // Should use Union<User, Product>
    expect(code).to.include("Union<User, Product> getResult()");
  });

  it("should emit three-type union as Union<T1, T2, T3>", () => {
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
              type: {
                kind: "unionType",
                types: [
                  { kind: "primitiveType", name: "string" },
                  { kind: "primitiveType", name: "number" },
                  { kind: "primitiveType", name: "boolean" },
                ],
              },
              initializer: { kind: "literal", value: "hello" },
            },
          ],
        },
      ],
    };

    const code = emitModule(module);

    // Should use Union<T1, T2, T3>
    expect(code).to.include("Union<string, double, bool> value");
    expect(code).to.include("using Tsonic.Runtime");
  });

  it("should emit four-type union as Union<T1, T2, T3, T4>", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/union4.ts",
      namespace: "Test",
      className: "union4",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "process",
          parameters: [],
          returnType: {
            kind: "unionType",
            types: [
              { kind: "primitiveType", name: "string" },
              { kind: "primitiveType", name: "number" },
              { kind: "primitiveType", name: "boolean" },
              { kind: "referenceType", name: "Date", typeArguments: [] },
            ],
          },
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

    // Should use Union<T1, T2, T3, T4>
    expect(code).to.include("Union<string, double, bool, Date> process()");
  });

  it("should emit eight-type union as Union<T1, T2, T3, T4, T5, T6, T7, T8>", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/union8.ts",
      namespace: "Test",
      className: "union8",
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

    // Should use Union<T1, T2, T3, T4, T5, T6, T7, T8>
    expect(code).to.include(
      "Union<string, double, bool, User, Product, Order, Payment, Invoice> value"
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
});
