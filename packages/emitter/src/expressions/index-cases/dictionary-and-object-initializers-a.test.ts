import {
  describe,
  it,
  expect,
  emitModule,
  type IrModule,
  type IrType,
} from "./helpers.js";

describe("Expression Emission", () => {
  it("should emit CLR Count for structural dictionary count without member binding", () => {
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
            kind: "memberAccess",
            object: {
              kind: "identifier",
              name: "items",
              inferredType: {
                kind: "dictionaryType",
                keyType: { kind: "primitiveType", name: "string" },
                valueType: {
                  kind: "referenceType",
                  name: "Acme.Core.Channel",
                  resolvedClrType: "Acme.Core.Channel",
                },
              },
            },
            property: "Length",
            isComputed: false,
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("items.Count");
    expect(result).to.not.include("items.Length");
  });

  it("should project CLR Union_n member access deterministically", () => {
    const unionReference: IrType = {
      kind: "referenceType",
      name: "Union",
      typeArguments: [
        { kind: "referenceType", name: "Ok" },
        { kind: "referenceType", name: "Err" },
      ],
    };
    const unionWrapper: IrType = {
      kind: "intersectionType",
      types: [unionReference, { kind: "referenceType", name: "__Union$views" }],
    };

    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "interfaceDeclaration",
          name: "Ok",
          typeParameters: [],
          extends: [],
          members: [
            {
              kind: "propertySignature",
              name: "success",
              type: { kind: "literalType", value: true },
              isOptional: false,
              isReadonly: false,
            },
            {
              kind: "propertySignature",
              name: "data",
              type: { kind: "primitiveType", name: "string" },
              isOptional: false,
              isReadonly: false,
            },
          ],
          isExported: false,
          isStruct: false,
        },
        {
          kind: "interfaceDeclaration",
          name: "Err",
          typeParameters: [],
          extends: [],
          members: [
            {
              kind: "propertySignature",
              name: "success",
              type: { kind: "literalType", value: false },
              isOptional: false,
              isReadonly: false,
            },
            {
              kind: "propertySignature",
              name: "error",
              type: { kind: "primitiveType", name: "string" },
              isOptional: false,
              isReadonly: false,
            },
          ],
          isExported: false,
          isStruct: false,
        },
        {
          kind: "expressionStatement",
          expression: {
            kind: "memberAccess",
            object: {
              kind: "identifier",
              name: "result",
              inferredType: unionWrapper,
            },
            property: "success",
            isComputed: false,
            isOptional: false,
            memberBinding: {
              kind: "property",
              assembly: "MyApp",
              type: "MyApp.Ok",
              member: "success",
            },
          },
        },
        {
          kind: "expressionStatement",
          expression: {
            kind: "memberAccess",
            object: {
              kind: "identifier",
              name: "result",
              inferredType: unionWrapper,
            },
            property: "error",
            isComputed: false,
            isOptional: false,
            memberBinding: {
              kind: "property",
              assembly: "MyApp",
              type: "MyApp.Err",
              member: "error",
            },
          },
        },
        {
          kind: "expressionStatement",
          expression: {
            kind: "memberAccess",
            object: {
              kind: "identifier",
              name: "result",
              inferredType: unionWrapper,
            },
            property: "data",
            isComputed: false,
            isOptional: false,
            memberBinding: {
              kind: "property",
              assembly: "MyApp",
              type: "MyApp.Ok",
              member: "data",
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("result.Match");
    expect(result).to.include("__m1 => __m1.success, __m2 => __m2.success");
    expect(result).to.include("result.As2().error");
    expect(result).to.include("result.As1().data");
  });

  it("should escape special characters in dictionary keys", () => {
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
              name: { kind: "identifierPattern", name: "dict" },
              type: {
                kind: "dictionaryType",
                keyType: { kind: "primitiveType", name: "string" },
                valueType: { kind: "primitiveType", name: "number" },
              },
              initializer: {
                kind: "object",
                properties: [
                  {
                    kind: "property",
                    key: 'key"with"quotes',
                    value: { kind: "literal", value: 1 },
                    shorthand: false,
                  },
                  {
                    kind: "property",
                    key: "key\\with\\backslashes",
                    value: { kind: "literal", value: 2 },
                    shorthand: false,
                  },
                  {
                    kind: "property",
                    key: "key\nwith\nnewlines",
                    value: { kind: "literal", value: 3 },
                    shorthand: false,
                  },
                ],
                contextualType: {
                  kind: "dictionaryType",
                  keyType: { kind: "primitiveType", name: "string" },
                  valueType: { kind: "primitiveType", name: "number" },
                },
              },
            },
          ],
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    // Should escape quotes
    expect(result).to.include('["key\\"with\\"quotes"]');
    // Should escape backslashes
    expect(result).to.include('["key\\\\with\\\\backslashes"]');
    // Should escape newlines
    expect(result).to.include('["key\\nwith\\nnewlines"]');
    // Should be a Dictionary with global:: prefix
    expect(result).to.include(
      "new global::System.Collections.Generic.Dictionary<string, double>"
    );
  });

  it("should emit computed string-literal keys for nominal object initializers", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "interfaceDeclaration",
          name: "Box",
          typeParameters: [],
          extends: [],
          members: [
            {
              kind: "propertySignature",
              name: "foo",
              type: { kind: "primitiveType", name: "number" },
              isOptional: false,
              isReadonly: false,
            },
          ],
          isExported: false,
          isStruct: false,
        },
        {
          kind: "variableDeclaration",
          declarationKind: "const",
          isExported: false,
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "box" },
              type: { kind: "referenceType", name: "Box" },
              initializer: {
                kind: "object",
                properties: [
                  {
                    kind: "property",
                    key: { kind: "literal", value: "foo" },
                    value: { kind: "literal", value: 1 },
                    shorthand: false,
                  },
                ],
                contextualType: { kind: "referenceType", name: "Box" },
                inferredType: { kind: "referenceType", name: "Box" },
              },
            },
          ],
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).not.to.include("/* computed */");
    expect(result).to.include("foo = 1");
  });

  it("should lower dictionary[key] !== undefined to ContainsKey", () => {
    const dictType: IrType = {
      kind: "dictionaryType",
      keyType: { kind: "primitiveType", name: "string" },
      valueType: { kind: "primitiveType", name: "number" },
    };

    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "ifStatement",
          condition: {
            kind: "binary",
            operator: "!==",
            left: {
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "dict",
                inferredType: dictType,
              },
              property: { kind: "literal", value: "x" },
              isComputed: true,
              isOptional: false,
              accessKind: "dictionary",
              inferredType: { kind: "primitiveType", name: "number" },
            },
            right: { kind: "identifier", name: "undefined" },
          },
          thenStatement: {
            kind: "blockStatement",
            statements: [],
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include('(dict).ContainsKey("x")');
    expect(result).to.not.include('dict["x"] != null');
  });

  it("should lower direct computed dictionary reads to safe lookups on the JS surface", () => {
    const dictType: IrType = {
      kind: "dictionaryType",
      keyType: { kind: "primitiveType", name: "string" },
      valueType: { kind: "primitiveType", name: "string" },
    };

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
              name: { kind: "identifierPattern", name: "current" },
              initializer: {
                kind: "memberAccess",
                object: {
                  kind: "identifier",
                  name: "dict",
                  inferredType: dictType,
                },
                property: {
                  kind: "identifier",
                  name: "key",
                  inferredType: { kind: "primitiveType", name: "string" },
                },
                isComputed: true,
                isOptional: false,
                accessKind: "dictionary",
                inferredType: { kind: "primitiveType", name: "string" },
              },
            },
          ],
        },
      ],
      exports: [],
    };

    const result = emitModule(module, { surface: "@tsonic/js" });
    expect(result).to.include(
      "__tsonic_dict.ContainsKey(__tsonic_key) ? __tsonic_dict[__tsonic_key] : default"
    );
  });

  it("should lower direct dictionary property reads to safe lookups on the JS surface", () => {
    const dictType: IrType = {
      kind: "dictionaryType",
      keyType: { kind: "primitiveType", name: "string" },
      valueType: { kind: "primitiveType", name: "string" },
    };

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
              name: { kind: "identifierPattern", name: "header" },
              initializer: {
                kind: "memberAccess",
                object: {
                  kind: "identifier",
                  name: "headers",
                  inferredType: dictType,
                },
                property: "set-cookie",
                isComputed: false,
                isOptional: false,
                inferredType: { kind: "primitiveType", name: "string" },
              },
            },
          ],
        },
      ],
      exports: [],
    };

    const result = emitModule(module, { surface: "@tsonic/js" });
    expect(result).to.include(
      "__tsonic_dict.ContainsKey(__tsonic_key) ? __tsonic_dict[__tsonic_key] : default"
    );
  });

  it("should lower dictionary.Keys to a materialized key array", () => {
    const dictType: IrType = {
      kind: "dictionaryType",
      keyType: { kind: "primitiveType", name: "string" },
      valueType: { kind: "primitiveType", name: "number" },
    };

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
              name: { kind: "identifierPattern", name: "keys" },
              initializer: {
                kind: "memberAccess",
                object: {
                  kind: "identifier",
                  name: "dict",
                  inferredType: dictType,
                },
                property: "Keys",
                isComputed: false,
                isOptional: false,
                inferredType: {
                  kind: "arrayType",
                  elementType: { kind: "primitiveType", name: "string" },
                },
              },
            },
          ],
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include(
      "new global::System.Collections.Generic.List<string>(dict.Keys).ToArray()"
    );
  });

  it("should lower dictionary.Values to a materialized value array", () => {
    const dictType: IrType = {
      kind: "dictionaryType",
      keyType: { kind: "primitiveType", name: "string" },
      valueType: { kind: "referenceType", name: "long" },
    };

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
              initializer: {
                kind: "memberAccess",
                object: {
                  kind: "identifier",
                  name: "dict",
                  inferredType: dictType,
                },
                property: "Values",
                isComputed: false,
                isOptional: false,
                inferredType: {
                  kind: "arrayType",
                  elementType: { kind: "referenceType", name: "long" },
                },
              },
            },
          ],
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include(
      "new global::System.Collections.Generic.List<long>(dict.Values).ToArray()"
    );
  });
});
