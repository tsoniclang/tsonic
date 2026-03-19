import {
  describe,
  it,
  expect,
  emitModule,
  type IrModule,
} from "./helpers.js";

describe("Expression Emission", () => {
  it("should emit spread arguments without an invalid params call-site modifier", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "variableDeclaration",
          declarationKind: "const",
          isExported: false,
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "parts" },
              type: {
                kind: "arrayType",
                elementType: { kind: "primitiveType", name: "string" },
              },
              initializer: {
                kind: "array",
                elements: [
                  { kind: "literal", value: "a" },
                  { kind: "literal", value: "b" },
                ],
              },
            },
          ],
        },
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: {
              kind: "identifier",
              name: "joinPath",
              resolvedClrType: "nodejs.path",
              resolvedAssembly: "nodejs",
              csharpName: "path.join",
            },
            arguments: [
              { kind: "literal", value: "root" },
              {
                kind: "spread",
                expression: {
                  kind: "identifier",
                  name: "parts",
                  inferredType: {
                    kind: "arrayType",
                    elementType: { kind: "primitiveType", name: "string" },
                  },
                },
              },
            ],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include('global::nodejs.path.join("root", parts)');
    expect(result).not.to.include("params ");
  });

  it("should emit mixed array spreads through deterministic concat chains", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "variableDeclaration",
          declarationKind: "const",
          isExported: false,
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "values" },
              type: {
                kind: "arrayType",
                elementType: { kind: "primitiveType", name: "int" },
              },
              initializer: {
                kind: "array",
                elements: [
                  {
                    kind: "literal",
                    value: 1,
                    numericIntent: "Int32",
                    inferredType: { kind: "primitiveType", name: "int" },
                  },
                  {
                    kind: "literal",
                    value: 2,
                    numericIntent: "Int32",
                    inferredType: { kind: "primitiveType", name: "int" },
                  },
                ],
              },
            },
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "copy" },
              type: {
                kind: "arrayType",
                elementType: { kind: "primitiveType", name: "int" },
              },
              initializer: {
                kind: "array",
                elements: [
                  {
                    kind: "literal",
                    value: 0,
                    numericIntent: "Int32",
                    inferredType: { kind: "primitiveType", name: "int" },
                  },
                  {
                    kind: "spread",
                    expression: {
                      kind: "identifier",
                      name: "values",
                      inferredType: {
                        kind: "arrayType",
                        elementType: { kind: "primitiveType", name: "int" },
                      },
                    },
                  },
                  {
                    kind: "literal",
                    value: 3,
                    numericIntent: "Int32",
                    inferredType: { kind: "primitiveType", name: "int" },
                  },
                ],
              },
            },
          ],
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include("global::System.Linq.Enumerable.ToArray");
    expect(result).to.include("global::System.Linq.Enumerable.Concat");
    expect(result).to.include("new int[] { 0 }");
    expect(result).to.include("new int[] { 3 }");
    expect(result).not.to.include("/* ...spread */");
  });

  it("should emit hierarchical member bindings correctly", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: {
              kind: "memberAccess",
              object: {
                kind: "memberAccess",
                object: { kind: "identifier", name: "systemLinq" },
                property: "enumerable",
                isComputed: false,
                isOptional: false,
              },
              property: "selectMany",
              isComputed: false,
              isOptional: false,
              // Hierarchical member binding from manifest
              memberBinding: {
                kind: "method",
                assembly: "System.Linq",
                type: "System.Linq.Enumerable",
                member: "SelectMany",
              },
            },
            arguments: [
              { kind: "array", elements: [{ kind: "literal", value: 1 }] },
            ],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    // Should emit full CLR type and member from binding with global:: prefix
    expect(result).to.include("global::System.Linq.Enumerable.SelectMany");
    // No using statements
    expect(result).not.to.include("using System.Linq");
  });

  it("should emit global static calls through member binding type for surface globals", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: {
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "Array",
                inferredType: {
                  kind: "referenceType",
                  name: "ArrayConstructor",
                },
                resolvedClrType: "Tsonic.JSRuntime.JSArray`1",
                resolvedAssembly: "Tsonic.JSRuntime",
                csharpName: "JSArray",
              },
              property: "from",
              isComputed: false,
              isOptional: false,
              memberBinding: {
                kind: "method",
                assembly: "Tsonic.JSRuntime",
                type: "Tsonic.JSRuntime.JSArrayStatics",
                member: "from",
                isExtensionMethod: false,
              },
            },
            arguments: [{ kind: "literal", value: "abc" }],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include(
      'global::Tsonic.JSRuntime.JSArrayStatics.from("abc")'
    );
    expect(result).not.to.include("global::Tsonic.JSRuntime.JSArray.from");
  });

  it("should escape C# keywords in hierarchical member bindings", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: {
              kind: "memberAccess",
              object: {
                kind: "memberAccess",
                object: { kind: "identifier", name: "express" },
                property: "express",
                isComputed: false,
                isOptional: false,
              },
              property: "static",
              isComputed: false,
              isOptional: false,
              memberBinding: {
                kind: "method",
                assembly: "express",
                type: "Express.Express",
                member: "static",
              },
            },
            arguments: [{ kind: "literal", value: "./public" }],
            isOptional: false,
          },
        },
        {
          kind: "expressionStatement",
          expression: {
            kind: "memberAccess",
            object: {
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "req",
                inferredType: {
                  kind: "referenceType",
                  name: "Express.Request",
                },
              },
              property: "params",
              isComputed: false,
              isOptional: false,
              memberBinding: {
                kind: "property",
                assembly: "express",
                type: "Express.Request",
                member: "params",
              },
            },
            property: { kind: "literal", value: "id" },
            isComputed: true,
            isOptional: false,
            accessKind: "dictionary",
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include("global::Express.Express.@static");
    expect(result).to.include('req.@params["id"]');
  });

  it("should emit JS runtime string receiver helpers as static calls", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: {
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "path",
                inferredType: { kind: "primitiveType", name: "string" },
              },
              property: "split",
              isComputed: false,
              isOptional: false,
              memberBinding: {
                kind: "method",
                assembly: "Tsonic.JSRuntime",
                type: "Tsonic.JSRuntime.String",
                member: "split",
                isExtensionMethod: true,
                emitSemantics: {
                  callStyle: "receiver",
                },
              },
            },
            arguments: [{ kind: "literal", value: "/" }],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include(
      'global::Tsonic.JSRuntime.String.split(path, "/")'
    );
    expect(result).not.to.include('path.split("/")');
  });

  it("should emit JS runtime numeric receiver helpers as static calls", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: {
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "value",
                inferredType: { kind: "primitiveType", name: "number" },
              },
              property: "toString",
              isComputed: false,
              isOptional: false,
              memberBinding: {
                kind: "method",
                assembly: "Tsonic.JSRuntime",
                type: "Tsonic.JSRuntime.Number",
                member: "toString",
                isExtensionMethod: true,
                emitSemantics: {
                  callStyle: "receiver",
                },
              },
            },
            arguments: [],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include(
      "global::Tsonic.JSRuntime.Number.toString(value)"
    );
    expect(result).not.to.include("value.toString()");
  });

});
