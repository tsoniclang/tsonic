import type { SourceTypeFlowOperator } from "./types.js";
export declare const sourceTypeFlowBinaryOperators: ReadonlyMap<string, SourceTypeFlowOperator>;
export declare const sourceTypeFlowUnaryOperators: ReadonlyMap<string, SourceTypeFlowOperator>;
/** The source spelling of every operator token (operator records, R4: one token table). */
export declare const sourceTypeFlowOperatorSpellings: ReadonlyMap<string, string>;
/** Assignment tokens: `=` and every compound assignment. */
export declare const sourceTypeFlowAssignmentTokens: ReadonlySet<string>;
/** Shift tokens, plain and compound. */
export declare const sourceTypeFlowShiftTokens: ReadonlySet<string>;
//# sourceMappingURL=operators.d.ts.map