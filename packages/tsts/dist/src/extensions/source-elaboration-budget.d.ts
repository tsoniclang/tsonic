import type { SourceElaborationLimits } from "./source-elaboration-model.js";
export declare class SourceElaborationBudget {
    #private;
    constructor(limits: SourceElaborationLimits);
    reserve(rows: number, codeUnits: number): void;
}
//# sourceMappingURL=source-elaboration-budget.d.ts.map