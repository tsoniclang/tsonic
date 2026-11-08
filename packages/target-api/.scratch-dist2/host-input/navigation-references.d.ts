import type { AstReader, Node, Symbol, TypeCheckerQueries } from "@tsonic/tsts";
import { type SourceReferenceMeaning } from "../source-model/syntax.js";
import type { SourceNavigationReference } from "../source-model/navigation-records.js";
/**
 * One selector per program. Caches by selected symbol and meaning (lifetime: the program's navigation input, I5).
 * `reserveModuleExports` is told how many module exports an import resolution examined the first time it reads a module.
 */
export declare function createSourceNavigationReferenceSelector(ast: AstReader): (checker: TypeCheckerQueries, node: Node, reserveModuleExports: (count: number) => void) => SourceNavigationReference | undefined;
export declare function referenceDeclarationForMeaning(ast: AstReader, checker: TypeCheckerQueries, symbol: Symbol | undefined, meaning: SourceReferenceMeaning): Node | undefined;
export declare function symbolAtReferenceNode(ast: AstReader, checker: TypeCheckerQueries, node: Node): Symbol | undefined;
export declare function resolvedSymbolAtReferenceNode(ast: AstReader, checker: TypeCheckerQueries, node: Node): Symbol | undefined;
export declare function aliasedSymbol(ast: AstReader, checker: TypeCheckerQueries, symbol: Symbol | undefined): Symbol | undefined;
export declare function primaryDeclaration(checker: TypeCheckerQueries, symbol: Symbol | undefined): Node | undefined;
//# sourceMappingURL=navigation-references.d.ts.map