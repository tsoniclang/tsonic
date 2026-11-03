import type { AstReader, Node, ResolvedSourceWellKnownSymbolInfo, SourceFile, Type } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "../source-navigation/types.js";
import { sourceClassFieldIsTypeOnly } from "../source-navigation/class-members.js";
import { isSourceCallableBodyBoundary } from "../source-navigation/callable-boundaries.js";
import type { SourceFileSemantics } from "./types.js";
import type { SourceNumericLiteralToken } from "./literal-values-model.js";
import { parseSourceNumericLiteral, sourceLiteralToken } from "./literal-token.js";
import { sourceIntegerConstantValue } from "./integer-constant.js";
import type { SourceEnumConstantIndex, SourceEnumConstantSelection } from "./enum-model.js";

export type SourcePropertyNameConstant =
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "numeric"; readonly token: SourceNumericLiteralToken }
  | { readonly kind: "enum-member"; readonly entry: Extract<SourceEnumConstantSelection, { kind: "resolved" }> };

export type SourcePropertyNameSelection =
  | { readonly kind: "resolved"; readonly name: string; readonly constant: SourcePropertyNameConstant }
  | { readonly kind: "well-known-symbol"; readonly symbol: ResolvedSourceWellKnownSymbolInfo["kind"] }
  | { readonly kind: "unique-symbol"; readonly type: Type }
  | { readonly kind: "rejected"; readonly reason: string; readonly failure: "source" | "resource" };

export interface SourcePropertyNameIndex {
  readonly entries: readonly { readonly node: Node; readonly selection: SourcePropertyNameSelection }[];
  readonly issues: readonly { readonly node: Node; readonly reason: string; readonly failure: "source" | "resource" }[];
  get(name: Node): SourcePropertyNameSelection | undefined;
}

const unavailable: SourcePropertyNameSelection = Object.freeze({
  kind: "rejected",
  failure: "source",
  reason: "Computed property names require an exact string or finite numeric literal, a const binding of one literal type, an enum member, or a selected well-known symbol. Dynamic or effectful keys have no static native field representation.",
});

