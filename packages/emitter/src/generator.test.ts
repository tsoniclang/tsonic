/**
 * Tests for generator emission
 * Per spec/13-generators.md
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "./emitter.js";
import { IrModule } from "@tsonic/frontend";

describe("Generator Emission", () => {
  it("should generate exchange class for simple generator", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/counter.ts",
      namespace: "Test",
      className: "counter",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "counter",
          parameters: [],
          returnType: {
            kind: "referenceType",
            name: "Generator",
            typeArguments: [
              { kind: "primitiveType", name: "number" },
              { kind: "primitiveType", name: "undefined" },
              { kind: "primitiveType", name: "undefined" },
            ],
          },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "variableDeclaration",
                declarationKind: "let",
                isExported: false,
                declarations: [
                  {
                    kind: "variableDeclarator",
                    name: { kind: "identifierPattern", name: "i" },
                    type: { kind: "primitiveType", name: "number" },
                    initializer: { kind: "literal", value: 0 },
                  },
                ],
              },
              {
                kind: "whileStatement",
                condition: { kind: "literal", value: true },
                body: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "expressionStatement",
                      expression: {
                        kind: "yield",
                        expression: { kind: "identifier", name: "i" },
                        delegate: false,
                      },
                    },
                    {
                      kind: "expressionStatement",
                      expression: {
                        kind: "assignment",
                        operator: "+=",
                        left: { kind: "identifier", name: "i" },
                        right: { kind: "literal", value: 1 },
                      },
                    },
                  ],
                },
              },
            ],
          },
          isAsync: false,
          isGenerator: true,
          isExported: true,
        },
      ],
    };

    const code = emitModule(module);

    // Should contain exchange class
    expect(code).to.include("public sealed class counter_exchange");
    expect(code).to.include("public object? Input { get; set; }");
    expect(code).to.include("public double Output { get; set; }");

    // Should have IEnumerable return type
    expect(code).to.include("public static IEnumerable<counter_exchange> counter()");

    // Should use System.Collections.Generic
    expect(code).to.include("using System.Collections.Generic");

    // Should initialize exchange variable
    expect(code).to.include("var exchange = new counter_exchange()");

    // Should emit yield with exchange object pattern
    expect(code).to.include("exchange.Output = i");
    expect(code).to.include("yield return exchange");
  });

  it("should handle async generator", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/asyncCounter.ts",
      namespace: "Test",
      className: "asyncCounter",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "asyncCounter",
          parameters: [],
          returnType: {
            kind: "referenceType",
            name: "AsyncGenerator",
            typeArguments: [
              { kind: "primitiveType", name: "number" },
              { kind: "primitiveType", name: "undefined" },
              { kind: "primitiveType", name: "undefined" },
            ],
          },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "variableDeclaration",
                declarationKind: "let",
                isExported: false,
                declarations: [
                  {
                    kind: "variableDeclarator",
                    name: { kind: "identifierPattern", name: "i" },
                    type: { kind: "primitiveType", name: "number" },
                    initializer: { kind: "literal", value: 0 },
                  },
                ],
              },
              {
                kind: "whileStatement",
                condition: { kind: "literal", value: true },
                body: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "expressionStatement",
                      expression: {
                        kind: "yield",
                        expression: { kind: "identifier", name: "i" },
                        delegate: false,
                      },
                    },
                    {
                      kind: "expressionStatement",
                      expression: {
                        kind: "assignment",
                        operator: "+=",
                        left: { kind: "identifier", name: "i" },
                        right: { kind: "literal", value: 1 },
                      },
                    },
                  ],
                },
              },
            ],
          },
          isAsync: true,
          isGenerator: true,
          isExported: true,
        },
      ],
    };

    const code = emitModule(module);

    // Should contain exchange class
    expect(code).to.include("public sealed class asyncCounter_exchange");

    // Should have IAsyncEnumerable return type with async
    expect(code).to.include(
      "public static async IAsyncEnumerable<asyncCounter_exchange> asyncCounter()"
    );
  });
});
