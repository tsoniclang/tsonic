import { describe, it } from "mocha";
import { expect } from "chai";
import type { IrType } from "@tsonic/frontend";
import { createContext } from "../../emitter-types/context.js";
import { decimalIntegerLiteral } from "../format/backend-ast/builders.js";
import {
  resolveDirectRuntimeCarrierType,
  resolveDirectValueSurfaceType,
} from "./direct-value-surfaces.js";

const stringType: IrType = { kind: "primitiveType", name: "string" };
const numberType: IrType = { kind: "primitiveType", name: "number" };
const uint8ArrayType: IrType = {
  kind: "referenceType",
  name: "Uint8Array",
  resolvedClrType: "js.Uint8Array",
};

describe("direct-value-surfaces", () => {
  it("returns direct local value types for emitted identifiers", () => {
    const context = {
      ...createContext({ rootNamespace: "Test" }),
      localValueTypes: new Map([["value", stringType]]),
    };

    expect(
      resolveDirectValueSurfaceType(
        { kind: "identifierExpression", identifier: "value" },
        context
      )
    ).to.equal(stringType);
  });

  it("resolves through local name remapping when the emitted identifier differs", () => {
    const context = {
      ...createContext({ rootNamespace: "Test" }),
      localNameMap: new Map([["source", "__source_1"]]),
      localValueTypes: new Map([["source", numberType]]),
    };

    expect(
      resolveDirectValueSurfaceType(
        { kind: "identifierExpression", identifier: "__source_1" },
        context
      )
    ).to.equal(numberType);
  });

  it("returns undefined for non-identifier ASTs", () => {
    const context = createContext({ rootNamespace: "Test" });

    expect(
      resolveDirectValueSurfaceType(decimalIntegerLiteral(1), context)
    ).to.equal(undefined);
  });

  it("uses narrowed rename bindings when the emitted identifier is a branch temp", () => {
    const narrowedStringType: IrType = {
      kind: "referenceType",
      name: "Uint8Array",
      resolvedClrType: "js.Uint8Array",
    };
    const context = {
      ...createContext({ rootNamespace: "Test" }),
      narrowedBindings: new Map([
        [
          "value",
          {
            kind: "rename" as const,
            name: "value__is_2",
            type: narrowedStringType,
          },
        ],
      ]),
    };

    expect(
      resolveDirectValueSurfaceType(
        { kind: "identifierExpression", identifier: "value__is_2" },
        context
      )
    ).to.equal(narrowedStringType);
  });

  it("uses narrowed expr bindings for direct emitted identifiers", () => {
    const unionCarrierType: IrType = {
      kind: "unionType",
      types: [uint8ArrayType, stringType],
      runtimeCarrierFamilyKey: "Uint8Array|string",
      preserveRuntimeLayout: true,
    };
    const context = {
      ...createContext({ rootNamespace: "Test" }),
      localValueTypes: new Map([["msg", unionCarrierType]]),
      narrowedBindings: new Map([
        [
          "msg",
          {
            kind: "expr" as const,
            exprAst: {
              kind: "identifierExpression" as const,
              identifier: "msg",
            },
            carrierExprAst: {
              kind: "identifierExpression" as const,
              identifier: "msg",
            },
            carrierType: unionCarrierType,
            type: uint8ArrayType,
            sourceType: unionCarrierType,
          },
        ],
      ]),
    };

    expect(
      resolveDirectValueSurfaceType(
        { kind: "identifierExpression", identifier: "msg" },
        context
      )
    ).to.equal(uint8ArrayType);
    expect(
      resolveDirectRuntimeCarrierType(
        { kind: "identifierExpression", identifier: "msg" },
        context
      )
    ).to.equal(unionCarrierType);
  });

  it("resolves direct runtime-union member materializations produced by AsN()", () => {
    const unionCarrierType: IrType = {
      kind: "unionType",
      types: [uint8ArrayType, stringType],
      runtimeCarrierFamilyKey: "Uint8Array|string",
    };
    const context = {
      ...createContext({ rootNamespace: "Test" }),
      localValueTypes: new Map([["msg", unionCarrierType]]),
    };

    const as1Ast = {
      kind: "parenthesizedExpression" as const,
      expression: {
        kind: "invocationExpression" as const,
        expression: {
          kind: "memberAccessExpression" as const,
          expression: {
            kind: "identifierExpression" as const,
            identifier: "msg",
          },
          memberName: "As1",
        },
        arguments: [],
      },
    };

    expect(resolveDirectValueSurfaceType(as1Ast, context)).to.equal(stringType);
    expect(resolveDirectRuntimeCarrierType(as1Ast, context)).to.equal(
      undefined
    );
  });
});
