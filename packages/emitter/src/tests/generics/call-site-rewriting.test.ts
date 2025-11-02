/**
 * Tests for Call-Site Rewriting
 * Covers spec/15-generics.md §5 - Call-Site Rewriting and Monomorphisation
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "../../emitter.js";
import { IrModule } from "@tsonic/frontend";

describe("Call-Site Rewriting (spec/15 §5)", () => {
  it("should emit call with explicit type arguments", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/main.ts",
      namespace: "MyApp",
      className: "main",
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
                kind: "expressionStatement",
                expression: {
                  kind: "call",
                  callee: { kind: "identifier", name: "identity" },
                  arguments: [{ kind: "literal", value: "hello" }],
                  isOptional: false,
                  typeArguments: [{ kind: "primitiveType", name: "string" }],
                  requiresSpecialization: false,
                },
              },
            ],
          },
          isExported: false,
          isAsync: false,
          isGenerator: false,
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include("identity<string>(");
  });

  it("should emit specialized call when requiresSpecialization is true", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/main.ts",
      namespace: "MyApp",
      className: "main",
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
                kind: "expressionStatement",
                expression: {
                  kind: "call",
                  callee: { kind: "identifier", name: "process" },
                  arguments: [{ kind: "literal", value: "data" }],
                  isOptional: false,
                  typeArguments: [{ kind: "primitiveType", name: "string" }],
                  requiresSpecialization: true,
                },
              },
            ],
          },
          isExported: false,
          isAsync: false,
          isGenerator: false,
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    // Should generate specialized name
    expect(result).to.include("process__string(");
    expect(result).not.to.include("process<string>(");
  });
});
