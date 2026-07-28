import {
  attributeFactKey,
} from "@tsonic/tsts";
import type {
  ExtensionFactSubject,
  Node,
  SourceAnalysisContext,
} from "@tsonic/tsts";
import type {
  TsonicSourceFileAnalysisContext,
} from "./source-analysis-context.js";
import {
  tsonicAttributeBuilderFactKey,
} from "./attribute-builder-facts.js";
import type {
  TsonicAttributeApplicationMemberKind,
  TsonicAttributeBuilderFact,
  TsonicAttributeBuilderStateFact,
} from "./attribute-builder-facts.js";
import {
  tsonicCoreLangModule,
  tsonicCoreProviderVersion,
  tsonicCoreSourceExtensionId,
  tsonicCoreVirtualModulesProviderId,
} from "./identity.js";
import {
  tsonicAttributeBuilderMemberIds,
  tsonicAttributeBuilderSignatureIds,
} from "./provider-declarations.js";
import {
  type ProviderSourceCallSelector,
  type SelectedProviderSourceCall,
  forEachSelectedProviderSourceCall,
  readSourceFact,
  selectedProviderCallMatches,
} from "./source-call-analysis.js";

const attributeExportId = "attribute";
const attributeBuilderExportId = "__TsonicAttributeBuilder";
const attributeMemberBuilderExportId = "__TsonicAttributeMemberBuilder";

interface AttributeBuilderRule {
  readonly selector: ProviderSourceCallSelector;
  readonly analyze: (
    selected: SelectedProviderSourceCall,
    context: TsonicSourceFileAnalysisContext,
  ) => void;
}

const attributeBuilderRules = Object.freeze([
  rule(
    exportSelector(attributeExportId, tsonicAttributeBuilderSignatureIds.root),
    analyzeAttributeRoot,
  ),
  rule(
    memberSelector(
      attributeBuilderExportId,
      tsonicAttributeBuilderMemberIds.property,
      tsonicAttributeBuilderSignatureIds.property,
    ),
    (selected, context) => analyzeAttributeSelector(selected, context, "property"),
  ),
  rule(
    memberSelector(
      attributeBuilderExportId,
      tsonicAttributeBuilderMemberIds.method,
      tsonicAttributeBuilderSignatureIds.method,
    ),
    (selected, context) => analyzeAttributeSelector(selected, context, "method"),
  ),
  rule(
    memberSelector(
      attributeBuilderExportId,
      tsonicAttributeBuilderMemberIds.constructor,
      tsonicAttributeBuilderSignatureIds.constructor,
    ),
    analyzeAttributeConstructor,
  ),
  rule(
    memberSelector(
      attributeMemberBuilderExportId,
      tsonicAttributeBuilderMemberIds.parameter,
      tsonicAttributeBuilderSignatureIds.parameter,
    ),
    analyzeAttributeParameter,
  ),
  rule(
    memberSelector(
      attributeMemberBuilderExportId,
      tsonicAttributeBuilderMemberIds.target,
      tsonicAttributeBuilderSignatureIds.target,
    ),
    analyzeAttributeTargetSpecifier,
  ),
  rule(
    memberSelector(
      attributeBuilderExportId,
      tsonicAttributeBuilderMemberIds.add,
      tsonicAttributeBuilderSignatureIds.add,
    ),
    analyzeAttributeApplication,
  ),
  rule(
    memberSelector(
      attributeMemberBuilderExportId,
      tsonicAttributeBuilderMemberIds.memberAdd,
      tsonicAttributeBuilderSignatureIds.memberAdd,
    ),
    analyzeAttributeApplication,
  ),
] satisfies readonly AttributeBuilderRule[]);

export function analyzeTsonicAttributeBuilders(context: SourceAnalysisContext): void {
  forEachSelectedProviderSourceCall(context, (selected, sourceContext): void => {
    for (const candidate of attributeBuilderRules) {
      if (selectedProviderCallMatches(selected, candidate.selector, sourceContext)) {
        candidate.analyze(selected, sourceContext);
        return;
      }
    }
  });
}

function rule(
  selector: ProviderSourceCallSelector,
  analyze: AttributeBuilderRule["analyze"],
): AttributeBuilderRule {
  return Object.freeze({ selector: Object.freeze(selector), analyze });
}

function exportSelector(
  exportId: string,
  signatureId: string,
): ProviderSourceCallSelector {
  return {
    kind: "export-signature",
    providerId: tsonicCoreVirtualModulesProviderId,
    providerVersion: tsonicCoreProviderVersion,
    providerModuleId: tsonicCoreLangModule,
    exportId,
    signatureId,
  };
}

