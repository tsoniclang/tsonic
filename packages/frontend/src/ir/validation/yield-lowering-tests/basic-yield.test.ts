/**
 * Tests for basic yield transformation and bidirectional const-declaration patterns.
 *
 * Topics:
 * - Simple yield expression -> yieldStatement
 * - Bare yield (no value)
 * - yield* delegation
 * - const x = yield value
 * - Multiple declarations with yield
 */

import {
  describe,
  it,
  expect,
  runYieldLoweringPass,
  createGeneratorModule,
  createYield,
  getGeneratorBody,
  assertDefined,
  type IrYieldStatement,
} from "./helpers.js";

describe("Yield Lowering Pass", () => {
  describe("Basic Yield Transformation", () => {
    it("should transform simple yield expr into yieldStatement", () => {
      const module = createGeneratorModule([
        {
          kind: "expressionStatement",
          expression: createYield({ kind: "literal", value: 42 }),
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);

      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(1);
      expect(body[0]?.kind).to.equal("yieldStatement");

      const yieldStmt = body[0] as IrYieldStatement;
      expect(yieldStmt.delegate).to.be.false;
      expect(yieldStmt.output?.kind).to.equal("literal");
      expect(yieldStmt.receiveTarget).to.be.undefined;
    });

    it("should transform bare yield (no value)", () => {
      const module = createGeneratorModule([
        {
          kind: "expressionStatement",
          expression: createYield(),
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      const yieldStmt = body[0] as IrYieldStatement;
      expect(yieldStmt.kind).to.equal("yieldStatement");
      expect(yieldStmt.output).to.be.undefined;
    });

    it("should transform yield* delegation", () => {
      const module = createGeneratorModule([
        {
          kind: "expressionStatement",
          expression: createYield(
            { kind: "identifier", name: "otherGen" },
            true
          ),
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      const yieldStmt = body[0] as IrYieldStatement;
      expect(yieldStmt.delegate).to.be.true;
      expect(yieldStmt.output?.kind).to.equal("identifier");
    });
  });

  describe("Bidirectional Pattern: const x = yield value", () => {
    it("should transform variable declaration with yield initializer", () => {
      const module = createGeneratorModule([
        {
          kind: "variableDeclaration",
          declarationKind: "const",
          isExported: false,
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "received" },
              type: { kind: "primitiveType", name: "number" },
              initializer: createYield({ kind: "literal", value: 10 }),
            },
          ],
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(1);

      const yieldStmt = body[0] as IrYieldStatement;
      expect(yieldStmt.kind).to.equal("yieldStatement");
      expect(yieldStmt.receiveTarget?.kind).to.equal("identifierPattern");
      expect((yieldStmt.receiveTarget as { name: string }).name).to.equal(
        "received"
      );
      expect(yieldStmt.output?.kind).to.equal("literal");
    });

    it("should handle multiple declarations with yield", () => {
      const module = createGeneratorModule([
        {
          kind: "variableDeclaration",
          declarationKind: "const",
          isExported: false,
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "a" },
              type: { kind: "primitiveType", name: "number" },
              initializer: createYield({ kind: "literal", value: 1 }),
            },
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "b" },
              type: { kind: "primitiveType", name: "number" },
              initializer: createYield({ kind: "literal", value: 2 }),
            },
          ],
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      // Should produce two yieldStatements
      expect(body).to.have.length(2);
      expect(body[0]?.kind).to.equal("yieldStatement");
      expect(body[1]?.kind).to.equal("yieldStatement");
    });
  });
});
