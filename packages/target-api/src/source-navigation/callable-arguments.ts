import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceNavigationCallBinding, SourceNavigationSignatureParameter, SourceProgramNavigation } from "./types.js";

interface SourceCallArgumentContext {
  readonly ast: AstReader;
  readonly navigation: Pick<SourceProgramNavigation, "call">;
}

export interface SourceCallArgumentCorrespondence {
  readonly bindingIndex: number;
  readonly binding: SourceNavigationCallBinding;
  readonly argument: { readonly expression: Node };
  readonly parameter: SourceNavigationSignatureParameter;
}

/** Argument-to-parameter rows of the call host-input selected at `call`; undefined for an untyped or unselected call. */
export function sourceCallArgumentCorrespondences(
  context: SourceCallArgumentContext,
  call: Node,
): readonly SourceCallArgumentCorrespondence[] | undefined {
  const selected = context.navigation.call(call);
  if (selected === undefined || selected.selection !== "resolved") return undefined;
  const { ast } = context;
  const arguments_ = ast.arguments(selected.call);
  if (arguments_.length !== selected.arguments.length ||
    selected.arguments.some((argument, index) => argument !== arguments_[index]))
    throw new Error("A checked call argument vector must preserve its original source expressions.");
  const effectiveIndexes = new Set<number>();
  const result: SourceCallArgumentCorrespondence[] = [];
  for (const [bindingIndex, binding] of selected.bindings.entries()) {
    if (!Number.isSafeInteger(binding.sourceArgumentIndex) || binding.sourceArgumentIndex < 0 ||
      !Number.isSafeInteger(binding.effectiveArgumentIndex) || binding.effectiveArgumentIndex < 0 ||
      !Number.isSafeInteger(binding.sourceParameterIndex) || binding.sourceParameterIndex < 0 ||
      effectiveIndexes.has(binding.effectiveArgumentIndex))
      throw new Error("A checked call binding must have valid, distinct effective argument indexes and selected formal indexes.");
    const expression = selected.arguments[binding.sourceArgumentIndex];
    const parameter = selected.parameters[binding.sourceParameterIndex];
    if (expression === undefined || parameter?.parameterIndex !== binding.sourceParameterIndex ||
      (binding.sourceForm === "spread-element"
        ? !Number.isSafeInteger(binding.spreadElementIndex) || binding.spreadElementIndex! < 0
        : binding.spreadElementIndex !== undefined))
      throw new Error("A checked call binding must preserve its exact argument, formal and spread-element correspondence.");
    effectiveIndexes.add(binding.effectiveArgumentIndex);
    result.push(Object.freeze({ bindingIndex, binding, argument: Object.freeze({ expression }), parameter }));
  }
  return Object.freeze(result);
}

export function sourceSingleCallValueArgument(
  correspondence: readonly SourceCallArgumentCorrespondence[] | undefined,
  declaration: Node,
): Node | undefined {
  const bindings = correspondence?.filter(row => row.parameter.parameterDeclaration === declaration &&
    row.binding.sourceForm === "value");
  return bindings?.length === 1 ? bindings[0]!.argument.expression : undefined;
}

export interface SourceClosedCallableArgument {
  readonly call: Node;
  readonly argument: Node;
  readonly argumentIndex: number;
}

export function sourceExpressionCallArgument(
  reference: Node,
  source: SourceCallArgumentContext,
): SourceClosedCallableArgument | undefined {
  const { ast } = source;
  let argument = reference;
  let parent = ast.parent(argument);
  for (let depth = 0; parent !== undefined && depth < 256; depth += 1) {
    const expression = ast.is.IsParenthesizedExpression(parent) ? ast.as.AsParenthesizedExpression(parent)?.Expression
      : ast.is.IsSatisfiesExpression(parent) ? ast.as.AsSatisfiesExpression(parent)?.Expression : undefined;
    if (expression === undefined) break;
    if (expression !== argument) return undefined;
    argument = parent;
    parent = ast.parent(argument);
  }
  if (parent === undefined || !ast.is.IsCallExpression(parent) && !ast.is.IsNewExpression(parent)) return undefined;
  if (ast.is.IsCallExpression(parent)) {
    const call = ast.as.AsCallExpression(parent);
    if (call === undefined || call.QuestionDotToken !== undefined) return undefined;
  }
  const arguments_ = ast.arguments(parent);
  const argumentIndex = arguments_.indexOf(argument);
  if (argumentIndex < 0 || arguments_.filter(node => node === argument).length !== 1 ||
    ast.is.IsSpreadElement(argument)) return undefined;
  if (source.navigation.call(parent)?.arguments[argumentIndex] !== argument) return undefined;
  return Object.freeze({ call: parent, argument, argumentIndex });
}
