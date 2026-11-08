import type { AstReader, Node, ReadonlySourceFactResolver } from "@tsonic/tsts";
import type { SourceDeclarationUseSummary } from "./types.js";
export declare function sourceBindingHasMutableExposure(input: {
    readonly ast: AstReader;
    readonly sourceFacts?: Pick<ReadonlySourceFactResolver, "getFact">;
}, summary: SourceDeclarationUseSummary, enter: (node: Node) => boolean): boolean;
//# sourceMappingURL=binding-mutation-exposure.d.ts.map