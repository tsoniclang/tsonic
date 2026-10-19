import { providerVirtualDeclarationFactKey } from "@tsonic/tsts";
import type { ExtensionFactSubject, Node, ReadonlySourceFactResolver, SourceFileQueries, Symbol, Type } from "@tsonic/tsts";
import type { SourceFileSemantics } from "@tsonic/target-api/source";
import { snapshotFixedArrayFact, tsonicFixedArrayFactKey } from "./facts.js";
import type { TsonicFixedArrayFact } from "./facts.js";
import { isTsonicFixedArrayProviderType } from "./provider.js";

export interface TsonicFixedArraySyntax {
  readonly authoredTypeNode?: Node;
  readonly elementType?: Node;
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

export function selectTsonicFixedArrayFromSource(
  sourceType: Type,
  semantics: SourceFileSemantics,
  facts: Pick<ReadonlySourceFactResolver, "getFact">,
): TsonicFixedArraySelection | undefined {
  const selected = selectResolvedFixedArray(sourceType, {
    typeSymbol: semantics.declarations.typeSymbol,
    symbolDeclarations: semantics.declarations.symbolDeclarations,
    isTypeReference: semantics.types.isTypeReference,
    typeReferenceTarget: semantics.types.typeReferenceTarget,
    typeArguments: semantics.types.typeArguments,
    numericLiteralValue: semantics.types.numericLiteralValue,
  }, facts);
  if (selected?.kind !== "selected") return selected;
  const alias = semantics.declarations.typeAliasSymbol(sourceType);
  if (alias === undefined) return selected;
  const elements = new Set<Node>();
  for (const declaration of semantics.declarations.symbolDeclarations(alias)) {
    for (const node of semantics.facts.authoredTypeNodes(declaration)) {
      const authored = facts.getFact(node, tsonicFixedArrayFactKey);
      if (authored === undefined || semantics.declarations.typeAliasSymbol(authored.sourceType) !== alias ||
          semantics.types.couldContainTypeVariables(authored.sourceType)) continue;
      if (authored.length !== selected.fact.length ||
          authored.lengthRuntimeBase !== selected.fact.lengthRuntimeBase) {
        return invalid("The selected FixedArray alias contradicts its authored array evidence.");
      }
      if (authored.elementType !== undefined) elements.add(authored.elementType);
    }
  }
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
  const selected = selectResolvedFixedArray(sourceType, {
    typeSymbol: checker.getTypeSymbol,
    symbolDeclarations: checker.getSymbolDeclarations,
    isTypeReference: typeShape.isTypeReference,
    typeReferenceTarget: typeShape.getTypeReferenceTarget,
    typeArguments: typeShape.getTypeArguments,
    numericLiteralValue: typeShape.getNumericLiteralTypeValue,
  }, facts);
  if (selected?.kind === "invalid") return selected;
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

function selectResolvedFixedArray(
  sourceType: Type,
  queries: ResolvedFixedArrayQueries,
  facts: Pick<ReadonlySourceFactResolver, "getFact">,
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
      (typeof count === "number" && !Number.isSafeInteger(count))) {
    return invalid("FixedArray<T, N> requires N to be one exact non-negative safe numeric or bigint literal type.");
  }
  const fact = snapshotFixedArrayFact({
    sourceType, elementSourceType,
    length: typeof count === "bigint" ? count : BigInt(count),
    lengthRuntimeBase: typeof count === "bigint" ? "bigint" : "number",
  });
  return Object.freeze({ kind: "selected", fact });
}

function invalid(reason: string): TsonicFixedArraySelection {
  return Object.freeze({ kind: "invalid", reason });
}
