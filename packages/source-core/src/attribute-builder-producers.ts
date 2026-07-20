import {
  attributeFactKey,
  completeCheckedSourceCallProduction,
  deferCheckedSourceCallProduction,
  rejectCheckedSourceCallProduction,
} from "@tsonic/tsts";
import type {
  CheckedSourceCallOperation,
  CheckedSourceCallProducer,
  CheckedSourceCallProducerContext,
  CheckedSourceCallProduction,
  CheckedSourceCallProviderSelector,
  CheckedSourceInlineOperation,
  ExtensionDiagnostic,
  ExtensionFactSubject,
  ExtensionInitializeContext,
  SelectedSourceValueEvidence,
} from "@tsonic/tsts";
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

const attributeExportId = "attribute";
const attributeBuilderExportId = "__TsonicAttributeBuilder";
const attributeMemberBuilderExportId = "__TsonicAttributeMemberBuilder";

const attributeBuilderProducers = Object.freeze([
  sourceCallProducer(exportSelector(attributeExportId, tsonicAttributeBuilderSignatureIds.root), produceAttributeRoot),
  sourceCallProducer(memberSelector(attributeBuilderExportId, tsonicAttributeBuilderMemberIds.property, tsonicAttributeBuilderSignatureIds.property),
    (operation, context) => produceAttributeSelector(operation, context, "property")),
  sourceCallProducer(memberSelector(attributeBuilderExportId, tsonicAttributeBuilderMemberIds.method, tsonicAttributeBuilderSignatureIds.method),
    (operation, context) => produceAttributeSelector(operation, context, "method")),
  sourceCallProducer(memberSelector(attributeBuilderExportId, tsonicAttributeBuilderMemberIds.constructor, tsonicAttributeBuilderSignatureIds.constructor),
    produceAttributeConstructor),
  sourceCallProducer(memberSelector(attributeMemberBuilderExportId, tsonicAttributeBuilderMemberIds.parameter, tsonicAttributeBuilderSignatureIds.parameter),
    produceAttributeParameter),
  sourceCallProducer(memberSelector(attributeMemberBuilderExportId, tsonicAttributeBuilderMemberIds.target, tsonicAttributeBuilderSignatureIds.target),
    produceAttributeTargetSpecifier),
  sourceCallProducer(memberSelector(attributeBuilderExportId, tsonicAttributeBuilderMemberIds.add, tsonicAttributeBuilderSignatureIds.add),
    produceAttributeApplication),
  sourceCallProducer(memberSelector(attributeMemberBuilderExportId, tsonicAttributeBuilderMemberIds.memberAdd, tsonicAttributeBuilderSignatureIds.memberAdd),
    produceAttributeApplication),
] satisfies readonly CheckedSourceCallProducer[]);

export function registerTsonicAttributeBuilderProducers(context: ExtensionInitializeContext): void {
  for (const producer of attributeBuilderProducers) {
    context.registerCheckedSourceCallProducer(producer);
  }
}

function sourceCallProducer(
  selector: CheckedSourceCallProviderSelector,
  produce: CheckedSourceCallProducer["produce"],
): CheckedSourceCallProducer {
  return Object.freeze({ selector: Object.freeze(selector), produce });
}

