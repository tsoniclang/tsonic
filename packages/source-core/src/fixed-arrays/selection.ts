import { providerVirtualDeclarationFactKey } from "@tsonic/tsts";
import type { ExtensionFactSubject, Node, ReadonlySourceFactResolver, SourceFileQueries, Symbol, Type } from "@tsonic/tsts";
import { sourceIntegerLiteralValue, type SourceFileSemantics } from "@tsonic/target-api/source";
import { snapshotFixedArrayFact, tsonicFixedArrayFactKey } from "./facts.js";
import type { TsonicFixedArrayFact } from "./facts.js";
import { isTsonicFixedArrayProviderType } from "./provider.js";

export interface TsonicFixedArraySyntax {
  readonly authoredTypeNode?: Node;
  readonly elementType?: Node;
  readonly extentType?: Node;
  readonly extent?: Pick<TsonicFixedArrayFact, "length" | "lengthRuntimeBase">;
}

export type TsonicFixedArraySelection =
  | { readonly kind: "selected"; readonly fact: TsonicFixedArrayFact }
  | { readonly kind: "invalid"; readonly reason: string };

type FixedArraySourceQueries = Pick<SourceFileQueries, "ast"> & {
  readonly checker: Pick<SourceFileQueries["checker"],
    "getTypeSymbol" | "getSymbolDeclarations" | "getSymbolAtLocation" | "getAliasedSymbol" | "getTypeFromTypeNode">;
  readonly typeShape: Pick<SourceFileQueries["typeShape"],
    "isTypeReference" | "getTypeReferenceTarget" | "getTypeArguments" | "getNumericLiteralTypeValue" | "isTypeIdenticalTo">;
};

interface ResolvedFixedArrayQueries {
  readonly typeSymbol: (type: Type) => Symbol | undefined;
  readonly symbolDeclarations: (symbol: Symbol) => readonly (Node | undefined)[];
  readonly isTypeReference: (type: Type) => boolean;
  readonly typeReferenceTarget: (type: Type) => Type | undefined;
  readonly typeArguments: (type: Type) => readonly (Type | undefined)[];
  readonly numericLiteralValue: (type: Type) => number | bigint | undefined;
}

interface FixedArrayExtent {
  readonly length: bigint;
  readonly lengthRuntimeBase: "number" | "bigint";
}

export function selectTsonicFixedArrayFromSource(
  sourceType: Type,
  semantics: SourceFileSemantics,
  facts: Pick<ReadonlySourceFactResolver, "getFact">,
): TsonicFixedArraySelection | undefined {
  const alias = semantics.declarations.typeAliasSymbol(sourceType);
  const elements = new Set<Node>();
  let extent: FixedArrayExtent | undefined;
  for (const declaration of alias === undefined ? [] : semantics.declarations.symbolDeclarations(alias)) {
    for (const node of semantics.facts.authoredTypeNodes(declaration)) {
      const authored = facts.getFact(node, tsonicFixedArrayFactKey);
      if (authored === undefined || semantics.declarations.typeAliasSymbol(authored.sourceType) !== alias ||
          semantics.types.couldContainTypeVariables(authored.sourceType)) continue;
      if (extent !== undefined && (authored.length !== extent.length ||
          authored.lengthRuntimeBase !== extent.lengthRuntimeBase)) {
        return invalid("The selected FixedArray alias contradicts its authored array evidence.");
      }
      extent = authored;
      if (authored.elementType !== undefined) elements.add(authored.elementType);
    }
  }
  const selected = selectResolvedFixedArray(sourceType, {
    typeSymbol: semantics.declarations.typeSymbol,
    symbolDeclarations: semantics.declarations.symbolDeclarations,
    isTypeReference: semantics.types.isTypeReference,
    typeReferenceTarget: semantics.types.typeReferenceTarget,
    typeArguments: semantics.types.typeArguments,
    numericLiteralValue: semantics.types.numericLiteralValue,
  }, facts, extent);
  if (selected?.kind !== "selected") return selected;
  if (elements.size > 1) return invalid("The selected FixedArray alias has ambiguous authored element evidence.");
  const elementType = elements.values().next().value;
  return elementType === undefined ? selected
    : Object.freeze({ kind: "selected", fact: snapshotFixedArrayFact({ ...selected.fact, elementType }) });
}

