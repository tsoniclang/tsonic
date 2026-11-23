import type { Node } from "../internal/ast/spine.js";
import type { SourceFile } from "../internal/ast/ast.js";
import { type Program } from "../internal/compiler/program.js";
import { type Context } from "../go/context.js";
import { type ContextFlags, type Signature } from "../internal/checker/types.js";
import { type NativeCheckerAdmission, type NativeCheckerResult } from "../internal/checker/resource-admission.js";
import { type CheckerDiagnosticMembership, type ResolvedSourceTypeInfo, type SourceTypeAnswer } from "../internal/checker/checker/source-type-answers.js";
export type SourceTypeRequest = {
    readonly kind: "expression";
    readonly node: Node | undefined;
} | {
    readonly kind: "annotation";
    readonly node: Node | undefined;
} | {
    readonly kind: "contextual";
    readonly node: Node | undefined;
    readonly flags?: ContextFlags;
} | {
    readonly kind: "signature-return";
    readonly signature: Signature | undefined;
};
interface SourceTypeOptions {
    readonly sourceFile: SourceFile | undefined;
    readonly context?: Context;
    readonly admitsCheckerDiagnostic?: CheckerDiagnosticMembership;
}
export declare function admitSourceTypeAnswer(answer: SourceTypeAnswer, admits: CheckerDiagnosticMembership | undefined): SourceTypeAnswer;
export declare function readSourceType<Stop extends object>(program: Program, options: SourceTypeOptions, request: SourceTypeRequest, admit: NativeCheckerAdmission<Stop> | null): NativeCheckerResult<ResolvedSourceTypeInfo, Stop>;
export declare function querySourceType(program: Program, options: SourceTypeOptions, request: SourceTypeRequest): ResolvedSourceTypeInfo | undefined;
export declare function resolveSourceTypeAnswer(program: Program, options: SourceTypeOptions, answer: SourceTypeAnswer | undefined): ResolvedSourceTypeInfo | undefined;
export {};
//# sourceMappingURL=source-type-answer.d.ts.map