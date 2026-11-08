import type { AstReader, Node } from "@tsonic/tsts";
export type SourceReceiverBoundary = "callable" | "class" | "field" | "static-block" | "module";
export declare function sourceReceiverBoundary(node: Node, ast: AstReader): SourceReceiverBoundary | undefined;
export declare function sourceReceiverOwner(node: Node, ast: AstReader, purpose: "lexical-capture" | "storage", enter?: () => boolean): Node | undefined;
//# sourceMappingURL=receiver-owner.d.ts.map