/**
 * Tests for IR Soundness Gate – anyType Detection and Primitive Types
 *
 * Validates that the soundness gate correctly:
 * - Rejects anyType in variable declarations (TSN7414)
 * - Rejects anyType in nested positions (array element type)
 * - Rejects anyType in function parameters
 * - Rejects unknownType in successful IR
 * - Allows primitive types (string, number, void)
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { validateIrSoundness } from "../soundness-gate.js";
import { IrModule } from "../../types.js";
import { createModuleWithType } from "./test-helpers.js";

describe("IR Soundness Gate", () => {
  describe("anyType Detection (TSN7414)", () => {
    it("should reject anyType in variable declaration", () => {
      const module = createModuleWithType({ kind: "anyType" });

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics).to.have.length(1);
      expect(result.diagnostics[0]?.code).to.equal("TSN7414");
    });

    it("should reject anyType in array element type", () => {
      const module = createModuleWithType({
        kind: "arrayType",
        elementType: { kind: "anyType" },
      });

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics[0]?.code).to.equal("TSN7414");
    });

    it("should reject anyType in function parameter", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "Test",
        className: "test",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "functionDeclaration",
            name: "test",
            parameters: [
              {
                kind: "parameter",
                pattern: { kind: "identifierPattern", name: "x" },
                type: { kind: "anyType" },
                isOptional: false,
                isRest: false,
                passing: "value",
              },
            ],
            returnType: { kind: "voidType" },
            body: { kind: "blockStatement", statements: [] },
            isExported: false,
            isAsync: false,
            isGenerator: false,
          },
        ],
        exports: [],
      };

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics[0]?.code).to.equal("TSN7414");
    });

    it("should reject unknownType in successful IR", () => {
      const module = createModuleWithType({ kind: "unknownType" });

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics[0]?.code).to.equal("TSN7414");
    });

    it("should reject intersectionType as runtime storage", () => {
      const module = createModuleWithType({
        kind: "intersectionType",
        types: [
          { kind: "referenceType", name: "Foo" },
          { kind: "referenceType", name: "Bar" },
        ],
      });

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics[0]?.code).to.equal("TSN7414");
      expect(result.diagnostics[0]?.message).to.include(
        "cannot be emitted as a runtime storage type"
      );
    });
  });

  describe("Primitive Types", () => {
    it("should allow primitiveType string", () => {
      const module = createModuleWithType({
        kind: "primitiveType",
        name: "string",
      });

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.true;
    });

    it("should allow primitiveType number", () => {
      const module = createModuleWithType({
        kind: "primitiveType",
        name: "number",
      });

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.true;
    });

    it("should allow voidType", () => {
      const module = createModuleWithType({ kind: "voidType" });

      const result = validateIrSoundness([module]);

      expect(result.ok).to.be.true;
    });
  });
});
