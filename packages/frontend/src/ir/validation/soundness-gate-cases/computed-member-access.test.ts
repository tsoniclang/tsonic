/**
 * Tests for IR Soundness Gate – Computed Member Access Typing
 *
 * Validates that the soundness gate correctly handles:
 * - Dictionary element access rejects surviving unknown value types
 * - Non-dictionary computed access rejecting unknown type
 * - Array element access rejects surviving unknown element types
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { validateIrSoundness } from "../soundness-gate.js";
import { IrModule, IrType } from "../../types.js";

describe("IR Soundness Gate", () => {
  describe("Computed Member Access Typing", () => {
    it("rejects unknown value type on dictionary element access", () => {
      const dictType: IrType = {
        kind: "dictionaryType",
        keyType: { kind: "primitiveType", name: "string" },
        valueType: { kind: "unknownType" },
      };

      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "Test",
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
                name: { kind: "identifierPattern", name: "dict" },
                type: dictType,
                initializer: {
                  kind: "object",
                  properties: [],
                  contextualType: dictType,
                  inferredType: dictType,
                },
              },
            ],
          },
          {
            kind: "expressionStatement",
            expression: {
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "dict",
                inferredType: dictType,
              },
              property: { kind: "literal", value: "k", raw: '"k"' },
              isComputed: true,
              isOptional: false,
              accessKind: "dictionary",
              inferredType: { kind: "unknownType" },
            },
          },
        ],
        exports: [],
      };

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN7414")).to.be.true;
    });

    it("still rejects unknown type on non-dictionary computed access", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "Test",
        className: "test",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "expressionStatement",
            expression: {
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "obj",
                inferredType: { kind: "referenceType", name: "SomeType" },
              },
              property: { kind: "literal", value: 0, raw: "0" },
              isComputed: true,
              isOptional: false,
              accessKind: "clrIndexer",
              inferredType: { kind: "unknownType" },
            },
          },
        ],
        exports: [],
      };

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN5203")).to.be.true;
    });

    it("rejects unknown value type on array element access when element type survives", () => {
      const arrayType: IrType = {
        kind: "arrayType",
        elementType: { kind: "unknownType" },
      };

      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "Test",
        className: "test",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "expressionStatement",
            expression: {
              kind: "memberAccess",
              object: {
                kind: "identifier",
                name: "items",
                inferredType: arrayType,
              },
              property: { kind: "literal", value: 0, raw: "0" },
              isComputed: true,
              isOptional: false,
              accessKind: "clrIndexer",
              inferredType: { kind: "unknownType" },
            },
          },
        ],
        exports: [],
      };

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN7414")).to.be.true;
    });
  });
});
