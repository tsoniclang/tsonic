import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceBindingWrite } from "./types.js";
export declare function sourceBindingWritesWithin(ast: AstReader, declaration: Node, root: Node, referencesToEntity: (declaration: Node) => readonly Node[]): readonly SourceBindingWrite[];
export declare function sourceEntityReferencesWithin(ast: AstReader, declaration: Node, root: Node, referencesToEntity: (declaration: Node) => readonly Node[]): readonly Node[];
export declare function sourceEntityHasReferenceOutside(ast: AstReader, declaration: Node, excludedNode: Node, referencesToEntity: (declaration: Node) => readonly Node[]): boolean;
export declare function sourceBindingWriteAtReference(ast: AstReader, reference: Node): SourceBindingWrite | undefined;
//# sourceMappingURL=references-usage.d.ts.map