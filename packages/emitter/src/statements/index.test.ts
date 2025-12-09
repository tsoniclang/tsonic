/**
 * Tests for Statement Emission
 * Tests emission of control flow statements (if, for-of)
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "../emitter.js";
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
              passing: "value",
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

    // Binary comparison emits with truthiness check
    expect(result).to.include("if (x > 0");
    expect(result).to.include('return "positive"');
    expect(result).to.include("else");
    expect(result).to.include('return "negative or zero"');
  });

  it("should emit canonical for loops with int counter and no cast", () => {
    // Test: for (let i = 0; i < list.Count; i++) { list[i] }
    // Should emit: for (int i = 0; ...) { list[i] } - NO (int) cast
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
          name: "process",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "items" },
              type: {
                kind: "referenceType",
                name: "List",
                resolvedClrType: "global::System.Collections.Generic.List",
                typeArguments: [{ kind: "primitiveType", name: "number" }],
              },
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
                kind: "forStatement",
                initializer: {
                  kind: "variableDeclaration",
                  declarationKind: "let",
                  declarations: [
                    {
                      kind: "variableDeclarator",
                      name: { kind: "identifierPattern", name: "i" },
                      initializer: { kind: "literal", value: 0 },
                    },
                  ],
                  isExported: false,
                },
                condition: {
                  kind: "binary",
                  operator: "<",
                  left: { kind: "identifier", name: "i" },
                  right: {
                    kind: "memberAccess",
                    object: { kind: "identifier", name: "items" },
                    property: "Count",
                    isComputed: false,
                    isOptional: false,
                  },
                },
                update: {
                  kind: "update",
                  operator: "++",
                  prefix: false,
                  expression: { kind: "identifier", name: "i" },
                },
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
                        arguments: [
                          {
                            kind: "memberAccess",
                            object: { kind: "identifier", name: "items" },
                            property: {
                              kind: "identifier",
                              name: "i",
                              // Proof marker: loop counter is Int32
                              inferredType: {
                                kind: "primitiveType",
                                name: "number",
                                numericIntent: "Int32",
                              },
                            },
                            isComputed: true,
                            isOptional: false,
                          },
                        ],
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

    // Canonical loop: int i = 0 (not var i = 0.0)
    expect(result).to.include("for (int i = 0;");
    // CLR indexer without cast: items[i] (not items[(int)(i)])
    expect(result).to.include("items[i]");
    // Must NOT contain the redundant cast
    expect(result).to.not.include("[(int)");
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

    expect(result).to.include("foreach (var item in items)");
    // Uses fully-qualified name with global:: prefix
    expect(result).to.include("global::Tsonic.JSRuntime.console.log(item)");
    // Should NOT include using directives - uses global:: FQN
    expect(result).to.not.include("using Tsonic.JSRuntime");
  });

  it("should emit 'await foreach' when isAwait=true", () => {
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
          name: "processAsync",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "items" },
              type: {
                kind: "referenceType",
                name: "IAsyncEnumerable",
                typeArguments: [{ kind: "primitiveType", name: "string" }],
              },
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: {
            kind: "referenceType",
            name: "Task",
            typeArguments: [],
          },
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
                isAwait: true,
              },
            ],
          },
          isExported: true,
          isAsync: true,
          isGenerator: false,
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    // Should emit 'await foreach' for async iteration
    expect(result).to.include("await foreach (var item in items)");
    // Should NOT include regular 'foreach' (without await)
    expect(result).to.not.match(/[^t]\sforeach\s/);
  });

  it("should emit regular 'foreach' when isAwait=false", () => {
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
          name: "processSync",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "items" },
              type: {
                kind: "referenceType",
                name: "IEnumerable",
                typeArguments: [{ kind: "primitiveType", name: "string" }],
              },
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

    // Should emit regular 'foreach' for sync iteration
    expect(result).to.include("foreach (var item in items)");
    // Should NOT include 'await foreach'
    expect(result).to.not.include("await foreach");
  });
});
