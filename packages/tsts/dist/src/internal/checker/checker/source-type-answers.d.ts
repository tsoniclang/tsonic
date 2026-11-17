import type { Node } from "../../ast/spine.js";
import type { Diagnostic } from "../../ast/diagnostic.js";
import type { Checker } from "./state.js";
import type { Type } from "../types.js";
export interface ResolvedSourceTypeInfo {
    readonly type: Type;
    readonly cause: Diagnostic | undefined;
}
export interface SourceTypeAnswerOutput {
    value: ResolvedSourceTypeInfo | undefined;
}
export declare function sourceTypeAnswer(checker: Checker | undefined, node: Node | undefined, type: Type | undefined): ResolvedSourceTypeInfo | undefined;
//# sourceMappingURL=source-type-answers.d.ts.map