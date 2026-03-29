/**
 * Tests for Type Emission
 * Tests emission of primitive types and async/Task types
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "../emitter.js";
import { IrModule, IrType } from "@tsonic/frontend";

describe("Type Emission", () => {
  it("should emit primitive types correctly", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "Test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "test",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "a" },
              type: { kind: "primitiveType", name: "string" },
              isOptional: false,
              isRest: false,
              passing: "value",
            },
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "b" },
              type: { kind: "primitiveType", name: "number" },
              isOptional: false,
              isRest: false,
              passing: "value",
            },
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "c" },
              type: { kind: "primitiveType", name: "boolean" },
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: { kind: "voidType" },
          body: { kind: "blockStatement", statements: [] },
          isExported: true,
          isAsync: false,
          isGenerator: false,
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include("string a");
    expect(result).to.include("double b");
    expect(result).to.include("bool c");
  });

  it("should emit async functions with Task types", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "Test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "fetchData",
          parameters: [],
          returnType: {
            kind: "referenceType",
            name: "Promise",
            typeArguments: [{ kind: "primitiveType", name: "string" }],
          },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "returnStatement",
                expression: {
                  kind: "await",
                  expression: {
                    kind: "call",
                    callee: {
                      kind: "identifier",
                      name: "getData",
                      inferredType: {
                        kind: "functionType",
                        parameters: [],
                        returnType: {
                          kind: "referenceType",
                          name: "Promise",
                          typeArguments: [
                            { kind: "primitiveType", name: "string" },
                          ],
                        },
                      },
                    },
                    arguments: [],
                    isOptional: false,
                    inferredType: {
                      kind: "referenceType",
                      name: "Promise",
                      typeArguments: [
                        { kind: "primitiveType", name: "string" },
                      ],
                    },
                  },
                },
              },
            ],
          },
          isExported: true,
          isAsync: true,
          isGenerator: false,
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    // Task should be emitted (may be fully-qualified or short form depending on emitter)
    expect(result).to.include("async");
    expect(result).to.include("fetchData()");
    expect(result).to.include("await getData()");
    // Should NOT include using directives - uses global:: FQN
    expect(result).to.not.include("using System.Threading.Tasks");
  });

  it("maps ambient iterable protocol types to CLR enumerable surfaces", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "Test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "values",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "items" },
              type: {
                kind: "referenceType",
                name: "Iterable",
                typeArguments: [{ kind: "primitiveType", name: "string" }],
              },
              isOptional: false,
              isRest: false,
              passing: "value",
            },
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "stream" },
              type: {
                kind: "referenceType",
                name: "AsyncIterable",
                typeArguments: [{ kind: "primitiveType", name: "string" }],
              },
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: { kind: "voidType" },
          body: { kind: "blockStatement", statements: [] },
          isExported: true,
          isAsync: false,
          isGenerator: false,
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include(
      "global::System.Collections.Generic.IEnumerable<string> items"
    );
    expect(result).to.include(
      "global::System.Collections.Generic.IAsyncEnumerable<string> stream"
    );
  });

  it("should emit symbol-key dictionaries as Dictionary<object, T>", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "Test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "get",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "store" },
              type: {
                kind: "dictionaryType",
                keyType: { kind: "referenceType", name: "object" },
                valueType: { kind: "primitiveType", name: "string" },
              },
              isOptional: false,
              isRest: false,
              passing: "value",
            },
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "key" },
              type: { kind: "referenceType", name: "object" },
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: { kind: "primitiveType", name: "string" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "returnStatement",
                expression: {
                  kind: "memberAccess",
                  object: { kind: "identifier", name: "store" },
                  property: { kind: "identifier", name: "key" },
                  isOptional: false,
                  isComputed: true,
                  accessKind: "dictionary",
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

    expect(result).to.include(
      "global::System.Collections.Generic.Dictionary<object, string> store"
    );
    expect(result).to.include("return store[key];");
  });

  it("should emit mixed PropertyKey dictionaries as Dictionary<object, T>", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "Test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "set",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "store" },
              type: {
                kind: "dictionaryType",
                keyType: { kind: "referenceType", name: "object" },
                valueType: { kind: "primitiveType", name: "number" },
              },
              isOptional: false,
              isRest: false,
              passing: "value",
            },
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "key" },
              type: { kind: "referenceType", name: "object" },
              isOptional: false,
              isRest: false,
              passing: "value",
            },
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "value" },
              type: { kind: "primitiveType", name: "number" },
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: { kind: "voidType" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "expressionStatement",
                expression: {
                  kind: "assignment",
                  operator: "=",
                  left: {
                    kind: "memberAccess",
                    object: { kind: "identifier", name: "store" },
                    property: { kind: "identifier", name: "key" },
                    isOptional: false,
                    isComputed: true,
                    accessKind: "dictionary",
                  },
                  right: { kind: "identifier", name: "value" },
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

    expect(result).to.include(
      "global::System.Collections.Generic.Dictionary<object, double> store"
    );
    expect(result).to.include("store[key] = value;");
  });

  it("erases arrays of recursive union elements to object[]", () => {
    const recursiveUnion = {
      kind: "unionType",
      types: [],
    } as unknown as Extract<IrType, { kind: "unionType" }> & {
      types: IrType[];
    };

    recursiveUnion.types.push(
      { kind: "primitiveType", name: "string" },
      {
        kind: "arrayType",
        elementType: recursiveUnion,
      }
    );

    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "Test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "accept",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "value" },
              type: recursiveUnion,
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: { kind: "voidType" },
          body: { kind: "blockStatement", statements: [] },
          isExported: true,
          isAsync: false,
          isGenerator: false,
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include(
      "global::Tsonic.Runtime.Union<object?[], string> value"
    );
    expect(result).to.not.include(
      "global::Tsonic.Runtime.Union<object[], global::Tsonic.Runtime.Union"
    );
  });

  it("preserves non-recursive runtime union arrays as union[]", () => {
    const handlerType: IrType = {
      kind: "functionType",
      parameters: [
        {
          kind: "parameter",
          pattern: { kind: "identifierPattern", name: "value" },
          type: { kind: "primitiveType", name: "string" },
          isOptional: false,
          isRest: false,
          passing: "value",
        },
      ],
      returnType: { kind: "voidType" },
    };

    const routerType: IrType = {
      kind: "referenceType",
      name: "Router",
      resolvedClrType: "MyApp.Router",
    };

    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "Test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "classDeclaration",
          name: "Router",
          isExported: false,
          isStruct: false,
          typeParameters: [],
          implements: [],
          members: [],
        },
        {
          kind: "functionDeclaration",
          name: "accept",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "value" },
              type: {
                kind: "arrayType",
                elementType: {
                  kind: "unionType",
                  types: [handlerType, routerType],
                },
              },
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: { kind: "voidType" },
          body: { kind: "blockStatement", statements: [] },
          isExported: true,
          isAsync: false,
          isGenerator: false,
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include(
      "global::Tsonic.Runtime.Union<global::System.Action<string>, global::MyApp.Router>[] value"
    );
    expect(result).to.not.include("object[] value");
  });
});
