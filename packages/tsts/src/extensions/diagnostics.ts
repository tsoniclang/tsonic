import type { GoPtr, GoSlice } from "../go/compat.js";
import type { Diagnostic } from "../internal/ast/diagnostic.js";
import { NewDiagnostic } from "../internal/ast/diagnostic.js";
import type { Node, SourceFile } from "../internal/ast/ast.js";
import { GetSourceFileOfNode } from "../internal/ast/utilities.js";
import { NewTextRange } from "../internal/core/text.js";
import type { Message } from "../internal/diagnostics/diagnostics.js";
import { CategoryError, CategorySuggestion, CategoryWarning } from "../internal/diagnostics/diagnostics.js";
import { NewDiagnosticForNode } from "../internal/checker/utilities.js";
import { getExtensionHost } from "./host.js";
import type { ExtensionDiagnostic, ExtensionDiagnosticSourceSpan } from "./host.js";

export function collectExtensionDiagnosticsForSourceFile(program: object, sourceFile: GoPtr<SourceFile>): GoSlice<GoPtr<Diagnostic>> {
  const extensionHost = getExtensionHost(program);
  if (extensionHost === undefined) {
    return [];
  }
  const diagnostics: GoPtr<Diagnostic>[] = [];
  for (const diagnostic of extensionHost.diagnostics.all()) {
    const converted = convertExtensionDiagnostic(diagnostic, sourceFile);
    if (converted !== undefined) {
      diagnostics.push(converted);
    }
  }
  return diagnostics;
}

function convertExtensionDiagnostic(diagnostic: ExtensionDiagnostic, sourceFile: GoPtr<SourceFile>): GoPtr<Diagnostic> {
  const message = createExtensionDiagnosticMessage(diagnostic);
  const location = diagnostic.nodeOrSpan;
  if (isNode(location)) {
    const diagnosticSourceFile = GetSourceFileOfNode(location);
    if (sourceFile !== undefined && diagnosticSourceFile !== sourceFile) {
      return undefined;
    }
    return NewDiagnosticForNode(location, message);
  }
  if (isExtensionDiagnosticSourceSpan(location)) {
    if (sourceFile !== undefined && location.sourceFile !== sourceFile) {
      return undefined;
    }
    return NewDiagnostic(location.sourceFile as SourceFile, NewTextRange(location.pos, location.end), message);
  }
  return undefined;
}

function createExtensionDiagnosticMessage(diagnostic: ExtensionDiagnostic): Message {
  const publicCode = diagnostic.publicCode ?? `TSEXT${diagnostic.numericCode}`;
  const key = `${diagnostic.extensionId}.${diagnostic.extensionCode}.${diagnostic.numericCode}`;
  return {
    code: diagnostic.numericCode,
    category: mapExtensionDiagnosticCategory(diagnostic.category),
    key,
    text: `[${publicCode}] ${diagnostic.message}`,
  };
}

function mapExtensionDiagnosticCategory(category: ExtensionDiagnostic["category"]): Message["category"] {
  switch (category) {
    case "error":
      return CategoryError;
    case "warning":
      return CategoryWarning;
    case "suggestion":
      return CategorySuggestion;
  }
}

function isNode(value: unknown): value is Node {
  return typeof value === "object"
    && value !== null
    && "Kind" in value
    && "Loc" in value
    && "data" in value;
}

function isExtensionDiagnosticSourceSpan(value: unknown): value is ExtensionDiagnosticSourceSpan {
  return typeof value === "object"
    && value !== null
    && "sourceFile" in value
    && "pos" in value
    && "end" in value
    && typeof value.sourceFile === "object"
    && value.sourceFile !== null
    && typeof value.pos === "number"
    && typeof value.end === "number";
}
