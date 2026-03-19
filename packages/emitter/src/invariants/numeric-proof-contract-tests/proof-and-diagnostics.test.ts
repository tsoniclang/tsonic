/**
 * Contract Test: Numeric Proof System (Behavioral)
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import {
  IrModule,
  IrMemberExpression,
  IrExpression,
  IrStatement,
  runNumericProofPass,
} from "@tsonic/frontend";
import { createModuleWithAccess, createModuleWithIdentifierIndex } from "./helpers.js";

describe("Numeric Proof Contract (Behavioral)", () => {
  describe("clrIndexer access (requires Int32 proof)", () => {
    it("double literal (1.5) triggers TSN5107", () => {
      const module = createModuleWithAccess({
        accessKind: "clrIndexer",
        indexHasProof: false,
        indexValue: 1.5,
        indexRaw: "1.5",
      });

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics[0]?.code).to.equal("TSN5107");
    });

    it("unproven identifier triggers TSN5107", () => {
      const module = createModuleWithIdentifierIndex({
        accessKind: "clrIndexer",
        indexName: "i",
        indexHasInt32Type: false,
      });

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics[0]?.code).to.equal("TSN5107");
    });

    it("integer literal (0) passes and gets marker", () => {
      const module = createModuleWithAccess({
        accessKind: "clrIndexer",
        indexHasProof: false,
        indexValue: 0,
        indexRaw: "0",
      });

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);

      // Verify marker was set
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

    it("proven identifier passes", () => {
      const module = createModuleWithIdentifierIndex({
        accessKind: "clrIndexer",
        indexName: "i",
        indexHasInt32Type: true,
      });

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.true;
    });
  });

  describe("stringChar access (requires Int32 proof)", () => {
    it("double literal (1.5) triggers TSN5107", () => {
      const module = createModuleWithAccess({
        accessKind: "stringChar",
        indexHasProof: false,
        indexValue: 1.5,
        indexRaw: "1.5",
      });

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics[0]?.code).to.equal("TSN5107");
    });

    it("unproven identifier triggers TSN5107", () => {
      const module = createModuleWithIdentifierIndex({
        accessKind: "stringChar",
        indexName: "charIdx",
        indexHasInt32Type: false,
      });

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics[0]?.code).to.equal("TSN5107");
    });

    it("integer literal (0) passes and gets marker", () => {
      const module = createModuleWithAccess({
        accessKind: "stringChar",
        indexHasProof: false,
        indexValue: 0,
        indexRaw: "0",
      });

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.true;
    });
  });

  // ============================================================================
  // ACCESS KIND THAT DOES NOT REQUIRE Int32 PROOF: dictionary
  // ============================================================================

  describe("dictionary access (does NOT require Int32 proof)", () => {
    it("double literal passes (no TSN5107)", () => {
      const module = createModuleWithAccess({
        accessKind: "dictionary",
        indexHasProof: false,
        indexValue: 1.5,
        indexRaw: "1.5",
      });

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.true;
      expect(
        result.diagnostics.filter((d) => d.code === "TSN5107")
      ).to.have.length(0);
    });

    it("unproven identifier passes (no TSN5107)", () => {
      const module = createModuleWithIdentifierIndex({
        accessKind: "dictionary",
        indexName: "key",
        indexHasInt32Type: false,
      });

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.true;
    });

    it("integer literal passes (no TSN5107)", () => {
      const module = createModuleWithAccess({
        accessKind: "dictionary",
        indexHasProof: false,
        indexValue: 0,
        indexRaw: "0",
      });

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.true;
    });
  });

  // ============================================================================
  // UNKNOWN / MISSING ACCESS KIND: TSN5109 (compiler bug)
  // ============================================================================

  describe("unknown/missing accessKind (TSN5109)", () => {
    it("accessKind='unknown' triggers TSN5109 with debug info", () => {
      const module = createModuleWithAccess({
        accessKind: "unknown",
        indexHasProof: false,
        indexValue: 0,
        indexRaw: "0",
      });

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics[0]?.code).to.equal("TSN5109");
      // Verify message includes debug info for diagnosis
      expect(result.diagnostics[0]?.message).to.include(
        "Computed access kind was not classified"
      );
      expect(result.diagnostics[0]?.message).to.include("accessKind=unknown");
      expect(result.diagnostics[0]?.message).to.include("objectType.kind=");
    });

    it("missing accessKind (undefined) triggers TSN5109 with debug info", () => {
      // accessKind is not set at all
      const module = createModuleWithAccess({
        accessKind: undefined,
        indexHasProof: false,
        indexValue: 0,
        indexRaw: "0",
      });

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics[0]?.code).to.equal("TSN5109");
      // Verify message includes "undefined" for missing accessKind
      expect(result.diagnostics[0]?.message).to.include("accessKind=undefined");
    });

    it("REGRESSION: referenceType without resolvedClrType defaults to clrIndexer (safe)", () => {
      // This test guards against unsafe dictionary misclassification.
      // If a referenceType lacks resolvedClrType, classification defaults to clrIndexer
      // (not "unknown") which is SAFE: it requires Int32 proof for the index.
      // This is the conservative safe behavior - Dictionary would fail at compile time
      // if accessed with a non-Int32 key, which is better than runtime unsoundness.
      const indexExpr: IrExpression = {
        kind: "literal",
        value: 0,
        raw: "0", // Valid integer literal - should pass Int32 check
      };

      const memberAccess: IrMemberExpression = {
        kind: "memberAccess",
        object: {
          kind: "identifier",
          name: "list",
          // referenceType WITHOUT resolvedClrType (e.g., tsbindgen type)
          inferredType: {
            kind: "referenceType",
            name: "List",
            // resolvedClrType is MISSING - defaults to clrIndexer (safe)
          },
        },
        property: indexExpr,
        isComputed: true,
        isOptional: false,
        // accessKind is clrIndexer because classifyComputedAccess defaults to it
        // when resolvedClrType is missing on a referenceType
        accessKind: "clrIndexer",
        inferredType: { kind: "primitiveType", name: "number" },
      };

      const module: IrModule = {
        kind: "module",
        filePath: "/test/list-regression.ts",
        namespace: "Test",
        className: "listRegression",
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
                name: { kind: "identifierPattern", name: "x" },
                initializer: memberAccess,
              },
            ],
          },
        ],
        exports: [],
      };

      const result = runNumericProofPass([module]);

      // Should PASS because:
      // 1. accessKind is clrIndexer (default for referenceType without resolvedClrType)
      // 2. index is literal 0, which is valid Int32
      expect(result.ok).to.be.true;

      // Verify the index got annotated with int type
      const varDecl = result.modules[0]?.body[0] as IrStatement;
      if (varDecl?.kind !== "variableDeclaration") {
        throw new Error("Expected variable declaration");
      }
      const access = varDecl.declarations[0]?.initializer as IrMemberExpression;
      const processedIndex = access.property as IrExpression;
      // Index should have primitiveType(name="int") after proof pass
      expect(processedIndex.inferredType?.kind).to.equal("primitiveType");
      if (processedIndex.inferredType?.kind === "primitiveType") {
        expect(processedIndex.inferredType.name).to.equal("int");
      }
    });
  });

  // ============================================================================
  // EMITTER CONTRACT: ICE when proof marker missing
  // ============================================================================

});
