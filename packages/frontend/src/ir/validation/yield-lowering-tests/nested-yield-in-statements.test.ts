/**
 * Tests for nested yield lowering in various statement conditions/expressions.
 *
 * Topics:
 * - Nested yield in for-loop condition
 * - Nested yield in for-loop update
 * - Nested yield in if condition
 * - Nested yield in while condition
 * - Nested yield in for-of expression
 * - Nested yield in for-in expression
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
} from "./helpers.js";

describe("Yield Lowering Pass", () => {
  describe("Unsupported Patterns (TSN6101)", () => {
    it("should transform nested yield in for loop condition", () => {
      const module = createGeneratorModule([
        {
          kind: "forStatement",
          condition: {
            kind: "logical",
            operator: "&&",
            left: createYield({ kind: "literal", value: true }),
            right: { kind: "literal", value: true },
          },
          body: { kind: "blockStatement", statements: [] },
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(1);
      expect(body[0]?.kind).to.equal("forStatement");
    });

    it("should transform nested yield in for loop update", () => {
      const module = createGeneratorModule([
        {
          kind: "forStatement",
          condition: { kind: "literal", value: true },
          update: {
            kind: "assignment",
            operator: "=",
            left: { kind: "identifierPattern", name: "i" },
            right: {
              kind: "binary",
              operator: "+",
              left: createYield({ kind: "literal", value: 1 }),
              right: { kind: "literal", value: 2 },
            },
          },
          body: { kind: "blockStatement", statements: [] },
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(2);
      expect(body[0]?.kind).to.equal("variableDeclaration");
      expect(body[1]?.kind).to.equal("forStatement");
    });

    it("should transform nested yield in if condition", () => {
      const module = createGeneratorModule([
        {
          kind: "ifStatement",
          condition: {
            kind: "binary",
            operator: "+",
            left: createYield({ kind: "literal", value: 1 }),
            right: { kind: "literal", value: 2 },
          },
          thenStatement: { kind: "blockStatement", statements: [] },
        },
      ]);

      const result = runYieldLoweringPass([module]);
      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(2);
      expect(body[0]?.kind).to.equal("yieldStatement");
      expect(body[1]?.kind).to.equal("ifStatement");
    });

    it("should transform nested yield in while condition", () => {
      const module = createGeneratorModule([
        {
          kind: "whileStatement",
          condition: {
            kind: "logical",
            operator: "&&",
            left: createYield({ kind: "literal", value: true }),
            right: { kind: "literal", value: true },
          },
          body: { kind: "blockStatement", statements: [] },
        },
      ]);

      const result = runYieldLoweringPass([module]);
      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(1);
      expect(body[0]?.kind).to.equal("whileStatement");
    });

    it("should transform nested yield in for-of expression", () => {
      const module = createGeneratorModule([
        {
          kind: "forOfStatement",
          variable: { kind: "identifierPattern", name: "x" },
          expression: {
            kind: "binary",
            operator: "+",
            left: createYield({ kind: "literal", value: 1 }),
            right: { kind: "literal", value: 2 },
          },
          body: { kind: "blockStatement", statements: [] },
          isAwait: false,
        },
      ]);

      const result = runYieldLoweringPass([module]);
      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(2);
      expect(body[0]?.kind).to.equal("yieldStatement");
      expect(body[1]?.kind).to.equal("forOfStatement");
    });

    it("should transform nested yield in for-in expression", () => {
      const module = createGeneratorModule([
        {
          kind: "forInStatement",
          variable: { kind: "identifierPattern", name: "k" },
          expression: {
            kind: "binary",
            operator: "+",
            left: createYield({ kind: "literal", value: 1 }),
            right: { kind: "literal", value: 2 },
          },
          body: { kind: "blockStatement", statements: [] },
        },
      ]);

      const result = runYieldLoweringPass([module]);
      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(2);
      expect(body[0]?.kind).to.equal("yieldStatement");
      expect(body[1]?.kind).to.equal("forInStatement");
    });

    it("should transform direct yield in for-loop declaration initializer", () => {
      const module = createGeneratorModule([
        {
          kind: "forStatement",
          initializer: {
            kind: "variableDeclaration",
            declarationKind: "let",
            isExported: false,
            declarations: [
              {
                kind: "variableDeclarator",
                name: { kind: "identifierPattern", name: "x" },
                type: { kind: "primitiveType", name: "number" },
                initializer: createYield({ kind: "literal", value: 1 }),
              },
            ],
          },
          condition: { kind: "literal", value: true },
          body: { kind: "blockStatement", statements: [] },
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(2);
      expect(body[0]?.kind).to.equal("yieldStatement");
      expect(body[1]?.kind).to.equal("forStatement");

      const loweredFor = body[1] as Extract<
        IrStatement,
        { kind: "forStatement" }
      >;
      expect(loweredFor.initializer?.kind).to.equal("variableDeclaration");
      const initDecl = loweredFor.initializer as Extract<
        IrStatement,
        { kind: "variableDeclaration" }
      >;
      expect(initDecl.declarations[0]?.initializer?.kind).to.equal(
        "identifier"
      );
    });

    it("should transform nested yield in for-loop declaration initializer", () => {
      const module = createGeneratorModule([
        {
          kind: "forStatement",
          initializer: {
            kind: "variableDeclaration",
            declarationKind: "let",
            isExported: false,
            declarations: [
              {
                kind: "variableDeclarator",
                name: { kind: "identifierPattern", name: "x" },
                type: { kind: "primitiveType", name: "number" },
                initializer: {
                  kind: "binary",
                  operator: "+",
                  left: createYield({ kind: "literal", value: 1 }),
                  right: { kind: "literal", value: 2 },
                },
              },
            ],
          },
          condition: { kind: "literal", value: true },
          body: { kind: "blockStatement", statements: [] },
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(2);
      expect(body[0]?.kind).to.equal("yieldStatement");
      expect(body[1]?.kind).to.equal("forStatement");
      const loweredFor = body[1] as Extract<
        IrStatement,
        { kind: "forStatement" }
      >;
      expect(loweredFor.initializer?.kind).to.equal("variableDeclaration");
      const initDecl = loweredFor.initializer as Extract<
        IrStatement,
        { kind: "variableDeclaration" }
      >;
      expect(initDecl.declarations[0]?.initializer?.kind).to.equal("binary");
    });
  });
});
