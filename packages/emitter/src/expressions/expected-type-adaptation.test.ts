import { describe, it } from "mocha";
import { expect } from "chai";
import { createContext } from "../emitter-types/context.js";
import { identifierExpression } from "../core/format/backend-ast/builders.js";
import { printExpression } from "../core/format/backend-ast/printer.js";
import type { IrType } from "@tsonic/frontend";
import { adaptValueToExpectedTypeAst } from "./expected-type-adaptation.js";

describe("expected-type-adaptation", () => {
  it("uses the shared planner for runtime-union narrowing", () => {
    const requestHandlerType: IrType = {
      kind: "functionType",
      parameters: [
        {
          kind: "parameter",
          pattern: { kind: "identifierPattern", name: "req" },
          type: {
            kind: "referenceType",
            name: "Request",
            resolvedClrType: "Test.Request",
          },
          initializer: undefined,
          isOptional: false,
          isRest: false,
          passing: "value",
        },
      ],
      returnType: { kind: "unknownType" },
    };

    const routerType: IrType = {
      kind: "referenceType",
      name: "Router",
      resolvedClrType: "Test.Router",
    };

    const pathSpecType: IrType = {
      kind: "unionType",
      types: [
        {
          kind: "arrayType",
          elementType: { kind: "unknownType" },
          origin: "explicit",
        },
        { kind: "primitiveType", name: "string" },
        {
          kind: "referenceType",
          name: "RegExp",
          resolvedClrType: "global::Tsonic.JSRuntime.RegExp",
        },
      ],
    };

    const broadType: IrType = {
      kind: "unionType",
      types: [...pathSpecType.types, routerType, requestHandlerType],
    };

    const context = createContext({
      rootNamespace: "Test",
      surface: "@tsonic/js",
    });

    const result = adaptValueToExpectedTypeAst({
      valueAst: identifierExpression("first"),
      actualType: broadType,
      context,
      expectedType: pathSpecType,
    });

    expect(result).to.not.equal(undefined);
    expect(printExpression(result![0])).to.include("first.Match(");
  });
});
