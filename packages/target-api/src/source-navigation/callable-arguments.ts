import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../source-semantics/types.js";
import { sourceMayReadBeforeInitialization } from "./initialization-uses.js";

export interface SourceClosedCallableArgument {
  readonly call: Node;
  readonly argument: Node;
  readonly argumentIndex: number;
}

export function sourceClosedCallableArguments(
  expression: Node,
  source: TargetSourceProgram,
): readonly SourceClosedCallableArgument[] | undefined {
  const { ast, navigation } = source;
  if (!ast.is.IsArrowFunction(expression) && !ast.is.IsFunctionExpression(expression) ||
    ast.is.IsFunctionExpression(expression) && ast.name(expression) !== undefined) return undefined;
  const flow = navigation.expressionValueFlow(expression);
  if (flow.aliasDeclarations.length === 0 || flow.aliasDeclarations.length > 1_024 ||
    flow.uses.length > 131_072 || flow.memberWritten || flow.receiverUsed ||
    flow.identityCompared || flow.returned || flow.yielded || flow.storedOutsideBinding ||
    flow.exported || flow.hasUnclassifiedUse) return undefined;
  const aliases = new Set(flow.aliasDeclarations);
  for (const declaration of aliases) {
    if (!ast.is.IsVariableDeclaration(declaration) ||
      ast.variableDeclarationKind(declaration) !== "const" ||
      !ast.is.IsIdentifier(ast.name(declaration)) ||
      ast.typeNode(declaration) !== undefined ||
      navigation.declarationUseSummary(declaration).bindingWritten ||
      sourceMayReadBeforeInitialization(declaration, ast, navigation)) return undefined;
    const initializer = unwrap(ast.as.AsVariableDeclaration(declaration)?.Initializer);
    const origin = initializer === undefined ? undefined : navigation.sourceReferenceFor(initializer)?.declaration;
    if (initializer !== expression &&
      (initializer === undefined || !ast.is.IsIdentifier(initializer) ||
        origin === undefined || !aliases.has(origin))) return undefined;
  }
  const result: SourceClosedCallableArgument[] = [];
  const seen = new Set<Node>();
  for (const use of flow.uses) {
    if (use.kind === "type-only" || use.role === "storage") continue;
    if (use.role !== "argument" || use.throughMember) return undefined;
    let argument = use.reference;
    let parent = ast.parent(argument);
    for (let depth = 0; parent !== undefined && unwrap(parent) === unwrap(argument) && depth < 256; depth += 1) {
      argument = parent;
      parent = ast.parent(argument);
    }
    if (parent === undefined || !ast.is.IsCallExpression(parent)) return undefined;
    const call = ast.as.AsCallExpression(parent);
    if (call === undefined || call.QuestionDotToken !== undefined) return undefined;
    const arguments_ = ast.arguments(parent);
    const argumentIndex = arguments_.indexOf(argument);
    if (argumentIndex < 0 || arguments_.filter(node => node === argument).length !== 1 ||
      ast.is.IsSpreadElement(argument) || seen.has(argument)) return undefined;
    const semantics = source.semantics.forNode(parent);
    const checked = semantics.operations.call(parent);
    if (checked?.sourceArguments[argumentIndex]?.expression !== argument) return undefined;
    seen.add(argument);
    result.push(Object.freeze({ call: parent, argument, argumentIndex }));
  }
  return result.length === 0 ? undefined : Object.freeze(result);

  function unwrap(node: Node | undefined): Node | undefined {
    for (let depth = 0; node !== undefined && depth < 256; depth += 1) {
      if (ast.is.IsParenthesizedExpression(node)) node = ast.as.AsParenthesizedExpression(node)?.Expression;
      else if (ast.is.IsSatisfiesExpression(node)) node = ast.as.AsSatisfiesExpression(node)?.Expression;
      else return node;
    }
    return undefined;
  }
}
