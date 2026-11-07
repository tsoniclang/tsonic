import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceNavigationQueryContext } from "./query-context.js";
import type { SourceNavigationMemberAccess } from "./types.js";
import { sourceMayReadBeforeInitialization } from "./initialization-uses.js";
import { Node_Expression } from "./ast.js";
import { failTargetCompilerResourceLimit } from "../artifacts.js";

export interface SourceCallableValue {
  readonly expression: Node;
  readonly selectedDeclaration: Node;
  /** The member selection of a property or element access value (host-input witness). */
  readonly access?: SourceNavigationMemberAccess;
  readonly receiverDeclaration?: Node;
  readonly aliases: readonly Node[];
}

interface SourceCallableValueOptions {
  readonly typeAssertions?: "transparent";
  readonly stopAtDeclaration?: Node;
}

export function sourceCallableValueExpression(
  ast: AstReader,
  node: Node | undefined,
  options: SourceCallableValueOptions = {},
): Node | undefined {
  const subject = node;
  for (let depth = 0; node !== undefined && depth < 256; depth += 1) {
    if (ast.is.IsParenthesizedExpression(node)) node = ast.as.AsParenthesizedExpression(node)?.Expression;
    else if (ast.is.IsSatisfiesExpression(node)) node = ast.as.AsSatisfiesExpression(node)?.Expression;
    else if (options.typeAssertions === "transparent" &&
      (ast.is.IsAsExpression(node) || ast.is.IsNonNullExpression(node) || ast.is.IsTypeAssertion(node))) node = Node_Expression(ast, node);
    else return node;
  }
  if (node !== undefined) failTargetCompilerResourceLimit("tsonic", "Callable value expression", "depth", 256, subject);
  return undefined;
}

export function createSourceCallableValueQuery(source: SourceNavigationQueryContext, options: SourceCallableValueOptions = {}):
  (expression: Node) => SourceCallableValue | undefined {
  const { ast, navigation } = source;
  const expressionOptions = Object.freeze({ typeAssertions: options.typeAssertions });
  const stopAtDeclaration = options.stopAtDeclaration;
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
      if (--remaining < 0) failTargetCompilerResourceLimit("tsonic", "Callable receiver analysis", "steps", 131_072, declaration);
      if (visited.size >= 1_024) failTargetCompilerResourceLimit("tsonic", "Callable receiver analysis", "declarations", 1_024, declaration);
      const current = pending[index]!;
      if (visited.has(current)) continue;
      visited.add(current);
      const summary = navigation.declarationUseSummary(current);
      if (summary.bindingWritten || summary.memberWritten || current !== declaration && summary.exported) {
        unchanged = false;
        break;
      }
      for (const use of summary.uses) {
        if (--remaining < 0) failTargetCompilerResourceLimit("tsonic", "Callable receiver analysis", "steps", 131_072, declaration);
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
          if (--remaining < 0) failTargetCompilerResourceLimit("tsonic", "Callable receiver analysis", "steps", 131_072, declaration);
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
      if (depth >= 256) failTargetCompilerResourceLimit("tsonic", "Callable value selection", "depth", 256, inputExpression);
      let expression = sourceCallableValueExpression(ast, inputExpression, expressionOptions);
      while (expression !== undefined && ast.is.IsIdentifier(expression)) {
        const declaration = navigation.sourceReferenceFor(expression)?.declaration;
        if (declaration === undefined || navigation.declarationUseSummary(declaration).bindingWritten) return undefined;
        if (declaration === stopAtDeclaration) return {
          expression, selectedDeclaration: declaration, aliases: Object.freeze([...aliases]),
        };
        const initializer = ast.is.IsVariableDeclaration(declaration)
          ? ast.as.AsVariableDeclaration(declaration)?.Initializer : undefined;
        if (initializer === undefined) return {
          expression, selectedDeclaration: declaration, aliases: Object.freeze([...aliases]),
        };
        if (ast.variableDeclarationKind(declaration) !== "const" || !ast.is.IsIdentifier(ast.name(declaration)) ||
          visited.has(declaration) ||
          sourceMayReadBeforeInitialization(declaration, ast, navigation)) return undefined;
        if (visited.size >= 1_024) failTargetCompilerResourceLimit("tsonic", "Callable value aliases", "declarations", 1_024, inputExpression);
        visited.add(declaration);
        aliases.add(declaration);
        expression = sourceCallableValueExpression(ast, initializer, expressionOptions);
      }
      if (expression === undefined || !member(expression)) return undefined;
      const access = navigation.memberAccess(expression);
      const declaration = access?.declaration;
      if (access === undefined || access.optionalChain || declaration === undefined ||
        ast.is.IsGetAccessorDeclaration(declaration) || ast.is.IsSetAccessorDeclaration(declaration) ||
        navigation.expressionValueFlow(expression).memberWritten) return undefined;
      const receiver = resolve(access.receiver, depth + 1);
      if (receiver === undefined || !receiverUnchanged(receiver.selectedDeclaration)) return undefined;
      const references = navigation.referencesToDeclaration(declaration);
      if (references.length > 131_072) failTargetCompilerResourceLimit("tsonic", "Callable member references", "references", 131_072, expression);
      for (const reference of references) {
        const parent = ast.parent(reference);
        const access = member(reference) ? reference : parent !== undefined && member(parent) ? parent : undefined;
        const selectedAccess = access === undefined ? undefined : navigation.memberAccess(access);
        if (selectedAccess === undefined || selectedAccess.accessMode === "read") continue;
        return undefined;
      }
      return { expression, selectedDeclaration: declaration,
        access,
        receiverDeclaration: receiver.selectedDeclaration, aliases: Object.freeze([...aliases]) };
    };
    let selected: SourceCallableValue | undefined;
    try { selected = resolve(input, 0); }
    catch (failure) { cache.delete(input); throw failure; }
    const result = selected === undefined ? undefined : Object.freeze(selected);
    cache.set(input, result ?? null);
    return result;
  };
  return select;
}
