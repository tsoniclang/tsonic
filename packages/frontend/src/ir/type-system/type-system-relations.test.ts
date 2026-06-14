import { expect } from "chai";
import { describe, it } from "mocha";
import type { IrInterfaceMember, IrType } from "../types/index.js";
import {
  getSourcePrimitiveAliasName,
  isAssignableTo,
} from "./type-system-relations.js";
import type { TypeSystemState } from "./type-system-state.js";
import type { TypeId } from "./internal/universe/catalog-types.js";

const stringType: IrType = { kind: "primitiveType", name: "string" };
const numberType: IrType = { kind: "primitiveType", name: "number" };

const createRecursiveNodeType = (
  additionalMembers: readonly IrInterfaceMember[] = []
): IrType => {
  const members: IrInterfaceMember[] = [];
  const node: IrType = {
    kind: "objectType",
    members,
  };

  members.push(
    {
      kind: "propertySignature",
      name: "value",
      type: stringType,
      isOptional: false,
      isReadonly: false,
    },
    {
      kind: "propertySignature",
      name: "next",
      type: node,
      isOptional: false,
      isReadonly: false,
    },
    ...additionalMembers
  );

  return node;
};

describe("type-system relations", () => {
  const state = {} as TypeSystemState;

  it("checks recursive structural assignability without overflowing", () => {
    const source = createRecursiveNodeType([
      {
        kind: "propertySignature",
        name: "metadata",
        type: numberType,
        isOptional: false,
        isReadonly: false,
      },
    ]);
    const target = createRecursiveNodeType();

    expect(() => isAssignableTo(state, source, target)).not.to.throw();
    expect(isAssignableTo(state, source, target)).to.equal(true);
  });

  it("preserves required-member failures for recursive structural types", () => {
    const source = createRecursiveNodeType();
    const target = createRecursiveNodeType([
      {
        kind: "propertySignature",
        name: "required",
        type: numberType,
        isOptional: false,
        isReadonly: false,
      },
    ]);

    expect(() => isAssignableTo(state, source, target)).not.to.throw();
    expect(isAssignableTo(state, source, target)).to.equal(false);
  });

  it("treats provider primitive references as their source primitive aliases", () => {
    const int32Id: TypeId = {
      stableId: "System.Private.CoreLib:System.Int32",
      providerName: "System.Int32",
      ownerIdentity: "System.Private.CoreLib",
      sourceName: "Int32",
    };
    const providerPrimitiveState = {
      unifiedCatalog: {
        resolveProviderName: (name: string) =>
          name === "System.Int32" ? int32Id : undefined,
        resolveTsName: () => undefined,
        getByTypeId: (typeId: TypeId) =>
          typeId.stableId === int32Id.stableId
            ? { sourcePrimitiveName: "int" }
            : undefined,
      },
    } as unknown as TypeSystemState;

    const sourceInt: IrType = { kind: "primitiveType", name: "int" };
    const providerInt32: IrType = {
      kind: "referenceType",
      name: "System.Int32",
      providerQualifiedName: "System.Int32",
    };

    expect(
      getSourcePrimitiveAliasName(providerPrimitiveState, providerInt32)
    ).to.equal("int");
    expect(
      isAssignableTo(providerPrimitiveState, sourceInt, providerInt32)
    ).to.equal(true);
  });
});
