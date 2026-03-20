import { describe, it, expect, emitModule } from "./helpers.js";
import type { IrModule, IrType, TypeMemberKind } from "./helpers.js";
describe("Statement Emission", () => {
  it("narrows discriminated unions on truthy/falsy property guards", () => {
    const okType: IrType = { kind: "referenceType", name: "Ok" };
    const errType: IrType = { kind: "referenceType", name: "Err" };
    const unionReference: IrType = {
      kind: "referenceType",
      name: "Union_2",
      resolvedClrType: "global::Tsonic.Runtime.Union_2",
      typeArguments: [okType, errType],
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
          kind: "functionDeclaration",
          name: "readResult",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "result" },
              type: unionWrapper,
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
                kind: "ifStatement",
                condition: {
                  kind: "unary",
                  operator: "!",
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
                    inferredType: { kind: "literalType", value: true },
                  },
                },
                thenStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: {
                        kind: "memberAccess",
                        object: {
                          kind: "identifier",
                          name: "result",
                          inferredType: errType,
                        },
                        property: "error",
                        isComputed: false,
                        isOptional: false,
                      },
                    },
                  ],
                },
              },
              {
                kind: "returnStatement",
                expression: {
                  kind: "memberAccess",
                  object: {
                    kind: "identifier",
                    name: "result",
                    inferredType: okType,
                  },
                  property: "data",
                  isComputed: false,
                  isOptional: false,
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

    expect(result).to.include("if (result.Is2())");
    expect(result).to.include("return result__2_1.error;");
    expect(result).to.include("return (result.As1()).data;");
  });

  it("narrows `in`-guards for cross-module union members via the type member index", () => {
    const typeMemberIndex = new Map<string, Map<string, TypeMemberKind>>([
      [
        "MyApp.Models.OkEvents",
        new Map<string, TypeMemberKind>([["events", "property"]]),
      ],
      [
        "MyApp.Models.ErrEvents",
        new Map<string, TypeMemberKind>([["error", "property"]]),
      ],
    ]);

    const unionReference: IrType = {
      kind: "referenceType",
      name: "Union_2",
      resolvedClrType: "global::Tsonic.Runtime.Union_2",
      typeArguments: [
        { kind: "referenceType", name: "MyApp.Models.OkEvents" },
        { kind: "referenceType", name: "MyApp.Models.ErrEvents" },
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
          kind: "functionDeclaration",
          name: "handle",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "result" },
              type: unionWrapper,
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
                kind: "ifStatement",
                condition: {
                  kind: "binary",
                  operator: "in",
                  inferredType: { kind: "primitiveType", name: "boolean" },
                  left: { kind: "literal", value: "error" },
                  right: {
                    kind: "identifier",
                    name: "result",
                    inferredType: unionWrapper,
                  },
                },
                thenStatement: { kind: "blockStatement", statements: [] },
                elseStatement: undefined,
              },
            ],
          },
          isExported: false,
          isAsync: false,
          isGenerator: false,
        },
      ],
      exports: [],
    };

    const result = emitModule(module, { typeMemberIndex });

    expect(result).to.include("if (result.Is1())");
  });
});
