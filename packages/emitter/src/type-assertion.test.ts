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

    // Should emit clean C# without type assertions - C# handles implicit conversion
    expect(code).to.include("return 42");
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
              passing: "value",
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
    expect(code).to.include("Union<double, string> input");
    // Should return the value directly
    expect(code).to.include("return input");
  });

  it("preserves dictionary assertions as runtime dictionary casts", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/dictionaryAssert.ts",
      namespace: "Test",
      className: "dictionaryAssert",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "read",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "input" },
              type: { kind: "unknownType" },
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: { kind: "unknownType" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "returnStatement",
                expression: {
                  kind: "typeAssertion",
                  expression: {
                    kind: "identifier",
                    name: "input",
                    inferredType: { kind: "unknownType" },
                  },
                  targetType: {
                    kind: "dictionaryType",
                    keyType: { kind: "primitiveType", name: "string" },
                    valueType: { kind: "unknownType" },
                  },
                  inferredType: {
                    kind: "dictionaryType",
                    keyType: { kind: "primitiveType", name: "string" },
                    valueType: { kind: "unknownType" },
                  },
                },
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

    expect(code).to.match(
      /return \(global::System\.Collections\.Generic\.Dictionary<string, object\?>\)input;/
    );
  });

  it("erases never assertions instead of emitting invalid void casts", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/neverAssert.ts",
      namespace: "Test",
      className: "neverAssert",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "value",
          parameters: [],
          returnType: { kind: "unknownType" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "returnStatement",
                expression: {
                  kind: "typeAssertion",
                  expression: {
                    kind: "literal",
                    value: undefined,
                    inferredType: { kind: "primitiveType", name: "undefined" },
                  },
                  targetType: { kind: "neverType" },
                  inferredType: { kind: "neverType" },
                },
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

    expect(code).to.not.include("(void)default");
  });
});
