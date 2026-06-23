import { formatDiagnostics } from "@tsonic/tsts";
import type { CompilerSession } from "@tsonic/tsts";
import type { TargetDiagnostic } from "@tsonic/target-api";
import type { TsonicSemanticSession } from "./compiler-session.js";

export function collectTstsDiagnostics(session: TsonicSemanticSession, currentDirectory: string): readonly TargetDiagnostic[] {
  const diagnostics = session.compiler.getDiagnostics("all")
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

export function forceDiagnostics(session: CompilerSession): void {
  session.getDiagnostics("program");
  for (const sourceFile of session.getSourceFiles()) {
    session.getDiagnostics("syntactic", sourceFile);
    session.getDiagnostics("semantic", sourceFile);
  }
}
