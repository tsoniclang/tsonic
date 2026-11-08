import type { SourceFile } from "@tsonic/tsts";
import type { SourceNavigationInput } from "../source-model/navigation-records.js";
import type { SourceProgramNavigation } from "./types.js";
/**
 * The program navigation. Its only checker input is `input` (host-input/navigation.ts, I3): every algorithm here
 * reads authored syntax and the Node-keyed host-input records; no checker Type, Signature or Symbol.
 */
export declare function createSourceProgramNavigation(input: SourceNavigationInput): SourceProgramNavigation;
export declare function sourceProjectFiles(source: Pick<SourceNavigationInput, "ast" | "sourceFiles">): readonly SourceFile[];
//# sourceMappingURL=navigation.d.ts.map