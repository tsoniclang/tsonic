import { type AstReader, type Node, type ResolvedSourcePropertyAccessInfo, type Symbol, type Type } from "@tsonic/tsts";
import type { SourceFileSemantics } from "./semantics-types.js";
/**
 * The checker reads of property-declaration selection: symbol identity -> declarations, and the property list of a
 * type. A per-file checker view (SourceFileSemantics) and the navigation input's file queries (navigation.ts) both
 * provide it; the selection rule below is the one rule both apply (R2 #2).
 */
export interface SourcePropertySelectionQueries {
    readonly declarations: Pick<SourceFileSemantics["declarations"], "rootSymbols" | "aliasedSymbol" | "symbolDeclarations">;
    readonly types: Pick<SourceFileSemantics["types"], "propertyInfos">;
}
export declare function selectedSourcePropertyDeclarations(semantics: SourcePropertySelectionQueries, selectedDeclaration: Node | undefined, selectedSymbol: Symbol | undefined, sourceTypes?: readonly Type[]): readonly Node[] | undefined;
export declare function selectSourcePropertyDeclaration(ast: AstReader, declarations: readonly Node[], role: "read" | "write"): Node | undefined;
/**
 * The role normalization of a checker property-access selection: an accessor pair selects the get accessor for reads
 * and the set accessor for writes. Applied once, by the member-access translator (navigation.ts).
 */
export declare function normalizeSourcePropertyAccessDeclarations(ast: AstReader, semantics: SourcePropertySelectionQueries, selected: ResolvedSourcePropertyAccessInfo): ResolvedSourcePropertyAccessInfo;
//# sourceMappingURL=semantics-selected-property-declarations.d.ts.map