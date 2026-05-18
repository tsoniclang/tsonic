import { expect } from "chai";
import { describe, it } from "mocha";
import { computeReceiverSubstitution } from "./call-resolution-signatures-catalog.js";
import type { TypeId } from "./internal/universe/catalog-types.js";

describe("call resolution signatures catalog", () => {
  it("falls back to direct receiver type arguments when the declaring nominal type already matches", () => {
    const dbSetId: TypeId = {
      stableId:
        "Microsoft.EntityFrameworkCore:Microsoft.EntityFrameworkCore.DbSet`1",
      providerName: "Microsoft.EntityFrameworkCore.DbSet`1",
      ownerIdentity: "Microsoft.EntityFrameworkCore",
      sourceName: "DbSet_1",
    };

    const state = {
      aliasTable: new Map<string, TypeId>(),
      nominalEnv: {
        getInstantiation: () => undefined,
      },
      typeRegistry: {
        getFQName: () => undefined,
        getFQNames: () => [],
        resolveNominal: () => undefined,
      },
      unifiedCatalog: {
        resolveTsName: (name: string) =>
          name === "DbSet_1" ? dbSetId : undefined,
        resolveProviderName: () => undefined,
        getByTypeId: () => ({ origin: "external" }),
        getTypeParameters: () => [{ name: "TEntity" }],
      },
    } as const;

    const substitution = computeReceiverSubstitution(
      state as never,
      {
        kind: "referenceType",
        name: "DbSet_1",
        typeArguments: [{ kind: "referenceType", name: "PostEntity" }],
        typeId: dbSetId,
      },
      "DbSet_1",
      "Find",
      ["TEntity"]
    );

    expect(Array.from(substitution ?? [])).to.deep.equal([
      ["TEntity", { kind: "referenceType", name: "PostEntity" }],
    ]);
  });

  it("treats tsbindgen instance wrappers as equivalent to their exported generic aliases", () => {
    const dbSetAliasId: TypeId = {
      stableId: "TestApp:DbSet_1",
      providerName: "DbSet_1",
      ownerIdentity: "TestApp",
      sourceName: "DbSet_1",
    };
    const dbSetInstanceId: TypeId = {
      stableId: "TestApp:DbSet_1$instance",
      providerName: "DbSet_1$instance",
      ownerIdentity: "TestApp",
      sourceName: "DbSet_1$instance",
    };

    const state = {
      aliasTable: new Map<string, TypeId>(),
      nominalEnv: {
        getInstantiation: () => undefined,
      },
      typeRegistry: {
        getFQName: (name: string) =>
          name === "DbSet_1" || name === "DbSet_1$instance" ? name : undefined,
        getFQNames: (name: string) =>
          name === "DbSet_1" || name === "DbSet_1$instance" ? [name] : [],
        resolveNominal: () => undefined,
      },
      unifiedCatalog: {
        resolveTsName: (name: string) => {
          if (name === "DbSet_1") return dbSetAliasId;
          if (name === "DbSet_1$instance") return dbSetInstanceId;
          return undefined;
        },
        resolveProviderName: () => undefined,
        getByTypeId: () => ({ origin: "source" }),
        getTypeParameters: (typeId: TypeId) =>
          typeId.stableId === dbSetAliasId.stableId
            ? []
            : [{ name: "TEntity" }],
      },
    } as const;

    const substitution = computeReceiverSubstitution(
      state as never,
      {
        kind: "referenceType",
        name: "DbSet_1$instance",
        typeArguments: [{ kind: "referenceType", name: "PostEntity" }],
        typeId: dbSetInstanceId,
      },
      "DbSet_1",
      "Find",
      ["TEntity"]
    );

    expect(Array.from(substitution ?? [])).to.deep.equal([
      ["TEntity", { kind: "referenceType", name: "PostEntity" }],
    ]);
  });
});
