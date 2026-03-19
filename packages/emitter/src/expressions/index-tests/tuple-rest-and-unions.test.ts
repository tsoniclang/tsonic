import { describe, it, expect, emitModule, type IrModule } from "./helpers.js";

describe("Expression Emission", () => {
  it("should preserve contextual char typing for ternary single-character literals", () => {
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
              name: { kind: "identifierPattern", name: "value" },
              type: { kind: "primitiveType", name: "char" },
              initializer: {
                kind: "conditional",
                condition: { kind: "literal", value: false },
                whenTrue: { kind: "literal", value: "m" },
                whenFalse: { kind: "literal", value: "n" },
                inferredType: { kind: "primitiveType", name: "char" },
              },
            },
          ],
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("char value = false ? 'm' : 'n';");
    expect(result).not.to.include('false ? "m" : "n"');
  });

  it("keeps mutable char locals in char/string single-character comparisons", () => {
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
          name: "main",
          isAsync: false,
          isGenerator: false,
          isExported: false,
          parameters: [],
          returnType: { kind: "voidType" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "variableDeclaration",
                declarationKind: "let",
                isExported: false,
                declarations: [
                  {
                    kind: "variableDeclarator",
                    name: { kind: "identifierPattern", name: "c" },
                    type: { kind: "primitiveType", name: "char" },
                    initializer: { kind: "literal", value: "x" },
                  },
                ],
              },
              {
                kind: "expressionStatement",
                expression: {
                  kind: "assignment",
                  operator: "=",
                  left: {
                    kind: "identifier",
                    name: "c",
                    inferredType: { kind: "primitiveType", name: "char" },
                  },
                  right: { kind: "literal", value: "y" },
                  inferredType: { kind: "primitiveType", name: "char" },
                },
              },
              {
                kind: "expressionStatement",
                expression: {
                  kind: "binary",
                  operator: "===",
                  left: {
                    kind: "identifier",
                    name: "c",
                    inferredType: { kind: "primitiveType", name: "string" },
                  },
                  right: { kind: "literal", value: "y" },
                  inferredType: { kind: "primitiveType", name: "boolean" },
                },
              },
            ],
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("char c = 'x';");
    expect(result).to.include("c = 'y';");
    expect(result).to.include("c == 'y';");
    expect(result).not.to.include("(string)c == 'y'");
  });

  it("should lower tuple-rest function value calls as positional arguments", () => {
    const tupleRestType = {
      kind: "unionType" as const,
      types: [
        { kind: "tupleType" as const, elementTypes: [] },
        {
          kind: "tupleType" as const,
          elementTypes: [
            { kind: "primitiveType" as const, name: "number" as const },
          ],
        },
      ],
    } as const;

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
              name: "next",
              inferredType: {
                kind: "functionType",
                parameters: [
                  {
                    kind: "parameter",
                    pattern: { kind: "identifierPattern", name: "args" },
                    type: tupleRestType,
                    isOptional: false,
                    isRest: true,
                    passing: "value",
                  },
                ],
                returnType: { kind: "unknownType" },
              },
            },
            arguments: [{ kind: "literal", value: 5, numericIntent: "Int32" }],
            isOptional: false,
            parameterTypes: [tupleRestType],
            inferredType: { kind: "unknownType" },
            sourceSpan: {
              file: "/src/test.ts",
              line: 1,
              column: 1,
              length: 7,
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("next(5)");
    expect(result).to.not.include("new object[] { 5 }");
  });
});