export function analyzeSourcePropertyNames(
  ast: AstReader,
  files: readonly { readonly sourceFile: SourceFile; readonly semantics: {
    readonly operations: Pick<SourceFileSemantics["operations"], "propertyName" | "objectLiteralElement" | "propertyAccess" | "elementAccess" | "wellKnownSymbol" | "call" | "callResult">;
    readonly types: Pick<SourceFileSemantics["types"], "expressionType" | "stringLiteralValue" | "numericLiteralValue" | "constantValue" | "isTuple" | "tupleElementInfos" | "selectIndexedAccess" | "isNumberLike" | "isIntersection" | "unionOrIntersectionTypes">;
    readonly declarations: Pick<SourceFileSemantics["declarations"], "typeSymbol" | "symbolDeclarations">;
  } }[],
  navigation: Pick<SourceProgramNavigation, "sourceReferenceFor">,
  enumConstants: SourceEnumConstantIndex,
): readonly { readonly sourceFile: SourceFile; readonly propertyNames: SourcePropertyNameIndex }[] {
  const entries: { readonly node: Node; readonly selection: SourcePropertyNameSelection }[] = [];
  const issues: { readonly node: Node; readonly reason: string; readonly failure: "source" | "resource" }[] = [];
  const checkedTypes = new WeakMap<Node, Type | null>();
  const facts = new WeakMap<Node, KeyFact>();
  const declarations = new WeakMap<Node, KeyFact>();
  const drafts: KeyFact[] = [];
  const inventory: Node[] = [];
  const inputs = new Map(files.map(file => [file.sourceFile, file.semantics]));
  const scopes = new Map<Node, Node[]>(files.map(file => [file.sourceFile, []]));
  const pending = files.map(file => ({ node: file.sourceFile as Node, finish: false, scope: file.sourceFile as Node })).reverse();
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (current.finish) { scopes.get(current.scope)!.push(current.node); continue; }
    const scope = isSourceCallableBodyBoundary(ast, current.node) || ast.is.IsClassDeclaration(current.node) ||
      ast.is.IsClassExpression(current.node) ? current.node : current.scope;
    if (!scopes.has(scope)) scopes.set(scope, []);
    inventory.push(current.node);
    pending.push({ node: current.node, finish: true, scope });
    const children: Node[] = [];
    ast.forEachChild(current.node, child => { if (child !== undefined) children.push(child); });
    for (let index = children.length - 1; index >= 0; index -= 1) pending.push({ node: children[index]!, finish: false, scope });
  }
  for (const file of files) for (const node of scopes.get(file.sourceFile)!) completeFact(node);
  for (const [scope, nodes] of scopes) {
    if (ast.is.IsSourceFile(scope)) continue;
    for (const node of nodes) completeFact(node);
  }
  const validating = new Set<KeyFact>();
  const validated = new Set<KeyFact>();
  for (const fact of drafts) validateFact(fact);
  for (const fact of drafts) Object.freeze(fact);
  for (const node of inventory) {
    const parent = ast.parent(node);
    if (ast.is.IsComputedPropertyName(node) || isOrdinaryPropertyName(node, parent)) {
      record(node, admitName(node, ast.is.IsComputedPropertyName(node) ? select(node)
        : ast.is.IsNumericLiteral(node) ? selectedNumeric(node) : selectedString(ast.text(node))));
    } else if (ast.is.IsElementAccessExpression(node)) {
      const semantics = semanticsFor(node);
      const access = semantics.operations.elementAccess(node);
      if (access !== undefined && access.selectedElementIndex === undefined &&
        (access.selectedSymbol !== undefined || access.selectedDeclaration !== undefined) &&
        !onlyNumericIndexes(node, access.receiver.type, access.argument.type)) {
        const argument = access.argument.expression;
        const type = checkedType(argument);
        if (type !== undefined && typeof semantics.types.numericLiteralValue(type) === "number") {
          const selected = selectedLiteral(argument);
          if (selected.kind === "resolved") {
            const admitted = admitNumericName(selected, String(semantics.types.numericLiteralValue(type)));
            if (admitted.kind === "rejected") record(argument, admitted);
          } else {
            const member = checkedEnumMember(argument);
            const entry = member === undefined ? undefined : enumConstants.get(member);
            if (entry?.kind === "rejected") record(argument, rejected(entry.reason, entry.failure));
          }
        }
      }
    }
  }
  const entriesByFile = new Map(files.map(file => [file.sourceFile, [] as typeof entries]));
  const issuesByFile = new Map(files.map(file => [file.sourceFile, [] as typeof issues]));
  for (const entry of entries) entriesByFile.get(ast.getSourceFile(entry.node)!)!.push(entry);
  for (const issue of issues) issuesByFile.get(ast.getSourceFile(issue.node)!)!.push(issue);
  return Object.freeze(files.map(({ sourceFile }) => {
    const selectedEntries = Object.freeze(entriesByFile.get(sourceFile)!);
    const values = new WeakMap(selectedEntries.map(entry => [entry.node, entry.selection]));
    return Object.freeze({ sourceFile, propertyNames: Object.freeze({
      entries: selectedEntries,
      issues: Object.freeze(issuesByFile.get(sourceFile)!),
      get: (name: Node) => values.get(name),
    }) });
  }));

  function semanticsFor(node: Node): (typeof files)[number]["semantics"] {
    const file = ast.getSourceFile(node);
    const semantics = file === undefined ? undefined : inputs.get(file);
    if (semantics === undefined) throw new Error("Property-name facts require the original checked source-file owner.");
    return semantics;
  }

  function record(node: Node, selection: SourcePropertyNameSelection): void {
    entries.push(Object.freeze({ node, selection }));
    if (selection.kind === "rejected") issues.push(Object.freeze({ node, reason: selection.reason, failure: selection.failure }));
  }

  function admitName(node: Node, selection: SourcePropertyNameSelection): SourcePropertyNameSelection {
    if (selection.kind !== "resolved") return selection;
    const semantics = semanticsFor(node);
    const checked = semantics.operations.propertyName(node);
    if (checked === undefined || checked.kind === "unique-symbol") return rejected(
      "The property key has no completed checked string or numeric member identity.");
    const parent = ast.parent(node);
    const element = parent === undefined ? undefined : semantics.operations.objectLiteralElement(parent);
    if (element?.contextualType !== undefined && element.sourceSelectedSymbol === undefined &&
      element.sourceSelectedDeclarations.length === 0 && onlyNumericIndexes(node, element.contextualType, checked.type)) {
      return Object.freeze({ ...selection, name: checked.name });
    }
    const admitted = admitNumericName(selection, checked.name);
    if (admitted.kind !== "resolved") return admitted;
    return Object.freeze({ ...admitted, name: checked.name });
  }

  function admitNumericName(selection: Extract<SourcePropertyNameSelection, { kind: "resolved" }>, checked: string): SourcePropertyNameSelection {
    const numeric = selection.constant.kind === "numeric" || selection.constant.kind === "enum-member" && typeof selection.constant.entry.value === "bigint";
    return numeric && (selection.name !== String(Number(selection.name)) || selection.name !== checked) ? rejected(
      `Numeric property key ${selection.name} has checker key ${checked}; use the exact string key ${JSON.stringify(selection.name)} instead of a conflicting numeric named member.`) : selection;
  }

  function onlyNumericIndexes(node: Node, owner: Type, key: Type): boolean {
    const semantics = semanticsFor(node);
    const selection = semantics.types.selectIndexedAccess(owner, key);
    return selection?.kind === "resolved" && selection.members.length > 0 && selection.members.every(member =>
      member.kind === "index" && member.index.keyType !== undefined && numberBacked(node, member.index.keyType));
  }

  function numberBacked(node: Node, type: Type): boolean {
    const semantics = semanticsFor(node);
    return semantics.types.isNumberLike(type) || semantics.types.isIntersection(type) &&
      semantics.types.unionOrIntersectionTypes(type).some(part => semantics.types.isNumberLike(part));
  }

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
    const semantics = semanticsFor(name);
    const selection = classify(name);
    if (selection.kind !== "resolved") return selection;
    const expression = (ast.is.IsComputedPropertyName(name) ? ast.as.AsComputedPropertyName(name) : undefined)?.Expression;
    const evidence = expression === undefined ? undefined : facts.get(expression);
    if (evidence?.valid === false) return rejected(
      "A literal type assertion cannot turn an unproven runtime value into an exact static property key.");
    const type = expression === undefined ? undefined : checkedType(expression);
    const numeric = type === undefined ? undefined : semantics.types.numericLiteralValue(type);
    if (typeof numeric === "number" && !Number.isFinite(numeric)) return rejected(
      "The numeric property key exceeds finite native literal bounds.");
    return selection;
  }

  function classify(name: Node): SourcePropertyNameSelection {
    const semantics = semanticsFor(name);
    const expression = unwrap((ast.is.IsComputedPropertyName(name) ? ast.as.AsComputedPropertyName(name) : undefined)?.Expression);
    if (expression === undefined) return unavailable;
    const parent = ast.parent(name);
    const typeOnly = parent !== undefined && (ast.is.IsPropertySignatureDeclaration(parent) ||
      ast.is.IsMethodSignatureDeclaration(parent) || sourceClassFieldIsTypeOnly(ast, parent));
    const symbol = semantics.operations.wellKnownSymbol(name);
    if (symbol !== undefined) {
      return typeOnly || pureReference(expression) ? Object.freeze({ kind: "well-known-symbol", symbol: symbol.kind }) : rejected(
        "A well-known-symbol property key must be a non-effectful reference; calls and getter evaluation cannot be erased.");
    }
    if (typeOnly) {
      const checked = semantics.operations.propertyName(name);
      if (checked?.kind === "unique-symbol") return Object.freeze({ kind: "unique-symbol", type: checked.type });
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
    const semantics = semanticsFor(node);
    const constant = facts.get(node)?.constant;
    if (constant?.kind === "enum-member") return selectedEnum(constant.entry.declaration);
    const member = checkedEnumMember(node);
    if (member !== undefined) return selectedEnum(member);
    if (facts.get(node)?.constant?.kind === "numeric") return selectedNumeric(node);
    const type = checkedType(node);
    if (type === undefined) return rejected("The computed key has no completed checked literal type.");
    const text = semantics.types.stringLiteralValue(type);
    if (text !== undefined) {
      const fact = facts.get(node);
      if (fact?.constant !== undefined && constantName(fact.constant) !== text) {
        return rejected("The const key's exact source value disagrees with its checked literal type.");
      }
      return selectedString(text);
    }
    const value = semantics.types.numericLiteralValue(type);
    if (typeof value !== "number") return rejected("The computed key's checked type is not one exact string or numeric literal.");
    if (!Number.isFinite(value)) return rejected("The numeric property key exceeds finite native literal bounds.");
    return selectedNumeric(node);
  }

  function selectedNumeric(node: Node): SourcePropertyNameSelection {
    const semantics = semanticsFor(node);
    const type = checkedType(node);
    const checked = type === undefined ? undefined : semantics.types.numericLiteralValue(type);
    if (typeof checked === "number" && !Number.isFinite(checked)) return rejected("The numeric property key exceeds finite native literal bounds.");
    const numeric = exactNumeric(node);
    return numeric === undefined ? rejected("The numeric key has no exact authored literal origin corresponding to its checked constant value.")
      : Object.freeze({ kind: "resolved", name: numericName(numeric), constant: Object.freeze({ kind: "numeric", token: numeric }) });
  }

  function selectedString(value: string): SourcePropertyNameSelection {
    return Object.freeze({ kind: "resolved", name: value, constant: Object.freeze({ kind: "string", value }) });
  }

  function selectedEnum(node: Node): SourcePropertyNameSelection {
    const constant = enumConstants.get(node);
    if (constant === undefined) throw new Error("A selected checked enum member requires its completed source constant entry.");
    if (constant.kind === "rejected") return Object.freeze({ kind: "rejected", reason: constant.reason, failure: constant.failure });
    const numeric = typeof constant.value === "bigint" ? numericTokenFromText(constant.value.toString()) : undefined;
    return Object.freeze({ kind: "resolved", name: typeof constant.value === "string" ? constant.value : numericName(numeric!),
      constant: Object.freeze({ kind: "enum-member", entry: constant }) });
  }

  function checkedEnumMember(node: Node): Node | undefined {
    const semantics = semanticsFor(node);
    const current = unwrap(node);
    if (current === undefined) return undefined;
    const declaration = ast.is.IsIdentifier(current) ? navigation.sourceReferenceFor(current)?.declaration
      : ast.is.IsPropertyAccessExpression(current) ? semantics.operations.propertyAccess(current)?.selectedDeclaration
        : ast.is.IsElementAccessExpression(current) ? semantics.operations.elementAccess(current)?.selectedDeclaration : undefined;
    if (declaration !== undefined && ast.is.IsEnumMember(declaration)) return declaration;
    const type = checkedType(current);
    const symbol = type === undefined ? undefined : semantics.declarations.typeSymbol(type);
    const members = symbol === undefined ? [] : semantics.declarations.symbolDeclarations(symbol).filter(
      (candidate): candidate is Node => candidate !== undefined && ast.is.IsEnumMember(candidate));
    return members.length === 1 ? members[0] : undefined;
  }

  function exactNumeric(node: Node): SourceNumericLiteralToken | undefined {
    const fact = facts.get(node);
    const constant = fact?.constant;
    if (constant?.kind === "numeric") return constant.token;
    if (constant?.kind === "enum-member" && typeof constant.entry.value === "bigint") {
      return numericTokenFromText(constant.entry.value.toString());
    }
    return undefined;
  }

  interface KeyFact {
    constant?: SourcePropertyNameConstant;
    elements?: readonly (KeyFact | undefined)[];
    members?: ReadonlyMap<string, KeyFact>;
    readonly contracts: readonly Node[];
    readonly input?: KeyFact;
    readonly owner?: KeyFact;
    readonly declarationOnly: boolean;
    valid: boolean;
  }

  function createFact(input: Omit<KeyFact, "contracts" | "declarationOnly" | "valid"> & {
    readonly contracts?: readonly Node[]; readonly declarationOnly?: boolean; readonly valid?: boolean;
  }): KeyFact {
    const fact: KeyFact = { ...input, contracts: input.contracts ?? [], declarationOnly: input.declarationOnly ?? false,
      valid: input.valid ?? true };
    drafts.push(fact);
    return fact;
  }

  function constantName(constant: SourcePropertyNameConstant): string {
    return constant.kind === "string" ? constant.value : constant.kind === "numeric" ? numericName(constant.token)
      : typeof constant.entry.value === "string" ? constant.entry.value : constant.entry.value.toString();
  }

  function literalFact(node: Node): KeyFact | undefined {
    if (ast.is.IsStringLiteral(node) || ast.is.IsNoSubstitutionTemplateLiteral(node)) {
      return createFact({ constant: Object.freeze({ kind: "string", value: ast.text(node) }) });
    }
    if (!ast.is.IsNumericLiteral(node)) return undefined;
    const token = sourceLiteralToken(ast, node);
    const numeric = token.kind === "authored" ? parseSourceNumericLiteral(token.text)?.token
      : numericTokenFromText(ast.text(node));
    return numeric === undefined ? undefined : createFact({ constant: Object.freeze({ kind: "numeric", token: numeric }) });
  }

  function enumFact(member: Node): KeyFact | undefined {
    const existing = declarations.get(member);
    if (existing !== undefined) return existing;
    const entry = enumConstants.get(member);
    if (entry?.kind !== "resolved") return undefined;
    const fact = createFact({ constant: Object.freeze({ kind: "enum-member", entry }) });
    declarations.set(member, fact);
    return fact;
  }

  function declaredFact(node: Node | undefined, active = new Set<Node>()): KeyFact | undefined {
    if (node === undefined || active.has(node)) return undefined;
    const file = ast.getSourceFile(node);
    if (file === undefined || !inputs.has(file)) return undefined;
    active.add(node);
    try {
      if (ast.is.IsLiteralTypeNode(node)) {
        const literal = ast.as.AsLiteralTypeNode(node)?.Literal;
        return literal === undefined ? undefined : facts.get(literal) ?? literalFact(literal);
      }
      if (ast.is.IsParenthesizedTypeNode(node)) return declaredFact(ast.as.AsParenthesizedTypeNode(node)?.Type, active);
      if (ast.is.IsTypeOperatorNode(node) && ast.operatorKindName(node) === "KindReadonlyKeyword") {
        return declaredFact(ast.as.AsTypeOperatorNode(node)?.Type, active);
      }
      if (ast.is.IsTypeQueryNode(node)) {
        const name = ast.as.AsTypeQueryNode(node)?.ExprName;
        const declaration = name === undefined ? undefined : navigation.sourceReferenceFor(name)?.declaration;
        return declaration === undefined ? undefined : ast.is.IsEnumMember(declaration) ? enumFact(declaration) : declarations.get(declaration);
      }
      if (ast.is.IsTypeReferenceNode(node)) {
        const name = ast.as.AsTypeReferenceNode(node)?.TypeName;
        const declaration = name === undefined ? undefined : navigation.sourceReferenceFor(name)?.declaration;
        const member = declaration !== undefined && ast.is.IsEnumMember(declaration) ? declaration
          : name !== undefined && ast.is.IsQualifiedName(name) ? checkedEnumMember(node) : undefined;
        if (member !== undefined) return enumFact(member);
        return declaration !== undefined && ast.is.IsTypeAliasDeclaration(declaration)
          ? declaredFact(ast.typeNode(declaration), active) : undefined;
      }
      if (ast.is.IsTupleTypeNode(node)) {
        const semantics = semanticsFor(node);
        const type = checkedType(node);
        if (type === undefined || !semantics.types.isTuple(type) ||
          semantics.types.tupleElementInfos(type).some(element => element.elementKind !== "required")) return undefined;
        return createFact({ elements: Object.freeze(ast.elements(node).map(element =>
          element === undefined ? undefined : declaredFact(ast.typeNode(element) ?? element, active))), declarationOnly: true });
      }
      return undefined;
    } finally { active.delete(node); }
  }

  function validateFact(fact: KeyFact): boolean {
    if (validated.has(fact)) return fact.valid;
    if (validating.has(fact)) return false;
    validating.add(fact);
    fact.valid = fact.valid && (fact.input === undefined || validateFact(fact.input)) &&
      (fact.owner === undefined || validateFact(fact.owner));
    for (const node of fact.contracts) {
      const contract = declaredFact(node);
      if (contract === undefined) continue;
      fact.valid = fact.valid && validateFact(contract);
      if (fact.declarationOnly && fact.constant === undefined && fact.elements === undefined && fact.members === undefined) {
        if (contract.constant !== undefined) fact.constant = contract.constant;
        if (contract.elements !== undefined) fact.elements = contract.elements;
        if (contract.members !== undefined) fact.members = contract.members;
      } else fact.valid = fact.valid && contractAgrees(contract, fact);
    }
    validating.delete(fact);
    validated.add(fact);
    return fact.valid;
  }

  function contractAgrees(contract: KeyFact, actual: KeyFact): boolean {
    if (contract.constant !== undefined) return actual.constant !== undefined &&
      constantName(contract.constant) === constantName(actual.constant);
    if (contract.elements !== undefined) return actual.elements !== undefined &&
      contract.elements.length === actual.elements.length && contract.elements.every((element, position) =>
        element === undefined || actual.elements?.[position] !== undefined &&
        validateFact(element) && contractAgrees(element, actual.elements[position]!));
    return true;
  }

  function bindFact(name: Node, declaration: Node, input: KeyFact | undefined): void {
    if (ast.is.IsIdentifier(name)) {
      const annotation = ast.typeNode(declaration);
      const fact = annotation === undefined && input !== undefined ? input : createFact({
        ...(input === undefined ? {} : { ...input, input }),
        contracts: annotation === undefined ? [] : [annotation], declarationOnly: input === undefined });
      facts.set(name, fact);
      declarations.set(declaration, fact);
      return;
    }
    if (!ast.is.IsArrayBindingPattern(name) && !ast.is.IsObjectBindingPattern(name)) return;
    for (const [position, element] of ast.elements(name).entries()) {
      if (element === undefined || !ast.is.IsBindingElement(element)) continue;
      const binding = ast.as.AsBindingElement(element)!;
      const target = ast.name(element);
      if (target === undefined || binding.DotDotDotToken !== undefined) continue;
      const property = binding.PropertyName ?? target;
      const selected = ast.is.IsArrayBindingPattern(name) ? input?.elements?.[position]
        : ast.is.IsIdentifier(property) || ast.is.IsStringLiteral(property) ? input?.members?.get(ast.text(property)) : undefined;
      const value = selected ?? (binding.Initializer === undefined ? undefined : facts.get(binding.Initializer));
      bindFact(target, element, value === undefined ? undefined : createFact({ ...value, input: value,
        ...(input === undefined ? {} : { owner: input }) }));
    }
  }

  function callFact(node: Node): KeyFact | undefined {
    const semantics = semanticsFor(node);
    const call = semantics.operations.call(node);
    const result = call === undefined ? undefined : semantics.operations.callResult(call);
    const authoredType = result?.authoredTypeNode;
    const file = authoredType === undefined ? undefined : ast.getSourceFile(authoredType);
    if (authoredType === undefined || file === undefined || !inputs.has(file)) return undefined;
    const declared = declaredFact(authoredType);
    if (declared !== undefined || call === undefined) return declared;
    const typeName = ast.is.IsTypeReferenceNode(authoredType) ? ast.as.AsTypeReferenceNode(authoredType)?.TypeName : undefined;
    const parameter = typeName === undefined ? undefined : navigation.sourceReferenceFor(typeName)?.declaration;
    if (parameter === undefined || !ast.is.IsTypeParameterDeclaration(parameter)) return undefined;
    const selected = call.sourceSelectedMethodTypeArguments?.find(candidate => {
      const symbol = semantics.declarations.typeSymbol(candidate.typeParameter);
      return symbol !== undefined && semantics.declarations.symbolDeclarations(symbol).includes(parameter);
    });
    const explicit = declaredFact(selected?.explicitTypeNode);
    if (explicit !== undefined) return explicit;
    const argumentExpressions = call.sourceSelectedSignatureParameters.filter(candidate => {
      const name = candidate.authoredTypeNode !== undefined && ast.is.IsTypeReferenceNode(candidate.authoredTypeNode)
        ? ast.as.AsTypeReferenceNode(candidate.authoredTypeNode)?.TypeName : undefined;
      return name !== undefined && navigation.sourceReferenceFor(name)?.declaration === parameter;
    }).flatMap(candidate => call.sourceArgumentBindings.filter(argument =>
      argument.sourceParameterIndex === candidate.parameterIndex).map(argument =>
      call.sourceArguments[argument.sourceArgumentIndex]?.expression));
    const arguments_ = argumentExpressions.map(input => input === undefined ? undefined : facts.get(input));
    const first = arguments_[0];
    return first?.constant !== undefined && arguments_.every(argument => argument?.constant !== undefined &&
      constantName(argument.constant) === constantName(first.constant!)) ? first : undefined;
  }

  function completeFact(node: Node): void {
    const literal = literalFact(node);
    if (literal !== undefined) { facts.set(node, literal); return; }
    if (ast.is.IsEnumMember(node)) {
      const fact = enumFact(node);
      if (fact !== undefined) facts.set(node, fact);
      return;
    }
    if (ast.is.IsVariableDeclaration(node)) {
      const name = ast.name(node);
      const initializer = ast.as.AsVariableDeclaration(node)?.Initializer;
      if (name !== undefined) bindFact(name, node, initializer === undefined ? declaredFact(ast.typeNode(node)) : facts.get(initializer));
      return;
    }
    if (ast.is.IsParameterDeclaration(node)) {
      const name = ast.name(node);
      if (name !== undefined) bindFact(name, node, declaredFact(ast.typeNode(node)));
      return;
    }
    if (ast.is.IsIdentifier(node)) {
      const declaration = navigation.sourceReferenceFor(node)?.declaration;
      const fact = declaration === undefined ? undefined : ast.is.IsEnumMember(declaration) ? enumFact(declaration)
        : declarations.get(declaration) ?? declaredFact(ast.typeNode(declaration));
      if (fact !== undefined) facts.set(node, fact);
      return;
    }
    if (ast.is.IsPropertyAccessExpression(node) || ast.is.IsElementAccessExpression(node)) {
      const member = checkedEnumMember(node);
      const fact = member === undefined ? undefined : enumFact(member);
      if (fact !== undefined) facts.set(node, fact);
      return;
    }
    const wrapper = ast.is.IsParenthesizedExpression(node) ? ast.as.AsParenthesizedExpression(node)
      : ast.is.IsAsExpression(node) ? ast.as.AsAsExpression(node)
      : ast.is.IsTypeAssertion(node) ? ast.as.AsTypeAssertion(node)
      : ast.is.IsSatisfiesExpression(node) ? ast.as.AsSatisfiesExpression(node)
      : ast.is.IsNonNullExpression(node) ? ast.as.AsNonNullExpression(node) : undefined;
    if (wrapper !== undefined) {
      const input = wrapper.Expression === undefined ? undefined : facts.get(wrapper.Expression);
      const annotation = ast.is.IsAsExpression(node) ? ast.as.AsAsExpression(node)?.Type
        : ast.is.IsTypeAssertion(node) ? ast.as.AsTypeAssertion(node)?.Type : undefined;
      facts.set(node, annotation === undefined && input !== undefined ? input : createFact({
        ...(input === undefined ? {} : { ...input, input }), contracts: annotation === undefined ? [] : [annotation],
        declarationOnly: false, valid: input !== undefined }));
      return;
    }
    if (ast.is.IsPrefixUnaryExpression(node)) {
      const expression = ast.as.AsPrefixUnaryExpression(node);
      const input = expression?.Operand === undefined ? undefined : facts.get(expression.Operand);
      const constant = input?.constant;
      const operator = ast.operatorKindName(node);
      if (constant?.kind === "numeric" && (operator === "KindPlusToken" || operator === "KindMinusToken")) {
        facts.set(node, createFact({ constant: Object.freeze({ kind: "numeric", token: operator === "KindPlusToken" ? constant.token
          : Object.freeze({ ...constant.token, negative: !constant.token.negative }) }), input }));
      }
      return;
    }
    if (ast.is.IsBinaryExpression(node)) {
      const value = sourceIntegerConstantValue(ast, node);
      const token = value === undefined ? undefined : numericTokenFromText(value.toString());
      if (token !== undefined) facts.set(node, createFact({ constant: Object.freeze({ kind: "numeric", token }) }));
      return;
    }
    if (ast.is.IsCallExpression(node)) {
      const fact = callFact(node);
      if (fact !== undefined) facts.set(node, fact);
      return;
    }
    if (ast.is.IsArrayLiteralExpression(node)) {
      const semantics = semanticsFor(node);
      const elements: (KeyFact | undefined)[] = [];
      for (const element of ast.elements(node)) {
        if (element !== undefined && ast.is.IsSpreadElement(element)) {
          const expression = ast.as.AsSpreadElement(element)?.Expression;
          const type = expression === undefined ? undefined : checkedType(expression);
          if (type === undefined || !semantics.types.isTuple(type) ||
            semantics.types.tupleElementInfos(type).some(element => element.elementKind !== "required")) return;
          const selected = expression === undefined ? undefined : facts.get(expression)?.elements;
          if (selected === undefined) return;
          elements.push(...selected);
        } else elements.push(element === undefined ? undefined : facts.get(element));
      }
      facts.set(node, createFact({ elements: Object.freeze(elements) }));
      return;
    }
    if (ast.is.IsObjectLiteralExpression(node)) {
      const members = new Map<string, KeyFact>();
      for (const property of ast.properties(node)) {
        if (property === undefined) continue;
        const name = ast.name(property);
        if (name === undefined || !ast.is.IsIdentifier(name) && !ast.is.IsStringLiteral(name)) continue;
        const value = ast.is.IsPropertyAssignment(property) ? ast.as.AsPropertyAssignment(property)?.Initializer
          : ast.is.IsShorthandPropertyAssignment(property) ? name : undefined;
        const fact = value === undefined ? undefined : facts.get(value);
        if (fact !== undefined) members.set(ast.text(name), fact);
      }
      facts.set(node, createFact({ members }));
    }
  }

  function rejected(reason: string, failure: "source" | "resource" = "source"): SourcePropertyNameSelection {
    return Object.freeze({ kind: "rejected", reason, failure });
  }

  function checkedType(node: Node): Type | undefined {
    const cached = checkedTypes.get(node);
    if (cached !== undefined) return cached ?? undefined;
    const type = semanticsFor(node).types.expressionType(node);
    checkedTypes.set(node, type ?? null);
    return type;
  }

  function constBinding(declaration: Node): boolean {
    let current: Node | undefined = declaration;
    while (current !== undefined && ast.is.IsBindingElement(current)) {
      const pattern = ast.parent(current);
      current = pattern === undefined ? undefined : ast.parent(pattern);
    }
    return current !== undefined && ast.is.IsVariableDeclaration(current) && ast.variableDeclarationKind(current) === "const";
  }

  function pureReference(node: Node): boolean {
    const semantics = semanticsFor(node);
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
  const coefficient = token.coefficient.toString();
  const digits = coefficient.replace(/0+$/u, "");
  const point = BigInt(coefficient.length) + token.exponent;
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
