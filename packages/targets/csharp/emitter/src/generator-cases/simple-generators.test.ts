/**
 * Tests for generator emission
 * Per spec/13-generators.md
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "../emitter.js";
import { IrModule } from "@tsonic/frontend";

describe("Generator Emission", () => {
  it("lowers simple generators directly to IEnumerable<TYield>", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/counter.ts",
      namespace: "Test",
      className: "Counter",
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

    // Should have IEnumerable return type with fully-qualified name
    expect(code).to.include(
      "public static global::System.Collections.Generic.IEnumerable<double> counter()"
    );

    // Should NOT use using directives - all types use global:: FQN
    expect(code).to.not.include("using System.Collections.Generic");

    // Should not allocate exchange/wrapper helpers for unidirectional generators
    expect(code).to.not.include("counter_exchange");
    expect(code).to.not.include("counter_Generator");

    // Should emit direct yield values
    expect(code).to.include("yield return i;");
  });

  it("lowers async generators directly to IAsyncEnumerable<TYield>", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/asyncCounter.ts",
      namespace: "Test",
      className: "AsyncCounter",
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

    // Should have IAsyncEnumerable return type with async and global:: FQN
    expect(code).to.include(
      "public static async global::System.Collections.Generic.IAsyncEnumerable<double> asyncCounter()"
    );
    expect(code).to.not.include("asyncCounter_exchange");
    expect(code).to.not.include("asyncCounter_Generator");
    expect(code).to.include("yield return i;");
  });

  it("does not synthesize exchange helpers for async generators with void next channels", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/ticks.ts",
      namespace: "Test",
      className: "Ticks",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "ticks",
          parameters: [],
          returnType: {
            kind: "referenceType",
            name: "AsyncGenerator",
            typeArguments: [
              {
                kind: "unionType",
                types: [
                  { kind: "referenceType", name: "JsValue" },
                  { kind: "primitiveType", name: "undefined" },
                ],
              },
              { kind: "voidType" },
              { kind: "voidType" },
            ],
          },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "expressionStatement",
                expression: {
                  kind: "yield",
                  expression: { kind: "literal", value: null },
                  delegate: false,
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

    expect(code).to.not.include("ticks_exchange");
    expect(code).to.not.include("ticks_Generator");
    expect(code).to.not.include("void? Input");
  });
});
