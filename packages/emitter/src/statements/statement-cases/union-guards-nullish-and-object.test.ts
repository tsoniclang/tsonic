import { describe, it, expect, emitModule } from "./helpers.js";
import type { IrModule, IrType } from "./helpers.js";
describe("Statement Emission", () => {
  it("preserves renamed union narrowing through nullish property comparisons", () => {
    const okType: IrType = { kind: "referenceType", name: "OkEvents" };
    const errType: IrType = { kind: "referenceType", name: "ErrEvents" };
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
          name: "OkEvents",
          typeParameters: [],
          extends: [],
          members: [
            {
              kind: "propertySignature",
              name: "events",
              type: {
                kind: "arrayType",
                elementType: { kind: "primitiveType", name: "string" },
              },
              isOptional: false,
              isReadonly: false,
            },
          ],
          isExported: false,
          isStruct: false,
        },
        {
          kind: "interfaceDeclaration",
          name: "ErrEvents",
          typeParameters: [],
          extends: [],
          members: [
            {
              kind: "propertySignature",
              name: "error",
              type: { kind: "primitiveType", name: "string" },
              isOptional: false,
              isReadonly: false,
            },
            {
              kind: "propertySignature",
              name: "code",
              type: { kind: "primitiveType", name: "string" },
              isOptional: true,
              isReadonly: false,
            },
          ],
          isExported: false,
          isStruct: false,
        },
        {
          kind: "functionDeclaration",
          name: "readEvents",
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
                  kind: "binary",
                  operator: "in",
                  left: { kind: "literal", value: "error" },
                  right: {
                    kind: "identifier",
                    name: "result",
                    inferredType: unionWrapper,
                  },
                },
                thenStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: {
                        kind: "conditional",
                        condition: {
                          kind: "binary",
                          operator: "===",
                          left: {
                            kind: "memberAccess",
                            object: {
                              kind: "identifier",
                              name: "result",
                              inferredType: errType,
                            },
                            property: "code",
                            isComputed: false,
                            isOptional: false,
                            inferredType: {
                              kind: "unionType",
                              types: [
                                { kind: "primitiveType", name: "string" },
                                { kind: "primitiveType", name: "undefined" },
                              ],
                            },
                          },
                          right: { kind: "identifier", name: "undefined" },
                        },
                        whenTrue: {
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
                        whenFalse: {
                          kind: "binary",
                          operator: "+",
                          left: {
                            kind: "binary",
                            operator: "+",
                            left: {
                              kind: "memberAccess",
                              object: {
                                kind: "identifier",
                                name: "result",
                                inferredType: errType,
                              },
                              property: "code",
                              isComputed: false,
                              isOptional: false,
                              inferredType: {
                                kind: "unionType",
                                types: [
                                  { kind: "primitiveType", name: "string" },
                                  { kind: "primitiveType", name: "undefined" },
                                ],
                              },
                            },
                            right: { kind: "literal", value: ":" },
                          },
                          right: {
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
                      },
                    },
                  ],
                },
              },
              {
                kind: "returnStatement",
                expression: { kind: "literal", value: "" },
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

    expect(result).to.include("if (result.Is1())");
    expect(result).to.include(
      'return result__1_1.code == null ? result__1_1.error : result__1_1.code + ":" + result__1_1.error;'
    );
    expect(result).to.not.include("return result.code == null");
  });

  it("casts runtime unions to object for direct nullish comparisons", () => {
    const valueType: IrType = {
      kind: "unionType",
      types: [
        { kind: "primitiveType", name: "string" },
        {
          kind: "functionType",
          parameters: [],
          returnType: { kind: "voidType" },
        },
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
          kind: "functionDeclaration",
          name: "check",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "value" },
              type: valueType,
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: { kind: "primitiveType", name: "boolean" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "returnStatement",
                expression: {
                  kind: "binary",
                  operator: "==",
                  left: {
                    kind: "identifier",
                    name: "value",
                    inferredType: valueType,
                  },
                  right: { kind: "literal", value: undefined },
                  inferredType: { kind: "primitiveType", name: "boolean" },
                },
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

    const result = emitModule(module);

    expect(result).to.include("((global::System.Object)(value)) == null");
    expect(result).to.not.include("value == null");
  });
});
