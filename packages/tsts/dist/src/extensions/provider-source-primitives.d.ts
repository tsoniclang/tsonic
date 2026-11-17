import type { Node } from "../internal/ast/ast.js";
import type { SourcePrimitiveKind } from "./facts.js";
export interface ProviderRenderedSourcePrimitive {
    readonly marker: number;
    readonly exportId: string;
    readonly primitive: SourcePrimitiveKind;
}
export interface ProviderSourcePrimitiveAnnotation {
    readonly node: Node;
    readonly primitive: SourcePrimitiveKind;
}
export declare const providerSourcePrimitiveMarkerMaximumLength: number;
export declare function renderProviderSourcePrimitiveMarker(marker: number): string;
export declare function parseProviderSourcePrimitiveMarker(sourceText: string): number | undefined;
//# sourceMappingURL=provider-source-primitives.d.ts.map