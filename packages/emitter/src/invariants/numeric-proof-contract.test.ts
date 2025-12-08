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
  ComputedAccessKind,
  runNumericProofPass,
} from "@tsonic/frontend";
import { emitModule } from "../emitter.js";

/**
 * Create a minimal module with an array access expression.
 * This allows testing different accessKind values and proof states.
 */
const createModuleWithAccess = (options: {
  accessKind: ComputedAccessKind;
  indexHasProof: boolean;
  indexValue?: number;
  indexRaw?: string;
}): IrModule => {
  const indexExpr: IrExpression = {
    kind: "literal",
    value: options.indexValue ?? 0,
    raw: options.indexRaw ?? "0",
    // If indexHasProof is true, pre-annotate with Int32 intent
    // (simulating what the proof pass would do)
    ...(options.indexHasProof
      ? {
          inferredType: {
            kind: "primitiveType",
            name: "number",
            numericIntent: "Int32",
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
  describe("TSN5107 based on accessKind", () => {
    it("clrIndexer access WITHOUT Int32 proof triggers TSN5107", () => {
      const module = createModuleWithAccess({
        accessKind: "clrIndexer",
        indexHasProof: false,
        indexValue: 1.5, // Floating-point index
        indexRaw: "1.5",
      });

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics.length).to.be.greaterThan(0);
      expect(result.diagnostics[0]?.code).to.equal("TSN5107");
    });

    it("clrIndexer access WITH Int32 proof passes", () => {
      const module = createModuleWithAccess({
        accessKind: "clrIndexer",
        indexHasProof: false, // Let proof pass prove it
        indexValue: 0,
        indexRaw: "0", // Valid integer literal
      });

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
    });

    it("jsRuntimeArray access requires Int32 proof", () => {
      const module = createModuleWithAccess({
        accessKind: "jsRuntimeArray",
        indexHasProof: false,
        indexValue: 1.5,
        indexRaw: "1.5",
      });

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics[0]?.code).to.equal("TSN5107");
    });

    it("stringChar access requires Int32 proof", () => {
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

    it("dictionary access does NOT require Int32 proof", () => {
      // Dictionary access uses typed keys (usually string), not Int32
      const module = createModuleWithAccess({
        accessKind: "dictionary",
        indexHasProof: false, // No Int32 proof
        indexValue: 0,
        indexRaw: "0",
      });

      const result = runNumericProofPass([module]);

      // Should pass - dictionary doesn't require Int32
      expect(result.ok).to.be.true;
      expect(
        result.diagnostics.filter((d) => d.code === "TSN5107")
      ).to.have.length(0);
    });

    it("unknown accessKind passes through without validation", () => {
      // Unknown access kind - proof pass doesn't validate
      // (emitter may ICE later if it's actually an indexer)
      const module = createModuleWithAccess({
        accessKind: "unknown",
        indexHasProof: false,
        indexValue: 1.5,
        indexRaw: "1.5",
      });

      const result = runNumericProofPass([module]);

      // Should pass - unknown access kind is not validated
      expect(result.ok).to.be.true;
    });
  });

  describe("Emitter respects proof markers", () => {
    it("emits without ICE when proof marker present", () => {
      const module = createModuleWithAccess({
        accessKind: "clrIndexer",
        indexHasProof: true, // Pre-annotated with Int32 proof
        indexValue: 0,
        indexRaw: "0",
      });

      // Should not throw - proof marker is present
      expect(() => emitModule(module, { runtime: "dotnet" })).to.not.throw();
    });

    it("throws ICE when proof marker missing for array access", () => {
      // Create module with array access but NO proof marker
      // This simulates skipping the proof pass
      const module = createModuleWithAccess({
        accessKind: "clrIndexer",
        indexHasProof: false, // No proof marker
        indexValue: 0,
        indexRaw: "0",
      });

      // Emitter should ICE because proof marker is missing
      expect(() => emitModule(module, { runtime: "dotnet" })).to.throw(
        /Internal Compiler Error.*Int32 proof/
      );
    });
  });

  describe("Proof pass annotates indices correctly", () => {
    it("proof pass adds numericIntent:Int32 to valid integer index", () => {
      const module = createModuleWithAccess({
        accessKind: "clrIndexer",
        indexHasProof: false,
        indexValue: 0,
        indexRaw: "0",
      });

      const result = runNumericProofPass([module]);
      expect(result.ok).to.be.true;

      // Find the member access in the processed module
      const varDecl = result.modules[0]?.body[1];
      if (!varDecl || varDecl.kind !== "variableDeclaration") {
        throw new Error("Expected variable declaration");
      }
      const access = varDecl.declarations[0]?.initializer as IrMemberExpression;
      const indexExpr = access.property;

      // Index should have numericIntent:Int32 after proof pass
      if (typeof indexExpr === "string") {
        throw new Error("Expected expression, not string property");
      }
      expect(indexExpr.inferredType?.kind).to.equal("primitiveType");
      if (indexExpr.inferredType?.kind === "primitiveType") {
        expect(indexExpr.inferredType.numericIntent).to.equal("Int32");
      }
    });

    it("proof pass propagates Int32 from variable initialization", () => {
      // Create module where index comes from a proven Int32 variable
      const module: IrModule = {
        kind: "module",
        filePath: "/test/propagation.ts",
        namespace: "Test",
        className: "propagation",
        isStaticContainer: true,
        imports: [],
        body: [
          // const i = 0; // Should be proven Int32
          {
            kind: "variableDeclaration",
            declarationKind: "const",
            isExported: false,
            declarations: [
              {
                kind: "variableDeclarator",
                name: { kind: "identifierPattern", name: "i" },
                initializer: { kind: "literal", value: 0, raw: "0" },
              },
            ],
          },
          // const arr = [1, 2, 3];
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
          // const x = arr[i]; // i should propagate as Int32
          {
            kind: "variableDeclaration",
            declarationKind: "const",
            isExported: false,
            declarations: [
              {
                kind: "variableDeclarator",
                name: { kind: "identifierPattern", name: "x" },
                initializer: {
                  kind: "memberAccess",
                  object: {
                    kind: "identifier",
                    name: "arr",
                    inferredType: {
                      kind: "arrayType",
                      elementType: { kind: "primitiveType", name: "number" },
                    },
                  },
                  property: { kind: "identifier", name: "i" },
                  isComputed: true,
                  isOptional: false,
                  accessKind: "clrIndexer",
                },
              },
            ],
          },
        ],
        exports: [],
      };

      const result = runNumericProofPass([module]);

      // Should pass - i is proven Int32 from its initialization
      expect(result.ok).to.be.true;
    });
  });
});
