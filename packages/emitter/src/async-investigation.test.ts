/**
 * Async investigation - testing specific scenarios
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "./emitter.js";
import { IrModule } from "@tsonic/frontend";

describe("Async Investigation Tests", () => {
  it("async function with Promise<void> return type", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/async-void.ts",
      namespace: "Test",
      className: "AsyncVoid",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "processAsync",
          parameters: [],
          returnType: {
            kind: "referenceType",
            name: "Promise",
            typeArguments: [{ kind: "voidType" }],
          },
          body: {
            kind: "blockStatement",
            statements: [],
          },
          isAsync: true,
          isGenerator: false,
          isExported: true,
        },
      ],
    };

    const code = emitModule(module);
    console.log("Promise<void> output:", code);

    // Promise<void> should map to Task (not Task<void>)
    expect(code).to.include("async Task processAsync()");
  });

  it("async function with no explicit return type", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/async-implicit.ts",
      namespace: "Test",
      className: "AsyncImplicit",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "doWork",
          parameters: [],
          returnType: undefined, // No explicit return type
          body: {
            kind: "blockStatement",
            statements: [],
          },
          isAsync: true,
          isGenerator: false,
          isExported: true,
        },
      ],
    };

    const code = emitModule(module);
    console.log("No return type output:", code);

    // Should emit Task when async with no return type
    expect(code).to.include("async Task doWork()");
  });

  it("multiple await expressions in sequence", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/multi-await.ts",
      namespace: "Test",
      className: "MultiAwait",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "process",
          parameters: [],
          returnType: {
            kind: "referenceType",
            name: "Promise",
            typeArguments: [{ kind: "primitiveType", name: "string" }],
          },
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
                    name: { kind: "identifierPattern", name: "a" },
                    initializer: {
                      kind: "await",
                      expression: {
                        kind: "call",
                        callee: { kind: "identifier", name: "fetch1" },
                        arguments: [],
                        isOptional: false,
                      },
                    },
                  },
                ],
              },
              {
                kind: "variableDeclaration",
                declarationKind: "const",
                isExported: false,
                declarations: [
                  {
                    kind: "variableDeclarator",
                    name: { kind: "identifierPattern", name: "b" },
                    initializer: {
                      kind: "await",
                      expression: {
                        kind: "call",
                        callee: { kind: "identifier", name: "fetch2" },
                        arguments: [],
                        isOptional: false,
                      },
                    },
                  },
                ],
              },
              {
                kind: "returnStatement",
                expression: {
                  kind: "binary",
                  operator: "+",
                  left: { kind: "identifier", name: "a" },
                  right: { kind: "identifier", name: "b" },
                },
              },
            ],
          },
          isAsync: true,
          isGenerator: false,
          isExported: true,
        },
      ],
    };

    const code = emitModule(module);
    console.log("Multiple awaits output:", code);

    // Should have both variable declarations with await
    // Note: C# uses 'var' for type inference, not 'const'
    expect(code).to.match(/var\s+a\s*=\s*await\s+fetch1\(\)/);
    expect(code).to.match(/var\s+b\s*=\s*await\s+fetch2\(\)/);
  });

  it("async with try/catch/finally", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/async-try.ts",
      namespace: "Test",
      className: "AsyncTry",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "safeFetch",
          parameters: [],
          returnType: {
            kind: "referenceType",
            name: "Promise",
            typeArguments: [{ kind: "primitiveType", name: "string" }],
          },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "tryStatement",
                tryBlock: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "returnStatement",
                      expression: {
                        kind: "await",
                        expression: {
                          kind: "call",
                          callee: { kind: "identifier", name: "fetch" },
                          arguments: [],
                          isOptional: false,
                        },
                      },
                    },
                  ],
                },
                catchClause: {
                  kind: "catchClause",
                  parameter: { kind: "identifierPattern", name: "error" },
                  body: {
                    kind: "blockStatement",
                    statements: [
                      {
                        kind: "returnStatement",
                        expression: { kind: "literal", value: "error" },
                      },
                    ],
                  },
                },
                finallyBlock: {
                  kind: "blockStatement",
                  statements: [
                    {
                      kind: "expressionStatement",
                      expression: {
                        kind: "call",
                        callee: { kind: "identifier", name: "cleanup" },
                        arguments: [],
                        isOptional: false,
                      },
                    },
                  ],
                },
              },
            ],
          },
          isAsync: true,
          isGenerator: false,
          isExported: true,
        },
      ],
    };

    const code = emitModule(module);
    console.log("Try/catch/finally output:", code);

    expect(code).to.include("try");
    expect(code).to.include("catch");
    expect(code).to.include("finally");
    expect(code).to.include("await fetch()");
  });
});
