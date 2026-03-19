/**
 * Tests for pipeline contract (no yield expressions remain after lowering)
 * and generator return statement transformation.
 *
 * Topics:
 * - All yield expressions removed in generator functions
 * - Yield expressions preserved in non-generator functions
 * - Return statements -> generatorReturnStatement in generators
 * - Bare return -> generatorReturnStatement
 * - Nested return transformation in control flow
 * - Return statements unchanged in non-generator functions
 */

import {
  describe,
  it,
  expect,
  runYieldLoweringPass,
  createGeneratorModule,
  createYield,
  type IrStatement,
} from "./helpers.js";

describe("Yield Lowering Pass", () => {
  describe("Pipeline Contract: No Yield Expressions After Lowering", () => {
    /**
     * Helper to recursively check if any IrYieldExpression nodes remain in the IR
     * Uses a simple approach that doesn't require exhaustive type coverage
     */
    const containsYieldExpression = (node: unknown): boolean => {
      if (!node || typeof node !== "object") return false;

      const obj = node as Record<string, unknown>;

      // Check for yield expression directly
      if (obj.kind === "yield") {
        return true;
      }

      // Check common container fields
      if (obj.statements && Array.isArray(obj.statements)) {
        return obj.statements.some(containsYieldExpression);
      }

      if (obj.expression) {
        return containsYieldExpression(obj.expression);
      }

      if (obj.declarations && Array.isArray(obj.declarations)) {
        return obj.declarations.some((d) =>
          containsYieldExpression((d as Record<string, unknown>).initializer)
        );
      }

      if (obj.body) {
        return containsYieldExpression(obj.body);
      }

      if (obj.condition) {
        if (containsYieldExpression(obj.condition)) return true;
      }

      if (obj.consequent) {
        if (containsYieldExpression(obj.consequent)) return true;
      }

      if (obj.alternate) {
        if (containsYieldExpression(obj.alternate)) return true;
      }

      if (obj.left) {
        if (containsYieldExpression(obj.left)) return true;
      }

      if (obj.right) {
        if (containsYieldExpression(obj.right)) return true;
      }

      if (obj.arguments && Array.isArray(obj.arguments)) {
        if (obj.arguments.some(containsYieldExpression)) return true;
      }

      if (obj.callee) {
        if (containsYieldExpression(obj.callee)) return true;
      }

      return false;
    };

    it("should transform ALL yield expressions in generator function body", () => {
      const module = createGeneratorModule([
        // Multiple yield patterns
        {
          kind: "expressionStatement",
          expression: createYield({ kind: "literal", value: 1 }),
        },
        {
          kind: "variableDeclaration",
          declarationKind: "const",
          isExported: false,
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "x" },
              initializer: createYield({ kind: "literal", value: 2 }),
            },
          ],
        },
        {
          kind: "whileStatement",
          condition: { kind: "literal", value: true },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "expressionStatement",
                expression: createYield({ kind: "literal", value: 3 }),
              },
            ],
          },
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;

      // Verify no yield expressions remain
      const func = result.modules[0]?.body[0] as Extract<
        IrStatement,
        { kind: "functionDeclaration" }
      >;
      const hasYieldExpr = containsYieldExpression(func.body);

      expect(hasYieldExpr).to.be.false;
    });

    it("should leave yield expressions in non-generator functions unchanged", () => {
      // Non-generator function with yield (would be invalid TS but pass handles gracefully)
      const module = createGeneratorModule(
        [
          {
            kind: "expressionStatement",
            expression: createYield({ kind: "literal", value: 1 }),
          },
        ],
        { isGenerator: false }
      );

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;

      // Yield expression SHOULD remain in non-generator
      const func = result.modules[0]?.body[0] as Extract<
        IrStatement,
        { kind: "functionDeclaration" }
      >;
      const hasYieldExpr = containsYieldExpression(func.body);

      expect(hasYieldExpr).to.be.true;
    });
  });

  describe("Generator Return Statement Transformation", () => {
    it("should transform return statements in generators to generatorReturnStatement", () => {
      const module = createGeneratorModule([
        {
          kind: "expressionStatement",
          expression: createYield({ kind: "literal", value: 1 }),
        },
        {
          kind: "returnStatement",
          expression: { kind: "literal", value: "done" },
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;

      const func = result.modules[0]?.body[0] as Extract<
        IrStatement,
        { kind: "functionDeclaration" }
      >;
      const body = func.body.statements;

      // First statement should be yieldStatement
      expect(body[0]?.kind).to.equal("yieldStatement");

      // Second statement should be generatorReturnStatement
      expect(body[1]?.kind).to.equal("generatorReturnStatement");

      const genReturn = body[1] as Extract<
        IrStatement,
        { kind: "generatorReturnStatement" }
      >;
      expect(genReturn.expression?.kind).to.equal("literal");
      expect((genReturn.expression as { value: string }).value).to.equal(
        "done"
      );
    });

    it("should transform bare return statements (no expression) to generatorReturnStatement", () => {
      const module = createGeneratorModule([
        {
          kind: "expressionStatement",
          expression: createYield({ kind: "literal", value: 1 }),
        },
        {
          kind: "returnStatement",
          expression: undefined,
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;

      const func = result.modules[0]?.body[0] as Extract<
        IrStatement,
        { kind: "functionDeclaration" }
      >;
      const body = func.body.statements;

      // Second statement should be generatorReturnStatement with no expression
      expect(body[1]?.kind).to.equal("generatorReturnStatement");

      const genReturn = body[1] as Extract<
        IrStatement,
        { kind: "generatorReturnStatement" }
      >;
      expect(genReturn.expression).to.be.undefined;
    });

    it("should transform return statements inside nested control flow", () => {
      const module = createGeneratorModule([
        {
          kind: "ifStatement",
          condition: { kind: "identifier", name: "cond" },
          thenStatement: {
            kind: "blockStatement",
            statements: [
              {
                kind: "returnStatement",
                expression: { kind: "literal", value: "early" },
              },
            ],
          },
        },
        {
          kind: "returnStatement",
          expression: { kind: "literal", value: "done" },
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;

      const func = result.modules[0]?.body[0] as Extract<
        IrStatement,
        { kind: "functionDeclaration" }
      >;
      const body = func.body.statements;

      // Check if statement then branch contains generatorReturnStatement
      const ifStmt = body[0] as Extract<IrStatement, { kind: "ifStatement" }>;
      const thenBlock = ifStmt.thenStatement as Extract<
        IrStatement,
        { kind: "blockStatement" }
      >;
      expect(thenBlock.statements[0]?.kind).to.equal(
        "generatorReturnStatement"
      );

      // Final return also transformed
      expect(body[1]?.kind).to.equal("generatorReturnStatement");
    });

    it("should NOT transform return statements in non-generator functions", () => {
      // Non-generator function
      const module = createGeneratorModule(
        [
          {
            kind: "returnStatement",
            expression: { kind: "literal", value: "result" },
          },
        ],
        { isGenerator: false }
      );

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;

      const func = result.modules[0]?.body[0] as Extract<
        IrStatement,
        { kind: "functionDeclaration" }
      >;
      const body = func.body.statements;

      // Return statement should remain as returnStatement (not transformed)
      expect(body[0]?.kind).to.equal("returnStatement");
    });
  });
});
