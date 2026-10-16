import type { CheckedSourceProgram, Node, Symbol, Type } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "../source-navigation/types.js";
import type { SourceEnumAdmissionIssue, SourceEnumConstantIndex } from "./enum-constants.js";

const equalityOperators = new Set(["KindEqualsEqualsToken", "KindExclamationEqualsToken",
  "KindEqualsEqualsEqualsToken", "KindExclamationEqualsEqualsToken"]);
const bitwiseOperators = new Set(["KindAmpersandToken", "KindBarToken", "KindCaretToken",
  "KindAmpersandEqualsToken", "KindBarEqualsToken", "KindCaretEqualsToken"]);
const numericOperators = new Set(["KindLessThanToken", "KindLessThanEqualsToken", "KindGreaterThanToken",
  "KindGreaterThanEqualsToken", "KindPlusToken", "KindMinusToken", "KindAsteriskToken", "KindSlashToken",
  "KindPercentToken", "KindAsteriskAsteriskToken", "KindPlusEqualsToken", "KindMinusEqualsToken",
  "KindAsteriskEqualsToken", "KindSlashEqualsToken", "KindPercentEqualsToken", "KindAsteriskAsteriskEqualsToken",
  "KindLessThanLessThanToken", "KindGreaterThanGreaterThanToken", "KindGreaterThanGreaterThanGreaterThanToken",
  "KindLessThanLessThanEqualsToken", "KindGreaterThanGreaterThanEqualsToken", "KindGreaterThanGreaterThanGreaterThanEqualsToken"]);
const numericUnaryOperators = new Set(["KindPlusToken", "KindMinusToken", "KindPlusPlusToken", "KindMinusMinusToken"]);
const valueKinds = new Set(["KindIdentifier", "KindPropertyAccessExpression", "KindElementAccessExpression",
  "KindCallExpression", "KindNewExpression", "KindTaggedTemplateExpression", "KindAwaitExpression",
  "KindConditionalExpression", "KindBinaryExpression", "KindParenthesizedExpression", "KindAsExpression",
  "KindTypeAssertionExpression", "KindSatisfiesExpression", "KindNonNullExpression", "KindPrefixUnaryExpression"]);

