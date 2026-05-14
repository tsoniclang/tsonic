/**
 * JSON NativeAOT registry regression tests
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitCSharpFiles } from "./emitter.js";
import { assumeEmittableIrModule, type IrModule } from "@tsonic/frontend";
import { createJsSurfaceBindingRegistry } from "./expressions/index-cases/helpers.js";

const jsSurfaceBindingRegistry = createJsSurfaceBindingRegistry();

describe("JSON NativeAOT registry", () => {
  it("uses the inferred closed result type for global JSON.parse without explicit type arguments", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/index.ts",
      namespace: "MyApp",
      className: "index",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "parseNumber",
          parameters: [],
          returnType: { kind: "primitiveType", name: "number" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "returnStatement",
                expression: {
                  kind: "call",
                  callee: {
                    kind: "memberAccess",
                    object: { kind: "identifier", name: "JSON" },
                    property: "parse",
                    isComputed: false,
                    isOptional: false,
                    memberBinding: {
                      kind: "method",
                      assembly: "js",
                      type: "js.JSON",
                      member: "parse",
                    },
                  },
                  arguments: [{ kind: "literal", value: "123" }],
                  isOptional: false,
                  inferredType: { kind: "primitiveType", name: "number" },
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

    const result = emitCSharpFiles([assumeEmittableIrModule(module)], {
      rootNamespace: "MyApp",
      enableJsonAot: true,
      surface: "@tsonic/js",
      bindingRegistry: jsSurfaceBindingRegistry,
    });
    expect(result.ok).to.equal(true);
    if (!result.ok) return;

    const code = result.files.get("index.cs");
    expect(code).to.not.equal(undefined);
    expect(code).to.include(
      'global::System.Text.Json.JsonSerializer.Deserialize<double>("123", global::MyApp.TsonicJson.Options)'
    );
    expect(result.files.has("__tsonic_json.g.cs")).to.equal(true);
  });

  it("serializes closed nominal payloads through generated NativeAOT metadata", () => {
    const payloadType = {
      kind: "referenceType" as const,
      name: "Payload" as const,
    };

    const module: IrModule = {
      kind: "module",
      filePath: "/src/index.ts",
      namespace: "MyApp",
      className: "index",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "classDeclaration",
          name: "Payload",
          members: [
            {
              kind: "propertyDeclaration",
              name: "ok",
              type: { kind: "primitiveType", name: "boolean" },
              accessibility: "public",
              isStatic: false,
              isReadonly: false,
            },
            {
              kind: "propertyDeclaration",
              name: "value",
              type: { kind: "primitiveType", name: "int" },
              accessibility: "public",
              isStatic: false,
              isReadonly: false,
            },
          ],
          isStruct: false,
          isExported: true,
          implements: [],
        },
        {
          kind: "functionDeclaration",
          name: "stringifyPayload",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "payload" },
              type: payloadType,
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
                  kind: "call",
                  callee: {
                    kind: "memberAccess",
                    object: { kind: "identifier", name: "JSON" },
                    property: "stringify",
                    isComputed: false,
                    isOptional: false,
                    memberBinding: {
                      kind: "method",
                      assembly: "js",
                      type: "js.JSON",
                      member: "stringify",
                    },
                  },
                  arguments: [
                    {
                      kind: "identifier",
                      name: "payload",
                      inferredType: payloadType,
                    },
                  ],
                  isOptional: false,
                  inferredType: { kind: "primitiveType", name: "string" },
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

    const result = emitCSharpFiles([assumeEmittableIrModule(module)], {
      rootNamespace: "MyApp",
      enableJsonAot: true,
      surface: "@tsonic/js",
      bindingRegistry: jsSurfaceBindingRegistry,
    });
    expect(result.ok).to.equal(true);
    if (!result.ok) return;

    const code = result.files.get("index.cs");
    expect(code).to.not.equal(undefined);
    expect(code).to.include(
      "global::System.Text.Json.JsonSerializer.Serialize("
    );
    expect(code).to.not.include("TsonicJsonRuntime");
    expect(result.files.has("__tsonic_json.g.cs")).to.equal(true);
  });

  it("uses local semantic types for JSON.stringify on identifiers widened in frontend IR", () => {
    const payloadType = {
      kind: "arrayType" as const,
      elementType: {
        kind: "primitiveType" as const,
        name: "string" as const,
      },
      origin: "explicit" as const,
    };

    const module: IrModule = {
      kind: "module",
      filePath: "/src/index.ts",
      namespace: "MyApp",
      className: "index",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "stringifyTypedLocal",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "seed" },
              type: payloadType,
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
                kind: "variableDeclaration",
                declarationKind: "const",
                declarations: [
                  {
                    kind: "variableDeclarator",
                    name: { kind: "identifierPattern", name: "parsed" },
                    type: payloadType,
                    initializer: {
                      kind: "identifier",
                      name: "seed",
                      inferredType: payloadType,
                    },
                  },
                ],
                isExported: false,
              },
              {
                kind: "returnStatement",
                expression: {
                  kind: "call",
                  callee: {
                    kind: "memberAccess",
                    object: { kind: "identifier", name: "JSON" },
                    property: "stringify",
                    isComputed: false,
                    isOptional: false,
                    memberBinding: {
                      kind: "method",
                      assembly: "js",
                      type: "js.JSON",
                      member: "stringify",
                    },
                  },
                  arguments: [
                    {
                      kind: "identifier",
                      name: "parsed",
                      inferredType: payloadType,
                    },
                  ],
                  isOptional: false,
                  inferredType: { kind: "primitiveType", name: "string" },
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

    const result = emitCSharpFiles([assumeEmittableIrModule(module)], {
      rootNamespace: "MyApp",
      enableJsonAot: true,
      surface: "@tsonic/js",
      bindingRegistry: jsSurfaceBindingRegistry,
    });
    expect(result.ok).to.equal(true);
    if (!result.ok) return;

    const code = result.files.get("index.cs");
    expect(code).to.not.equal(undefined);
    expect(code).to.include(
      "global::System.Text.Json.JsonSerializer.Serialize(parsed, global::MyApp.TsonicJson.Options)"
    );
    expect(code).to.not.include("TsonicJsonRuntime");
    expect(result.files.has("__tsonic_json.g.cs")).to.equal(true);
  });

  it("does not register open generic type parameters (no typeof(global::T))", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/index.ts",
      namespace: "MyApp",
      className: "index",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "serialize",
          typeParameters: [
            {
              kind: "typeParameter",
              name: "T",
              constraint: undefined,
              default: undefined,
              variance: undefined,
              isStructuralConstraint: false,
            },
          ],
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "value" },
              type: { kind: "typeParameterType", name: "T" },
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
                  kind: "call",
                  callee: {
                    kind: "memberAccess",
                    object: { kind: "identifier", name: "JsonSerializer" },
                    property: "Serialize",
                    isComputed: false,
                    isOptional: false,
                    memberBinding: {
                      kind: "method",
                      assembly: "System.Text.Json",
                      type: "System.Text.Json.JsonSerializer",
                      member: "Serialize",
                    },
                  },
                  arguments: [
                    {
                      kind: "identifier",
                      name: "value",
                      inferredType: { kind: "typeParameterType", name: "T" },
                    },
                  ],
                  isOptional: false,
                  typeArguments: [{ kind: "typeParameterType", name: "T" }],
                  inferredType: { kind: "primitiveType", name: "string" },
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

    const result = emitCSharpFiles([assumeEmittableIrModule(module)], {
      rootNamespace: "MyApp",
      enableJsonAot: true,
      surface: "@tsonic/js",
      bindingRegistry: jsSurfaceBindingRegistry,
    });
    expect(result.ok).to.equal(true);
    if (!result.ok) return;

    const jsonFile = result.files.get("__tsonic_json.g.cs");
    expect(jsonFile).to.not.equal(undefined);
    expect(jsonFile).to.not.include("typeof(global::T)");
  });

  it("does not qualify primitive arrays as global::string[]", () => {
    const stringArrayType = {
      kind: "arrayType" as const,
      elementType: { kind: "primitiveType" as const, name: "string" as const },
    };

    const module: IrModule = {
      kind: "module",
      filePath: "/src/index.ts",
      namespace: "MyApp",
      className: "index",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "serializeStrings",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "values" },
              type: stringArrayType,
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
                  kind: "call",
                  callee: {
                    kind: "memberAccess",
                    object: { kind: "identifier", name: "JsonSerializer" },
                    property: "Serialize",
                    isComputed: false,
                    isOptional: false,
                    memberBinding: {
                      kind: "method",
                      assembly: "System.Text.Json",
                      type: "System.Text.Json.JsonSerializer",
                      member: "Serialize",
                    },
                  },
                  arguments: [
                    {
                      kind: "identifier",
                      name: "values",
                      inferredType: stringArrayType,
                    },
                  ],
                  isOptional: false,
                  typeArguments: [],
                  inferredType: { kind: "primitiveType", name: "string" },
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

    const result = emitCSharpFiles([assumeEmittableIrModule(module)], {
      rootNamespace: "MyApp",
      enableJsonAot: true,
    });
    expect(result.ok).to.equal(true);
    if (!result.ok) return;

    const jsonFile = result.files.get("__tsonic_json.g.cs");
    expect(jsonFile).to.not.equal(undefined);
    expect(jsonFile).to.include("typeof(string[])");
    expect(jsonFile).to.not.include("typeof(global::string[])");
    expect(jsonFile).to.include("// <auto-generated/>");
    expect(jsonFile).to.include(
      "internal static readonly global::System.Text.Json.JsonSerializerOptions Options"
    );
    expect(jsonFile).to.include(
      "TypeInfoResolver = __TsonicJsonContext.Default"
    );
  });
});