function memberSelector(
  exportId: string,
  memberId: string,
  signatureId: string,
): ProviderSourceCallSelector {
  return {
    kind: "member-signature",
    providerId: tsonicCoreVirtualModulesProviderId,
    providerVersion: tsonicCoreProviderVersion,
    providerModuleId: tsonicCoreLangModule,
    exportId,
    memberId,
    memberStatic: false,
    signatureId,
  };
}

function analyzeAttributeRoot(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileAnalysisContext,
): void {
  const attribute = readSourceFact(context, selected.call, attributeFactKey);
  if (attribute === undefined) {
    appendDiagnostic(
      selected,
      context,
      "SOURCE_SEMANTICS_MISSING_ATTRIBUTE_TARGET_EVIDENCE",
      9901105,
      "attribute<T>() requires explicit target type evidence.",
    );
    return;
  }
  writeAttributeBuilderFact(selected, context, {
    kind: "builder-state",
    applicationTarget: attribute.target,
  });
}

function analyzeAttributeSelector(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileAnalysisContext,
  memberKind: TsonicAttributeApplicationMemberKind,
): void {
  const predecessor = getAttributeBuilderPredecessor(selected, context);
  if (predecessor === undefined) {
    return;
  }
  const selection = selectedInlineMember(selected, context);
  if (selection === undefined) {
    return;
  }
  writeAttributeBuilderFact(selected, context, {
    ...predecessor,
    applicationTarget: selection.expression,
    selectedMember: selection.selectedMember,
    applicationMemberKind: memberKind,
    applicationPlacement: "declaration",
  });
}

function analyzeAttributeConstructor(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileAnalysisContext,
): void {
  const predecessor = getAttributeBuilderPredecessor(selected, context);
  if (predecessor !== undefined) {
    writeAttributeBuilderFact(selected, context, {
      ...predecessor,
      applicationPlacement: "constructor",
    });
  }
}

function analyzeAttributeParameter(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileAnalysisContext,
): void {
  const predecessor = getAttributeBuilderPredecessor(selected, context);
  if (predecessor === undefined) {
    return;
  }
  const parameterName = authoredStringArgument(selected, context, 0);
  if (parameterName === undefined) {
    appendDiagnostic(
      selected,
      context,
      "SOURCE_CORE_ATTRIBUTE_PARAMETER_NAME_NOT_PROVEN",
      9901114,
      "The selected attribute parameter operation requires an authored string literal.",
    );
    return;
  }
  writeAttributeBuilderFact(selected, context, {
    ...predecessor,
    applicationParameterName: parameterName,
  });
}

function analyzeAttributeTargetSpecifier(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileAnalysisContext,
): void {
  const predecessor = getAttributeBuilderPredecessor(selected, context);
  if (predecessor === undefined) {
    return;
  }
  const targetSpecifier = authoredStringArgument(selected, context, 0);
  if (targetSpecifier === undefined) {
    appendDiagnostic(
      selected,
      context,
      "SOURCE_CORE_ATTRIBUTE_TARGET_SPECIFIER_NOT_PROVEN",
      9901115,
      "The selected attribute target operation requires an authored string literal.",
    );
    return;
  }
  writeAttributeBuilderFact(selected, context, {
    ...predecessor,
    applicationTargetSpecifier: targetSpecifier,
  });
}

function analyzeAttributeApplication(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileAnalysisContext,
): void {
  const predecessor = getAttributeBuilderPredecessor(selected, context);
  if (predecessor === undefined) {
    return;
  }
  const attributeType = selected.selection.sourceArguments[0]?.expression;
  if (attributeType === undefined) {
    appendDiagnostic(
      selected,
      context,
      "SOURCE_CORE_ATTRIBUTE_TYPE_NOT_PROVEN",
      9901116,
      "The selected attribute application requires an exact checked attribute type argument.",
    );
    return;
  }
  writeAttributeBuilderFact(selected, context, {
    kind: "application",
    attributeType,
    arguments: selected.selection.sourceArguments
      .slice(1)
      .map((argument) => argument.expression),
    applicationTarget: predecessor.applicationTarget,
    ...(predecessor.selectedMember === undefined
      ? {}
      : { selectedMember: predecessor.selectedMember }),
    ...(predecessor.applicationMemberKind === undefined
      ? {}
      : { applicationMemberKind: predecessor.applicationMemberKind }),
    ...(predecessor.applicationPlacement === undefined
      ? {}
      : { applicationPlacement: predecessor.applicationPlacement }),
    ...(predecessor.applicationParameterName === undefined
      ? {}
      : { applicationParameterName: predecessor.applicationParameterName }),
    ...(predecessor.applicationTargetSpecifier === undefined
      ? {}
      : { applicationTargetSpecifier: predecessor.applicationTargetSpecifier }),
  });
}

