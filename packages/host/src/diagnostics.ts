import { formatDiagnostics } from "@tsonic/tsts";
import type { CompilerSession } from "@tsonic/tsts";
import type { TargetDiagnostic } from "@tsonic/target-api";
import type { TsonicSemanticSession } from "./compiler-session.js";

export function collectTstsDiagnostics(session: TsonicSemanticSession, currentDirectory: string): readonly TargetDiagnostic[] {
  const diagnostics = session.tstsDiagnostics
    .filter((diagnostic): diagnostic is NonNullable<typeof diagnostic> => diagnostic !== undefined);
  const message = formatDiagnostics(diagnostics, currentDirectory);
  if (message.length === 0) {
    return [];
  }
  return [{
    code: "TSTS_DIAGNOSTIC",
    category: "error",
    message,
    source: "tsts",
  }];
}

export function forceDiagnostics(session: CompilerSession): ReturnType<CompilerSession["getDiagnostics"]> {
  const diagnostics: ReturnType<CompilerSession["getDiagnostics"]>[number][] = [
    ...session.getDiagnostics("config"),
    ...session.getDiagnostics("program"),
    ...session.getDiagnostics("global"),
  ];
  for (const sourceFile of session.getSourceFiles()) {
    diagnostics.push(...session.getDiagnostics("syntactic", sourceFile));
    diagnostics.push(...session.getDiagnostics("bind", sourceFile));
    if (sourceFile?.IsDeclarationFile !== true) {
      diagnostics.push(...session.getDiagnostics("semantic", sourceFile));
    }
  }
  return diagnostics;
}
