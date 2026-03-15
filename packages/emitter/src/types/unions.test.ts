/**
 * Tests for union type emission
 * Verifies TypeScript unions map to C# Union<T1, T2>
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "../emitter.js";
import { IrModule, IrType } from "@tsonic/frontend";

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

  it("treats void union members as runtime-nullish for nullable emission", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/voidNullable.ts",
      namespace: "Test",
      className: "voidNullable",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "maybeFlush",
          parameters: [],
          returnType: {
            kind: "unionType",
            types: [
              { kind: "voidType" },
              {
                kind: "referenceType",
                name: "Task",
                resolvedClrType: "System.Threading.Tasks.Task",
              },
            ],
          },
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

    expect(code).to.include(
      "public static global::System.Threading.Tasks.Task? maybeFlush()"
    );
    expect(code).not.to.include("Union<void");
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

    // Should use fully-qualified Union<T1, T2>
    expect(code).to.include(
      "global::Tsonic.Runtime.Union<string, double> value"
    );
    // Should NOT include using directives - uses global:: FQN
    expect(code).to.not.include("using Tsonic.Runtime");
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

    // Should return Union<string, double> with global:: FQN
    expect(code).to.include(
      "public static global::Tsonic.Runtime.Union<string, double> getValue()"
    );
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

    // Should accept Union<string, bool> parameter with global:: FQN
    expect(code).to.include(
      "process(global::Tsonic.Runtime.Union<string, bool> input)"
    );
  });

  it("canonicalizes runtime union member order regardless of IR member order", () => {
    const emit = (types: IrType[]): string => {
      const module: IrModule = {
        kind: "module",
        filePath: "/test/orderedUnion.ts",
        namespace: "Test",
        className: "orderedUnion",
        isStaticContainer: true,
        imports: [],
        exports: [],
        body: [
          {
            kind: "interfaceDeclaration",
            name: "RegexLike",
            isExported: false,
            isStruct: false,
            typeParameters: [],
            extends: [],
            members: [],
          },
          {
            kind: "functionDeclaration",
            name: "useValue",
            parameters: [
              {
                kind: "parameter",
                pattern: { kind: "identifierPattern", name: "input" },
                type: { kind: "unionType", types },
                isOptional: false,
                isRest: false,
                passing: "value",
              },
            ],
            returnType: { kind: "voidType" },
            body: { kind: "blockStatement", statements: [] },
            isAsync: false,
            isGenerator: false,
            isExported: true,
          },
        ],
      };

      return emitModule(module);
    };

    const forward = emit([
      { kind: "primitiveType", name: "string" },
      { kind: "primitiveType", name: "boolean" },
      { kind: "referenceType", name: "RegexLike" },
    ]);
    const reversed = emit([
      { kind: "referenceType", name: "RegexLike" },
      { kind: "primitiveType", name: "boolean" },
      { kind: "primitiveType", name: "string" },
    ]);

    const extractUnion = (code: string): string | undefined =>
      code.match(/global::Tsonic\.Runtime\.Union<[^>]+>/)?.[0];

    const forwardUnion = extractUnion(forward);
    const reversedUnion = extractUnion(reversed);

    expect(forwardUnion).to.not.equal(undefined);
    expect(reversedUnion).to.equal(forwardUnion);
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

    // Should use fully-qualified Union<T1, T2, T3>
    expect(code).to.include(
      "global::Tsonic.Runtime.Union<string, double, bool> value"
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
      "global::Tsonic.Runtime.Union<string, double>? value"
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
      "global::Tsonic.Runtime.Union<string, double, bool, DateLike> process()"
    );
  });

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
      "global::Tsonic.Runtime.Union<string, double, bool, User, Product, Order, Payment, Invoice> value"
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
    expect(code).to.include(
      "global::Tsonic.Runtime.Union<global::System.Object, object[]> handlers"
    );
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
                  { kind: "referenceType", name: "RegExp", resolvedClrType: "System.Text.RegularExpressions.Regex" },
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
