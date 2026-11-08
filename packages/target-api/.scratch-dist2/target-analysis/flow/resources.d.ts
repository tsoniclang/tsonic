import type { Node } from "@tsonic/tsts";
import type { SourceFlowLimits, SourceFlowUnresolved } from "./model.js";
export declare const defaultSourceFlowLimits: SourceFlowLimits;
export declare class SourceFlowFailure extends Error {
    readonly source: Node | undefined;
    readonly resource: SourceFlowUnresolved["resource"];
    constructor(message: string, source: Node | undefined, resource?: NonNullable<SourceFlowUnresolved["resource"]>);
}
export declare function sourceFlowLimits(limits: Partial<SourceFlowLimits>): SourceFlowLimits;
export declare function createSourceFlowBudget(limits: SourceFlowLimits, subject: Node): {
    step(source?: Node): void;
    steps: () => number;
};
//# sourceMappingURL=resources.d.ts.map