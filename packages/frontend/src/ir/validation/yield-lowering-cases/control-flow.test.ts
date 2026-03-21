/**
 * Tests for yield lowering in control flow structures.
 *
 * Topics:
 * - Direct yield in if condition
 * - Yield inside if/while/for/switch/try bodies
 * - Direct yield in for-loop condition and update
 * - Direct yield in while condition
 * - Direct yield in for-of/for-in expressions
 * - Direct yield in switch expression
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
  type IrStatement,
  type IrBlockStatement,
} from "./helpers.js";

describe("Yield Lowering Pass", () => {
  describe("Control Flow Structures", () => {
    it("should transform direct yield in if condition", () => {
      const module = createGeneratorModule([
        {
          kind: "ifStatement",
          condition: createYield({ kind: "literal", value: true }),
          thenStatement: {
            kind: "blockStatement",
            statements: [
              {
                kind: "expressionStatement",
                expression: { kind: "literal", value: 1 },
              },
            ],
          },
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(2);
      expect(body[0]?.kind).to.equal("yieldStatement");
      expect(body[1]?.kind).to.equal("ifStatement");
    });

    it("should transform yield inside if statement", () => {
      const module = createGeneratorModule([
        {
          kind: "ifStatement",
          condition: { kind: "literal", value: true },
          thenStatement: {
            kind: "blockStatement",
            statements: [
              {
                kind: "expressionStatement",
                expression: createYield({ kind: "literal", value: 1 }),
              },
            ],
          },
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      const ifStmt = body[0] as Extract<IrStatement, { kind: "ifStatement" }>;
      const thenBlock = ifStmt.thenStatement as IrBlockStatement;
      expect(thenBlock.statements[0]?.kind).to.equal("yieldStatement");
    });

    it("should transform yield inside while loop", () => {
      const module = createGeneratorModule([
        {
          kind: "whileStatement",
          condition: { kind: "literal", value: true },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "expressionStatement",
                expression: createYield({ kind: "identifier", name: "i" }),
              },
            ],
          },
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
    });

    it("should transform direct yield in for loop condition", () => {
      const module = createGeneratorModule([
        {
          kind: "forStatement",
          condition: createYield({ kind: "literal", value: true }),
          update: {
            kind: "update",
            operator: "++",
            expression: { kind: "identifier", name: "i" },
            prefix: false,
          },
          body: { kind: "blockStatement", statements: [] },
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(1);
      const forStmt = body[0] as Extract<IrStatement, { kind: "forStatement" }>;
      expect(forStmt.condition?.kind).to.equal("literal");
      expect(forStmt.body.kind).to.equal("blockStatement");
      const forBody = forStmt.body as IrBlockStatement;
      expect(forBody.statements[0]?.kind).to.equal("yieldStatement");
      expect(forBody.statements[1]?.kind).to.equal("ifStatement");
    });

    it("should transform direct yield in for loop update", () => {
      const module = createGeneratorModule([
        {
          kind: "forStatement",
          condition: {
            kind: "binary",
            operator: "<",
            left: { kind: "identifier", name: "i" },
            right: { kind: "literal", value: 3 },
          },
          update: createYield({ kind: "literal", value: 1 }),
          body: { kind: "blockStatement", statements: [] },
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(2);
      expect(body[0]?.kind).to.equal("variableDeclaration");
      const forStmt = body[1] as Extract<IrStatement, { kind: "forStatement" }>;
      expect(forStmt.condition?.kind).to.equal("literal");
      expect(forStmt.update).to.equal(undefined);
      expect(forStmt.body.kind).to.equal("blockStatement");
      const forBody = forStmt.body as IrBlockStatement;
      expect(forBody.statements[0]?.kind).to.equal("ifStatement");
      expect(forBody.statements[1]?.kind).to.equal("expressionStatement");
      expect(forBody.statements[2]?.kind).to.equal("ifStatement");
    });

    it("should transform direct yield in both for loop condition and update", () => {
      const module = createGeneratorModule([
        {
          kind: "forStatement",
          condition: createYield({ kind: "literal", value: true }),
          update: createYield({ kind: "literal", value: 1 }),
          body: {
            kind: "blockStatement",
            statements: [{ kind: "continueStatement" }],
          },
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(2);
      expect(body[0]?.kind).to.equal("variableDeclaration");
      const forStmt = body[1] as Extract<IrStatement, { kind: "forStatement" }>;
      expect(forStmt.condition?.kind).to.equal("literal");
      expect(forStmt.update).to.equal(undefined);
      const forBody = forStmt.body as IrBlockStatement;
      expect(forBody.statements[0]?.kind).to.equal("ifStatement");
      expect(forBody.statements[2]?.kind).to.equal("yieldStatement");
      expect(forBody.statements[3]?.kind).to.equal("ifStatement");
    });

    it("should transform direct yield in while condition", () => {
      const module = createGeneratorModule([
        {
          kind: "whileStatement",
          condition: createYield({ kind: "literal", value: true }),
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "expressionStatement",
                expression: { kind: "literal", value: 1 },
              },
            ],
          },
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(1);
      const whileStmt = body[0] as Extract<
        IrStatement,
        { kind: "whileStatement" }
      >;
      expect(whileStmt.condition.kind).to.equal("literal");
      if (whileStmt.condition.kind === "literal") {
        expect(whileStmt.condition.value).to.equal(true);
      }
      expect(whileStmt.body.kind).to.equal("blockStatement");
      const whileBody = whileStmt.body as IrBlockStatement;
      expect(whileBody.statements[0]?.kind).to.equal("yieldStatement");
      expect(whileBody.statements[1]?.kind).to.equal("ifStatement");
    });

    it("should transform direct yield in for-of expression", () => {
      const module = createGeneratorModule([
        {
          kind: "forOfStatement",
          variable: { kind: "identifierPattern", name: "x" },
          expression: createYield({ kind: "array", elements: [] }),
          body: { kind: "blockStatement", statements: [] },
          isAwait: false,
        },
      ]);

      const result = runYieldLoweringPass([module]);
      expect(result.ok).to.be.true;
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(2);
      expect(body[0]?.kind).to.equal("yieldStatement");
      expect(body[1]?.kind).to.equal("forOfStatement");
    });

    it("should transform direct yield in for-in expression", () => {
      const module = createGeneratorModule([
        {
          kind: "forInStatement",
          variable: { kind: "identifierPattern", name: "k" },
          expression: createYield({ kind: "object", properties: [] }),
          body: { kind: "blockStatement", statements: [] },
        },
      ]);

      const result = runYieldLoweringPass([module]);
      expect(result.ok).to.be.true;
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(2);
      expect(body[0]?.kind).to.equal("yieldStatement");
      expect(body[1]?.kind).to.equal("forInStatement");
    });

    it("should transform yield inside switch case", () => {
      const module = createGeneratorModule([
        {
          kind: "switchStatement",
          expression: { kind: "identifier", name: "x" },
          cases: [
            {
              kind: "switchCase",
              test: { kind: "literal", value: 1 },
              statements: [
                {
                  kind: "expressionStatement",
                  expression: createYield({ kind: "literal", value: 10 }),
                },
              ],
            },
          ],
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
    });

    it("should transform direct yield in switch expression", () => {
      const module = createGeneratorModule([
        {
          kind: "switchStatement",
          expression: createYield({ kind: "literal", value: 1 }),
          cases: [
            {
              kind: "switchCase",
              test: { kind: "literal", value: 1 },
              statements: [{ kind: "breakStatement" }],
            },
          ],
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(2);
      expect(body[0]?.kind).to.equal("yieldStatement");
      expect(body[1]?.kind).to.equal("switchStatement");
    });

    it("should transform yield inside try block", () => {
      const module = createGeneratorModule([
        {
          kind: "tryStatement",
          tryBlock: {
            kind: "blockStatement",
            statements: [
              {
                kind: "expressionStatement",
                expression: createYield({ kind: "literal", value: 1 }),
              },
            ],
          },
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
    });
  });
});
