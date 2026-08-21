import type {
  AstReader,
  SourceFile,
} from "@tsonic/tsts";
import type {
  SourceProgramDocuments,
  TargetSourceProgram,
} from "../source-semantics/types.js";

export interface TargetSourceSyntaxProgram {
  readonly ast: AstReader;
  readonly sourceFiles: readonly SourceFile[];
  readonly documents: SourceProgramDocuments;
}

export function targetSourceSyntaxProgram(
  source: TargetSourceProgram,
): TargetSourceSyntaxProgram {
  return Object.freeze({
    ast: source.ast,
    sourceFiles: Object.freeze([...source.sourceFiles]),
    documents: source.documents,
  });
}
