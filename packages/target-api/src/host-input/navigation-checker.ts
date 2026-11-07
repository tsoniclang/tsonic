// host-input/navigation-checker: checker-typed shapes and helpers that used to live in source-navigation and that the
// Host's other checker readers (source-semantics, pending their own move behind host-input) still import (I3).
// Nothing here is used by source-navigation; navigation reads only SourceNavigationInput (navigation.ts).
import type {
  AstReader, CheckedSourceProgram, Node, ResolvedSourceElementAccessInfo, ResolvedSourcePropertyAccessInfo, Signature,
  SourceFile, SourceFileQueries, Symbol, Type, TypeCheckerQueries,
} from "@tsonic/tsts";
import { referenceQueryNode } from "../source-navigation/syntax.js";
import { aliasedSymbol } from "./navigation-references.js";

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
 * The checker symbol a declaration declares, asked in a consumer file's checker (moved from
 * source-navigation/declaration-symbol.ts). For source-semantics only; navigation is keyed by declaration Node.
 * `referencesToDeclaration` is the navigation reverse index; it backs declarations whose name has no symbol.
 */
export function createSourceDeclarationSymbolQuery(
  source: Pick<CheckedSourceProgram, "ast" | "containsSourceFile" | "getSourceFileQueries">,
  referencesToDeclaration: (declaration: Node) => readonly Node[],
): (declaration: Node, sourceFile: SourceFile) => Symbol | undefined {
  const selections = new WeakMap<SourceFile, WeakMap<Node, Symbol | null>>();
  return (declaration, sourceFile) => {
    if (!source.containsSourceFile(sourceFile)) throw new Error("A declaration-symbol query requires its actual checked consumer context.");
    let byDeclaration = selections.get(sourceFile);
    const retained = byDeclaration?.get(declaration);
    if (retained !== undefined) return retained ?? undefined;
    const declarationFile = source.ast.getSourceFile(declaration);
    let symbol: Symbol | undefined;
    if (declarationFile !== undefined && source.containsSourceFile(declarationFile)) {
      const checker = source.getSourceFileQueries(sourceFile).checker;
      symbol = checker.getSymbolAtLocation(source.ast.name(declaration) ?? declaration);
      if (symbol === undefined) {
        for (const node of referencesToDeclaration(declaration)) {
          const query = referenceQueryNode(source.ast, node);
          const selected = query === undefined ? undefined : source.getSourceFileQueries(source.ast.getSourceFile(node)).checker
            .getSymbolAtLocation(query);
          const candidate = selected === undefined ? undefined
            : aliasedSymbol(source.ast, checker, selected) ?? selected;
          if (candidate === undefined || !checker.getSymbolDeclarations(candidate).includes(declaration)) continue;
          symbol = candidate;
          break;
        }
      }
    }
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
