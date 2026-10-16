import type { AstReader, Node, ResolvedSourceWellKnownSymbolInfo, SourceFile } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "../source-navigation/types.js";
import type { SourceFileSemantics } from "./types.js";
import type { SourceNumericLiteralToken } from "./literal-values-model.js";
import { parseSourceNumericLiteral, sourceLiteralToken } from "./literal-token.js";
import { sourceIntegerConstantValue } from "./integer-constant.js";

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
  semantics: {
    readonly operations: Pick<SourceFileSemantics["operations"], "propertyAccess" | "elementAccess" | "wellKnownSymbol" | "call" | "callResult">;
    readonly types: Pick<SourceFileSemantics["types"], "expressionType" | "stringLiteralValue" | "numericLiteralValue" | "constantValue">;
    readonly declarations: Pick<SourceFileSemantics["declarations"], "typeSymbol" | "symbolDeclarations">;
  },
  navigation: Pick<SourceProgramNavigation, "sourceReferenceFor">,
): SourcePropertyNameIndex {
  const values = new WeakMap<Node, SourcePropertyNameSelection>();
  const entries: { readonly node: Node; readonly selection: SourcePropertyNameSelection }[] = [];
  const issues: { readonly node: Node; readonly reason: string }[] = [];
  const numericValues = new WeakMap<Node, SourceNumericLiteralToken | null>();
  const pending: Node[] = [sourceFile];
  while (pending.length > 0) {
    const node = pending.pop()!;
    if (ast.is.IsComputedPropertyName(node) || ast.is.IsNumericLiteral(node) && ast.name(ast.parent(node)) === node) {
      const selection = ast.is.IsComputedPropertyName(node) ? select(node) : selectedNumeric(node);
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
    const expression = unwrap(ast.as.AsComputedPropertyName(name)?.Expression);
    if (expression === undefined) return unavailable;
    const parent = ast.parent(name);
    const typeOnly = parent !== undefined && (ast.is.IsPropertySignatureDeclaration(parent) || ast.is.IsMethodSignatureDeclaration(parent));
    const symbol = semantics.operations.wellKnownSymbol(name);
    if (symbol !== undefined) {
      return typeOnly || pureReference(expression) ? Object.freeze({ kind: "well-known-symbol", symbol: symbol.kind }) : unavailable;
    }
    if (typeOnly) {
      const declaration = ast.is.IsIdentifier(expression) ? navigation.sourceReferenceFor(expression)?.declaration
        : ast.is.IsPropertyAccessExpression(expression) ? semantics.operations.propertyAccess(expression)?.selectedDeclaration
          : ast.is.IsElementAccessExpression(expression) ? semantics.operations.elementAccess(expression)?.selectedDeclaration : undefined;
      return declaration !== undefined && ast.is.IsEnumMember(declaration) ? selectedEnum(expression) : selectedLiteral(expression);
    }
    if (ast.is.IsStringLiteral(expression) || ast.is.IsNoSubstitutionTemplateLiteral(expression)) {
      return Object.freeze({ kind: "resolved", name: ast.text(expression) });
    }
    if (ast.is.IsNumericLiteral(expression) || signedNumericLiteral(expression)) return selectedLiteral(expression);
    if (ast.is.IsIdentifier(expression)) {
      const declaration = navigation.sourceReferenceFor(expression)?.declaration;
      if (declaration !== undefined && constBinding(declaration)) return selectedLiteral(expression);
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
    while (current !== undefined) {
      if (ast.is.IsParenthesizedExpression(current)) current = ast.as.AsParenthesizedExpression(current)?.Expression;
      else if (ast.is.IsAsExpression(current)) current = ast.as.AsAsExpression(current)?.Expression;
      else if (ast.is.IsSatisfiesExpression(current)) current = ast.as.AsSatisfiesExpression(current)?.Expression;
      else if (ast.is.IsNonNullExpression(current)) current = ast.as.AsNonNullExpression(current)?.Expression;
      else break;
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
    if (typeof semantics.types.numericLiteralValue(type) !== "number") return unavailable;
    return selectedNumeric(node);
  }

  function selectedNumeric(node: Node): SourcePropertyNameSelection {
    const numeric = exactNumeric(node, new Set());
    return numeric === undefined ? unavailable : Object.freeze({ kind: "resolved", name: numericName(numeric) });
  }

  function selectedEnum(node: Node): SourcePropertyNameSelection {
    const value = semantics.types.constantValue(node);
    if (typeof value === "string") return Object.freeze({ kind: "resolved", name: value });
    const numeric = exactNumeric(node, new Set());
    return numeric === undefined ? unavailable : Object.freeze({ kind: "resolved", name: numericName(numeric) });
  }

  function exactNumeric(node: Node, active: Set<Node>): SourceNumericLiteralToken | undefined {
    const current = unwrap(node);
    if (current === undefined || active.has(current)) return undefined;
    const cached = numericValues.get(current);
    if (cached !== undefined) return cached ?? undefined;
    active.add(current);
    let selected: SourceNumericLiteralToken | undefined;
    try {
      selected = selectExactNumeric(current, active);
    } finally {
      active.delete(current);
    }
    numericValues.set(current, selected ?? null);
    return selected;
  }

  function selectExactNumeric(current: Node, active: Set<Node>): SourceNumericLiteralToken | undefined {
      if (ast.is.IsNumericLiteral(current)) {
        const source = sourceLiteralToken(ast, current);
        if (source.kind === "authored") return parseSourceNumericLiteral(source.text)?.token;
        const type = semantics.types.expressionType(current);
        const value = type === undefined ? undefined : semantics.types.numericLiteralValue(type);
        return typeof value === "number" && Number.isFinite(value)
          ? numericTokenFromText(String(value)) : undefined;
      }
      if (ast.is.IsPrefixUnaryExpression(current)) {
        const operator = ast.operatorKindName(current);
        const operand = ast.as.AsPrefixUnaryExpression(current)?.Operand;
        if (operand === undefined || operator !== "KindPlusToken" && operator !== "KindMinusToken") return undefined;
        const selected = exactNumeric(operand, active);
        return selected === undefined || operator === "KindPlusToken" ? selected
          : Object.freeze({ ...selected, negative: !selected.negative });
      }
      if (ast.is.IsAsExpression(current) || ast.is.IsSatisfiesExpression(current)) {
        const expression = ast.is.IsAsExpression(current)
          ? ast.as.AsAsExpression(current)?.Expression : ast.as.AsSatisfiesExpression(current)?.Expression;
        return expression === undefined ? undefined : exactNumeric(expression, active);
      }
      if (ast.is.IsBinaryExpression(current)) {
        const integer = sourceIntegerConstantValue(ast, current);
        return integer === undefined ? undefined : numericTokenFromText(integer.toString());
      }
      if (ast.is.IsCallExpression(current)) {
        const call = semantics.operations.call(current);
        return call === undefined ? undefined : numericType(semantics.operations.callResult(call)?.authoredTypeNode, active);
      }
      const declaration = ast.is.IsIdentifier(current)
        ? navigation.sourceReferenceFor(current)?.declaration
        : ast.is.IsPropertyAccessExpression(current) ? semantics.operations.propertyAccess(current)?.selectedDeclaration
          : ast.is.IsElementAccessExpression(current) ? semantics.operations.elementAccess(current)?.selectedDeclaration
            : ast.is.IsEnumMember(current) ? current : undefined;
      if (declaration === undefined) return undefined;
      if (ast.is.IsParameterDeclaration(declaration)) return numericType(ast.typeNode(declaration), active);
      if (constBinding(declaration)) {
        const initializer = bindingValue(declaration, new Set());
        const authored = initializer === undefined ? undefined : exactNumeric(initializer, active);
        if (authored !== undefined) return authored;
        const annotation = numericType(ast.typeNode(declaration), active);
        if (annotation !== undefined) return annotation;
        const value = initializer === undefined ? undefined : unwrap(initializer);
        const call = value === undefined || !ast.is.IsCallExpression(value) ? undefined : semantics.operations.call(value);
        const result = call === undefined ? undefined : semantics.operations.callResult(call);
        const returned = numericType(result?.authoredTypeNode, active);
        if (returned !== undefined) return returned;
        if (call === undefined || result?.authoredTypeNode === undefined) return undefined;
        const typeNode = result.authoredTypeNode;
        const typeName = ast.is.IsTypeReferenceNode(typeNode) ? ast.as.AsTypeReferenceNode(typeNode)?.TypeName : undefined;
        const parameter = typeName === undefined ? undefined : navigation.sourceReferenceFor(typeName)?.declaration;
        if (parameter === undefined || !ast.is.IsTypeParameterDeclaration(parameter)) return undefined;
        const binding = call.sourceSelectedMethodTypeArguments?.find(candidate => {
          const symbol = semantics.declarations.typeSymbol(candidate.typeParameter);
          return symbol !== undefined && semantics.declarations.symbolDeclarations(symbol).includes(parameter);
        });
        const explicit = numericType(binding?.explicitTypeNode, active);
        if (explicit !== undefined) return explicit;
        const candidates = call.sourceSelectedSignatureParameters.filter(candidate => {
          const name = candidate.authoredTypeNode === undefined || !ast.is.IsTypeReferenceNode(candidate.authoredTypeNode)
            ? undefined : ast.as.AsTypeReferenceNode(candidate.authoredTypeNode)?.TypeName;
          return name !== undefined && navigation.sourceReferenceFor(name)?.declaration === parameter;
        });
        const inputs = candidates.flatMap(candidate => call.sourceArgumentBindings.filter(argument =>
          argument.sourceParameterIndex === candidate.parameterIndex).map(argument =>
          call.sourceArguments[argument.sourceArgumentIndex]?.expression));
        const values = inputs.map(input => input === undefined ? undefined : exactNumeric(input, active));
        const first = values[0];
        return first !== undefined && values.every(value => value !== undefined && numericName(value) === numericName(first))
          ? first : undefined;
      }
      if (!ast.is.IsEnumMember(declaration) || active.has(declaration) && declaration !== current) return undefined;
      const initializer = ast.as.AsEnumMember(declaration)?.Initializer;
      if (initializer !== undefined) return exactNumeric(initializer, active);
      const owner = ast.parent(declaration);
      const members = owner === undefined ? [] : ast.as.AsEnumDeclaration(owner)?.Members?.Nodes ?? [];
      const index = members.indexOf(declaration);
      if (index === 0) return numericTokenFromText("0");
      const previous = index > 0 ? members[index - 1] : undefined;
      const selected = previous === undefined ? undefined : exactNumeric(previous, active);
      const integer = selected === undefined ? undefined : exactInteger(selected);
      return integer === undefined ? undefined : numericTokenFromText((integer + 1n).toString());
  }

  function numericType(node: Node | undefined, active: Set<Node>): SourceNumericLiteralToken | undefined {
    if (node === undefined || active.has(node)) return undefined;
    if (ast.is.IsParenthesizedTypeNode(node)) return numericType(ast.as.AsParenthesizedTypeNode(node)?.Type, active);
    if (ast.is.IsLiteralTypeNode(node)) {
      const literal = ast.as.AsLiteralTypeNode(node)?.Literal;
      return literal === undefined ? undefined : exactNumeric(literal, active);
    }
    const name = ast.is.IsTypeReferenceNode(node) ? ast.as.AsTypeReferenceNode(node)?.TypeName : undefined;
    const declaration = name === undefined ? undefined : navigation.sourceReferenceFor(name)?.declaration;
    if (declaration === undefined || !ast.is.IsTypeAliasDeclaration(declaration)) return undefined;
    active.add(node);
    try { return numericType(ast.typeNode(declaration), active); } finally { active.delete(node); }
  }

  function constBinding(declaration: Node): boolean {
    let current: Node | undefined = declaration;
    while (current !== undefined && ast.is.IsBindingElement(current)) {
      const pattern = ast.parent(current);
      current = pattern === undefined ? undefined : ast.parent(pattern);
    }
    return current !== undefined && ast.is.IsVariableDeclaration(current) && ast.variableDeclarationKind(current) === "const";
  }

  function bindingValue(declaration: Node, active: Set<Node>): Node | undefined {
    if (active.has(declaration)) return undefined;
    active.add(declaration);
    if (ast.is.IsVariableDeclaration(declaration)) return ast.as.AsVariableDeclaration(declaration)?.Initializer;
    const binding = ast.as.AsBindingElement(declaration);
    const pattern = ast.parent(declaration);
    const owner = pattern === undefined ? undefined : ast.parent(pattern);
    if (binding === undefined || binding.DotDotDotToken !== undefined || pattern === undefined || owner === undefined) return undefined;
    const input = bindingValue(owner, active);
    let value = unwrap(input);
    while (value !== undefined) {
      if (ast.is.IsAsExpression(value) || ast.is.IsSatisfiesExpression(value)) {
        value = unwrap(ast.is.IsAsExpression(value) ? ast.as.AsAsExpression(value)?.Expression
          : ast.as.AsSatisfiesExpression(value)?.Expression);
      } else if (ast.is.IsIdentifier(value)) {
        const reference = navigation.sourceReferenceFor(value)?.declaration;
        if (reference === undefined || !constBinding(reference)) return undefined;
        value = unwrap(bindingValue(reference, active));
      } else break;
    }
    if (value === undefined) return undefined;
    if (ast.is.IsArrayBindingPattern(pattern) && ast.is.IsArrayLiteralExpression(value)) {
      const position = ast.elements(pattern).indexOf(declaration);
      return ast.elements(value)[position];
    }
    if (!ast.is.IsObjectBindingPattern(pattern) || !ast.is.IsObjectLiteralExpression(value)) return undefined;
    const key = binding.PropertyName ?? ast.name(declaration);
    if (key === undefined || !ast.is.IsIdentifier(key) && !ast.is.IsStringLiteral(key)) return undefined;
    const name = ast.text(key);
    for (const property of [...ast.properties(value)].reverse()) {
      if (property === undefined) continue;
      const propertyName = ast.name(property);
      if (propertyName === undefined || !ast.is.IsIdentifier(propertyName) && !ast.is.IsStringLiteral(propertyName)) return undefined;
      if (ast.text(propertyName) !== name) continue;
      if (ast.is.IsPropertyAssignment(property)) return ast.as.AsPropertyAssignment(property)?.Initializer;
      if (ast.is.IsShorthandPropertyAssignment(property)) return ast.name(property);
      return undefined;
    }
    return binding.Initializer;
  }

  function pureReference(node: Node): boolean {
    const current = unwrap(node);
    if (current === undefined) return false;
    if (ast.is.IsIdentifier(current)) return true;
    if (ast.is.IsPropertyAccessExpression(current)) {
      const access = ast.as.AsPropertyAccessExpression(current);
      const declaration = semantics.operations.propertyAccess(current)?.selectedDeclaration;
      return declaration !== undefined && !ast.is.IsGetAccessorDeclaration(declaration) && !ast.is.IsSetAccessorDeclaration(declaration) &&
        access?.QuestionDotToken === undefined && access?.Expression !== undefined && pureReference(access.Expression);
    }
    if (ast.is.IsElementAccessExpression(current)) {
      const access = ast.as.AsElementAccessExpression(current);
      const key = unwrap(access?.ArgumentExpression);
      const declaration = semantics.operations.elementAccess(current)?.selectedDeclaration;
      return declaration !== undefined && !ast.is.IsGetAccessorDeclaration(declaration) && !ast.is.IsSetAccessorDeclaration(declaration) &&
        access?.QuestionDotToken === undefined && access?.Expression !== undefined && pureReference(access.Expression) &&
        key !== undefined && (ast.is.IsStringLiteral(key) || ast.is.IsNumericLiteral(key));
    }
    return false;
  }
}

function numericTokenFromText(text: string): SourceNumericLiteralToken | undefined {
  const negative = text.startsWith("-");
  const token = parseSourceNumericLiteral(negative ? text.slice(1) : text)?.token;
  return token === undefined ? undefined : negative ? Object.freeze({ ...token, negative }) : token;
}

function exactInteger(token: SourceNumericLiteralToken): bigint | undefined {
  if (token.exponent < 0n || BigInt(token.coefficient.toString().length) + token.exponent > 40n) return undefined;
  const value = token.coefficient * 10n ** token.exponent;
  return token.negative ? -value : value;
}

function numericName(token: SourceNumericLiteralToken): string {
  if (token.coefficient === 0n) return "0";
  const digits = token.coefficient.toString();
  const point = BigInt(digits.length) + token.exponent;
  const prefix = token.negative ? "-" : "";
  if (point > 0n && point <= 21n) {
    const position = Number(point);
    return prefix + (position >= digits.length ? digits.padEnd(position, "0")
      : `${digits.slice(0, position)}.${digits.slice(position)}`);
  }
  if (point <= 0n && point >= -5n) return `${prefix}0.${"0".repeat(Number(-point))}${digits}`;
  const exponent = point - 1n;
  return `${prefix}${digits[0]}${digits.length === 1 ? "" : `.${digits.slice(1)}`}e${exponent < 0n ? "" : "+"}${exponent}`;
}
