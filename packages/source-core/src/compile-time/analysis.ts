import type {
  ExtensionEvidence,
  Node,
  SourceAnalysisContext,
} from "@tsonic/tsts";
import type {
  TsonicSourceFileAnalysisContext,
} from "../analysis/context.js";
import {
  type SelectedProviderSourceCall,
  forEachSelectedProviderSourceCall,
  selectedProviderCallMatches,
} from "../analysis/source-call.js";
import {
  tsonicCoreLangModule,
  tsonicCoreProviderVersion,
  tsonicCoreSourceExtensionId,
  tsonicCoreVirtualModulesProviderId,
} from "../identity.js";
import {
  tsonicCompileTimeProviderNames,
  tsonicCompileTimeSignatureIds,
} from "./declarations.js";
import {
  tsonicCompileTimeFactKey,
  type TsonicCompileTimeFact,
} from "./facts.js";

const compileTimeEvidence = Object.freeze<readonly ExtensionEvidence[]>([{
  message: "Target-neutral compile-time intent derived from one exact selected source-core call.",
}]);

const compileTimeSignatures = [
  [tsonicCompileTimeProviderNames.valueExport, tsonicCompileTimeSignatureIds.value, "value"],
  [tsonicCompileTimeProviderNames.valueExport, tsonicCompileTimeSignatureIds.type, "type"],
  [tsonicCompileTimeProviderNames.conditionExport, tsonicCompileTimeSignatureIds.condition, "condition"],
  [tsonicCompileTimeProviderNames.iterationExport, tsonicCompileTimeSignatureIds.iteration, "iteration"],
] as const;

export function analyzeTsonicCompileTimeOperations(context: SourceAnalysisContext): void {
  forEachSelectedProviderSourceCall(context, (selected, sourceContext): void => {
    const kind = selectedCompileTimeKind(selected, sourceContext);
    if (kind !== undefined) {
      analyzeSelectedCompileTimeOperation(selected, sourceContext, kind);
    }
  });
}

function selectedCompileTimeKind(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileAnalysisContext,
): TsonicCompileTimeFact["kind"] | undefined {
  for (const [exportId, signatureId, kind] of compileTimeSignatures) {
    if (selectedProviderCallMatches(selected, {
      kind: "export-signature",
      providerId: tsonicCoreVirtualModulesProviderId,
      providerVersion: tsonicCoreProviderVersion,
      providerModuleId: tsonicCoreLangModule,
      exportId,
      signatureId,
    }, context)) {
      return kind;
    }
  }
  return undefined;
}

function analyzeSelectedCompileTimeOperation(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileAnalysisContext,
  kind: TsonicCompileTimeFact["kind"],
): void {
  const fact = selectedCompileTimeFact(selected, kind);
  if (fact === undefined) {
    appendDiagnostic(
      selected,
      context,
      "SOURCE_CORE_COMPTIME_SELECTED_EVIDENCE_MISSING",
      9901170,
      "The selected compile-time operation is missing its exact source evidence.",
    );
    return;
  }
  if (kind === "condition" && !isDirectCompileTimeCondition(selected.call, context)) {
    appendDiagnostic(
      selected,
      context,
      "SOURCE_CORE_COMPTIME_CONDITION_POSITION_INVALID",
      9901171,
      "comptimeIf(...) must be the complete condition of an if statement or conditional expression.",
    );
    return;
  }
  if (kind === "iteration" && !isDirectCompileTimeIterable(selected.call, context)) {
    appendDiagnostic(
      selected,
      context,
      "SOURCE_CORE_UNROLL_POSITION_INVALID",
      9901172,
      "unroll(...) must be the complete iterable expression of a for...of statement.",
    );
    return;
  }
  const result = context.facts.set(
    selected.call,
    tsonicCompileTimeFactKey,
    fact,
    compileTimeEvidence,
  );
  if (result !== "inserted" && result !== "idempotent") {
    appendDiagnostic(
      selected,
      context,
      "SOURCE_CORE_COMPTIME_FACT_WRITE_FAILED",
      9901173,
      `The selected compile-time operation fact could not be recorded (${result}).`,
    );
  }
}

function selectedCompileTimeFact(
  selected: SelectedProviderSourceCall,
  kind: TsonicCompileTimeFact["kind"],
): TsonicCompileTimeFact | undefined {
  if (kind === "type") {
    const argument = selected.selection.sourceSelectedMethodTypeArguments?.[0];
    return argument === undefined
      ? undefined
      : Object.freeze({
          kind,
          selectedType: argument.selectedType,
          typeParameter: argument.typeParameter,
          ...(argument.explicitTypeNode === undefined
            ? {}
            : { explicitTypeNode: argument.explicitTypeNode }),
          resultType: selected.selection.sourceResultType,
        });
  }
  const argument = selected.selection.sourceArguments[0];
  if (argument === undefined) {
    return undefined;
  }
  switch (kind) {
    case "value":
      return Object.freeze({
        kind,
        expression: argument.expression,
        sourceType: argument.type,
        resultType: selected.selection.sourceResultType,
      });
    case "condition":
      return Object.freeze({
        kind,
        condition: argument.expression,
        sourceType: argument.type,
        resultType: selected.selection.sourceResultType,
      });
    case "iteration":
      return Object.freeze({
        kind,
        iterable: argument.expression,
        sourceType: argument.type,
        resultType: selected.selection.sourceResultType,
      });
  }
}

function isDirectCompileTimeCondition(
  call: Node,
  context: TsonicSourceFileAnalysisContext,
): boolean {
  const expression = outerParenthesizedExpression(call, context);
  const parent = context.ast.parent(expression);
  if (parent === undefined) {
    return false;
  }
  if (context.ast.is.IsIfStatement(parent)) {
    return context.ast.as.AsIfStatement(parent).Expression === expression;
  }
  return context.ast.is.IsConditionalExpression(parent) &&
    context.ast.as.AsConditionalExpression(parent).Condition === expression;
}

function isDirectCompileTimeIterable(
  call: Node,
  context: TsonicSourceFileAnalysisContext,
): boolean {
  const expression = outerParenthesizedExpression(call, context);
  const parent = context.ast.parent(expression);
  return parent !== undefined &&
    context.ast.is.IsForOfStatement(parent) &&
    context.ast.as.AsForInOrOfStatement(parent).Expression === expression;
}

function outerParenthesizedExpression(
  expression: Node,
  context: TsonicSourceFileAnalysisContext,
): Node {
  let current = expression;
  let parent = context.ast.parent(current);
  while (parent !== undefined && context.ast.is.IsParenthesizedExpression(parent)) {
    const inner = context.ast.as.AsParenthesizedExpression(parent).Expression;
    if (inner !== current) {
      break;
    }
    current = parent;
    parent = context.ast.parent(current);
  }
  return current;
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
    identity: [
      "source-core-comptime",
      extensionCode,
      context.ast.getPath(context.ast.getSourceFile(selected.call)),
      context.ast.pos(selected.call),
      context.ast.end(selected.call),
    ].join(":"),
  });
}
