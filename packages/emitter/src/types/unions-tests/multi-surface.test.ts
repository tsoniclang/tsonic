/**
 * Tests for union type emission
 * Verifies TypeScript unions map to C# Union<T1, T2>
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "../../emitter.js";
import { IrModule } from "@tsonic/frontend";

describe("Union Type Emission", () => {
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
    expect(code).to.include("Union<Product, User> getResult()");
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

    // Should use fully-qualified Union<T1, T2, T3>
    expect(code).to.include(
      "global::Tsonic.Runtime.Union<bool, double, string> value"
    );
    // Should NOT include using directives - uses global:: FQN
    expect(code).to.not.include("using Tsonic.Runtime");
  });

  it("flattens nested runtime union reference members into a single runtime union surface", () => {
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
              type: {
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
                        resolvedClrType: "global::Tsonic.JSRuntime.RegExp",
                      },
                    ],
                  },
                ],
              },
              initializer: { kind: "literal", value: "hello" },
            },
          ],
        },
      ],
    };

    const code = emitModule(module);

    expect(code).to.include(
      "global::Tsonic.Runtime.Union<string, global::Tsonic.JSRuntime.RegExp> value"
    );
    expect(code).not.to.include(
      "global::Tsonic.Runtime.Union<string, global::Tsonic.Runtime.Union"
    );
  });

  it("wraps multi-type unions with runtime-nullish members as nullable Union", () => {
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
              type: {
                kind: "unionType",
                types: [
                  { kind: "primitiveType", name: "string" },
                  { kind: "primitiveType", name: "number" },
                  { kind: "primitiveType", name: "undefined" },
                ],
              },
              initializer: { kind: "literal", value: "hello" },
            },
          ],
        },
      ],
    };

    const code = emitModule(module);

    expect(code).to.include(
      "global::Tsonic.Runtime.Union<double, string>? value"
    );
    expect(code).not.to.include("Union<string, double,");
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
          returnType: {
            kind: "unionType",
            types: [
              { kind: "primitiveType", name: "string" },
              { kind: "primitiveType", name: "number" },
              { kind: "primitiveType", name: "boolean" },
              { kind: "referenceType", name: "DateLike", typeArguments: [] },
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

    // Should use Union<T1, T2, T3, T4> with global:: FQN
    expect(code).to.include(
      "global::Tsonic.Runtime.Union<bool, double, string, DateLike> process()"
    );
  });

});
