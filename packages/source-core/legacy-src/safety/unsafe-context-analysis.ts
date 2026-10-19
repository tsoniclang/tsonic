import type {
  ExtensionFactKey,
  Node,
  SourceAnalysisContext,
} from "@tsonic/tsts";
import type {
  TsonicUnsafeContextFact,
} from "./facts.js";
import type {
  TsonicSourceFileAnalysisContext,
} from "../analysis/context.js";
import {
  type ProviderSourceCallSelector,
  type SelectedProviderSourceCall,
  forEachSelectedProviderSourceCall,
  selectedProviderCallMatches,
} from "../analysis/source-call.js";

export interface UnsafeContextAnalysisContract {
  readonly blockSelector: ProviderSourceCallSelector;
  readonly expressionSelector: ProviderSourceCallSelector;
  readonly factKey: ExtensionFactKey<TsonicUnsafeContextFact>;
  readonly extensionId: string;
  readonly invalidPositionCode: string;
  readonly invalidPositionNumber: number;
  readonly factWriteCode: string;
  readonly factWriteNumber: number;
}

export function analyzeUnsafeContextCalls(
  context: SourceAnalysisContext,
  contract: UnsafeContextAnalysisContract,
): void {
  forEachSelectedProviderSourceCall(context, (selected, sourceContext): void => {
    if (
      selectedProviderCallMatches(
        selected,
        contract.expressionSelector,
        sourceContext,
      )
    ) {
      const expression = selected.selection.sourceArguments[0]?.expression;
      if (expression !== undefined) {
        writeUnsafeContextFact(
          selected,
          sourceContext,
          { kind: "expression", expression },
          contract,
        );
      }
      return;
    }
    if (
      !selectedProviderCallMatches(
        selected,
        contract.blockSelector,
        sourceContext,
      )
    ) {
      return;
    }
    if (!isFirstDirectStatement(selected.call, sourceContext)) {
      appendDiagnostic(
        selected,
        sourceContext,
        contract.extensionId,
        contract.invalidPositionCode,
        contract.invalidPositionNumber,
        "The no-argument unsafe-context marker must be the first direct expression statement of its source block.",
      );
      return;
    }
    writeUnsafeContextFact(
      selected,
      sourceContext,
      { kind: "remaining-block" },
      contract,
    );
  });
}

function isFirstDirectStatement(
  call: Node,
  context: TsonicSourceFileAnalysisContext,
): boolean {
  let expression: Node = call;
  let parent = context.ast.parent(expression);
  while (
    parent !== undefined &&
    context.ast.is.IsParenthesizedExpression(parent)
  ) {
    expression = parent;
    parent = context.ast.parent(parent);
  }
  if (
    parent === undefined ||
    !context.ast.is.IsExpressionStatement(parent) ||
    context.ast.as.AsExpressionStatement(parent)?.Expression !== expression
  ) {
    return false;
  }
  const statementOwner = context.ast.parent(parent);
  if (statementOwner === undefined) {
    return false;
  }
  return context.ast.statements(statementOwner)
    .find((statement): statement is Node => statement !== undefined) === parent;
}

function writeUnsafeContextFact(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileAnalysisContext,
  fact: TsonicUnsafeContextFact,
  contract: UnsafeContextAnalysisContract,
): void {
  const result = context.facts.set(
    selected.call,
    contract.factKey,
    fact,
    [{
      message: "Unsafe context fact derived from one exact selected provider call.",
    }],
  );
  if (result === "inserted" || result === "idempotent") {
    return;
  }
  appendDiagnostic(
    selected,
    context,
    contract.extensionId,
    contract.factWriteCode,
    contract.factWriteNumber,
    `The selected unsafe-context fact could not be recorded (${result}).`,
  );
}

function appendDiagnostic(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileAnalysisContext,
  extensionId: string,
  extensionCode: string,
  numericCode: number,
  message: string,
): void {
  context.diagnostics.append({
    extensionId,
    extensionCode,
    numericCode,
    category: "error",
    message,
    nodeOrSpan: selected.call,
    identity: `unsafe-context:${extensionCode}:${context.ast.getPath(context.ast.getSourceFile(selected.call))}:${context.ast.pos(selected.call)}:${context.ast.end(selected.call)}`,
  });
}
