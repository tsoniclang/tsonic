import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "../emitter.js";
import type { IrType } from "@tsonic/frontend";
import { arrayType, createModule, numberType, stringType } from "./helpers.js";

describe("Destructuring Pattern Lowering", () => {
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
});
