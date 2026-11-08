import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "./types.js";
export interface SourceAnnotationHintBindings {
    readonly ast: AstReader;
    readonly navigation: Pick<SourceProgramNavigation, "referenceFor" | "call">;
    readonly annotationType?: string;
}
export declare function sourceAnnotationHint(expression: Node, bindings: SourceAnnotationHintBindings): string | undefined;
//# sourceMappingURL=annotation-hints.d.ts.map