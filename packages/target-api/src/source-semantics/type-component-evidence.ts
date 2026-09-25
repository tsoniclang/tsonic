import type {
  AstReader,
  ExtensionFactSubject,
  Node,
  Type,
  TypePropertyInfo,
  TypeTupleElementInfo,
} from "@tsonic/tsts";
import type {
  SourceFileSemantics,
} from "./types.js";

interface SourceIndexedPropertyTypeEvidence {
  readonly owner: Node;
  readonly properties: readonly {
    readonly property: TypePropertyInfo;
    readonly subjects: readonly ExtensionFactSubject[];
  }[];
}

export function sourceIndexedPropertyTypeEvidence(
  ast: AstReader,
  semantics: SourceFileSemantics,
  node: Node,
): SourceIndexedPropertyTypeEvidence | undefined {
  if (!ast.is.IsIndexedAccessTypeNode(node)) return undefined;
  const syntax = ast.as.AsIndexedAccessTypeNode(node);
  if (syntax?.ObjectType === undefined || syntax.IndexType === undefined) return undefined;
  const owner = semantics.types.authoredType(syntax.ObjectType);
  const key = semantics.types.authoredType(syntax.IndexType);
  if (owner === undefined || key === undefined) return undefined;
  const selection = semantics.types.selectIndexedAccess(owner, key);
  if (selection?.kind !== "resolved" || selection.members.some(member => member.kind !== "property")) return undefined;
  const properties = selection.members.flatMap(member => member.kind !== "property" ? [] : [Object.freeze({
    property: member.property,
    subjects: Object.freeze([...new Set([member.property.symbol, ...member.property.rootSymbols].flatMap(
      symbol => semantics.facts.selectedSubjects(symbol, undefined),
    ))]),
  })]);
  return Object.freeze({ owner: syntax.ObjectType, properties: Object.freeze(properties) });
}

export function sourcePropertyTypeEvidenceNodes(
  ast: AstReader,
  semantics: SourceFileSemantics,
  property: TypePropertyInfo,
): readonly Node[] {
  return exactTypeEvidenceNodes(
    ast,
    semantics,
    property.type,
    property.rootSymbols.flatMap((symbol) =>
      semantics.declarations.symbolDeclarations(symbol).filter(
        (declaration): declaration is Node => declaration !== undefined,
      )
    ),
  );
}

export function sourceTupleElementTypeEvidenceNodes(
  ast: AstReader,
  semantics: SourceFileSemantics,
  element: TypeTupleElementInfo,
): readonly Node[] {
  return exactTypeEvidenceNodes(
    ast,
    semantics,
    element.type,
    element.declaration === undefined ? [] : [element.declaration],
  );
}

export function sourceTransformedTypeFactEvidenceNodes(
  ast: AstReader,
  semantics: SourceFileSemantics,
  authoredRoot: Node,
  selectedType: Type,
): readonly Node[] {
  const candidates = semantics.facts.authoredTypeNodes(authoredRoot).filter(
    (node) => sourceTypeNodeIsExactCandidate(ast, node),
  );
  return Object.freeze(candidates.filter((node) => {
    const selection = semantics.types.authoredSelection(node, selectedType);
    return selection.kind === "authored-members" &&
      selection.nodes.length === 1 && selection.nodes[0] === node &&
      selection.selectedNullishTypes.length === 0;
  }));
}

function exactTypeEvidenceNodes(
  ast: AstReader,
  semantics: SourceFileSemantics,
  selectedType: Type,
  declarations: readonly Node[],
): readonly Node[] {
  const candidates = declarations.flatMap((declaration) => {
    const direct = ast.typeNode(declaration);
    if (direct !== undefined) {
      return [direct];
    }
    if (!ast.is.IsSetAccessorDeclaration(declaration)) {
      return [];
    }
    const parameters = ast.parameters(declaration).filter(
      (parameter): parameter is Node => parameter !== undefined,
    );
    return parameters.length === 1
      ? [ast.typeNode(parameters[0]!)].filter(
          (node): node is Node => node !== undefined,
        )
      : [];
  });
  const unique = [...new Set(candidates)];
  return Object.freeze(unique.filter((node) => {
    const selection = semantics.types.authoredSelection(node, selectedType);
    return selection.kind === "authored-members";
  }));
}

function sourceTypeNodeIsExactCandidate(ast: AstReader, node: Node): boolean {
  return ast.is.IsTypeReferenceNode(node) ||
    ast.is.IsKeywordTypeNode(node) ||
    ast.is.IsLiteralTypeNode(node) ||
    ast.is.IsArrayTypeNode(node) ||
    ast.is.IsTupleTypeNode(node) ||
    ast.is.IsUnionTypeNode(node) ||
    ast.is.IsIntersectionTypeNode(node) ||
    ast.is.IsFunctionTypeNode(node) ||
    ast.is.IsConstructorTypeNode(node) ||
    ast.is.IsTypeQueryNode(node) ||
    ast.is.IsIndexedAccessTypeNode(node) ||
    ast.is.IsParenthesizedTypeNode(node);
}
