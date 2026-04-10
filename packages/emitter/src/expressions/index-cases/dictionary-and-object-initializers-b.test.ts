import {
  describe,
  it,
  expect,
  emitModule,
  type IrModule,
  type IrType,
} from "./helpers.js";
import { printRuntimeUnionCarrierTypeForIrType } from "../../runtime-union-cases/helpers.js";

describe("Expression Emission", () => {
  it("should upcast dictionary values into union wrappers for expected dictionary union types", () => {
    const valueUnionType: IrType = {
      kind: "unionType",
      types: [
        { kind: "referenceType", name: "int" },
        { kind: "primitiveType", name: "string" },
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
              name: { kind: "identifierPattern", name: "widened" },
              type: {
                kind: "dictionaryType",
                keyType: { kind: "primitiveType", name: "string" },
                valueType: valueUnionType,
              },
              initializer: {
                kind: "identifier",
                name: "raw",
                inferredType: {
                  kind: "dictionaryType",
                  keyType: { kind: "primitiveType", name: "string" },
                  valueType: { kind: "referenceType", name: "int" },
                },
              },
            },
          ],
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    const unionType = printRuntimeUnionCarrierTypeForIrType(valueUnionType, [
      { kind: "predefinedType", keyword: "string" },
      { kind: "predefinedType", keyword: "int" },
    ]);
    expect(result).to.include("global::System.Linq.Enumerable.ToDictionary");
    expect(result).to.include(`${unionType}.From2`);
  });

  it("should not upcast when dictionary value type already matches union runtime type", () => {
    const unionType: IrType = {
      kind: "unionType",
      types: [
        { kind: "referenceType", name: "int" },
        { kind: "primitiveType", name: "string" },
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
              name: { kind: "identifierPattern", name: "alreadyWide" },
              type: {
                kind: "dictionaryType",
                keyType: { kind: "primitiveType", name: "string" },
                valueType: unionType,
              },
              initializer: {
                kind: "identifier",
                name: "input",
                inferredType: {
                  kind: "dictionaryType",
                  keyType: { kind: "primitiveType", name: "string" },
                  valueType: unionType,
                },
              },
            },
          ],
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).not.to.include(
      "global::System.Linq.Enumerable.ToDictionary"
    );
  });

  it("should lower symbol-key dictionary undefined checks to ContainsKey", () => {
    const dictType: IrType = {
      kind: "dictionaryType",
      keyType: { kind: "referenceType", name: "object" },
      valueType: { kind: "primitiveType", name: "number" },
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
          kind: "ifStatement",
          condition: {
            kind: "binary",
            operator: "===",
            left: {
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "dict",
                inferredType: dictType,
              },
              property: { kind: "identifier", name: "key" },
              isComputed: true,
              isOptional: false,
              accessKind: "dictionary",
              inferredType: { kind: "primitiveType", name: "number" },
            },
            right: { kind: "identifier", name: "undefined" },
          },
          thenStatement: {
            kind: "blockStatement",
            statements: [],
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("!(dict).ContainsKey(key)");
    expect(result).to.not.include("dict[key] == null");
  });

  it("should lower delete on symbol-key dictionary access to Remove", () => {
    const dictType: IrType = {
      kind: "dictionaryType",
      keyType: { kind: "referenceType", name: "object" },
      valueType: { kind: "primitiveType", name: "number" },
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
          kind: "expressionStatement",
          expression: {
            kind: "unary",
            operator: "delete",
            expression: {
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "dict",
                inferredType: dictType,
              },
              property: { kind: "identifier", name: "key" },
              isComputed: true,
              isOptional: false,
              accessKind: "dictionary",
            },
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module);
    expect(result).to.include("dict.Remove(key);");
  });

  it("should hard-fail unsupported delete targets instead of emitting comment placeholders", () => {
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
            kind: "unary",
            operator: "delete",
            expression: {
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "obj",
                inferredType: {
                  kind: "objectType",
                  members: [
                    {
                      kind: "propertySignature",
                      name: "value",
                      type: { kind: "primitiveType", name: "number" },
                      isOptional: false,
                      isReadonly: false,
                    },
                  ],
                },
              },
              property: "value",
              isComputed: false,
              isOptional: false,
            },
          },
        },
      ],
      exports: [],
    };

    expect(() => emitModule(module)).to.throw(
      "ICE: Unsupported delete target reached emitter"
    );
  });

  it("should hard-fail compound destructuring assignments instead of emitting fake identifiers", () => {
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
            kind: "assignment",
            operator: "+=",
            left: {
              kind: "arrayPattern",
              elements: [
                {
                  pattern: {
                    kind: "identifierPattern",
                    name: "x",
                  },
                },
              ],
            },
            right: { kind: "literal", value: 1 },
          },
        },
      ],
      exports: [],
    };

    expect(() => emitModule(module)).to.throw(
      "ICE: Compound assignment to array/object destructuring pattern reached emitter"
    );
  });

  it("should hard-fail object spreads that reach emission without inferred source types", () => {
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
          name: "Target",
          typeParameters: [],
          extends: [],
          members: [
            {
              kind: "propertySignature",
              name: "count",
              type: { kind: "primitiveType", name: "number" },
              isOptional: false,
              isReadonly: false,
            },
          ],
          isExported: false,
          isStruct: false,
        },
        {
          kind: "variableDeclaration",
          declarationKind: "const",
          isExported: false,
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "value" },
              type: { kind: "referenceType", name: "Target" },
              initializer: {
                kind: "object",
                hasSpreads: true,
                inferredType: { kind: "referenceType", name: "Target" },
                properties: [
                  {
                    kind: "spread",
                    expression: {
                      kind: "identifier",
                      name: "source",
                    },
                  },
                  {
                    kind: "property",
                    key: "count",
                    value: { kind: "literal", value: 1 },
                    shorthand: false,
                  },
                ],
              },
            },
          ],
        },
      ],
      exports: [],
    };

    expect(() => emitModule(module)).to.throw("ICE: Object spread source");
  });
});
