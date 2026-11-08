import type { SourceTypeFlowLink, SourceTypeFlowVariable } from "./types.js";
export declare function sourceTypeFlowLinkAdjacency(links: readonly SourceTypeFlowLink[]): ReadonlyMap<SourceTypeFlowVariable, readonly SourceTypeFlowVariable[]>;
export declare function sourceTypeFlowReachableVariables(seeds: readonly SourceTypeFlowVariable[], adjacency: ReadonlyMap<SourceTypeFlowVariable, readonly SourceTypeFlowVariable[]>): ReadonlySet<SourceTypeFlowVariable>;
//# sourceMappingURL=links.d.ts.map