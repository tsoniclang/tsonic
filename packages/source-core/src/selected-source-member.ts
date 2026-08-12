import type {
  ExtensionFactSubject,
  Node,
} from "@tsonic/tsts";
import type {
  TsonicSourceFileAnalysisContext,
} from "./source-analysis-context.js";
import type {
  SelectedProviderSourceCall,
} from "./source-call-analysis.js";

export type SelectedInlineSourceMemberResult =
  | {
      readonly kind: "selected";
      readonly expression: ExtensionFactSubject;
      readonly selectedMember: ExtensionFactSubject;
      readonly selectedDeclaration?: Node;
    }
  | {
      readonly kind: "rejected";
      readonly reason: "function-shape" | "receiver" | "member-evidence";
    };

export function selectInlineSourceMember(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileAnalysisContext,
): SelectedInlineSourceMemberResult {
  const inlineFunction = selected.selection.sourceArguments[0]?.expression;
  if (
    inlineFunction === undefined ||
    (!context.ast.is.IsArrowFunction(inlineFunction) &&
      !context.ast.is.IsFunctionExpression(inlineFunction))
  ) {
    return { kind: "rejected", reason: "function-shape" };
  }
  const parameters = context.ast.parameters(inlineFunction);
  const parameter = parameters.length === 1 ? parameters[0] : undefined;
  const parameterName = parameter === undefined ? undefined : context.ast.name(parameter);
  const parameterSymbol = context.checker.getSymbolAtLocation(parameterName);
  const returned = singleReturnedExpression(inlineFunction, context);
  if (
    parameter === undefined ||
    parameterSymbol === undefined ||
    returned === undefined ||
    !context.ast.is.IsPropertyAccessExpression(returned)
  ) {
    return { kind: "rejected", reason: "function-shape" };
  }
  const property = context.checker.getResolvedPropertyAccessInfo(returned);
  if (
    property === undefined ||
    property.accessMode !== "read" ||
    property.callCallee ||
    !selectedReceiverMatchesParameter(
      property.receiver,
      parameter,
      parameterSymbol,
    )
  ) {
    return { kind: "rejected", reason: "receiver" };
  }
  const selectedMember = property.selectedDeclaration ?? property.selectedSymbol;
  if (selectedMember === undefined) {
    return { kind: "rejected", reason: "member-evidence" };
  }
  return {
    kind: "selected",
    expression: property.expression,
    selectedMember,
    ...(property.selectedDeclaration === undefined
      ? {}
      : { selectedDeclaration: property.selectedDeclaration }),
  };
}

function selectedReceiverMatchesParameter(
  receiver: {
    readonly symbol?: ExtensionFactSubject;
    readonly declaration?: ExtensionFactSubject;
  },
  parameter: ExtensionFactSubject,
  parameterSymbol: ExtensionFactSubject,
): boolean {
  return receiver.symbol === parameterSymbol || receiver.declaration === parameter;
}

function singleReturnedExpression(
  inlineFunction: Node,
  context: TsonicSourceFileAnalysisContext,
): Node | undefined {
  const body = context.ast.body(inlineFunction);
  if (body === undefined) {
    return undefined;
  }
  if (!context.ast.is.IsBlock(body)) {
    return unwrapParentheses(body, context);
  }
  const returned: Node[] = [];
  collectReturnExpressions(body, context, returned, true);
  return returned.length === 1
    ? unwrapParentheses(returned[0], context)
    : undefined;
}

function collectReturnExpressions(
  node: Node,
  context: TsonicSourceFileAnalysisContext,
  returned: Node[],
  root: boolean,
): void {
  if (!root && isFunctionBoundary(node, context)) {
    return;
  }
  if (context.ast.is.IsReturnStatement(node)) {
    const expression = context.ast.as.AsReturnStatement(node)?.Expression;
    if (expression !== undefined) {
      returned.push(expression);
    }
    return;
  }
  for (const child of context.ast.children(node)) {
    if (child !== undefined) {
      collectReturnExpressions(child, context, returned, false);
    }
  }
}

function isFunctionBoundary(
  node: Node,
  context: TsonicSourceFileAnalysisContext,
): boolean {
  return context.ast.is.IsArrowFunction(node) ||
    context.ast.is.IsFunctionExpression(node) ||
    context.ast.is.IsFunctionDeclaration(node) ||
    context.ast.is.IsMethodDeclaration(node) ||
    context.ast.is.IsGetAccessorDeclaration(node) ||
    context.ast.is.IsSetAccessorDeclaration(node);
}

function unwrapParentheses(
  node: Node | undefined,
  context: TsonicSourceFileAnalysisContext,
): Node | undefined {
  let current = node;
  while (
    current !== undefined &&
    context.ast.is.IsParenthesizedExpression(current)
  ) {
    current = context.ast.as.AsParenthesizedExpression(current)?.Expression;
  }
  return current;
}
