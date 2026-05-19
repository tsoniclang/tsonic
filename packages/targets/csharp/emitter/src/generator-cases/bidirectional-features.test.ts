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
    describe("Edge Cases", () => {
      it("should handle string TNext type (non-number)", () => {
        // Generator<number, void, string> - receives strings
        const module: IrModule = {
          kind: "module",
          filePath: "/test/stringNext.ts",
          namespace: "Test",
          className: "StringNext",
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
          className: "AsyncYieldStar",
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
          className: "ArrayPattern",
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
        expect(code).to.match(
          /var __arr\d+ = \(exchange\.Input \?\? default!\);/
        );
        expect(code).to.match(/var a = __arr\d+\[0\];/);
        expect(code).to.match(/var b = __arr\d+\[1\];/);
      });

      it("should emit object destructuring from yield", () => {
        // const {x, y} = yield expr;
        const module: IrModule = {
          kind: "module",
          filePath: "/test/objectPattern.ts",
          namespace: "Test",
          className: "ObjectPattern",
          isStaticContainer: true,
          imports: [],
          exports: [],
          body: [
            {
              kind: "classDeclaration",
              name: "Point",
              members: [
                {
                  kind: "propertyDeclaration",
                  name: "x",
                  type: { kind: "primitiveType", name: "number" },
                  accessibility: "public",
                  isStatic: false,
                  isReadonly: false,
                },
                {
                  kind: "propertyDeclaration",
                  name: "y",
                  type: { kind: "primitiveType", name: "number" },
                  accessibility: "public",
                  isStatic: false,
                  isReadonly: false,
                },
              ],
              isStruct: false,
              isExported: false,
              implements: [],
            },
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
                  {
                    kind: "referenceType",
                    name: "Point",
                    typeArguments: [],
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
        expect(code).to.match(
          /var __obj\d+ = \(exchange\.Input \?\? default!\);/
        );
        expect(code).to.match(/var x = __obj\d+\.x;/);
        expect(code).to.match(/var y = __obj\d+\.y;/);
      });
    });

    describe("Generator Return Statement", () => {
      it("should emit __returnValue assignment and yield break for generatorReturnStatement", () => {
        const module: IrModule = {
          kind: "module",
          filePath: "/test/generatorReturn.ts",
          namespace: "Test",
          className: "GeneratorReturn",
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
          className: "BareReturn",
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
