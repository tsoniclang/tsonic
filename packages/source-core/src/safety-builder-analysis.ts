import type {
  ExtensionFactKey,
  ExtensionFactSubject,
  Node,
  SourceAnalysisContext,
} from "@tsonic/tsts";
import {
  sourceSafetySignatureIds,
  type SourceSafetyProviderNames,
} from "./explicit-safety-declarations.js";
import type {
  TsonicSafetyApplicationPlacement,
  TsonicSafetyBuilderFact,
  TsonicSafetyBuilderStateFact,
  TsonicSafetyContract,
  TsonicSafetyMemberKind,
} from "./explicit-safety-facts.js";
import {
  selectInlineSourceMember,
} from "./selected-source-member.js";
import type {
  TsonicSourceFileAnalysisContext,
} from "./source-analysis-context.js";
import {
  type ProviderSourceCallSelector,
  type SelectedProviderSourceCall,
  forEachSelectedProviderSourceCall,
  readSourceFact,
  selectedProviderCallMatches,
} from "./source-call-analysis.js";

export interface SafetyBuilderAnalysisContract {
  readonly providerId: string;
  readonly providerVersion: string;
  readonly providerModuleId: string;
  readonly names: SourceSafetyProviderNames;
  readonly factKey: ExtensionFactKey<TsonicSafetyBuilderFact>;
  readonly extensionId: string;
  readonly diagnosticPrefix: string;
  readonly diagnosticNumberBase: number;
}

export function analyzeSafetyBuilderCalls(
  context: SourceAnalysisContext,
  contract: SafetyBuilderAnalysisContract,
): void {
  const rules = createRules(contract);
  forEachSelectedProviderSourceCall(context, (selected, sourceContext): void => {
    for (const rule of rules) {
      if (selectedProviderCallMatches(selected, rule.selector, sourceContext)) {
        rule.analyze(selected, sourceContext);
        return;
      }
    }
  });
}

interface SafetyBuilderRule {
  readonly selector: ProviderSourceCallSelector;
  readonly analyze: (
    selected: SelectedProviderSourceCall,
    context: TsonicSourceFileAnalysisContext,
  ) => void;
}

function createRules(
  contract: SafetyBuilderAnalysisContract,
): readonly SafetyBuilderRule[] {
  const root = (signatureId: string): ProviderSourceCallSelector => ({
    kind: "export-signature",
    providerId: contract.providerId,
    providerVersion: contract.providerVersion,
    providerModuleId: contract.providerModuleId,
    exportId: contract.names.safetyExport,
    signatureId,
  });
  const member = (
    exportId: string,
    signatureId: string,
  ): ProviderSourceCallSelector => ({
    kind: "member-signature",
    providerId: contract.providerId,
    providerVersion: contract.providerVersion,
    providerModuleId: contract.providerModuleId,
    exportId,
    memberId: signatureId,
    memberStatic: false,
    signatureId,
  });
  const builder = contract.names.safetyBuilderExport;
  const memberBuilder = contract.names.safetyMemberBuilderExport;
  return Object.freeze([
    rule(root(sourceSafetySignatureIds.safetyValueRoot), (selected, context) =>
      analyzeRoot(selected, context, contract, "value")),
    rule(root(sourceSafetySignatureIds.safetyTypeRoot), (selected, context) =>
      analyzeRoot(selected, context, contract, "type")),
    rule(member(builder, sourceSafetySignatureIds.method), (selected, context) =>
      analyzeMemberSelector(selected, context, contract, "method")),
    rule(member(builder, sourceSafetySignatureIds.property), (selected, context) =>
      analyzeMemberSelector(selected, context, contract, "property")),
    rule(member(builder, sourceSafetySignatureIds.constructor), (selected, context) =>
      changePlacement(selected, context, contract, "constructor")),
    rule(member(memberBuilder, sourceSafetySignatureIds.getter), (selected, context) =>
      changePropertyAccessorPlacement(selected, context, contract, "getter")),
    rule(member(memberBuilder, sourceSafetySignatureIds.setter), (selected, context) =>
      changePropertyAccessorPlacement(selected, context, contract, "setter")),
    rule(member(builder, sourceSafetySignatureIds.requiresUnsafe), (selected, context) =>
      applyContract(selected, context, contract, "requires-unsafe")),
    rule(member(builder, sourceSafetySignatureIds.safe), (selected, context) =>
      applyContract(selected, context, contract, "safe")),
    rule(member(memberBuilder, sourceSafetySignatureIds.memberRequiresUnsafe), (selected, context) =>
      applyContract(selected, context, contract, "requires-unsafe")),
    rule(member(memberBuilder, sourceSafetySignatureIds.memberSafe), (selected, context) =>
      applyContract(selected, context, contract, "safe")),
  ] satisfies readonly SafetyBuilderRule[]);
}

function rule(
  selector: ProviderSourceCallSelector,
  analyze: SafetyBuilderRule["analyze"],
): SafetyBuilderRule {
  return Object.freeze({ selector: Object.freeze(selector), analyze });
}

function analyzeRoot(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileAnalysisContext,
  contract: SafetyBuilderAnalysisContract,
  form: "type" | "value",
): void {
  const target = form === "value"
    ? selectedValueTarget(selected)
    : selected.selection.sourceSelectedMethodTypeArguments?.[0]?.explicitTypeNode;
  if (target === undefined) {
    appendDiagnostic(
      selected,
      context,
      contract,
      "ROOT_TARGET_NOT_PROVEN",
      0,
      "The selected safety root requires one exact value declaration or authored type argument target.",
    );
    return;
  }
  writeFact(selected, context, contract, {
    kind: "builder-state",
    applicationTarget: target,
    applicationPlacement: "declaration",
  });
}

