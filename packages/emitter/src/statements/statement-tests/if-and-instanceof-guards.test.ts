import { describe, it, expect, emitModule } from "./helpers.js";
import type { IrModule } from "./helpers.js";
describe("Statement Emission", () => {
  it("should emit if statements", () => {
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
              pattern: { kind: "identifierPattern", name: "x" },
              type: { kind: "primitiveType", name: "number" },
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
                  operator: ">",
                  left: { kind: "identifier", name: "x" },
                  right: { kind: "literal", value: 0 },
                },
                thenStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: { kind: "literal", value: "positive" },
                    },
                  ],
                },
                elseStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: {
                        kind: "literal",
                        value: "negative or zero",
                      },
                    },
                  ],
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

    // Binary comparison emits with truthiness check
    expect(result).to.include("if (x > 0");
    expect(result).to.include('return "positive"');
    expect(result).to.include("else");
    expect(result).to.include('return "negative or zero"');
  });

  it("should emit instanceof guards as declaration patterns, not synthetic text expressions", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "classDeclaration",
          name: "Widget",
          isExported: false,
          isStruct: false,
          typeParameters: [],
          implements: [],
          members: [],
        },
        {
          kind: "functionDeclaration",
          name: "isWidget",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "value" },
              type: { kind: "referenceType", name: "object" },
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
                kind: "ifStatement",
                condition: {
                  kind: "binary",
                  operator: "instanceof",
                  left: {
                    kind: "identifier",
                    name: "value",
                    inferredType: { kind: "referenceType", name: "object" },
                  },
                  right: {
                    kind: "identifier",
                    name: "Widget",
                    inferredType: { kind: "referenceType", name: "Widget" },
                  },
                },
                thenStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: { kind: "literal", value: true },
                    },
                  ],
                },
                elseStatement: undefined,
              },
              {
                kind: "returnStatement",
                expression: { kind: "literal", value: false },
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

    expect(result).to.include("if (value is Widget value__is_1)");
    expect(result).to.include("return true;");
    expect(result).to.include("return false;");
  });

  it("normalizes JS constructor reference types in instanceof guards to instance types", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "classDeclaration",
          name: "Uint8Array",
          isExported: false,
          isStruct: false,
          typeParameters: [],
          implements: [],
          members: [],
        },
        {
          kind: "functionDeclaration",
          name: "isBytes",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "value" },
              type: {
                kind: "unionType",
                types: [
                  { kind: "primitiveType", name: "string" },
                  { kind: "referenceType", name: "Uint8Array" },
                ],
              },
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
                kind: "ifStatement",
                condition: {
                  kind: "binary",
                  operator: "instanceof",
                  left: {
                    kind: "identifier",
                    name: "value",
                    inferredType: {
                      kind: "unionType",
                      types: [
                        { kind: "primitiveType", name: "string" },
                        { kind: "referenceType", name: "Uint8Array" },
                      ],
                    },
                  },
                  right: {
                    kind: "identifier",
                    name: "Uint8Array",
                    inferredType: {
                      kind: "referenceType",
                      name: "Uint8ArrayConstructor",
                      resolvedClrType: "Tsonic.JSRuntime.Uint8Array",
                    },
                  },
                },
                thenStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: { kind: "literal", value: true },
                    },
                  ],
                },
                elseStatement: undefined,
              },
              {
                kind: "returnStatement",
                expression: { kind: "literal", value: false },
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

    expect(result).to.include("if (value.Is2())");
    expect(result).to.include(
      "Uint8Array value__is_1 = (Uint8Array)value.As2();"
    );
    expect(result).to.not.include("Uint8ArrayConstructor");
  });

});
