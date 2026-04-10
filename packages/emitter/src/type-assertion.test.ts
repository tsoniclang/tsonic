/**
 * Tests for type assertion handling
 * Verifies that TypeScript type assertions are stripped during IR conversion
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "./emitter.js";
import {
  IrModule,
  IrType,
  runtimeUnionCarrierFamilyKey,
} from "@tsonic/frontend";
import { createContext } from "./emitter-types/context.js";
import { emitAssignment } from "./expressions/operators/assignment-emitter.js";
import { printExpression } from "./core/format/backend-ast/printer.js";
import { emitExpressionAst } from "./expression-emitter.js";
import {
  normalizeRuntimeUnionCarrierNames,
  printRuntimeUnionCarrierType,
  printRuntimeUnionCarrierTypeForIrType,
} from "./runtime-union-cases/helpers.js";

const jsValueType: IrType = {
  kind: "referenceType",
  name: "JsValue",
  resolvedClrType: "Tsonic.Runtime.JsValue",
};

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
    const inputType: IrType = {
      kind: "unionType",
      types: [
        { kind: "primitiveType", name: "string" },
        { kind: "primitiveType", name: "number" },
      ],
    };
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
              type: inputType,
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
    expect(code).to.include(
      `${printRuntimeUnionCarrierTypeForIrType(inputType, [
        { kind: "predefinedType", keyword: "double" },
        { kind: "predefinedType", keyword: "string" },
      ])} input`
    );
    expect(code).to.include("return input.Match<string>(");
  });

  it("preserves dictionary assertions as runtime casts", () => {
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
              type: jsValueType,
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: {
            kind: "dictionaryType",
            keyType: { kind: "primitiveType", name: "string" },
            valueType: jsValueType,
          },
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
                    inferredType: jsValueType,
                  },
                  targetType: {
                    kind: "dictionaryType",
                    keyType: { kind: "primitiveType", name: "string" },
                    valueType: jsValueType,
                  },
                  inferredType: {
                    kind: "dictionaryType",
                    keyType: { kind: "primitiveType", name: "string" },
                    valueType: jsValueType,
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

    expect(code).to.include(
      "return (global::System.Collections.Generic.Dictionary<string, object?>)input;"
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
          returnType: jsValueType,
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

  it("projects duplicate runtime-union assertions to a single Match", () => {
    const memberType: IrType = { kind: "typeParameterType", name: "T" };
    const duplicatedCarrier: IrType = {
      kind: "unionType",
      preserveRuntimeLayout: true,
      types: [memberType, memberType],
    };
    const context = createContext({ rootNamespace: "Test" });

    const [ast] = emitExpressionAst(
      {
        kind: "typeAssertion",
        expression: {
          kind: "identifier",
          name: "value",
          inferredType: duplicatedCarrier,
        },
        targetType: memberType,
        inferredType: memberType,
      },
      context,
      memberType
    );

    expect(printExpression(ast)).to.match(
      /^value\.Match(?:<.*?>)?\(__tsonic_union_member_1 => __tsonic_union_member_1, __tsonic_union_member_2 => __tsonic_union_member_2\)$/
    );
  });

  it("lifts duplicate runtime-union assertions with a single factory call", () => {
    const memberType: IrType = { kind: "typeParameterType", name: "T" };
    const duplicatedCarrier: IrType = {
      kind: "unionType",
      preserveRuntimeLayout: true,
      types: [memberType, memberType],
    };
    const context = createContext({ rootNamespace: "Test" });

    const [ast] = emitExpressionAst(
      {
        kind: "typeAssertion",
        expression: {
          kind: "identifier",
          name: "value",
          inferredType: memberType,
        },
        targetType: duplicatedCarrier,
        inferredType: duplicatedCarrier,
      },
      context,
      duplicatedCarrier
    );

    expect(printExpression(ast)).to.equal(
      `${printRuntimeUnionCarrierType([
        { kind: "identifierType", name: "T" },
        { kind: "identifierType", name: "T" },
      ], runtimeUnionCarrierFamilyKey(duplicatedCarrier))}.From1(value)`
    );
  });

  it("threads narrowed typeof assertions into union assignments without re-widening the narrowed member", () => {
    const numberType: IrType = { kind: "primitiveType", name: "number" };
    const stringType: IrType = { kind: "primitiveType", name: "string" };
    const nullType: IrType = { kind: "primitiveType", name: "null" };
    const undefinedType: IrType = {
      kind: "primitiveType",
      name: "undefined",
    };
    const callbackType: IrType = {
      kind: "functionType",
      parameters: [],
      returnType: { kind: "voidType" },
    };
    const hostnameType: IrType = {
      kind: "unionType",
      types: [callbackType, nullType, numberType, stringType, undefinedType],
    };
    const backlogType: IrType = {
      kind: "unionType",
      types: [callbackType, nullType, numberType, undefinedType],
    };

    const context = {
      ...createContext({ rootNamespace: "Test" }),
      localSemanticTypes: new Map<string, IrType>([
        ["hostname", hostnameType],
        ["backlog", backlogType],
      ]),
      localValueTypes: new Map<string, IrType>([
        ["hostname", hostnameType],
        ["backlog", backlogType],
      ]),
      narrowedBindings: new Map([
        [
          "hostname",
          {
            kind: "expr" as const,
            exprAst: {
              kind: "parenthesizedExpression" as const,
              expression: {
                kind: "invocationExpression" as const,
                expression: {
                  kind: "memberAccessExpression" as const,
                  expression: {
                    kind: "identifierExpression" as const,
                    identifier: "hostname",
                  },
                  memberName: "As2",
                },
                arguments: [],
              },
            },
            storageExprAst: {
              kind: "identifierExpression" as const,
              identifier: "hostname",
            },
            type: numberType,
            sourceType: hostnameType,
          },
        ],
      ]),
    };

    const [assignmentAst] = emitAssignment(
      {
        kind: "assignment",
        operator: "=",
        left: {
          kind: "identifier",
          name: "backlog",
          inferredType: backlogType,
        },
        right: {
          kind: "typeAssertion",
          expression: {
            kind: "identifier",
            name: "hostname",
            inferredType: hostnameType,
          },
          targetType: numberType,
          inferredType: numberType,
        },
        inferredType: backlogType,
      },
      context
    );

    const emitted = normalizeRuntimeUnionCarrierNames(printExpression(assignmentAst));

    expect(emitted).to.not.include(
      "(global::Tsonic.Internal.Union<global::System.Action, double>"
    );
    expect(emitted).to.not.include(".Match");
    expect(emitted).to.include(".From2(");
    expect(emitted).to.include("hostname.As2()");
  });
});
