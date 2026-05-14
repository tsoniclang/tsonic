import {
  describe,
  it,
  expect,
  emitModule,
  testIfStatement,
} from "./helpers.js";
import type { IrModule, IrType } from "./helpers.js";
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
              testIfStatement({
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
              }),
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
              testIfStatement({
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
              }),
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
                  {
                    kind: "referenceType",
                    name: "Uint8Array",
                    resolvedClrType: "js.Uint8Array",
                  },
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
              testIfStatement({
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
                        {
                          kind: "referenceType",
                          name: "Uint8Array",
                          resolvedClrType: "js.Uint8Array",
                        },
                      ],
                    },
                  },
                  right: {
                    kind: "identifier",
                    name: "Uint8Array",
                    inferredType: {
                      kind: "referenceType",
                      name: "Uint8Array",
                      resolvedClrType: "js.Uint8Array",
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
              }),
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
    expect(result).to.match(
      /Uint8Array value__is_1 = \(.*Uint8Array\)value\.As2\(\);/
    );
    expect(result).to.not.include("Uint8ArrayConstructor");
  });

  it("applies complement narrowing inside explicit instanceof else branches", () => {
    const readableType: IrType = {
      kind: "referenceType",
      name: "Readable",
    };
    const interfaceOptionsType: IrType = {
      kind: "referenceType",
      name: "InterfaceOptions",
      structuralMembers: [
        {
          kind: "propertySignature",
          name: "input",
          type: readableType,
          isOptional: false,
          isReadonly: false,
        },
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
          kind: "classDeclaration",
          name: "Readable",
          isExported: false,
          isStruct: false,
          typeParameters: [],
          implements: [],
          members: [],
        },
        {
          kind: "classDeclaration",
          name: "InterfaceOptions",
          isExported: false,
          isStruct: false,
          typeParameters: [],
          implements: [],
          members: [
            {
              kind: "propertyDeclaration",
              name: "input",
              type: readableType,
              isStatic: false,
              isReadonly: false,
              accessibility: "public",
              isRequired: false,
            },
          ],
        },
        {
          kind: "functionDeclaration",
          name: "createInterface",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "optionsOrInput" },
              type: {
                kind: "unionType",
                types: [interfaceOptionsType, readableType],
              },
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: interfaceOptionsType,
          body: {
            kind: "blockStatement",
            statements: [
              testIfStatement({
                kind: "ifStatement",
                condition: {
                  kind: "binary",
                  operator: "instanceof",
                  left: {
                    kind: "identifier",
                    name: "optionsOrInput",
                    inferredType: {
                      kind: "unionType",
                      types: [interfaceOptionsType, readableType],
                    },
                  },
                  right: {
                    kind: "identifier",
                    name: "InterfaceOptions",
                    inferredType: interfaceOptionsType,
                  },
                },
                thenStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: {
                        kind: "identifier",
                        name: "optionsOrInput",
                        inferredType: interfaceOptionsType,
                      },
                    },
                  ],
                },
                elseStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "variableDeclaration",
                      declarationKind: "const",
                      isExported: false,
                      declarations: [
                        {
                          kind: "variableDeclarator",
                          name: { kind: "identifierPattern", name: "options" },
                          type: interfaceOptionsType,
                          initializer: {
                            kind: "new",
                            callee: {
                              kind: "identifier",
                              name: "InterfaceOptions",
                              inferredType: interfaceOptionsType,
                            },
                            arguments: [],
                            inferredType: interfaceOptionsType,
                          },
                        },
                      ],
                    },
                    {
                      kind: "expressionStatement",
                      expression: {
                        kind: "assignment",
                        left: {
                          kind: "memberAccess",
                          object: {
                            kind: "identifier",
                            name: "options",
                            inferredType: interfaceOptionsType,
                          },
                          property: "input",
                          isOptional: false,
                          isComputed: false,
                          inferredType: readableType,
                        },
                        right: {
                          kind: "identifier",
                          name: "optionsOrInput",
                          inferredType: {
                            kind: "unionType",
                            types: [interfaceOptionsType, readableType],
                          },
                        },
                        operator: "=",
                        inferredType: readableType,
                      },
                    },
                    {
                      kind: "returnStatement",
                      expression: {
                        kind: "identifier",
                        name: "options",
                        inferredType: interfaceOptionsType,
                      },
                    },
                  ],
                },
              }),
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

    expect(result).to.include("if (optionsOrInput.Is1())");
    expect(result).to.include("options.input = (optionsOrInput.As2());");
    expect(result).to.not.include("options.input = optionsOrInput;");
  });

  it("emits runtime-union typeof and Array.isArray guards against member slots", () => {
    const unionType: IrType = {
      kind: "unionType",
      types: [
        {
          kind: "arrayType",
          elementType: { kind: "primitiveType", name: "string" },
        },
        { kind: "primitiveType", name: "string" },
        { kind: "primitiveType", name: "number" },
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
          name: "classify",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "value" },
              type: unionType,
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: { kind: "primitiveType", name: "number" },
          body: {
            kind: "blockStatement",
            statements: [
              testIfStatement({
                kind: "ifStatement",
                condition: {
                  kind: "binary",
                  operator: "===",
                  left: {
                    kind: "unary",
                    operator: "typeof",
                    expression: {
                      kind: "identifier",
                      name: "value",
                      inferredType: unionType,
                    },
                  },
                  right: { kind: "literal", value: "string" },
                },
                thenStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: { kind: "literal", value: 1 },
                    },
                  ],
                },
              }),
              testIfStatement({
                kind: "ifStatement",
                condition: {
                  kind: "call",
                  callee: {
                    kind: "memberAccess",
                    object: { kind: "identifier", name: "Array" },
                    property: "isArray",
                    isComputed: false,
                    isOptional: false,
                  },
                  arguments: [
                    {
                      kind: "identifier",
                      name: "value",
                      inferredType: unionType,
                    },
                  ],
                  isOptional: false,
                  inferredType: { kind: "primitiveType", name: "boolean" },
                },
                thenStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: { kind: "literal", value: 2 },
                    },
                  ],
                },
              }),
              {
                kind: "returnStatement",
                expression: { kind: "literal", value: 3 },
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

    expect(result).to.include("value.Is3()");
    expect(result).to.include(".Is1())");
    expect(result).to.not.include("@typeof(value)");
    expect(result).to.not.include("Array.isArray(");
  });

  it("does not emit runtime-union slot guards for concretely stored locals", () => {
    const nextControlType: IrType = {
      kind: "unionType",
      types: [
        { kind: "literalType", value: "route" },
        { kind: "literalType", value: "router" },
        { kind: "primitiveType", name: "string" },
        { kind: "primitiveType", name: "null" },
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
          parameters: [],
          returnType: { kind: "primitiveType", name: "number" },
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
                    name: { kind: "identifierPattern", name: "control" },
                    type: nextControlType,
                    initializer: {
                      kind: "literal",
                      value: undefined,
                      inferredType: {
                        kind: "primitiveType",
                        name: "undefined",
                      },
                    },
                  },
                ],
              },
              testIfStatement({
                kind: "ifStatement",
                condition: {
                  kind: "logical",
                  operator: "&&",
                  left: {
                    kind: "binary",
                    operator: "===",
                    left: {
                      kind: "unary",
                      operator: "typeof",
                      expression: {
                        kind: "identifier",
                        name: "control",
                        inferredType: nextControlType,
                      },
                      inferredType: { kind: "primitiveType", name: "string" },
                    },
                    right: {
                      kind: "literal",
                      value: "string",
                      raw: '"string"',
                      inferredType: { kind: "literalType", value: "string" },
                    },
                    inferredType: { kind: "primitiveType", name: "boolean" },
                  },
                  right: {
                    kind: "binary",
                    operator: "!==",
                    left: {
                      kind: "identifier",
                      name: "control",
                      inferredType: nextControlType,
                    },
                    right: {
                      kind: "literal",
                      value: "",
                      raw: '""',
                      inferredType: { kind: "literalType", value: "" },
                    },
                    inferredType: { kind: "primitiveType", name: "boolean" },
                  },
                },
                thenStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: { kind: "literal", value: 1 },
                    },
                  ],
                },
              }),
              {
                kind: "returnStatement",
                expression: { kind: "literal", value: 0 },
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

    expect(result).to.not.include("control.Is1()");
    expect(result).to.not.include("control.Is2()");
    expect(result).to.not.include("control.Is3()");
  });

  it("keeps Array.isArray on runtime carriers after instanceof fallthrough narrowing", () => {
    const pathSpecType: IrType = {
      kind: "unionType",
      types: [
        {
          kind: "arrayType",
          elementType: {
            kind: "referenceType",
            name: "JsValue",
            resolvedClrType: "Tsonic.Runtime.JsValue",
          },
          origin: "explicit",
        },
        { kind: "primitiveType", name: "string" },
        {
          kind: "referenceType",
          name: "RegExp",
          resolvedClrType: "js.RegExp",
        },
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
              pattern: { kind: "identifierPattern", name: "pathSpec" },
              type: pathSpecType,
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: { kind: "primitiveType", name: "boolean" },
          body: {
            kind: "blockStatement",
            statements: [
              testIfStatement({
                kind: "ifStatement",
                condition: {
                  kind: "binary",
                  operator: "===",
                  left: {
                    kind: "unary",
                    operator: "typeof",
                    expression: {
                      kind: "identifier",
                      name: "pathSpec",
                      inferredType: pathSpecType,
                    },
                  },
                  right: { kind: "literal", value: "string" },
                },
                thenStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: { kind: "literal", value: false },
                    },
                  ],
                },
              }),
              testIfStatement({
                kind: "ifStatement",
                condition: {
                  kind: "binary",
                  operator: "instanceof",
                  left: {
                    kind: "identifier",
                    name: "pathSpec",
                    inferredType: pathSpecType,
                  },
                  right: {
                    kind: "identifier",
                    name: "RegExp",
                    inferredType: {
                      kind: "referenceType",
                      name: "RegExp",
                      resolvedClrType: "js.RegExp",
                    },
                  },
                },
                thenStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: { kind: "literal", value: false },
                    },
                  ],
                },
              }),
              testIfStatement({
                kind: "ifStatement",
                condition: {
                  kind: "call",
                  callee: {
                    kind: "memberAccess",
                    object: { kind: "identifier", name: "Array" },
                    property: "isArray",
                    isComputed: false,
                    isOptional: false,
                  },
                  arguments: [
                    {
                      kind: "identifier",
                      name: "pathSpec",
                      inferredType: pathSpecType,
                    },
                  ],
                  isOptional: false,
                  inferredType: { kind: "primitiveType", name: "boolean" },
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
              }),
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

    expect(result).to.include(".Is1())");
    expect(result).to.not.include("(pathSpec.As1()).Is1()");
    expect(result).to.not.include("Array.isArray(pathSpec)");
  });
});
