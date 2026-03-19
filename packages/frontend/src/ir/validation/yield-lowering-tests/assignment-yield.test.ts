/**
 * Tests for assignment-based yield patterns (x = yield value).
 *
 * Topics:
 * - Simple assignment with yield
 * - Compound assignment (+=) with yield
 * - Member target assignment with yield
 * - Computed member target assignment with yield
 * - Target object / computed property containing yield
 * - Identifier expression target assignment
 * - Combined target+value yield patterns
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
  type IrYieldStatement,
} from "./helpers.js";

describe("Yield Lowering Pass", () => {
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

    it("should transform compound assignment to member target with yield", () => {
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

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(3);
      expect(body[0]?.kind).to.equal("variableDeclaration");
      expect(body[1]?.kind).to.equal("yieldStatement");
      expect(body[2]?.kind).to.equal("expressionStatement");

      const assignmentStmt = body[2] as Extract<
        IrStatement,
        { kind: "expressionStatement" }
      >;
      expect(assignmentStmt.expression.kind).to.equal("assignment");
      if (assignmentStmt.expression.kind === "assignment") {
        expect(assignmentStmt.expression.left.kind).to.equal("memberAccess");
        if (assignmentStmt.expression.left.kind === "memberAccess") {
          expect(assignmentStmt.expression.left.object.kind).to.equal(
            "identifier"
          );
          expect(assignmentStmt.expression.left.property).to.equal("count");
        }
      }
    });

    it("should transform compound assignment to computed member target with yield", () => {
      const module = createGeneratorModule([
        {
          kind: "expressionStatement",
          expression: {
            kind: "assignment",
            operator: "+=",
            left: {
              kind: "memberAccess",
              object: { kind: "identifier", name: "obj" },
              property: { kind: "identifier", name: "key" },
              isOptional: false,
              isComputed: true,
            },
            right: createYield({ kind: "literal", value: 5 }),
          },
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(4);
      expect(body[0]?.kind).to.equal("variableDeclaration");
      expect(body[1]?.kind).to.equal("variableDeclaration");
      expect(body[2]?.kind).to.equal("yieldStatement");
      expect(body[3]?.kind).to.equal("expressionStatement");
    });

    it("should transform compound assignment when target evaluation contains yield", () => {
      const module = createGeneratorModule([
        {
          kind: "expressionStatement",
          expression: {
            kind: "assignment",
            operator: "+=",
            left: {
              kind: "memberAccess",
              object: createYield({ kind: "identifier", name: "obj" }),
              property: "count",
              isOptional: false,
              isComputed: false,
            },
            right: createYield({ kind: "literal", value: 5 }),
          },
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(4);
      expect(body[0]?.kind).to.equal("yieldStatement");
      expect(body[1]?.kind).to.equal("variableDeclaration");
      expect(body[2]?.kind).to.equal("yieldStatement");
      expect(body[3]?.kind).to.equal("expressionStatement");
    });

    it("should transform compound assignment when computed property contains yield", () => {
      const module = createGeneratorModule([
        {
          kind: "expressionStatement",
          expression: {
            kind: "assignment",
            operator: "+=",
            left: {
              kind: "memberAccess",
              object: { kind: "identifier", name: "obj" },
              property: createYield({ kind: "identifier", name: "key" }),
              isOptional: false,
              isComputed: true,
            },
            right: createYield({ kind: "literal", value: 5 }),
          },
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(5);
      expect(body[0]?.kind).to.equal("variableDeclaration");
      expect(body[1]?.kind).to.equal("yieldStatement");
      expect(body[2]?.kind).to.equal("variableDeclaration");
      expect(body[3]?.kind).to.equal("yieldStatement");
      expect(body[4]?.kind).to.equal("expressionStatement");
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

    it("should transform assignment to member target with yield", () => {
      const module = createGeneratorModule([
        {
          kind: "expressionStatement",
          expression: {
            kind: "assignment",
            operator: "=",
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

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(3);
      expect(body[0]?.kind).to.equal("variableDeclaration");
      expect(body[1]?.kind).to.equal("yieldStatement");
      expect(body[2]?.kind).to.equal("expressionStatement");
    });

    it("should transform assignment to computed member target with yield", () => {
      const module = createGeneratorModule([
        {
          kind: "expressionStatement",
          expression: {
            kind: "assignment",
            operator: "=",
            left: {
              kind: "memberAccess",
              object: { kind: "identifier", name: "obj" },
              property: { kind: "identifier", name: "key" },
              isOptional: false,
              isComputed: true,
            },
            right: createYield({ kind: "literal", value: 5 }),
          },
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(4);
      expect(body[0]?.kind).to.equal("variableDeclaration");
      expect(body[1]?.kind).to.equal("variableDeclaration");
      expect(body[2]?.kind).to.equal("yieldStatement");
      expect(body[3]?.kind).to.equal("expressionStatement");
    });

    it("should transform assignment when target object contains yield", () => {
      const module = createGeneratorModule([
        {
          kind: "expressionStatement",
          expression: {
            kind: "assignment",
            operator: "=",
            left: {
              kind: "memberAccess",
              object: createYield({ kind: "identifier", name: "obj" }),
              property: "count",
              isOptional: false,
              isComputed: false,
            },
            right: createYield({ kind: "literal", value: 5 }),
          },
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(4);
      expect(body[0]?.kind).to.equal("yieldStatement");
      expect(body[1]?.kind).to.equal("variableDeclaration");
      expect(body[2]?.kind).to.equal("yieldStatement");
      expect(body[3]?.kind).to.equal("expressionStatement");
    });

    it("should transform assignment when computed property contains yield", () => {
      const module = createGeneratorModule([
        {
          kind: "expressionStatement",
          expression: {
            kind: "assignment",
            operator: "=",
            left: {
              kind: "memberAccess",
              object: { kind: "identifier", name: "obj" },
              property: createYield({ kind: "identifier", name: "key" }),
              isOptional: false,
              isComputed: true,
            },
            right: createYield({ kind: "literal", value: 5 }),
          },
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(5);
      expect(body[0]?.kind).to.equal("variableDeclaration");
      expect(body[1]?.kind).to.equal("yieldStatement");
      expect(body[2]?.kind).to.equal("variableDeclaration");
      expect(body[3]?.kind).to.equal("yieldStatement");
      expect(body[4]?.kind).to.equal("expressionStatement");
    });

    it("should transform assignment when target object and right expression both contain yield", () => {
      const module = createGeneratorModule([
        {
          kind: "expressionStatement",
          expression: {
            kind: "assignment",
            operator: "=",
            left: {
              kind: "memberAccess",
              object: createYield({ kind: "identifier", name: "obj" }),
              property: "count",
              isOptional: false,
              isComputed: false,
            },
            right: {
              kind: "binary",
              operator: "+",
              left: createYield({ kind: "literal", value: 5 }),
              right: { kind: "literal", value: 1 },
            },
          },
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(4);
      expect(body[0]?.kind).to.equal("yieldStatement");
      expect(body[1]?.kind).to.equal("variableDeclaration");
      expect(body[2]?.kind).to.equal("yieldStatement");
      expect(body[3]?.kind).to.equal("expressionStatement");
    });

    it("should transform assignment when computed property and right expression both contain yield", () => {
      const module = createGeneratorModule([
        {
          kind: "expressionStatement",
          expression: {
            kind: "assignment",
            operator: "=",
            left: {
              kind: "memberAccess",
              object: { kind: "identifier", name: "obj" },
              property: createYield({ kind: "identifier", name: "key" }),
              isOptional: false,
              isComputed: true,
            },
            right: {
              kind: "binary",
              operator: "+",
              left: createYield({ kind: "literal", value: 5 }),
              right: { kind: "literal", value: 1 },
            },
          },
        },
      ]);

      const result = runYieldLoweringPass([module]);

      expect(result.ok).to.be.true;
      expect(result.diagnostics).to.have.length(0);
      const body = getGeneratorBody(assertDefined(result.modules[0]));
      expect(body).to.have.length(5);
      expect(body[0]?.kind).to.equal("variableDeclaration");
      expect(body[1]?.kind).to.equal("yieldStatement");
      expect(body[2]?.kind).to.equal("variableDeclaration");
      expect(body[3]?.kind).to.equal("yieldStatement");
      expect(body[4]?.kind).to.equal("expressionStatement");
    });
  });
});
