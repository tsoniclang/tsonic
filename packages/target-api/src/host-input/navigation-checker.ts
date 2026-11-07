// host-input/navigation-checker: checker-typed shapes and helpers that used to live in source-navigation and that the
// Host's other checker readers (source-semantics, pending their own move behind host-input) still import (I3).
// Nothing here is used by source-navigation; navigation reads only SourceNavigationInput (navigation.ts).
import type {
  AstReader, CheckedSourceProgram, Node, ResolvedSourceElementAccessInfo, ResolvedSourcePropertyAccessInfo, Signature,
  SourceFile, SourceFileQueries, Symbol, Type, TypeCheckerQueries,
} from "@tsonic/tsts";

/** The checker's resolved call record (moved from source-navigation/call-info.ts). */
export type ResolvedSourceCallInfo = NonNullable<ReturnType<TypeCheckerQueries["getResolvedCallInfo"]>>;

// The per-file semantic query fragments that SourceFileSemantics composes (moved from source-navigation/query-context.ts).

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
export function sourceDeclarationSymbol(ast: AstReader, checker: TypeCheckerQueries, declaration: Node): Symbol | undefined {
  if (ast.is.IsClassExpression(declaration)) return checker.getTypeSymbol(checker.getTypeAtLocation(declaration));
  const name = ast.name(declaration);
  const named = checker.getSymbolAtLocation(name ?? declaration);
  if (named !== undefined || name !== undefined) return named;
  const sourceFile = ast.getSourceFile(declaration);
  const moduleSymbol = sourceFile === undefined ? undefined : checker.getSymbolAtLocation(sourceFile);
  if (moduleSymbol === undefined) return undefined;
  return checker.getExportsOfModule(moduleSymbol).find((exported): exported is Symbol =>
    exported !== undefined && checker.getSymbolDeclarations(exported).includes(declaration));
}

/** The declared value type of a declaration in a given checker: a class expression's own value, else its symbol's type. */
export function sourceDeclaredValueType(ast: AstReader, checker: TypeCheckerQueries,
  symbolOf: (declaration: Node) => Symbol | undefined, declaration: Node): Type | undefined {
  return ast.is.IsClassExpression(declaration) ? checker.getTypeAtLocation(declaration) : checker.getTypeOfSymbol(symbolOf(declaration));
}

/**
 * The per-consumer-file cache of the one selector (sourceDeclarationSymbol), for the per-file checker views
 * (semantics-program.ts). A declaration outside the checked program has no symbol; a consumer outside it is refused.
 */
export function createSourceDeclarationSymbolQuery(
  source: Pick<CheckedSourceProgram, "ast" | "containsSourceFile" | "getSourceFileQueries">,
): (declaration: Node, sourceFile: SourceFile) => Symbol | undefined {
  const selections = new WeakMap<SourceFile, WeakMap<Node, Symbol | null>>();
  return (declaration, sourceFile) => {
    if (!source.containsSourceFile(sourceFile)) throw new Error("A declaration-symbol query requires its actual checked consumer context.");
    let byDeclaration = selections.get(sourceFile);
    const retained = byDeclaration?.get(declaration);
    if (retained !== undefined) return retained ?? undefined;
    const declarationFile = source.ast.getSourceFile(declaration);
    const symbol = declarationFile !== undefined && source.containsSourceFile(declarationFile)
      ? sourceDeclarationSymbol(source.ast, source.getSourceFileQueries(sourceFile).checker, declaration) : undefined;
    byDeclaration ??= new WeakMap();
    byDeclaration.set(declaration, symbol ?? null);
    selections.set(sourceFile, byDeclaration);
    return symbol;
  };
}

/** The local type arguments of a checked type reference (moved from source-navigation/type-arguments.ts). */
export function getEffectiveSourceTypeArguments(
  ast: AstReader,
  queries: SourceFileQueries,
  type: Type,
): readonly Type[] | undefined {
  const bindings = queries.typeShape.getTypeReferenceArgumentInfos(type);
  if (bindings !== undefined) {
    return Object.freeze(bindings.filter(binding => binding.scope === "local").map(binding => binding.argument));
  }
  if (!queries.typeShape.isTypeReference(type)) return Object.freeze([]);
  const target = queries.typeShape.getTypeReferenceTarget(type);
  const declarations = queries.checker.getSymbolDeclarations(queries.checker.getTypeSymbol(target ?? type));
  if (declarations.some(declaration => declaration !== undefined && (
    ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration) ||
    ast.is.IsInterfaceDeclaration(declaration)))) return undefined;
  const arguments_ = queries.typeShape.getTypeArguments(type);
  return arguments_.every((argument): argument is Type => argument !== undefined) ? Object.freeze([...arguments_]) : undefined;
}
