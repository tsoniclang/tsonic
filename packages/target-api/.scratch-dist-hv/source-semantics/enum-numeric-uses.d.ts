import type { AstReader, SourceFile } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "../source-navigation/types.js";
import type { SourceValueFacts } from "../public/source/facts.js";
import type { SourceJsApiFacts } from "../public/source/objects.js";
import type { SourceEnumAdmissionIssue, SourceEnumConstantIndex } from "./enum-model.js";
export interface SourceEnumNumericUseContext {
    readonly ast: AstReader;
    readonly sourceFiles: readonly SourceFile[];
    readonly navigation: Pick<SourceProgramNavigation, "sourceReferenceFor" | "declarationUseSummary" | "expressionResultDisposition" | "memberAccess" | "call">;
    readonly values: Pick<SourceValueFacts, "type" | "contextual" | "slot" | "callableReturn" | "elementAccess" | "has">;
    /** The JS profile: a `String(value)` call is the one whose selected signature is the StringConstructor call row. */
    readonly profile: Pick<SourceJsApiFacts, "member">;
}
export declare function analyzeSourceEnumNumericUses(context: SourceEnumNumericUseContext, enumConstants: Pick<SourceEnumConstantIndex, "integerWidth">): readonly SourceEnumAdmissionIssue[];
//# sourceMappingURL=enum-numeric-uses.d.ts.map