import type { TargetId } from "./config.js";
import type { TargetPack } from "./pack.js";

export interface TargetRegistry {
  readonly packs: readonly TargetPack[];
  get(id: TargetId): TargetPack | undefined;
  require(id: TargetId): TargetPack;
}

export function createTargetRegistry(packs: readonly TargetPack[]): TargetRegistry {
  const byId = new Map<TargetId, TargetPack>();
  for (const pack of packs) {
    if (byId.has(pack.id)) {
      throw new Error(`Duplicate target pack '${pack.id}'.`);
    }
    byId.set(pack.id, pack);
  }
  return {
    packs,
    get(id: TargetId): TargetPack | undefined {
      return byId.get(id);
    },
    require(id: TargetId): TargetPack {
      const pack = byId.get(id);
      if (pack === undefined) {
        throw new Error(`Unknown target '${id}'.`);
      }
      return pack;
    },
  };
}
