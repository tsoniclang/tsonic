/**
 * Tests for Yield Lowering Pass
 *
 * Tests:
 * - containsYield detection
 * - countYields counting
 * - Pattern transformations (yield expr, const x = yield, assignment)
 * - Unsupported position detection (TSN6101)
 * - Non-generator function handling (no transformation)
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { runYieldLoweringPass } from "./yield-lowering-pass.js";
import {
  IrModule,
  IrStatement,
  IrExpression,
  IrBlockStatement,
  IrYieldStatement,
} from "../types.js";

/**
 * Assert value is not null/undefined and return it typed as non-null.
 */
const assertDefined = <T>(value: T | null | undefined, msg?: string): T => {
  if (value === null || value === undefined) {
    throw new Error(msg ?? "Expected value to be defined");
  }
  return value;
};

/**
 * Helper to create a minimal generator function module
 */
const createGeneratorModule = (
  body: IrStatement[],
  options: {
    isGenerator?: boolean;
    returnType?: IrModule["body"][0] extends { returnType?: infer R }
      ? R
      : never;
  } = {}
): IrModule => ({
  kind: "module",
  filePath: "/src/test.ts",
  namespace: "Test",
  className: "test",
  isStaticContainer: true,
  imports: [],
  body: [
    {
      kind: "functionDeclaration",
      name: "testGen",
      parameters: [],
      returnType: options.returnType ?? {
        kind: "referenceType",
        name: "Generator",
        typeArguments: [
          { kind: "primitiveType", name: "number" },
          { kind: "voidType" },
          { kind: "primitiveType", name: "number" },
        ],
      },
      body: { kind: "blockStatement", statements: body },
      isAsync: false,
      isGenerator: options.isGenerator ?? true,
      isExported: true,
    },
  ],
  exports: [],
});

/**
 * Helper to create a yield expression
 */
const createYield = (value?: IrExpression, delegate = false): IrExpression => ({
  kind: "yield",
  expression: value,
  delegate,
});

/**
 * Helper to extract the function body from a module
 */
