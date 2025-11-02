/**
 * Tests for Statement Emission
 * Tests emission of control flow statements (if, for-of)
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "../../emitter.js";
import { IrModule } from "@tsonic/frontend";

describe("Statement Emission", () => {
  it("should emit if statements", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "check",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "x" },
              type: { kind: "primitiveType", name: "number" },
              isOptional: false,
              isRest: false,
            },
          ],
          returnType: { kind: "primitiveType", name: "string" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "ifStatement",
                condition: {
                  kind: "binary",
                  operator: ">",
                  left: { kind: "identifier", name: "x" },
                  right: { kind: "literal", value: 0 },
                },
                thenStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: { kind: "literal", value: "positive" },
                    },
                  ],
                },
                elseStatement: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: {
                        kind: "literal",
                        value: "negative or zero",
                      },
                    },
                  ],
                },
              },
            ],
          },
          isExported: true,
          isAsync: false,
          isGenerator: false,
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include("if (x > 0.0)");
    expect(result).to.include('return "positive"');
    expect(result).to.include("else");
    expect(result).to.include('return "negative or zero"');
  });

  it("should emit for loops", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "loop",
          parameters: [],
          returnType: { kind: "voidType" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "forOfStatement",
                variable: { kind: "identifierPattern", name: "item" },
                expression: { kind: "identifier", name: "items" },
                body: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "expressionStatement",
                      expression: {
                        kind: "call",
                        callee: {
                          kind: "memberAccess",
                          object: { kind: "identifier", name: "console" },
                          property: "log",
                          isComputed: false,
                          isOptional: false,
                        },
                        arguments: [{ kind: "identifier", name: "item" }],
                        isOptional: false,
                      },
                    },
                  ],
                },
              },
            ],
          },
          isExported: true,
          isAsync: false,
          isGenerator: false,
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include("foreach (var item in items)");
    expect(result).to.include("Tsonic.Runtime.console.log(item)");
    expect(result).to.include("using Tsonic.Runtime");
  });
});
