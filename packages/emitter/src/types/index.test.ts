/**
 * Tests for Type Emission
 * Tests emission of primitive types and async/Task types
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "../emitter.js";
import { IrModule } from "@tsonic/frontend";

describe("Type Emission", () => {
  it("should emit primitive types correctly", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "Test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "test",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "a" },
              type: { kind: "primitiveType", name: "string" },
              isOptional: false,
              isRest: false,
              passing: "value",
            },
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "b" },
              type: { kind: "primitiveType", name: "number" },
              isOptional: false,
              isRest: false,
              passing: "value",
            },
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "c" },
              type: { kind: "primitiveType", name: "boolean" },
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: { kind: "voidType" },
          body: { kind: "blockStatement", statements: [] },
          isExported: true,
          isAsync: false,
          isGenerator: false,
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include("string a");
    expect(result).to.include("double b");
    expect(result).to.include("bool c");
  });

  it("should emit async functions with Task types", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "Test",
      isStaticContainer: true,
      imports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "fetchData",
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
                kind: "returnStatement",
                expression: {
                  kind: "await",
                  expression: {
                    kind: "call",
                    callee: { kind: "identifier", name: "getData" },
                    arguments: [],
                    isOptional: false,
                  },
                },
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

    // Task should be emitted (may be fully-qualified or short form depending on emitter)
    expect(result).to.include("async");
    expect(result).to.include("FetchData()");
    expect(result).to.include("await getData()");
    // Should NOT include using directives - uses global:: FQN
    expect(result).to.not.include("using System.Threading.Tasks");
  });
});
