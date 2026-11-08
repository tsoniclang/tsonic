import type { AstReader } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "./types.js";
/**
 * The context of the navigation analyses: authored syntax and the program navigation. Checker selections reach the
 * analyses only through navigation's Node-keyed host-input witnesses (call, memberAccess, mergedDeclarations,
 * declaredParameters); no analysis reads checker types (I3).
 */
export interface SourceNavigationQueryContext {
    readonly ast: AstReader;
    readonly navigation: SourceProgramNavigation;
}
//# sourceMappingURL=query-context.d.ts.map