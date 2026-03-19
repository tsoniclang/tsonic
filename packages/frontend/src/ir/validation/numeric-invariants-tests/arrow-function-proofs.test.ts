/**
 * Numeric Invariants: Arrow Function and Guard Proof Context
 *
 * REGRESSION TESTS: Arrow function and function expression parameter proofs
 *
 * These tests guard against the bug where arrow functions and function expressions
 * did not register their parameters in provenParameters, causing (n: int) => (n * 2) as int
 * to fail proof validation. This was the root cause of 3 E2E test failures:
 * - action-func-callbacks
 * - collections
 * - linq-dotnet
 *
 * Also covers guarded integer range branch proofs for function declarations.
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
  logicalExpr,
  memberCall,
  compareExpr,
  block,
  parameter,
  booleanType,
} from "./helpers.js";

import type { IrExpression } from "./helpers.js";

describe("Numeric Proof Invariants", () => {
  describe("Arrow Function Parameter Proof Context", () => {
    /**
     * Helper to create an arrow function expression
     */
    const createArrowFunction = (
      paramName: string,
      paramType: "int" | "number",
      body: IrExpression
    ): IrExpression => ({
      kind: "arrowFunction",
      parameters: [
        {
          kind: "parameter",
          pattern: { kind: "identifierPattern", name: paramName },
          type:
            paramType === "int"
              ? { kind: "primitiveType", name: "int" }
              : { kind: "primitiveType", name: "number" },
          isOptional: false,
          isRest: false,
          passing: "value" as const,
        },
      ],
      body,
      isAsync: false,
      inferredType: {
        kind: "functionType",
        parameters: [
          {
            kind: "parameter",
            pattern: { kind: "identifierPattern", name: paramName },
            type:
              paramType === "int"
                ? { kind: "primitiveType", name: "int" }
                : { kind: "primitiveType", name: "number" },
            isOptional: false,
            isRest: false,
            passing: "value" as const,
          },
        ],
        returnType:
          paramType === "int"
            ? { kind: "primitiveType", name: "int" }
            : { kind: "primitiveType", name: "number" },
      },
    });

    /**
     * Helper to create a binary expression
     */
    const createBinary = (
      left: IrExpression,
      op: "+" | "-" | "*" | "/",
      right: IrExpression
    ): IrExpression => ({
      kind: "binary",
      operator: op,
      left,
      right,
      inferredType: { kind: "primitiveType", name: "number" },
    });

    it("should ACCEPT (n: int) => (n * 2) as int - parameter proven as Int32", () => {
      // REGRESSION TEST: This was failing because arrow function parameters
      // were not registered in provenParameters
      //
      // const doubled = mapToInt(numbers, (n: int) => (n * 2) as int);
      const arrowBody = narrowTo(
        createBinary(ident("n"), "*", numLiteral(2)),
        "Int32"
      );
      const arrow = createArrowFunction("n", "int", arrowBody);

      const module = createModule([createVarDecl("callback", arrow)]);

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
    });

    it("should ACCEPT nested arrow: (x: int) => (y: int) => (x + y) as int", () => {
      // Test that nested arrow functions correctly scope parameters
      const innerBody = narrowTo(
        createBinary(ident("x"), "+", ident("y")),
        "Int32"
      );
      const innerArrow = createArrowFunction("y", "int", innerBody);
      const outerArrow = createArrowFunction("x", "int", innerArrow);

      const module = createModule([createVarDecl("curried", outerArrow)]);

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
    });

    it("should REJECT (n: number) => (n * 2) as int - parameter not proven as Int32", () => {
      // When parameter is typed as number (not int), it cannot be proven Int32
      // The error is TSN5101 (cannot prove identifier) not TSN5103 (binary promotion)
      // because n itself is not proven as Int32
      const arrowBody = narrowTo(
        createBinary(ident("n"), "*", numLiteral(2)),
        "Int32"
      );
      const arrow = createArrowFunction("n", "number", arrowBody);

      const module = createModule([createVarDecl("callback", arrow)]);

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics.length).to.be.greaterThan(0);
      // TSN5101: Cannot prove identifier narrowing (n is number, not int)
      expect(result.diagnostics[0]?.code).to.equal("TSN5101");
    });

    it("should propagate outer proven var into arrow function body", () => {
      // const x = 1 as int;
      // const fn = (n: int) => (x + n) as int;  // x should be visible inside arrow
      const module = createModule([
        createVarDecl("x", narrowTo(numLiteral(1), "Int32")),
        createVarDecl(
          "fn",
          createArrowFunction(
            "n",
            "int",
            narrowTo(createBinary(ident("x"), "+", ident("n")), "Int32")
          )
        ),
      ]);

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
    });

    it("should allow parameter shadowing in nested arrows", () => {
      // Outer n is int, inner n shadows it - both should work
      // const fn = (n: int) => ((n: int) => (n * 2) as int);
      const innerBody = narrowTo(
        createBinary(ident("n"), "*", numLiteral(2)),
        "Int32"
      );
      const innerArrow = createArrowFunction("n", "int", innerBody);
      const outerArrow = createArrowFunction("n", "int", innerArrow);

      const module = createModule([createVarDecl("fn", outerArrow)]);

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
    });

    it("proves Int32 narrowing inside a guarded integer range branch", () => {
      const guardedCondition = logicalExpr(
        "&&",
        logicalExpr(
          "&&",
          memberCall("Number", "isInteger", [ident("value")]),
          compareExpr(
            ">=",
            ident("value"),
            numLiteral(-2147483648, "-2147483648")
          ),
          booleanType
        ),
        compareExpr("<=", ident("value"), numLiteral(2147483647, "2147483647")),
        booleanType
      );

      const module = createModule([
        {
          kind: "functionDeclaration",
          name: "toInt32",
          isExported: false,
          isAsync: false,
          isGenerator: false,
          parameters: [
            parameter("value", { kind: "primitiveType", name: "number" }),
          ],
          returnType: {
            kind: "unionType",
            types: [
              { kind: "primitiveType", name: "int" },
              { kind: "primitiveType", name: "undefined" },
            ],
          },
          body: block([
            {
              kind: "ifStatement",
              condition: guardedCondition,
              thenStatement: block([
                {
                  kind: "returnStatement",
                  expression: narrowTo(ident("value"), "Int32"),
                },
              ]),
            },
            {
              kind: "returnStatement",
              expression: {
                kind: "literal",
                value: undefined,
                inferredType: { kind: "primitiveType", name: "undefined" },
              },
            },
          ]),
        },
      ]);

      const result = runNumericProofPass([module]);
      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
    });

    it("still rejects guarded range checks when integer-ness is not proven", () => {
      const guardedCondition = logicalExpr(
        "&&",
        compareExpr(
          ">=",
          ident("value"),
          numLiteral(-2147483648, "-2147483648")
        ),
        compareExpr("<=", ident("value"), numLiteral(2147483647, "2147483647")),
        booleanType
      );

      const module = createModule([
        {
          kind: "functionDeclaration",
          name: "toInt32",
          isExported: false,
          isAsync: false,
          isGenerator: false,
          parameters: [
            parameter("value", { kind: "primitiveType", name: "number" }),
          ],
          returnType: {
            kind: "unionType",
            types: [
              { kind: "primitiveType", name: "int" },
              { kind: "primitiveType", name: "undefined" },
            ],
          },
          body: block([
            {
              kind: "ifStatement",
              condition: guardedCondition,
              thenStatement: block([
                {
                  kind: "returnStatement",
                  expression: narrowTo(ident("value"), "Int32"),
                },
              ]),
            },
            {
              kind: "returnStatement",
              expression: {
                kind: "literal",
                value: undefined,
                inferredType: { kind: "primitiveType", name: "undefined" },
              },
            },
          ]),
        },
      ]);

      const result = runNumericProofPass([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN5101")).to.equal(
        true
      );
    });
  });
});
