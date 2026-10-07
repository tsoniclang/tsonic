import type { AstReader, Node, ResolvedSourcePropertyAccessInfo, ResolvedSourceElementAccessInfo } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../source-semantics/types.js";
import { sourceMayReadBeforeInitialization } from "./initialization-uses.js";

export interface SourceCallableValue {
  readonly expression: Node;
  readonly selectedDeclaration: Node;
  readonly property?: ResolvedSourcePropertyAccessInfo;
  readonly element?: ResolvedSourceElementAccessInfo;
  readonly receiverDeclaration?: Node;
  readonly aliases: readonly Node[];
}

export function sourceCallableValueExpression(ast: AstReader, node: Node | undefined): Node | undefined {
  for (let depth = 0; node !== undefined && depth < 256; depth += 1) {
    if (ast.is.IsParenthesizedExpression(node)) node = ast.as.AsParenthesizedExpression(node)?.Expression;
    else if (ast.is.IsSatisfiesExpression(node)) node = ast.as.AsSatisfiesExpression(node)?.Expression;
    else return node;
  }
  return undefined;
}

export function createSourceCallableValueQuery(source: TargetSourceProgram):
  (expression: Node) => SourceCallableValue | undefined {
  const { ast, navigation } = source;
  const cache = new WeakMap<Node, SourceCallableValue | null>();
  const member = (node: Node): boolean => ast.is.IsPropertyAccessExpression(node) || ast.is.IsElementAccessExpression(node);
  const receiverCache = new WeakMap<Node, boolean>();
  const receiverUnchanged = (declaration: Node): boolean => {
    const cached = receiverCache.get(declaration);
    if (cached !== undefined) return cached;
    const pending = [declaration];
    const visited = new Set<Node>();
    let remaining = 131_072;
    let unchanged = true;
    for (let index = 0; unchanged && index < pending.length; index += 1) {
      if (--remaining < 0 || visited.size >= 1_024) { unchanged = false; break; }
      const current = pending[index]!;
      if (visited.has(current)) continue;
      visited.add(current);
      const summary = navigation.declarationUseSummary(current);
      if (summary.bindingWritten || summary.memberWritten || current !== declaration && summary.exported) {
        unchanged = false;
        break;
      }
      for (const use of summary.uses) {
        if (--remaining < 0) { unchanged = false; break; }
        if (use.throughMember || use.role === "type-only" || use.role === "source-linkage" ||
          use.role === "call-target" || use.role === "comparison" || use.role === "condition") continue;
        if (use.role !== "storage") { unchanged = false; break; }
        const flow = navigation.expressionValueFlow(use.reference);
        if (flow.storedOutsideBinding || flow.passedAsArgument || flow.returned || flow.yielded ||
          flow.exported || flow.hasUnclassifiedUse || flow.memberWritten || flow.aliasDeclarations.length === 0) {
          unchanged = false;
          break;
        }
        for (const alias of flow.aliasDeclarations) {
          if (--remaining < 0) { unchanged = false; break; }
          pending.push(alias);
        }
      }
    }
    receiverCache.set(declaration, unchanged);
    return unchanged;
  };
  const select = (input: Node): SourceCallableValue | undefined => {
    const cached = cache.get(input);
    if (cached !== undefined) return cached ?? undefined;
    cache.set(input, null);
    const aliases = new Set<Node>();
    const visited = new Set<Node>();
    const resolve = (inputExpression: Node, depth: number): SourceCallableValue | undefined => {
      if (depth >= 256) return undefined;
      let expression = sourceCallableValueExpression(ast, inputExpression);
      while (expression !== undefined && ast.is.IsIdentifier(expression)) {
        const declaration = navigation.sourceReferenceFor(expression)?.declaration;
        if (declaration === undefined || navigation.declarationUseSummary(declaration).bindingWritten) return undefined;
        const initializer = ast.is.IsVariableDeclaration(declaration)
          ? ast.as.AsVariableDeclaration(declaration)?.Initializer : undefined;
        if (initializer === undefined) return {
          expression, selectedDeclaration: declaration, aliases: Object.freeze([...aliases]),
        };
        if (ast.variableDeclarationKind(declaration) !== "const" || !ast.is.IsIdentifier(ast.name(declaration)) ||
          visited.has(declaration) || visited.size >= 1_024 ||
          sourceMayReadBeforeInitialization(declaration, ast, navigation)) return undefined;
        visited.add(declaration);
        aliases.add(declaration);
        expression = sourceCallableValueExpression(ast, initializer);
      }
      if (expression === undefined || !member(expression)) return undefined;
      const operations = source.semantics.forNode(expression).operations;
      const property = ast.is.IsPropertyAccessExpression(expression) ? operations.propertyAccess(expression) : undefined;
      const element = ast.is.IsElementAccessExpression(expression) ? operations.elementAccess(expression) : undefined;
      const access = property ?? element;
      const declaration = access?.selectedDeclaration;
      if (access === undefined || access.optionalChain || declaration === undefined ||
        ast.is.IsGetAccessorDeclaration(declaration) || ast.is.IsSetAccessorDeclaration(declaration) ||
        navigation.expressionValueFlow(expression).memberWritten) return undefined;
      const receiver = resolve(access.receiver.expression, depth + 1);
      if (receiver === undefined || !receiverUnchanged(receiver.selectedDeclaration)) return undefined;
      const references = navigation.referencesToDeclaration(declaration);
      if (references.length > 131_072) return undefined;
      for (const reference of references) {
        const parent = ast.parent(reference);
        const access = member(reference) ? reference : parent !== undefined && member(parent) ? parent : undefined;
        const operations = access === undefined ? undefined : source.semantics.forNode(access).operations;
        const selectedAccess = access === undefined ? undefined : ast.is.IsPropertyAccessExpression(access)
          ? operations?.propertyAccess(access) : operations?.elementAccess(access);
        if (selectedAccess === undefined || selectedAccess.accessMode === "read") continue;
        return undefined;
      }
      return { expression, selectedDeclaration: declaration,
        ...(property === undefined ? {} : { property }), ...(element === undefined ? {} : { element }),
        receiverDeclaration: receiver.selectedDeclaration, aliases: Object.freeze([...aliases]) };
    };
    const selected = resolve(input, 0);
    const result = selected === undefined ? undefined : Object.freeze(selected);
    cache.set(input, result ?? null);
    return result;
  };
  return select;
}
