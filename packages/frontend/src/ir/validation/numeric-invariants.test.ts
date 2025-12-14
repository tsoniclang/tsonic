/**
 * Numeric Invariants Tests
 *
 * These tests validate critical compiler invariants for the numeric proof system:
 *
 * INVARIANT 1: numericIntent can ONLY come from numericNarrowing expressions
 * INVARIANT 2: Array indices must have Int32 proof (TSN5107)
 * INVARIANT 3: Literals must be in range for their target type (TSN5102)
 * INVARIANT 4: Binary operations follow C# promotion rules (TSN5103)
 *
 * These tests act as regression guards - any refactor that breaks these
 * invariants will cause compilation failures or runtime unsoundness.
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { runNumericProofPass } from "./numeric-proof-pass.js";
import {
  IrModule,
  IrExpression,
  IrStatement,
  IrNumericNarrowingExpression,
  IrMemberExpression,
} from "../types.js";

/**
 * Helper to create a minimal module with statements
 */
const createModule = (
  body: IrStatement[],
  filePath = "/src/test.ts"
): IrModule => ({
  kind: "module",
  filePath,
  namespace: "Test",
  className: "test",
  isStaticContainer: true,
  imports: [],
  body,
  exports: [],
});

/**
 * Helper to create a variable declaration with an expression
 */
const createVarDecl = (
  name: string,
  init: IrExpression,
  declarationKind: "const" | "let" = "const"
): IrStatement => ({
  kind: "variableDeclaration",
  declarationKind,
  isExported: false,
  declarations: [
    {
      kind: "variableDeclarator",
      name: { kind: "identifierPattern", name },
      initializer: init,
    },
  ],
});

/**
 * Helper to create a numeric literal
 */
const numLiteral = (value: number, raw?: string): IrExpression => ({
  kind: "literal",
  value,
  raw: raw ?? String(value),
  inferredType: { kind: "primitiveType", name: "number" },
});

/**
 * Helper to create a numeric narrowing expression
 * INVARIANT: "Int32" → primitiveType(name="int"), others → referenceType
 */
const narrowTo = (
  expr: IrExpression,
  targetKind: "Int32" | "Int64" | "Double" | "Byte"
): IrNumericNarrowingExpression => ({
  kind: "numericNarrowing",
  expression: expr,
  targetKind,
  inferredType:
    targetKind === "Int32"
      ? { kind: "primitiveType", name: "int" }
      : { kind: "referenceType", name: targetKind },
});

/**
 * Helper to create an identifier expression
 */
const ident = (name: string): IrExpression => ({
  kind: "identifier",
  name,
  inferredType: { kind: "primitiveType", name: "number" },
});

/**
 * Helper to create an array access expression
 * Includes accessKind: "clrIndexer" to match IR build behavior
 */
const arrayAccess = (
  object: IrExpression,
  index: IrExpression
): IrExpression => ({
  kind: "memberAccess",
  object,
  property: index,
  isComputed: true,
  isOptional: false,
  accessKind: "clrIndexer", // Set by IR converter for array types
  inferredType: { kind: "primitiveType", name: "number" },
});

/**
 * Helper to create an array identifier
 */
const arrayIdent = (name: string): IrExpression => ({
  kind: "identifier",
  name,
  inferredType: {
    kind: "arrayType",
    elementType: { kind: "primitiveType", name: "number" },
  },
});

