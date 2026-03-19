/**
 * Tests for generator emission
 * Per spec/13-generators.md
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "../emitter.js";
import { IrModule } from "@tsonic/frontend";

describe("Generator Emission", () => {
  describe("Bidirectional Generators", () => {
    it("should generate wrapper class for bidirectional generator", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/test/accumulator.ts",
        namespace: "Test",
        className: "Accumulator",
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
        className: "Receiver",
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
      expect(code).to.match(/string msg = \(exchange\.Input \?\? default!\);/);
    });

    it("should handle unidirectional generator without wrapper", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/test/unidirectional.ts",
        namespace: "Test",
        className: "Unidirectional",
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
      expect(code).to.not.include("Range_Generator");
      expect(code).to.not.include("IteratorResult<");

      // Should use IEnumerable return type
      expect(code).to.include(
        "global::System.Collections.Generic.IEnumerable<range_exchange> range()"
      );

      // Should generate exchange class
      expect(code).to.include("public sealed class range_exchange");
    });

    it("should handle async bidirectional generator", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/test/asyncBidir.ts",
        namespace: "Test",
        className: "AsyncBidir",
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

  });
});
