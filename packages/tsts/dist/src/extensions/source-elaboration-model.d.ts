import type { Node } from "../internal/ast/ast.js";
import type { ExtensionFactKey } from "./fact-key.js";
import type { SourceProgramQueries } from "./source-program.js";
import type { ExtensionFactReader, SourceFactResolver } from "./host.js";
export interface SourceElaborationRequest {
    readonly node: Node;
    readonly key: ExtensionFactKey<unknown>;
}
export interface SourceElaborationNodeReference {
    readonly session: number;
    readonly revision: number;
    readonly id: number;
}
export interface SourceElaborationContext {
    readonly source: SourceProgramQueries;
    readonly facts: ExtensionFactReader;
    readonly factResolver: SourceFactResolver;
    readonly request: <T>(node: Node, key: ExtensionFactKey<T>) => void;
}
export interface SourceElaborationResolverContext extends SourceElaborationContext {
    readonly node: Node;
    readonly require: <T>(node: Node, key: ExtensionFactKey<T>) => T;
    readonly reference: (node: Node) => SourceElaborationNodeReference;
    readonly resolve: (reference: SourceElaborationNodeReference) => Node;
}
export type SourceElaborationResolver<T> = (context: SourceElaborationResolverContext) => T;
export interface SourceElaborationLimits {
    readonly maximumRounds: number;
    readonly maximumRequests: number;
    readonly maximumReferences: number;
    readonly maximumDependencies: number;
    readonly maximumAnchorDepth: number;
    readonly maximumDataRows: number;
    readonly maximumDataCodeUnits: number;
}
export declare const defaultSourceElaborationLimits: SourceElaborationLimits;
export declare function snapshotSourceElaborationLimits(value: SourceElaborationLimits): SourceElaborationLimits;
//# sourceMappingURL=source-elaboration-model.d.ts.map