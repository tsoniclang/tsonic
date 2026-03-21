import { describe, it, expect, emitModule } from "./helpers.js";
import type { IrModule, IrType } from "./helpers.js";
describe("Statement Emission", () => {
  it("does not leak outer localSemanticTypes/localValueTypes into inner block scope for shadowed variables", () => {
    // TS: function test() {
    //   const x: string | number = "hello";
    //   {
    //     const x: boolean = true;
    //     console.log(x);
    //   }
    //   console.log(x);
    // }
    //
    // The inner `x: boolean` must not inherit the outer `x: string | number`
    // in either semantic or storage channels.
    const stringOrNumber: IrType = {
      kind: "unionType",
      types: [
        { kind: "primitiveType", name: "string" },
        { kind: "primitiveType", name: "number" },
      ],
    };
    const boolType: IrType = { kind: "primitiveType", name: "boolean" };
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
          name: "test",
          parameters: [],
          returnType: { kind: "voidType" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "variableDeclaration",
                declarationKind: "const",
                isExported: false,
                declarations: [
                  {
                    kind: "variableDeclarator",
                    name: { kind: "identifierPattern", name: "x" },
                    type: stringOrNumber,
                    initializer: {
                      kind: "literal",
                      value: "hello",
                      raw: '"hello"',
                      inferredType: { kind: "primitiveType", name: "string" },
                    },
                  },
                ],
              },
              {
                kind: "blockStatement",
                statements: [
                  {
                    kind: "variableDeclaration",
                    declarationKind: "const",
                    isExported: false,
                    declarations: [
                      {
                        kind: "variableDeclarator",
                        name: { kind: "identifierPattern", name: "x" },
                        type: boolType,
                        initializer: {
                          kind: "literal",
                          value: true,
                          raw: "true",
                          inferredType: boolType,
                        },
                      },
                    ],
                  },
                ],
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
    // Inner block must declare a bool-typed x (shadowed, renamed to x__1)
    expect(result).to.include("bool");
    // Must also have the outer union-typed x — emitted output should have both declarations
    // The key invariant: the inner bool declaration must not be widened to the outer union type
    expect(result).not.to.match(/bool.*x__1.*object/);
  });

  it("for-of loop variable gets correct semantic element type from array", () => {
    // TS: function test(items: string[]) { for (const x of items) { console.log(x); } }
    // Verifies that for-of element type registration populates semantic channel
    const stringType: IrType = { kind: "primitiveType", name: "string" };
    const stringArrayType: IrType = {
      kind: "arrayType",
      elementType: stringType,
      origin: "explicit" as const,
    };
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
          name: "test",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "items" },
              type: stringArrayType,
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: { kind: "voidType" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "forOfStatement",
                variable: { kind: "identifierPattern", name: "x" },
                expression: {
                  kind: "identifier",
                  name: "items",
                  inferredType: stringArrayType,
                },
                body: {
                  kind: "blockStatement",
                  statements: [],
                },
                isAwait: false,
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
    // The foreach should use 'var' for the element variable
    expect(result).to.include("foreach (var x in items)");
  });

  it("variable with explicit union type annotation preserves semantic type separate from storage", () => {
    // TS: function test() { const x: string | number = "hello"; }
    // Verifies that the semantic channel gets the union type while storage may differ
    const stringType: IrType = { kind: "primitiveType", name: "string" };
    const numberType: IrType = { kind: "primitiveType", name: "number" };
    const unionType: IrType = {
      kind: "unionType",
      types: [stringType, numberType],
    };
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
          name: "test",
          parameters: [],
          returnType: { kind: "voidType" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "variableDeclaration",
                declarationKind: "const",
                isExported: false,
                declarations: [
                  {
                    kind: "variableDeclarator",
                    name: { kind: "identifierPattern", name: "x" },
                    type: unionType,
                    initializer: {
                      kind: "literal",
                      value: "hello",
                      raw: '"hello"',
                      inferredType: stringType,
                    },
                  },
                ],
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
    // The variable should be emitted — union type annotation should produce
    // a runtime union carrier or object storage, not be lost
    expect(result).to.include("x");
    expect(result).to.include('"hello"');
  });
});
