/**
 * Contract Test: Numeric Proof System (Behavioral)
 *
 * These tests enforce the contract between the numeric proof pass (frontend)
 * and the emitter (backend) using BEHAVIOR, not source code pattern matching.
 *
 * Key contract:
 * 1. Only the proof pass determines whether an expression is proven Int32
 * 2. The emitter checks IR markers (numericIntent) and ICEs if missing
 * 3. TSN5107 is triggered based on accessKind, not heuristic name matching
 * 4. TSN5109 is triggered when accessKind is unknown/missing (compiler bug)
 *
 * Test approach:
 * - Create IR fixtures with specific accessKind values
 * - Run proof pass and assert diagnostics or success
 * - Run emitter and verify ICE behavior for unproven indices
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import {
  IrModule,
  IrMemberExpression,
  IrExpression,
  IrStatement,
  ComputedAccessKind,
  runNumericProofPass,
} from "@tsonic/frontend";
import { emitModule } from "../emitter.js";

/**
 * Create a minimal module with an array access expression.
 * This allows testing different accessKind values and proof states.
 */
const createModuleWithAccess = (options: {
  accessKind?: ComputedAccessKind;
  indexHasProof: boolean;
  indexValue?: number;
  indexRaw?: string;
}): IrModule => {
  const indexExpr: IrExpression = {
    kind: "literal",
    value: options.indexValue ?? 0,
    raw: options.indexRaw ?? "0",
    // If indexHasProof is true, pre-annotate with int type
    // (simulating what the proof pass would do)
    // INVARIANT: primitiveType(name="int") is the proven integer type
    ...(options.indexHasProof
      ? {
          inferredType: {
            kind: "primitiveType" as const,
            name: "int" as const,
          },
        }
      : {}),
  };

  const memberAccess: IrMemberExpression = {
    kind: "memberAccess",
    object: {
      kind: "identifier",
      name: "arr",
      inferredType: {
        kind: "arrayType",
        elementType: { kind: "primitiveType", name: "number" },
      },
    },
    property: indexExpr,
    isComputed: true,
    isOptional: false,
    // accessKind may be undefined to test missing tag
    ...(options.accessKind !== undefined
      ? { accessKind: options.accessKind }
      : {}),
    inferredType: { kind: "primitiveType", name: "number" },
  };

  return {
    kind: "module",
    filePath: "/test/contract.ts",
    namespace: "Test",
    className: "contract",
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
            name: { kind: "identifierPattern", name: "arr" },
            type: {
              kind: "arrayType",
              elementType: { kind: "primitiveType", name: "number" },
            },
            initializer: {
              kind: "array",
              elements: [
                { kind: "literal", value: 1 },
                { kind: "literal", value: 2 },
                { kind: "literal", value: 3 },
              ],
            },
          },
        ],
      },
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
};

/**
 * Create module with identifier index (not literal)
 */
const createModuleWithIdentifierIndex = (options: {
  accessKind: ComputedAccessKind;
  indexName: string;
  indexHasInt32Type: boolean;
}): IrModule => {
  const indexExpr: IrExpression = {
    kind: "identifier",
    name: options.indexName,
    // If indexHasInt32Type, give it int type
    // INVARIANT: primitiveType(name="int") is the proven integer type
    ...(options.indexHasInt32Type
      ? {
          inferredType: {
            kind: "primitiveType" as const,
            name: "int" as const,
          },
        }
      : {
          inferredType: { kind: "primitiveType", name: "number" },
        }),
  };

  const memberAccess: IrMemberExpression = {
    kind: "memberAccess",
    object: {
      kind: "identifier",
      name: "arr",
      inferredType: {
        kind: "arrayType",
        elementType: { kind: "primitiveType", name: "number" },
      },
    },
    property: indexExpr,
    isComputed: true,
    isOptional: false,
    accessKind: options.accessKind,
    inferredType: { kind: "primitiveType", name: "number" },
  };

  return {
    kind: "module",
    filePath: "/test/contract.ts",
    namespace: "Test",
    className: "contract",
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
            name: { kind: "identifierPattern", name: "arr" },
            type: {
              kind: "arrayType",
              elementType: { kind: "primitiveType", name: "number" },
            },
            initializer: {
              kind: "array",
              elements: [
                { kind: "literal", value: 1 },
                { kind: "literal", value: 2 },
                { kind: "literal", value: 3 },
              ],
            },
          },
        ],
      },
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
};

describe("Numeric Proof Contract (Behavioral)", () => {
  // ============================================================================
  // ACCESS KINDS THAT REQUIRE Int32 PROOF: clrIndexer, stringChar
  // ============================================================================

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
