import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "../emitter.js";
import type { IrType } from "@tsonic/frontend";
import { arrayType, createModule, numberType, stringType } from "./helpers.js";

describe("Destructuring Pattern Lowering", () => {
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

      // Should emit an IIFE that preserves assignment expression semantics.
      expect(result).to.include("global::System.Func");
      expect(result).to.match(/=\s*arr;/);
      expect(result).to.match(/a\s*=\s*__t\d+\[0\]/);
      expect(result).to.match(/b\s*=\s*__t\d+\[1\]/);
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
});
