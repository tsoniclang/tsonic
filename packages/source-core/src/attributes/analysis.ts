import {
  attributeFactKey,
} from "@tsonic/tsts";
import type {
  SourceAnalysisContext,
  ExtensionFactResolverContext,
  ExtensionFactSubject,
  ExtensionFactResolution,
} from "@tsonic/tsts";
import { isAstNode } from "@tsonic/target-api/source";
import type {
  TsonicSourceFileFactContext,
} from "../analysis/context.js";
import { forEachTsonicSourceFile } from "../analysis/context.js";
import {
  tsonicAttributeBuilderFactKey,
} from "./facts.js";
import type {
  TsonicAttributeApplicationMemberKind,
  TsonicAttributeBuilderFact,
  TsonicAttributeBuilderStateFact,
} from "./facts.js";
import {
  tsonicCoreLangModule,
  tsonicCoreProviderVersion,
  tsonicCoreSourceExtensionId,
  tsonicCoreVirtualModulesProviderId,
} from "../identity.js";
import {
  tsonicAttributeBuilderMemberIds,
  tsonicAttributeBuilderSignatureIds,
} from "./provider-declarations.js";
import {
  type ProviderSourceCallSelector,
  type SelectedProviderSourceCall,
  readSourceFact,
  selectedProviderCallMatches,
  selectProviderSourceCall,
  unwrapParenthesizedExpression,
  visitPostOrder,
} from "../analysis/source-call.js";
import {
  selectInlineSourceMember,
} from "../analysis/selected-source-member.js";
import { selectedAttributeInvocation } from "./invocation.js";

const attributeBuilderExportId = "__TsonicAttributeBuilder";
const attributeMemberBuilderExportId = "__TsonicAttributeMemberBuilder";
const attributeExportId = "attribute";

interface AttributeBuilderRule {
  readonly selector: ProviderSourceCallSelector;
  readonly analyze: (
    selected: SelectedProviderSourceCall,
    context: TsonicSourceFileFactContext,
  ) => TsonicAttributeBuilderFact | undefined;
}

