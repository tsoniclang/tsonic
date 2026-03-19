/**
 * Numeric Invariants: Binary Operation Type Promotion
 *
 * INVARIANT 4: Binary operations follow C# promotion rules (TSN5103)
 *
 * Also covers conditional expression branch promotion validation.
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
  binaryExpr,
  conditionalExpr,
} from "./helpers.js";

import type { IrExpression } from "./helpers.js";

describe("Numeric Proof Invariants", () => {
  describe("INVARIANT 4: Binary operation type promotion (TSN5103)", () => {
    it("should ACCEPT Int32 + Int32 narrowed to Int32", () => {
      // const x = (1 as int) + (2 as int) as int;
      const module = createModule([
        createVarDecl(
          "x",
          narrowTo(
            binaryExpr(
              "+",
              narrowTo(numLiteral(1), "Int32"),
              narrowTo(numLiteral(2), "Int32")
            ),
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
            binaryExpr(
              "+",
              narrowTo(numLiteral(1), "Int32"),
              narrowTo(numLiteral(2.0, "2.0"), "Double")
            ),
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
            binaryExpr(
              "+",
              narrowTo(numLiteral(1), "Int32"),
              narrowTo(numLiteral(2), "Int64")
            ),
            "Int64"
          )
        ),
      ]);

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
    });

    it("should ACCEPT explicit narrowing when binary expression carries numeric inferredType", () => {
      // Mirrors IR shape from expressions like:
      //   const age = (Convert.ToDouble(now) - Convert.ToDouble(ts)) as long;
      // where operand proofs can be opaque but the binary node itself is already
      // deterministically typed by earlier inference.
      const numericCall = (name: string): IrExpression => ({
        kind: "call",
        callee: {
          kind: "identifier",
          name,
          inferredType: { kind: "unknownType" },
        },
        arguments: [],
        isOptional: false,
        inferredType: { kind: "primitiveType", name: "number" },
      });

      const module = createModule([
        createVarDecl(
          "age",
          narrowTo(
            {
              kind: "binary",
              operator: "-",
              left: numericCall("toDoubleA"),
              right: numericCall("toDoubleB"),
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

    it("accepts conditional expressions whose branches deterministically stay Int32", () => {
      const module = createModule([
        createVarDecl(
          "cmp",
          narrowTo(
            conditionalExpr(
              {
                kind: "binary",
                operator: "===",
                left: { kind: "identifier", name: "left" },
                right: { kind: "identifier", name: "right" },
                inferredType: { kind: "primitiveType", name: "boolean" },
              },
              numLiteral(0, "0"),
              conditionalExpr(
                {
                  kind: "binary",
                  operator: "<",
                  left: { kind: "identifier", name: "left" },
                  right: { kind: "identifier", name: "right" },
                  inferredType: { kind: "primitiveType", name: "boolean" },
                },
                numLiteral(-1, "-1"),
                numLiteral(1, "1"),
                { kind: "primitiveType", name: "number" }
              ),
              { kind: "primitiveType", name: "number" }
            ),
            "Int32"
          )
        ),
      ]);

      const result = runNumericProofPass([module]);
      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);

      const decl = result.modules[0]?.body[0];
      expect(decl?.kind).to.equal("variableDeclaration");
      if (decl?.kind !== "variableDeclaration") return;

      const init = decl.declarations[0]?.initializer;
      expect(init?.kind).to.equal("numericNarrowing");
      if (init?.kind !== "numericNarrowing") return;

      expect(init.proof?.kind).to.equal("Int32");
      expect(init.proof?.source).to.deep.equal({
        type: "narrowing",
        from: "Int32",
      });
    });

    it("rejects conditional expressions whose branches promote to Double before Int32 narrowing", () => {
      const module = createModule([
        createVarDecl(
          "value",
          narrowTo(
            conditionalExpr(
              {
                kind: "binary",
                operator: "===",
                left: { kind: "identifier", name: "flag" },
                right: numLiteral(1, "1"),
                inferredType: { kind: "primitiveType", name: "boolean" },
              },
              numLiteral(0, "0"),
              numLiteral(1.5, "1.5"),
              { kind: "primitiveType", name: "number" }
            ),
            "Int32"
          )
        ),
      ]);

      const result = runNumericProofPass([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics).to.have.length(1);
      expect(result.diagnostics[0]?.code).to.equal("TSN5103");
      expect(result.diagnostics[0]?.message).to.contain(
        "Conditional expression produces Double"
      );
    });
  });
});
