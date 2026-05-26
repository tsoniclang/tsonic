import { expect } from "chai";
import { describe, it } from "mocha";
import { getIterableShape } from "./iterable-type-shapes.js";
import type { IrType } from "../types/index.js";
import type { TypeId } from "./internal/universe/catalog-types.js";

describe("iterable type shapes", () => {
  it("derives element types from inherited generic iterable interfaces", () => {
    const valueCollectionId: TypeId = {
      stableId:
        "System.Private.CoreLib:System.Collections.Generic.Dictionary`2+ValueCollection",
      sourceName: "Dictionary_2_ValueCollection",
      ownerIdentity: "System.Private.CoreLib",
      providerName: "System.Collections.Generic.Dictionary`2+ValueCollection",
    };
    const enumerableId: TypeId = {
      stableId:
        "System.Private.CoreLib:System.Collections.Generic.IEnumerable`1",
      sourceName: "IEnumerable_1",
      ownerIdentity: "System.Private.CoreLib",
      providerName: "System.Collections.Generic.IEnumerable`1",
    };
    const stringType: IrType = { kind: "primitiveType", name: "string" };
    const eventType: IrType = { kind: "referenceType", name: "QueueEvent" };

    const state = {
      typeRegistry: {
        getFQName: () => undefined,
        getFQNames: () => [],
        resolveNominal: () => undefined,
      },
      nominalEnv: {
        getInheritanceChain: (typeId: TypeId) =>
          typeId.stableId === valueCollectionId.stableId
            ? [valueCollectionId, enumerableId]
            : [typeId],
        getInstantiation: (
          _receiverTypeId: TypeId,
          _receiverTypeArgs: readonly IrType[],
          targetTypeId: TypeId
        ) =>
          targetTypeId.stableId === enumerableId.stableId
            ? new Map<string, IrType>([["T", eventType]])
            : new Map<string, IrType>([
                ["TKey", stringType],
                ["TValue", eventType],
              ]),
        findMemberDeclaringType: () => undefined,
      },
      unifiedCatalog: {
        getByTypeId: (typeId: TypeId) => {
          if (typeId.stableId === enumerableId.stableId) {
            return {
              typeId: enumerableId,
              iterableShape: {
                mode: "sync" as const,
                elementTypeParameterIndex: 0,
              },
            };
          }
          if (typeId.stableId === valueCollectionId.stableId) {
            return { typeId: valueCollectionId };
          }
          return undefined;
        },
        getTypeParameters: (typeId: TypeId) =>
          typeId.stableId === enumerableId.stableId
            ? [{ name: "T" }]
            : [{ name: "TKey" }, { name: "TValue" }],
      },
    };

    const shape = getIterableShape(state as never, {
      kind: "referenceType",
      name: "Dictionary_2_ValueCollection",
      typeId: valueCollectionId,
      typeArguments: [stringType, eventType],
    });

    expect(shape).to.deep.equal({
      mode: "sync",
      elementType: eventType,
    });
  });
});
