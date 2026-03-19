/**
 * Numeric Invariants: Literal Range Validation
 *
 * INVARIANT 3: Literals must be in range for their target type (TSN5102)
 * INVARIANT 3b: JS Safe Integer range validation (TSN5108)
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
} from "./helpers.js";

describe("Numeric Proof Invariants", () => {
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
});
