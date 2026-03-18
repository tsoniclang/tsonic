import { describe, it } from "mocha";
import { expect } from "chai";
import type { IrType } from "@tsonic/frontend";
import { createContext } from "../../emitter-types/context.js";
import { decimalIntegerLiteral } from "../format/backend-ast/builders.js";
import { resolveDirectValueSurfaceType } from "./direct-value-surfaces.js";

const stringType: IrType = { kind: "primitiveType", name: "string" };
const numberType: IrType = { kind: "primitiveType", name: "number" };

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
});
