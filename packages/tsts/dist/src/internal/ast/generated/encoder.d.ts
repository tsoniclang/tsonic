import type { GoPtr } from "../../../go/compat.js";
import type { Node, NodeList } from "../spine.js";
export declare const TargetAstNodeDataChildren = 0;
export declare const TargetAstNodeDataString = 1;
export declare const TargetAstNodeDataExtended = 2;
export interface TargetAstEncodedChild {
    readonly name: string;
    readonly present: boolean;
    readonly required: boolean;
    readonly raw: boolean;
    readonly node?: GoPtr<Node>;
    readonly nodes?: readonly GoPtr<Node>[];
    readonly list?: GoPtr<NodeList>;
}
export interface TargetAstNodeEncoding {
    readonly dataType: 0 | 1 | 2;
    readonly commonData: number;
    readonly children: readonly TargetAstEncodedChild[];
    readonly text?: string;
    readonly rawText?: string;
    readonly tokenFlags?: number;
    readonly extended: "literal" | "template" | "source-file" | "none";
}
export declare function targetAstNodeEncoding(node: Node): TargetAstNodeEncoding;
//# sourceMappingURL=encoder.d.ts.map