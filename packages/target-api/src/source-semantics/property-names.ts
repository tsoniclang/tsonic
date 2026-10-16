import type { AstReader, Node, ResolvedSourceWellKnownSymbolInfo, SourceFile, Type } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "../source-navigation/types.js";
import type { SourceFileSemantics } from "./types.js";
import type { SourceNumericLiteralToken } from "./literal-values-model.js";
import { parseSourceNumericLiteral, sourceLiteralToken } from "./literal-token.js";
import { sourceIntegerConstantValue } from "./integer-constant.js";
import type { SourceEnumConstantIndex, SourceEnumConstantSelection } from "./enum-constants.js";

export type SourcePropertyNameConstant =
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "numeric"; readonly token: SourceNumericLiteralToken }
  | { readonly kind: "enum-member"; readonly entry: Extract<SourceEnumConstantSelection, { kind: "resolved" }> };

export type SourcePropertyNameSelection =
  | { readonly kind: "resolved"; readonly name: string; readonly constant: SourcePropertyNameConstant }
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
    readonly types: Pick<SourceFileSemantics["types"], "expressionType" | "stringLiteralValue" | "numericLiteralValue" | "constantValue" | "isTuple" | "tupleElementInfos">;
    readonly declarations: Pick<SourceFileSemantics["declarations"], "typeSymbol" | "symbolDeclarations">;
  },
  navigation: Pick<SourceProgramNavigation, "sourceReferenceFor">,
  enumConstants: SourceEnumConstantIndex,
): SourcePropertyNameIndex {
  const values = new WeakMap<Node, SourcePropertyNameSelection>();
  const entries: { readonly node: Node; readonly selection: SourcePropertyNameSelection }[] = [];
  const issues: { readonly node: Node; readonly reason: string }[] = [];
  const numericValues = new WeakMap<Node, SourceNumericLiteralToken | null>();
  const checkedTypes = new WeakMap<Node, Type | null>();
  const pending: Node[] = [sourceFile];
  while (pending.length > 0) {
    const node = pending.pop()!;
    const parent = ast.parent(node);
    if (ast.is.IsComputedPropertyName(node) || isOrdinaryPropertyName(node, parent)) {
      const selection = ast.is.IsComputedPropertyName(node) ? select(node)
        : ast.is.IsNumericLiteral(node) ? selectedNumeric(node) : selectedString(ast.text(node));
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

  function isOrdinaryPropertyName(node: Node, parent: Node | undefined): boolean {
    if (parent === undefined || !ast.is.IsIdentifier(node) && !ast.is.IsStringLiteral(node) && !ast.is.IsNumericLiteral(node)) return false;
    if (ast.is.IsBindingElement(parent)) {
      const pattern = ast.parent(parent);
      const binding = ast.as.AsBindingElement(parent)!;
      return pattern !== undefined && ast.is.IsObjectBindingPattern(pattern) &&
        (binding.PropertyName ?? ast.name(parent)) === node;
    }
    return ast.name(parent) === node && (ast.is.IsPropertyAssignment(parent) || ast.is.IsShorthandPropertyAssignment(parent) ||
      ast.is.IsPropertyDeclaration(parent) || ast.is.IsPropertySignatureDeclaration(parent) || ast.is.IsMethodDeclaration(parent) ||
      ast.is.IsMethodSignatureDeclaration(parent) || ast.is.IsGetAccessorDeclaration(parent) || ast.is.IsSetAccessorDeclaration(parent));
  }

  function select(name: Node): SourcePropertyNameSelection {
    const selection = classify(name);
    if (selection.kind !== "resolved") return selection;
    const expression = ast.as.AsComputedPropertyName(name)?.Expression;
    const type = expression === undefined ? undefined : checkedType(expression);
    const numeric = type === undefined ? undefined : semantics.types.numericLiteralValue(type);
    if (typeof numeric === "number" && !Number.isFinite(numeric)) return rejected(
      "The numeric property key exceeds finite native literal bounds.");
    if (expression !== undefined && hasAssertion(expression)) {
      const text = type === undefined ? undefined : semantics.types.stringLiteralValue(type);
      if (text !== undefined && text !== selection.name || typeof numeric === "number" && Number(selection.name) !== numeric) return rejected(
        "The computed key's authored value disagrees with its asserted literal type.");
    }
    const contract = expression === undefined ? undefined : literalContract(expression, new Set());
    if (contract !== undefined) {
      const actual = ast.is.IsStringLiteral(contract) || ast.is.IsNoSubstitutionTemplateLiteral(contract) ? ast.text(contract)
        : exactNumeric(contract, new Set());
      if (actual !== undefined && (typeof actual === "string" ? actual : numericName(actual)) !== selection.name) return rejected(
        "The computed key's exact source value disagrees with its authored literal contract.");
    }
    return selection;
  }

  function classify(name: Node): SourcePropertyNameSelection {
    const expression = unwrap(ast.as.AsComputedPropertyName(name)?.Expression);
    if (expression === undefined) return unavailable;
    const parent = ast.parent(name);
    const typeOnly = parent !== undefined && (ast.is.IsPropertySignatureDeclaration(parent) || ast.is.IsMethodSignatureDeclaration(parent));
    const symbol = semantics.operations.wellKnownSymbol(name);
    if (symbol !== undefined) {
      return typeOnly || pureReference(expression) ? Object.freeze({ kind: "well-known-symbol", symbol: symbol.kind }) : rejected(
        "A well-known-symbol property key must be a non-effectful reference; calls and getter evaluation cannot be erased.");
    }
    if (typeOnly) {
      const declaration = ast.is.IsIdentifier(expression) ? navigation.sourceReferenceFor(expression)?.declaration
        : ast.is.IsPropertyAccessExpression(expression) ? semantics.operations.propertyAccess(expression)?.selectedDeclaration
          : ast.is.IsElementAccessExpression(expression) ? semantics.operations.elementAccess(expression)?.selectedDeclaration : undefined;
      return declaration !== undefined && ast.is.IsEnumMember(declaration) ? selectedEnum(declaration) : selectedLiteral(expression);
    }
    if (ast.is.IsStringLiteral(expression) || ast.is.IsNoSubstitutionTemplateLiteral(expression)) {
      return selectedString(ast.text(expression));
    }
    if (ast.is.IsNumericLiteral(expression) || signedNumericLiteral(expression)) return selectedLiteral(expression);
    if (ast.is.IsIdentifier(expression)) {
      const declaration = navigation.sourceReferenceFor(expression)?.declaration;
      if (declaration !== undefined && constBinding(declaration)) return selectedLiteral(expression);
      if (declaration !== undefined && ast.is.IsEnumMember(declaration)) return selectedEnum(declaration);
      return rejected(declaration !== undefined && (ast.is.IsVariableDeclaration(declaration) || ast.is.IsBindingElement(declaration))
        ? "A mutable binding cannot define a static native field name; the key requires one exact const literal value."
        : "The computed key is not a const singleton binding or an exact enum constant.");
    }
    if (ast.is.IsCallExpression(expression)) return rejected(
      "A computed property key call must retain its effects and cannot be replaced with a static native field name.");
    const access = ast.is.IsPropertyAccessExpression(expression)
      ? semantics.operations.propertyAccess(expression)
      : ast.is.IsElementAccessExpression(expression) ? semantics.operations.elementAccess(expression) : undefined;
    if (access?.selectedDeclaration === undefined || !ast.is.IsEnumMember(access.selectedDeclaration)) return rejected(
      access?.selectedDeclaration !== undefined && ast.is.IsGetAccessorDeclaration(access.selectedDeclaration)
        ? "A computed property key getter must retain its effects and cannot be replaced with a static native field name."
        : "The computed key has no exact literal, const binding, enum member or selected native symbol identity.");
    if (!pureReference(expression)) return rejected("An enum property key receiver cannot contain calls or getter evaluation.");
    return selectedEnum(access.selectedDeclaration);
  }

  function unwrap(node: Node | undefined): Node | undefined {
    let current = node;
    while (current !== undefined) {
      if (ast.is.IsParenthesizedExpression(current)) current = ast.as.AsParenthesizedExpression(current)?.Expression;
      else if (ast.is.IsAsExpression(current)) current = ast.as.AsAsExpression(current)?.Expression;
      else if (ast.is.IsTypeAssertion(current)) current = ast.as.AsTypeAssertion(current)?.Expression;
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
    const member = enumOrigin(node, new Set());
    if (member !== undefined) return selectedEnum(member);
    const type = checkedType(node);
    if (type === undefined) return rejected("The computed key has no completed checked literal type.");
    const text = semantics.types.stringLiteralValue(type);
    if (text !== undefined) {
      const origin = literalOrigin(node, new Set());
      if (origin !== undefined && (!ast.is.IsStringLiteral(origin) && !ast.is.IsNoSubstitutionTemplateLiteral(origin) || ast.text(origin) !== text)) {
        return rejected("The const key's exact source value disagrees with its checked literal type.");
      }
      return selectedString(text);
    }
    const value = semantics.types.numericLiteralValue(type);
    if (typeof value !== "number") return rejected("The computed key's checked type is not one exact string or numeric literal.");
    if (!Number.isFinite(value)) return rejected("The numeric property key exceeds finite native literal bounds.");
    const selected = selectedNumeric(node);
    if (selected.kind === "resolved" && Number(selected.name) !== value) return rejected(
      "The const key's exact source value disagrees with its checked literal type.");
    return selected;
  }

  function selectedNumeric(node: Node): SourcePropertyNameSelection {
    const type = checkedType(node);
    const checked = type === undefined ? undefined : semantics.types.numericLiteralValue(type);
    if (typeof checked === "number" && !Number.isFinite(checked)) return rejected("The numeric property key exceeds finite native literal bounds.");
    const numeric = exactNumeric(node, new Set());
    return numeric === undefined ? rejected("The numeric key has no exact authored literal origin corresponding to its checked constant value.")
      : Object.freeze({ kind: "resolved", name: numericName(numeric), constant: Object.freeze({ kind: "numeric", token: numeric }) });
  }

  function selectedString(value: string): SourcePropertyNameSelection {
    return Object.freeze({ kind: "resolved", name: value, constant: Object.freeze({ kind: "string", value }) });
  }

  function selectedEnum(node: Node): SourcePropertyNameSelection {
    const constant = enumConstants.get(node);
    if (constant === undefined) throw new Error("A selected checked enum member requires its completed source constant entry.");
    if (constant.kind === "rejected") return rejected(constant.reason);
    const numeric = typeof constant.value === "bigint" ? numericTokenFromText(constant.value.toString()) : undefined;
    return Object.freeze({ kind: "resolved", name: typeof constant.value === "string" ? constant.value : numericName(numeric!),
      constant: Object.freeze({ kind: "enum-member", entry: constant }) });
  }

  function enumOrigin(node: Node, active: Set<Node>): Node | undefined {
    const current = unwrap(node);
    if (current === undefined || active.has(current)) return undefined;
    active.add(current);
    const declaration = ast.is.IsIdentifier(current) ? navigation.sourceReferenceFor(current)?.declaration
      : ast.is.IsPropertyAccessExpression(current) ? semantics.operations.propertyAccess(current)?.selectedDeclaration
        : ast.is.IsElementAccessExpression(current) ? semantics.operations.elementAccess(current)?.selectedDeclaration : undefined;
    if (declaration === undefined) return undefined;
    if (ast.is.IsEnumMember(declaration)) return declaration;
    if (!constBinding(declaration)) return undefined;
    const value = bindingValue(declaration, new Set());
    return value === undefined ? undefined : enumOrigin(value, active);
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
        const type = checkedType(current);
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
      if (!ast.is.IsEnumMember(declaration)) return undefined;
      const constant = enumConstants.get(declaration);
      return constant?.kind === "resolved" && typeof constant.value === "bigint" ? numericTokenFromText(constant.value.toString()) : undefined;
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

  function literalTypeOrigin(node: Node | undefined, active: Set<Node>): Node | undefined {
    if (node === undefined || active.has(node)) return undefined;
    if (ast.is.IsLiteralTypeNode(node)) return ast.as.AsLiteralTypeNode(node)?.Literal;
    if (ast.is.IsParenthesizedTypeNode(node)) return literalTypeOrigin(ast.as.AsParenthesizedTypeNode(node)?.Type, active);
    const name = ast.is.IsTypeReferenceNode(node) ? ast.as.AsTypeReferenceNode(node)?.TypeName : undefined;
    const declaration = name === undefined ? undefined : navigation.sourceReferenceFor(name)?.declaration;
    if (declaration === undefined || !ast.is.IsTypeAliasDeclaration(declaration)) return undefined;
    active.add(node);
    return literalTypeOrigin(ast.typeNode(declaration), active);
  }

  function literalOrigin(node: Node, active: Set<Node>): Node | undefined {
    const current = unwrap(node);
    if (current === undefined || active.has(current)) return undefined;
    active.add(current);
    if (ast.is.IsStringLiteral(current) || ast.is.IsNoSubstitutionTemplateLiteral(current) ||
      ast.is.IsNumericLiteral(current) || signedNumericLiteral(current)) return current;
    if (ast.is.IsCallExpression(current)) {
      const call = semantics.operations.call(current);
      return literalTypeOrigin(call === undefined ? undefined : semantics.operations.callResult(call)?.authoredTypeNode, active);
    }
    const declaration = ast.is.IsIdentifier(current) ? navigation.sourceReferenceFor(current)?.declaration : undefined;
    if (declaration === undefined) return undefined;
    if (constBinding(declaration)) {
      const value = bindingValue(declaration, new Set());
      if (value !== undefined) return literalOrigin(value, active);
    }
    return literalTypeOrigin(ast.typeNode(declaration), active);
  }

  function literalContract(node: Node, active: Set<Node>): Node | undefined {
    if (active.has(node)) return undefined;
    active.add(node);
    if (ast.is.IsAsExpression(node) || ast.is.IsTypeAssertion(node)) {
      const expression = ast.is.IsAsExpression(node) ? ast.as.AsAsExpression(node) : ast.as.AsTypeAssertion(node);
      return literalTypeOrigin(expression?.Type, active) ??
        (expression?.Expression === undefined ? undefined : literalContract(expression.Expression, active));
    }
    if (ast.is.IsParenthesizedExpression(node) || ast.is.IsNonNullExpression(node) || ast.is.IsSatisfiesExpression(node)) {
      const expression = ast.is.IsParenthesizedExpression(node) ? ast.as.AsParenthesizedExpression(node)?.Expression
        : ast.is.IsNonNullExpression(node) ? ast.as.AsNonNullExpression(node)?.Expression : ast.as.AsSatisfiesExpression(node)?.Expression;
      return expression === undefined || expression === node ? undefined : literalContract(expression, active);
    }
    const declaration = ast.is.IsIdentifier(node) ? navigation.sourceReferenceFor(node)?.declaration : undefined;
    if (declaration === undefined || !constBinding(declaration)) return undefined;
    const annotation = literalTypeOrigin(ast.typeNode(declaration), active);
    if (annotation !== undefined) return annotation;
    const value = bindingValue(declaration, new Set());
    return value === undefined ? undefined : literalContract(value, active);
  }

  function rejected(reason: string): SourcePropertyNameSelection {
    return Object.freeze({ kind: "rejected", reason });
  }

  function checkedType(node: Node): Type | undefined {
    const cached = checkedTypes.get(node);
    if (cached !== undefined) return cached ?? undefined;
    const type = semantics.types.expressionType(node);
    checkedTypes.set(node, type ?? null);
    return type;
  }

  function hasAssertion(node: Node): boolean {
    let current: Node | undefined = node;
    while (current !== undefined) {
      if (ast.is.IsAsExpression(current) || ast.is.IsTypeAssertion(current)) return true;
      if (ast.is.IsParenthesizedExpression(current)) current = ast.as.AsParenthesizedExpression(current)?.Expression;
      else if (ast.is.IsNonNullExpression(current)) current = ast.as.AsNonNullExpression(current)?.Expression;
      else if (ast.is.IsSatisfiesExpression(current)) current = ast.as.AsSatisfiesExpression(current)?.Expression;
      else break;
    }
    return false;
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
        const selected = bindingValue(reference, active);
        if (selected === undefined) break;
        value = unwrap(selected);
      } else break;
    }
    if (value === undefined) return undefined;
    if (ast.is.IsArrayBindingPattern(pattern)) {
      const position = ast.elements(pattern).indexOf(declaration);
      return arrayElementOrigin(value, position, active);
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

  function arrayElementOrigin(expression: Node, position: number, active: Set<Node>): Node | undefined {
    const current = unwrap(expression);
    if (current === undefined || active.has(current)) return undefined;
    active.add(current);
    if (ast.is.IsIdentifier(current)) {
      const declaration = navigation.sourceReferenceFor(current)?.declaration;
      if (declaration === undefined || !constBinding(declaration)) return undefined;
      const value = bindingValue(declaration, active);
      if (value !== undefined) return arrayElementOrigin(value, position, active);
    }
    if (!ast.is.IsArrayLiteralExpression(current)) {
      const type = checkedType(current);
      if (type === undefined || !semantics.types.isTuple(type)) return undefined;
      const elements = semantics.types.tupleElementInfos(type);
      if (elements.some(item => item.elementKind !== "required")) return undefined;
      const declaration = elements[position]?.declaration;
      return literalTypeOrigin(declaration === undefined ? undefined : ast.typeNode(declaration) ?? declaration, active);
    }
    let cursor = 0;
    for (const element of ast.elements(current)) {
      if (element !== undefined && ast.is.IsSpreadElement(element)) {
        const spread = ast.as.AsSpreadElement(element)?.Expression;
        const type = spread === undefined ? undefined : checkedType(spread);
        if (spread === undefined || type === undefined || !semantics.types.isTuple(type)) return undefined;
        const elements = semantics.types.tupleElementInfos(type);
        if (elements.some(item => item.elementKind !== "required")) return undefined;
        if (position < cursor + elements.length) return arrayElementOrigin(spread, position - cursor, active);
        cursor += elements.length;
      } else {
        if (position === cursor) return element;
        cursor += 1;
      }
    }
    return undefined;
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
