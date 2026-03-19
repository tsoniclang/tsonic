/**
 * Tests for destructuring patterns, TSN6101 diagnostics, and expression lowering.
 *
 * Topics:
 * - Array/object destructuring with yield
 * - TSN6101 diagnostics for unsupported positions
 * - Yield in call arguments
 * - Nested yield in initializers
 * - Yield in conditional expressions
 * - Return/throw yield expression lowering
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
  type IrExpressionStatement,
  type IrYieldStatement,
} from "./helpers.js";

describe("Yield Lowering Pass", () => {
  describe("Destructuring Patterns", () => {
    it("should transform array destructuring with yield", () => {
      const module = createGeneratorModule([
        {
          kind: "variableDeclaration",
          declarationKind: "const",
          isExported: false,
          declarations: [
            {
              kind: "variableDeclarator",
              name: {
                kind: "arrayPattern",
                elements: [
                  { pattern: { kind: "identifierPattern", name: "a" } },
                  { pattern: { kind: "identifierPattern", name: "b" } },
                ],
              },
              initializer: createYield({ kind: "literal", value: null }),
            },
          ],
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      const yieldStmt = body[0] as IrYieldStatement;
      expect(yieldStmt.receiveTarget?.kind).to.equal("arrayPattern");
    });

    it("should transform object destructuring with yield", () => {
      const module = createGeneratorModule([
        {
          kind: "variableDeclaration",
          declarationKind: "const",
          isExported: false,
          declarations: [
            {
              kind: "variableDeclarator",
              name: {
                kind: "objectPattern",
                properties: [
                  {
                    kind: "property",
                    key: "x",
                    value: { kind: "identifierPattern", name: "x" },
                    shorthand: true,
                  },
                ],
              },
              initializer: createYield({ kind: "literal", value: null }),
            },
          ],
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      const yieldStmt = body[0] as IrYieldStatement;
      expect(yieldStmt.receiveTarget?.kind).to.equal("objectPattern");
    });
  });

  describe("Unsupported Patterns (TSN6101)", () => {
    it("should lower yield inside member-access assignment target chains", () => {
      const module = createGeneratorModule([
        {
          kind: "expressionStatement",
          expression: {
            kind: "assignment",
            operator: "=",
            left: {
              kind: "memberAccess",
              object: {
                kind: "assignment",
                operator: "=",
                left: {
                  kind: "memberAccess",
                  object: createYield({ kind: "identifier", name: "tmpObj" }),
                  property: "inner",
                  isOptional: false,
                  isComputed: false,
                },
                right: { kind: "literal", value: 1 },
              },
              property: "count",
              isOptional: false,
              isComputed: false,
            },
            right: { kind: "literal", value: 2 },
          },
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(3);
      expect(body[0]?.kind).to.equal("yieldStatement");
      expect(body[1]?.kind).to.equal("variableDeclaration");
      expect(body[2]?.kind).to.equal("expressionStatement");
      const finalExpr = (body[2] as IrExpressionStatement).expression;
      expect(finalExpr.kind).to.equal("assignment");
      if (finalExpr.kind === "assignment") {
        expect(finalExpr.left.kind).to.equal("memberAccess");
      }
    });

    it("should emit TSN6101 when yield appears in a non-lowerable assignment target", () => {
      const module = createGeneratorModule([
        {
          kind: "expressionStatement",
          expression: {
            kind: "assignment",
            operator: "=",
            left: {
              kind: "binary",
              operator: "+",
              left: createYield({ kind: "identifier", name: "lhs" }),
              right: { kind: "literal", value: 1 },
            },
            right: { kind: "literal", value: 2 },
          },
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics.length).to.be.greaterThan(0);
      expect(result.diagnostics[0]?.code).to.equal("TSN6101");
    });

    it("should emit TSN6101 when yield appears in switch case test expression", () => {
      const module = createGeneratorModule([
        {
          kind: "switchStatement",
          expression: { kind: "identifier", name: "value" },
          cases: [
            {
              kind: "switchCase",
              test: createYield({ kind: "literal", value: 1 }),
              statements: [{ kind: "breakStatement" }],
            },
          ],
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics.length).to.be.greaterThan(0);
      expect(result.diagnostics.some((d) => d.code === "TSN6101")).to.equal(
        true
      );
    });

    it("should transform yield in call argument", () => {
      const module = createGeneratorModule([
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: { kind: "identifier", name: "foo" },
            arguments: [createYield({ kind: "literal", value: 1 })],
            isOptional: false,
          },
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(2);
      expect(body[0]?.kind).to.equal("yieldStatement");
      expect(body[1]?.kind).to.equal("expressionStatement");
    });

    it("should transform nested yield in initializer", () => {
      const module = createGeneratorModule([
        {
          kind: "variableDeclaration",
          declarationKind: "const",
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
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(2);
      expect(body[0]?.kind).to.equal("yieldStatement");
      expect(body[1]?.kind).to.equal("variableDeclaration");
    });

    it("should transform yield in conditional expression condition", () => {
      const module = createGeneratorModule([
        {
          kind: "variableDeclaration",
          declarationKind: "const",
          isExported: false,
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "x" },
              initializer: {
                kind: "conditional",
                condition: createYield({ kind: "literal", value: true }),
                whenTrue: { kind: "literal", value: 1 },
                whenFalse: { kind: "literal", value: 2 },
                inferredType: { kind: "primitiveType", name: "number" },
              },
            },
          ],
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(4);
      expect(body[0]?.kind).to.equal("yieldStatement");
      expect(body[1]?.kind).to.equal("variableDeclaration");
      expect(body[2]?.kind).to.equal("ifStatement");
      expect(body[3]?.kind).to.equal("variableDeclaration");
    });

    it("should transform yield in conditional expression branches lazily", () => {
      const module = createGeneratorModule([
        {
          kind: "variableDeclaration",
          declarationKind: "const",
          isExported: false,
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "x" },
              initializer: {
                kind: "conditional",
                condition: { kind: "literal", value: true },
                whenTrue: createYield({ kind: "literal", value: 1 }),
                whenFalse: createYield({ kind: "literal", value: 2 }),
                inferredType: { kind: "primitiveType", name: "number" },
              },
            },
          ],
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(3);
      expect(body[0]?.kind).to.equal("variableDeclaration");
      expect(body[1]?.kind).to.equal("ifStatement");
      expect(body[2]?.kind).to.equal("variableDeclaration");

      const loweredIf = body[1] as Extract<
        IrStatement,
        { kind: "ifStatement" }
      >;
      expect(loweredIf.thenStatement.kind).to.equal("blockStatement");
      expect(loweredIf.elseStatement?.kind).to.equal("blockStatement");
      const thenStatements =
        loweredIf.thenStatement.kind === "blockStatement"
          ? loweredIf.thenStatement.statements
          : [];
      const elseStatements =
        loweredIf.elseStatement?.kind === "blockStatement"
          ? loweredIf.elseStatement.statements
          : [];
      expect(thenStatements[0]?.kind).to.equal("yieldStatement");
      expect(thenStatements[1]?.kind).to.equal("expressionStatement");
      expect(elseStatements[0]?.kind).to.equal("yieldStatement");
      expect(elseStatements[1]?.kind).to.equal("expressionStatement");
    });

    it("should transform return yield expression into yield+generatorReturn", () => {
      const module = createGeneratorModule([
        {
          kind: "returnStatement",
          expression: createYield({ kind: "literal", value: 1 }),
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(2);
      expect(body[0]?.kind).to.equal("yieldStatement");
      expect(body[1]?.kind).to.equal("generatorReturnStatement");
    });

    it("should transform throw yield expression into yield+throw", () => {
      const module = createGeneratorModule([
        {
          kind: "throwStatement",
          expression: createYield({ kind: "identifier", name: "err" }),
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(2);
      expect(body[0]?.kind).to.equal("yieldStatement");
      expect(body[1]?.kind).to.equal("throwStatement");
    });

    it("should transform nested yield in return expression", () => {
      const module = createGeneratorModule([
        {
          kind: "returnStatement",
          expression: {
            kind: "binary",
            operator: "+",
            left: createYield({ kind: "literal", value: 1 }),
            right: { kind: "literal", value: 2 },
          },
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(2);
      expect(body[0]?.kind).to.equal("yieldStatement");
      expect(body[1]?.kind).to.equal("generatorReturnStatement");
    });
  });
});
