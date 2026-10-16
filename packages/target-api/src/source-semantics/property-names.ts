import type { AstReader, Node, ResolvedSourceWellKnownSymbolInfo, SourceFile } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "../source-navigation/types.js";
import type { SourceFileSemantics } from "./types.js";

export type SourcePropertyNameSelection =
  | { readonly kind: "resolved"; readonly name: string }
  | { readonly kind: "well-known-symbol"; readonly symbol: ResolvedSourceWellKnownSymbolInfo["kind"] }
  | { readonly kind: "rejected"; readonly reason: string };

export interface SourcePropertyNameIndex {
  readonly entries: readonly { readonly node: Node; readonly selection: SourcePropertyNameSelection }[];
  readonly issues: readonly { readonly node: Node; readonly reason: string }[];
  get(name: Node): SourcePropertyNameSelection | undefined;
}

const unavailable: SourcePropertyNameSelection = Object.freeze({
  kind: "rejected",
  reason: "Computed property names require an exact string or finite numeric literal, a const binding of one literal type, an enum member, or a selected well-known symbol. Dynamic or effectful keys have no static native field representation.",
});

export function analyzeSourcePropertyNames(
  ast: AstReader,
  sourceFile: SourceFile,
  semantics: Pick<SourceFileSemantics, "operations" | "types">,
  navigation: Pick<SourceProgramNavigation, "sourceReferenceFor">,
): SourcePropertyNameIndex {
  const values = new WeakMap<Node, SourcePropertyNameSelection>();
  const entries: { readonly node: Node; readonly selection: SourcePropertyNameSelection }[] = [];
  const issues: { readonly node: Node; readonly reason: string }[] = [];
  const pending: Node[] = [sourceFile];
  while (pending.length > 0) {
    const node = pending.pop()!;
    if (ast.is.IsComputedPropertyName(node)) {
      const selection = select(node);
      values.set(node, selection);
      entries.push(Object.freeze({ node, selection }));
      if (selection.kind === "rejected") issues.push(Object.freeze({ node, reason: selection.reason }));
    }
    const children: Node[] = [];
    ast.forEachChild(node, child => { if (child !== undefined) children.push(child); });
    for (let index = children.length - 1; index >= 0; index -= 1) pending.push(children[index]!);
  }
  return Object.freeze({
    entries: Object.freeze(entries),
    issues: Object.freeze(issues),
    get: (name: Node) => values.get(name),
  });

  function select(name: Node): SourcePropertyNameSelection {
    const symbol = semantics.operations.wellKnownSymbol(name);
    if (symbol !== undefined) return Object.freeze({ kind: "well-known-symbol", symbol: symbol.kind });
    const expression = unwrap(ast.as.AsComputedPropertyName(name)?.Expression);
    if (expression === undefined) return unavailable;
    if (ast.is.IsStringLiteral(expression) || ast.is.IsNoSubstitutionTemplateLiteral(expression)) {
      return Object.freeze({ kind: "resolved", name: ast.text(expression) });
    }
    if (ast.is.IsNumericLiteral(expression) || signedNumericLiteral(expression)) return selectedLiteral(expression);
    if (ast.is.IsIdentifier(expression)) {
      const declaration = navigation.sourceReferenceFor(expression)?.declaration;
      if (declaration !== undefined && ast.is.IsVariableDeclaration(declaration) &&
        ast.variableDeclarationKind(declaration) === "const") return selectedLiteral(expression);
      if (declaration !== undefined && ast.is.IsEnumMember(declaration)) return selectedEnum(expression);
      return unavailable;
    }
    const access = ast.is.IsPropertyAccessExpression(expression)
      ? semantics.operations.propertyAccess(expression)
      : ast.is.IsElementAccessExpression(expression) ? semantics.operations.elementAccess(expression) : undefined;
    if (access?.selectedDeclaration === undefined || !ast.is.IsEnumMember(access.selectedDeclaration) ||
      !pureReference(expression)) return unavailable;
    return selectedEnum(expression);
  }

  function unwrap(node: Node | undefined): Node | undefined {
    let current = node;
    while (current !== undefined && ast.is.IsParenthesizedExpression(current)) {
      current = ast.as.AsParenthesizedExpression(current)?.Expression;
    }
    return current;
  }

  function signedNumericLiteral(node: Node): boolean {
    if (!ast.is.IsPrefixUnaryExpression(node)) return false;
    const operator = ast.operatorKindName(node);
    const operand = unwrap(ast.as.AsPrefixUnaryExpression(node)?.Operand);
    return (operator === "KindPlusToken" || operator === "KindMinusToken") &&
      operand !== undefined && ast.is.IsNumericLiteral(operand);
  }

  function selectedLiteral(node: Node): SourcePropertyNameSelection {
    const type = semantics.types.expressionType(node);
    if (type === undefined) return unavailable;
    const text = semantics.types.stringLiteralValue(type);
    if (text !== undefined) return Object.freeze({ kind: "resolved", name: text });
    return selectedValue(semantics.types.numericLiteralValue(type));
  }

  function selectedEnum(node: Node): SourcePropertyNameSelection {
    return selectedValue(semantics.types.constantValue(node));
  }

  function selectedValue(value: unknown): SourcePropertyNameSelection {
    return typeof value === "string" || typeof value === "number" && Number.isFinite(value)
      ? Object.freeze({ kind: "resolved", name: String(value) }) : unavailable;
  }

  function pureReference(node: Node): boolean {
    const current = unwrap(node);
    if (current === undefined) return false;
    if (ast.is.IsIdentifier(current)) return true;
    if (ast.is.IsPropertyAccessExpression(current)) {
      const access = ast.as.AsPropertyAccessExpression(current);
      return access?.QuestionDotToken === undefined && access?.Expression !== undefined && pureReference(access.Expression);
    }
    if (ast.is.IsElementAccessExpression(current)) {
      const access = ast.as.AsElementAccessExpression(current);
      const key = unwrap(access?.ArgumentExpression);
      return access?.QuestionDotToken === undefined && access?.Expression !== undefined && pureReference(access.Expression) &&
        key !== undefined && (ast.is.IsStringLiteral(key) || ast.is.IsNumericLiteral(key));
    }
    return false;
  }
}