const getGeneratorBody = (module: IrModule): readonly IrStatement[] => {
  const func = module.body[0];
  if (func?.kind === "functionDeclaration") {
    return func.body.statements;
  }
  return [];
};

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

  describe("Bidirectional Pattern: x = yield value", () => {
    it("should transform assignment with yield on right side", () => {
      const module = createGeneratorModule([
        {
          kind: "expressionStatement",
          expression: {
            kind: "assignment",
            operator: "=",
            left: { kind: "identifierPattern", name: "x" },
            right: createYield({ kind: "literal", value: 5 }),
          },
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      const yieldStmt = body[0] as IrYieldStatement;
      expect(yieldStmt.kind).to.equal("yieldStatement");
      expect(yieldStmt.receiveTarget?.kind).to.equal("identifierPattern");
    });

    it("should transform compound assignment with yield", () => {
      const module = createGeneratorModule([
        {
          kind: "expressionStatement",
          expression: {
            kind: "assignment",
            operator: "+=",
            left: { kind: "identifierPattern", name: "x" },
            right: createYield({ kind: "literal", value: 5 }),
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
      const assignmentStmt = body[1] as Extract<
        IrStatement,
        { kind: "expressionStatement" }
      >;
      expect(assignmentStmt.expression.kind).to.equal("assignment");
      if (assignmentStmt.expression.kind === "assignment") {
        expect(assignmentStmt.expression.operator).to.equal("+=");
        expect(assignmentStmt.expression.right.kind).to.equal("identifier");
      }
    });

    it("should reject compound assignment to complex target with yield", () => {
      const module = createGeneratorModule([
        {
          kind: "expressionStatement",
          expression: {
            kind: "assignment",
            operator: "+=",
            left: {
              kind: "memberAccess",
              object: { kind: "identifier", name: "obj" },
              property: "count",
              isOptional: false,
              isComputed: false,
            },
            right: createYield({ kind: "literal", value: 5 }),
          },
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics).to.have.length(1);
      expect(result.diagnostics[0]?.code).to.equal("TSN6101");
      expect(result.diagnostics[0]?.message).to.include(
        "compound assignment to complex target"
      );
    });

    it("should transform assignment with identifier expression target", () => {
      const module = createGeneratorModule([
        {
          kind: "expressionStatement",
          expression: {
            kind: "assignment",
            operator: "=",
            left: { kind: "identifier", name: "x" },
            right: createYield({ kind: "literal", value: 5 }),
          },
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      const yieldStmt = body[0] as IrYieldStatement;
      expect(yieldStmt.kind).to.equal("yieldStatement");
      expect(yieldStmt.receiveTarget?.kind).to.equal("identifierPattern");
      expect((yieldStmt.receiveTarget as { name: string }).name).to.equal("x");
    });
  });

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

      const loweredIf = body[1] as Extract<IrStatement, { kind: "ifStatement" }>;
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

    it("should transform for-loop assignment initializer with yield", () => {
      const module = createGeneratorModule([
        {
          kind: "forStatement",
          initializer: {
            kind: "assignment",
            operator: "=",
            left: { kind: "identifierPattern", name: "x" },
            right: createYield({ kind: "literal", value: 1 }),
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
      expect(loweredFor.initializer).to.equal(undefined);
    });

    it("should transform nested yield in for-loop assignment initializer", () => {
      const module = createGeneratorModule([
        {
          kind: "forStatement",
          initializer: {
            kind: "assignment",
            operator: "=",
            left: { kind: "identifierPattern", name: "x" },
            right: {
              kind: "binary",
              operator: "+",
              left: createYield({ kind: "literal", value: 1 }),
              right: { kind: "literal", value: 2 },
            },
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
      expect(loweredFor.initializer?.kind).to.equal("assignment");
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
  });

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

  describe("Non-Generator Functions", () => {
    it("should not transform yield expressions in non-generator functions", () => {
      // This shouldn't happen in practice (TS would reject it),
      // but the pass should handle it gracefully
      const module = createGeneratorModule(
        [
          {
            kind: "expressionStatement",
            expression: createYield({ kind: "literal", value: 42 }),
          },
        ],
        { isGenerator: false }
      );

      const result = runYieldLoweringPass([module]);

      // The pass doesn't transform non-generators
      expect(result.ok).to.be.true;
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      // Should still be expressionStatement with yield, not yieldStatement
      expect(body[0]?.kind).to.equal("expressionStatement");
    });

    it("should process nested generator functions inside non-generators", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "Test",
        className: "test",
        isStaticContainer: true,
        imports: [],
        body: [
          {
            kind: "functionDeclaration",
            name: "outer",
            parameters: [],
            returnType: { kind: "voidType" },
            body: {
              kind: "blockStatement",
              statements: [
                {
                  kind: "functionDeclaration",
                  name: "innerGen",
                  parameters: [],
                  returnType: {
                    kind: "referenceType",
                    name: "Generator",
                    typeArguments: [{ kind: "primitiveType", name: "number" }],
                  },
                  body: {
                    kind: "blockStatement",
                    statements: [
                      {
                        kind: "expressionStatement",
                        expression: createYield({ kind: "literal", value: 1 }),
                      },
                    ],
                  },
                  isAsync: false,
                  isGenerator: true,
                  isExported: false,
                },
              ],
            },
            isAsync: false,
            isGenerator: false,
            isExported: true,
          },
        ],
        exports: [],
      };

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      // The inner generator should have its yield transformed
      const outerFunc = result.modules[0]?.body[0] as Extract<
        IrStatement,
        { kind: "functionDeclaration" }
      >;
      const innerFunc = outerFunc.body.statements[0] as Extract<
        IrStatement,
        { kind: "functionDeclaration" }
      >;
      expect(innerFunc.body.statements[0]?.kind).to.equal("yieldStatement");
    });
  });

  describe("Multiple Modules", () => {
    it("should process multiple modules independently", () => {
      const module1 = createGeneratorModule([
        {
          kind: "expressionStatement",
          expression: createYield({ kind: "literal", value: 1 }),
        },
      ]);
      const module2 = createGeneratorModule([
        {
          kind: "expressionStatement",
          expression: createYield({ kind: "literal", value: 2 }),
        },
      ]);

      const result = runYieldLoweringPass([module1, module2]);

      expect(result.ok).to.be.true;
      expect(result.modules).to.have.length(2);

      const body1 = getGeneratorBody(assertDefined(result.modules[0]));
      const body2 = getGeneratorBody(assertDefined(result.modules[1]));

      expect(body1[0]?.kind).to.equal("yieldStatement");
      expect(body2[0]?.kind).to.equal("yieldStatement");
    });

    it("should collect diagnostics from all modules", () => {
      const module1 = createGeneratorModule([
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
      const module2 = createGeneratorModule([
        {
          kind: "throwStatement",
          expression: {
            kind: "call",
            callee: { kind: "identifier", name: "wrap" },
            arguments: [createYield({ kind: "identifier", name: "err" })],
            isOptional: false,
          },
        },
      ]);

      const result = runYieldLoweringPass([module1, module2]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
    });
  });

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