export function selectTsonicFixedArray(
  sourceType: Type,
  source: FixedArraySourceQueries,
  facts: Pick<ReadonlySourceFactResolver, "getFact">,
  syntax: TsonicFixedArraySyntax = {},
): TsonicFixedArraySelection | undefined {
  const { ast, checker, typeShape } = source;
  let authored = syntax.authoredTypeNode;
  while (authored !== undefined && ast.is.IsParenthesizedTypeNode(authored)) {
    authored = ast.as.AsParenthesizedTypeNode(authored)?.Type;
  }
  const reference = authored === undefined || !ast.is.IsTypeReferenceNode(authored)
    ? undefined : ast.as.AsTypeReferenceNode(authored);
  const authoredSubjects = new Set<ExtensionFactSubject>();
  if (reference?.TypeName !== undefined) {
    let symbol = checker.getSymbolAtLocation(reference.TypeName);
    if (checker.getSymbolDeclarations(symbol).some(declaration => declaration !== undefined && (
      ast.is.IsImportSpecifier(declaration) || ast.is.IsImportClause(declaration) ||
      ast.is.IsNamespaceImport(declaration) || ast.is.IsExportSpecifier(declaration)
    ))) symbol = checker.getAliasedSymbol(symbol);
    if (symbol !== undefined) {
      authoredSubjects.add(symbol);
      for (const declaration of checker.getSymbolDeclarations(symbol)) {
        if (declaration !== undefined) authoredSubjects.add(declaration);
      }
    }
  }
  const authoredCanonical = [...authoredSubjects].some(subject =>
    isTsonicFixedArrayProviderType(facts.getFact(subject, providerVirtualDeclarationFactKey)));
  let extent = syntax.extent;
  const lengthType = syntax.extentType ?? (authoredCanonical && authored !== undefined ? ast.typeArguments(authored)[1] : undefined);
  const authoredExtent = lengthType === undefined ? undefined : fixedArrayAuthoredExtent(lengthType, source);
  if (authoredExtent !== undefined) {
    if (extent !== undefined && (extent.length !== authoredExtent.length ||
        extent.lengthRuntimeBase !== authoredExtent.lengthRuntimeBase)) return invalid("FixedArray extent evidence contradicts its authored type.");
    extent = authoredExtent;
  }
  const selected = selectResolvedFixedArray(sourceType, {
    typeSymbol: checker.getTypeSymbol,
    symbolDeclarations: checker.getSymbolDeclarations,
    isTypeReference: typeShape.isTypeReference,
    typeReferenceTarget: typeShape.getTypeReferenceTarget,
    typeArguments: typeShape.getTypeArguments,
    numericLiteralValue: typeShape.getNumericLiteralTypeValue,
  }, facts, extent);
  if (selected?.kind === "invalid") return selected;
  if (selected === undefined) {
    return authoredCanonical ? invalid("FixedArray requires its exact resolved provider type.") : undefined;
  }
  if (authored !== undefined && !typeShape.isTypeIdenticalTo(checker.getTypeFromTypeNode(authored), sourceType)) {
    return invalid("The authored FixedArray annotation does not match its selected source type.");
  }
  const elementType = syntax.elementType ?? (authoredCanonical && authored !== undefined
    ? ast.typeArguments(authored)[0] : undefined);
  if (elementType === undefined) return selected;
  if (!typeShape.isTypeIdenticalTo(checker.getTypeFromTypeNode(elementType), selected.fact.elementSourceType)) {
    return invalid("The authored FixedArray element annotation does not match its selected element type.");
  }
  return Object.freeze({ kind: "selected", fact: snapshotFixedArrayFact({ ...selected.fact, elementType }) });
}

