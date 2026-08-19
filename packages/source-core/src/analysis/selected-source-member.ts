import type {
  ExtensionFactSubject,
  Node,
  Symbol,
} from "@tsonic/tsts";
import type {
  TsonicSourceFileAnalysisContext,
} from "./context.js";
import type {
  SelectedProviderSourceCall,
} from "./source-call.js";

export type SelectedInlineSourceMemberResult =
  | {
      readonly kind: "selected";
      readonly expression: ExtensionFactSubject;
      readonly selectedMember: ExtensionFactSubject;
      readonly selectedDeclaration?: Node;
      readonly selectedDeclarations: readonly Node[];
    }
  | {
      readonly kind: "rejected";
      readonly reason: "function-shape" | "receiver" | "member-evidence";
    };

export function selectInlineSourceMember(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileAnalysisContext,
  syntax: "element" | "property" = "property",
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
    (syntax === "property"
      ? !context.ast.is.IsPropertyAccessExpression(returned)
      : !context.ast.is.IsElementAccessExpression(returned))
  ) {
    return { kind: "rejected", reason: "function-shape" };
  }
  return syntax === "property"
    ? selectPropertyMember(
        returned,
        parameter,
        parameterSymbol,
        context,
      )
    : selectElementMember(
        returned,
        parameter,
        parameterSymbol,
        context,
      );
}

function selectPropertyMember(
  returned: Node,
  parameter: Node,
  parameterSymbol: Symbol,
  context: TsonicSourceFileAnalysisContext,
): SelectedInlineSourceMemberResult {
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
  return selectedMemberResult(
    property.expression,
    property.selectedSymbol,
    property.selectedDeclaration,
    context,
  );
}

function selectElementMember(
  returned: Node,
  parameter: Node,
  parameterSymbol: Symbol,
  context: TsonicSourceFileAnalysisContext,
): SelectedInlineSourceMemberResult {
  const element = context.checker.getResolvedElementAccessInfo(returned);
  if (
    element === undefined ||
    element.accessMode !== "read" ||
    element.callCallee ||
    !selectedReceiverMatchesParameter(
      element.receiver,
      parameter,
      parameterSymbol,
    )
  ) {
    return { kind: "rejected", reason: "receiver" };
  }
  return selectedMemberResult(
    element.expression,
    element.selectedSymbol,
    element.selectedDeclaration,
    context,
  );
}

function selectedMemberResult(
  expression: Node,
  selectedSymbol: Symbol | undefined,
  selectedDeclaration: Node | undefined,
  context: TsonicSourceFileAnalysisContext,
): SelectedInlineSourceMemberResult {
  const selectedMember = selectedDeclaration ?? selectedSymbol;
  const selectedDeclarations = selectedSymbol === undefined
    ? selectedDeclaration === undefined
      ? []
      : [selectedDeclaration]
    : context.checker.getSymbolDeclarations(selectedSymbol).filter(
        (declaration): declaration is Node => declaration !== undefined,
      );
  if (selectedMember === undefined || selectedDeclarations.length === 0) {
    return { kind: "rejected", reason: "member-evidence" };
  }
  return {
    kind: "selected",
    expression,
    selectedMember,
    selectedDeclarations: Object.freeze([...selectedDeclarations]),
    ...(selectedDeclaration === undefined
      ? {}
      : { selectedDeclaration }),
  };
}

function selectedReceiverMatchesParameter(
  receiver: {
    readonly symbol?: Symbol;
    readonly declaration?: Node;
  },
  parameter: Node,
  parameterSymbol: Symbol,
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
