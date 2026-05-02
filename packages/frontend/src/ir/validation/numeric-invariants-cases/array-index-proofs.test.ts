/**
 * Numeric Invariants: Array Index Proofs
 *
 * INVARIANT 2: Array indices must have Int32 proof (TSN5107)
 *
 * Also covers Alice's required tests for proof propagation on array
 * index expressions, ensuring the proof pass correctly annotates
 * indices with numericIntent:Int32 for the emitter.
 */

import {
  describe,
  it,
  expect,
  runNumericProofPass,
  createModule,
  createVarDecl,
  numLiteral,
  narrowTo,
  ident,
  arrayExpr,
  arrayAccess,
  arrayIdent,
} from "./helpers.js";

import type { IrExpression, IrMemberExpression } from "./helpers.js";

describe("Numeric Proof Invariants", () => {
  describe("INVARIANT 2: Array indices must be Int32 (TSN5107)", () => {
    it("should ACCEPT array access with Int32-narrowed index", () => {
      // const arr = [1, 2, 3];
      // const idx = 1 as int;
      // const x = arr[idx];
      const module = createModule([
        createVarDecl(
          "arr",
          arrayExpr([numLiteral(1), numLiteral(2), numLiteral(3)])
        ),
        createVarDecl("idx", narrowTo(numLiteral(1), "Int32")),
        createVarDecl("x", arrayAccess(arrayIdent("arr"), ident("idx"))),
      ]);

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
    });

    it("should ACCEPT array access with integer literal in Int32 range", () => {
      // const arr = [1, 2, 3];
      // const x = arr[1];  // 1 is valid Int32 literal
      const module = createModule([
        createVarDecl(
          "arr",
          arrayExpr([numLiteral(1), numLiteral(2), numLiteral(3)])
        ),
        createVarDecl("x", arrayAccess(arrayIdent("arr"), numLiteral(1))),
      ]);

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
    });

    it("should REJECT array access with Double index", () => {
      // const arr = [1, 2, 3];
      // const idx = 1.5;
      // const x = arr[idx];  // ERROR: Double is not Int32
      const module = createModule([
        createVarDecl(
          "arr",
          arrayExpr([numLiteral(1), numLiteral(2), numLiteral(3)])
        ),
        createVarDecl("idx", numLiteral(1.5, "1.5")),
        createVarDecl("x", arrayAccess(arrayIdent("arr"), ident("idx"))),
      ]);

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics.length).to.be.greaterThan(0);
      expect(result.diagnostics[0]?.code).to.equal("TSN5107");
    });

    it("should REJECT array access with unnarowed identifier", () => {
      // const arr = [1, 2, 3];
      // const idx = someFunction();  // Unknown numeric type
      // const x = arr[idx];  // ERROR: Unknown is not Int32
      const unknownIdent: IrExpression = {
        kind: "identifier",
        name: "idx",
        // No inferredType - simulates unknown type
      };

      const module = createModule([
        createVarDecl(
          "arr",
          arrayExpr([numLiteral(1), numLiteral(2), numLiteral(3)])
        ),
        createVarDecl("x", arrayAccess(arrayIdent("arr"), unknownIdent)),
      ]);

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics.length).to.be.greaterThan(0);
      expect(result.diagnostics[0]?.code).to.equal("TSN5107");
    });
  });

  /**
   * Required proof propagation for array index expressions.
   *
   * These tests verify that the proof pass correctly annotates array indices
   * with numericIntent:Int32, which the emitter relies on (without re-deriving proofs).
   */
  describe("Array Index Proof Propagation (Alice's Requirements)", () => {
    it("arr[0] - bare literal gets numericIntent:Int32", () => {
      // const arr = [1, 2, 3];
      // const x = arr[0];  // 0 should get numericIntent:Int32 after proof pass
      const module = createModule([
        createVarDecl(
          "arr",
          arrayExpr([numLiteral(1), numLiteral(2), numLiteral(3)])
        ),
        createVarDecl("x", arrayAccess(arrayIdent("arr"), numLiteral(0))),
      ]);

      const result = runNumericProofPass([module]);
      expect(result.ok).to.be.true;

      // Find the array access in the processed module
      const varDecl = result.modules[0]?.body[1];
      expect(varDecl?.kind).to.equal("variableDeclaration");
      if (varDecl?.kind === "variableDeclaration") {
        const access = varDecl.declarations[0]
          ?.initializer as IrMemberExpression;
        expect(access?.kind).to.equal("memberAccess");

        const indexExpr = access.property;
        expect(typeof indexExpr).to.not.equal("string");
        if (typeof indexExpr !== "string") {
          // Index should have primitiveType(name="int") after proof pass
          expect(indexExpr.inferredType?.kind).to.equal("primitiveType");
          if (indexExpr.inferredType?.kind === "primitiveType") {
            expect(indexExpr.inferredType.name).to.equal("int");
          }
        }
      }
    });

    it("arr[i] where i=0 - inferred Int32 propagates to index", () => {
      // const i = 0;  // i inferred as Int32 (integer literal in range)
      // const arr = [1, 2, 3];
      // const x = arr[i];  // i should propagate Int32 to index
      const module = createModule([
        createVarDecl("i", numLiteral(0)),
        createVarDecl(
          "arr",
          arrayExpr([numLiteral(1), numLiteral(2), numLiteral(3)])
        ),
        createVarDecl("x", arrayAccess(arrayIdent("arr"), ident("i"))),
      ]);

      const result = runNumericProofPass([module]);

      // Should pass - i is proven Int32 from its integer literal initialization
      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);

      // Verify the index expression has primitiveType(name="int")
      const varDecl = result.modules[0]?.body[2];
      expect(varDecl?.kind).to.equal("variableDeclaration");
      if (varDecl?.kind === "variableDeclaration") {
        const access = varDecl.declarations[0]
          ?.initializer as IrMemberExpression;
        const indexExpr = access.property;
        if (typeof indexExpr !== "string") {
          expect(indexExpr.inferredType?.kind).to.equal("primitiveType");
          if (indexExpr.inferredType?.kind === "primitiveType") {
            expect(indexExpr.inferredType.name).to.equal("int");
          }
        }
      }
    });

    it("arr[i] where i=0.0 - Double rejected with TSN5107", () => {
      // const i = 0.0;  // i is Double (has decimal point)
      // const arr = [1, 2, 3];
      // const x = arr[i];  // SHOULD FAIL: Double is not Int32
      const module = createModule([
        createVarDecl("i", numLiteral(0.0, "0.0")), // raw has decimal point
        createVarDecl(
          "arr",
          arrayExpr([numLiteral(1), numLiteral(2), numLiteral(3)])
        ),
        createVarDecl("x", arrayAccess(arrayIdent("arr"), ident("i"))),
      ]);

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics.length).to.be.greaterThan(0);
      expect(result.diagnostics[0]?.code).to.equal("TSN5107");
    });

    it("for loop counter is proven Int32 for array access", () => {
      // Simulates: for (let i = 0; i < arr.length; i++) { arr[i] }
      // The loop counter i, initialized from integer literal, should be Int32
      const module = createModule([
        createVarDecl(
          "arr",
          arrayExpr([numLiteral(1), numLiteral(2), numLiteral(3)])
        ),
        // Simulate loop counter initialization
        createVarDecl("i", numLiteral(0), "let"),
        // Simulate arr[i] inside loop body
        createVarDecl("x", arrayAccess(arrayIdent("arr"), ident("i"))),
      ]);

      const result = runNumericProofPass([module]);

      // Should pass - let i = 0 is proven Int32
      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
    });

    it("arr[1] - integer literal 1 gets numericIntent:Int32", () => {
      // Specifically test literal 1 (not just 0)
      const module = createModule([
        createVarDecl(
          "arr",
          arrayExpr([numLiteral(1), numLiteral(2), numLiteral(3)])
        ),
        createVarDecl("x", arrayAccess(arrayIdent("arr"), numLiteral(1))),
      ]);

      const result = runNumericProofPass([module]);
      expect(result.ok).to.be.true;

      // Verify the literal 1 gets primitiveType(name="int")
      const varDecl = result.modules[0]?.body[1];
      if (varDecl?.kind === "variableDeclaration") {
        const access = varDecl.declarations[0]
          ?.initializer as IrMemberExpression;
        const indexExpr = access.property;
        if (typeof indexExpr !== "string") {
          expect(indexExpr.inferredType?.kind).to.equal("primitiveType");
          if (indexExpr.inferredType?.kind === "primitiveType") {
            expect(indexExpr.inferredType.name).to.equal("int");
          }
        }
      }
    });
  });
});
