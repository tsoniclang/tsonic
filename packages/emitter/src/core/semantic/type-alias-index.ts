import type { IrModule, IrType } from "@tsonic/frontend";
import type {
  TypeAliasIndex,
  TypeAliasIndexEntry,
} from "../../emitter-types/core.js";

export const buildTypeAliasIndex = (
  modules: readonly IrModule[]
): TypeAliasIndex => {
  const byFqn = new Map<string, TypeAliasIndexEntry>();

  for (const module of modules) {
    const ns = module.namespace;

    for (const stmt of module.body) {
      if (stmt.kind !== "typeAliasDeclaration") continue;

      const entry: TypeAliasIndexEntry = {
        fqn: `${ns}.${stmt.name}`,
        name: stmt.name,
        type: stmt.type as IrType,
        typeParameters: stmt.typeParameters?.map((p) => p.name) ?? [],
      };

      byFqn.set(entry.fqn, entry);
    }
  }

  return { byFqn };
};
