import type { Node } from "../internal/ast/ast.js";
import { type ExtensionFactKey } from "./fact-key.js";
import { SourceElaborationAnchors, type SourceElaborationAnchor } from "./source-elaboration-anchors.js";
import { SourceElaborationBudget } from "./source-elaboration-budget.js";
import { type SourceElaborationLimits, type SourceElaborationNodeReference, type SourceElaborationRequest } from "./source-elaboration-model.js";
import type { SourceProgramQueries } from "./source-program.js";
interface StoredRequest {
    readonly anchor: SourceElaborationAnchor;
    readonly key: ExtensionFactKey<unknown>;
}
interface StoredAnswer {
    readonly request: StoredRequest;
    readonly value: unknown;
    readonly rows: number;
    readonly codeUnits: number;
}
interface ReplayData {
    readonly requests: ReadonlyMap<string, StoredRequest>;
    readonly answers: ReadonlyMap<string, StoredAnswer>;
    readonly dependencies: ReadonlyMap<string, ReadonlySet<string>>;
    readonly references: ReadonlyMap<number, SourceElaborationAnchor>;
}
export declare class SourceElaborationCoordinator {
    #private;
    constructor(limits?: SourceElaborationLimits);
    beginRound(source: SourceProgramQueries): SourceElaborationRound;
    finishRound(round: SourceElaborationRound, providerRevisionChanged: boolean): void;
    seal(round: SourceElaborationRound): void;
}
export declare class SourceElaborationRound {
    #private;
    constructor(anchors: SourceElaborationAnchors, limits: SourceElaborationLimits, data: ReplayData, session: number, revision: number, budget: SourceElaborationBudget);
    request<T>(node: Node, key: ExtensionFactKey<T>): void;
    reference(node: Node): SourceElaborationNodeReference;
    resolveReference(reference: SourceElaborationNodeReference): Node;
    require<T>(node: Node, key: ExtensionFactKey<T>): T;
    resolve(request: SourceElaborationRequest, resolver: () => unknown): void;
    ready(): readonly SourceElaborationRequest[];
    accepted(): readonly {
        readonly node: Node;
        readonly key: ExtensionFactKey<unknown>;
        readonly value: unknown;
    }[];
    needsReplay(): boolean;
    assertNotSuspended(): void;
    pendingDescriptions(): readonly string[];
    finish(): ReplayData;
    seal(): void;
}
export declare function isSourceElaborationSuspension(error: unknown, round: SourceElaborationRound): boolean;
export {};
//# sourceMappingURL=source-elaboration.d.ts.map