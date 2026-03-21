/**
 * Contract Test: Numeric Proof System (Behavioral)
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import {
  IrMemberExpression,
  IrExpression,
  IrStatement,
  runNumericProofPass,
} from "@tsonic/frontend";
import { emitModule } from "../../emitter.js";
import { createModuleWithAccess } from "./helpers.js";

describe("Numeric Proof Contract (Behavioral)", () => {
  describe("Emitter contract enforcement", () => {
    it("emits without ICE when proof marker present", () => {
      const module = createModuleWithAccess({
        accessKind: "clrIndexer",
        indexHasProof: true, // Pre-annotated with Int32 proof
        indexValue: 0,
        indexRaw: "0",
      });

      // Should not throw - proof marker is present
      expect(() => emitModule(module)).to.not.throw();
    });

    it("ICE when proof marker missing - even for literal 0", () => {
      // REGRESSION GUARD: This test ensures nobody "helpfully" re-adds
      // literal parsing to the emitter. Even literal 0 must have the proof
      // marker set by the proof pass, or the emitter ICEs.
      const module = createModuleWithAccess({
        accessKind: "clrIndexer",
        indexHasProof: false, // NO proof marker
        indexValue: 0, // Even though it's 0
        indexRaw: "0",
      });

      // Emitter should ICE because proof marker is missing
      expect(() => emitModule(module)).to.throw(
        /Internal Compiler Error.*Int32 proof/
      );
    });

    it("ICE when proof marker missing - even for literal 1", () => {
      // REGRESSION GUARD: Same as above for literal 1
      const module = createModuleWithAccess({
        accessKind: "clrIndexer",
        indexHasProof: false,
        indexValue: 1,
        indexRaw: "1",
      });

      expect(() => emitModule(module)).to.throw(
        /Internal Compiler Error.*Int32 proof/
      );
    });
  });

  // ============================================================================
  // PROOF PASS ANNOTATION: Markers set correctly for all access kinds
  // ============================================================================

  describe("Proof pass annotation", () => {
    it("clrIndexer: valid index gets primitiveType(name='int')", () => {
      const module = createModuleWithAccess({
        accessKind: "clrIndexer",
        indexHasProof: false,
        indexValue: 0,
        indexRaw: "0",
      });

      const result = runNumericProofPass([module]);
      expect(result.ok).to.be.true;

      const varDecl = result.modules[0]?.body[1] as IrStatement;
      if (varDecl?.kind !== "variableDeclaration") {
        throw new Error("Expected variable declaration");
      }
      const access = varDecl.declarations[0]?.initializer as IrMemberExpression;
      const indexExpr = access.property as IrExpression;

      // Index should have primitiveType(name="int") after proof pass
      expect(indexExpr.inferredType?.kind).to.equal("primitiveType");
      if (indexExpr.inferredType?.kind === "primitiveType") {
        expect(indexExpr.inferredType.name).to.equal("int");
      }
    });

    it("stringChar: valid index gets primitiveType(name='int')", () => {
      const module = createModuleWithAccess({
        accessKind: "stringChar",
        indexHasProof: false,
        indexValue: 2,
        indexRaw: "2",
      });

      const result = runNumericProofPass([module]);
      expect(result.ok).to.be.true;

      const varDecl = result.modules[0]?.body[1] as IrStatement;
      if (varDecl?.kind !== "variableDeclaration") {
        throw new Error("Expected variable declaration");
      }
      const access = varDecl.declarations[0]?.initializer as IrMemberExpression;
      const indexExpr = access.property as IrExpression;

      // Index should have primitiveType(name="int") after proof pass
      expect(indexExpr.inferredType?.kind).to.equal("primitiveType");
      if (indexExpr.inferredType?.kind === "primitiveType") {
        expect(indexExpr.inferredType.name).to.equal("int");
      }
    });
  });
});