function selectedValueTarget(
  selected: SelectedProviderSourceCall,
): ExtensionFactSubject | undefined {
  const argument = selected.selection.sourceArguments[0];
  return argument?.selectedDeclaration ??
    argument?.declaration ??
    argument?.selectedSymbol ??
    argument?.symbol ??
    argument?.expression;
}

function analyzeMemberSelector(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileAnalysisContext,
  contract: SafetyBuilderAnalysisContract,
  memberKind: TsonicSafetyMemberKind,
): void {
  const predecessor = predecessorFact(selected, context, contract);
  if (predecessor === undefined) {
    return;
  }
  const selection = selectInlineSourceMember(selected, context);
  if (selection.kind === "rejected") {
    appendDiagnostic(
      selected,
      context,
      contract,
      `SELECTOR_${selection.reason.toUpperCase().replace("-", "_")}`,
      1,
      "The selected safety member operation requires one exact inline member selection from its callback parameter.",
    );
    return;
  }
  if (!selectedDeclarationMatchesKind(selection.selectedDeclaration, memberKind, context)) {
    appendDiagnostic(
      selected,
      context,
      contract,
      "SELECTOR_MEMBER_KIND_INVALID",
      2,
      `The selected safety ${memberKind} operation did not select a ${memberKind} declaration.`,
    );
    return;
  }
  writeFact(selected, context, contract, {
    kind: "builder-state",
    applicationTarget: selection.expression,
    selectedMember: selection.selectedMember,
    applicationMemberKind: memberKind,
    applicationPlacement: "declaration",
  });
}

function selectedDeclarationMatchesKind(
  declaration: Node | undefined,
  memberKind: TsonicSafetyMemberKind,
  context: TsonicSourceFileAnalysisContext,
): boolean {
  if (declaration === undefined) {
    return false;
  }
  return memberKind === "method"
    ? context.ast.is.IsMethodDeclaration(declaration) ||
      context.ast.is.IsMethodSignatureDeclaration(declaration)
    : context.ast.is.IsPropertyDeclaration(declaration) ||
      context.ast.is.IsPropertySignatureDeclaration(declaration) ||
      context.ast.is.IsGetAccessorDeclaration(declaration) ||
      context.ast.is.IsSetAccessorDeclaration(declaration);
}

function changePlacement(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileAnalysisContext,
  contract: SafetyBuilderAnalysisContract,
  placement: TsonicSafetyApplicationPlacement,
): void {
  const predecessor = predecessorFact(selected, context, contract);
  if (predecessor !== undefined) {
    writeFact(selected, context, contract, {
      ...predecessor,
      applicationPlacement: placement,
    });
  }
}

function changePropertyAccessorPlacement(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileAnalysisContext,
  contract: SafetyBuilderAnalysisContract,
  placement: "getter" | "setter",
): void {
  const predecessor = predecessorFact(selected, context, contract);
  if (predecessor === undefined) {
    return;
  }
  if (predecessor.applicationMemberKind !== "property") {
    appendDiagnostic(
      selected,
      context,
      contract,
      "ACCESSOR_REQUIRES_PROPERTY",
      3,
      `The selected safety ${placement} operation requires a preceding exact property selection.`,
    );
    return;
  }
  writeFact(selected, context, contract, {
    ...predecessor,
    applicationPlacement: placement,
  });
}

function applyContract(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileAnalysisContext,
  contract: SafetyBuilderAnalysisContract,
  safetyContract: TsonicSafetyContract,
): void {
  const predecessor = predecessorFact(selected, context, contract);
  if (predecessor === undefined) {
    return;
  }
  writeFact(selected, context, contract, {
    ...predecessor,
    kind: "application",
    contract: safetyContract,
  });
}

function predecessorFact(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileAnalysisContext,
  contract: SafetyBuilderAnalysisContract,
): TsonicSafetyBuilderStateFact | undefined {
  const receiver = selected.selection.sourceReceiver?.expression;
  const predecessor = readSourceFact(context, receiver, contract.factKey);
  return predecessor?.kind === "builder-state" ? predecessor : undefined;
}

function writeFact(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileAnalysisContext,
  contract: SafetyBuilderAnalysisContract,
  fact: TsonicSafetyBuilderFact,
): void {
  const result = context.facts.set(
    selected.call,
    contract.factKey,
    fact,
    [{
      message: "Safety contract fact derived from one exact selected provider call chain.",
    }],
  );
  if (result === "inserted" || result === "idempotent") {
    return;
  }
  appendDiagnostic(
    selected,
    context,
    contract,
    "FACT_WRITE_FAILED",
    4,
    `The selected safety fact could not be recorded (${result}).`,
  );
}

function appendDiagnostic(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileAnalysisContext,
  contract: SafetyBuilderAnalysisContract,
  suffix: string,
  numberOffset: number,
  message: string,
): void {
  const extensionCode = `${contract.diagnosticPrefix}_${suffix}`;
  context.diagnostics.append({
    extensionId: contract.extensionId,
    extensionCode,
    numericCode: contract.diagnosticNumberBase + numberOffset,
    category: "error",
    message,
    nodeOrSpan: selected.call,
    identity: `safety-builder:${extensionCode}:${context.ast.getPath(context.ast.getSourceFile(selected.call))}:${context.ast.pos(selected.call)}:${context.ast.end(selected.call)}`,
  });
}
