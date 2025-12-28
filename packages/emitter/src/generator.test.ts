/**
 * Tests for generator emission
 * Per spec/13-generators.md
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "./emitter.js";
import { IrModule } from "@tsonic/frontend";

describe("Generator Emission", () => {
  it("should generate exchange class for simple generator", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/counter.ts",
      namespace: "Test",
      className: "counter",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "counter",
          parameters: [],
          returnType: {
            kind: "referenceType",
            name: "Generator",
            typeArguments: [
              { kind: "primitiveType", name: "number" },
              { kind: "primitiveType", name: "undefined" },
              { kind: "primitiveType", name: "undefined" },
            ],
          },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "variableDeclaration",
                declarationKind: "let",
                isExported: false,
                declarations: [
                  {
                    kind: "variableDeclarator",
                    name: { kind: "identifierPattern", name: "i" },
                    type: { kind: "primitiveType", name: "number" },
                    initializer: { kind: "literal", value: 0 },
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
                      expression: {
                        kind: "yield",
                        expression: { kind: "identifier", name: "i" },
                        delegate: false,
                      },
                    },
                    {
                      kind: "expressionStatement",
                      expression: {
                        kind: "assignment",
                        operator: "+=",
                        left: { kind: "identifier", name: "i" },
                        right: { kind: "literal", value: 1 },
                      },
                    },
                  ],
                },
              },
            ],
          },
          isAsync: false,
          isGenerator: true,
          isExported: true,
        },
      ],
    };

    const code = emitModule(module);

    // Should contain exchange class
    expect(code).to.include("public sealed class counter_exchange");
    expect(code).to.include("public object? Input { get; set; }");
    expect(code).to.include("public double Output { get; set; }");

    // Should have IEnumerable return type with fully-qualified name
    expect(code).to.include("counter_exchange> counter()");

    // Should NOT use using directives - all types use global:: FQN
    expect(code).to.not.include("using System.Collections.Generic");

    // Should initialize exchange variable
    expect(code).to.include("var exchange = new counter_exchange()");

    // Should emit yield with exchange object pattern
    expect(code).to.include("exchange.Output = i");
    expect(code).to.include("yield return exchange");
  });

  it("should handle async generator", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/asyncCounter.ts",
      namespace: "Test",
      className: "asyncCounter",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "asyncCounter",
          parameters: [],
          returnType: {
            kind: "referenceType",
            name: "AsyncGenerator",
            typeArguments: [
              { kind: "primitiveType", name: "number" },
              { kind: "primitiveType", name: "undefined" },
              { kind: "primitiveType", name: "undefined" },
            ],
          },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "variableDeclaration",
                declarationKind: "let",
                isExported: false,
                declarations: [
                  {
                    kind: "variableDeclarator",
                    name: { kind: "identifierPattern", name: "i" },
                    type: { kind: "primitiveType", name: "number" },
                    initializer: { kind: "literal", value: 0 },
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
                      expression: {
                        kind: "yield",
                        expression: { kind: "identifier", name: "i" },
                        delegate: false,
                      },
                    },
                    {
                      kind: "expressionStatement",
                      expression: {
                        kind: "assignment",
                        operator: "+=",
                        left: { kind: "identifier", name: "i" },
                        right: { kind: "literal", value: 1 },
                      },
                    },
                  ],
                },
              },
            ],
          },
          isAsync: true,
          isGenerator: true,
          isExported: true,
        },
      ],
    };

    const code = emitModule(module);

    // Should contain exchange class
    expect(code).to.include("public sealed class asyncCounter_exchange");

    // Should have IAsyncEnumerable return type with async and global:: FQN
    expect(code).to.include(
      "public static async global::System.Collections.Generic.IAsyncEnumerable<asyncCounter_exchange> asyncCounter()"
    );
  });

  describe("Bidirectional Generators", () => {
    it("should generate wrapper class for bidirectional generator", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/test/accumulator.ts",
        namespace: "Test",
        className: "accumulator",
        isStaticContainer: true,
        imports: [],
        exports: [],
        body: [
          {
            kind: "functionDeclaration",
            name: "accumulator",
            parameters: [
              {
                kind: "parameter",
                pattern: { kind: "identifierPattern", name: "start" },
                type: { kind: "primitiveType", name: "number" },
                isOptional: false,
                isRest: false,
                passing: "value",
              },
            ],
            returnType: {
              kind: "referenceType",
              name: "Generator",
              typeArguments: [
                { kind: "primitiveType", name: "number" }, // Yield
                { kind: "voidType" }, // Return
                { kind: "primitiveType", name: "number" }, // Next (bidirectional!)
              ],
            },
            body: {
              kind: "blockStatement",
              statements: [
                {
                  kind: "variableDeclaration",
                  declarationKind: "let",
                  isExported: false,
                  declarations: [
                    {
                      kind: "variableDeclarator",
                      name: { kind: "identifierPattern", name: "total" },
                      type: { kind: "primitiveType", name: "number" },
                      initializer: { kind: "identifier", name: "start" },
                    },
                  ],
                },
                {
                  kind: "whileStatement",
                  condition: { kind: "literal", value: true },
                  body: {
                    kind: "blockStatement",
                    statements: [
                      // Using yieldStatement (lowered form)
                      {
                        kind: "yieldStatement",
                        output: { kind: "identifier", name: "total" },
                        delegate: false,
                        receiveTarget: {
                          kind: "identifierPattern",
                          name: "received",
                        },
                        receivedType: { kind: "primitiveType", name: "number" },
                      },
                      {
                        kind: "expressionStatement",
                        expression: {
                          kind: "assignment",
                          operator: "=",
                          left: { kind: "identifier", name: "total" },
                          right: {
                            kind: "binary",
                            operator: "+",
                            left: { kind: "identifier", name: "total" },
                            right: { kind: "identifier", name: "received" },
                          },
                        },
                      },
                    ],
                  },
                },
              ],
            },
            isAsync: false,
            isGenerator: true,
            isExported: true,
          },
        ],
      };

      const code = emitModule(module);

      // Note: IteratorResult<T> is now in Tsonic.Runtime, not emitted per-module

      // Should generate exchange class
      expect(code).to.include("public sealed class accumulator_exchange");
      expect(code).to.include("public double? Input { get; set; }");
      expect(code).to.include("public double Output { get; set; }");

      // Should generate wrapper class
      expect(code).to.include("public sealed class accumulator_Generator");
      expect(code).to.include("IEnumerator<accumulator_exchange> _enumerator");
      expect(code).to.include("accumulator_exchange _exchange");

      // next() method with nullable parameter
      expect(code).to.include(
        "global::Tsonic.Runtime.IteratorResult<double> next(double? value"
      );
      expect(code).to.include("_exchange.Input = value");
      expect(code).to.include("MoveNext()");

      // return() and throw() methods
      expect(code).to.include(
        "global::Tsonic.Runtime.IteratorResult<double> @return("
      );
      expect(code).to.include(
        "global::Tsonic.Runtime.IteratorResult<double> @throw(object e)"
      );

      // Function should return wrapper type
      expect(code).to.include("accumulator_Generator accumulator(");

      // Should use local iterator pattern
      expect(code).to.include("__iterator()");
      expect(code).to.include(
        "return new accumulator_Generator(__iterator(), exchange)"
      );
    });

    it("should emit yieldStatement with receiveTarget", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/test/receiver.ts",
        namespace: "Test",
        className: "receiver",
        isStaticContainer: true,
        imports: [],
        exports: [],
        body: [
          {
            kind: "functionDeclaration",
            name: "receiver",
            parameters: [],
            returnType: {
              kind: "referenceType",
              name: "Generator",
              typeArguments: [
                { kind: "primitiveType", name: "number" },
                { kind: "voidType" },
                { kind: "primitiveType", name: "string" },
              ],
            },
            body: {
              kind: "blockStatement",
              statements: [
                {
                  kind: "yieldStatement",
                  output: { kind: "literal", value: 42 },
                  delegate: false,
                  receiveTarget: { kind: "identifierPattern", name: "msg" },
                  receivedType: { kind: "primitiveType", name: "string" },
                },
              ],
            },
            isAsync: false,
            isGenerator: true,
            isExported: true,
          },
        ],
      };

      const code = emitModule(module);

      // Should emit yield output - integer literal emits as-is
      expect(code).to.include("exchange.Output = 42");
      expect(code).to.include("yield return exchange");

      // Should emit receive pattern with null coalescing
      expect(code).to.include("var msg = exchange.Input ?? default!");
    });

    it("should handle unidirectional generator without wrapper", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/test/unidirectional.ts",
        namespace: "Test",
        className: "unidirectional",
        isStaticContainer: true,
        imports: [],
        exports: [],
        body: [
          {
            kind: "functionDeclaration",
            name: "range",
            parameters: [],
            returnType: {
              kind: "referenceType",
              name: "Generator",
              typeArguments: [
                { kind: "primitiveType", name: "number" },
                { kind: "voidType" },
                { kind: "primitiveType", name: "undefined" }, // No TNext!
              ],
            },
            body: {
              kind: "blockStatement",
              statements: [
                {
                  kind: "expressionStatement",
                  expression: {
                    kind: "yield",
                    expression: { kind: "literal", value: 1 },
                    delegate: false,
                  },
                },
              ],
            },
            isAsync: false,
            isGenerator: true,
            isExported: true,
          },
        ],
      };

      const code = emitModule(module);

      // Should NOT generate wrapper class for unidirectional
      expect(code).to.not.include("range_Generator");
      expect(code).to.not.include("IteratorResult<");

      // Should use IEnumerable return type
      expect(code).to.include("IEnumerable<range_exchange> range()");

      // Should generate exchange class
      expect(code).to.include("public sealed class range_exchange");
    });

    it("should handle async bidirectional generator", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/test/asyncBidir.ts",
        namespace: "Test",
        className: "asyncBidir",
        isStaticContainer: true,
        imports: [],
        exports: [],
        body: [
          {
            kind: "functionDeclaration",
            name: "asyncAccumulator",
            parameters: [],
            returnType: {
              kind: "referenceType",
              name: "AsyncGenerator",
              typeArguments: [
                { kind: "primitiveType", name: "number" },
                { kind: "voidType" },
                { kind: "primitiveType", name: "number" },
              ],
            },
            body: {
              kind: "blockStatement",
              statements: [
                {
                  kind: "yieldStatement",
                  output: { kind: "literal", value: 0 },
                  delegate: false,
                  receiveTarget: { kind: "identifierPattern", name: "val" },
                },
              ],
            },
            isAsync: true,
            isGenerator: true,
            isExported: true,
          },
        ],
      };

      const code = emitModule(module);

      // Should generate async wrapper
      expect(code).to.include("asyncAccumulator_Generator");
      expect(code).to.include("IAsyncEnumerator<asyncAccumulator_exchange>");
      expect(code).to.include(
        "async global::System.Threading.Tasks.Task<global::Tsonic.Runtime.IteratorResult<double>> next("
      );
      expect(code).to.include("await _enumerator.MoveNextAsync()");
    });

    describe("Edge Cases", () => {
      it("should handle string TNext type (non-number)", () => {
        // Generator<number, void, string> - receives strings
        const module: IrModule = {
          kind: "module",
          filePath: "/test/stringNext.ts",
          namespace: "Test",
          className: "stringNext",
          isStaticContainer: true,
          imports: [],
          exports: [],
          body: [
            {
              kind: "functionDeclaration",
              name: "stringReceiver",
              parameters: [],
              returnType: {
                kind: "referenceType",
                name: "Generator",
                typeArguments: [
                  { kind: "primitiveType", name: "number" },
                  { kind: "voidType" },
                  { kind: "primitiveType", name: "string" }, // TNext is string
                ],
              },
              body: {
                kind: "blockStatement",
                statements: [
                  {
                    kind: "yieldStatement",
                    output: { kind: "literal", value: 42 },
                    delegate: false,
                    receiveTarget: { kind: "identifierPattern", name: "msg" },
                  },
                ],
              },
              isAsync: false,
              isGenerator: true,
              isExported: true,
            },
          ],
        };

        const code = emitModule(module);

        // Should generate wrapper with string? Input
        expect(code).to.include("public string? Input { get; set; }");
        // next() method should accept string?
        expect(code).to.include("next(string? value = default)");
      });

      it("should use await foreach for async yield* delegation", () => {
        // Async generator with yield* should use await foreach
        const module: IrModule = {
          kind: "module",
          filePath: "/test/asyncYieldStar.ts",
          namespace: "Test",
          className: "asyncYieldStar",
          isStaticContainer: true,
          imports: [],
          exports: [],
          body: [
            {
              kind: "functionDeclaration",
              name: "asyncDelegate",
              parameters: [],
              returnType: {
                kind: "referenceType",
                name: "AsyncGenerator",
                typeArguments: [
                  { kind: "primitiveType", name: "number" },
                  { kind: "voidType" },
                  { kind: "primitiveType", name: "number" },
                ],
              },
              body: {
                kind: "blockStatement",
                statements: [
                  {
                    kind: "yieldStatement",
                    output: { kind: "identifier", name: "otherGen" },
                    delegate: true, // yield*
                  },
                ],
              },
              isAsync: true,
              isGenerator: true,
              isExported: true,
            },
          ],
        };

        const code = emitModule(module);

        // Should use await foreach, not just foreach
        expect(code).to.include("await foreach");
        expect(code).to.include("(var item in otherGen)");
      });
    });

    describe("Pattern receiveTargets", () => {
      it("should emit array destructuring from yield", () => {
        // const [a, b] = yield expr;
        const module: IrModule = {
          kind: "module",
          filePath: "/test/arrayPattern.ts",
          namespace: "Test",
          className: "arrayPattern",
          isStaticContainer: true,
          imports: [],
          exports: [],
          body: [
            {
              kind: "functionDeclaration",
              name: "arrayDestructure",
              parameters: [],
              returnType: {
                kind: "referenceType",
                name: "Generator",
                typeArguments: [
                  { kind: "primitiveType", name: "number" },
                  { kind: "voidType" },
                  {
                    kind: "arrayType",
                    elementType: { kind: "primitiveType", name: "number" },
                  },
                ],
              },
              body: {
                kind: "blockStatement",
                statements: [
                  {
                    kind: "yieldStatement",
                    output: { kind: "literal", value: 1 },
                    delegate: false,
                    receiveTarget: {
                      kind: "arrayPattern",
                      elements: [
                        { pattern: { kind: "identifierPattern", name: "a" } },
                        { pattern: { kind: "identifierPattern", name: "b" } },
                      ],
                    },
                  },
                ],
              },
              isAsync: false,
              isGenerator: true,
              isExported: true,
            },
          ],
        };

        const code = emitModule(module);

        // Should emit array destructuring pattern
        expect(code).to.include("var __input = exchange.Input");
        expect(code).to.include("var a = __input[0]");
        expect(code).to.include("var b = __input[1]");
      });

      it("should emit object destructuring from yield", () => {
        // const {x, y} = yield expr;
        // Note: We use a reference type (Point) for TNext since inline object types
        // are not supported by the emitter (TSN7403)
        const module: IrModule = {
          kind: "module",
          filePath: "/test/objectPattern.ts",
          namespace: "Test",
          className: "objectPattern",
          isStaticContainer: true,
          imports: [],
          exports: [],
          body: [
            {
              kind: "functionDeclaration",
              name: "objectDestructure",
              parameters: [],
              returnType: {
                kind: "referenceType",
                name: "Generator",
                typeArguments: [
                  { kind: "primitiveType", name: "number" },
                  { kind: "voidType" },
                  // Use a reference type for TNext since inline object types
                  // aren't supported. The test focuses on pattern emission,
                  // not type resolution.
                  {
                    kind: "referenceType",
                    name: "Point",
                    typeArguments: [],
                    resolvedClrType: "Point",
                  },
                ],
              },
              body: {
                kind: "blockStatement",
                statements: [
                  {
                    kind: "yieldStatement",
                    output: { kind: "literal", value: 42 },
                    delegate: false,
                    receiveTarget: {
                      kind: "objectPattern",
                      properties: [
                        {
                          kind: "property",
                          key: "x",
                          value: { kind: "identifierPattern", name: "x" },
                          shorthand: true,
                        },
                        {
                          kind: "property",
                          key: "y",
                          value: { kind: "identifierPattern", name: "y" },
                          shorthand: true,
                        },
                      ],
                    },
                  },
                ],
              },
              isAsync: false,
              isGenerator: true,
              isExported: true,
            },
          ],
        };

        const code = emitModule(module);

        // Should emit object destructuring pattern
        expect(code).to.include("var __input = exchange.Input");
        expect(code).to.include("var x = __input.x");
        expect(code).to.include("var y = __input.y");
      });
    });

    describe("Generator Return Statement", () => {
      it("should emit __returnValue assignment and yield break for generatorReturnStatement", () => {
        const module: IrModule = {
          kind: "module",
          filePath: "/test/generatorReturn.ts",
          namespace: "Test",
          className: "generatorReturn",
          isStaticContainer: true,
          imports: [],
          exports: [],
          body: [
            {
              kind: "functionDeclaration",
              name: "genWithReturn",
              parameters: [],
              returnType: {
                kind: "referenceType",
                name: "Generator",
                typeArguments: [
                  { kind: "primitiveType", name: "number" },
                  { kind: "primitiveType", name: "string" }, // TReturn is string, not void
                  { kind: "primitiveType", name: "number" },
                ],
              },
              body: {
                kind: "blockStatement",
                statements: [
                  {
                    kind: "yieldStatement",
                    output: { kind: "literal", value: 1 },
                    delegate: false,
                  },
                  {
                    kind: "generatorReturnStatement",
                    expression: { kind: "literal", value: "done" },
                  },
                ],
              },
              isAsync: false,
              isGenerator: true,
              isExported: true,
            },
          ],
        };

        const code = emitModule(module);

        // Should emit __returnValue assignment
        expect(code).to.include('__returnValue = "done"');

        // Should emit yield break to terminate iterator
        expect(code).to.include("yield break;");

        // Wrapper should declare __returnValue
        expect(code).to.include("string __returnValue = default!");

        // Wrapper should use _getReturnValue
        expect(code).to.include("_getReturnValue");
      });

      it("should emit bare yield break for generatorReturnStatement without expression", () => {
        const module: IrModule = {
          kind: "module",
          filePath: "/test/bareReturn.ts",
          namespace: "Test",
          className: "bareReturn",
          isStaticContainer: true,
          imports: [],
          exports: [],
          body: [
            {
              kind: "functionDeclaration",
              name: "genBareReturn",
              parameters: [],
              returnType: {
                kind: "referenceType",
                name: "Generator",
                typeArguments: [
                  { kind: "primitiveType", name: "number" },
                  { kind: "voidType" }, // TReturn is void
                  { kind: "primitiveType", name: "number" },
                ],
              },
              body: {
                kind: "blockStatement",
                statements: [
                  {
                    kind: "yieldStatement",
                    output: { kind: "literal", value: 1 },
                    delegate: false,
                  },
                  {
                    kind: "generatorReturnStatement",
                    expression: undefined, // bare return
                  },
                ],
              },
              isAsync: false,
              isGenerator: true,
              isExported: true,
            },
          ],
        };

        const code = emitModule(module);

        // Should emit yield break (no __returnValue assignment)
        expect(code).to.include("yield break;");

        // Should NOT have _getReturnValue for void return
        expect(code).not.to.include("_getReturnValue");
      });
    });
  });
});
