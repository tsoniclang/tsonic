import type { CheckedSourceProgram, Node } from "@tsonic/tsts";
import type { SourcePropertyNameFacts } from "@tsonic/target-api/host";
import { Node_Expression, sourceClassFieldIsTypeOnly } from "@tsonic/target-api/host";

export function createSourcePropertyNameInput(input: {
  readonly checked: CheckedSourceProgram;
  readonly assertNode: (node: Node) => void;
  readonly declarationFor: (node: Node) => Node | undefined;
}): SourcePropertyNameFacts {
  const { checked, assertNode, declarationFor } = input;
  const { ast } = checked;
  const queriesFor = (node: Node) => {
    assertNode(node);
    const file = ast.getSourceFile(node);
    if (file === undefined) throw new Error("A property-name fact requires its exact original source file.");
    return checked.getSourceFileQueries(file);
  };
  const unwrap = (node: Node): Node => {
    let current = node;
    const visited = new Set<Node>();
    while (!visited.has(current)) {
      visited.add(current);
      if (!ast.is.IsParenthesizedExpression(current) && !ast.is.IsAsExpression(current) &&
        !ast.is.IsTypeAssertion(current) && !ast.is.IsSatisfiesExpression(current) && !ast.is.IsNonNullExpression(current)) break;
      const expression = Node_Expression(ast, current);
      if (expression === undefined) break;
      assertNode(expression);
      current = expression;
    }
    return current;
  };
  const constBinding = (declaration: Node): boolean => {
    let current: Node | undefined = declaration;
    while (current !== undefined && ast.is.IsBindingElement(current)) {
      const pattern = ast.parent(current);
      current = pattern === undefined ? undefined : ast.parent(pattern);
    }
    return current !== undefined && ast.is.IsVariableDeclaration(current) && ast.variableDeclarationKind(current) === "const";
  };
  const pureReference = (node: Node): boolean => {
    const pending = [node];
    const visited = new Set<Node>();
    while (pending.length !== 0) {
      const current = unwrap(pending.pop()!);
      if (visited.has(current)) return false;
      visited.add(current);
      if (ast.is.IsIdentifier(current)) continue;
      const { checker } = queriesFor(current);
      const property = ast.is.IsPropertyAccessExpression(current) ? checker.getResolvedPropertyAccessInfo(current) : undefined;
      const element = ast.is.IsElementAccessExpression(current) ? checker.getResolvedElementAccessInfo(current) : undefined;
      const selected = property ?? element;
      if (selected?.selectedDeclaration === undefined || selected.optionalChain ||
        checker.getSymbolDeclarations(selected.selectedSymbol).some(declaration => declaration !== undefined &&
          (ast.is.IsGetAccessorDeclaration(declaration) || ast.is.IsSetAccessorDeclaration(declaration)))) return false;
      if (element !== undefined) {
        const key = unwrap(element.argument.expression);
        if (!ast.is.IsStringLiteral(key) && !ast.is.IsNumericLiteral(key)) return false;
      }
      pending.push(selected.receiver.expression);
    }
    return true;
  };
  return Object.freeze({
    selectedSymbol(node) {
      const { checker } = queriesFor(node);
      const known = checker.getResolvedWellKnownSymbolInfo(node);
      const selected = checker.getEffectivePropertyName(node);
      const declaration = known?.wellKnownDeclaration ?? (selected?.kind === "unique-symbol"
        ? checker.getPrimarySymbolDeclaration(checker.getTypeSymbol(selected.type)) : undefined);
      if (declaration === undefined) return Object.freeze({ kind: "none" });
      assertNode(declaration);
      return Object.freeze({ kind: "present", value: Object.freeze({ declaration,
        wellKnown: known === undefined ? Object.freeze({ kind: "none" }) : Object.freeze({ kind: "present", value: known.kind }) }) });
    },
    selectedName(node) {
      const { checker, typeShape } = queriesFor(node);
      const selected = checker.getEffectivePropertyName(node);
      if (selected === undefined || selected.kind === "unique-symbol") return Object.freeze({ kind: "none" });
      const parent = ast.parent(node);
      const element = parent === undefined ? undefined : checker.getResolvedObjectLiteralElementInfo(parent);
      const indexes = element?.contextualType === undefined ? [] : typeShape.getIndexInfos(element.contextualType);
      return Object.freeze({ kind: "present", value: Object.freeze({ name: selected.name,
        numericIndex: element !== undefined && element.sourceSelectedSymbol === undefined &&
          element.sourceSelectedDeclarations.length === 0 && indexes.length > 0 && indexes.every(index => typeShape.isNumberLike(index.keyType)) }) });
    },
    eligible(expression) {
      assertNode(expression);
      const name = ast.parent(expression);
      const member = name === undefined ? undefined : ast.parent(name);
      const typeOnly = name !== undefined && ast.is.IsComputedPropertyName(name) && member !== undefined &&
        (ast.is.IsPropertySignatureDeclaration(member) || ast.is.IsMethodSignatureDeclaration(member) || sourceClassFieldIsTypeOnly(ast, member));
      const current = unwrap(expression);
      let reason: string | undefined;
      if (typeOnly) return Object.freeze({ kind: "resolved", value: Object.freeze({ kind: "eligible" }) });
      if (ast.is.IsCallExpression(current)) reason = "A computed property key call must retain its effects and cannot be replaced with a static field name.";
      else if (ast.is.IsIdentifier(current)) {
        const declaration = declarationFor(current);
        if (declaration === undefined || !constBinding(declaration) && !ast.is.IsEnumMember(declaration))
          reason = "A computed key requires an exact const binding or an original enum constant, not a mutable or unproven reference.";
      } else if (ast.is.IsPropertyAccessExpression(current) || ast.is.IsElementAccessExpression(current)) {
        if (!pureReference(current)) reason = "A computed property key must preserve getter, optional-chain and receiver evaluation effects.";
      } else if (!ast.is.IsStringLiteral(current) && !ast.is.IsNoSubstitutionTemplateLiteral(current) &&
        !ast.is.IsNumericLiteral(current) && !ast.is.IsPrefixUnaryExpression(current) && !ast.is.IsBinaryExpression(current))
        reason = "The computed key has no non-effectful exact constant value.";
      return Object.freeze({ kind: "resolved", value: reason === undefined ? Object.freeze({ kind: "eligible" })
        : Object.freeze({ kind: "unproven", reason }) });
    },
  });
}
