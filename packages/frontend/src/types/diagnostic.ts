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
  | "TSN2003" // File name conflicts with exported member name
  | "TSN3001" // C# reserved keyword used
  | "TSN3002" // Invalid C# identifier
  | "TSN3011" // Promise chaining (.then/.catch/.finally) not supported
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
  | "TSN7204" // Variadic generic interface not supported
  | "TSN7301" // Class cannot implement nominalized interface
  // Static/AOT safety errors (TSN7401-TSN7499)
  | "TSN7401" // 'any' type not supported - requires explicit type
  | "TSN7403" // Object literal requires contextual nominal type
  | "TSN7405" // Untyped lambda parameter - requires explicit type annotation
  | "TSN7413" // Dictionary key must be string type
  // Metadata loading errors (TSN9001-TSN9018)
  | "TSN9001" // Metadata file not found
  | "TSN9002" // Failed to read metadata file
  | "TSN9003" // Invalid JSON in metadata file
  | "TSN9004" // Metadata file must be an object
  | "TSN9005" // Missing or invalid 'namespace' field
  | "TSN9006" // Missing or invalid 'contributingAssemblies' field
  | "TSN9007" // All 'contributingAssemblies' must be strings
  | "TSN9008" // Missing or invalid 'types' field
  | "TSN9009" // Invalid type: must be an object
  | "TSN9010" // Invalid type: missing or invalid field
  | "TSN9011" // Invalid type: 'kind' must be one of ...
  | "TSN9012" // Invalid type: 'accessibility' must be one of ...
  | "TSN9013" // Invalid type: field must be a boolean
  | "TSN9014" // Invalid type: 'arity' must be a non-negative number
  | "TSN9015" // Invalid type: field must be an array
  | "TSN9016" // Metadata directory not found
  | "TSN9017" // Not a directory
  | "TSN9018" // No .metadata.json files found
  // Bindings loading errors (TSN9101-TSN9114)
  | "TSN9101" // Bindings file not found
  | "TSN9102" // Failed to read bindings file
  | "TSN9103" // Invalid JSON in bindings file
  | "TSN9104" // Bindings file must be an object
  | "TSN9105" // Missing or invalid 'namespace' field
  | "TSN9106" // Missing or invalid 'types' field
  | "TSN9107" // Invalid type binding: must be an object
  | "TSN9108" // Invalid type binding: missing or invalid field
  | "TSN9109" // Invalid type binding: 'metadataToken' must be a number
  | "TSN9110" // Invalid type binding: V1 field must be an array if present
  | "TSN9111" // Invalid type binding: V2 field must be an array if present
  | "TSN9112" // Bindings directory not found
  | "TSN9113" // Not a directory
  | "TSN9114"; // No .bindings.json files found

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
