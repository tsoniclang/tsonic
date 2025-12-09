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
const createYield = (
  value?: IrExpression,
  delegate = false
): IrExpression => ({
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

      const body = getGeneratorBody(result.modules[0]!);
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
      const body = getGeneratorBody(result.modules[0]!);
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
      const body = getGeneratorBody(result.modules[0]!);
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
      const body = getGeneratorBody(result.modules[0]!);
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
      const body = getGeneratorBody(result.modules[0]!);
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
      const body = getGeneratorBody(result.modules[0]!);
      const yieldStmt = body[0] as IrYieldStatement;
      expect(yieldStmt.kind).to.equal("yieldStatement");
      expect(yieldStmt.receiveTarget?.kind).to.equal("identifierPattern");
    });

    it("should reject compound assignment with yield", () => {
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

      expect(result.ok).to.be.false;
      expect(result.diagnostics).to.have.length(1);
      expect(result.diagnostics[0]?.code).to.equal("TSN6101");
      expect(result.diagnostics[0]?.message).to.include("compound assignment");
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
                  { kind: "identifierPattern", name: "a" },
                  { kind: "identifierPattern", name: "b" },
                ],
              },
              initializer: createYield({ kind: "literal", value: null }),
            },
          ],
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      const body = getGeneratorBody(result.modules[0]!);
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
      const body = getGeneratorBody(result.modules[0]!);
      const yieldStmt = body[0] as IrYieldStatement;
      expect(yieldStmt.receiveTarget?.kind).to.equal("objectPattern");
    });
  });

  describe("Unsupported Patterns (TSN6101)", () => {
    it("should reject yield in call argument", () => {
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

      expect(result.ok).to.be.false;
      expect(result.diagnostics[0]?.code).to.equal("TSN6101");
    });

    it("should reject nested yield in initializer", () => {
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

      expect(result.ok).to.be.false;
      expect(result.diagnostics[0]?.code).to.equal("TSN6101");
    });

    it("should reject yield in return expression", () => {
      const module = createGeneratorModule([
        {
          kind: "returnStatement",
          expression: createYield({ kind: "literal", value: 1 }),
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics[0]?.code).to.equal("TSN6101");
    });

    it("should reject yield in throw expression", () => {
      const module = createGeneratorModule([
        {
          kind: "throwStatement",
          expression: createYield({ kind: "identifier", name: "err" }),
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics[0]?.code).to.equal("TSN6101");
    });

    it("should reject yield in for loop condition", () => {
      const module = createGeneratorModule([
        {
          kind: "forStatement",
          condition: createYield({ kind: "literal", value: true }),
          body: { kind: "blockStatement", statements: [] },
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics[0]?.code).to.equal("TSN6101");
    });

    it("should reject yield in for loop update", () => {
      const module = createGeneratorModule([
        {
          kind: "forStatement",
          condition: { kind: "literal", value: true },
          update: createYield({ kind: "literal", value: 1 }),
          body: { kind: "blockStatement", statements: [] },
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics[0]?.code).to.equal("TSN6101");
    });
  });

  describe("Control Flow Structures", () => {
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
      const body = getGeneratorBody(result.modules[0]!);
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
      const body = getGeneratorBody(result.modules[0]!);
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

      const body1 = getGeneratorBody(result.modules[0]!);
      const body2 = getGeneratorBody(result.modules[1]!);

      expect(body1[0]?.kind).to.equal("yieldStatement");
      expect(body2[0]?.kind).to.equal("yieldStatement");
    });

    it("should collect diagnostics from all modules", () => {
      const module1 = createGeneratorModule([
        {
          kind: "returnStatement",
          expression: createYield({ kind: "literal", value: 1 }),
        },
      ]);
      const module2 = createGeneratorModule([
        {
          kind: "throwStatement",
          expression: createYield({ kind: "identifier", name: "err" }),
        },
      ]);

      const result = runYieldLoweringPass([module1, module2]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics).to.have.length(2);
    });
  });
});
