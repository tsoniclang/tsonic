/**
 * Tests for yield lowering in for-loop initializers.
 *
 * Topics:
 * - For-loop assignment initializer with yield
 * - For-loop member assignment initializer with yield
 * - For-loop computed member assignment initializer with yield
 * - For-loop member assignment when object evaluation contains yield
 * - For-loop member assignment when computed property contains yield
 * - For-loop member assignment when target object and value both contain yield
 * - For-loop member assignment when computed property and value both contain yield
 * - Nested yield in for-loop assignment initializer
 * - Direct/nested yield in for-loop declaration initializer
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
  getTempNameFromSingleDeclarator,
  type IrStatement,
  type IrExpression,
} from "./helpers.js";

describe("Yield Lowering Pass", () => {
  describe("Unsupported Patterns (TSN6101)", () => {
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

    it("should transform for-loop member assignment initializer with yield", () => {
      const module = createGeneratorModule([
        {
          kind: "forStatement",
          initializer: {
            kind: "assignment",
            operator: "=",
            left: {
              kind: "memberAccess",
              object: { kind: "identifier", name: "obj" },
              property: "count",
              isOptional: false,
              isComputed: false,
            },
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
      expect(body).to.have.length(4);
      expect(body[0]?.kind).to.equal("variableDeclaration");
      expect(body[1]?.kind).to.equal("yieldStatement");
      expect(body[2]?.kind).to.equal("expressionStatement");
      expect(body[3]?.kind).to.equal("forStatement");
      const objectTempName = getTempNameFromSingleDeclarator(
        assertDefined(body[0])
      );
      const receiveName = (
        body[1] as Extract<IrStatement, { kind: "yieldStatement" }>
      ).receiveTarget as { kind: "identifierPattern"; name: string };
      const assignExpr = (
        body[2] as Extract<IrStatement, { kind: "expressionStatement" }>
      ).expression as Extract<IrExpression, { kind: "assignment" }>;
      expect(assignExpr.left.kind).to.equal("memberAccess");
      const left = assignExpr.left as Extract<
        IrExpression,
        { kind: "memberAccess" }
      >;
      expect(left.object.kind).to.equal("identifier");
      expect((left.object as { name: string }).name).to.equal(objectTempName);
      expect(left.property).to.equal("count");
      expect(assignExpr.right.kind).to.equal("identifier");
      expect((assignExpr.right as { name: string }).name).to.equal(
        receiveName.name
      );
      const loweredFor = body[3] as Extract<
        IrStatement,
        { kind: "forStatement" }
      >;
      expect(loweredFor.initializer).to.equal(undefined);
    });

    it("should transform for-loop computed member assignment initializer with yield", () => {
      const module = createGeneratorModule([
        {
          kind: "forStatement",
          initializer: {
            kind: "assignment",
            operator: "=",
            left: {
              kind: "memberAccess",
              object: { kind: "identifier", name: "obj" },
              property: { kind: "identifier", name: "key" },
              isOptional: false,
              isComputed: true,
            },
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
      expect(body).to.have.length(5);
      expect(body[0]?.kind).to.equal("variableDeclaration");
      expect(body[1]?.kind).to.equal("variableDeclaration");
      expect(body[2]?.kind).to.equal("yieldStatement");
      expect(body[3]?.kind).to.equal("expressionStatement");
      expect(body[4]?.kind).to.equal("forStatement");
      const objectTempName = getTempNameFromSingleDeclarator(
        assertDefined(body[0])
      );
      const propertyTempName = getTempNameFromSingleDeclarator(
        assertDefined(body[1])
      );
      const receiveName = (
        body[2] as Extract<IrStatement, { kind: "yieldStatement" }>
      ).receiveTarget as { kind: "identifierPattern"; name: string };
      const assignExpr = (
        body[3] as Extract<IrStatement, { kind: "expressionStatement" }>
      ).expression as Extract<IrExpression, { kind: "assignment" }>;
      expect(assignExpr.left.kind).to.equal("memberAccess");
      const left = assignExpr.left as Extract<
        IrExpression,
        { kind: "memberAccess" }
      >;
      expect(left.object.kind).to.equal("identifier");
      expect((left.object as { name: string }).name).to.equal(objectTempName);
      expect(typeof left.property).to.not.equal("string");
      expect((left.property as { kind: string }).kind).to.equal("identifier");
      expect((left.property as { name: string }).name).to.equal(
        propertyTempName
      );
      expect(assignExpr.right.kind).to.equal("identifier");
      expect((assignExpr.right as { name: string }).name).to.equal(
        receiveName.name
      );
      const loweredFor = body[4] as Extract<
        IrStatement,
        { kind: "forStatement" }
      >;
      expect(loweredFor.initializer).to.equal(undefined);
    });

    it("should transform for-loop member assignment initializer when object evaluation contains yield", () => {
      const module = createGeneratorModule([
        {
          kind: "forStatement",
          initializer: {
            kind: "assignment",
            operator: "=",
            left: {
              kind: "memberAccess",
              object: createYield({ kind: "identifier", name: "obj" }),
              property: "count",
              isOptional: false,
              isComputed: false,
            },
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
      expect(body).to.have.length(5);
      expect(body[0]?.kind).to.equal("yieldStatement");
      expect(body[1]?.kind).to.equal("variableDeclaration");
      expect(body[2]?.kind).to.equal("yieldStatement");
      expect(body[3]?.kind).to.equal("expressionStatement");
      expect(body[4]?.kind).to.equal("forStatement");
      const objectTempName = getTempNameFromSingleDeclarator(
        assertDefined(body[1])
      );
      const objectYieldReceive = (
        body[0] as Extract<IrStatement, { kind: "yieldStatement" }>
      ).receiveTarget as { kind: "identifierPattern"; name: string };
      const objectTempInit = (
        body[1] as Extract<IrStatement, { kind: "variableDeclaration" }>
      ).declarations[0]?.initializer as { kind: string; name: string };
      expect(objectTempInit.kind).to.equal("identifier");
      expect(objectTempInit.name).to.equal(objectYieldReceive.name);
      const assignExpr = (
        body[3] as Extract<IrStatement, { kind: "expressionStatement" }>
      ).expression as Extract<IrExpression, { kind: "assignment" }>;
      expect(assignExpr.left.kind).to.equal("memberAccess");
      const left = assignExpr.left as Extract<
        IrExpression,
        { kind: "memberAccess" }
      >;
      expect(left.object.kind).to.equal("identifier");
      expect((left.object as { name: string }).name).to.equal(objectTempName);
    });

    it("should transform for-loop member assignment initializer when computed property contains yield", () => {
      const module = createGeneratorModule([
        {
          kind: "forStatement",
          initializer: {
            kind: "assignment",
            operator: "=",
            left: {
              kind: "memberAccess",
              object: { kind: "identifier", name: "obj" },
              property: createYield({ kind: "identifier", name: "key" }),
              isOptional: false,
              isComputed: true,
            },
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
      expect(body).to.have.length(6);
      expect(body[0]?.kind).to.equal("variableDeclaration");
      expect(body[1]?.kind).to.equal("yieldStatement");
      expect(body[2]?.kind).to.equal("variableDeclaration");
      expect(body[3]?.kind).to.equal("yieldStatement");
      expect(body[4]?.kind).to.equal("expressionStatement");
      expect(body[5]?.kind).to.equal("forStatement");
      const objectTempName = getTempNameFromSingleDeclarator(
        assertDefined(body[0])
      );
      const propertyTempName = getTempNameFromSingleDeclarator(
        assertDefined(body[2])
      );
      const propertyYieldReceive = (
        body[1] as Extract<IrStatement, { kind: "yieldStatement" }>
      ).receiveTarget as { kind: "identifierPattern"; name: string };
      const propertyTempInit = (
        body[2] as Extract<IrStatement, { kind: "variableDeclaration" }>
      ).declarations[0]?.initializer as { kind: string; name: string };
      expect(propertyTempInit.kind).to.equal("identifier");
      expect(propertyTempInit.name).to.equal(propertyYieldReceive.name);
      const assignExpr = (
        body[4] as Extract<IrStatement, { kind: "expressionStatement" }>
      ).expression as Extract<IrExpression, { kind: "assignment" }>;
      expect(assignExpr.left.kind).to.equal("memberAccess");
      const left = assignExpr.left as Extract<
        IrExpression,
        { kind: "memberAccess" }
      >;
      expect(left.object.kind).to.equal("identifier");
      expect((left.object as { name: string }).name).to.equal(objectTempName);
      expect(typeof left.property).to.not.equal("string");
      expect((left.property as { kind: string }).kind).to.equal("identifier");
      expect((left.property as { name: string }).name).to.equal(
        propertyTempName
      );
    });

    it("should transform for-loop member assignment initializer when target object and value expression both contain yield", () => {
      const module = createGeneratorModule([
        {
          kind: "forStatement",
          initializer: {
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
      expect(body).to.have.length(5);
      expect(body[0]?.kind).to.equal("yieldStatement");
      expect(body[1]?.kind).to.equal("variableDeclaration");
      expect(body[2]?.kind).to.equal("yieldStatement");
      expect(body[3]?.kind).to.equal("expressionStatement");
      expect(body[4]?.kind).to.equal("forStatement");
    });

    it("should transform for-loop member assignment initializer when computed property and value expression both contain yield", () => {
      const module = createGeneratorModule([
        {
          kind: "forStatement",
          initializer: {
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
      expect(body).to.have.length(6);
      expect(body[0]?.kind).to.equal("variableDeclaration");
      expect(body[1]?.kind).to.equal("yieldStatement");
      expect(body[2]?.kind).to.equal("variableDeclaration");
      expect(body[3]?.kind).to.equal("yieldStatement");
      expect(body[4]?.kind).to.equal("expressionStatement");
      expect(body[5]?.kind).to.equal("forStatement");
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
  });
});
