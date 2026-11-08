import type { AstReader, CheckedSourceProgram, Node, ResolvedSourceElementAccessInfo, ResolvedSourcePropertyAccessInfo, Signature, SourceFile, SourceFileQueries, Symbol, Type, TypeCheckerQueries } from "@tsonic/tsts";
/** The checker's resolved call record (moved from source-navigation/call-info.ts). */
export type ResolvedSourceCallInfo = NonNullable<ReturnType<TypeCheckerQueries["getResolvedCallInfo"]>>;
export interface SourceNavigationTypeQueries {
    expressionType(node: Node): Type | undefined;
    numericLiteralValue(type: Type): number | bigint | undefined;
    callSignatures(type: Type): readonly Signature[];
    constructSignatures(type: Type): readonly Signature[];
    isNullish(type: Type): boolean;
    isVoidLike(type: Type): boolean;
    isNumberLike(type: Type): boolean;
    isBooleanLike(type: Type): boolean;
    isStringLike(type: Type): boolean;
    isBigIntLike(type: Type): boolean;
    isSymbolLike(type: Type): boolean;
}
export interface SourceNavigationDeclarationQueries {
    rootSymbols(symbol: Symbol): readonly Symbol[];
    symbolDeclarations(symbol: Symbol): readonly Node[];
    signatureDeclaration(signature: Signature): Node | undefined;
    declarationSignature(declaration: Node): Signature | undefined;
    primarySymbolDeclaration(symbol: Symbol): Node | undefined;
    declaredValueType(declaration: Node): Type | undefined;
    signatureParameters(signature: Signature): readonly Symbol[];
}
export interface SourceNavigationOperationQueries {
    call(node: Node): ResolvedSourceCallInfo | undefined;
    propertyAccess(node: Node): ResolvedSourcePropertyAccessInfo | undefined;
    elementAccess(node: Node): ResolvedSourceElementAccessInfo | undefined;
}
export interface SourceNavigationFileQueries {
    readonly types: SourceNavigationTypeQueries;
    readonly declarations: SourceNavigationDeclarationQueries;
    readonly operations: SourceNavigationOperationQueries;
}
/**
 * The one declaration -> checker symbol selector (R2 #3), asked in a given checker: navigation's merged declarations
 * ask the declaration's own file checker, the per-file checker views ask the consumer file's checker. A class expression
 * declares the symbol of its own class type; a named declaration declares the symbol of its name; an unnamed
 * declaration (`export default class {}`, `export default function () {}`) declares the module export whose
 * declarations include it. Declaration input only; there is no lookup through references.
 */
export declare function sourceDeclarationSymbol(ast: AstReader, checker: TypeCheckerQueries, declaration: Node): Symbol | undefined;
/** The declared value type of a declaration in a given checker: a class expression's own value, else its symbol's type. */
export declare function sourceDeclaredValueType(ast: AstReader, checker: TypeCheckerQueries, symbolOf: (declaration: Node) => Symbol | undefined, declaration: Node): Type | undefined;
/**
 * The per-consumer-file cache of the one selector (sourceDeclarationSymbol), for the per-file checker views
 * (semantics-program.ts). A declaration outside the checked program has no symbol; a consumer outside it is refused.
 */
export declare function createSourceDeclarationSymbolQuery(source: Pick<CheckedSourceProgram, "ast" | "containsSourceFile" | "getSourceFileQueries">): (declaration: Node, sourceFile: SourceFile) => Symbol | undefined;
/** The local type arguments of a checked type reference (moved from source-navigation/type-arguments.ts). */
export declare function getEffectiveSourceTypeArguments(ast: AstReader, queries: SourceFileQueries, type: Type): readonly Type[] | undefined;
//# sourceMappingURL=navigation-checker.d.ts.map