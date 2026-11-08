import type { AstReader, Node, ReadonlySourceFactResolver } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "../types.js";
export declare function sourceIntegerIsNonnegative(input: {
    readonly ast: AstReader;
    readonly navigation: SourceProgramNavigation;
    readonly sourceFacts?: ReadonlySourceFactResolver;
}, expression: Node): boolean;
//# sourceMappingURL=guards.d.ts.map