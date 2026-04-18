import { describe, it, expect, emitModule, type IrModule } from "./helpers.js";

describe("Expression Emission", () => {
  it("should preserve logical operator grouping with parentheses", () => {
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
            kind: "logical",
            operator: "&&",
            left: {
              kind: "identifier",
              name: "a",
              inferredType: { kind: "primitiveType", name: "boolean" },
            },
            right: {
              kind: "logical",
              operator: "||",
              left: {
                kind: "identifier",
                name: "b",
                inferredType: { kind: "primitiveType", name: "boolean" },
              },
              right: {
                kind: "identifier",
                name: "c",
                inferredType: { kind: "primitiveType", name: "boolean" },
              },
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    // Without parentheses this becomes a && b || c, which changes meaning.
    expect(result).to.include("a && (b || c)");
  });

  it("should unwrap nullable value types when a non-nullable value is expected", () => {
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
            callee: { kind: "identifier", name: "useLong" },
            arguments: [
              {
                kind: "identifier",
                name: "id",
                inferredType: {
                  kind: "unionType",
                  types: [
                    { kind: "referenceType", name: "long" },
                    { kind: "primitiveType", name: "null" },
                  ],
                },
              },
            ],
            isOptional: false,
            parameterTypes: [{ kind: "referenceType", name: "long" }],
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include("useLong((long)id)");
  });

  it("should not double-unwrap member-access nullable guards (no .Value.Value)", () => {
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
              object: { kind: "identifier", name: "updates" },
              property: "active",
              isComputed: false,
              isOptional: false,
              inferredType: {
                kind: "unionType",
                types: [
                  { kind: "referenceType", name: "int" },
                  { kind: "primitiveType", name: "undefined" },
                ],
              },
            },
            right: { kind: "identifier", name: "undefined" },
          },
          thenStatement: {
            kind: "blockStatement",
            statements: [
              {
                kind: "expressionStatement",
                expression: {
                  kind: "call",
                  callee: { kind: "identifier", name: "useInt" },
                  arguments: [
                    {
                      kind: "memberAccess",
                      object: { kind: "identifier", name: "updates" },
                      property: "active",
                      isComputed: false,
                      isOptional: false,
                      inferredType: {
                        kind: "unionType",
                        types: [
                          { kind: "referenceType", name: "int" },
                          { kind: "primitiveType", name: "undefined" },
                        ],
                      },
                    },
                  ],
                  isOptional: false,
                  parameterTypes: [{ kind: "referenceType", name: "int" }],
                },
              },
            ],
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("updates.active.Value");
    expect(result).to.not.include("useInt(updates.active);");
    expect(result).to.not.include("updates.active.Value.Value");
  });

  it("should reuse the narrowed member read in comparisons and string calls", () => {
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
              object: { kind: "identifier", name: "rule" },
              property: "maxCount",
              isComputed: false,
              isOptional: false,
              inferredType: {
                kind: "unionType",
                types: [
                  { kind: "referenceType", name: "double" },
                  { kind: "primitiveType", name: "undefined" },
                ],
              },
            },
            right: { kind: "identifier", name: "undefined" },
          },
          thenStatement: {
            kind: "blockStatement",
            statements: [
              {
                kind: "ifStatement",
                condition: {
                  kind: "binary",
                  operator: ">",
                  left: {
                    kind: "identifier",
                    name: "nextCount",
                    inferredType: {
                      kind: "referenceType",
                      name: "double",
                    },
                  },
                  right: {
                    kind: "memberAccess",
                    object: { kind: "identifier", name: "rule" },
                    property: "maxCount",
                    isComputed: false,
                    isOptional: false,
                    inferredType: {
                      kind: "unionType",
                      types: [
                        { kind: "referenceType", name: "double" },
                        { kind: "primitiveType", name: "undefined" },
                      ],
                    },
                  },
                },
                thenStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "expressionStatement",
                      expression: {
                        kind: "call",
                        callee: { kind: "identifier", name: "String" },
                        arguments: [
                          {
                            kind: "memberAccess",
                            object: { kind: "identifier", name: "rule" },
                            property: "maxCount",
                            isComputed: false,
                            isOptional: false,
                            inferredType: {
                              kind: "unionType",
                              types: [
                                { kind: "referenceType", name: "double" },
                                { kind: "primitiveType", name: "undefined" },
                              ],
                            },
                          },
                        ],
                        isOptional: false,
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("nextCount > rule.maxCount.Value");
    expect(result).to.include("String(rule.maxCount.Value)");
    expect(result).to.not.include("rule.maxCount.Value.Value");
  });

  it("should not fold value-type undefined guards to constants", () => {
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
                name: "updates",
              },
              property: "count",
              isComputed: false,
              isOptional: false,
              inferredType: {
                kind: "primitiveType",
                name: "int",
              },
            },
            right: {
              kind: "identifier",
              name: "undefined",
            },
          },
          thenStatement: {
            kind: "blockStatement",
            statements: [
              {
                kind: "expressionStatement",
                expression: {
                  kind: "call",
                  callee: { kind: "identifier", name: "touch" },
                  arguments: [
                    {
                      kind: "identifier",
                      name: "updates",
                    },
                  ],
                  isOptional: false,
                },
              },
            ],
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include(
      "if (((global::System.Object)(updates.count)) != null)"
    );
    expect(result).to.not.include("if (true)");
  });

  it("should lower string relational comparisons via CompareOrdinal", () => {
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
            kind: "binary",
            operator: ">",
            left: {
              kind: "identifier",
              name: "a",
              inferredType: { kind: "primitiveType", name: "string" },
            },
            right: {
              kind: "identifier",
              name: "b",
              inferredType: { kind: "primitiveType", name: "string" },
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("global::System.String.CompareOrdinal(a, b) > 0");
    expect(result).to.not.include("a > b");
  });

  it("does not cast non-literal numeric comparison operands from the other side's exact int type", () => {
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
            kind: "binary",
            operator: ">",
            left: {
              kind: "identifier",
              name: "ticks",
              inferredType: { kind: "referenceType", name: "long" },
            },
            right: {
              kind: "literal",
              value: 0,
              inferredType: { kind: "referenceType", name: "int" },
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("ticks >");
    expect(result).to.not.include("(int)ticks");
  });

  it("does not wrap non-literal numeric comparison expressions in cosmetic int casts", () => {
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
            kind: "binary",
            operator: "===",
            left: {
              kind: "binary",
              operator: "%",
              left: {
                kind: "identifier",
                name: "n",
                inferredType: { kind: "referenceType", name: "int" },
              },
              right: {
                kind: "literal",
                value: 2,
                inferredType: { kind: "referenceType", name: "int" },
              },
              inferredType: { kind: "primitiveType", name: "number" },
            },
            right: {
              kind: "literal",
              value: 0,
              inferredType: { kind: "referenceType", name: "int" },
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("n % 2");
    expect(result).to.not.include("(int)(n % 2)");
  });
});
