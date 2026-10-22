import { providerVirtualDeclarationFactKey } from "@tsonic/tsts";
import type {
  ExtensionFactKey,
  ExtensionFactSubject,
  Node,
  SourceAnalysisContext,
  SourceCallMarkerKind,
} from "@tsonic/tsts";
import {
  sourceSafetySignatureIds,
  type SourceSafetyProviderNames,
} from "./declarations.js";
import type {
  TsonicSafetyApplicationPlacement,
  TsonicSafetyBuilderFact,
  TsonicSafetyBuilderStateFact,
  TsonicSafetyContract,
  TsonicSafetyMemberKind,
} from "./facts.js";
import { pointerFlowOperand } from "../pointers/backing/source-forms.js";
import { tsonicCoreSourceSemanticsModules } from "../extension/source-modules.js";
import { tsonicCoreProviderVersion, tsonicCoreVirtualModulesProviderId } from "../identity.js";
import {
  selectInlineSourceMember,
} from "../analysis/selected-source-member.js";
import type {
  TsonicSourceFileAnalysisContext,
} from "../analysis/context.js";
import {
  type ProviderSourceCallSelector,
  type SelectedProviderSourceCall,
  forEachSelectedProviderSourceCall,
  readSourceFact,
  selectedProviderCallMatches,
} from "../analysis/source-call.js";

// Erased value markers wrap one source value and add only flow evidence; a safety value root sees through them.
const erasedValueMarkers: ReadonlySet<SourceCallMarkerKind> = new Set<SourceCallMarkerKind>([
  "write-only-reference", "read-write-reference", "read-only-reference", "shared-borrow", "mutable-borrow", "move", "struct",
]);
const coreErasedValueMarkers = tsonicCoreSourceSemanticsModules().flatMap(module =>
  module.exports.flatMap(declaration => declaration.kind === "call-marker" && erasedValueMarkers.has(declaration.marker)
    ? [{ module: module.moduleSpecifier, exportName: declaration.exportName }] : []));

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
    rule(member(builder, sourceSafetySignatureIds.indexer), (selected, context) =>
      analyzeMemberSelector(selected, context, contract, "indexer")),
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
    ? selectedValueTarget(selected, context)
    : selected.selection.sourceSelectedMethodTypeArguments?.[0]?.explicitTypeNode;
  if (target === undefined) {
    appendDiagnostic(
      selected,
      context,
      contract,
      "ROOT_TARGET_NOT_PROVEN",
      0,
      "The selected safety root requires a declaration reference, an uncalled function expression or an authored type argument; effectful root expressions are not admitted.",
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
  context: TsonicSourceFileAnalysisContext,
): ExtensionFactSubject | undefined {
  const argument = selected.selection.sourceArguments[0];
  if (argument === undefined) return undefined;
  const { ast, checker } = context;
  function erasedValueMarkerOperand(call: Node): Node | undefined {
    const selection = checker.getResolvedCallInfo(call);
    if (selection?.outcome !== "applicable" || selection.sourceArguments.length !== 1) return undefined;
    const identity = readSourceFact(context, checker.getSignatureDeclaration(selection.selectedSignature),
      providerVirtualDeclarationFactKey);
    if (identity?.providerId !== tsonicCoreVirtualModulesProviderId || identity.providerVersion !== tsonicCoreProviderVersion ||
      identity.memberId !== undefined || !coreErasedValueMarkers.some(marker =>
        marker.module === identity.providerModuleId && marker.exportName === identity.exportId)) return undefined;
    return selection.sourceArguments[0]?.expression;
  }
  function declaration(expression: Node): Node | undefined {
    const operand = pointerFlowOperand(ast, expression);
    if (operand !== undefined) return declaration(operand);
    if (ast.is.IsCallExpression(expression)) {
      const marked = erasedValueMarkerOperand(expression);
      return marked === undefined ? undefined : declaration(marked);
    }
    if (ast.is.IsFunctionExpression(expression) || ast.is.IsArrowFunction(expression)) return expression;
    if (ast.is.IsPropertyAccessExpression(expression)) {
      const receiver = ast.as.AsPropertyAccessExpression(expression)?.Expression;
      if (receiver === undefined || declaration(receiver) === undefined) return undefined;
    } else if (!ast.is.IsIdentifier(expression)) return undefined;
    let symbol = checker.getSymbolAtLocation(expression);
    if (checker.getSymbolDeclarations(symbol).some(node => node !== undefined && (
      ast.is.IsImportSpecifier(node) || ast.is.IsImportClause(node) || ast.is.IsNamespaceImport(node)
    ))) symbol = checker.getAliasedSymbol(symbol);
    const declarations = checker.getSymbolDeclarations(symbol).filter((node): node is Node => node !== undefined);
    if (declarations.some(node => ast.is.IsGetAccessorDeclaration(node) || ast.is.IsSetAccessorDeclaration(node))) return undefined;
    const implementations = declarations.filter(node => ast.body(node) !== undefined);
    return implementations.length === 1 ? implementations[0] : declarations.length === 1 ? declarations[0] : undefined;
  }
  return declaration(argument.expression);
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
  const selection = selectInlineSourceMember(
    selected.selection.sourceArguments[0]?.expression,
    context,
    memberKind === "indexer" ? "element" : "property",
  );
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
    selectedMemberDeclaration: selection.selectedDeclaration,
    selectedMemberDeclarations: selection.selectedDeclarations,
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
    : memberKind === "indexer"
    ? context.ast.is.IsIndexSignatureDeclaration(declaration)
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
  if (
    predecessor.applicationMemberKind !== "property" &&
    predecessor.applicationMemberKind !== "indexer"
  ) {
    appendDiagnostic(
      selected,
      context,
      contract,
      "ACCESSOR_REQUIRES_PROPERTY",
      3,
      `The selected safety ${placement} operation requires a preceding exact property or indexer selection.`,
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
