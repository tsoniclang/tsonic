import type {
  AstReader,
  Node,
  Symbol,
} from "@tsonic/tsts";

export function asNode(subject: unknown): Node | undefined {
  return typeof subject === "object" &&
    subject !== null &&
    typeof (subject as { readonly Kind?: unknown }).Kind === "number"
    ? subject as Node
    : undefined;
}

export function asSymbol(subject: unknown): Symbol | undefined {
  return typeof subject === "object" &&
    subject !== null &&
    typeof (subject as { readonly Name?: unknown }).Name === "string" &&
    typeof (subject as { readonly Flags?: unknown }).Flags === "number"
    ? subject as Symbol
    : undefined;
}

export function isTypeSyntaxNode(ast: AstReader, node: Node): boolean {
  return ast.is.IsKeywordTypeNode(node) ||
    ast.is.IsTypeReferenceNode(node) ||
    ast.is.IsUnionTypeNode(node) ||
    ast.is.IsIntersectionTypeNode(node) ||
    ast.is.IsConditionalTypeNode(node) ||
    ast.is.IsInferTypeNode(node) ||
    ast.is.IsArrayTypeNode(node) ||
    ast.is.IsIndexedAccessTypeNode(node) ||
    ast.is.IsLiteralTypeNode(node) ||
    ast.is.IsThisTypeNode(node) ||
    ast.is.IsMappedTypeNode(node) ||
    ast.is.IsTupleTypeNode(node) ||
    ast.is.IsOptionalTypeNode(node) ||
    ast.is.IsRestTypeNode(node) ||
    ast.is.IsParenthesizedTypeNode(node) ||
    ast.is.IsFunctionTypeNode(node) ||
    ast.is.IsConstructorTypeNode(node) ||
    ast.is.IsTemplateLiteralTypeNode(node) ||
    ast.is.IsImportTypeNode(node);
}
