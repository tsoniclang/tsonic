import type { Node } from "@tsonic/tsts";
import type { SourceAnalysisProgram } from "../analysis-program.js";
import { type SourceCallArgumentCorrespondence } from "../../source-navigation/callable-arguments.js";
/** Argument-to-parameter rows of the navigation call witness at `call`, memoized per query (keyed by the call Node). */
export declare function createSourceCallArgumentCorrespondenceQuery(source: Pick<SourceAnalysisProgram, "ast" | "navigation">): (call: Node) => readonly SourceCallArgumentCorrespondence[] | undefined;
//# sourceMappingURL=call-arguments.d.ts.map