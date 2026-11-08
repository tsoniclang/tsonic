import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceBindingWrite, SourceCountedLoop, SourceDeclarationReference } from "./types.js";
export declare function sourceCountedLoop(ast: AstReader, statement: Node, sourceReferenceFor: (node: Node | undefined) => SourceDeclarationReference | undefined, bindingWritesWithin: (declaration: Node, root: Node) => readonly SourceBindingWrite[]): SourceCountedLoop | undefined;
//# sourceMappingURL=counted-loops.d.ts.map