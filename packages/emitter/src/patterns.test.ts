/**
 * Comprehensive Tests for Destructuring Pattern Lowering
 *
 * Tests all forms of destructuring:
 * - Variable declaration destructuring (array and object)
 * - For-of loop destructuring
 * - Parameter destructuring
 * - Assignment destructuring
 * - Nested patterns
 * - Rest elements
 * - Default values
 * - Edge cases
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "./emitter.js";
import { IrModule, IrStatement, IrType } from "@tsonic/frontend";

// Helper to create a minimal module with a function
const createModule = (
  statements: IrStatement[],
  isStatic = false
): IrModule => ({
  kind: "module",
  filePath: "/src/test.ts",
  namespace: "TestApp",
  className: "test",
  isStaticContainer: isStatic,
  imports: [],
  body: isStatic
    ? statements
    : [
        {
          kind: "functionDeclaration",
          name: "testFunc",
          parameters: [],
          returnType: { kind: "voidType" },
          body: {
            kind: "blockStatement",
            statements,
          },
          isExported: true,
          isAsync: false,
          isGenerator: false,
        },
      ],
  exports: [],
});

// Helper to create array type
const arrayType = (elementType: IrType): IrType => ({
  kind: "arrayType",
  elementType,
});

// Helper to create string type
const stringType: IrType = { kind: "primitiveType", name: "string" };

// Helper to create number type
const numberType: IrType = { kind: "primitiveType", name: "number" };

describe("Destructuring Pattern Lowering", () => {
  describe("Variable Declaration - Array Patterns", () => {
    it("should lower simple array destructuring", () => {
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
                    pattern: { kind: "identifierPattern", name: "a" },
                    isRest: false,
                  },
                  {
                    pattern: { kind: "identifierPattern", name: "b" },
                    isRest: false,
                  },
                ],
              },
              type: arrayType(numberType),
              initializer: { kind: "identifier", name: "arr" },
            },
          ],
          isExported: false,
        },
      ]);

      const result = emitModule(module);

      // Should create temp variable
      expect(result).to.include("var __arr0 = arr;");
      // Should emit indexed access for each element with element type
      expect(result).to.include("double a = __arr0[0];");
      expect(result).to.include("double b = __arr0[1];");
    });

    it("should lower array destructuring with rest element", () => {
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
                    pattern: { kind: "identifierPattern", name: "first" },
                    isRest: false,
                  },
                  {
                    pattern: { kind: "identifierPattern", name: "rest" },
                    isRest: true,
                  },
                ],
              },
              type: arrayType(stringType),
              initializer: { kind: "identifier", name: "items" },
            },
          ],
          isExported: false,
        },
      ]);

      const result = emitModule(module);

      // Should use ArrayHelpers.Slice for rest (typed with element type)
      expect(result).to.include("string first = __arr0[0];");
      expect(result).to.include("Tsonic.Runtime.ArrayHelpers.Slice(__arr0, 1)");
    });

    it("should handle holes in array patterns", () => {
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
                    pattern: { kind: "identifierPattern", name: "a" },
                    isRest: false,
                  },
                  undefined, // hole
                  {
                    pattern: { kind: "identifierPattern", name: "c" },
                    isRest: false,
                  },
                ],
              },
              type: arrayType(numberType),
              initializer: { kind: "identifier", name: "arr" },
            },
          ],
          isExported: false,
        },
      ]);

      const result = emitModule(module);

      // Should skip index 1 (the hole) - with types
      expect(result).to.include("double a = __arr0[0];");
      expect(result).to.include("double c = __arr0[2];");
      // Should NOT have index 1
      expect(result).to.not.include("__arr0[1]");
    });

    it("should handle nested array patterns", () => {
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
                    pattern: {
                      kind: "arrayPattern",
                      elements: [
                        {
                          pattern: { kind: "identifierPattern", name: "a" },
                          isRest: false,
                        },
                        {
                          pattern: { kind: "identifierPattern", name: "b" },
                          isRest: false,
                        },
                      ],
                    },
                    isRest: false,
                  },
                  {
                    pattern: { kind: "identifierPattern", name: "c" },
                    isRest: false,
                  },
                ],
              },
              type: arrayType(arrayType(numberType)),
              initializer: { kind: "identifier", name: "nested" },
            },
          ],
          isExported: false,
        },
      ]);

      const result = emitModule(module);

      // Should create nested temp variables
      expect(result).to.include("var __arr0 = nested;");
      expect(result).to.include("var __arr1 = __arr0[0];");
      // Inner elements get element type (double)
      expect(result).to.include("double a = __arr1[0];");
      expect(result).to.include("double b = __arr1[1];");
      // Outer second element gets array element type (double[])
      expect(result).to.include("double[] c = __arr0[1];");
    });
  });

  describe("Variable Declaration - Object Patterns", () => {
    // Helper to create a reference type with structural members (required by emitter)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const refTypeWithMembers = (name: string, members: any[]): IrType =>
      ({
        kind: "referenceType",
        name,
        resolvedClrType: name, // Required for emitter to resolve the type
        structuralMembers: members,
      }) as IrType;

    it("should lower simple object destructuring", () => {
      const personMembers = [
        {
          kind: "propertySignature" as const,
          name: "name",
          type: stringType,
          isOptional: false,
          isReadonly: false,
        },
        {
          kind: "propertySignature" as const,
          name: "age",
          type: numberType,
          isOptional: false,
          isReadonly: false,
        },
      ];
      const personType = refTypeWithMembers("Person", personMembers);

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
                    kind: "property",
                    key: "name",
                    value: { kind: "identifierPattern", name: "name" },
                    shorthand: true,
                  },
                  {
                    kind: "property",
                    key: "age",
                    value: { kind: "identifierPattern", name: "age" },
                    shorthand: true,
                  },
                ],
              },
              type: personType,
              initializer: { kind: "identifier", name: "person" },
            },
          ],
          isExported: false,
        },
      ]);

      const result = emitModule(module);

      // Should create temp variable
      expect(result).to.include("var __obj0 = person;");
      // Should emit property access with types from structuralMembers
      expect(result).to.include("string name = __obj0.name;");
      expect(result).to.include("double age = __obj0.age;");
    });

    it("should handle object property renaming", () => {
      const personMembers = [
        {
          kind: "propertySignature" as const,
          name: "firstName",
          type: stringType,
          isOptional: false,
          isReadonly: false,
        },
      ];
      const personType = refTypeWithMembers("Person", personMembers);

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
                    kind: "property",
                    key: "firstName",
                    value: { kind: "identifierPattern", name: "name" },
                    shorthand: false,
                  },
                ],
              },
              type: personType,
              initializer: { kind: "identifier", name: "person" },
            },
          ],
          isExported: false,
        },
      ]);

      const result = emitModule(module);

      // Should use original key but target name, with type
      expect(result).to.include("string name = __obj0.firstName;");
    });

    it("should handle nested object patterns", () => {
      const innerMembers = [
        {
          kind: "propertySignature" as const,
          name: "inner",
          type: stringType,
          isOptional: false,
          isReadonly: false,
        },
      ];
      const innerType = refTypeWithMembers("Inner", innerMembers);

      const outerMembers = [
        {
          kind: "propertySignature" as const,
          name: "outer",
          type: innerType,
          isOptional: false,
          isReadonly: false,
        },
      ];
      const outerType = refTypeWithMembers("Outer", outerMembers);

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
                    kind: "property",
                    key: "outer",
                    value: {
                      kind: "objectPattern",
                      properties: [
                        {
                          kind: "property",
                          key: "inner",
                          value: { kind: "identifierPattern", name: "value" },
                          shorthand: false,
                        },
                      ],
                    },
                    shorthand: false,
                  },
                ],
              },
              type: outerType,
              initializer: { kind: "identifier", name: "obj" },
            },
          ],
          isExported: false,
        },
      ]);

      const result = emitModule(module);

      // Should create nested temp variables
      expect(result).to.include("var __obj0 = obj;");
      expect(result).to.include("var __obj1 = __obj0.outer;");
      expect(result).to.include("string value = __obj1.inner;");
    });
  });

  describe("For-of Loop Destructuring", () => {
    it("should lower array destructuring in for-of loop", () => {
      const module = createModule([
        {
          kind: "forOfStatement",
          variable: {
            kind: "arrayPattern",
            elements: [
              {
                pattern: { kind: "identifierPattern", name: "key" },
                isRest: false,
              },
              {
                pattern: { kind: "identifierPattern", name: "value" },
                isRest: false,
              },
            ],
          },
          expression: {
            kind: "identifier",
            name: "entries",
            inferredType: arrayType(arrayType(stringType)),
          },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "expressionStatement",
                expression: {
                  kind: "call",
                  callee: {
                    kind: "memberAccess",
                    object: { kind: "identifier", name: "console" },
                    property: "log",
                    isComputed: false,
                    isOptional: false,
                  },
                  arguments: [
                    { kind: "identifier", name: "key" },
                    { kind: "identifier", name: "value" },
                  ],
                  isOptional: false,
                },
              },
            ],
          },
          isAwait: false,
        },
      ]);

      const result = emitModule(module);

      // Should use temp variable in foreach
      expect(result).to.include("foreach (var __item in entries)");
      // Should destructure inside the loop (with types from element type)
      expect(result).to.include("var __arr0 = __item;");
      expect(result).to.include("string key = __arr0[0];");
      expect(result).to.include("string value = __arr0[1];");
    });

    it("should use simple variable for identifier pattern", () => {
      const module = createModule([
        {
          kind: "forOfStatement",
          variable: { kind: "identifierPattern", name: "item" },
          expression: { kind: "identifier", name: "items" },
          body: {
            kind: "blockStatement",
            statements: [],
          },
          isAwait: false,
        },
      ]);

      const result = emitModule(module);

      // Should use simple foreach without lowering
      expect(result).to.include("foreach (var item in items)");
      // Should NOT create temp variable
      expect(result).to.not.include("__item");
    });
  });

  describe("Parameter Destructuring", () => {
    it("should lower array destructuring in function parameters", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "TestApp",
        className: "test",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "functionDeclaration",
            name: "swap",
            parameters: [
              {
                kind: "parameter",
                pattern: {
                  kind: "arrayPattern",
                  elements: [
                    {
                      pattern: { kind: "identifierPattern", name: "a" },
                      isRest: false,
                    },
                    {
                      pattern: { kind: "identifierPattern", name: "b" },
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
            returnType: arrayType(numberType),
            body: {
              kind: "blockStatement",
              statements: [
                {
                  kind: "returnStatement",
                  expression: {
                    kind: "array",
                    elements: [
                      { kind: "identifier", name: "b" },
                      { kind: "identifier", name: "a" },
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

      // Should use synthetic parameter name
      expect(result).to.include("__param0");
      // Should destructure at start of body (with element type)
      expect(result).to.include("double a = __arr0[0];");
      expect(result).to.include("double b = __arr0[1];");
    });

    it("should handle object destructuring in function parameters", () => {
      // Use referenceType with structuralMembers (not raw objectType)
      const personType: IrType = {
        kind: "referenceType",
        name: "Person",
        resolvedClrType: "Person",
        structuralMembers: [
          {
            kind: "propertySignature",
            name: "name",
            type: stringType,
            isOptional: false,
            isReadonly: false,
          },
          {
            kind: "propertySignature",
            name: "age",
            type: numberType,
            isOptional: false,
            isReadonly: false,
          },
        ],
      };

      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "TestApp",
        className: "test",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "functionDeclaration",
            name: "greet",
            parameters: [
              {
                kind: "parameter",
                pattern: {
                  kind: "objectPattern",
                  properties: [
                    {
                      kind: "property",
                      key: "name",
                      value: { kind: "identifierPattern", name: "name" },
                      shorthand: true,
                    },
                  ],
                },
                type: personType,
                isOptional: false,
                isRest: false,
                passing: "value",
              },
            ],
            returnType: stringType,
            body: {
              kind: "blockStatement",
              statements: [
                {
                  kind: "returnStatement",
                  expression: { kind: "identifier", name: "name" },
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

      // Should use synthetic parameter name
      expect(result).to.include("__param0");
      // Should destructure with type
      expect(result).to.include("string name = __obj0.name;");
    });
  });

  describe("Assignment Destructuring", () => {
    it("should lower array destructuring assignment", () => {
      const module = createModule([
        {
          kind: "variableDeclaration",
          declarationKind: "let",
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "a" },
              type: numberType,
            },
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "b" },
              type: numberType,
            },
          ],
          isExported: false,
        },
        {
          kind: "expressionStatement",
          expression: {
            kind: "assignment",
            operator: "=",
            left: {
              kind: "arrayPattern",
              elements: [
                {
                  pattern: { kind: "identifierPattern", name: "a" },
                  isRest: false,
                },
                {
                  pattern: { kind: "identifierPattern", name: "b" },
                  isRest: false,
                },
              ],
            },
            right: {
              kind: "identifier",
              name: "arr",
              inferredType: arrayType(numberType),
            },
          },
        },
      ]);

      const result = emitModule(module);

      // Should emit sequence expression for assignment
      expect(result).to.include("__t0 = arr");
      expect(result).to.include("a = __t0[0]");
      expect(result).to.include("b = __t0[1]");
    });

    it("should handle identifier pattern assignment (simple case)", () => {
      const module = createModule([
        {
          kind: "variableDeclaration",
          declarationKind: "let",
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "x" },
              type: numberType,
            },
          ],
          isExported: false,
        },
        {
          kind: "expressionStatement",
          expression: {
            kind: "assignment",
            operator: "=",
            left: { kind: "identifierPattern", name: "x" },
            right: { kind: "literal", value: 42 },
          },
        },
      ]);

      const result = emitModule(module);

      // Should emit simple assignment
      expect(result).to.include("x = 42");
      // Should NOT create temp variable for simple case
      expect(result).to.not.include("__t");
    });
  });

  describe("Mixed and Complex Patterns", () => {
    it("should handle mixed array and object destructuring", () => {
      // Element type is referenceType with structuralMembers
      const itemType: IrType = {
        kind: "referenceType",
        name: "Item",
        resolvedClrType: "Item",
        structuralMembers: [
          {
            kind: "propertySignature",
            name: "id",
            type: numberType,
            isOptional: false,
            isReadonly: false,
          },
        ],
      };
      const mixedType: IrType = {
        kind: "arrayType",
        elementType: itemType,
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
                    pattern: {
                      kind: "objectPattern",
                      properties: [
                        {
                          kind: "property",
                          key: "id",
                          value: { kind: "identifierPattern", name: "firstId" },
                          shorthand: false,
                        },
                      ],
                    },
                    isRest: false,
                  },
                ],
              },
              type: mixedType,
              initializer: { kind: "identifier", name: "items" },
            },
          ],
          isExported: false,
        },
      ]);

      const result = emitModule(module);

      // Should handle array then object destructuring
      // Note: temp counter is shared, so arr gets 0, obj gets 1
      expect(result).to.include("var __arr0 = items;");
      expect(result).to.include("var __obj1 = __arr0[0];");
      expect(result).to.include("double firstId = __obj1.id;");
    });

    it("should handle deeply nested patterns", () => {
      const deepType: IrType = {
        kind: "arrayType",
        elementType: {
          kind: "arrayType",
          elementType: {
            kind: "arrayType",
            elementType: numberType,
          },
        },
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
                    pattern: {
                      kind: "arrayPattern",
                      elements: [
                        {
                          pattern: {
                            kind: "arrayPattern",
                            elements: [
                              {
                                pattern: {
                                  kind: "identifierPattern",
                                  name: "deepValue",
                                },
                                isRest: false,
                              },
                            ],
                          },
                          isRest: false,
                        },
                      ],
                    },
                    isRest: false,
                  },
                ],
              },
              type: deepType,
              initializer: { kind: "identifier", name: "deep" },
            },
          ],
          isExported: false,
        },
      ]);

      const result = emitModule(module);

      // Should create multiple nesting levels
      expect(result).to.include("var __arr0 = deep;");
      expect(result).to.include("var __arr1 = __arr0[0];");
      expect(result).to.include("var __arr2 = __arr1[0];");
      // Deepest level gets the element type
      expect(result).to.include("double deepValue = __arr2[0];");
    });

    it("should handle array inside object pattern", () => {
      // Object with array property
      const containerType: IrType = {
        kind: "referenceType",
        name: "Container",
        resolvedClrType: "Container",
        structuralMembers: [
          {
            kind: "propertySignature",
            name: "items",
            type: arrayType(numberType),
            isOptional: false,
            isReadonly: false,
          },
        ],
      };

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
                    kind: "property",
                    key: "items",
                    value: {
                      kind: "arrayPattern",
                      elements: [
                        {
                          pattern: { kind: "identifierPattern", name: "first" },
                          isRest: false,
                        },
                        {
                          pattern: {
                            kind: "identifierPattern",
                            name: "second",
                          },
                          isRest: false,
                        },
                      ],
                    },
                    shorthand: false,
                  },
                ],
              },
              type: containerType,
              initializer: { kind: "identifier", name: "container" },
            },
          ],
          isExported: false,
        },
      ]);

      const result = emitModule(module);

      // Should create object temp, then array temp for property
      // Note: temp counter is shared, so obj gets 0, arr gets 1
      expect(result).to.include("var __obj0 = container;");
      expect(result).to.include("var __arr1 = __obj0.items;");
      expect(result).to.include("double first = __arr1[0];");
      expect(result).to.include("double second = __arr1[1];");
    });

    it("should handle deep mixed nesting (obj -> arr -> obj)", () => {
      const innerObjType: IrType = {
        kind: "referenceType",
        name: "Inner",
        resolvedClrType: "Inner",
        structuralMembers: [
          {
            kind: "propertySignature",
            name: "value",
            type: stringType,
            isOptional: false,
            isReadonly: false,
          },
        ],
      };
      const outerObjType: IrType = {
        kind: "referenceType",
        name: "Outer",
        resolvedClrType: "Outer",
        structuralMembers: [
          {
            kind: "propertySignature",
            name: "items",
            type: arrayType(innerObjType),
            isOptional: false,
            isReadonly: false,
          },
        ],
      };

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
                    kind: "property",
                    key: "items",
                    value: {
                      kind: "arrayPattern",
                      elements: [
                        {
                          pattern: {
                            kind: "objectPattern",
                            properties: [
                              {
                                kind: "property",
                                key: "value",
                                value: {
                                  kind: "identifierPattern",
                                  name: "firstValue",
                                },
                                shorthand: false,
                              },
                            ],
                          },
                          isRest: false,
                        },
                      ],
                    },
                    shorthand: false,
                  },
                ],
              },
              type: outerObjType,
              initializer: { kind: "identifier", name: "data" },
            },
          ],
          isExported: false,
        },
      ]);

      const result = emitModule(module);

      // obj -> arr -> obj nesting
      // Note: temp counter is shared, so obj0, arr1, obj2
      expect(result).to.include("var __obj0 = data;");
      expect(result).to.include("var __arr1 = __obj0.items;");
      expect(result).to.include("var __obj2 = __arr1[0];");
      expect(result).to.include("string firstValue = __obj2.value;");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty array pattern", () => {
      const module = createModule([
        {
          kind: "variableDeclaration",
          declarationKind: "const",
          declarations: [
            {
              kind: "variableDeclarator",
              name: {
                kind: "arrayPattern",
                elements: [],
              },
              type: arrayType(numberType),
              initializer: { kind: "identifier", name: "arr" },
            },
          ],
          isExported: false,
        },
      ]);

      const result = emitModule(module);

      // Should still create temp variable (for side effect evaluation)
      expect(result).to.include("var __arr0 = arr;");
      // But no actual destructuring
      expect(result).to.not.include("__arr0[");
    });

    it("should handle empty object pattern", () => {
      // Use referenceType (not raw objectType)
      const emptyType: IrType = {
        kind: "referenceType",
        name: "Empty",
        resolvedClrType: "Empty",
        structuralMembers: [],
      };

      const module = createModule([
        {
          kind: "variableDeclaration",
          declarationKind: "const",
          declarations: [
            {
              kind: "variableDeclarator",
              name: {
                kind: "objectPattern",
                properties: [],
              },
              type: emptyType,
              initializer: { kind: "identifier", name: "obj" },
            },
          ],
          isExported: false,
        },
      ]);

      const result = emitModule(module);

      // Should create temp variable
      expect(result).to.include("var __obj0 = obj;");
    });

    it("should escape C# keywords in destructured names", () => {
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
                    pattern: { kind: "identifierPattern", name: "class" },
                    isRest: false,
                  },
                  {
                    pattern: { kind: "identifierPattern", name: "namespace" },
                    isRest: false,
                  },
                ],
              },
              type: arrayType(stringType),
              initializer: { kind: "identifier", name: "keywords" },
            },
          ],
          isExported: false,
        },
      ]);

      const result = emitModule(module);

      // Should escape C# keywords with @ prefix (with types)
      expect(result).to.include("string @class = __arr0[0];");
      expect(result).to.include("string @namespace = __arr0[1];");
    });

    it("should handle rest at different positions (rest must be last)", () => {
      // Rest in middle - should stop processing after rest
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
                    pattern: { kind: "identifierPattern", name: "first" },
                    isRest: false,
                  },
                  {
                    pattern: { kind: "identifierPattern", name: "middle" },
                    isRest: true,
                  },
                  // Note: TypeScript would reject this, but testing emitter behavior
                ],
              },
              type: arrayType(stringType),
              initializer: { kind: "identifier", name: "items" },
            },
          ],
          isExported: false,
        },
      ]);

      const result = emitModule(module);

      // First element gets element type
      expect(result).to.include("string first = __arr0[0];");
      // Rest gets array type
      expect(result).to.include(
        "string[] middle = Tsonic.Runtime.ArrayHelpers.Slice(__arr0, 1);"
      );
    });
  });

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
});
