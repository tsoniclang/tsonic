import { describe, it } from "mocha";
import { expect } from "chai";
import { createContext } from "../../emitter-types/context.js";
import { printExpression } from "../../core/format/backend-ast/printer.js";
import { emitCall } from "./call-emitter.js";

describe("call-emitter", () => {
  it("packs rest arguments for namespace-imported function-value members", () => {
    const stringType = {
      kind: "primitiveType" as const,
      name: "string" as const,
    };
    const functionType = {
      kind: "functionType" as const,
      parameters: [
        {
          kind: "parameter" as const,
          pattern: { kind: "identifierPattern" as const, name: "values" },
          type: {
            kind: "arrayType" as const,
            elementType: stringType,
          },
          isRest: true,
          isOptional: false,
          passing: "value" as const,
        },
      ],
      returnType: stringType,
    };

    const context = {
      ...createContext({ rootNamespace: "Test" }),
      importBindings: new Map([
        [
          "PathModule",
          {
            kind: "namespace" as const,
            clrName: "global::nodejs.path",
            memberKinds: new Map([["join", "variable" as const]]),
          },
        ],
      ]),
    };

    const expr = {
      kind: "call" as const,
      callee: {
        kind: "memberAccess" as const,
        object: { kind: "identifier" as const, name: "PathModule" },
        property: "join",
        isComputed: false,
        isOptional: false,
        inferredType: functionType,
      },
      arguments: [
        { kind: "literal" as const, value: "alpha" },
        { kind: "literal" as const, value: "beta" },
        { kind: "literal" as const, value: "gamma.txt" },
      ],
      isOptional: false,
      inferredType: stringType,
    };

    const [ast] = emitCall(expr, context);
    expect(printExpression(ast)).to.equal(
      'global::nodejs.path.join(new string[] { "alpha", "beta", "gamma.txt" })'
    );
  });

  it("materializes authored defaults for imported function-value identifiers", () => {
    const stringType = {
      kind: "primitiveType" as const,
      name: "string" as const,
    };
    const functionType = {
      kind: "functionType" as const,
      parameters: [
        {
          kind: "parameter" as const,
          pattern: { kind: "identifierPattern" as const, name: "label" },
          type: stringType,
          initializer: { kind: "literal" as const, value: "default" },
          isRest: false,
          isOptional: false,
          passing: "value" as const,
        },
      ],
      returnType: stringType,
    };

    const context = {
      ...createContext({ rootNamespace: "Test" }),
      importBindings: new Map([
        [
          "formatLabel",
          {
            kind: "value" as const,
            clrName: "global::nodejs.labels",
            member: "formatLabel",
            valueKind: "variable" as const,
          },
        ],
      ]),
    };

    const expr = {
      kind: "call" as const,
      callee: {
        kind: "identifier" as const,
        name: "formatLabel",
        inferredType: functionType,
      },
      arguments: [],
      isOptional: false,
      inferredType: stringType,
    };

    const [ast] = emitCall(expr, context);
    expect(printExpression(ast)).to.equal(
      'global::nodejs.labels.formatLabel("default")'
    );
  });

  it("recovers semantic receiver parameter types for imported method calls", () => {
    const numberType = {
      kind: "primitiveType" as const,
      name: "number" as const,
    };
    const unknownOrUndefinedType = {
      kind: "unionType" as const,
      types: [
        { kind: "unknownType" as const },
        { kind: "primitiveType" as const, name: "undefined" as const },
      ],
    };
    const promisesType = {
      kind: "referenceType" as const,
      name: "TimersPromises" as const,
      resolvedClrType: "global::nodejs.TimersPromises",
    };

    const context = createContext({
      rootNamespace: "Test",
      surface: "@tsonic/js",
      clrBindings: new Map([
        [
          "TimersPromises",
          {
            name: "TimersPromises",
            alias: "TimersPromises",
            kind: "class" as const,
            members: [
              {
                kind: "method" as const,
                name: "setImmediate",
                alias: "setImmediate",
                binding: {
                  assembly: "nodejs",
                  type: "global::nodejs.TimersPromises",
                  member: "setImmediate",
                },
                semanticSignature: {
                  parameters: [
                    {
                      kind: "parameter" as const,
                      pattern: {
                        kind: "identifierPattern" as const,
                        name: "value",
                      },
                      type: unknownOrUndefinedType,
                      isOptional: true,
                      isRest: false,
                      passing: "value" as const,
                      initializer: undefined,
                    },
                  ],
                },
              },
            ],
          },
        ],
      ]),
    });

    const expr = {
      kind: "call" as const,
      callee: {
        kind: "memberAccess" as const,
        object: {
          kind: "identifier" as const,
          name: "promises",
          inferredType: promisesType,
        },
        property: "setImmediate",
        isComputed: false,
        isOptional: false,
      },
      arguments: [
        {
          kind: "literal" as const,
          value: 123,
          inferredType: numberType,
        },
      ],
      isOptional: false,
      inferredType: { kind: "unknownType" as const },
    };

    const [ast] = emitCall(expr, context);
    expect(printExpression(ast)).to.equal(
      "promises.setImmediate((object)(double)123)"
    );
  });
});
