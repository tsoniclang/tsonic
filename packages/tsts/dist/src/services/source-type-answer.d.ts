import { type Program } from "../internal/compiler/program.js";
import { type Context } from "../go/context.js";
import { type CheckerDiagnosticMembership, type ResolvedSourceTypeInfo, type SourceTypeAnswer } from "../internal/checker/checker/source-type-answers.js";
export declare function admitSourceTypeAnswer(answer: SourceTypeAnswer, admits: CheckerDiagnosticMembership | undefined): SourceTypeAnswer;
export declare function resolveSourceTypeAnswer(program: Program, options: {
    readonly context?: Context;
    readonly admitsCheckerDiagnostic?: CheckerDiagnosticMembership;
}, answer: SourceTypeAnswer | undefined): ResolvedSourceTypeInfo | undefined;
//# sourceMappingURL=source-type-answer.d.ts.map