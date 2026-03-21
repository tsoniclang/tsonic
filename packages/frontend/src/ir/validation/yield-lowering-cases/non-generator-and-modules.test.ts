/**
 * Tests for non-generator function handling and multiple module processing.
 *
 * Topics:
 * - Non-generator functions (no transformation)
 * - Nested generator functions inside non-generators
 * - Independent multi-module processing
 * - Cross-module diagnostic collection
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
  type IrModule,
  type IrStatement,
} from "./helpers.js";

describe("Yield Lowering Pass", () => {
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
});
