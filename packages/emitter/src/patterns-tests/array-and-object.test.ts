import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "../emitter.js";
import type { IrType } from "@tsonic/frontend";
import { arrayType, createModule, numberType, stringType } from "./helpers.js";

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

    it("should lower tuple destructuring via Item access instead of array indexing", () => {
      const tupleType: IrType = {
        kind: "tupleType",
        elementTypes: [stringType, numberType],
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
                    pattern: { kind: "identifierPattern", name: "key" },
                    isRest: false,
                  },
                  {
                    pattern: { kind: "identifierPattern", name: "value" },
                    isRest: false,
                  },
                ],
              },
              type: tupleType,
              initializer: { kind: "identifier", name: "entry" },
            },
          ],
          isExported: false,
        },
      ]);

      const result = emitModule(module);

      expect(result).to.include("var __tuple0 = entry;");
      expect(result).to.include("string key = __tuple0.Item1;");
      expect(result).to.include("double value = __tuple0.Item2;");
      expect(result).to.not.include("__tuple0[0]");
      expect(result).to.not.include("__tuple0[1]");
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
});
