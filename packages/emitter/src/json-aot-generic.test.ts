/**
 * JSON NativeAOT registry regression tests
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitCSharpFiles } from "./emitter.js";
import type { IrModule } from "@tsonic/frontend";

describe("JSON NativeAOT registry", () => {
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

    const result = emitCSharpFiles([module], { rootNamespace: "MyApp" });
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

    const result = emitCSharpFiles([module], { rootNamespace: "MyApp" });
    expect(result.ok).to.equal(true);
    if (!result.ok) return;

    const jsonFile = result.files.get("__tsonic_json.g.cs");
    expect(jsonFile).to.not.equal(undefined);
    expect(jsonFile).to.include("typeof(string[])");
    expect(jsonFile).to.not.include("typeof(global::string[])");
  });
});
