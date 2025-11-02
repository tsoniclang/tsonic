/**
 * Diagnostic types for Tsonic compiler
 */

export type DiagnosticSeverity = "error" | "warning" | "info";

export type DiagnosticCode =
  | "TSN1001" // Local import missing .ts extension
  | "TSN1002" // Circular dependency detected
  | "TSN1003" // Case mismatch in import path
  | "TSN1004" // Module not found
  | "TSN1005" // Conflicting exports
  | "TSN1006" // Invalid namespace
  | "TSN2001" // Unsupported TypeScript feature
  | "TSN2002" // Invalid type mapping
  | "TSN3001" // C# reserved keyword used
  | "TSN3002" // Invalid C# identifier
  | "TSN4001" // .NET interop error
  | "TSN4002" // Missing .NET type declaration
  | "TSN5001" // NativeAOT limitation
  | "TSN5002" // Runtime implementation missing
  | "TSN6001" // Internal compiler error
  | "TSN7101" // Recursive mapped types not supported
  | "TSN7102" // Conditional types using infer not supported
  | "TSN7103" // `this` typing not supported
  | "TSN7104" // Generic constructor constraints with rest parameters not supported
  | "TSN7105" // Cannot determine required type specialisations
  | "TSN7201" // Recursive structural alias not supported
  | "TSN7202" // Conditional alias cannot be resolved
  | "TSN7203" // Symbol keys not supported
  | "TSN7204"; // Variadic generic interface not supported

export type SourceLocation = {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly length: number;
};

export type Diagnostic = {
  readonly code: DiagnosticCode;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly location?: SourceLocation;
  readonly hint?: string;
  readonly relatedLocations?: readonly SourceLocation[];
};

export const createDiagnostic = (
  code: DiagnosticCode,
  severity: DiagnosticSeverity,
  message: string,
  location?: SourceLocation,
  hint?: string,
  relatedLocations?: readonly SourceLocation[]
): Diagnostic => ({
  code,
  severity,
  message,
  location,
  hint,
  relatedLocations,
});

export const isError = (diagnostic: Diagnostic): boolean =>
  diagnostic.severity === "error";

export const formatDiagnostic = (diagnostic: Diagnostic): string => {
  const parts: string[] = [];

  if (diagnostic.location) {
    parts.push(
      `${diagnostic.location.file}:${diagnostic.location.line}:${diagnostic.location.column}`
    );
  }

  parts.push(`${diagnostic.severity} ${diagnostic.code}:`);
  parts.push(diagnostic.message);

  if (diagnostic.hint) {
    parts.push(`Hint: ${diagnostic.hint}`);
  }

  return parts.join(" ");
};

export type DiagnosticsCollector = {
  readonly diagnostics: readonly Diagnostic[];
  readonly hasErrors: boolean;
};

export const createDiagnosticsCollector = (): DiagnosticsCollector => ({
  diagnostics: [],
  hasErrors: false,
});

export const addDiagnostic = (
  collector: DiagnosticsCollector,
  diagnostic: Diagnostic
): DiagnosticsCollector => ({
  diagnostics: [...collector.diagnostics, diagnostic],
  hasErrors: collector.hasErrors || isError(diagnostic),
});

export const mergeDiagnostics = (
  collector1: DiagnosticsCollector,
  collector2: DiagnosticsCollector
): DiagnosticsCollector => ({
  diagnostics: [...collector1.diagnostics, ...collector2.diagnostics],
  hasErrors: collector1.hasErrors || collector2.hasErrors,
});