function exportSelector(
  exportId: string,
  signatureId: string,
): CheckedSourceCallProviderSelector {
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
): CheckedSourceCallProviderSelector {
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

function produceAttributeRoot(
  operation: CheckedSourceCallOperation,
  context: CheckedSourceCallProducerContext,
): CheckedSourceCallProduction {
  const attribute = context.facts.get(operation.call, attributeFactKey) ??
    context.factResolver.resolve(operation.call, attributeFactKey);
  if (attribute === undefined) {
    return missingPrerequisite(
      operation,
      context,
      "SOURCE_SEMANTICS_MISSING_ATTRIBUTE_TARGET_EVIDENCE",
      9901105,
      "attribute<T>() requires explicit target type evidence.",
    );
  }
  return writeAttributeBuilderFact(operation, context, {
    kind: "builder-state",
    applicationTarget: attribute.target,
  });
}

function produceAttributeSelector(
  operation: CheckedSourceCallOperation,
  context: CheckedSourceCallProducerContext,
  memberKind: TsonicAttributeApplicationMemberKind,
): CheckedSourceCallProduction {
  const predecessor = getAttributeBuilderPredecessor(operation, context);
  if (predecessor.kind !== "builder-state") {
    return predecessor;
  }
  const selection = selectedInlineMember(operation);
  if (selection.kind !== "selected-member") {
    return selection;
  }
  return writeAttributeBuilderFact(operation, context, {
    ...predecessor,
    applicationTarget: selection.expression,
    selectedMember: selection.selectedMember,
    applicationMemberKind: memberKind,
    applicationPlacement: "declaration",
  });
}

function produceAttributeConstructor(
  operation: CheckedSourceCallOperation,
  context: CheckedSourceCallProducerContext,
): CheckedSourceCallProduction {
  const predecessor = getAttributeBuilderPredecessor(operation, context);
  if (predecessor.kind !== "builder-state") {
    return predecessor;
  }
  return writeAttributeBuilderFact(operation, context, {
    ...predecessor,
    applicationPlacement: "constructor",
  });
}

function produceAttributeParameter(
  operation: CheckedSourceCallOperation,
  context: CheckedSourceCallProducerContext,
): CheckedSourceCallProduction {
  const predecessor = getAttributeBuilderPredecessor(operation, context);
  if (predecessor.kind !== "builder-state") {
    return predecessor;
  }
  const parameterName = authoredStringArgument(operation, 0);
  if (parameterName === undefined) {
    return rejectSourceCall(
      operation,
      context,
      "SOURCE_CORE_ATTRIBUTE_PARAMETER_NAME_NOT_PROVEN",
      9901114,
      "The selected attribute parameter operation requires an authored string literal.",
    );
  }
  return writeAttributeBuilderFact(operation, context, {
    ...predecessor,
    applicationParameterName: parameterName,
  });
}

function produceAttributeTargetSpecifier(
  operation: CheckedSourceCallOperation,
  context: CheckedSourceCallProducerContext,
): CheckedSourceCallProduction {
  const predecessor = getAttributeBuilderPredecessor(operation, context);
  if (predecessor.kind !== "builder-state") {
    return predecessor;
  }
  const targetSpecifier = authoredStringArgument(operation, 0);
  if (targetSpecifier === undefined) {
    return rejectSourceCall(
      operation,
      context,
      "SOURCE_CORE_ATTRIBUTE_TARGET_SPECIFIER_NOT_PROVEN",
      9901115,
      "The selected attribute target operation requires an authored string literal.",
    );
  }
  return writeAttributeBuilderFact(operation, context, {
    ...predecessor,
    applicationTargetSpecifier: targetSpecifier,
  });
}

function produceAttributeApplication(
  operation: CheckedSourceCallOperation,
  context: CheckedSourceCallProducerContext,
): CheckedSourceCallProduction {
  const predecessor = getAttributeBuilderPredecessor(operation, context);
  if (predecessor.kind !== "builder-state") {
    return predecessor;
  }
  const attributeType = operation.arguments[0];
  if (attributeType === undefined || operation.sourceArguments[0] === undefined) {
    return rejectSourceCall(
      operation,
      context,
      "SOURCE_CORE_ATTRIBUTE_TYPE_NOT_PROVEN",
      9901116,
      "The selected attribute application requires an exact checked attribute type argument.",
    );
  }
  return writeAttributeBuilderFact(operation, context, {
    kind: "application",
    attributeType,
    arguments: operation.arguments.slice(1),
    applicationTarget: predecessor.applicationTarget,
    ...(predecessor.selectedMember === undefined ? {} : { selectedMember: predecessor.selectedMember }),
    ...(predecessor.applicationMemberKind === undefined ? {} : { applicationMemberKind: predecessor.applicationMemberKind }),
    ...(predecessor.applicationPlacement === undefined ? {} : { applicationPlacement: predecessor.applicationPlacement }),
    ...(predecessor.applicationParameterName === undefined ? {} : { applicationParameterName: predecessor.applicationParameterName }),
    ...(predecessor.applicationTargetSpecifier === undefined ? {} : { applicationTargetSpecifier: predecessor.applicationTargetSpecifier }),
  });
}

function getAttributeBuilderPredecessor(
  operation: CheckedSourceCallOperation,
  context: CheckedSourceCallProducerContext,
): TsonicAttributeBuilderStateFact | CheckedSourceCallProduction {
  const receiver = operation.sourceReceiver?.expression;
  if (receiver === undefined) {
    return rejectSourceCall(
      operation,
      context,
      "SOURCE_CORE_ATTRIBUTE_RECEIVER_NOT_PROVEN",
      9901112,
      "The selected attribute builder operation requires exact selected receiver evidence.",
    );
  }
  const predecessor = context.facts.get(receiver, tsonicAttributeBuilderFactKey) ??
    context.factResolver.resolve(receiver, tsonicAttributeBuilderFactKey);
  if (predecessor?.kind === "builder-state") {
    return predecessor;
  }
  return missingPrerequisite(
    operation,
    context,
    "SOURCE_CORE_ATTRIBUTE_PREDECESSOR_NOT_PROVEN",
    9901113,
    "The selected attribute builder operation requires its exact predecessor builder fact.",
  );
}

type SelectedInlineMember = {
  readonly kind: "selected-member";
  readonly expression: ExtensionFactSubject;
  readonly selectedMember: ExtensionFactSubject;
};

function selectedInlineMember(
  operation: CheckedSourceCallOperation,
): SelectedInlineMember | CheckedSourceCallProduction {
  const composition = operation.sourceArguments[0]?.composition;
  if (composition?.kind !== "inline-function") {
    return rejectSourceCallWithoutContext(
      operation,
      "SOURCE_CORE_ATTRIBUTE_SELECTOR_NOT_PROVEN",
      9901117,
      "The selected attribute member operation requires exact inline-function evidence.",
    );
  }
  const inlineFunction = composition.function;
  const parameter = inlineFunction.parameters.length === 1 ? inlineFunction.parameters[0] : undefined;
  const returned = inlineFunction.returns.length === 1 ? inlineFunction.returns[0] : undefined;
  if (parameter === undefined || returned === undefined) {
    return rejectSourceCallWithoutContext(
      operation,
      "SOURCE_CORE_ATTRIBUTE_SELECTOR_NOT_PROVEN",
      9901117,
      "The selected attribute member operation requires one exact callback parameter and one exact return.",
    );
  }
  const selectedOperations = inlineFunction.operations.filter((candidate) =>
    inlineOperationSubject(candidate) === returned.expression);
  if (selectedOperations.length !== 1 || selectedOperations[0]?.sourceOperationKind !== "property-access") {
    return rejectSourceCallWithoutContext(
      operation,
      "SOURCE_CORE_ATTRIBUTE_SELECTOR_NOT_PROVEN",
      9901117,
      "The selected attribute member callback must return one checked member access.",
    );
  }
  const selectedOperation = selectedOperations[0];
  if (selectedOperation.accessMode !== "read" || selectedOperation.use !== "value") {
    return rejectSourceCallWithoutContext(
      operation,
      "SOURCE_CORE_ATTRIBUTE_SELECTOR_NOT_PROVEN",
      9901117,
      "The selected attribute member callback must return one checked member read.",
    );
  }
  if (!selectedReceiverMatchesParameter(selectedOperation.sourceReceiver, parameter)) {
    return rejectSourceCallWithoutContext(
      operation,
      "SOURCE_CORE_ATTRIBUTE_SELECTOR_RECEIVER_NOT_PROVEN",
      9901118,
      "The selected attribute member callback must access a member on its exact callback parameter.",
    );
  }
  const selectedMember = selectedOperation.sourceReadResult.selectedDeclaration ??
    selectedOperation.sourceReadResult.selectedSymbol;
  if (selectedMember === undefined) {
    return rejectSourceCallWithoutContext(
      operation,
      "SOURCE_CORE_ATTRIBUTE_SELECTOR_MEMBER_NOT_PROVEN",
      9901119,
      "The selected attribute member callback requires exact selected member declaration evidence.",
    );
  }
  return {
    kind: "selected-member",
    expression: selectedOperation.expression,
    selectedMember,
  };
}

function selectedReceiverMatchesParameter(
  receiver: SelectedSourceValueEvidence,
  parameter: { readonly declaration: ExtensionFactSubject; readonly symbol: ExtensionFactSubject },
): boolean {
  return [
    receiver.symbol,
    receiver.declaration,
    receiver.selectedSymbol,
    receiver.selectedDeclaration,
  ].some((subject) => subject === parameter.symbol || subject === parameter.declaration);
}

function inlineOperationSubject(operation: CheckedSourceInlineOperation): ExtensionFactSubject {
  switch (operation.sourceOperationKind) {
    case "call":
      return operation.call;
    case "iteration":
      return operation.statement;
    case "property-access":
    case "element-access":
    case "operator":
    case "conversion":
      return operation.expression;
  }
}

function authoredStringArgument(
  operation: CheckedSourceCallOperation,
  index: number,
): string | undefined {
  const composition = operation.sourceArguments[index]?.composition;
  return composition?.kind === "authored-literal" && composition.literal.kind === "string"
    ? composition.literal.value
    : undefined;
}

function writeAttributeBuilderFact(
  operation: CheckedSourceCallOperation,
  context: CheckedSourceCallProducerContext,
  fact: TsonicAttributeBuilderFact,
): CheckedSourceCallProduction {
  const result = context.facts.set(tsonicAttributeBuilderFactKey, fact, [{
    message: "Tsonic source-core attribute builder fact produced from exact TSTS-selected call evidence.",
  }]);
  return result === "inserted" || result === "idempotent"
    ? completeCheckedSourceCallProduction
    : rejectSourceCall(
        operation,
        context,
        "SOURCE_CORE_ATTRIBUTE_FACT_WRITE_FAILED",
        9901120,
        `The selected attribute builder fact could not be recorded (${result}).`,
      );
}

function missingPrerequisite(
  operation: CheckedSourceCallOperation,
  context: CheckedSourceCallProducerContext,
  extensionCode: string,
  numericCode: number,
  message: string,
): CheckedSourceCallProduction {
  return context.phase === "checking"
    ? deferCheckedSourceCallProduction
    : rejectSourceCall(operation, context, extensionCode, numericCode, message);
}

function rejectSourceCall(
  operation: CheckedSourceCallOperation,
  context: CheckedSourceCallProducerContext,
  extensionCode: string,
  numericCode: number,
  message: string,
): CheckedSourceCallProduction {
  return rejectCheckedSourceCallProduction(sourceCallDiagnostic(
    operation,
    context.extensionId,
    extensionCode,
    numericCode,
    message,
  ));
}

function rejectSourceCallWithoutContext(
  operation: CheckedSourceCallOperation,
  extensionCode: string,
  numericCode: number,
  message: string,
): CheckedSourceCallProduction {
  return rejectCheckedSourceCallProduction(sourceCallDiagnostic(
    operation,
    tsonicCoreSourceExtensionId,
    extensionCode,
    numericCode,
    message,
  ));
}

function sourceCallDiagnostic(
  operation: CheckedSourceCallOperation,
  extensionId: string,
  extensionCode: string,
  numericCode: number,
  message: string,
): ExtensionDiagnostic {
  return {
    extensionId,
    extensionCode,
    numericCode,
    publicCode: `TSONIC_SOURCE_CORE_${numericCode}`,
    category: "error",
    message,
    nodeOrSpan: operation.call,
  };
}
