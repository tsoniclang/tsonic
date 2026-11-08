import type { TargetId } from "./config.js";
import type { TargetPack } from "./target/pack.js";
export interface TargetRegistry {
    readonly packs: readonly TargetPack[];
    get(id: TargetId): TargetPack | undefined;
}
export declare function createTargetRegistry(packs: readonly TargetPack[]): TargetRegistry;
//# sourceMappingURL=registry.d.ts.map