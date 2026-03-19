/**
 * Tests for union type emission
 * Verifies TypeScript unions map to C# Union<T1, T2>
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "../../emitter.js";
import { IrModule, IrType } from "@tsonic/frontend";

describe("Union Type Emission", () => {
  it("should emit nullable type as T?", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/nullable.ts",
      namespace: "Test",
      className: "nullable",
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
              name: { kind: "identifierPattern", name: "maybeString" },
              type: {
                kind: "unionType",
                types: [
                  { kind: "primitiveType", name: "string" },
                  { kind: "primitiveType", name: "null" },
                ],
              },
              initializer: { kind: "literal", value: null },
            },
          ],
        },
      ],
    };

    const code = emitModule(module);

    // Should use nullable syntax
    expect(code).to.include("string? maybeString");
  });

  it("treats void union members as runtime-nullish for nullable emission", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/voidNullable.ts",
      namespace: "Test",
      className: "voidNullable",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "maybeFlush",
          parameters: [],
          returnType: {
            kind: "unionType",
            types: [
              { kind: "voidType" },
              {
                kind: "referenceType",
                name: "Task",
                resolvedClrType: "System.Threading.Tasks.Task",
              },
            ],
          },
          body: {
            kind: "blockStatement",
            statements: [],
          },
          isAsync: false,
          isGenerator: false,
          isExported: true,
        },
      ],
    };

    const code = emitModule(module);

    expect(code).to.include(
      "public static global::System.Threading.Tasks.Task? maybeFlush()"
    );
    expect(code).not.to.include("Union<void");
  });

  it("should emit two-type union as Union<T1, T2>", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/union.ts",
      namespace: "Test",
      className: "union",
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
              type: {
                kind: "unionType",
                types: [
                  { kind: "primitiveType", name: "string" },
                  { kind: "primitiveType", name: "number" },
                ],
              },
              initializer: { kind: "literal", value: "hello" },
            },
          ],
        },
      ],
    };

    const code = emitModule(module);

    // Should use fully-qualified Union<T1, T2>
    expect(code).to.include(
      "global::Tsonic.Runtime.Union<double, string> value"
    );
    // Should NOT include using directives - uses global:: FQN
    expect(code).to.not.include("using Tsonic.Runtime");
  });

  it("should emit function returning union type", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/unionFunc.ts",
      namespace: "Test",
      className: "unionFunc",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "getValue",
          parameters: [],
          returnType: {
            kind: "unionType",
            types: [
              { kind: "primitiveType", name: "string" },
              { kind: "primitiveType", name: "number" },
            ],
          },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "returnStatement",
                expression: { kind: "literal", value: "hello" },
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

    // Should return Union<string, double> with global:: FQN
    expect(code).to.include(
      "public static global::Tsonic.Runtime.Union<double, string> getValue()"
    );
  });

  it("should emit function parameter with union type", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/test/unionParam.ts",
      namespace: "Test",
      className: "unionParam",
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
                  { kind: "primitiveType", name: "boolean" },
                ],
              },
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: { kind: "voidType" },
          body: {
            kind: "blockStatement",
            statements: [],
          },
          isAsync: false,
          isGenerator: false,
          isExported: true,
        },
      ],
    };

    const code = emitModule(module);

    // Should accept Union<string, bool> parameter with global:: FQN
    expect(code).to.include(
      "process(global::Tsonic.Runtime.Union<bool, string> input)"
    );
  });

  it("canonicalizes runtime union member order regardless of IR member order", () => {
    const emit = (types: IrType[]): string => {
      const module: IrModule = {
        kind: "module",
        filePath: "/test/orderedUnion.ts",
        namespace: "Test",
        className: "orderedUnion",
        isStaticContainer: true,
        imports: [],
        exports: [],
        body: [
          {
            kind: "interfaceDeclaration",
            name: "RegexLike",
            isExported: false,
            isStruct: false,
            typeParameters: [],
            extends: [],
            members: [],
          },
          {
            kind: "functionDeclaration",
            name: "useValue",
            parameters: [
              {
                kind: "parameter",
                pattern: { kind: "identifierPattern", name: "input" },
                type: { kind: "unionType", types },
                isOptional: false,
                isRest: false,
                passing: "value",
              },
            ],
            returnType: { kind: "voidType" },
            body: { kind: "blockStatement", statements: [] },
            isAsync: false,
            isGenerator: false,
            isExported: true,
          },
        ],
      };

      return emitModule(module);
    };

    const forward = emit([
      { kind: "primitiveType", name: "string" },
      { kind: "primitiveType", name: "boolean" },
      { kind: "referenceType", name: "RegexLike" },
    ]);
    const reversed = emit([
      { kind: "referenceType", name: "RegexLike" },
      { kind: "primitiveType", name: "boolean" },
      { kind: "primitiveType", name: "string" },
    ]);

    const extractUnion = (code: string): string | undefined =>
      code.match(/global::Tsonic\.Runtime\.Union<[^>]+>/)?.[0];

    const forwardUnion = extractUnion(forward);
    const reversedUnion = extractUnion(reversed);

    expect(forwardUnion).to.not.equal(undefined);
    expect(reversedUnion).to.equal(forwardUnion);
  });
});