export function analyzeSourceEnumNumericUses(
  source: CheckedSourceProgram,
  navigation: Pick<SourceProgramNavigation, "declarationSymbol" | "sourceFiles" | "sourceReferenceFor" | "declarationUseSummary">,
  enumConstants: Pick<SourceEnumConstantIndex, "get" | "integerWidth">,
): readonly SourceEnumAdmissionIssue[] {
  const { ast } = source;
  const issues: SourceEnumAdmissionIssue[] = [];
  for (const file of navigation.sourceFiles) {
    const { checker, typeShape: types } = source.getSourceFileQueries(file);
    const enumTypes = new WeakMap<Type, readonly Symbol[]>();
    const expressionTypes = new WeakMap<Node, Type | null>();
    const enumValues = new WeakMap<Node, readonly Symbol[]>();
    const pending: Node[] = [file];
    while (pending.length !== 0) {
      const node = pending.pop()!;
      if (ast.is.IsEnumDeclaration(node) || ast.is.IsComputedPropertyName(node)) continue;
      const selected = rejectedOperation(node) ?? rejectedContext(node);
      if (selected !== undefined) {
        issues.push(Object.freeze({ code: "TSONIC_ENUM_NUMERIC_USE_NOT_SUPPORTED", category: "error",
          source: "tsonic", sourceNode: node,
          message: `Enum value '${checker.getSymbolName(selected)}' is used as a number; enum-numeric operations are not supported yet. Use equality or bitwise operations within the same enum instead.` }));
        continue;
      }
      const children: Node[] = [];
      ast.forEachChild(node, child => { if (child !== undefined) children.push(child); });
      for (let index = children.length - 1; index >= 0; index -= 1) pending.push(children[index]!);
    }

    function checkedType(node: Node): Type | undefined {
      const existing = expressionTypes.get(node);
      if (existing !== undefined) return existing ?? undefined;
      const selected = checker.getTypeAtLocation(node);
      expressionTypes.set(node, selected ?? null);
      return selected;
    }

    function enumSymbols(type: Type | undefined): readonly Symbol[] {
      if (type === undefined) return [];
      const existing = enumTypes.get(type);
      if (existing !== undefined) return existing;
      const symbols = new Set<Symbol>();
      const visited = new Set<Type>();
      const remaining: Type[] = [type];
      while (remaining.length !== 0) {
        const current = remaining.pop()!;
        if (visited.has(current)) continue;
        visited.add(current);
        if (types.isUnion(current) || types.isIntersection(current)) {
          for (const part of types.getUnionOrIntersectionTypes(current)) {
            if (part === undefined) throw new Error("A completed enum-use type requires every checked constituent.");
            remaining.push(part);
          }
        }
        if (!types.isNumberLike(current) && !types.isStringLike(current)) continue;
        const symbol = checker.getTypeSymbol(current);
        if (symbol === undefined) continue;
        for (const declaration of checker.getSymbolDeclarations(symbol)) {
          if (declaration === undefined) throw new Error("A checked enum type requires exact declaration identities.");
          const owner = ast.is.IsEnumDeclaration(declaration) ? declaration
            : ast.is.IsEnumMember(declaration) ? ast.parent(declaration) : undefined;
          if (owner === undefined || !ast.is.IsEnumDeclaration(owner)) continue;
          const width = enumConstants.integerWidth(owner);
          if (width?.kind === "rejected" && width.admissionIssue !== undefined) continue;
          const selected = navigation.declarationSymbol(owner, file);
          if (selected === undefined) throw new Error("A checked enum use requires its exact enum declaration symbol.");
          symbols.add(selected);
        }
      }
      const selected = Object.freeze([...symbols]);
      enumTypes.set(type, selected);
      return selected;
    }

    function rejectedOperation(node: Node): Symbol | undefined {
      const operator = ast.operatorKindName(node);
      if (operator === undefined) return undefined;
      if (ast.is.IsBinaryExpression(node) &&
        (equalityOperators.has(operator) || bitwiseOperators.has(operator) || numericOperators.has(operator))) {
        const expression = ast.as.AsBinaryExpression(node)!;
        if (expression.Left === undefined || expression.Right === undefined)
          throw new Error("A checked enum binary use requires both actual operands.");
        const left = enumValue(expression.Left);
        const right = enumValue(expression.Right);
        if (left.length === 0 && right.length === 0) return undefined;
        const identical = left.length === 1 && right.length === 1 && left[0] === right[0];
        return identical && (equalityOperators.has(operator) || bitwiseOperators.has(operator))
          ? undefined : left[0] ?? right[0];
      }
      if ((ast.is.IsPrefixUnaryExpression(node) || ast.is.IsPostfixUnaryExpression(node)) && numericUnaryOperators.has(operator)) {
        const operand = ast.is.IsPrefixUnaryExpression(node) ? ast.as.AsPrefixUnaryExpression(node)?.Operand
          : ast.as.AsPostfixUnaryExpression(node)?.Operand;
        if (operand === undefined) throw new Error("A checked enum unary use requires its actual operand.");
        return enumValue(operand)[0];
      }
      return undefined;
    }

    function rejectedContext(node: Node): Symbol | undefined {
      if (!valueKinds.has(ast.kindName(node))) return undefined;
      const parent = ast.parent(node);
      if (parent !== undefined && (ast.is.IsAsExpression(parent) || ast.is.IsTypeAssertion(parent) ||
        ast.is.IsSatisfiesExpression(parent))) return undefined;
      const selected = enumValue(node);
      if (selected.length === 0) return undefined;
      const contextual = checker.getContextualType(node);
      return contextual !== undefined && numericDestination(contextual) ? selected[0] : undefined;
    }

    function enumValue(expression: Node): readonly Symbol[] {
      const pendingValues: { readonly node: Node; readonly children?: readonly Node[] }[] = [{ node: expression }];
      const active = new Set<Node>();
      while (pendingValues.length !== 0) {
        const current = pendingValues.pop()!;
        if (enumValues.has(current.node)) continue;
        if (current.children !== undefined) {
          const first = enumValues.get(current.children[0]!)!;
          const second = current.children.length === 1 ? first : enumValues.get(current.children[1]!)!;
          enumValues.set(current.node, first.length === 1 && second.length === 1 && first[0] === second[0] ? first : Object.freeze([]));
          active.delete(current.node);
          continue;
        }
        if (active.has(current.node)) {
          enumValues.set(current.node, Object.freeze([]));
          continue;
        }
        active.add(current.node);
        const selected = enumSymbols(checkedType(current.node));
        if (selected.length !== 0) {
          enumValues.set(current.node, selected);
          active.delete(current.node);
          continue;
        }
        const operator = ast.operatorKindName(current.node);
        const declaration = ast.is.IsIdentifier(current.node) ? navigation.sourceReferenceFor(current.node)?.declaration : undefined;
        const initializer = declaration !== undefined && ast.is.IsVariableDeclaration(declaration) &&
          ast.typeNode(declaration) === undefined && (ast.variableDeclarationKind(declaration) === "const" ||
            !navigation.declarationUseSummary(declaration).bindingWritten)
          ? ast.as.AsVariableDeclaration(declaration)?.Initializer : undefined;
        const inner = ast.is.IsParenthesizedExpression(current.node) ? ast.as.AsParenthesizedExpression(current.node)?.Expression
          : ast.is.IsNonNullExpression(current.node) ? ast.as.AsNonNullExpression(current.node)?.Expression
          : ast.is.IsSatisfiesExpression(current.node) ? ast.as.AsSatisfiesExpression(current.node)?.Expression
          : ast.is.IsPrefixUnaryExpression(current.node) && operator === "KindTildeToken"
            ? ast.as.AsPrefixUnaryExpression(current.node)?.Operand : initializer;
        const binary = ast.is.IsBinaryExpression(current.node) && operator !== undefined && bitwiseOperators.has(operator)
          ? ast.as.AsBinaryExpression(current.node) : undefined;
        const children = inner !== undefined ? [inner]
          : binary?.Left !== undefined && binary.Right !== undefined ? [binary.Left, binary.Right] : undefined;
        if (children === undefined) {
          enumValues.set(current.node, Object.freeze([]));
          active.delete(current.node);
          continue;
        }
        pendingValues.push({ node: current.node, children });
        for (const child of children) pendingValues.push({ node: child });
      }
      return enumValues.get(expression)!;
    }

    function numericDestination(type: Type): boolean {
      if (enumSymbols(type).length !== 0) return false;
      if (types.isNumberLike(type)) return true;
      if (!types.isUnion(type) && !types.isIntersection(type)) return false;
      const parts = types.getUnionOrIntersectionTypes(type);
      return parts.length > 0 && (types.isIntersection(type) ? parts.some(part => part !== undefined && numericDestination(part))
        : parts.every(part => part !== undefined && (types.isNullish(part) || numericDestination(part))));
    }
  }
  return Object.freeze(issues);
}
