/**
 * Tests for type assertion handling
 * Verifies that TypeScript type assertions are stripped during IR conversion
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "./emitter.js";
import { IrModule } from "@tsonic/frontend";

describe("Type Assertion Emission", () => {
  it("should strip 'as' type assertions", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/assertion.ts",
      namespace: "Test",
      className: "assertion",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "variableDeclaration",
          declarationKind: "const",
          isExported: false,
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "value" },
              type: { kind: "primitiveType", name: "string" },
              // In the IR, type assertions are already stripped
              // So this is just the underlying expression
              initializer: { kind: "literal", value: "hello" },
            },
          ],
        },
      ],
    };

    const code = emitModule(module);

    // Should emit the value directly without any type assertion
    expect(code).to.include('string value = "hello"');
    // Note: "as" might appear in "class" or "namespace" - check for actual cast syntax
    expect(code).not.to.match(/\sas\s/);
  });

  it("should handle nested expressions with type assertions", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/nested.ts",
      namespace: "Test",
      className: "nested",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "getValue",
          parameters: [],
          returnType: { kind: "primitiveType", name: "number" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "returnStatement",
                // Type assertion is stripped, only the literal remains
                expression: { kind: "literal", value: 42 },
              },
            ],
          },
          isAsync: false,
          isGenerator: false,
          isExported: true,
        },
      ],
    };

    const code = emitModule(module);

    // Should emit clean C# without type assertions
    expect(code).to.include("return 42.0");
    // Note: "as" might appear in "class" or "namespace" - check for actual cast syntax
    expect(code).not.to.match(/\sas\s/);
  });

  it("should preserve union types when assertion is stripped", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/unionAssert.ts",
      namespace: "Test",
      className: "unionAssert",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "process",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "input" },
              type: {
                kind: "unionType",
                types: [
                  { kind: "primitiveType", name: "string" },
                  { kind: "primitiveType", name: "number" },
                ],
              },
              isOptional: false,
              isRest: false,
            },
          ],
          returnType: { kind: "primitiveType", name: "string" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "returnStatement",
                // Even if there was a type assertion in TS, it's stripped
                // Only the underlying expression remains
                expression: { kind: "identifier", name: "input" },
              },
            ],
          },
          isAsync: false,
          isGenerator: false,
          isExported: true,
        },
      ],
    };

    const code = emitModule(module);

    // Should preserve union type parameter
    expect(code).to.include("Union<string, double> input");
    // Should return the value directly
    expect(code).to.include("return input");
  });
});
