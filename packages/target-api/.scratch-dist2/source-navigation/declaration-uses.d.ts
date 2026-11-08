import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceDeclarationUse } from "./types.js";
export declare function sourceDeclarationUses(ast: AstReader, declaration: Node, references: readonly Node[]): readonly SourceDeclarationUse[];
/**
 * Whether an identifier occurrence is evaluated as a value: not part of module linkage (import / export specifiers and
 * clauses) and not part of type syntax (type references, type predicates, type queries, interfaces). The same
 * classification as the "source-linkage" and "type-only" use kinds (one owner).
 */
export declare function sourceReferenceIsValueOccurrence(ast: AstReader, reference: Node): boolean;
//# sourceMappingURL=declaration-uses.d.ts.map