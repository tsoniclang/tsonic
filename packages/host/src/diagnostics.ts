import { formatDiagnostics } from "@tsonic/tsts";
import { formatDiagnosticEvidenceDetails } from "@tsonic/target-api/artifacts";
import type { CheckedSourceProgram, SourceFile } from "@tsonic/tsts";
import { createSourceDiagnosticSpanReader } from "@tsonic/target-api/source";
import type {
  TargetDiagnostic,
  TargetDiagnosticSourceSpan,
} from "@tsonic/target-api/artifacts";
import { isAbsolute, relative } from "node:path";
import { isPathWithinOrEqual } from "./path-relation.js";

export function collectTstsDiagnostics(source: CheckedSourceProgram, currentDirectory: string): readonly TargetDiagnostic[] {
  const spans = createSourceDiagnosticSpanReader(source.ast);
  const diagnostics = source.diagnostics
    .filter((diagnostic): diagnostic is NonNullable<typeof diagnostic> => diagnostic !== undefined);
  const tstsDiagnostics: TargetDiagnostic[] = diagnostics.map((diagnostic): TargetDiagnostic => ({
    code: "TSTS_DIAGNOSTIC",
    category: tstsDiagnosticCategory(diagnostic),
    message: formatDiagnostics([diagnostic], currentDirectory).trimEnd(),
    source: "tsts",
    sourceSpan: getTstsDiagnosticSourceSpan(diagnostic, currentDirectory, spans),
    evidence: tstsDiagnosticEvidence(diagnostic),
  }));
  return [
    ...tstsDiagnostics,
    ...source.extensionDiagnostics.map((diagnostic): TargetDiagnostic => ({
      code: `TS${diagnostic.numericCode}`,
      category: diagnostic.category,
      message: diagnostic.message,
      source: diagnostic.extensionId,
      sourceSpan: getExtensionDiagnosticSourceSpan(source, diagnostic.nodeOrSpan, currentDirectory, spans),
      evidence: diagnostic.evidence?.map((entry) =>
        entry.details === undefined ? entry.message : `${entry.message}: ${formatDiagnosticEvidenceDetails(entry.details)}`),
    })),
  ];
}

export function finalizeTargetDiagnostics(
  source: CheckedSourceProgram,
  diagnostics: readonly TargetDiagnostic[],
  currentDirectory: string,
): readonly TargetDiagnostic[] {
  const spans = createSourceDiagnosticSpanReader(source.ast);
  return diagnostics.map((diagnostic) => {
    const sourceSpan = diagnostic.sourceSpan ??
      getExtensionDiagnosticSourceSpan(
        source,
        diagnostic.sourceNode,
        currentDirectory,
        spans,
      );
    const { sourceNode: _sourceNode, ...result } = diagnostic;
    return {
      ...result,
      ...(sourceSpan === undefined ? {} : { sourceSpan }),
    };
  });
}

function tstsDiagnosticCategory(diagnostic: unknown): TargetDiagnostic["category"] {
  const category = isObjectRecord(diagnostic) ? diagnostic.category : undefined;
  if (category === 0 || category === "warning") {
    return "warning";
  }
  if (category === 2 || category === 3 || category === "suggestion" || category === "message") {
    return "suggestion";
  }
  return "error";
}

function tstsDiagnosticEvidence(diagnostic: unknown): readonly string[] {
  const code = isObjectRecord(diagnostic) ? diagnostic.code : undefined;
  return typeof code === "number" || typeof code === "string"
    ? [`tsts.code=TS${code}`]
    : [];
}

function getTstsDiagnosticSourceSpan(
  diagnostic: unknown,
  currentDirectory: string,
  spans: ReturnType<typeof createSourceDiagnosticSpanReader>,
): TargetDiagnosticSourceSpan | undefined {
  if (!isObjectRecord(diagnostic)) {
    return undefined;
  }
  const file = diagnostic.file;
  const loc = diagnostic.loc;
  if (!isSourceFileLike(file) || !isDiagnosticLocation(loc)) {
    return undefined;
  }
  return createSourceSpan(file, loc.pos, loc.end, currentDirectory, spans);
}

function isSourceFileLike(value: unknown): value is SourceFile {
  return typeof value === "object" && value !== null;
}

function isDiagnosticLocation(value: unknown): value is { readonly pos: number; readonly end: number } {
  return isObjectRecord(value) &&
    typeof value.pos === "number" &&
    typeof value.end === "number";
}

function getExtensionDiagnosticSourceSpan(
  source: CheckedSourceProgram,
  nodeOrSpan: unknown,
  currentDirectory: string,
  spans: ReturnType<typeof createSourceDiagnosticSpanReader>,
): TargetDiagnosticSourceSpan | undefined {
  if (nodeOrSpan === undefined || nodeOrSpan === null || typeof nodeOrSpan !== "object") {
    return undefined;
  }
  if (isExtensionDiagnosticSourceSpan(nodeOrSpan)) {
    return createSourceSpan(
      nodeOrSpan.sourceFile as SourceFile,
      nodeOrSpan.pos,
      nodeOrSpan.end,
      currentDirectory,
      spans,
    );
  }
  if (source.ast.kind(nodeOrSpan as SourceFile) === undefined) {
    return undefined;
  }
  const sourceFile = source.ast.getSourceFile(nodeOrSpan as SourceFile);
  if (sourceFile === undefined) {
    return undefined;
  }
  return createSourceSpan(
    sourceFile,
    source.ast.pos(nodeOrSpan as SourceFile),
    source.ast.end(nodeOrSpan as SourceFile),
    currentDirectory,
    spans,
  );
}

function isExtensionDiagnosticSourceSpan(
  value: object,
): value is { readonly sourceFile: object; readonly pos: number; readonly end: number } {
  const record = value as Readonly<Record<string, unknown>>;
  return typeof record.sourceFile === "object" &&
    record.sourceFile !== null &&
    typeof record.pos === "number" &&
    typeof record.end === "number";
}

function createSourceSpan(
  sourceFile: SourceFile,
  pos: number,
  end: number,
  currentDirectory: string,
  spans: ReturnType<typeof createSourceDiagnosticSpanReader>,
): TargetDiagnosticSourceSpan | undefined {
  const span = spans(sourceFile, pos, end);
  return span === undefined ? undefined : { ...span, fileName: formatSourceFileName(span.fileName, currentDirectory) };
}

function formatSourceFileName(fileName: string, currentDirectory: string): string {
  if (!isAbsolute(fileName)) {
    return fileName.split("\\").join("/");
  }
  const relativePath = relative(currentDirectory, fileName);
  if (isPathWithinOrEqual(currentDirectory, fileName)) {
    return relativePath.split("\\").join("/");
  }
  return fileName.split("\\").join("/");
}

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