function fixedArrayAuthoredExtent(typeNode: Node, source: FixedArraySourceQueries): FixedArrayExtent | undefined {
  const { ast, checker } = source;
  const visited = new Set<Node>();
  let current: Node | undefined = typeNode;
  while (current !== undefined && !visited.has(current)) {
    visited.add(current);
    if (ast.is.IsParenthesizedTypeNode(current)) {
      current = ast.as.AsParenthesizedTypeNode(current)?.Type;
      continue;
    }
    const literal = ast.as.AsLiteralTypeNode(current)?.Literal;
    if (literal !== undefined) {
      const length = sourceIntegerLiteralValue(ast, literal);
      let operand: Node | undefined = literal;
      while (operand !== undefined && ast.is.IsPrefixUnaryExpression(operand)) operand = ast.as.AsPrefixUnaryExpression(operand)?.Operand;
      return length === undefined || operand === undefined ? undefined
        : { length, lengthRuntimeBase: ast.is.IsBigIntLiteral(operand) ? "bigint" : "number" };
    }
    const name = ast.as.AsTypeReferenceNode(current)?.TypeName;
    if (name === undefined) return undefined;
    let symbol = checker.getSymbolAtLocation(name);
    const declarations = checker.getSymbolDeclarations(symbol);
    if (declarations.some(declaration => declaration !== undefined && (ast.is.IsImportSpecifier(declaration) ||
        ast.is.IsImportClause(declaration) || ast.is.IsNamespaceImport(declaration) || ast.is.IsExportSpecifier(declaration)))) {
      symbol = checker.getAliasedSymbol(symbol);
    }
    const aliases = checker.getSymbolDeclarations(symbol).filter(declaration => declaration !== undefined && ast.is.IsTypeAliasDeclaration(declaration));
    if (aliases.length !== 1) return undefined;
    current = ast.typeNode(aliases[0]);
  }
  return undefined;
}

function selectResolvedFixedArray(
  sourceType: Type,
  queries: ResolvedFixedArrayQueries,
  facts: Pick<ReadonlySourceFactResolver, "getFact">,
  extent?: FixedArrayExtent,
): TsonicFixedArraySelection | undefined {
  const subjects = new Set<ExtensionFactSubject>([sourceType]);
  const addSymbol = (symbol: Symbol | undefined): void => {
    if (symbol === undefined) return;
    subjects.add(symbol);
    for (const declaration of queries.symbolDeclarations(symbol)) {
      if (declaration !== undefined) subjects.add(declaration);
    }
  };
  addSymbol(queries.typeSymbol(sourceType));
  if (queries.isTypeReference(sourceType)) {
    const target = queries.typeReferenceTarget(sourceType);
    if (target !== undefined) {
      subjects.add(target);
      addSymbol(queries.typeSymbol(target));
    }
  }
  const identities = [...subjects].flatMap(subject => {
    const identity = facts.getFact(subject, providerVirtualDeclarationFactKey);
    return identity === undefined ? [] : [identity];
  });
  if (!identities.some(isTsonicFixedArrayProviderType)) return undefined;
  if (identities.some(identity => !isTsonicFixedArrayProviderType(identity))) {
    return invalid("The selected FixedArray has contradictory provider declaration identities.");
  }
  if (!queries.isTypeReference(sourceType)) {
    return invalid("FixedArray requires its exact selected element and extent type arguments.");
  }
  const arguments_ = queries.typeArguments(sourceType);
  const elementSourceType = arguments_[0];
  const lengthType = arguments_[1];
  if (arguments_.length !== 2 || elementSourceType === undefined || lengthType === undefined) {
    return invalid("FixedArray requires its exact selected element and extent type arguments.");
  }
  const count = queries.numericLiteralValue(lengthType);
  if ((typeof count !== "number" && typeof count !== "bigint") || count < 0 ||
      (extent === undefined && typeof count === "number" && !Number.isSafeInteger(count)) ||
      (extent !== undefined && extent.length < 0n)) {
    return invalid("FixedArray<T, N> requires N to be one exact non-negative safe numeric or bigint literal type.");
  }
  if (extent !== undefined && (extent.lengthRuntimeBase !== typeof count ||
      typeof count === "bigint" && count !== extent.length ||
      typeof count === "number" && Number.isSafeInteger(count) && BigInt(count) !== extent.length)) {
    return invalid("The exact authored FixedArray extent disagrees with its checked literal identity.");
  }
  const fact = snapshotFixedArrayFact({
    sourceType, elementSourceType,
    length: extent === undefined ? typeof count === "bigint" ? count : BigInt(count) : extent.length,
    lengthRuntimeBase: extent === undefined ? typeof count === "bigint" ? "bigint" : "number" : extent.lengthRuntimeBase,
  });
  return Object.freeze({ kind: "selected", fact });
}

function invalid(reason: string): TsonicFixedArraySelection {
  return Object.freeze({ kind: "invalid", reason });
}
