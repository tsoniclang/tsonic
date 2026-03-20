import { describe, it, expect, emitModule } from "./helpers.js";
import type { IrModule, IrType } from "./helpers.js";
describe("Statement Emission", () => {
  it("maps `in`-guards to original runtime union members after earlier narrowing through transparent assertions", () => {
    const shape0: IrType = { kind: "referenceType", name: "Shape__0" };
    const shape1: IrType = { kind: "referenceType", name: "Shape__1" };
    const shape2: IrType = { kind: "referenceType", name: "Shape__2" };

    const narrowed12: IrType = {
      kind: "unionType",
      types: [shape1, shape2],
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
          name: "Shape__0",
          typeParameters: [],
          extends: [],
          members: [
            {
              kind: "propertySignature",
              name: "a",
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
          name: "Shape__1",
          typeParameters: [],
          extends: [],
          members: [
            {
              kind: "propertySignature",
              name: "b",
              type: { kind: "primitiveType", name: "number" },
              isOptional: false,
              isReadonly: false,
            },
          ],
          isExported: false,
          isStruct: false,
        },
        {
          kind: "interfaceDeclaration",
          name: "Shape__2",
          typeParameters: [],
          extends: [],
          members: [
            {
              kind: "propertySignature",
              name: "c",
              type: { kind: "primitiveType", name: "boolean" },
              isOptional: false,
              isReadonly: false,
            },
          ],
          isExported: false,
          isStruct: false,
        },
        {
          kind: "typeAliasDeclaration",
          name: "Shape",
          typeParameters: [],
          type: {
            kind: "unionType",
            types: [shape0, shape1, shape2],
          },
          isExported: false,
          isStruct: false,
        },
        {
          kind: "functionDeclaration",
          name: "fmt",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "s" },
              type: { kind: "referenceType", name: "Shape" },
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
                  left: { kind: "literal", value: "a", raw: '"a"' },
                  right: {
                    kind: "identifier",
                    name: "s",
                    inferredType: { kind: "referenceType", name: "Shape" },
                  },
                },
                thenStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: { kind: "literal", value: "A" },
                    },
                  ],
                },
              },
              {
                kind: "ifStatement",
                condition: {
                  kind: "binary",
                  operator: "in",
                  left: { kind: "literal", value: "b", raw: '"b"' },
                  right: {
                    kind: "typeAssertion",
                    expression: {
                      kind: "identifier",
                      name: "s",
                      inferredType: narrowed12,
                    },
                    targetType: narrowed12,
                    inferredType: narrowed12,
                  },
                },
                thenStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: { kind: "literal", value: "B" },
                    },
                  ],
                },
              },
              {
                kind: "ifStatement",
                condition: {
                  kind: "binary",
                  operator: "in",
                  left: { kind: "literal", value: "c", raw: '"c"' },
                  right: {
                    kind: "typeAssertion",
                    expression: {
                      kind: "identifier",
                      name: "s",
                      inferredType: { kind: "referenceType", name: "Shape__2" },
                    },
                    targetType: { kind: "referenceType", name: "Shape__2" },
                    inferredType: { kind: "referenceType", name: "Shape__2" },
                  },
                },
                thenStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: { kind: "literal", value: "C" },
                    },
                  ],
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

    expect(result).to.include("if (s.Is1())");
    expect(result).to.include("if (s.Is2())");
    expect(result).to.include("if (true)");
    expect(result).to.not.include("s.Match(");
  });

  it("maps discriminant guards through transparent assertion wrappers after earlier narrowing", () => {
    const shape0: IrType = { kind: "referenceType", name: "Shape__0" };
    const shape1: IrType = { kind: "referenceType", name: "Shape__1" };
    const shape2: IrType = { kind: "referenceType", name: "Shape__2" };

    const narrowed12: IrType = {
      kind: "unionType",
      types: [shape1, shape2],
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
          name: "Shape__0",
          typeParameters: [],
          extends: [],
          members: [
            {
              kind: "propertySignature",
              name: "kind",
              type: { kind: "literalType", value: "a" },
              isOptional: false,
              isReadonly: false,
            },
          ],
          isExported: false,
          isStruct: false,
        },
        {
          kind: "interfaceDeclaration",
          name: "Shape__1",
          typeParameters: [],
          extends: [],
          members: [
            {
              kind: "propertySignature",
              name: "kind",
              type: { kind: "literalType", value: "b" },
              isOptional: false,
              isReadonly: false,
            },
          ],
          isExported: false,
          isStruct: false,
        },
        {
          kind: "interfaceDeclaration",
          name: "Shape__2",
          typeParameters: [],
          extends: [],
          members: [
            {
              kind: "propertySignature",
              name: "kind",
              type: { kind: "literalType", value: "c" },
              isOptional: false,
              isReadonly: false,
            },
          ],
          isExported: false,
          isStruct: false,
        },
        {
          kind: "typeAliasDeclaration",
          name: "Shape",
          typeParameters: [],
          type: {
            kind: "unionType",
            types: [shape0, shape1, shape2],
          },
          isExported: false,
          isStruct: false,
        },
        {
          kind: "functionDeclaration",
          name: "fmt",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "s" },
              type: { kind: "referenceType", name: "Shape" },
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
                  operator: "===",
                  left: {
                    kind: "memberAccess",
                    object: {
                      kind: "identifier",
                      name: "s",
                      inferredType: { kind: "referenceType", name: "Shape" },
                    },
                    property: "kind",
                    isComputed: false,
                    isOptional: false,
                  },
                  right: { kind: "literal", value: "a", raw: '"a"' },
                },
                thenStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: { kind: "literal", value: "A" },
                    },
                  ],
                },
              },
              {
                kind: "ifStatement",
                condition: {
                  kind: "binary",
                  operator: "===",
                  left: {
                    kind: "memberAccess",
                    object: {
                      kind: "typeAssertion",
                      expression: {
                        kind: "identifier",
                        name: "s",
                        inferredType: narrowed12,
                      },
                      targetType: narrowed12,
                      inferredType: narrowed12,
                    },
                    property: "kind",
                    isComputed: false,
                    isOptional: false,
                  },
                  right: { kind: "literal", value: "b", raw: '"b"' },
                },
                thenStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: { kind: "literal", value: "B" },
                    },
                  ],
                },
              },
              {
                kind: "ifStatement",
                condition: {
                  kind: "binary",
                  operator: "===",
                  left: {
                    kind: "memberAccess",
                    object: {
                      kind: "typeAssertion",
                      expression: {
                        kind: "identifier",
                        name: "s",
                        inferredType: {
                          kind: "referenceType",
                          name: "Shape__2",
                        },
                      },
                      targetType: { kind: "referenceType", name: "Shape__2" },
                      inferredType: { kind: "referenceType", name: "Shape__2" },
                    },
                    property: "kind",
                    isComputed: false,
                    isOptional: false,
                  },
                  right: { kind: "literal", value: "c", raw: '"c"' },
                },
                thenStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: { kind: "literal", value: "C" },
                    },
                  ],
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

    expect(result).to.include("if (s.Is1())");
    expect(result).to.include("if (s.Is2())");
    expect(result).to.include('if ((s.As3()).kind == "c")');
    expect(result).to.not.include("s.Match(");
  });
});
