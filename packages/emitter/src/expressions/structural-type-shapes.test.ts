import { describe, it } from "mocha";
import { expect } from "chai";
import type { IrType } from "@tsonic/frontend";
import { storageCarrierMap } from "../types.js";
import { createContext } from "../emitter-types/context.js";
import { identifierExpression } from "../core/format/backend-ast/builders.js";
import { printExpression } from "../core/format/backend-ast/printer.js";
import { adaptEmittedExpressionAst } from "./expected-type-adaptation.js";
import { getIterableSourceShape } from "./structural-type-shapes.js";

const numberType: IrType = { kind: "primitiveType", name: "number" };

const iterableIteratorType: IrType = {
  kind: "referenceType",
  name: "IterableIterator",
  typeArguments: [numberType],
};

const bytesType: IrType = {
  kind: "referenceType",
  name: "Bytes",
  structuralMembers: [
    {
      kind: "methodSignature",
      name: "[symbol:iterator]",
      parameters: [],
      returnType: iterableIteratorType,
    },
  ],
};

const enumerableType: IrType = {
  kind: "referenceType",
  name: "IEnumerable_1",
  resolvedClrType: "global::System.Collections.Generic.IEnumerable",
  typeArguments: [numberType],
};

describe("structural-type-shapes", () => {
  it("derives iterable source shapes from reference structuralMembers", () => {
    const context = createContext({ rootNamespace: "Test" });

    const shape = getIterableSourceShape(bytesType, context);

    expect(shape).to.deep.equal({
      accessKind: "iteratorMethod",
      elementType: numberType,
    });
  });

  it("adapts iterator-bearing identifiers to CLR IEnumerable targets via symbol iterator", () => {
    const context = {
      ...createContext({ rootNamespace: "Test" }),
      localNameMap: new Map([["bytes", "bytes"]]),
      localValueTypes: storageCarrierMap([["bytes", bytesType]]),
    };

    const [adaptedAst] = adaptEmittedExpressionAst({
      expr: {
        kind: "identifier",
        name: "bytes",
        inferredType: bytesType,
      },
      valueAst: identifierExpression("bytes"),
      context,
      expectedType: enumerableType,
    });

    expect(printExpression(adaptedAst)).to.equal(
      "bytes.__tsonic_symbol_iterator()"
    );
  });
});