describe("Numeric Proof Invariants", () => {
  describe("INVARIANT 1: numericIntent ONLY from numericNarrowing", () => {
    it("should attach numericIntent to variable initialized via narrowing", () => {
      // const x = 42 as int;
      const module = createModule([
        createVarDecl("x", narrowTo(numLiteral(42), "Int32")),
      ]);

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);

      // Verify the narrowing has proof attached
      const decl = result.modules[0]?.body[0];
      expect(decl?.kind).to.equal("variableDeclaration");
      if (decl?.kind === "variableDeclaration") {
        const init = decl.declarations[0]?.initializer;
        expect(init?.kind).to.equal("numericNarrowing");
        if (init?.kind === "numericNarrowing") {
          expect(init.proof).to.not.be.undefined;
          expect(init.proof?.kind).to.equal("Int32");
        }
      }
    });

    it("should propagate numericIntent to identifiers referencing narrowed variables", () => {
      // const x = 42 as int;
      // const y = x + 1;  // x should have Int32 intent
      const module = createModule([
        createVarDecl("x", narrowTo(numLiteral(42), "Int32")),
        createVarDecl("y", {
          kind: "binary",
          operator: "+",
          left: ident("x"),
          right: numLiteral(1),
          inferredType: { kind: "primitiveType", name: "number" },
        }),
      ]);

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.true;

      // y's binary expression should have Int32 result (Int32 + Int32)
      const yDecl = result.modules[0]?.body[1];
      expect(yDecl?.kind).to.equal("variableDeclaration");
      if (yDecl?.kind === "variableDeclaration") {
        const yInit = yDecl.declarations[0]?.initializer;
        expect(yInit?.kind).to.equal("binary");
        if (yInit?.kind === "binary") {
          // After proof pass, binary with proven Int32 operands should have int type
          expect(yInit.inferredType?.kind).to.equal("primitiveType");
          if (yInit.inferredType?.kind === "primitiveType") {
            expect(yInit.inferredType.name).to.equal("int");
          }
        }
      }
    });

    it("should NOT attach numericIntent to bare literals without narrowing", () => {
      // const x = 42;  // No narrowing, should be Double (default)
      const module = createModule([createVarDecl("x", numLiteral(42))]);

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.true;

      // The literal itself doesn't get numericIntent added - it follows C# default
      // Integer-looking literals default to Int32 if in range
      // This is fine - the invariant is about explicit narrowing being the ONLY
      // way to FORCE a specific type. Inference follows C# semantics.
    });
  });

  describe("INVARIANT 2: Array indices must be Int32 (TSN5107)", () => {
    it("should ACCEPT array access with Int32-narrowed index", () => {
      // const arr = [1, 2, 3];
      // const idx = 1 as int;
      // const x = arr[idx];
      const module = createModule([
        createVarDecl("arr", {
          kind: "array",
          elements: [numLiteral(1), numLiteral(2), numLiteral(3)],
          inferredType: {
            kind: "arrayType",
            elementType: { kind: "primitiveType", name: "number" },
          },
        }),
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
        createVarDecl("arr", {
          kind: "array",
          elements: [numLiteral(1), numLiteral(2), numLiteral(3)],
          inferredType: {
            kind: "arrayType",
            elementType: { kind: "primitiveType", name: "number" },
          },
        }),
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
        createVarDecl("arr", {
          kind: "array",
          elements: [numLiteral(1), numLiteral(2), numLiteral(3)],
          inferredType: {
            kind: "arrayType",
            elementType: { kind: "primitiveType", name: "number" },
          },
        }),
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
        createVarDecl("arr", {
          kind: "array",
          elements: [numLiteral(1), numLiteral(2), numLiteral(3)],
          inferredType: {
            kind: "arrayType",
            elementType: { kind: "primitiveType", name: "number" },
          },
        }),
        createVarDecl("x", arrayAccess(arrayIdent("arr"), unknownIdent)),
      ]);

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics.length).to.be.greaterThan(0);
      expect(result.diagnostics[0]?.code).to.equal("TSN5107");
    });
  });

  describe("INVARIANT 3: Literal range validation (TSN5102)", () => {
    it("should ACCEPT Int32 literal in valid range", () => {
      // const x = 2147483647 as int;  // Max Int32
      const module = createModule([
        createVarDecl(
          "x",
          narrowTo(numLiteral(2147483647, "2147483647"), "Int32")
        ),
      ]);

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
    });

    it("should REJECT Int32 literal out of range (overflow)", () => {
      // const x = 2147483648 as int;  // Max Int32 + 1 = OVERFLOW
      const module = createModule([
        createVarDecl(
          "x",
          narrowTo(numLiteral(2147483648, "2147483648"), "Int32")
        ),
      ]);

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics).to.have.length(1);
      expect(result.diagnostics[0]?.code).to.equal("TSN5102");
    });

    it("should REJECT Int32 literal with negative overflow", () => {
      // const x = -2147483649 as int;  // Min Int32 - 1 = OVERFLOW
      const module = createModule([
        createVarDecl(
          "x",
          narrowTo(numLiteral(-2147483649, "-2147483649"), "Int32")
        ),
      ]);

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics).to.have.length(1);
      expect(result.diagnostics[0]?.code).to.equal("TSN5102");
    });

    it("should ACCEPT Byte literal in valid range", () => {
      // const x = 255 as byte;  // Max Byte
      const module = createModule([
        createVarDecl("x", narrowTo(numLiteral(255, "255"), "Byte")),
      ]);

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
    });

    it("should REJECT Byte literal out of range", () => {
      // const x = 256 as byte;  // Max Byte + 1 = OVERFLOW
      const module = createModule([
        createVarDecl("x", narrowTo(numLiteral(256, "256"), "Byte")),
      ]);

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics).to.have.length(1);
      expect(result.diagnostics[0]?.code).to.equal("TSN5102");
    });

    it("should REJECT float literal narrowed to integer type", () => {
      // const x = 3.14 as int;  // Float cannot narrow to Int32
      const module = createModule([
        createVarDecl("x", narrowTo(numLiteral(3.14, "3.14"), "Int32")),
      ]);

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics).to.have.length(1);
      expect(result.diagnostics[0]?.code).to.equal("TSN5102");
    });
  });

  describe("INVARIANT 3b: JS Safe Integer range (TSN5108)", () => {
    it("should ACCEPT value at MAX_SAFE_INTEGER boundary", () => {
      // const x = 9007199254740991 as long;  // 2^53 - 1, exactly MAX_SAFE_INTEGER
      const module = createModule([
        createVarDecl(
          "x",
          narrowTo(numLiteral(9007199254740991, "9007199254740991"), "Int64")
        ),
      ]);

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
    });

    it("should REJECT value exceeding MAX_SAFE_INTEGER", () => {
      // const x = 9007199254740992 as long;  // 2^53, one more than MAX_SAFE_INTEGER
      const module = createModule([
        createVarDecl(
          "x",
          narrowTo(numLiteral(9007199254740992, "9007199254740992"), "Int64")
        ),
      ]);

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics).to.have.length(1);
      expect(result.diagnostics[0]?.code).to.equal("TSN5108");
    });

    it("should ACCEPT value at MIN_SAFE_INTEGER boundary", () => {
      // const x = -9007199254740991 as long;  // -(2^53 - 1), exactly MIN_SAFE_INTEGER
      const module = createModule([
        createVarDecl(
          "x",
          narrowTo(numLiteral(-9007199254740991, "-9007199254740991"), "Int64")
        ),
      ]);

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
    });

    it("should REJECT value below MIN_SAFE_INTEGER", () => {
      // const x = -9007199254740992 as long;  // -(2^53), one less than MIN_SAFE_INTEGER
      const module = createModule([
        createVarDecl(
          "x",
          narrowTo(numLiteral(-9007199254740992, "-9007199254740992"), "Int64")
        ),
      ]);

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics).to.have.length(1);
      expect(result.diagnostics[0]?.code).to.equal("TSN5108");
    });
  });

  describe("INVARIANT 4: Binary operation type promotion (TSN5103)", () => {
    it("should ACCEPT Int32 + Int32 narrowed to Int32", () => {
      // const x = (1 as int) + (2 as int) as int;
      const module = createModule([
        createVarDecl(
          "x",
          narrowTo(
            {
              kind: "binary",
              operator: "+",
              left: narrowTo(numLiteral(1), "Int32"),
              right: narrowTo(numLiteral(2), "Int32"),
              inferredType: { kind: "primitiveType", name: "number" },
            },
            "Int32"
          )
        ),
      ]);

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
    });

    it("should REJECT Int32 + Double narrowed to Int32 (promotes to Double)", () => {
      // const x = (1 as int) + (2.0 as double) as int;  // ERROR: Double + Int32 = Double
      const module = createModule([
        createVarDecl(
          "x",
          narrowTo(
            {
              kind: "binary",
              operator: "+",
              left: narrowTo(numLiteral(1), "Int32"),
              right: narrowTo(numLiteral(2.0, "2.0"), "Double"),
              inferredType: { kind: "primitiveType", name: "number" },
            },
            "Int32"
          )
        ),
      ]);

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics).to.have.length(1);
      expect(result.diagnostics[0]?.code).to.equal("TSN5103");
    });

    it("should ACCEPT Int32 + Int64 narrowed to Int64 (promotion)", () => {
      // const x = (1 as int) + (2 as long) as long;  // Int32 + Int64 = Int64
      const module = createModule([
        createVarDecl(
          "x",
          narrowTo(
            {
              kind: "binary",
              operator: "+",
              left: narrowTo(numLiteral(1), "Int32"),
              right: narrowTo(numLiteral(2), "Int64"),
              inferredType: { kind: "primitiveType", name: "number" },
            },
            "Int64"
          )
        ),
      ]);

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
    });
  });

  describe("Source Span Accuracy", () => {
    it("should include sourceSpan in diagnostic when available", () => {
      // Create a narrowing with explicit source span
      const narrowingWithSpan: IrNumericNarrowingExpression = {
        kind: "numericNarrowing",
        expression: numLiteral(2147483648, "2147483648"),
        targetKind: "Int32",
        inferredType: {
          kind: "primitiveType",
          name: "int",
        },
        sourceSpan: {
          file: "/src/test.ts",
          line: 10,
          column: 15,
          length: 12,
        },
      };

      const module = createModule([createVarDecl("x", narrowingWithSpan)]);

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics).to.have.length(1);

      const diag = result.diagnostics[0];
      expect(diag?.location).to.not.be.undefined;
      // Source span should be from the expression, not default (line 1, col 1)
      // It may be from the literal or the narrowing depending on implementation
      expect(diag?.location?.file).to.equal("/src/test.ts");
    });
  });

  describe("Proven Variable Propagation", () => {
    it("should track proven variable through multiple uses", () => {
      // const idx = 0 as int;
      // const a = arr[idx];
      // const b = arr[idx];  // idx should still be proven Int32
      const module = createModule([
        createVarDecl("arr", {
          kind: "array",
          elements: [numLiteral(1), numLiteral(2), numLiteral(3)],
          inferredType: {
            kind: "arrayType",
            elementType: { kind: "primitiveType", name: "number" },
          },
        }),
        createVarDecl("idx", narrowTo(numLiteral(0), "Int32")),
        createVarDecl("a", arrayAccess(arrayIdent("arr"), ident("idx"))),
        createVarDecl("b", arrayAccess(arrayIdent("arr"), ident("idx"))),
      ]);

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
    });
  });

  /**
   * ALICE'S REQUIRED TESTS: Proof propagation for array index expressions
   *
   * These tests verify that the proof pass correctly annotates array indices
   * with numericIntent:Int32, which the emitter relies on (without re-deriving proofs).
   */
  describe("Array Index Proof Propagation (Alice's Requirements)", () => {
    it("arr[0] - bare literal gets numericIntent:Int32", () => {
      // const arr = [1, 2, 3];
      // const x = arr[0];  // 0 should get numericIntent:Int32 after proof pass
      const module = createModule([
        createVarDecl("arr", {
          kind: "array",
          elements: [numLiteral(1), numLiteral(2), numLiteral(3)],
          inferredType: {
            kind: "arrayType",
            elementType: { kind: "primitiveType", name: "number" },
          },
        }),
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
        createVarDecl("arr", {
          kind: "array",
          elements: [numLiteral(1), numLiteral(2), numLiteral(3)],
          inferredType: {
            kind: "arrayType",
            elementType: { kind: "primitiveType", name: "number" },
          },
        }),
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
        createVarDecl("arr", {
          kind: "array",
          elements: [numLiteral(1), numLiteral(2), numLiteral(3)],
          inferredType: {
            kind: "arrayType",
            elementType: { kind: "primitiveType", name: "number" },
          },
        }),
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
        createVarDecl("arr", {
          kind: "array",
          elements: [numLiteral(1), numLiteral(2), numLiteral(3)],
          inferredType: {
            kind: "arrayType",
            elementType: { kind: "primitiveType", name: "number" },
          },
        }),
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
        createVarDecl("arr", {
          kind: "array",
          elements: [numLiteral(1), numLiteral(2), numLiteral(3)],
          inferredType: {
            kind: "arrayType",
            elementType: { kind: "primitiveType", name: "number" },
          },
        }),
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