const attributeBuilderRules = Object.freeze([
  rule(
    memberSelector("__TsonicModuleAttributeBuilder", tsonicAttributeBuilderMemberIds.moduleTarget, tsonicAttributeBuilderSignatureIds.moduleTarget),
    analyzeAttributeTargetSpecifier,
  ),
  rule(
    memberSelector("__TsonicModuleAttributeBuilder", tsonicAttributeBuilderMemberIds.moduleAdd, tsonicAttributeBuilderSignatureIds.moduleAdd),
    analyzeAttributeApplication,
  ),
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
  forEachTsonicSourceFile(context, sourceContext => {
    visitPostOrder(sourceContext.sourceFile, sourceContext, node => {
      if (sourceContext.ast.is.IsCallExpression(node)) {
        sourceContext.factResolver.resolve(node, tsonicAttributeBuilderFactKey);
      }
    });
  });
}

export function resolveTsonicAttributeBuilder(
  subject: ExtensionFactSubject,
  context: ExtensionFactResolverContext,
): ExtensionFactResolution<TsonicAttributeBuilderFact> | undefined {
  const { source } = context;
  if (!isAstNode(source.ast, subject) || !source.ast.is.IsCallExpression(subject)) return undefined;
  const sourceContext: TsonicSourceFileFactContext = {
    ...source.getSourceFileQueries(source.ast.getSourceFile(subject)),
    facts: context.facts,
    factResolver: context.factResolver,
    diagnostics: context.diagnostics,
  };
  const selected = selectProviderSourceCall(subject, sourceContext);
  if (selected === undefined) return undefined;
  const value = selectAttributeBuilder(selected, sourceContext);
  return value === undefined ? undefined : {
    value,
    evidence: [{ message: "Tsonic source-core attribute builder fact derived from the exact selected source call." }],
  };
}

function selectAttributeBuilder(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileFactContext,
): TsonicAttributeBuilderFact | undefined {
  if (readSourceFact(context, selected.call, attributeFactKey) !== undefined) {
    return analyzeAttributeRoot(selected, context);
  }
  if (isAttributeModuleSelector(selected, context)) {
    return { kind: "builder-state", applicationTarget: context.sourceFile, applicationPlacement: "module" };
  }
  for (const candidate of attributeBuilderRules) {
    if (selectedProviderCallMatches(selected, candidate.selector, context)) return candidate.analyze(selected, context);
  }
  return undefined;
}

function isAttributeModuleSelector(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileFactContext,
): boolean {
  const declaration = selected.declaration;
  if (!selectedProviderCallMatches(selected, memberSelector(attributeExportId,
    tsonicAttributeBuilderMemberIds.module, tsonicAttributeBuilderSignatureIds.module), context)) return false;
  const receiver = unwrapParenthesizedExpression(selected.selection.sourceReceiver?.expression, context);
  const reference = receiver === undefined ? undefined : context.checker.getProviderReferenceInfo(receiver);
  const owner = reference?.ordinary?.kind === "declaration" ? reference.ordinary.declaration : undefined;
  return owner?.providerId === declaration.providerId &&
    owner.providerVersion === declaration.providerVersion &&
    owner.providerModuleId === declaration.providerModuleId &&
    owner.moduleSpecifier === declaration.moduleSpecifier &&
    owner.exportId === declaration.exportId && owner.memberId === undefined;
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
  context: TsonicSourceFileFactContext,
): TsonicAttributeBuilderStateFact | undefined {
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
  return {
    kind: "builder-state",
    applicationTarget: attribute.target,
  };
}

function analyzeAttributeSelector(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileFactContext,
  memberKind: TsonicAttributeApplicationMemberKind,
): TsonicAttributeBuilderStateFact | undefined {
  const predecessor = getAttributeBuilderPredecessor(selected, context);
  if (predecessor === undefined) {
    return;
  }
  const selection = selectedInlineMember(selected, context);
  if (selection === undefined) {
    return;
  }
  return {
    ...predecessor,
    applicationTarget: selection.expression,
    selectedMember: selection.selectedMember,
    applicationMemberKind: memberKind,
    applicationPlacement: "declaration",
  };
}

function analyzeAttributeConstructor(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileFactContext,
): TsonicAttributeBuilderStateFact | undefined {
  const predecessor = getAttributeBuilderPredecessor(selected, context);
  if (predecessor !== undefined) {
    return {
      ...predecessor,
      applicationPlacement: "constructor",
    };
  }
  return undefined;
}

function analyzeAttributeParameter(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileFactContext,
): TsonicAttributeBuilderStateFact | undefined {
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
  return {
    ...predecessor,
    applicationParameterName: parameterName,
  };
}

function analyzeAttributeTargetSpecifier(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileFactContext,
): TsonicAttributeBuilderStateFact | undefined {
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
  return {
    ...predecessor,
    applicationTargetSpecifier: targetSpecifier,
  };
}

function analyzeAttributeApplication(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileFactContext,
): TsonicAttributeBuilderFact | undefined {
  const predecessor = getAttributeBuilderPredecessor(selected, context);
  if (predecessor === undefined) {
    return;
  }
  const invocation = selectedAttributeInvocation(selected, context);
  if (invocation === undefined) {
    appendDiagnostic(
      selected,
      context,
      "SOURCE_CORE_ATTRIBUTE_INVOCATION_NOT_PROVEN",
      9901116,
      "An attribute application requires an inline synchronous zero-parameter expression arrow containing one applicable call, construction or exact provider intrinsic invocation.",
    );
    return;
  }
  return {
    kind: "application",
    invocation,
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
  };
}

function getAttributeBuilderPredecessor(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileFactContext,
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

function selectedInlineMember(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileFactContext,
): Extract<ReturnType<typeof selectInlineSourceMember>, { readonly kind: "selected" }> | undefined {
  const result = selectInlineSourceMember(selected.selection.sourceArguments[0]?.expression, context);
  if (result.kind === "selected") {
    return result;
  }
  const diagnostic = result.reason === "receiver"
    ? {
        extensionCode: "SOURCE_CORE_ATTRIBUTE_SELECTOR_RECEIVER_NOT_PROVEN",
        numericCode: 9901118,
        message: "The selected attribute member callback must read a member from its exact callback parameter.",
      }
    : result.reason === "member-evidence"
    ? {
        extensionCode: "SOURCE_CORE_ATTRIBUTE_SELECTOR_MEMBER_NOT_PROVEN",
        numericCode: 9901119,
        message: "The selected attribute member callback requires exact selected member declaration evidence.",
      }
    : {
        extensionCode: "SOURCE_CORE_ATTRIBUTE_SELECTOR_NOT_PROVEN",
        numericCode: 9901117,
        message: "The selected attribute member callback must have one parameter and return one property access.",
      };
  appendSelectorDiagnostic(
    selected,
    context,
    diagnostic.extensionCode,
    diagnostic.numericCode,
    diagnostic.message,
  );
  return undefined;
}

function authoredStringArgument(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileFactContext,
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

function appendSelectorDiagnostic(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileFactContext,
  extensionCode: string,
  numericCode: number,
  message: string,
): void {
  appendDiagnostic(selected, context, extensionCode, numericCode, message);
}

function appendDiagnostic(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileFactContext,
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
