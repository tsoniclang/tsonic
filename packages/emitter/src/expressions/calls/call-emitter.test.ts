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
});
