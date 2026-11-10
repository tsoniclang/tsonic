import type { Node } from "@tsonic/tsts";
import type { SourceApplication, SourceArgumentPlace, SourceAuthoredArgument, SourcePresence, SourceResult } from "../public/source/contracts.js";
import type { SourceNavigationQueryContext } from "./query-context.js";

export interface SourceCallArgumentCorrespondence {
  readonly bindingIndex: number;
  readonly binding: SourceArgumentPlace;
  readonly argument: SourceAuthoredArgument;
  readonly parameter: SourceArgumentPlace["parameter"];
}

export function sourceCallArgumentCorrespondences(source: SourceNavigationQueryContext,
  application: SourceApplication): SourceResult<readonly SourceCallArgumentCorrespondence[]> {
  if (!source.facts.navigation.includes(application.identity.invocation))
    throw new Error("Source argument correspondence requires its original invocation.");
  const original = source.facts.applications.application(application.identity.invocation);
  if (original.kind === "refused") return original;
  if (original.value !== application) throw new Error("Source argument correspondence requires its exact published application.");
  if (application.kind !== "call" && application.kind !== "construct" && application.kind !== "function-value")
    throw new Error("A Source argument correspondence requires its original selected application kind.");
  const authored = source.ast.arguments(application.identity.invocation);
  if (authored.length !== application.sourceArguments.length ||
    application.sourceArguments.some((argument, index) => argument.occurrence !== authored[index]))
    throw new Error("A Source application must retain its complete original evaluation vector.");
  const indexes = new Set<number>();
  const result: SourceCallArgumentCorrespondence[] = [];
  for (const [bindingIndex, binding] of application.arguments.entries()) {
    const argument = application.sourceArguments[binding.sourceArgumentIndex];
    const formal = binding.destination.declaration.origin;
    if (!Number.isSafeInteger(binding.effectiveArgumentIndex) || binding.effectiveArgumentIndex < 0 ||
      indexes.has(binding.effectiveArgumentIndex) || argument === undefined || argument.occurrence !== binding.sourceArgument ||
      !Number.isSafeInteger(binding.parameter.index) || binding.parameter.index < 0 ||
      binding.parameter.signature !== application.identity.signature ||
      formal.kind !== "parameter" || formal.signature !== binding.parameter.signature ||
      formal.index !== binding.parameter.index || formal.declaration !== binding.parameter.declaration ||
      binding.destination.application?.kind !== "call" || binding.destination.application.identity !== application.identity ||
      (binding.sourceForm === "value") !== (argument.form === "value") ||
      binding.sourceForm === "value" && binding.spreadElementIndex !== undefined ||
      binding.sourceForm === "spread-element" && (!Number.isSafeInteger(binding.spreadElementIndex) || binding.spreadElementIndex! < 0))
      throw new Error("A Source argument binding must retain its exact original argument, formal and spread occurrence.");
    source.facts.descriptors.assertEvidence(binding.source);
    source.facts.descriptors.assertEvidence(binding.destination.applied);
    if (argument.operand.kind === "refused") return argument.operand;
    indexes.add(binding.effectiveArgumentIndex);
    result.push(Object.freeze({ bindingIndex, binding, argument, parameter: binding.parameter }));
  }
  return Object.freeze({ kind: "resolved", value: Object.freeze(result) });
}

export function sourceSingleCallValueArgument(correspondence: readonly SourceCallArgumentCorrespondence[],
  declaration: Node): SourcePresence<Node> {
  const selected = correspondence.filter(row => row.parameter.declaration === declaration && row.binding.sourceForm === "value");
  if (selected.length !== 1) return Object.freeze({ kind: "none" });
  const operand = selected[0]!.argument.operand;
  if (operand.kind !== "resolved") throw new Error("An effective Source argument correspondence requires its produced original operand.");
  return Object.freeze({ kind: "present", value: operand.value.occurrence });
}

export interface SourceClosedCallableArgument {
  readonly call: Node;
  readonly argument: Node;
  readonly argumentIndex: number;
}

export function sourceExpressionCallArgument(reference: Node,
  source: SourceNavigationQueryContext): SourceResult<SourcePresence<SourceClosedCallableArgument>> {
  const { ast } = source;
  if (!source.facts.navigation.includes(reference)) throw new Error("Source arguments require their original reference.");
  const none = Object.freeze({ kind: "resolved", value: Object.freeze({ kind: "none" }) } as const);
  let argument = reference;
  let parent = ast.parent(argument);
  const visited = new Set<Node>();
  while (parent !== undefined && !visited.has(parent)) {
    visited.add(parent);
    const expression = ast.is.IsParenthesizedExpression(parent) ? ast.as.AsParenthesizedExpression(parent)?.Expression
      : ast.is.IsSatisfiesExpression(parent) ? ast.as.AsSatisfiesExpression(parent)?.Expression : undefined;
    if (expression === undefined) break;
    if (visited.size > 256) return none;
    if (expression !== argument) return none;
    argument = parent;
    parent = ast.parent(argument);
  }
  if (parent === undefined || !ast.is.IsCallExpression(parent) && !ast.is.IsNewExpression(parent)) return none;
  if (ast.is.IsCallExpression(parent) && ast.as.AsCallExpression(parent)?.QuestionDotToken !== undefined) return none;
  if (ast.arguments(parent).filter(original => original === argument).length !== 1) return none;
  const application = source.facts.applications.application(parent);
  if (application === undefined) throw new Error("A Source argument question requires its original published application result.");
  if (application.kind === "refused") return application;
  if (application.value?.identity === undefined || application.value.identity.invocation !== parent)
    throw new Error("A Source argument question requires its exact original invocation.");
  const correspondence = sourceCallArgumentCorrespondences(source, application.value);
  if (correspondence.kind === "refused") return correspondence;
  const arguments_ = application.value.sourceArguments;
  const matches = arguments_.map((value, index) => ({ value, index })).filter(value => value.value.occurrence === argument);
  if (matches.length !== 1 || matches[0]!.value.form !== "value") return none;
  return Object.freeze({ kind: "resolved", value: Object.freeze({ kind: "present",
    value: Object.freeze({ call: parent, argument, argumentIndex: matches[0]!.index }) }) });
}
