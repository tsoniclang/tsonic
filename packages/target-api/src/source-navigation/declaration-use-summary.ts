import type { AstReader, Node } from "@tsonic/tsts";
import type {
  SourceDeclarationUse,
  SourceDeclarationUseSummary,
  SourceParameterUseSummary,
  SourceValueEscapeKind,
} from "./types.js";

const escapeOrder: readonly SourceValueEscapeKind[] = Object.freeze([
  "argument",
  "capture",
  "export",
  "return",
  "storage",
  "yield",
]);

export function sourceDeclarationUseSummary(
  ast: AstReader,
  declaration: Node,
  uses: readonly SourceDeclarationUse[],
): SourceDeclarationUseSummary {
  const captured = uses.some((use) => use.captured);
  const declarationOwner = ast.parent(declaration);
  const declaredClassMember = ast.is.IsClassDeclaration(declarationOwner);
  const exported = ast.hasModifierKind(declaration, "export") ||
    uses.some((use) => use.role === "source-linkage" &&
      sourceLinkageKind(ast, use.reference) === "export");
  const memberWrites = uses.filter((use) =>
    use.role === "write" && (use.throughMember || declaredClassMember));
  const constructorInitialized = memberWrites.some((use) =>
    sourceMemberWriteIsConstructorInitialization(ast, declaration, use.reference));
  const mutatedAfterInitialization = memberWrites.some((use) =>
    !sourceMemberWriteIsConstructorInitialization(ast, declaration, use.reference));
  const escapeKinds = new Set<SourceValueEscapeKind>();
  if (captured) {
    escapeKinds.add("capture");
  }
  if (exported) {
    escapeKinds.add("export");
  }
  for (const use of uses) {
    switch (use.role) {
      case "argument":
        escapeKinds.add("argument");
        break;
      case "return":
        escapeKinds.add("return");
        break;
      case "storage":
        escapeKinds.add("storage");
        break;
      case "yield":
        escapeKinds.add("yield");
        break;
      default:
        break;
    }
  }
  return Object.freeze({
    declaration,
    uses,
    directCallCount: uses.filter((use) => use.kind === "direct-call").length,
    firstClassUseCount: uses.filter((use) => use.kind === "first-class").length,
    bindingWritten: uses.some((use) =>
      use.role === "write" && !use.throughMember && !declaredClassMember),
    memberWritten: memberWrites.length > 0,
    constructorInitialized,
    mutatedAfterInitialization,
    receiverUsed: uses.some((use) => use.role === "receiver"),
    identityCompared: uses.some((use) => use.role === "comparison"),
    conditionallyRead: uses.some((use) => use.role === "condition"),
    aliasedOrStored: uses.some((use) => use.role === "storage"),
    captured,
    exported,
    escapeKinds: Object.freeze(escapeOrder.filter((kind) => escapeKinds.has(kind))),
    hasUnclassifiedValueUse: uses.some((use) => use.role === "value"),
  });
}

function sourceMemberWriteIsConstructorInitialization(
  ast: AstReader,
  declaration: Node,
  reference: Node,
): boolean {
  const owner = ast.parent(declaration);
  if (!ast.is.IsClassDeclaration(owner)) {
    return false;
  }
  let current: Node | undefined = reference;
  while (current !== undefined) {
    if (ast.is.IsConstructorDeclaration(current)) {
      return ast.parent(current) === owner;
    }
    if (ast.is.IsFunctionDeclaration(current) ||
      ast.is.IsFunctionExpression(current) ||
      ast.is.IsArrowFunction(current) ||
      ast.is.IsMethodDeclaration(current) ||
      ast.is.IsGetAccessorDeclaration(current) ||
      ast.is.IsSetAccessorDeclaration(current)) {
      return false;
    }
    current = ast.parent(current);
  }
  return false;
}

export function sourceParameterUseSummary(
  ast: AstReader,
  parameter: Node,
  uses: readonly SourceDeclarationUse[],
): SourceParameterUseSummary | undefined {
  if (!ast.is.IsParameterDeclaration(parameter)) {
    return undefined;
  }
  const summary = sourceDeclarationUseSummary(ast, parameter, uses);
  return Object.freeze({
    ...summary,
    kind: "parameter",
    passedAsArgument: uses.some((use) => use.role === "argument"),
    returned: uses.some((use) => use.role === "return"),
    yielded: uses.some((use) => use.role === "yield"),
  });
}

function sourceLinkageKind(
  ast: AstReader,
  reference: Node,
): "import" | "export" | undefined {
  let current: Node | undefined = reference;
  while (current !== undefined) {
    if (ast.is.IsImportDeclaration(current) || ast.is.IsImportSpecifier(current) ||
      ast.is.IsImportClause(current) || ast.is.IsNamespaceImport(current)) {
      return "import";
    }
    if (ast.is.IsExportDeclaration(current) || ast.is.IsExportSpecifier(current) ||
      ast.is.IsNamespaceExport(current)) {
      return "export";
    }
    if (ast.is.IsSourceFile(current)) {
      return undefined;
    }
    current = ast.parent(current);
  }
  return undefined;
}
