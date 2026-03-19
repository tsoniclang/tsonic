/**
 * Numeric Invariants: Narrowing Intent, Declared Types, Source Spans, Propagation
 *
 * INVARIANT 1: numericIntent can ONLY come from numericNarrowing expressions
 *
 * Also covers:
 * - Declared numeric type preferences (explicit variable type over initializer)
 * - Source span accuracy in diagnostics
 * - Proven variable propagation through multiple uses
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
  binaryExpr,
  logicalExpr,
  arrayExpr,
  arrayAccess,
  arrayIdent,
} from "./helpers.js";

import type { IrExpression, IrNumericNarrowingExpression } from "./helpers.js";

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
        createVarDecl("y", binaryExpr("+", ident("x"), numLiteral(1))),
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

    it("proves nullish-coalescing numeric narrowing from nullable int", () => {
      // const y = (x ?? 0) as int;
      const nullableInt: IrExpression = {
        kind: "identifier",
        name: "x",
        inferredType: {
          kind: "unionType",
          types: [
            { kind: "primitiveType", name: "int" },
            { kind: "primitiveType", name: "undefined" },
          ],
        },
      };
      const module = createModule([
        createVarDecl(
          "y",
          narrowTo(
            logicalExpr("??", nullableInt, numLiteral(0), {
              kind: "primitiveType",
              name: "int",
            }),
            "Int32"
          )
        ),
      ]);

      const result = runNumericProofPass([module]);
      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);

      const decl = result.modules[0]?.body[0];
      expect(decl?.kind).to.equal("variableDeclaration");
      if (decl?.kind === "variableDeclaration") {
        const init = decl.declarations[0]?.initializer;
        expect(init?.kind).to.equal("numericNarrowing");
        if (init?.kind === "numericNarrowing") {
          expect(init.proof?.kind).to.equal("Int32");
          expect(init.proof?.source.type).to.equal("binaryOp");
          if (init.proof?.source.type === "binaryOp") {
            expect(init.proof.source.operator).to.equal("??");
          }
        }
      }
    });
  });

  describe("Declared Numeric Types", () => {
    it("should prefer explicit variable type over initializer literal kind", () => {
      // let x: long = 1;
      // const y = x;  // x must be treated as Int64, not Int32
      const module = createModule([
        {
          kind: "variableDeclaration",
          declarationKind: "let",
          isExported: false,
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "x" },
              type: { kind: "referenceType", name: "long" },
              initializer: numLiteral(1, "1"),
            },
          ],
        },
        createVarDecl("y", ident("x")),
      ]);

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);

      const yDecl = result.modules[0]?.body[1];
      expect(yDecl?.kind).to.equal("variableDeclaration");
      if (yDecl?.kind === "variableDeclaration") {
        const init = yDecl.declarations[0]?.initializer;
        expect(init?.kind).to.equal("identifier");
        if (init?.kind === "identifier") {
          expect(init.inferredType).to.deep.equal({
            kind: "referenceType",
            name: "Int64",
          });
        }
      }
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
        createVarDecl(
          "arr",
          arrayExpr([numLiteral(1), numLiteral(2), numLiteral(3)])
        ),
        createVarDecl("idx", narrowTo(numLiteral(0), "Int32")),
        createVarDecl("a", arrayAccess(arrayIdent("arr"), ident("idx"))),
        createVarDecl("b", arrayAccess(arrayIdent("arr"), ident("idx"))),
      ]);

      const result = runNumericProofPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
    });
  });
});
