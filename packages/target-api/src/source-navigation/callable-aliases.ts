import type { Node, ResolvedSourcePropertyAccessInfo } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../source-semantics/types.js";
import { sourceMayReadBeforeInitialization } from "./initialization-uses.js";

export interface SourceCallOnlyAlias {
  readonly expression: Node;
  readonly selectedDeclaration: Node;
  readonly property?: ResolvedSourcePropertyAccessInfo;
  readonly declarations: readonly Node[];
  readonly calls: readonly Node[];
}

export function createSourceCallOnlyAliasQuery(source: TargetSourceProgram):
  (declaration: Node) => SourceCallOnlyAlias | undefined {
  const { ast, navigation } = source;
  const cache = new WeakMap<Node, SourceCallOnlyAlias | null>();
  const unwrap = (node: Node | undefined): Node | undefined => {
    for (let depth = 0; node !== undefined && depth < 256; depth += 1) {
      if (ast.is.IsParenthesizedExpression(node)) node = ast.as.AsParenthesizedExpression(node)?.Expression;
      else if (ast.is.IsSatisfiesExpression(node)) node = ast.as.AsSatisfiesExpression(node)?.Expression;
      else return node;
    }
    return undefined;
  };
  const initializer = (node: Node | undefined): Node | undefined =>
    node !== undefined && ast.is.IsVariableDeclaration(node) &&
      ast.variableDeclarationKind(node) === "const" && ast.is.IsIdentifier(ast.name(node))
      ? unwrap(ast.as.AsVariableDeclaration(node)?.Initializer) : undefined;
  const select = (declaration: Node): SourceCallOnlyAlias | undefined => {
    const cached = cache.get(declaration);
    if (cached !== undefined) return cached ?? undefined;
    cache.set(declaration, null);
    let expression = initializer(declaration);
    const visited = new Set<Node>([declaration]);
    while (expression !== undefined && ast.is.IsIdentifier(expression)) {
      const origin = navigation.sourceReferenceFor(expression)?.declaration;
      const value = initializer(origin);
      if (value === undefined) break;
      if (origin === undefined || visited.has(origin) || visited.size >= 1_024) return undefined;
      visited.add(origin);
      expression = value;
    }
    if (expression === undefined || !ast.is.IsIdentifier(expression) && !ast.is.IsPropertyAccessExpression(expression)) return undefined;
    const semantics = source.semantics.forNode(expression);
    const property = ast.is.IsPropertyAccessExpression(expression)
      ? semantics.operations.propertyAccess(expression) : undefined;
    const reference = navigation.sourceReferenceFor(expression);
    const selectedDeclaration = property?.selectedDeclaration ?? reference?.declaration;
    if (selectedDeclaration === undefined || property?.optionalChain ||
      !ast.is.IsFunctionDeclaration(selectedDeclaration) &&
      !ast.is.IsMethodDeclaration(selectedDeclaration) &&
      ast.kindName(selectedDeclaration) !== "KindMethodSignature") return undefined;
    if (property !== undefined && (!ast.is.IsIdentifier(property.receiver.expression) ||
      navigation.sourceReferenceFor(property.receiver.expression)?.declaration !== property.receiver.declaration)) return undefined;
    const flow = navigation.expressionValueFlow(expression);
    if (flow.aliasDeclarations.length === 0 || flow.aliasDeclarations.length > 1_024 ||
      flow.uses.length > 131_072 || flow.memberWritten || flow.receiverUsed ||
      flow.identityCompared || flow.returned || flow.yielded || flow.passedAsArgument ||
      flow.storedOutsideBinding || flow.exported || flow.hasUnclassifiedUse) return undefined;
    const aliases = new Set(flow.aliasDeclarations);
    for (const alias of aliases) {
      const value = initializer(alias);
      const previous = value === undefined ? undefined : navigation.sourceReferenceFor(value)?.declaration;
      if (value === undefined || navigation.declarationUseSummary(alias).bindingWritten ||
        sourceMayReadBeforeInitialization(alias, ast, navigation) ||
        value !== expression && (!ast.is.IsIdentifier(value) || previous === undefined || !aliases.has(previous))) return undefined;
    }
    const symbol = property?.selectedSymbol ?? reference?.symbol;
    const declarations = symbol === undefined ? [selectedDeclaration] : semantics.declarations.symbolDeclarations(symbol);
    if (declarations.length > 1_024) return undefined;
    const overloads = new Set(declarations);
    const calls = new Set<Node>();
    for (const use of flow.uses) {
      if (use.kind === "type-only" || use.role === "storage") continue;
      if (use.role !== "call-target") return undefined;
      let callee = use.reference;
      let call = ast.parent(callee);
      for (let depth = 0; call !== undefined && unwrap(call) === unwrap(callee) && depth < 256; depth += 1) {
        callee = call;
        call = ast.parent(callee);
      }
      if (call === undefined || !ast.is.IsCallExpression(call) || ast.as.AsCallExpression(call)?.Expression !== callee) return undefined;
      const callSemantics = source.semantics.forNode(call);
      const selected = callSemantics.operations.call(call);
      const target = selected === undefined ? undefined : callSemantics.declarations.signatureDeclaration(selected.selectedSignature);
      if (target === undefined || !overloads.has(target)) return undefined;
      calls.add(call);
    }
    const result: SourceCallOnlyAlias = Object.freeze({
      expression, selectedDeclaration, ...(property === undefined ? {} : { property }),
      declarations: Object.freeze([...aliases]), calls: Object.freeze([...calls]),
    });
    for (const alias of aliases) cache.set(alias, result);
    return result;
  };
  return select;
}