function getAttributeBuilderPredecessor(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileAnalysisContext,
): TsonicAttributeBuilderStateFact | undefined {
  const receiver = selected.selection.sourceReceiver?.expression;
  if (receiver === undefined) {
    return undefined;
  }
  const predecessor = readSourceFact(context, receiver, tsonicAttributeBuilderFactKey);
  if (predecessor?.kind === "builder-state") {
    return predecessor;
  }
  return undefined;
}

interface SelectedInlineMember {
  readonly expression: ExtensionFactSubject;
  readonly selectedMember: ExtensionFactSubject;
}

function selectedInlineMember(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileAnalysisContext,
): SelectedInlineMember | undefined {
  const inlineFunction = selected.selection.sourceArguments[0]?.expression;
  if (
    inlineFunction === undefined ||
    (!context.ast.is.IsArrowFunction(inlineFunction) &&
      !context.ast.is.IsFunctionExpression(inlineFunction))
  ) {
    appendSelectorDiagnostic(
      selected,
      context,
      "SOURCE_CORE_ATTRIBUTE_SELECTOR_NOT_PROVEN",
      9901117,
      "The selected attribute member operation requires an inline function expression.",
    );
    return undefined;
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
    appendSelectorDiagnostic(
      selected,
      context,
      "SOURCE_CORE_ATTRIBUTE_SELECTOR_NOT_PROVEN",
      9901117,
      "The selected attribute member callback must have one parameter and return one property access.",
    );
    return undefined;
  }
  const property = context.checker.getResolvedPropertyAccessInfo(returned);
  if (
    property === undefined ||
    property.accessMode !== "read" ||
    property.callCallee ||
    !selectedReceiverMatchesParameter(property.receiver, parameter, parameterSymbol)
  ) {
    appendSelectorDiagnostic(
      selected,
      context,
      "SOURCE_CORE_ATTRIBUTE_SELECTOR_RECEIVER_NOT_PROVEN",
      9901118,
      "The selected attribute member callback must read a member from its exact callback parameter.",
    );
    return undefined;
  }
  const selectedMember = property.selectedDeclaration ?? property.selectedSymbol;
  if (selectedMember === undefined) {
    appendSelectorDiagnostic(
      selected,
      context,
      "SOURCE_CORE_ATTRIBUTE_SELECTOR_MEMBER_NOT_PROVEN",
      9901119,
      "The selected attribute member callback requires exact selected member declaration evidence.",
    );
    return undefined;
  }
  return {
    expression: property.expression,
    selectedMember,
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
  return receiver.symbol === parameterSymbol ||
    receiver.declaration === parameter;
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

function isFunctionBoundary(node: Node, context: TsonicSourceFileAnalysisContext): boolean {
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
  while (current !== undefined && context.ast.is.IsParenthesizedExpression(current)) {
    current = context.ast.as.AsParenthesizedExpression(current)?.Expression;
  }
  return current;
}

function authoredStringArgument(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileAnalysisContext,
  index: number,
): string | undefined {
  const argument = selected.selection.sourceArguments[index]?.expression;
  if (
    argument === undefined ||
    (!context.ast.is.IsStringLiteral(argument) &&
      !context.ast.is.IsNoSubstitutionTemplateLiteral(argument))
  ) {
    return undefined;
  }
  return context.ast.text(argument);
}

function writeAttributeBuilderFact(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileAnalysisContext,
  fact: TsonicAttributeBuilderFact,
): void {
  const result = context.facts.set(
    selected.call,
    tsonicAttributeBuilderFactKey,
    fact,
    [{
      message: "Tsonic source-core attribute builder fact derived from the exact selected source call.",
    }],
  );
  if (result !== "inserted" && result !== "idempotent") {
    appendDiagnostic(
      selected,
      context,
      "SOURCE_CORE_ATTRIBUTE_FACT_WRITE_FAILED",
      9901120,
      `The selected attribute builder fact could not be recorded (${result}).`,
    );
  }
}

function appendSelectorDiagnostic(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileAnalysisContext,
  extensionCode: string,
  numericCode: number,
  message: string,
): void {
  appendDiagnostic(selected, context, extensionCode, numericCode, message);
}

function appendDiagnostic(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileAnalysisContext,
  extensionCode: string,
  numericCode: number,
  message: string,
): void {
  context.diagnostics.append({
    extensionId: tsonicCoreSourceExtensionId,
    extensionCode,
    numericCode,
    publicCode: `TSONIC_SOURCE_CORE_${numericCode}`,
    category: "error",
    message,
    nodeOrSpan: selected.call,
    identity: `source-core-attribute:${extensionCode}:${context.ast.getPath(context.ast.getSourceFile(selected.call))}:${context.ast.pos(selected.call)}:${context.ast.end(selected.call)}`,
  });
}
