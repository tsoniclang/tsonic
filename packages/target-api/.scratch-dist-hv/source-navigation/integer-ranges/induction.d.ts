import { type AstReader, type Node, type ReadonlySourceFactResolver } from "@tsonic/tsts";
import type { SourceCountedLoop, SourceProgramNavigation } from "../types.js";
interface IntegerUseEvidence {
    readonly sourceFacts: ReadonlySourceFactResolver | undefined;
}
export declare function sourceIntegerInduction(declaration: Node, ast: AstReader, navigation: SourceProgramNavigation, evidence: IntegerUseEvidence): SourceCountedLoop | undefined;
export {};
//# sourceMappingURL=induction.d.ts.map