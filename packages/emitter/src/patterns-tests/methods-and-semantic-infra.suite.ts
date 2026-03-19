import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "../emitter.js";
import { IrModule, type IrType } from "@tsonic/frontend";
import { arrayType, createModule, numberType, stringType } from "./helpers.js";

describe("Destructuring Pattern Lowering", () => {
  describe("Method Parameter Destructuring", () => {
    it("should lower destructuring in class method parameters", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "TestApp",
        className: "Calculator",
        isStaticContainer: false,
        imports: [],
        body: [
          {
            kind: "classDeclaration",
            name: "Calculator",
            members: [
              {
                kind: "methodDeclaration",
                name: "add",
                parameters: [
                  {
                    kind: "parameter",
                    pattern: {
                      kind: "arrayPattern",
                      elements: [
                        {
                          pattern: { kind: "identifierPattern", name: "x" },
                          isRest: false,
                        },
                        {
                          pattern: { kind: "identifierPattern", name: "y" },
                          isRest: false,
                        },
                      ],
                    },
                    type: arrayType(numberType),
                    isOptional: false,
                    isRest: false,
                    passing: "value",
                  },
                ],
                returnType: numberType,
                body: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: {
                        kind: "binary",
                        operator: "+",
                        left: { kind: "identifier", name: "x" },
                        right: { kind: "identifier", name: "y" },
                      },
                    },
                  ],
                },
                accessibility: "public",
                isStatic: false,
                isAsync: false,
                isGenerator: false,
              },
            ],
            isExported: true,
            typeParameters: [],
            implements: [],
            isStruct: false,
          },
        ],
        exports: [],
      };

      const result = emitModule(module);

      // Should use synthetic parameter name in method signature
      expect(result).to.include("__param0");
      // Should destructure at start of method body (with element type)
      expect(result).to.include("double x = __arr0[0];");
      expect(result).to.include("double y = __arr0[1];");
    });
  });

  describe("Constructor Parameter Destructuring", () => {
    it("should lower destructuring in constructor parameters", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "TestApp",
        className: "Point",
        isStaticContainer: false,
        imports: [],
        body: [
          {
            kind: "classDeclaration",
            name: "Point",
            members: [
              {
                kind: "propertyDeclaration",
                name: "x",
                type: numberType,
                accessibility: "public",
                isStatic: false,
                isReadonly: false,
              },
              {
                kind: "propertyDeclaration",
                name: "y",
                type: numberType,
                accessibility: "public",
                isStatic: false,
                isReadonly: false,
              },
              {
                kind: "constructorDeclaration",
                parameters: [
                  {
                    kind: "parameter",
                    pattern: {
                      kind: "arrayPattern",
                      elements: [
                        {
                          pattern: { kind: "identifierPattern", name: "x" },
                          isRest: false,
                        },
                        {
                          pattern: { kind: "identifierPattern", name: "y" },
                          isRest: false,
                        },
                      ],
                    },
                    type: arrayType(numberType),
                    isOptional: false,
                    isRest: false,
                    passing: "value",
                  },
                ],
                body: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "expressionStatement",
                      expression: {
                        kind: "assignment",
                        operator: "=",
                        left: {
                          kind: "memberAccess",
                          object: { kind: "this" },
                          property: "x",
                          isComputed: false,
                          isOptional: false,
                        },
                        right: { kind: "identifier", name: "x" },
                      },
                    },
                    {
                      kind: "expressionStatement",
                      expression: {
                        kind: "assignment",
                        operator: "=",
                        left: {
                          kind: "memberAccess",
                          object: { kind: "this" },
                          property: "y",
                          isComputed: false,
                          isOptional: false,
                        },
                        right: { kind: "identifier", name: "y" },
                      },
                    },
                  ],
                },
                accessibility: "public",
              },
            ],
            isExported: true,
            typeParameters: [],
            implements: [],
            isStruct: false,
          },
        ],
        exports: [],
      };

      const result = emitModule(module);

      // Should use synthetic parameter name in constructor
      expect(result).to.include("__param0");
      // Should destructure at start of constructor body (with element type)
      expect(result).to.include("double x = __arr0[0];");
      expect(result).to.include("double y = __arr0[1];");
    });
  });

  describe("Shared Semantic Infrastructure", () => {
    // Helper to create a reference type with structural members
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const refTypeWithMembers = (name: string, members: any[]): IrType =>
      ({
        kind: "referenceType",
        name,
        resolvedClrType: name,
        structuralMembers: members,
      }) as IrType;

    it("should register typed declaration for object-rest local binding", () => {
      const restMembers = [
        {
          kind: "propertySignature" as const,
          name: "extra",
          type: stringType,
          isOptional: false,
          isReadonly: false,
        },
      ];

      const fullMembers = [
        {
          kind: "propertySignature" as const,
          name: "id",
          type: numberType,
          isOptional: false,
          isReadonly: false,
        },
        ...restMembers,
      ];

      // The synthesized rest shape type must be declared in the module
      // (the frontend normally creates this).
      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "TestApp",
        className: "test",
        isStaticContainer: false,
        imports: [],
        body: [
          {
            kind: "interfaceDeclaration",
            name: "__RestShape0",
            members: restMembers,
            extends: [],
            typeParameters: [],
            isExported: false,
            isStruct: false,
          },
          {
            kind: "functionDeclaration",
            name: "testFunc",
            parameters: [],
            returnType: { kind: "voidType" },
            body: {
              kind: "blockStatement",
              statements: [
                {
                  kind: "variableDeclaration",
                  declarationKind: "const",
                  declarations: [
                    {
                      kind: "variableDeclarator",
                      name: {
                        kind: "objectPattern",
                        properties: [
                          {
                            kind: "property" as const,
                            key: "id",
                            value: {
                              kind: "identifierPattern",
                              name: "id",
                            },
                            shorthand: true,
                          },
                          {
                            kind: "rest" as const,
                            pattern: {
                              kind: "identifierPattern",
                              name: "rest",
                            },
                            restShapeMembers: restMembers,
                            restSynthTypeName: "__RestShape0",
                          },
                        ],
                      },
                      type: refTypeWithMembers("FullObj", fullMembers),
                      initializer: { kind: "identifier", name: "obj" },
                    },
                  ],
                  isExported: false,
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

      // rest binding should get a typed declaration, not var
      expect(result).to.include("__RestShape0 rest");
      // id should still get its type
      expect(result).to.include("double id");
    });

    it("should resolve array element type through alias", () => {
      // type Names = string[];  →  const [first] = names;
      const aliasType: IrType = {
        kind: "referenceType",
        name: "Names",
      };

      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "TestApp",
        className: "test",
        isStaticContainer: false,
        imports: [],
        body: [
          {
            kind: "typeAliasDeclaration",
            name: "Names",
            typeParameters: [],
            type: arrayType(stringType),
            isExported: false,
            isStruct: false,
          },
          {
            kind: "functionDeclaration",
            name: "testFunc",
            parameters: [],
            returnType: { kind: "voidType" },
            body: {
              kind: "blockStatement",
              statements: [
                {
                  kind: "variableDeclaration",
                  declarationKind: "const",
                  declarations: [
                    {
                      kind: "variableDeclarator",
                      name: {
                        kind: "arrayPattern",
                        elements: [
                          {
                            pattern: {
                              kind: "identifierPattern",
                              name: "first",
                            },
                            isRest: false,
                          },
                        ],
                      },
                      type: aliasType,
                      initializer: { kind: "identifier", name: "names" },
                    },
                  ],
                  isExported: false,
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

      // element type should resolve through the alias to string
      expect(result).to.include("string first");
    });

    it("should resolve property type through shared getPropertyType with structural members", () => {
      const members = [
        {
          kind: "propertySignature" as const,
          name: "label",
          type: stringType,
          isOptional: false,
          isReadonly: false,
        },
      ];

      const module = createModule([
        {
          kind: "variableDeclaration",
          declarationKind: "const",
          declarations: [
            {
              kind: "variableDeclarator",
              name: {
                kind: "objectPattern",
                properties: [
                  {
                    kind: "property" as const,
                    key: "label",
                    value: { kind: "identifierPattern", name: "label" },
                    shorthand: true,
                  },
                ],
              },
              type: refTypeWithMembers("Widget", members),
              initializer: { kind: "identifier", name: "widget" },
            },
          ],
          isExported: false,
        },
      ]);

      const result = emitModule(module);

      // property type resolved through shared getPropertyType with structural members
      expect(result).to.include("string label");
    });

    it("should lower single-element tuple via ValueTuple member access, not array indexer", () => {
      // const [only]: [string] = tuple;  →  string only = __tuple0.Item1;
      const tupleType: IrType = {
        kind: "tupleType",
        elementTypes: [stringType],
      };

      const module = createModule([
        {
          kind: "variableDeclaration",
          declarationKind: "const",
          declarations: [
            {
              kind: "variableDeclarator",
              name: {
                kind: "arrayPattern",
                elements: [
                  {
                    pattern: { kind: "identifierPattern", name: "only" },
                    isRest: false,
                  },
                ],
              },
              type: tupleType,
              initializer: { kind: "identifier", name: "tuple" },
            },
          ],
          isExported: false,
        },
      ]);

      const result = emitModule(module);

      // Must use ValueTuple member access, not array indexer
      expect(result).to.include("__tuple0.Item1");
      expect(result).to.not.include("[0]");
    });
  });
});
