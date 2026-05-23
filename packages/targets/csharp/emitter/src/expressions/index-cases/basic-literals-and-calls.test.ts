import {
  describe,
  it,
  expect,
  emitModule,
  createExactGlobalBindingRegistry,
  type IrExpression,
  type IrModule,
  type IrType,
} from "./helpers.js";

describe("Expression Emission", () => {
  it("should emit literals correctly", () => {
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
              name: { kind: "identifierPattern", name: "str" },
              initializer: { kind: "literal", value: "hello" },
            },
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "num" },
              initializer: { kind: "literal", value: 42 },
            },
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "bool" },
              initializer: { kind: "literal", value: true },
            },
          ],
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include('"hello"');
    expect(result).to.include("42"); // C# handles implicit conversion
    expect(result).to.include("true");
  });

  it("should emit array expressions", () => {
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
              name: { kind: "identifierPattern", name: "arr" },
              initializer: {
                kind: "array",
                elements: [
                  { kind: "literal", value: 1 },
                  { kind: "literal", value: 2 },
                  { kind: "literal", value: 3 },
                ],
              },
            },
          ],
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    // Native array syntax with explicit type
    expect(result).to.include("new int[] { 1, 2, 3 }");
  });

  it("should emit template literals", () => {
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
              name: { kind: "identifierPattern", name: "greeting" },
              initializer: {
                kind: "templateLiteral",
                quasis: ["Hello ", "!"],
                expressions: [{ kind: "identifier", name: "name" }],
              },
            },
          ],
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include('$"Hello {name}!"');
  });

  it("should coerce js-surface template literal holes through runtime stringify", () => {
    const jsValueType = {
      kind: "referenceType" as const,
      name: "JsValue" as const,
      providerQualifiedName: "Tsonic.Runtime.JsValue" as const,
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
              name: { kind: "identifierPattern", name: "message" },
              initializer: {
                kind: "templateLiteral",
                quasis: ["flag=", ""],
                expressions: [
                  {
                    kind: "identifier",
                    name: "flag",
                    inferredType: jsValueType,
                  },
                ],
                inferredType: { kind: "primitiveType", name: "string" },
              },
            },
          ],
        },
      ],
      exports: [],
    };

    const result = emitModule(module, {
      surface: "@tsonic/js",
      bindingRegistry: createExactGlobalBindingRegistry({
        String: {
          kind: "global",
          assembly: "js",
          type: "js.Globals.String",
        },
      }),
    });

    expect(result).to.include("global::js.Globals.String(flag)");
    expect(result).not.to.include('$"flag={flag}"');
  });

  it("should stringify js-surface boolean template literal holes through String()", () => {
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
              name: { kind: "identifierPattern", name: "message" },
              initializer: {
                kind: "templateLiteral",
                quasis: ["flag=", ""],
                expressions: [
                  {
                    kind: "identifier",
                    name: "flag",
                    inferredType: {
                      kind: "primitiveType",
                      name: "boolean",
                    },
                  },
                ],
                inferredType: { kind: "primitiveType", name: "string" },
              },
            },
          ],
        },
      ],
      exports: [],
    };

    const result = emitModule(module, {
      surface: "@tsonic/js",
      bindingRegistry: createExactGlobalBindingRegistry({
        String: {
          kind: "global",
          assembly: "js",
          type: "js.Globals.String",
        },
      }),
    });

    expect(result).to.include("global::js.Globals.String(flag)");
    expect(result).not.to.include('$"flag={flag}"');
  });

  it("should use providerMemberName for identifiers when provided", () => {
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
                name: "console",
                providerQualifiedName: "System.Console",
                providerOwnerIdentity: "System",
                providerMemberName: "Console", // Custom C# name
              },
              property: "log",
              isComputed: false,
              isOptional: false,
            },
            arguments: [{ kind: "literal", value: "Hello with providerMemberName" }],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    // Should use global:: prefixed assembly + providerMemberName
    expect(result).to.include("global::System.Console.log");
    // No using statements
    expect(result).not.to.include("using System");
  });

  it("should use providerQualifiedName when providerMemberName is not provided", () => {
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
                name: "Debug",
                providerQualifiedName: "System.Diagnostics.Debug",
                providerOwnerIdentity: "System",
                // No providerMemberName specified
              },
              property: "WriteLine",
              isComputed: false,
              isOptional: false,
            },
            arguments: [{ kind: "literal", value: "test" }],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    // Should use global:: prefixed full type name when no providerMemberName
    // providerQualifiedName already contains full type name, just add global::
    expect(result).to.include("global::System.Diagnostics.Debug.WriteLine");
    // No using statements
    expect(result).not.to.include("using System");
  });

  it("should emit global function calls using providerMemberName on identifier callees", () => {
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
              kind: "identifier",
              name: "clearInterval",
              providerQualifiedName: "js.Timers",
              providerOwnerIdentity: "js",
              providerMemberName: "Timers.clearInterval",
            },
            arguments: [{ kind: "literal", value: 1 }],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include("global::js.Timers.clearInterval(1)");
  });

  it("should preserve char-typed string indexing while string contexts use safe JS-style access", () => {
    const stringIndexExpr: Extract<IrExpression, { kind: "memberAccess" }> = {
      kind: "memberAccess" as const,
      object: {
        kind: "identifier" as const,
        name: "source",
        inferredType: { kind: "primitiveType" as const, name: "string" },
      },
      property: {
        kind: "literal" as const,
        value: 0,
        inferredType: { kind: "primitiveType" as const, name: "int" },
      },
      isComputed: true,
      isOptional: false,
      inferredType: { kind: "primitiveType" as const, name: "string" },
      accessKind: "stringChar" as const,
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
              name: { kind: "identifierPattern", name: "source" },
              type: { kind: "primitiveType", name: "string" },
              initializer: { kind: "literal", value: "abc" },
            },
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "letter" },
              type: { kind: "primitiveType", name: "char" },
              initializer: stringIndexExpr,
            },
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "text" },
              type: { kind: "primitiveType", name: "string" },
              initializer: stringIndexExpr,
            },
          ],
        },
      ],
      exports: [],
    };

    const result = emitModule(module, { surface: "@tsonic/js" });

    expect(result).to.include('string source = "abc";');
    expect(result).to.include("char letter = source[0];");
    expect(result).to.include(
      "string text = ((global::System.Func<string, double, string>)((string __tsonic_string, double __tsonic_index) =>"
    );
    expect(result).to.include("__tsonic_index < __tsonic_string.Length");
    expect(result).to.include(
      "__tsonic_index == global::System.Math.Truncate(__tsonic_index)"
    );
    expect(result).to.include("__tsonic_string[(int)__tsonic_index].ToString()");
    expect(result).to.not.include("string text = source[0].ToString();");
  });

  it("boxes numeric literals when constructor arguments flow into optional JsValue slots", () => {
    const assertionErrorType = {
      kind: "referenceType" as const,
      name: "AssertionError" as const,
      providerQualifiedName: "MyApp.AssertionError",
    };
    const jsValueOrUndefinedType = {
      kind: "unionType" as const,
      types: [
        {
          kind: "referenceType" as const,
          name: "JsValue" as const,
          providerQualifiedName: "Tsonic.Runtime.JsValue" as const,
        },
        { kind: "primitiveType" as const, name: "undefined" as const },
      ],
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
              name: { kind: "identifierPattern", name: "error" },
              initializer: {
                kind: "new",
                callee: {
                  kind: "identifier",
                  name: "AssertionError",
                  inferredType: assertionErrorType,
                },
                arguments: [
                  { kind: "literal", value: "Test message" },
                  {
                    kind: "literal",
                    value: 5,
                    inferredType: {
                      kind: "primitiveType",
                      name: "number",
                    },
                  },
                  {
                    kind: "literal",
                    value: 10,
                    inferredType: {
                      kind: "primitiveType",
                      name: "number",
                    },
                  },
                  { kind: "literal", value: "===" },
                ],
                inferredType: assertionErrorType,
                parameterTypes: [
                  { kind: "primitiveType", name: "string" },
                  jsValueOrUndefinedType,
                  jsValueOrUndefinedType,
                  { kind: "primitiveType", name: "string" },
                ],
                surfaceParameterTypes: [
                  { kind: "primitiveType", name: "string" },
                  jsValueOrUndefinedType,
                  jsValueOrUndefinedType,
                  { kind: "primitiveType", name: "string" },
                ],
              },
            },
          ],
        },
      ],
      exports: [],
    };

    const result = emitModule(module, { surface: "@tsonic/js" });

    expect(result).to.include('new AssertionError("Test message"');
    expect(result).to.include("(object)(double)5");
    expect(result).to.include("(object)(double)10");
  });

  it("rewraps explicit non-null source-backed values through optional public union carriers", () => {
    const nativeArrayType: IrType = {
      kind: "referenceType",
      name: "NativeArray",
      providerQualifiedName: "Test.NativeArray",
    };
    const bufferType: IrType = {
      kind: "referenceType",
      name: "Buffer",
      providerQualifiedName: "Test.Buffer",
    };
    const keyObjectType: IrType = {
      kind: "referenceType",
      name: "KeyObject",
      providerQualifiedName: "Test.KeyObject",
    };
    const sourceUnionMembers: readonly IrType[] = [
      { kind: "primitiveType", name: "string" },
      bufferType,
      nativeArrayType,
    ];
    const selectedOptionalKeyType: IrType = {
      kind: "unionType",
      types: [
        ...sourceUnionMembers,
        { kind: "primitiveType", name: "undefined" },
      ],
    };
    const publicOptionalKeyType: IrType = {
      kind: "unionType",
      runtimeUnionLayout: "carrierSlotOrder",
      runtimeCarrierFamilyKey: "runtime-union:alias:Test.NativeKey",
      runtimeCarrierName: "NativeKey",
      runtimeCarrierNamespace: "Test",
      types: [
        ...sourceUnionMembers,
        { kind: "primitiveType", name: "undefined" },
      ],
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
              name: { kind: "identifierPattern", name: "publicRsa" },
              type: nativeArrayType,
              initializer: {
                kind: "new",
                callee: {
                  kind: "identifier",
                  name: "NativeArray",
                  providerQualifiedName: "Test.NativeArray",
                  inferredType: nativeArrayType,
                },
                arguments: [],
                inferredType: nativeArrayType,
              },
            },
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "key" },
              type: keyObjectType,
              initializer: {
                kind: "new",
                callee: {
                  kind: "identifier",
                  name: "KeyObject",
                  providerQualifiedName: "Test.KeyObject",
                  inferredType: keyObjectType,
                },
                arguments: [
                  {
                    kind: "identifier",
                    name: "publicRsa",
                    inferredType: nativeArrayType,
                  },
                ],
                inferredType: keyObjectType,
                parameterTypes: [selectedOptionalKeyType],
                sourceBackedSurfaceParameterTypes: [publicOptionalKeyType],
              },
            },
          ],
        },
      ],
      exports: [],
    };

    const result = emitModule(module, { surface: "@tsonic/js" });

    expect(result).to.include(
      "new global::Test.KeyObject(global::Test.NativeKey<string, global::Test.Buffer, global::Test.NativeArray>.From3(publicRsa))"
    );
    expect(result).not.to.include("global::Tsonic.Internal.Union");
  });

  it("should convert char identifiers to string when a call argument expects string", () => {
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
              name: { kind: "identifierPattern", name: "ch" },
              type: { kind: "primitiveType", name: "char" },
              initializer: { kind: "literal", value: "x" },
            },
          ],
        },
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: {
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "regex",
                providerQualifiedName: "System.Text.RegularExpressions.Regex",
                providerOwnerIdentity: "System.Text.RegularExpressions",
                inferredType: { kind: "referenceType", name: "RegExp" },
              },
              property: "test",
              isComputed: false,
              isOptional: false,
              inferredType: {
                kind: "functionType",
                parameters: [
                  {
                    kind: "parameter",
                    pattern: {
                      kind: "identifierPattern",
                      name: "text",
                    },
                    type: { kind: "primitiveType", name: "string" },
                    isOptional: false,
                    isRest: false,
                    passing: "value",
                  },
                ],
                returnType: { kind: "primitiveType", name: "boolean" },
              },
              memberBinding: {
                kind: "method",
                assembly: "System.Text.RegularExpressions",
                type: "System.Text.RegularExpressions.Regex",
                member: "test",
              },
            },
            arguments: [
              {
                kind: "identifier",
                name: "ch",
                inferredType: { kind: "primitiveType", name: "char" },
              },
            ],
            parameterTypes: [{ kind: "primitiveType", name: "string" }],
            inferredType: { kind: "primitiveType", name: "boolean" },
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include("char ch = 'x';");
    expect(result).to.include("test(ch.ToString())");
  });
});
