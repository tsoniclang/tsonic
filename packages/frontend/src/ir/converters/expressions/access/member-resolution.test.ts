import { expect } from "chai";
import { describe, it } from "mocha";
import type { ProgramContext } from "../../../program-context.js";
import type { IrType } from "../../../types.js";
import { classifyComputedAccess } from "./member-resolution.js";

const VALUE_TYPE: IrType = { kind: "primitiveType", name: "string" };

const contextWithIndexerKey = (keyType: IrType): ProgramContext =>
  ({
    typeSystem: {
      getIndexerInfo: () => ({
        keyTypeName: "provider.runtime.PositionalKey",
        keyType,
        valueType: VALUE_TYPE,
      }),
    },
  }) as unknown as ProgramContext;

describe("member-resolution computed access", () => {
  it("classifies provider positional indexers from source primitive metadata", () => {
    const receiver: IrType = { kind: "referenceType", name: "ProviderList_1" };
    const context = contextWithIndexerKey({ kind: "primitiveType", name: "int" });

    expect(classifyComputedAccess(receiver, context)).to.equal("numericIndexer");
  });

  it("classifies provider string indexers as dictionaries from source primitive metadata", () => {
    const receiver: IrType = { kind: "referenceType", name: "ProviderMap_1" };
    const context = contextWithIndexerKey({
      kind: "primitiveType",
      name: "string",
    });

    expect(classifyComputedAccess(receiver, context)).to.equal("dictionary");
  });
});
