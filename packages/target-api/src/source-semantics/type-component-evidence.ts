import type {
  AstReader,
  Node,
  Type,
  TypePropertyInfo,
  TypeTupleElementInfo,
} from "@tsonic/tsts";
import type {
  SourceFileSemantics,
} from "./types.js";

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
      semantics.getSymbolDeclarations(symbol).filter(
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
  const candidates = semantics.getAuthoredTypeFactNodes(authoredRoot).filter(
    (node) => sourceTypeNodeIsExactCandidate(ast, node),
  );
  return Object.freeze(candidates.filter((node) => {
    const selection = semantics.selectAuthoredType(node, selectedType);
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
    const selection = semantics.selectAuthoredType(node, selectedType);
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
    ast.is.IsParenthesizedTypeNode(node);
}
